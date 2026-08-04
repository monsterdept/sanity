//! Where the surprise number comes from.
//!
//! The definition the whole product rests on: **boilerplate is code a model can predict
//! from its context.** Feed a function its name, signature and neighbours; measure how
//! surprised the model is by the body. Low surprise is scaffolding. High surprise is
//! where the thinking is.
//!
//! Two implementations sit behind one trait so the rest of the app never learns which
//! one ran:
//!
//! * [`HeuristicModel`] — no model, no setup, no network. The default (see
//!   `heuristic.rs` for why the proxy is honest about being a proxy).
//! * [`OllamaModel`] — a local model, via whatever is already running on 11434.
//!
//! **How the model path actually measures it.** Textbook perplexity wants token-level
//! logprobs over *the real body*, and no Ollama endpoint will score supplied text — it
//! only reports logprobs for tokens it generated. So the measurement is two numbers from
//! a single completion of the signature:
//!
//! 1. **Distance** — how far the model's predicted body lands from the real one, by
//!    shingle overlap.
//! 2. **Confidence** — 1 − the mean entropy of the model's own next-token distributions.
//!
//! Distance alone was the first design and it fails: a model essentially never reproduces
//! real code token for token, so nearly everything saturates at maximum distance. On
//! krapow that put a cobra command definition and a *test function* at the same 100° as
//! the genuinely subtle code. Confidence is what makes the score graded — see
//! [`mean_entropy`] — and the two combine so that a model which was sure and wrong reads
//! as surprising, while a model that was hedging defers to the offline proxy.
//!
//! # Status: measured, and it works
//!
//! Four earlier designs failed, all measured against the offline proxy on krapow, and
//! the ranking overlap with a plain `wc -l` sort is the yardstick (`sanity-scan` prints
//! it; lower is better, the proxy scores 9/15):
//!
//! | variant | hot lines | vs `wc -l` | verdict |
//! |---|---|---|---|
//! | generate a rival body, diff it | 66% | — | saturated: 20 functions pinned at 100° |
//! | + weight by the model's confidence | 64% | — | ranking unchanged |
//! | + imports and siblings in the prompt | 64% | — | a test function still at 86° |
//! | the model's entropy alone | 20% | — | graded well, ranked the wrong functions |
//! | **forced decoding (this)** | **32%** | **6/15** | **finds what size alone does not** |
//!
//! The failures all shared a cause: comparing a *generated* body to the real one has a
//! noise floor above the signal, because a model never reproduces real code token for
//! token whether or not that code was predictable. Forcing the decode onto the real
//! tokens removes the comparison entirely and asks the question directly.
//!
//! Evidence beyond the overlap number: the cobra command definitions that sat at 96-98°
//! through every earlier attempt drop off the ranking completely, and heat decouples
//! from length — a 24-line function scores 93° above a 107-line one at 50°. That
//! independence is the premise of the whole product and this is the first build in which
//! it is observably true.

use std::time::Duration;

pub struct Item<'a> {
    pub name: &'a str,
    pub signature: &'a str,
    pub body: &'a str,
    /// The names of the function's peers in the same file. Part of the context a reader
    /// genuinely has, so the model gets it too — otherwise it is being asked a harder
    /// question than the human, and everything scores as surprising.
    pub peers: &'a [String],
    /// Lines in the body. The model path uses it as a cost gate — see
    /// [`OllamaModel::min_lines`].
    pub lines: usize,
    /// The documentation a reader has before they read the body: this chunk's own
    /// comment, and the file's if it has one.
    ///
    /// In the prompt for the same reason `context` is — the metric asks whether a
    /// READER could predict this code, and a reader has the comments. Withholding them
    /// asks a harder question than the product claims to ask, and inflates surprise
    /// uniformly across everything that happens to be documented.
    ///
    /// It also fixes the direction of a real error. Documentation used to enter as a
    /// separate lexical `explained` term that could only reward vocabulary overlap, so a
    /// confidently WRONG comment sharing words with the body cooled the wedge. Through
    /// the prompt it does the opposite: the model predicts what the comment describes,
    /// the body doesn't match, and surprise rises. Stale docs read hot, which is what
    /// makes the map self-invalidating instead of merely drainable.
    pub doc: Option<&'a str>,
    /// The top of the file (imports, types) plus a couple of complete sibling functions.
    ///
    /// Without this the model is being asked a far harder question than the metric
    /// intends. "Predict this body from its name alone" is not what a reader does — a
    /// reader has the imports and the house style in front of them, and can guess a
    /// command handler or a table-driven test almost exactly. Starved of that, the model
    /// misses on everything and reports uniform high surprise: on krapow it put a cobra
    /// command definition and a test function within three degrees of the genuinely
    /// subtle code, which is the whole failure this field exists to fix.
    pub context: &'a str,
}

