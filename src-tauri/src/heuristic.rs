//! The offline surprise proxy.
//!
//! The real definition of the metric is perplexity: **boilerplate is code a model can
//! predict from its context.** That needs a model. This module is what runs when there
//! isn't one — a set of cheap, local, deterministic measurements that correlate with
//! predictability and, critically, need no setup, no download and no network. It is the
//! default because a tool that shows you nothing until you install a 4GB model is a tool
//! nobody sees the point of.
//!
//! It is a **proxy** and the UI says so. Everything here is arranged so the model-backed
//! scorer (`surprise.rs`) can replace the `surprise` term without touching the tree, the
//! aggregation, or the cooling — those are the parts that make the picture, and they
//! must not care where the number came from.
//!
//! Four measurements, each 0..1, mixed by `WEIGHTS`:
//!
//! 1. **Distinctiveness** — how unlike its siblings the body is. The strongest signal
//!    by a distance, because the dominant form of boilerplate in a real repo is *the
//!    twelfth copy of the same handler*, and nothing else detects that.
//! 2. **Vocabulary novelty** — how much the body talks about things its own name and
//!    signature didn't already imply. The cheapest stand-in for the real question.
//! 3. **Incompressibility** — repetitive text compresses; novel logic doesn't.
//! 4. **Branch density** — decisions per line. Straight-line code is predictable.

use flate2::write::DeflateEncoder;
use flate2::Compression;
use std::collections::HashSet;
use std::io::Write;

/// Contributions to the mixed score. They sum to 1. Distinctiveness carries the most
/// because it is the only term that can see across functions, and the "you have written
/// this same thing twelve times" finding is the one users react to.
const WEIGHTS: [f32; 4] = [0.35, 0.30, 0.20, 0.15];

/// Below this many 3-grams there is not enough text to compare against anything.
/// Counted over the *lexed* stream, where punctuation is its own token — a six-line
/// function clears twenty shingles easily, so this floor sits higher than it looks.
const MIN_SHINGLES: usize = 25;

/// The value every term returns when it has too little text to measure. Not 0 and not 1
/// — "we don't know", which is the truthful answer and the only one that doesn't tilt
/// the mix.
///
/// Each of the four terms degrades on short input *in the same direction*: few shingles
/// means no sibling can match, few words means most look novel, few bytes means
/// compression says nothing, few lines means one `if` is a high branch rate. Untreated
/// they compound, and the first real scan duly ranked `fn main()` as tally's most
/// surprising code. The fix has to live in each term, at the point where that term knows
/// it is out of evidence — a single global length penalty just swaps the bias round, so
/// that instead of "short means hot" the map says "long means hot", and either way it is
/// measuring length rather than surprise.
pub const UNDECIDED: f32 = 0.5;

/// Distinct meaningful words below which vocabulary novelty means nothing.
const MIN_WORDS: usize = 8;

/// Lines below which a branch count is noise — one `if` in three lines is not a dense
/// decision surface, it is a guard clause.
const MIN_LINES_FOR_BRANCHING: usize = 5;

/// Map `v` from the range [lo, hi] onto [0, 1], clamped. Every raw measurement below has
/// a useful band far narrower than its theoretical 0..1, and spreading that band over
/// the full output range is what stops every wedge landing in the tepid middle — which
/// is the failure mode that would make the whole picture useless.
fn linmap(v: f32, lo: f32, hi: f32) -> f32 {
    ((v - lo) / (hi - lo)).clamp(0.0, 1.0)
}

/// Split source text into lowercase word-parts: identifiers broken on camelCase,
/// snake_case and kebab-case, punctuation dropped, short and structural words dropped.
///
/// Words shorter than three characters go because `i`, `j`, `ok`, `to` carry no meaning
/// about what code *does*, and they'd otherwise dominate the overlap arithmetic.
pub fn words(src: &str) -> Vec<String> {
    let mut out = Vec::new();
    let mut cur = String::new();
    let mut prev_lower = false;
    for ch in src.chars() {
        if ch.is_alphanumeric() {
            // camelCase boundary: a capital right after a lowercase starts a new word.
            if ch.is_uppercase() && prev_lower && !cur.is_empty() {
                out.push(std::mem::take(&mut cur));
            }
            cur.push(ch.to_ascii_lowercase());
            prev_lower = ch.is_lowercase() || ch.is_numeric();
        } else {
            if !cur.is_empty() {
                out.push(std::mem::take(&mut cur));
            }
            prev_lower = false;
        }
    }
    if !cur.is_empty() {
        out.push(cur);
    }
    out.retain(|w| w.len() >= 3 && !is_structural(w));
    out
}