pub trait SurpriseModel: Send + Sync {
    /// Shown in the UI next to the score. Users must always be able to see which
    /// instrument produced the picture they're looking at.
    fn label(&self) -> String;

    /// 0..1. `proxy` is the precomputed heuristic value: a model-backed implementation
    /// falls back to it rather than to a guess whenever a call fails, so one flaky
    /// request degrades a single wedge instead of blanking the ring.
    fn surprise(&self, item: &Item, proxy: f32) -> Reading;

    /// Body lines below which this scorer returns the proxy without doing real work.
    ///
    /// Exposed so two things can be honest: progress can count only the functions that
    /// will actually be visited, and the map can leave the rest uncoloured instead of
    /// painting them with a proxy score the user didn't ask for.
    fn min_lines(&self) -> usize {
        0
    }

    /// Whether this scorer is a real model, as opposed to the offline stand-in.
    ///
    /// The map colours only what a model actually looked at. The proxy is measurably
    /// close to sorting by line count (`just scan` prints the baseline), so painting
    /// heat with it is a claim the numbers do not support — those wedges render neutral
    /// instead, and the colour arrives when the model does.
    fn is_model(&self) -> bool {
        false
    }
}

/// The default. Simply passes the precomputed proxy through — the measurement already
/// happened in `heuristic.rs`, where it can be done once per function alongside the
/// sibling comparison it depends on.
pub struct HeuristicModel;

impl SurpriseModel for HeuristicModel {
    fn label(&self) -> String {
        "heuristic (no model)".into()
    }
    fn surprise(&self, _item: &Item, proxy: f32) -> Reading {
        Reading::plain(proxy)
    }
}


pub struct OllamaModel {
    endpoint: String,
    model: String,
    /// Functions shorter than this skip the model and keep their proxy score.
    ///
    /// **Zero in the app.** This exists for `sanity-scan --min-lines`, where trading
    /// coverage for a fast experiment is the point. Shipping it as a user-facing dial
    /// was a mistake: filtering on length decides what gets measured, which is the exact
    /// failure the baseline check was built to detect. Cost is bounded by ordering the
    /// queue and stopping it instead.
    min_lines: usize,
    client: reqwest::blocking::Client,
}

impl OllamaModel {
    pub fn new(endpoint: impl Into<String>, model: impl Into<String>, min_lines: usize) -> Self {
        OllamaModel {
            endpoint: endpoint.into(),
            model: model.into(),
            min_lines,
            // A local model on a cold cache can take a while for the first token, but a
            // scan makes thousands of these calls and one wedged request must not hold
            // the whole ring hostage.
            client: reqwest::blocking::Client::builder()
                .timeout(Duration::from_secs(60))
                .build()
                .unwrap_or_default(),
        }
    }

    /// True when something is actually listening. Checked before a scan so the UI can
    /// say "falling back to the proxy" up front instead of after ten silent minutes.
    ///
    /// The timeout is generous on purpose. It was two seconds, which is ample for
    /// 127.0.0.1 and too tight for a box across the network — and the failure is nasty
    /// rather than noisy: the probe trips, the whole scan quietly downgrades to the
    /// offline proxy, and the only clue is a label most people won't reread. A scan
    /// takes minutes; spending ten seconds making sure it runs with the instrument the
    /// user asked for is free.
    pub fn available(&self) -> bool {
        self.client
            .get(format!("{}/api/tags", self.endpoint))
            .timeout(Duration::from_secs(10))
            .send()
            .is_ok_and(|r| r.status().is_success())
    }

    /// Model names available at this endpoint, newest first.
    ///
    /// The app asks before offering a picker: a free-text model field invites typos that
    /// surface as "nothing answered, using the proxy" ten minutes into a scan.
    pub fn models(endpoint: &str) -> Vec<String> {
        #[derive(serde::Deserialize)]
        struct Tags {
            models: Vec<Tag>,
        }
        #[derive(serde::Deserialize)]
        struct Tag {
            name: String,
        }
        reqwest::blocking::Client::builder()
            .timeout(Duration::from_secs(10))
            .build()
            .ok()
            .and_then(|c| c.get(format!("{endpoint}/api/tags")).send().ok())
            .filter(|r| r.status().is_success())
            .and_then(|r| r.json::<Tags>().ok())
            .map(|t| t.models.into_iter().map(|m| m.name).collect())
            .unwrap_or_default()
    }

    fn prompt(&self, item: &Item) -> String {
        format!(
            "You are completing a source file. Write the most likely body for the \
             final function, matching the conventions visible in the file. Output ONLY \
             code, no explanation, no fences.\n\n\
             --- file context ---\n{context}\n\
             --- other functions here: {peers} ---\n\n\
             {doc}{sig}\n",
            context = item.context,
            // Immediately above the signature, which is where it sits in the file — the
            // model is completing a source file, so the comment has to arrive the way a
            // comment arrives.
            doc = match item.doc {
                Some(d) if !d.trim().is_empty() => format!("{}\n", d.trim()),
                _ => String::new(),
            },
            peers = if item.peers.is_empty() {
                "(none)".to_string()
            } else {
                item.peers.join(", ")
            },
            sig = item.signature,
        )
    }
}


#[derive(serde::Deserialize)]
struct GenerateResponse {
    /// Unread on purpose. Under forced decoding this is just the body we supplied,
    /// echoed back through the grammar — the measurement lives entirely in `logprobs`.
    /// Kept so a mismatch is visible when debugging a grammar that didn't bind.
    #[allow(dead_code)]
    response: String,
    #[serde(default)]
    logprobs: Vec<TokenLogprobs>,
}

#[derive(serde::Deserialize)]
struct TokenLogprobs {
    #[serde(default)]
    token: String,
    #[serde(default)]
    top_logprobs: Vec<Alternative>,
}

#[derive(serde::Deserialize)]
struct Alternative {
    #[serde(default)]
    token: String,
    logprob: f64,
}

/// Alternatives requested per position. Enough to say what the model expected instead
/// without bloating every response — the top couple are what a reader can use.
const TOP_LOGPROBS: u32 = 5;

/// A place in the body the model did not see coming, and what it expected instead.
///
/// This is the contrastive summary, and it costs nothing extra: forced decoding already
/// walks the real tokens and reports a probability for each, so the positions where that
/// probability collapsed are exactly the surprising ones. Averaging them into a single
/// score and discarding the rest threw away the only part a reader can act on.
///
/// It is *evidence*, not prose. A generated explanation of why code is surprising can be
/// confidently wrong; "the model expected `Ok` here and found `retry`" is a measurement.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct Hotspot {
    /// The actual token(s), with a little of the surrounding body for context.
    pub text: String,
    /// What the model would have written instead, most likely first.
    pub expected: Vec<String>,
    /// Surprisal in bits — how badly the expectation missed.
    pub bits: f32,
}

/// What a scorer returns: the number, and the evidence behind it.
#[derive(Debug, Clone, Default)]
pub struct Reading {
    pub surprise: f32,
    pub hotspots: Vec<Hotspot>,
}

impl Reading {
    pub fn plain(surprise: f32) -> Reading {
        Reading {
            surprise,
            hotspots: Vec::new(),
        }
    }
}

/// Surprisal in bits for one token, from its own logprob.
fn bits_of(t: &TokenLogprobs) -> Option<f32> {
    let chosen = t.top_logprobs.first()?;
    Some((-chosen.logprob / std::f64::consts::LN_2) as f32)
}