/// Keywords and universal plumbing shared by every language we parse. These say nothing
/// about what a particular function is *for*, so they're excluded from vocabulary
/// comparisons — otherwise two entirely unrelated Rust functions look 40% alike purely
/// because both contain `let`, `self`, `return` and `err`.
fn is_structural(w: &str) -> bool {
    const STRUCTURAL: &[&str] = &[
        "let", "const", "var", "fun", "func", "def", "fn", "return", "self", "this", "new", "null",
        "nil", "none", "true", "false", "and", "not", "the", "for", "while", "loop", "match",
        "case", "else", "elif", "then", "async", "await", "type", "class", "struct", "enum",
        "impl", "pub", "use", "import", "from", "export", "default", "static", "mut", "ref", "int",
        "str", "string", "bool", "err", "error", "res", "result", "ret", "val", "value", "out",
        "tmp", "obj", "args", "arg", "opts", "opt", "param", "params",
    ];
    STRUCTURAL.contains(&w)
}

/// Lex into identifier runs and individual punctuation marks.
///
/// Splitting on whitespace instead is the obvious shortcut and it wrecks the comparison:
/// it glues punctuation to identifiers, so `db.query(USERS,` and `db.query(ORDERS,`
/// become entirely different tokens and two functions that differ by one word look
/// unrelated. Separating punctuation means the *structure* dominates, which is exactly
/// what a template is.
///
/// Iterates `char_indices`, never bytes. Stepping byte-wise and casting `u8 as char` is
/// the tempting shortcut and it panics on real source: the lead byte of an em dash
/// (0xE2) casts to `â`, which *is* alphanumeric, so the scan enters an identifier run at
/// a multi-byte boundary and then slices mid-codepoint. Comments in any codebase that
/// uses typographic punctuation hit it within seconds.
fn lex(src: &str) -> Vec<&str> {
    let mut out = Vec::new();
    let mut chars = src.char_indices().peekable();
    while let Some((i, c)) = chars.next() {
        if c.is_whitespace() {
            continue;
        }
        if c.is_alphanumeric() || c == '_' {
            let mut end = i + c.len_utf8();
            while let Some(&(j, next)) = chars.peek() {
                if next.is_alphanumeric() || next == '_' {
                    end = j + next.len_utf8();
                    chars.next();
                } else {
                    break;
                }
            }
            out.push(&src[i..end]);
        } else {
            out.push(&src[i..i + c.len_utf8()]);
        }
    }
    out
}

/// Token 3-grams over the lexed stream (keywords included, unlike `words`).
///
/// Structure is exactly what we want here: two handlers that differ only in which table
/// they touch have near-identical shingle sets, which is the template we're hunting.
fn shingles(src: &str) -> HashSet<u64> {
    let toks = lex(src);
    if toks.len() < 3 {
        return HashSet::new();
    }
    toks.windows(3).map(|w| fnv(w.join(" ").as_bytes())).collect()
}

/// FNV-1a's shape, with a multiplier that is NOT FNV-1a's prime. Read the name as a
/// description of the loop, not a claim about the algorithm.
///
/// The constant should be `0x0000_0100_0000_01b3` and is `0x1000_0000_01b3` — the same
/// digits, grouped one place out, and copied into `cache.rs` and `assessment.rs` before
/// anyone noticed. A cold reader predicted FNV-1a from this comment, read the body, and
/// found a different number.
///
/// **Left as it is, deliberately.** Nothing here needs FNV: shingles need a stable
/// spread, and the structure is the same — a power of two plus a small odd number — so it
/// mixes on the same principle. Correcting it would move every shingle hash, hence every
/// distinctiveness score, hence the color of every proxy-scored wedge in every repo; and
/// the twin in `assessment.rs` is inside `body_hash`, so changing that one expires every
/// committed reading everywhere. A doc that names an algorithm the code does not
/// implement is the bug. Fixed by saying so.
///
/// If real FNV-1a is ever wanted here, it is a one-line change and a full re-read.
///
/// A hash set of `u64` rather than of `String` — a large repo produces millions of
/// shingles and the strings are pure allocation churn we never need to read back.
fn fnv(bytes: &[u8]) -> u64 {
    let mut h: u64 = 0xcbf2_9ce4_8422_2325;
    for b in bytes {
        h ^= *b as u64;
        h = h.wrapping_mul(0x1000_0000_01b3);
    }
    h
}