/// The handful of places worth showing a reader.
///
/// Ranked by surprisal and capped, because a list of forty mildly-unexpected tokens is
/// not a finding — the point is to answer "what about this code is unusual?" in a couple
/// of lines, not to annotate every token.
fn hotspots(tokens: &[TokenLogprobs]) -> Vec<Hotspot> {
    const MAX: usize = 4;
    /// Below this the model was only mildly unsure, which is normal everywhere and would
    /// bury the real surprises.
    const MIN_BITS: f32 = 4.0;

    let mut spots: Vec<(usize, f32)> = tokens
        .iter()
        .enumerate()
        .filter_map(|(i, t)| bits_of(t).map(|b| (i, b)))
        .filter(|(_, b)| *b >= MIN_BITS)
        .collect();
    spots.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));

    let mut out = Vec::new();
    let mut used: Vec<usize> = Vec::new();
    for (i, bits) in spots {
        // Skip anything adjacent to a hotspot already taken: consecutive tokens of one
        // surprising expression are one finding, not four.
        if used.iter().any(|u| i.abs_diff(*u) < 6) {
            continue;
        }
        used.push(i);
        // A few tokens either side, so the reader sees where in the body this happened.
        let lo = i.saturating_sub(4);
        let hi = (i + 5).min(tokens.len());
        let text: String = tokens[lo..hi].iter().map(|t| t.token.as_str()).collect();
        let expected: Vec<String> = tokens[i]
            .top_logprobs
            .iter()
            .skip(1)
            .take(2)
            .map(|a| a.token.clone())
            .filter(|t| !t.trim().is_empty())
            .collect();
        out.push(Hotspot {
            text: text.trim().to_string(),
            expected,
            bits,
        });
        if out.len() >= MAX {
            break;
        }
    }
    out
}


impl SurpriseModel for OllamaModel {
    fn label(&self) -> String {
        format!("ollama · {}", self.model)
    }

    fn min_lines(&self) -> usize {
        self.min_lines
    }

    fn is_model(&self) -> bool {
        true
    }

    fn surprise(&self, item: &Item, proxy: f32) -> Reading {
        // The cost gate, checked before anything is sent.
        if item.lines < self.min_lines {
            return Reading::plain(proxy);
        }

        // Forced decoding. `format` takes a JSON schema, which Ollama compiles to a GBNF
        // grammar — and a schema of `{"type":"string","const": <the body>}` admits
        // exactly one string. So the model cannot wander: it is walked down the real
        // body's token path, and the logprobs that come back are the probabilities IT
        // assigned to the code the human actually wrote.
        //
        // That is the measurement this whole project is named after, and every earlier
        // attempt was a substitute for it: generate a rival body and diff it (a noise
        // floor above the signal), or measure the model's confidence in its own
        // invention (grades well, ranks the wrong functions). Ollama will not score
        // supplied text through any endpoint — checked on both /api/generate and
        // /v1/completions — but constraining generation to the supplied text is the
        // same arithmetic reached from the other side.
        let body = truncate_chars(item.body, MAX_SCORED_CHARS);
        let req = serde_json::json!({
            "model": self.model,
            "prompt": self.prompt(item),
            "stream": false,
            "logprobs": true,
            "top_logprobs": TOP_LOGPROBS,
            "format": { "type": "string", "const": body },
            // Deterministic, and generous enough to reach the end of the forced path —
            // a truncated path scores only the opening of the body.
            "options": { "temperature": 0, "num_predict": MAX_FORCED_TOKENS },
        });

        let reply = self
            .client
            .post(format!("{}/api/generate", self.endpoint))
            .json(&req)
            .send()
            .ok()
            .filter(|r| r.status().is_success())
            .and_then(|r| r.json::<GenerateResponse>().ok());

        // Any failure — model absent, timeout, grammar rejected — degrades this one
        // wedge to the proxy rather than inventing a number.
        let Some(reply) = reply else {
            return Reading::plain(proxy);
        };
        match mean_surprisal(&reply.logprobs) {
            Some(bits) => Reading {
                surprise: calibrate_surprisal(bits),
                hotspots: hotspots(&reply.logprobs),
            },
            None => Reading::plain(proxy),
        }
    }
}

/// Bodies longer than this are scored on their opening only.
///
/// Forced decoding costs one decode step per token of the body, so an 800-line function
/// would dominate a whole scan on its own. The opening of a function is also where its
/// character is decided — if the first eighty lines were predictable, the rest usually is.
const MAX_SCORED_CHARS: usize = 3_000;

/// Ceiling on the forced path. Must comfortably exceed the token count of
/// `MAX_SCORED_CHARS` of code, or the grammar is cut off mid-string.
const MAX_FORCED_TOKENS: u32 = 1_536;

/// JSON structural tokens at the edges of the forced string — the opening quote and its
/// partner. They are an artefact of `format` being a JSON schema, they carry no
/// information about the code, and the opening quote in particular scores terribly
/// (−10 logprob in testing) purely because the model did not expect to be emitting JSON.
const EDGE_TOKENS: usize = 1;

fn truncate_chars(s: &str, n: usize) -> String {
    if s.chars().count() <= n {
        return s.to_string();
    }
    s.chars().take(n).collect()
}

/// Turn measured surprises into a sentence a person can read.
///
/// The hotspots are evidence and cannot be wrong, but "expected `Ok`, found `retry`" is
/// not comprehension — it tells you a measurement happened. This asks the model to say
/// what the divergence *means*, and it is a fundamentally safer request than "summarise
/// this function" because it is grounded: the model is explaining specific positions
/// where its own prediction demonstrably failed, not inventing a narrative from scratch.
///
/// Run on demand for the one function a user clicked, never during a scan. A sentence
/// for all 2,450 functions would triple an already slow pass to produce prose nobody
/// reads; one costs a second, at the moment somebody actually wants it.
pub fn explain(
    endpoint: &str,
    model: &str,
    signature: &str,
    body: &str,
    hotspots: &[Hotspot],
) -> Option<String> {
    if hotspots.is_empty() {
        return None;
    }
    let evidence = hotspots
        .iter()
        .map(|h| {
            if h.expected.is_empty() {
                format!("- at `{}` (unexpected)", h.text.trim())
            } else {
                format!(
                    "- at `{}` — a model predicting this code expected `{}` here",
                    h.text.trim(),
                    h.expected.join("` or `")
                )
            }
        })
        .collect::<Vec<_>>()
        .join("\n");

    let prompt = format!(
        "A language model tried to predict this function's body from its signature and \
         was wrong in specific places.\n\n\
         Signature:\n{signature}\n\n\
         Body:\n{body}\n\n\
         Where the prediction failed:\n{evidence}\n\n\
         Write exactly two short lines, no preamble, no markdown:\n\
         Expected: <what a reader would assume from the name and signature alone>\n\
         Actual: <what it really does that differs, referring to the surprises above>\n",
        body = truncate_chars(body, MAX_SCORED_CHARS),
    );

    let client = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(90))
        .build()
        .ok()?;
    let reply: GenerateResponse = client
        .post(format!("{endpoint}/api/generate"))
        .json(&serde_json::json!({
            "model": model,
            "prompt": prompt,
            "stream": false,
            "options": { "temperature": 0, "num_predict": 160 },
        }))
        .send()
        .ok()
        .filter(|r| r.status().is_success())?
        .json()
        .ok()?;
    let text = reply.response.trim().to_string();
    (!text.is_empty()).then_some(text)
}

/// Mean surprisal of the real body's tokens, in bits per token.
///
/// This is the honest definition: −log₂ P(token | everything before it), averaged. Low
/// means the model saw this code coming. High means it did not.
fn mean_surprisal(tokens: &[TokenLogprobs]) -> Option<f32> {
    if tokens.len() <= EDGE_TOKENS * 2 {
        return None;
    }
    let inner = &tokens[EDGE_TOKENS..tokens.len() - EDGE_TOKENS];
    let mut total = 0.0f64;
    let mut n = 0usize;
    for t in inner {
        let Some(chosen) = t.top_logprobs.first() else {
            continue;
        };
        // nats → bits, so the number reads as "bits of information per token", which is
        // the unit this quantity is normally quoted in.
        total += -chosen.logprob / std::f64::consts::LN_2;
        n += 1;
    }
    (n > 0).then(|| (total / n as f64) as f32)
}

/// Bits per token → the 0..1 surprise scale.
///
/// Unlike the heuristic's calibration this is not spreading a bell — surprisal is already
/// a meaningful, unbounded quantity, and all this does is choose where the interesting
/// band sits. Highly predictable code runs well under a bit per token; code the model
/// genuinely did not expect runs several bits. Measured on krapow with devstral.
pub(crate) fn calibrate_surprisal(bits: f32) -> f32 {
    const PREDICTABLE: f32 = 0.5;
    const UNEXPECTED: f32 = 4.0;
    ((bits - PREDICTABLE) / (UNEXPECTED - PREDICTABLE)).clamp(0.0, 1.0)
}



#[cfg(test)]
mod tests {
    use super::*;

    fn tok(logprob: f64) -> TokenLogprobs {
        TokenLogprobs {
            token: "t".into(),
            top_logprobs: vec![Alternative {
                token: "t".into(),
                logprob,
            }],
        }
    }

    fn tok_named(name: &str, logprob: f64, alts: &[(&str, f64)]) -> TokenLogprobs {
        let mut top = vec![Alternative {
            token: name.into(),
            logprob,
        }];
        top.extend(alts.iter().map(|(t, l)| Alternative {
            token: (*t).into(),
            logprob: *l,
        }));
        TokenLogprobs {
            token: name.into(),
            top_logprobs: top,
        }
    }