fn jaccard(a: &HashSet<u64>, b: &HashSet<u64>) -> f32 {
    if a.is_empty() || b.is_empty() {
        return 0.0;
    }
    let inter = a.intersection(b).count() as f32;
    let union = (a.len() + b.len()) as f32 - inter;
    if union == 0.0 {
        0.0
    } else {
        inter / union
    }
}

/// How much the body resists compression. Repetition — the literal signature of
/// scaffolding — is what deflate removes, so a low ratio means "this text is mostly
/// itself repeated".
fn incompressibility(body: &str) -> f32 {
    // Deflate's fixed overhead is ~11 bytes, which swamps the ratio on short input and
    // would report every three-line function as maximally novel. Below the floor we
    // decline to measure and return the neutral midpoint rather than a confident lie.
    const MIN_BYTES: usize = 200;
    let norm: String = body.split_whitespace().collect::<Vec<_>>().join(" ");
    if norm.len() < MIN_BYTES {
        return UNDECIDED;
    }
    let mut enc = DeflateEncoder::new(Vec::new(), Compression::default());
    if enc.write_all(norm.as_bytes()).is_err() {
        return UNDECIDED;
    }
    let Ok(compressed) = enc.finish() else {
        return UNDECIDED;
    };
    let ratio = compressed.len() as f32 / norm.len() as f32;
    // Measured across the sibling projects: highly templated code lands near 0.25,
    // dense hand-written logic near 0.70.
    linmap(ratio, 0.25, 0.70)
}

/// Decisions per line. `?` counts: in Rust it is a branch wearing one character.
fn branch_density(body: &str) -> f32 {
    const BRANCH: &[&str] = &[
        "if", "else", "match", "case", "switch", "for", "while", "loop", "try", "catch", "except",
        "&&", "||", "?",
    ];
    let line_count = body.lines().count();
    if line_count < MIN_LINES_FOR_BRANCHING {
        return UNDECIDED;
    }
    let lines = line_count as f32;
    let hits = body
        .split(|c: char| !c.is_alphanumeric() && c != '&' && c != '|' && c != '?')
        .filter(|t| BRANCH.contains(t))
        .count() as f32;
    linmap(hits / lines, 0.02, 0.25)
}

/// How much of the body's vocabulary its own name and signature did not already imply.
///
/// This is the cheap shadow of the real metric. `serializeUser` whose body says nothing
/// but *user*, *serialize* and *field* is exactly the code a model would guess; the same
/// function reaching for *retry*, *backoff* and *clock* is not.
fn vocabulary_novelty(signature: &str, body: &str) -> f32 {
    let known: HashSet<String> = words(signature).into_iter().collect();
    let body_words: HashSet<String> = words(body).into_iter().collect();
    if body_words.len() < MIN_WORDS {
        return UNDECIDED;
    }
    let novel = body_words.iter().filter(|w| !known.contains(*w)).count() as f32;
    linmap(novel / body_words.len() as f32, 0.35, 0.85)
}

/// Precomputed per-function state, so the O(n²) sibling comparison hashes each body once
/// instead of once per pair.
pub struct Fingerprint {
    shingles: HashSet<u64>,
}

pub fn fingerprint(body: &str) -> Fingerprint {
    Fingerprint { shingles: shingles(body) }
}

/// 1 − (closest sibling match). `peers` should be the other functions in the same file,
/// falling back to the same directory when a file holds only one.
pub fn distinctiveness(me: &Fingerprint, peers: &[&Fingerprint]) -> f32 {
    // A function with nothing to compare against isn't "maximally distinctive" — we
    // simply have no evidence either way, and claiming 1.0 would light up every
    // single-function file in the repo.
    //
    // The same applies to a body too short to shingle. Jaccard over a handful of
    // 3-grams is near zero against *anything*, so without this floor every three-line
    // accessor scores as the most original code in the repo — which is exactly what the
    // first run against a real project produced.
    if peers.is_empty() || me.shingles.len() < MIN_SHINGLES {
        return UNDECIDED;
    }
    let closest = peers.iter().map(|p| jaccard(&me.shingles, &p.shingles)).fold(0.0f32, f32::max);
    // Even near-duplicate functions rarely exceed ~0.6 Jaccard once identifiers differ,
    // so the interesting band sits low. Above 0.55 overlap it is the same function.
    1.0 - linmap(closest, 0.08, 0.55)
}