    #[test]
    fn hotspots_are_the_surprises_with_what_was_expected_instead() {
        // The whole point of keeping per-token data: a reader can act on "expected Ok,
        // found retry" in a way they cannot act on "this function scores 71".
        let mut toks: Vec<TokenLogprobs> = (0..12).map(|_| tok_named("x", -0.05, &[])).collect();
        toks[6] = tok_named("retry", -9.0, &[("Ok", -0.2), ("None", -1.0)]);
        let spots = hotspots(&toks);
        assert_eq!(spots.len(), 1, "one surprise, not one per token: {spots:?}");
        assert!(spots[0].text.contains("retry"));
        assert_eq!(spots[0].expected, vec!["Ok", "None"]);
        assert!(spots[0].bits > 10.0);
    }

    #[test]
    fn predictable_code_yields_no_hotspots() {
        // A function the model saw coming has nothing to report, and inventing something
        // to say about it would be exactly the fabrication this design avoids.
        let toks: Vec<TokenLogprobs> = (0..20).map(|_| tok_named("x", -0.02, &[])).collect();
        assert!(hotspots(&toks).is_empty());
    }

    #[test]
    fn adjacent_surprising_tokens_collapse_into_one_finding() {
        // One surprising expression spans several tokens; reporting each separately
        // would fill the panel with four views of the same thing.
        let mut toks: Vec<TokenLogprobs> = (0..20).map(|_| tok_named("x", -0.05, &[])).collect();
        for (i, t) in toks.iter_mut().enumerate().skip(8).take(4) {
            *t = tok_named("odd", -9.0 - i as f64 * 0.1, &[]);
        }
        assert_eq!(hotspots(&toks).len(), 1);
    }

    #[test]
    fn surprisal_is_bits_per_token_and_skips_the_json_edges() {
        // ln(0.5) = -0.693 nats = exactly 1 bit. The two edge tokens are the JSON quotes
        // the schema forces; scoring them would tax every function by a constant that
        // has nothing to do with its code.
        let ln_half = -std::f64::consts::LN_2;
        let toks = vec![tok(-99.0), tok(ln_half), tok(ln_half), tok(-99.0)];
        let bits = mean_surprisal(&toks).unwrap();
        assert!((bits - 1.0).abs() < 1e-4, "got {bits} bits");
    }

    #[test]
    fn a_body_too_short_to_have_an_interior_declines_to_score() {
        assert!(mean_surprisal(&[]).is_none());
        assert!(mean_surprisal(&[tok(-1.0), tok(-1.0)]).is_none());
    }

    #[test]
    fn predictable_code_is_cold_and_unexpected_code_is_hot() {
        assert_eq!(calibrate_surprisal(0.2), 0.0);
        assert_eq!(calibrate_surprisal(9.0), 1.0);
        assert!(calibrate_surprisal(1.0) < calibrate_surprisal(3.0));
    }

    #[test]
    fn a_long_body_is_truncated_on_a_character_boundary() {
        // Byte slicing would panic on any repo with non-ASCII identifiers or strings.
        assert_eq!(truncate_chars("héllo wörld", 5).chars().count(), 5);
        assert_eq!(truncate_chars("short", 100), "short");
    }



    #[test]
    fn the_heuristic_model_passes_the_proxy_through_untouched() {
        let item = Item {
            name: "f",
            signature: "fn f()",
            body: "{}",
            peers: &[],
            doc: None,
            lines: 1,
            context: "",
        };
        assert_eq!(HeuristicModel.surprise(&item, 0.73).surprise, 0.73);
    }

    #[test]
    fn an_unreachable_ollama_falls_back_to_the_proxy() {
        // Port 1 is never a model server. The contract is that one failed call costs a
        // wedge its precision, not its score.
        let m = OllamaModel::new("http://127.0.0.1:1", "nonexistent", 0);
        assert!(!m.available());
        let item = Item {
            name: "f",
            signature: "fn f()",
            body: "whatever",
            peers: &[],
            doc: None,
            lines: 99,
            context: "",
        };
        let r = m.surprise(&item, 0.42);
        assert_eq!(r.surprise, 0.42);
        assert!(r.hotspots.is_empty(), "a failed call must not invent evidence");
    }
}