/// The mixed proxy, 0..1.
pub fn surprise(signature: &str, body: &str, distinctiveness: f32) -> f32 {
    let terms = [
        distinctiveness,
        vocabulary_novelty(signature, body),
        incompressibility(body),
        branch_density(body),
    ];
    let raw: f32 = terms.iter().zip(WEIGHTS.iter()).map(|(t, w)| t * w).sum();
    calibrate(raw)
}

/// Map the raw mix onto the reported 0..1 scale.
///
/// **This changes no ordering.** It is monotonic — a strictly presentational curve, the
/// scale on the thermometer rather than the temperature. Two things make it necessary,
/// both measured with `sanity-scan`'s histogram on tally, slooth and krapow:
///
/// 1. Averaging four partly-correlated signals is a central-limit machine. The mix has a
///    theoretical range of 0..1 but on real code occupies roughly 0.15..0.95 in a tidy
///    bell centered near 0.60 — so untreated, a repo comes out uniformly lukewarm.
/// 2. A bell is the wrong *shape*, not just the wrong range. The product's whole claim
///    is that a small fraction of a codebase is where the thinking lives; a symmetric
///    distribution says the opposite, and no linear rescaling of a bell is anything but
///    a bell. The exponent skews it right: most code cold, a thin hot tail.
///
/// The band and exponent are calibrated, which means they are a standing claim about
/// real code and not a constant to nudge until a screenshot looks nice. Re-check the
/// histogram against a fresh repo before touching either.
fn calibrate(raw: f32) -> f32 {
    const FLOOR: f32 = 0.30;
    const CEIL: f32 = 0.95;
    const SKEW: f32 = 2.2;
    linmap(raw, FLOOR, CEIL).powf(SKEW)
}

/// How much of the body the documentation covers, 0..1 — the OFFLINE estimate.
///
/// **Measured, not counted.** Words the doc shares with the signature are subtracted
/// from both sides first, so a comment that merely restates the function's name covers
/// nothing. That is the `// increments the counter` case, and it is the difference
/// between a doc-quality metric and a doc-*volume* metric that rewards noise.
///
/// This is the fallback, and it is lexical: it can see whether a doc talks about the
/// same things as the body, never whether it says anything TRUE about them. A reader —
/// the model with the comment stack in its prompt, or an agent that read the file —
/// grades it properly and overwrites this. The score's `source` says which you are
/// looking at.
pub fn documented(doc: Option<&str>, signature: &str, body: &str) -> f32 {
    let Some(doc) = doc else { return 0.0 };
    let from_sig: HashSet<String> = words(signature).into_iter().collect();

    // What the reader still has to account for after reading the signature.
    let uncovered: HashSet<String> =
        words(body).into_iter().filter(|w| !from_sig.contains(w)).collect();
    if uncovered.is_empty() {
        return 1.0;
    }
    // What the doc contributes beyond echoing the signature.
    let doc_words: HashSet<String> =
        words(doc).into_iter().filter(|w| !from_sig.contains(w)).collect();
    if doc_words.is_empty() {
        return 0.0;
    }

    let covered = uncovered.iter().filter(|w| doc_words.contains(*w)).count() as f32;
    let coverage = covered / uncovered.len() as f32;

    // A doc need not name every identifier to explain a function — prose that gives the
    // *reason* ("upstream returns 200 with an error body") covers far more than the
    // handful of words it shares. Full credit at 40% vocabulary overlap, which in
    // practice is a genuinely explanatory comment.
    linmap(coverage, 0.0, 0.40)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn words_split_identifiers_and_drop_noise() {
        assert_eq!(words("parseHTTPHeader"), vec!["parse", "httpheader"]);
        assert_eq!(words("retry_with_backoff"), vec!["retry", "with", "backoff"]);
        // Keywords and one/two-letter names carry no meaning about behavior.
        assert!(words("let x = self.a").is_empty());
    }

    #[test]
    fn a_comment_that_restates_the_signature_documents_nothing() {
        // The load-bearing test for the whole cooling mechanic. If this regresses, the
        // map can be turned green with noise.
        let sig = "fn increment_counter(&mut self)";
        let body = "self.counter += 1; self.persist_to_disk(); self.notify_watchers();";
        let echo = documented(Some("Increments the counter."), sig, body);
        let real = documented(
            Some("Bumps the count, persists it to disk and notifies watchers."),
            sig,
            body,
        );
        assert_eq!(echo, 0.0, "a restatement must not cool the wedge");
        assert!(real > 0.5, "an explanatory doc must, got {real}");
    }

    #[test]
    fn no_doc_is_no_explanation() {
        assert_eq!(documented(None, "fn a()", "body words here"), 0.0);
    }

    #[test]
    fn twelve_copies_of_a_handler_are_not_distinctive() {
        // The finding the product exists to surface.
        let a = fingerprint("fn get_user(id) { let row = db.query(USERS, id); Ok(row.into()) }");
        let b = fingerprint("fn get_order(id) { let row = db.query(ORDERS, id); Ok(row.into()) }");
        let novel = fingerprint(
            "let mut delay = base; while attempts < max { match send() { Ok(r) => return Ok(r), \
             Err(e) if e.retryable() => { sleep(delay); delay *= 2; attempts += 1 } Err(e) => return Err(e) } }",
        );
        let template = distinctiveness(&a, &[&b]);
        let unusual = distinctiveness(&novel, &[&a, &b]);
        assert!(template < unusual, "template {template} should be below novel {unusual}");
        assert!(template < 0.5, "near-duplicate scored {template}");
    }

    #[test]
    fn a_lone_function_is_undecided_not_unique() {
        // Claiming 1.0 here would set fire to every single-function file in the repo.
        assert_eq!(distinctiveness(&fingerprint("whatever it says"), &[]), UNDECIDED);
    }

    #[test]
    fn short_bodies_decline_to_report_compressibility() {
        // Deflate's fixed overhead would otherwise call every tiny function novel.
        assert_eq!(incompressibility("a + b"), UNDECIDED);
    }

    #[test]
    fn non_ascii_source_does_not_split_a_codepoint() {
        // Every comment in this repo's sibling projects is full of em dashes; getting
        // this wrong panics inside a rayon worker on the first real scan.
        assert_eq!(lex("a — b·c"), vec!["a", "—", "b", "·", "c"]);
        assert_eq!(lex("héllo_wörld()"), vec!["héllo_wörld", "(", ")"]);
        let _ = fingerprint("// arrows → and dashes — everywhere\nlet x = 1;");
    }

    #[test]
    fn lex_separates_punctuation_from_identifiers() {
        // The property the sibling comparison depends on: one changed word must not
        // change the tokens around it.
        assert_eq!(
            lex("db.query(USERS, id)"),
            vec!["db", ".", "query", "(", "USERS", ",", "id", ")"]
        );
    }

    #[test]
    fn a_tiny_function_cannot_be_the_hottest_thing_in_the_repo() {
        // The regression that the first real scan exposed: `fn main() { app::run() }`
        // ranked as tally's most surprising code, because every term in the mix is
        // strongest on the least evidence.
        // Distinctiveness is taken from the real function rather than passed in, because
        // abstaining on too-few-shingles is half of what makes the tiny case cold.
        let tiny_body = "{\n    sanity_lib::run()\n}";
        let long_body: String = (1..=40)
            .map(|i| format!("    if cond{i} {{ self.step{i}(&ledger, clock)?; }}\n"))
            .collect();
        let other = fingerprint("fn other() { println!(\"unrelated\"); }");
        let tiny =
            surprise("fn main()", tiny_body, distinctiveness(&fingerprint(tiny_body), &[&other]));
        let long = surprise(
            "fn reconcile(&mut self)",
            &long_body,
            distinctiveness(&fingerprint(&long_body), &[&other]),
        );
        assert!(tiny < 0.5, "a three-line main scored {tiny}");
        assert!(long > tiny, "long {long} should outrank tiny {tiny}");
    }

    #[test]
    fn every_term_declines_to_measure_when_it_runs_out_of_evidence() {
        // The property that keeps the score from becoming a length metric in either
        // direction. All four must abstain on the same tiny input.
        assert_eq!(incompressibility("a + b"), UNDECIDED);
        assert_eq!(branch_density("if x { y }"), UNDECIDED);
        assert_eq!(vocabulary_novelty("fn f()", "a + b"), UNDECIDED);
        assert_eq!(distinctiveness(&fingerprint("a + b"), &[&fingerprint("c + d")]), UNDECIDED);
    }

    #[test]
    fn surprise_stays_in_range() {
        for body in ["", "x", &"a b c ".repeat(500)] {
            let s = surprise("fn f()", body, 0.5);
            assert!((0.0..=1.0).contains(&s), "{s} out of range for {body:?}");
        }
    }
}
