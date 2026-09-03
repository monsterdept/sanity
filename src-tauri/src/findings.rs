//! Findings — where two lenses disagree in a way somebody should look at.
//!
//! **Read `docs/notes/findings.md` before changing anything here.** The design, the arguments
//! and the measurements behind the default catalog are there; this file is the evaluator
//! those arguments describe, and the numbers in the note came out of running it.
//!
//! The map is a good instrument for a single-lens extreme — a wedge at the top of a ramp is
//! visibly at the top of it.
//! What no reader can do is hold two lenses at once, because the map wears one at a time
//! and [`crate::model::Score`] deliberately keeps its terms apart. So the readings no
//! amount of looking will produce are the CONJUNCTIONS, and that is all a rule is: a
//! population, and up to two clauses over the fields a lens is painted from.
//!
//! Three rules govern everything below, and each one is a failure this instrument has had
//! somewhere else:
//!
//! - **A clause that cannot be answered never matches.** [`value_of`] returns `Option`, and
//!   `None` fails the clause rather than defaulting. A repo with no history must not have
//!   every function read as brand new, and an unread function must not be reported as
//!   unsurprising — that is the `UNDECIDED` discipline, one surface over.
//! - **A threshold is a number, never a percentile.** [`calibrate`] suggests one from the
//!   repo's own distribution and hands back a number that gets SAVED; a percentile rule
//!   cannot be satisfied, so a list built on one never drains.
//! - **Hit count is not what a rule is worth.** [`marginal`] is, and it is the number the
//!   catalog is titrated against.

use crate::agentapi::Report;
use crate::model::{Node, NodeKind};
use std::collections::{HashMap, HashSet};

/// What a rule is about. Directories are deliberately absent — the rim already draws a
/// directory's distribution, and every directory rule anyone proposes is a sentence it
/// draws better. See the note; the trigger for revisiting it is a clause about SPREAD,
/// which is not this grammar.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Pop {
    Func,
    File,
}

/// The quantities a clause can ask about.
///
/// One variant per thing a lens is painted from, named the way the lens is named rather
/// than the way the struct field is, because the rule text is read by people.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Field {
    /// Lines. The width of the wedge.
    Loc,
    /// How many functions a file holds.
    Funcs,
    /// Callers — how many things call this.
    Callers,
    /// Reach — how much this calls out to.
    Calls,
    /// How many bodies are in this one's clone group.
    CloneSize,
    /// The raw cognitive count: every fork costing one, plus one per fork it nests inside.
    Cognitive,
    /// Complexity for its SIZE, on the 0..1 ramp the lens paints — `tangle[0]`.
    Tangle,
    /// Days since the code first appeared.
    AgeDays,
    /// Days since anyone touched it.
    TouchedDays,
    /// Commits that CHANGED this inside the churn window. Zero everywhere until the
    /// timeline has been walked, which is why [`value_of`] gates it on `churned`: a repo
    /// nobody has traced would otherwise read as one nothing ever changes in.
    Commits,
    /// 1 when an agent has read this and the reading still stands, 0 otherwise.
    ///
    /// Answerable for every function, which is why it is the one tier 2 field that is never
    /// `None`: "nobody has read this" is a fact about the repo, not an absence of evidence.
    Read,
    /// The reader's surprise. `None` where nobody has read it — a proxy score is not a
    /// reading, and a rule must never be answered with one.
    Surprise,
    /// The reader's grade of the documentation, on the same terms.
    Documented,
    /// What reading it was actually like, on the same terms.
    Legible,
    /// 1 where the reader marked something that will bite whoever edits this next.
    ///
    /// A MARK rather than a grade — a body either carries one or it does not — which is why
    /// it is a 0/1 here and a flash rather than a ramp on the map.
    Trap,
}

impl Field {
    pub fn parse(s: &str) -> Option<Field> {
        Some(match s {
            "loc" | "lines" => Field::Loc,
            "funcs" => Field::Funcs,
            "callers" => Field::Callers,
            "calls" | "reach" => Field::Calls,
            "clone_size" | "clones" => Field::CloneSize,
            "cognitive" => Field::Cognitive,
            "tangle" | "complexity" => Field::Tangle,
            "age" | "age_days" => Field::AgeDays,
            "touched" | "touched_days" => Field::TouchedDays,
            "commits" | "churn" => Field::Commits,
            "read" => Field::Read,
            "surprise" => Field::Surprise,
            "documented" | "docs" => Field::Documented,
            "legible" => Field::Legible,
            "trap" | "traps" => Field::Trap,
            _ => return None,
        })
    }

    pub fn name(self) -> &'static str {
        match self {
            Field::Loc => "loc",
            Field::Funcs => "funcs",
            Field::Callers => "callers",
            Field::Calls => "calls",
            Field::CloneSize => "clone_size",
            Field::Cognitive => "cognitive",
            Field::Tangle => "tangle",
            Field::AgeDays => "age",
            Field::TouchedDays => "touched",
            Field::Commits => "commits",
            Field::Read => "read",
            Field::Surprise => "surprise",
            Field::Documented => "documented",
            Field::Legible => "legible",
            Field::Trap => "trap",
        }
    }

    /// Which LENS this field is painted by, in the window's own vocabulary — the ids in
    /// `colorMode.ts`, so a swatch beside a finding is the colour of the wedge it is about.
    ///
    /// `size` is not a lens and is named anyway: width is how the map draws lines, so a rule
    /// gated on `loc` is still saying something the picture shows, and a tile whose every
    /// clause came back `None` would wear no colour at all. `read` is genuinely nothing —
    /// an absence of readings is what the gray already means, and the rule's other clause is
    /// what has a colour worth showing.
    pub fn lens(self) -> Option<&'static str> {
        Some(match self {
            Field::Loc | Field::Funcs => "size",
            Field::Callers => "callers",
            Field::Calls => "reach",
            Field::CloneSize => "clones",
            Field::Cognitive | Field::Tangle => "tangle",
            Field::AgeDays | Field::TouchedDays => "age",
            Field::Commits => "churn",
            Field::Surprise => "surprise",
            Field::Documented => "docs",
            Field::Legible => "legible",
            Field::Trap => "traps",
            Field::Read => return None,
        })
    }

    /// Whether this field needs a reading before it can answer.
    ///
    /// The tier the note describes, in one predicate: a tier 2 rule is one with any such
    /// field in it, and a tier 2 rule stays dark until readings land rather than reporting
    /// a clean bill over code nobody has read.
    pub fn needs_reading(self) -> bool {
        matches!(self, Field::Surprise | Field::Documented | Field::Legible | Field::Trap)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Op {
    Ge,
    Gt,
    Le,
    Lt,
}

impl Op {
    fn parse(s: &str) -> Option<Op> {
        Some(match s {
            ">=" => Op::Ge,
            ">" => Op::Gt,
            "<=" => Op::Le,
            "<" => Op::Lt,
            _ => return None,
        })
    }

    fn name(self) -> &'static str {
        match self {
            Op::Ge => ">=",
            Op::Gt => ">",
            Op::Le => "<=",
            Op::Lt => "<",
        }
    }

    fn holds(self, got: f32, want: f32) -> bool {
        match self {
            Op::Ge => got >= want,
            Op::Gt => got > want,
            Op::Le => got <= want,
            Op::Lt => got < want,
        }
    }
}

#[derive(Debug, Clone, Copy)]
pub struct Clause {
    pub field: Field,
    pub op: Op,
    pub value: f32,
}

/// A rule: a population, and a conjunction over it.
///
/// **Two clauses is the cap and it is not arbitrary.** Three is the first number that needs
/// precedence rules, and a grammar with precedence is a query language — the bottomless
/// thing this design exists to avoid.
#[derive(Debug, Clone)]
pub struct Rule {
    /// What durable state is filed under — a dismissal, a saved threshold.
    ///
    /// **Never the title.** A title is prose and prose gets rewritten: "Hot and busy" became
    /// "Surprising and changing" the moment heat stopped being this app's word for surprise,
    /// and keyed on the title that rename would have silently orphaned every dismissal
    /// somebody had filed under it — the finding would come back with no explanation and the
    /// archive row would point at a rule that no longer exists. Same rule as `key_of` versus
    /// a node id, one surface over, and that one cost a project its readings.
    pub id: &'static str,
    /// What it is called on screen. Free to change.
    pub title: &'static str,
    /// What to do about it, in one clause. The short form: a tag's tooltip, a CLI column, and
    /// the fallback when [`Rule::says`] cannot be filled.
    pub so_what: &'static str,
    /// What to say about ONE subject, with `{{token}}` holes for its own numbers.
    ///
    /// **A tile's paragraph is the thing somebody can act on without having read the
    /// catalog.** "Tangled for its size" is a label you have to already know; "for 340 lines
    /// this branches more than almost anything else here" is a finding. The numbers have to
    /// come from the subject or the sentence is a template pretending to be a reading — see
    /// [`render`], which refuses rather than guessing.
    pub says: &'static str,
    pub pop: Pop,
    pub clauses: Vec<Clause>,
    /// Which clause [`calibrate`] suggests a threshold for. The others are held.
    pub calibrated: usize,
    /// Lines below which this rule has nothing useful to say. `0` for no floor.
    ///
    /// **A floor, not a third clause.** It does not appear as a lens on the tile and it is not
    /// a question the rule is asking — it is the size below which its question stops meaning
    /// anything. Without one, "load-bearing and undocumented" returned eight rows of `len`,
    /// `new`, `path` and `get` at three lines apiece: perfectly true, and documenting
    /// `fn len(&self) -> usize` improves nothing. The same gap put a three-line accessor at
    /// the top of the reading queue, where it would have spent reader budget to learn that an
    /// accessor accesses something.
    ///
    /// Ten, because below about ten lines a claim about a body is mostly a claim about its
    /// signature — which is the half the caller can already see.
    pub floor: u32,
}

impl Rule {
    /// The lenses this rule combined, in clause order and without repeats.
    ///
    /// **This is the rule's whole claim in two colours**: surprise AND reach is a different
    /// sentence from surprise AND size, and the pair is what makes a finding a finding rather than
    /// a wedge somebody could already see.
    pub fn lenses(&self) -> Vec<String> {
        let mut out: Vec<String> = Vec::new();
        for c in &self.clauses {
            if let Some(l) = c.field.lens() {
                if !out.iter().any(|x| x == l) {
                    out.push(l.to_string());
                }
            }
        }
        out
    }

    /// A rule needs a reading if any clause does — see [`Field::needs_reading`].
    pub fn tier(&self) -> u8 {
        if self.clauses.iter().any(|c| c.field.needs_reading()) {
            2
        } else {
            1
        }
    }

    pub fn expr(&self) -> String {
        let pop = match self.pop {
            Pop::Func => "func",
            Pop::File => "file",
        };
        let cs: Vec<String> = self
            .clauses
            .iter()
            .map(|c| format!("{} {} {}", c.field.name(), c.op.name(), trim_num(c.value)))
            .collect();
        format!("{pop}: {}", cs.join(" and "))
    }

    /// `func: loc >= 200 and callers >= 20`
    ///
    /// Deliberately the same string the settings page will build from dropdowns. The text
    /// form is not a debug affordance — it is how the catalog gets titrated, and a default
    /// that cannot be written in it is a default nobody can tune.
    pub fn parse(src: &str) -> Result<Rule, String> {
        let (pop, rest) = src.split_once(':').ok_or("expected `func:` or `file:`")?;
        let pop = match pop.trim() {
            "func" | "function" => Pop::Func,
            "file" => Pop::File,
            other => return Err(format!("unknown population `{other}` — func or file")),
        };
        let mut clauses = Vec::new();
        for part in rest.split(" and ") {
            let t: Vec<&str> = part.split_whitespace().collect();
            let [f, o, v] = t[..] else {
                return Err(format!("expected `field op number`, got `{}`", part.trim()));
            };
            clauses.push(Clause {
                field: Field::parse(f).ok_or(format!("unknown field `{f}`"))?,
                op: Op::parse(o).ok_or(format!("unknown operator `{o}`"))?,
                value: v.parse().map_err(|_| format!("`{v}` is not a number"))?,
            });
        }
        if clauses.is_empty() || clauses.len() > 2 {
            return Err("a rule is one or two clauses".into());
        }
        Ok(Rule {
            id: "ad-hoc",
            title: "ad-hoc",
            so_what: "matched an ad-hoc rule",
            says: "",
            pop,
            clauses,
            calibrated: 0,
            // No floor on an ad-hoc rule: somebody asking a question by hand gets the answer
            // to the question they asked.
            floor: 0,
        })
    }
}

fn trim_num(v: f32) -> String {
    if v.fract() == 0.0 {
        format!("{}", v as i64)
    } else {
        format!("{v}")
    }
}

/// Fill a rule's sentence with one subject's own numbers.
///
/// **A token that cannot be answered abandons the whole sentence**, and the caller falls back
/// to `so_what`. Half a paragraph with a `?` in it, or worse a zero, is the map claiming a
/// measurement nobody took — the same rule `value_of` follows one function up. A rule can
/// only reference what its own clauses guarantee, and anything else is a bet; this is what
/// makes losing the bet harmless.
///
/// `{{name}}` and `{{path}}` come off the subject. `{{median}}` is the typical value of the
/// calibrated clause's field across this repo — what normal looks like — and `{{threshold}}`
/// is the bar itself, which is only worth quoting where a subject is well past it. Everything
/// else is a [`Field`] by its own name, plus `{{age_years}}`, the one unit nobody wants in
/// days.
pub fn render(rule: &Rule, f: &Facts, median: Option<f32>) -> Vec<Span> {
    let plain = || {
        let s = rule.so_what;
        let mut c = s.chars();
        match c.next() {
            Some(first) => {
                vec![Span {
                    text: format!("{}{}.", first.to_uppercase(), c.as_str()),
                    filled: false,
                }]
            }
            None => Vec::new(),
        }
    };
    let mut out: Vec<Span> = Vec::new();
    let mut push = |text: &str, filled: bool| {
        if !text.is_empty() {
            out.push(Span { text: text.to_string(), filled });
        }
    };
    let mut rest = rule.says;
    while let Some(at) = rest.find("{{") {
        push(&rest[..at], false);
        let Some(close) = rest[at..].find("}}") else { return plain() };
        let token = &rest[at + 2..at + close];
        rest = &rest[at + close + 2..];
        let filled = match token {
            "name" => Some(f.subject.name.clone()),
            "path" => Some(f.subject.path.clone()),
            "threshold" => rule.clauses.get(rule.calibrated).map(|c| trim_num(c.value)),
            // **The typical value, not the bar.** Quoting the threshold read as nonsense at
            // the boundary — "this file defines 44 functions, against 44 for this repo" is a
            // number compared with itself, and every file that lands exactly on the bar got
            // that sentence. A median is the comparison somebody actually wants and cannot
            // degenerate: it says what normal looks like here, which is the whole reason the
            // number is worth printing.
            "median" => median.map(commas),
            "age_years" => value_of(f, Field::AgeDays).map(|d| {
                let y = d / 365.0;
                if y >= 10.0 {
                    format!("{}", y.round() as i64)
                } else {
                    format!("{y:.1}")
                }
            }),
            other => Field::parse(other).and_then(|field| value_of(f, field)).map(commas),
        };
        match filled {
            Some(v) => push(&v, true),
            // A token this subject cannot answer. Not a hole and not a zero: the sentence is
            // dropped for the one that needs nothing.
            None => return plain(),
        }
    }
    push(rest, false);
    out
}

/// A run of a rendered sentence, split at the holes.
///
/// **Spans rather than a marked-up string, so nothing has to parse prose back.** The window
/// bolds the parts that came out of this subject — the numbers are the half somebody scans
/// for — and a `**…**` convention would mean a second grammar, written in one language and
/// read in another, over text that legitimately contains punctuation. This is the same reason
/// the tree crosses the wire as fields rather than as a rendered label.
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Span {
    pub text: String,
    /// True where this run came from a `{{token}}`: a number this subject actually has.
    pub filled: bool,
}

/// The sentence as one string, for anything that cannot show weight.
pub fn flat(spans: &[Span]) -> String {
    spans.iter().map(|s| s.text.as_str()).collect()
}

/// A number as somebody reads it, which past a thousand is not what `{}` prints.
fn commas(v: f32) -> String {
    if v.fract() != 0.0 {
        return format!("{v:.2}");
    }
    let n = v as i64;
    let digits = n.abs().to_string();
    let mut out = String::new();
    for (i, c) in digits.chars().enumerate() {
        if i > 0 && (digits.len() - i).is_multiple_of(3) {
            out.push(',');
        }
        out.push(c);
    }
    if n < 0 {
        format!("-{out}")
    } else {
        out
    }
}

/// One candidate, with enough on it to print a row and to sort a list.
#[derive(Debug, Clone)]
pub struct Subject {
    /// `key_of(path, name, ord)` for a function, the path for a file. **Never the node id**,
    /// which embeds `@line` — a finding that is dismissed has to survive the body moving down
    /// the file, and keying durable state on a node id has cost this project readings once.
    pub key: String,
    pub path: String,
    pub name: String,
    pub kind: NodeKind,
    pub loc: u32,
    pub line: Option<u32>,
    /// The body's hash, for a function — the reading store's own staleness test, reused so
    /// that an archived finding expires the way a reading does. `None` on a file, which has no
    /// body, and on a tree that arrived without one.
    pub body_pin: Option<String>,
    /// Named by `Lang::label`, which is the ONE spelling — a categorical lens keys its
    /// colours on this string, and a second spelling of one language reads as a language the
    /// map has never seen. See `history.md`, where that cost a whole replay its palette.
    pub lang: Option<String>,
}

/// Everything a clause can ask about one subject, resolved once.
pub struct Facts {
    pub subject: Subject,
    values: HashMap<&'static str, f32>,
}

impl Facts {
    fn get(&self, f: Field) -> Option<f32> {
        self.values.get(f.name()).copied()
    }
}

/// Whether the timeline has been walked, and whether git was read at all.
///
/// Passed in rather than read off a node because both are properties of the SCAN: churn is
/// zero on every node of an untraced repo, and a rule that read those zeros would report a
/// repo nobody has traced as one where nothing ever changes. The absence is stated once,
/// here, exactly as it is stated once on the lens.
#[derive(Debug, Clone, Copy, Default)]
pub struct Traced {
    pub git: bool,
    pub churned: bool,
}

/// Flatten a tree into the subjects a rule can be evaluated against.
///
/// `ord` is counted per file in child order, which is what [`crate::assessment::key_of`]
/// means by it — two functions with one name in one file get keys that differ, and they
/// have to be the same keys the store wrote or every reading looks missing.
pub fn subjects(root: &Node, reports: &HashMap<String, Report>, traced: Traced) -> Vec<Facts> {
    let mut out = Vec::new();
    walk(root, reports, traced, &mut out);
    out
}

fn walk(node: &Node, reports: &HashMap<String, Report>, traced: Traced, out: &mut Vec<Facts>) {
    match node.kind {
        NodeKind::Dir => {
            for c in &node.children {
                walk(c, reports, traced, out);
            }
        }
        NodeKind::File => {
            out.push(facts_of(node, &node.path, None, traced));
            let mut seen: HashMap<&str, usize> = HashMap::new();
            for c in &node.children {
                if c.kind != NodeKind::Func {
                    continue;
                }
                let ord = seen.entry(c.name.as_str()).or_insert(0);
                let key = crate::assessment::key_of(&node.path, &c.name, *ord);
                *ord += 1;
                let report = reports.get(&key).filter(|r| !r.stale);
                out.push(facts_of(c, &key, report, traced));
            }
        }
        // A function reached without its file is a tree shape this does not expect; skipping
        // is right rather than guessing an ord, because a wrong ord is a wrong key and a
        // wrong key silently reads as unread.
        NodeKind::Func => {}
    }
}

fn facts_of(node: &Node, key: &str, report: Option<&Report>, traced: Traced) -> Facts {
    let mut v: HashMap<&'static str, f32> = HashMap::new();
    let mut set = |f: Field, x: Option<f32>| {
        if let Some(x) = x {
            v.insert(f.name(), x);
        }
    };
    set(Field::Loc, Some(node.loc as f32));
    if node.kind == NodeKind::File {
        // **`Node::funcs` is zero on a full tree** — it carries the count only for a tree
        // sent WITHOUT its functions, where `slim` has dropped the children that would
        // otherwise be the answer. Reading it here made "crowded file" find nothing at all
        // on a repo whose widest file holds 161 functions, and find it silently, because a
        // rule with no hits looks exactly like a repo with no problem.
        let held = node.children.iter().filter(|c| c.kind == NodeKind::Func).count() as u32;
        set(Field::Funcs, Some(held.max(node.funcs) as f32));
    }
    set(Field::Callers, node.callers.map(|x| x as f32));
    set(Field::Calls, node.calls.map(|x| x as f32));
    set(Field::CloneSize, node.clone_size.map(|x| x as f32));
    if let Some(s) = node.score.as_ref() {
        set(Field::Cognitive, s.cognitive.map(|x| x as f32));
        set(Field::Tangle, s.tangle.map(|t| t[0]));
        // Git fields answer only where git was read. `age_days` is already `None` on a repo
        // with no history; `traced.git` is the other absence — nobody has ASKED for history
        // yet — and the two must not render alike, so neither may answer.
        if traced.git {
            set(Field::AgeDays, s.age_days);
            set(Field::TouchedDays, s.last_touched_days);
        }
        if traced.churned {
            set(Field::Commits, Some(s.commits[0] as f32));
        }
    }
    if node.kind == NodeKind::Func {
        set(Field::Read, Some(if report.is_some() { 1.0 } else { 0.0 }));
        if let Some(r) = report {
            let (predicted, documented) = r.grades();
            set(Field::Surprise, Some(predicted.surprise()));
            set(Field::Documented, documented.map(|g| g.documented()));
            set(Field::Legible, r.legible.map(|g| g.surprise()));
            set(Field::Trap, Some(if r.trap { 1.0 } else { 0.0 }));
        }
    }
    Facts {
        subject: Subject {
            key: key.to_string(),
            path: node.path.clone(),
            name: node.name.clone(),
            kind: node.kind,
            loc: node.loc,
            line: node.line,
            lang: node.lang.map(|l| l.label().to_string()),
            body_pin: node.body.as_deref().map(crate::assessment::body_hash),
        },
        values: v,
    }
}

/// Read one field off one subject.
///
/// **`None` fails the clause.** Never a default, never a zero: a function nobody has read is
/// not an unsurprising one, and a repo nobody has traced is not one where nothing changes.
pub fn value_of(f: &Facts, field: Field) -> Option<f32> {
    f.get(field)
}

pub fn matches(rule: &Rule, f: &Facts) -> bool {
    let want = match rule.pop {
        Pop::Func => NodeKind::Func,
        Pop::File => NodeKind::File,
    };
    if f.subject.kind != want {
        return false;
    }
    if f.subject.loc < rule.floor {
        return false;
    }
    rule.clauses.iter().all(|c| value_of(f, c.field).is_some_and(|got| c.op.holds(got, c.value)))
}

/// Every subject a rule matches, widest first.
///
/// **Ranked by lines** — the axis the whole map is already sized by. Ranking by how many
/// rules fired would be a severity claim, and two rules firing is not twice as bad.
pub fn hits<'a>(rule: &Rule, facts: &'a [Facts]) -> Vec<&'a Subject> {
    let mut v: Vec<&Subject> =
        facts.iter().filter(|f| matches(rule, f)).map(|f| &f.subject).collect();
    rank(&mut v);
    v
}

/// Widest first, ties broken by key so the order is total and does not shuffle between runs.
fn rank(v: &mut [&Subject]) {
    v.sort_by(|a, b| b.loc.cmp(&a.loc).then_with(|| a.key.cmp(&b.key)));
}

/// A rule's findings, minus the ones somebody has settled — and how many those were.
///
/// **A flagged finding is not settled.** It stays, and it comes first: somebody has committed to
/// doing it, and a worklist that swallowed the rows you had committed to would be a worklist
/// you cannot commit to anything in.
pub fn live_hits<'a>(
    rule: &Rule,
    facts: &'a [Facts],
    decided: &HashMap<(String, String), (Verdict, String)>,
) -> (Vec<&'a Subject>, usize) {
    let mut keep: Vec<(&Subject, bool)> = Vec::new();
    let mut settled = 0usize;
    for f in facts.iter().filter(|f| matches(rule, f)) {
        let at = (f.subject.key.clone(), rule.id.to_string());
        let mut flagged = false;
        if let Some((verdict, pin)) = decided.get(&at) {
            if verdict.hides(*pin == pin_of(rule, f)) {
                settled += 1;
                continue;
            }
            flagged = *verdict == Verdict::Flagged;
        }
        keep.push((&f.subject, flagged));
    }
    // Flagged first, then widest — the same total order everywhere, with one thing in front
    // of it.
    keep.sort_by(|a, b| {
        b.1.cmp(&a.1).then_with(|| b.0.loc.cmp(&a.0.loc)).then_with(|| a.0.key.cmp(&b.0.key))
    });
    (keep.into_iter().map(|(s, _)| s).collect(), settled)
}

/// The archive as the evaluator wants it: `(key, rule id) -> (verdict, pin)`.
pub fn pinned(archive: &[Decision]) -> HashMap<(String, String), (Verdict, String)> {
    archive.iter().map(|d| ((d.key.clone(), d.rule.clone()), (d.verdict, d.pin.clone()))).collect()
}

/// The threshold for the calibrated clause that would yield about `target` findings.
///
/// This is the whole of what "rules are built after the scan" means: the SUGGESTION needs a
/// scan, the rule does not. What comes back is a number, and a number is what gets saved —
/// absolute, portable, and meetable, so a list built on it drains as the findings are dealt
/// with. A percentile could not do any of that, and does not even hold the list length
/// steady: 1% of kibana's functions is 1,479 rows and 1% of htop's is 14.
///
/// `None` when the rule's other clauses already leave fewer than `target` subjects — the
/// honest answer being that no threshold on this clause gets you there.
pub fn calibrate(rule: &Rule, facts: &[Facts], target: usize) -> Option<f32> {
    let c = *rule.clauses.get(rule.calibrated)?;
    let others: Rule = Rule {
        clauses: rule
            .clauses
            .iter()
            .enumerate()
            .filter(|(i, _)| *i != rule.calibrated)
            .map(|(_, c)| *c)
            .collect(),
        ..rule.clone()
    };
    let mut vals: Vec<f32> =
        facts.iter().filter(|f| matches(&others, f)).filter_map(|f| value_of(f, c.field)).collect();
    if vals.len() < target {
        return None;
    }
    // Descending for the "over" operators, ascending for the "under" ones — the threshold
    // that yields `target` is the target-th value from whichever end the clause opens at.
    match c.op {
        Op::Ge | Op::Gt => vals.sort_by(|a, b| b.partial_cmp(a).unwrap()),
        Op::Le | Op::Lt => vals.sort_by(|a, b| a.partial_cmp(b).unwrap()),
    }
    Some(vals[target - 1])
}

/// How many of this rule's findings no OTHER rule in the set already found.
///
/// **This, not the hit count, is what a rule is titrated against.** "Long and undocumented"
/// scored 3,455 hits on kibana and was worthless, because 18 of its top 20 were already in
/// "giant function" — a rule whose marginal contribution is near zero is a second name for
/// a list you already have. See the note, which cut it on this number.
/// **Identified by POSITION, never by title.** Two ad-hoc rules off the command line are
/// both called "ad-hoc", and a title comparison quietly excluded each from the other's
/// "others" — so two rules matching the same bodies each reported every hit as unique,
/// which is the exact opposite of what this number is for.
///
/// **Takes the hit lists rather than the rules**, so a catalog of ten costs ten passes over
/// the tree instead of a hundred. Recomputing them here was fine on a small repo and turned
/// one call into ninety filter-and-sorts of kibana's 147,906 subjects — which is a panel
/// that hangs on the repo most in need of it.
pub fn marginal(at: usize, sets: &[Vec<&Subject>]) -> usize {
    let Some(mine) = sets.get(at) else { return 0 };
    let theirs: HashSet<&str> = sets
        .iter()
        .enumerate()
        .filter(|(i, _)| *i != at)
        .flat_map(|(_, o)| o.iter())
        .map(|s| s.key.as_str())
        .collect();
    mine.iter().filter(|s| !theirs.contains(s.key.as_str())).count()
}

/// Every rule's hits, once. The input to [`marginal`], and to anything that draws a group.
pub fn all_hits<'a>(rules: &[Rule], facts: &'a [Facts]) -> Vec<Vec<&'a Subject>> {
    rules.iter().map(|r| hits(r, facts)).collect()
}

/// The distribution of one field, for the calibration hint beside a threshold box.
pub struct Spread {
    pub n: usize,
    pub median: f32,
    pub p95: f32,
    pub max: f32,
}

pub fn spread(facts: &[Facts], pop: Pop, field: Field) -> Option<Spread> {
    let want = match pop {
        Pop::Func => NodeKind::Func,
        Pop::File => NodeKind::File,
    };
    let mut v: Vec<f32> = facts
        .iter()
        .filter(|f| f.subject.kind == want)
        .filter_map(|f| value_of(f, field))
        .collect();
    if v.is_empty() {
        return None;
    }
    v.sort_by(|a, b| a.partial_cmp(b).unwrap());
    let at = |p: f32| v[((v.len() - 1) as f32 * p) as usize];
    Some(Spread { n: v.len(), median: at(0.5), p95: at(0.95), max: v[v.len() - 1] })
}

/// One rule's answer, as the window receives it.
///
/// **The rows are [`crate::search::Hit`] so that a finding lands the way a search result does.**
/// `flyTo` already re-roots the map on a hit and shows the drill it took to get there; a
/// second landing shape would be a second answer to "where is this", and the two would drift.
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Group {
    /// Stable across renames — what a dismissal is filed under. See [`Rule::id`].
    pub id: String,
    pub title: String,
    pub so_what: String,
    pub tier: u8,
    /// The rule, in the grammar somebody could have typed. Shown because a list that will
    /// not say what it asked is a list nobody can argue with.
    pub expr: String,
    /// How many LIVE findings there are, which is not how many rows were sent.
    pub total: usize,
    /// How many this rule found that somebody has settled — fine now, or fine always.
    ///
    /// Reported rather than hidden: a rule showing nothing because its findings were all dealt
    /// with is a different sentence from one that never found any, and the second is what a
    /// reader assumes when a list is empty.
    pub dismissed: usize,
    /// How many of them no other rule found — see [`marginal`].
    pub only: usize,
    /// The lenses this rule combined — see [`Rule::lenses`].
    pub lenses: Vec<String>,
    /// Why this rule could not answer, in words, or `None` where it could.
    ///
    /// **A rule with an unanswerable clause finds nothing, and nothing looks exactly like a
    /// clean bill.** That is the failure this whole surface is written against, so the
    /// absence is stated rather than drawn as a zero — the same discipline the lens follows
    /// when it says `no git history` on the repo instead of on every wedge.
    pub blocked: Option<String>,
    pub hits: Vec<Finding>,
}

/// One finding on the wire: where to fly, and what to file a decision about.
///
/// **Two identifiers, and they are not interchangeable.** `hit.id` embeds `@line` and is what
/// the camera flies to; `key` is `key_of(path, name, ord)` and is what a dismissal is stored
/// under. Keying durable state on the first destroyed a project's readings once — carrying
/// both explicitly is how that cannot be done by accident here.
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Finding {
    pub key: String,
    pub hit: crate::search::Hit,
    /// Somebody has committed to doing this — see [`Verdict::Flagged`].
    ///
    /// On the LEAD rather than left for the window to work out from the archive: the panel
    /// would have to join two lists on `(key, rule id)` to draw one word, and a join done in
    /// two places is a join that disagrees with itself.
    pub flagged: bool,
    /// This rule's sentence about THIS subject, split at its numbers — see [`render`].
    pub says: Vec<Span>,
}

/// How many rows of one group cross the wire.
///
/// The window ranks and pages; the count it prints is `total`. Sending every finding would be
/// ceph's 4,236 load-bearing functions in one payload to draw thirty rows.
pub const PER_GROUP: usize = 50;

/// Why a rule cannot answer here, or `None` if it can.
///
/// Asked of the POPULATION rather than of the scan alone: a field can be missing because
/// nobody read the repo, because nobody traced it, or because no language in it has a call
/// table — three different sentences, and a reader who is told the wrong one goes looking in
/// the wrong place.
pub fn blocked(rule: &Rule, facts: &[Facts], traced: Traced, read: bool) -> Option<String> {
    for c in &rule.clauses {
        if c.field.needs_reading() && !read {
            return Some("nobody has read this repo yet".into());
        }
        let git = matches!(c.field, Field::AgeDays | Field::TouchedDays | Field::Commits);
        if git && !traced.git {
            return Some("no git history has been read".into());
        }
        if c.field == Field::Commits && !traced.churned {
            return Some("the timeline has not been walked".into());
        }
        // Whatever is left: the field exists for this population and nothing has one. On
        // Callers and Reach that is a language whose call shape was never parsed, which is
        // exactly the gray the map paints rather than a zero.
        if !facts.iter().any(|f| value_of(f, c.field).is_some()) {
            return Some(format!("nothing here has a {} to compare", c.field.name()));
        }
    }
    None
}

/// Run a catalog over a scan, ready for the window.
pub fn report(
    root: &Node,
    reports: &HashMap<String, Report>,
    traced: Traced,
    rules: &[Rule],
    archive: &[Decision],
) -> Vec<Group> {
    let facts = subjects(root, reports, traced);
    let read = !reports.is_empty();
    let pins = pinned(archive);
    // Dismissed findings are gone before `marginal` runs, not after: a rule whose every finding
    // somebody has set aside contributes nothing NOW, which is what the number is asked for.
    // One median per rule, over the population its calibrated clause measures — the
    // comparison its sentence quotes. Computed here rather than per finding: it is a property of
    // the repo, and a sort of every value for every row is the cost this avoids.
    let medians: Vec<Option<f32>> = rules
        .iter()
        .map(|r| {
            r.clauses
                .get(r.calibrated)
                .and_then(|c| spread(&facts, r.pop, c.field))
                .map(|s| s.median)
        })
        .collect();
    let by_key: HashMap<&str, &Facts> = facts.iter().map(|f| (f.subject.key.as_str(), f)).collect();
    let (sets, aside): (Vec<_>, Vec<_>) = rules.iter().map(|r| live_hits(r, &facts, &pins)).unzip();
    rules
        .iter()
        .enumerate()
        .map(|(i, rule)| Group {
            id: rule.id.to_string(),
            title: rule.title.to_string(),
            so_what: rule.so_what.to_string(),
            tier: rule.tier(),
            expr: rule.expr(),
            total: sets[i].len(),
            dismissed: aside[i],
            only: marginal(i, &sets),
            lenses: rule.lenses(),
            blocked: blocked(rule, &facts, traced, read),
            hits: sets[i]
                .iter()
                .take(PER_GROUP)
                .map(|s| {
                    // The sentence needs the subject's own numbers, and a `Subject` carries
                    // only what a row prints. Looked up rather than threaded through `hits`,
                    // which every other caller wants ranked and nothing else.
                    let f = by_key.get(s.key.as_str());
                    let says = f.map(|f| render(rule, f, medians[i])).unwrap_or_default();
                    let flagged = pins
                        .get(&(s.key.clone(), rule.id.to_string()))
                        .is_some_and(|(v, _)| *v == Verdict::Flagged);
                    finding_of(s, says, flagged)
                })
                .collect(),
        })
        .collect()
}

fn finding_of(s: &Subject, says: Vec<Span>, flagged: bool) -> Finding {
    Finding { key: s.key.clone(), hit: hit_of(s), flagged, says }
}

fn hit_of(s: &Subject) -> crate::search::Hit {
    crate::search::Hit {
        // The node id, which is what the window flies to — and the reason `Subject` carries
        // both: this is the id, `key` is what a dismissal would be stored under, and they
        // must never be confused for one another.
        id: match s.kind {
            NodeKind::Func => format!("{}#{}@{}", s.path, s.name, s.line.unwrap_or(0)),
            _ => s.path.clone(),
        },
        path: s.path.clone(),
        name: s.name.clone(),
        kind: s.kind,
        line: s.line.unwrap_or(0),
        loc: s.loc,
        lang: s.lang.clone(),
    }
}

/// The batteries-included catalog.
///
/// **Every threshold here is a placeholder and is meant to be.** The note's bench showed a
/// tenfold spread in the threshold that yields a twenty-item list — 134 lines on htop
/// against 1,383 on kibana for one rule — so a shipped constant is wrong on most repos by
/// construction. What ships is the SHAPE; the number comes from `calibrate` against the
/// repo in front of you, and the settings row is where somebody accepts or overrides it.
///
/// Two rules the note's bench measured are missing on purpose. "Last hand alone" and "Many
/// hands" both need per-range contributor counts, which `blame.rs` computes into
/// `RangeDetail::authors` and does NOT put on a node — the second reduction `TODO.md`
/// describes. They arrive with it or not at all; a version of them off `last_author` would
/// make exactly the ownership claim that note refuses to make.
pub fn catalog() -> Vec<Rule> {
    let ge = |field, value| Clause { field, op: Op::Ge, value };
    let lt = |field, value| Clause { field, op: Op::Lt, value };
    /// Ten lines, on every rule whose question needs a body to be about — see [`Rule::floor`].
    /// Rules that already gate on `loc` set their own and do not need it; `Crowded file` is
    /// about a count rather than a body and does not either.
    const FLOOR: u32 = 10;
    let rule = |id, title, so_what, says, pop, clauses: Vec<Clause>, calibrated, floor| Rule {
        id,
        title,
        so_what,
        says,
        pop,
        clauses,
        calibrated,
        floor,
    };
    vec![
        // **The two single-clause rules, and they are the on-ramp rather than the point.**
        // Both say something the map already draws with width, which is why the bench found
        // "Giant function" contributing nothing of its own on htop — and 2,180 rows of its own
        // on kibana, where the giant things are generated parsers nothing else catches. They
        // stay because a list whose first row needs the whole design explained is a list
        // nobody reads, and they are first because they are the two anybody believes.
        rule(
            "giant-function",
            "Giant function",
            "unusually long for this repo",
            "This is {{loc}} lines, where the median function here is {{median}}. Length on its own is not a defect and does not mean this is several functions — it means anything reading it has to take all of it at once, and breaking it up is the usual thing to try.",
            Pop::Func,
            vec![ge(Field::Loc, 200.0)],
            0,
            0,
        ),
        rule(
            "crowded-file",
            "Crowded file",
            "unusually many functions in one file",
            "This file defines {{funcs}} functions, where the median file here defines {{median}}. That is a count rather than a verdict: whether they belong together is a judgement about what they do, which nothing here has made.",
            Pop::File,
            vec![ge(Field::Funcs, 40.0)],
            0,
            0,
        ),
        // ── Everything below is a genuine pair: two lenses, and no wedge shows both. ──
        //
        // **Callers is the axis that earns its keep everywhere.** It carried 4,204 unique rows
        // of 4,236 on ceph and 706 of 719 on kibana — nothing else in the catalog comes close,
        // and it is the one clause that turns a property of a body into a statement about what
        // depends on it. Four rules lean on it on purpose.
        rule(
            "load-bearing-unread",
            "Load-bearing and unread",
            "read this one next",
            "{{callers}} call sites depend on this and no reader has assessed it. It is the cheapest assessment available here, in the sense that what it turns out to be matters to every one of them.",
            Pop::Func,
            vec![ge(Field::Callers, 20.0), lt(Field::Read, 1.0)],
            0,
            FLOOR,
        ),
        rule(
            "knotty-load-bearing",
            "Knotty and load-bearing",
            "branches a lot, and widely depended on",
            "{{callers}} call sites depend on this, and for {{loc}} lines it branches more than its length accounts for. A change here has to be checked against all {{callers}}.",
            Pop::Func,
            vec![ge(Field::Tangle, 0.8), ge(Field::Callers, 10.0)],
            1,
            FLOOR,
        ),
        rule(
            "load-bearing-illegible",
            "Load-bearing and hard to read",
            "hard to follow, and widely depended on",
            "A reader assessed this as hard to follow, and {{callers}} call sites depend on it. Every later edit pays that reading cost again.",
            Pop::Func,
            vec![ge(Field::Legible, 0.6), ge(Field::Callers, 10.0)],
            1,
            FLOOR,
        ),
        // **`documented` runs HIGH for well documented**, so this clause is `lt` — written as
        // `ge` first, which quietly asked for load-bearing code somebody had already
        // explained. A rule can be exactly backwards and still return a plausible list, which
        // is the failure mode this whole surface is built around: nothing crashes, the tiles
        // look right, and the sentence on them is false.
        rule(
            "load-bearing-undocumented",
            "Load-bearing and undocumented",
            "widely depended on, with nothing written about it",
            "{{callers}} call sites depend on this and there is no documentation on it. It is among the most used code here that nothing explains.",
            Pop::Func,
            vec![lt(Field::Documented, 0.35), ge(Field::Callers, 10.0)],
            1,
            FLOOR,
        ),
        // **Surprise against churn — designed in the note, never built until now.** The pair
        // the whole metric was argued for: code nobody predicted, that is also moving. Neither
        // lens shows it, and a surprising body that has sat still for four years is a
        // completely different situation which looks identical.
        //
        // Named "Hot and busy" first. **Heat is retired vocabulary here** — it was a synonym
        // for surprise back when one ramp carried the whole reading, and the app now has
        // twelve lenses and no thermometer. A name that needs the old glossary is a name that
        // teaches the wrong thing to whoever reads it first.
        rule(
            "surprising-changing",
            "Surprising and changing",
            "changing often, and nobody predicted it",
            "A reader could not predict this body, and it changed in {{commits}} commits recently. Either on its own is ordinary; both at once is worth knowing before the next edit.",
            Pop::Func,
            vec![ge(Field::Surprise, 0.6), ge(Field::Commits, 4.0)],
            1,
            FLOOR,
        ),
        rule(
            "surprising-far-reaching",
            "Surprising and far-reaching",
            "it calls a great deal and nobody predicted it",
            "This calls {{calls}} other functions and a reader still could not predict what it does. It coordinates work that is not apparent from its own body.",
            Pop::Func,
            vec![ge(Field::Surprise, 0.6), ge(Field::Calls, 10.0)],
            1,
            FLOOR,
        ),
        rule(
            "stale-doc",
            "Stale doc",
            "documented, and a reader still could not predict it",
            "This has documentation and a reader still could not predict the body. Either the documentation describes behaviour the code no longer has, or it describes it in terms that do not help.",
            Pop::Func,
            vec![ge(Field::Documented, 0.7), ge(Field::Surprise, 0.6)],
            0,
            FLOOR,
        ),
        // **Traps, finally used.** A trap is a mark a reader leaves on a body that will bite
        // whoever edits it next — which is a prediction about an edit, and worth nothing until
        // you know whether anybody is editing. Against churn it is a warning; on its own it is
        // a note about code that may never be touched again.
        rule(
            "trap-being-edited",
            "Trap in code people are editing",
            "easy to break when edited, and being edited",
            "A reader flagged this as easy to break when edited, and it changed in {{commits}} commits recently.",
            Pop::Func,
            vec![ge(Field::Trap, 1.0), ge(Field::Commits, 3.0)],
            1,
            FLOOR,
        ),
        rule(
            "fossil-trap",
            "Fossil trap",
            "easy to break when edited, and years since anyone did",
            "A reader flagged this as easy to break when edited, and no commit has changed it in {{age_years}} years.",
            Pop::Func,
            vec![ge(Field::Trap, 1.0), ge(Field::AgeDays, 1095.0)],
            1,
            FLOOR,
        ),
        // **Clones against churn rather than against size.** A clone group is only a problem
        // once somebody starts editing it: that is the moment one copy gets the fix and the
        // rest quietly do not. Size says only that there is a lot of it.
        rule(
            "clone-being-edited",
            "Clone being edited",
            "one copy changed and the others did not",
            "This body appears {{clone_size}} times in the repo, and this copy changed in {{commits}} commits. Changes made here are not applied to the other copies.",
            Pop::Func,
            vec![ge(Field::CloneSize, 3.0), ge(Field::Commits, 2.0)],
            1,
            FLOOR,
        ),
        rule(
            "widely-cloned",
            "Widely cloned",
            "the same body, in several places",
            "The same {{loc}} lines appear {{clone_size}} times in this repo.",
            Pop::Func,
            vec![ge(Field::CloneSize, 4.0), ge(Field::Loc, 30.0)],
            1,
            0,
        ),
        rule(
            "fossil",
            "Fossil",
            "no commit has changed it in years",
            "{{loc}} lines that no commit has changed in {{age_years}} years.",
            Pop::Func,
            vec![ge(Field::AgeDays, 1825.0), ge(Field::Loc, 100.0)],
            1,
            0,
        ),
        rule(
            "tangled-for-size",
            "Tangled for its size",
            "more complicated than its length accounts for",
            "For {{loc}} lines this branches more than almost anything else in the repo. Its complexity is not explained by its length.",
            Pop::Func,
            vec![ge(Field::Tangle, 0.8), ge(Field::Loc, 40.0)],
            1,
            0,
        ),
    ]
}

// ── Thresholds ─────────────────────────────────────────────────────────────────

/// How many findings a rule should produce on a repo nobody has tuned it for.
///
/// **The catalog ships shapes, not numbers.** The bench measured a tenfold spread in the
/// threshold that yields a twenty-item list — 134 lines on htop against 1,383 on kibana for
/// one rule — so a shipped constant is wrong nearly everywhere: `loc >= 200` is eight findings
/// on htop and 2,292 on kibana, and six thousand findings is not a work queue, it is wallpaper.
///
/// Eight, because there are fifteen rules and the list they share has to stay one somebody
/// reads to the bottom. Tiles merge by subject, so the worklist is shorter than the product.
pub const TARGET: usize = 8;

/// The thresholds this repo's catalog should ship with, calibrated against it.
///
/// **Computed once and SAVED, never recomputed per scan.** A threshold that re-derives itself
/// to yield eight every time is a percentile in disguise: deal with eight and eight more
/// arrive, and the list can never be worked down. What makes a number worth saving is that it
/// can be MET — see `docs/notes/findings.md`, which argues this at length and holds the
/// measurements.
pub fn calibrated(rules: &[Rule], facts: &[Facts]) -> Vec<Rule> {
    rules
        .iter()
        .map(|r| {
            let mut tuned = r.clone();
            if let Some(v) = calibrate(r, facts, TARGET) {
                // **Calibration may TIGHTEN a rule and may never loosen it.**
                //
                // The shipped number is the rule's meaning: a fossil is code nothing has
                // touched in five years, and no repo gets to redefine that. Loosening was
                // tried, on the argument that a small repo should still get a list — and it
                // produced `trap >= 1 and commits >= 0`, which is "any trap" wearing two
                // lenses, and `Fossil trap ... age >= 5.77`, where the unit is DAYS and the
                // word had come to mean "older than a week". Nothing breaks. The rule simply
                // stops asking its second question, and the tile still names both lenses.
                //
                // So the number moves only in the direction that asks for more, and what a
                // small repo gets is a short list — which is the honest answer for a repo that
                // has little wrong with it, and the one thing a percentile could never say.
                let c = &mut tuned.clauses[r.calibrated];
                let tighter = match c.op {
                    Op::Ge | Op::Gt => v > c.value,
                    Op::Le | Op::Lt => v < c.value,
                };
                if tighter {
                    c.value = v;
                }
            }
            // No calibration means fewer than `TARGET` subjects clear the rule's other
            // clauses — there is no threshold that gets there, and the shipped number is as
            // good an answer as any. Not a failure, and nothing is said about it.
            tuned
        })
        .collect()
}

/// This tool's own corner of `.sanity/`, which the reading store cannot reach into.
///
/// **A directory of its own, because `.sanity/` used to be the readings' namespace and their
/// filenames come from the repo.** A shard is named after a top-level directory, so a repo
/// with a `rules/` directory produced a `.sanity/rules.md` full of readings, written over
/// this store; `decisions/` the same. `read_all` also parsed every `.md` up there as a shard,
/// so both files were being read as readings and yielding nothing.
///
/// The readings moved under `readings/` in the same change — see `assessment.rs` — so the
/// three stores no longer share a namespace with each other or with the repo.
/// Where this repo's rules live. A directory rather than a file, so that a repo which
/// outgrows one catalog can shard it the way `readings/` shards — one file per rule, named by
/// id — without the single-file name being in the way.
fn rules_dir(repo: &std::path::Path) -> std::path::PathBuf {
    crate::assessment::dir(repo).join("rules")
}

/// Where decisions about findings live, on the same argument.
fn findings_dir(repo: &std::path::Path) -> std::path::PathBuf {
    crate::assessment::dir(repo).join("findings")
}

fn rules_path(repo: &std::path::Path) -> std::path::PathBuf {
    rules_dir(repo).join("catalog.md")
}

/// This repo's saved thresholds, as `title -> value`. Empty where nobody has tuned it yet.
pub fn saved_rules(repo: &std::path::Path) -> HashMap<String, f32> {
    let Ok(text) = std::fs::read_to_string(rules_path(repo)) else { return HashMap::new() };
    let mut out = HashMap::new();
    for line in text.lines() {
        let Some(rest) = line.strip_prefix("- ") else { continue };
        // "- `Giant function`; loc >= 257"
        let Some((title, clause)) = rest.split_once("; ") else { continue };
        let title = title.trim().trim_matches('`');
        if let Some(v) = clause.split_whitespace().last().and_then(|n| n.parse().ok()) {
            out.insert(title.to_string(), v);
        }
    }
    out
}

/// Write the thresholds this repo is using, so they stop moving.
pub fn save_rules(repo: &std::path::Path, rules: &[Rule]) -> std::io::Result<()> {
    std::fs::create_dir_all(rules_dir(repo))?;
    let mut out = String::new();
    out.push_str("# Finding rules\n\n");
    out.push_str("The thresholds this repo's findings are found with. Calibrated once, against\n");
    out.push_str("this repo, to produce a list somebody would read to the bottom — and then\n");
    out.push_str("LEFT ALONE, so that dealing with a finding makes the list shorter instead of\n");
    out.push_str("lowering the bar for the next one.\n\n");
    out.push_str("Edit a number and it is used as written. Delete the file and it is\n");
    out.push_str("calibrated again.\n\n");
    for r in rules {
        let c = r.clauses[r.calibrated];
        out.push_str(&format!(
            "- `{}`; {} {} {}\n",
            r.id,
            c.field.name(),
            c.op.name(),
            trim_num(c.value)
        ));
    }
    let path = rules_path(repo);
    std::fs::write(&path, &out)?;
    // Read back rather than trusting `Ok`: everything downstream treats these numbers as
    // settled, and a threshold that did not land would silently move on the next open.
    if std::fs::read_to_string(&path)? != out {
        return Err(std::io::Error::other("the rules on disk do not match what was written"));
    }
    Ok(())
}

/// The catalog this repo actually runs: saved where it has been tuned, calibrated and saved
/// where it has not.
///
/// **The saving is the point.** Calibration is an authoring aid — the scan suggests a number
/// and the number is what gets kept. Doing it without keeping it would make every rule a
/// percentile.
pub fn rules_for(repo: &std::path::Path, facts: &[Facts]) -> Vec<Rule> {
    let base = catalog();
    let saved = saved_rules(repo);
    if saved.is_empty() {
        let tuned = calibrated(&base, facts);
        // **Nothing is created for a repo with nothing in it.** `assessments.md` states this
        // for readings — "an open is a look, and a look that leaves a directory behind is a
        // surprise where people run `git status`" — and it holds here for the same reason. It
        // is also the guard that would have contained a real one: a path that resolved to the
        // empty string scanned the current directory, found nothing, and wrote a rule catalog
        // into whatever the caller happened to be standing in.
        if facts.is_empty() {
            return tuned;
        }
        // A failure here costs a file, not an answer: the thresholds are still right for this
        // run, they will simply be calibrated again next time.
        let _ = save_rules(repo, &tuned);
        return tuned;
    }
    base.into_iter()
        .map(|mut r| {
            if let Some(v) = saved.get(r.id) {
                r.clauses[r.calibrated].value = *v;
            }
            r
        })
        .collect()
}

// ── The archive ────────────────────────────────────────────────────────────────
//
// **A decision is stored like a reading.** Same `.sanity/`, same Markdown that is parsed back
// — so rewriting is reading and writing, and there is no migrator, ever. See
// `assessments.md` for why that is the whole mechanism.

/// What somebody decided about a finding.
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum Verdict {
    /// This needs doing. **Stays in the list**, and rises to the top of it.
    ///
    /// The one verdict that does not hide anything: a worklist that swallowed the rows
    /// somebody had committed to would be a worklist you cannot commit to anything in.
    Flagged,
    /// Fine as it stands. Hidden while the code is as it was — see [`pin_of`]. When the body
    /// or the numbers move, the decision expires and the finding comes back, because "this is
    /// fine" was said about something that is no longer there.
    FineForNow,
    /// Fine, and will stay fine. Hidden whatever the code does.
    ///
    /// **The pin is still recorded and deliberately not consulted.** This verdict is about the
    /// SUBJECT rather than about a version of it — "this function is allowed to be long" — and
    /// what the code looked like when somebody said so is provenance worth keeping even though
    /// nothing tests it.
    FineAlways,
}

impl Verdict {
    fn word(self) -> &'static str {
        match self {
            Verdict::Flagged => "flagged",
            Verdict::FineForNow => "fine-for-now",
            Verdict::FineAlways => "fine-always",
        }
    }

    fn parse(s: &str) -> Option<Verdict> {
        Some(match s.trim() {
            "flagged" => Verdict::Flagged,
            "fine-for-now" => Verdict::FineForNow,
            "fine-always" => Verdict::FineAlways,
            _ => return None,
        })
    }

    /// Whether this verdict takes the finding out of the list, given whether its pin still holds.
    pub fn hides(self, pin_holds: bool) -> bool {
        match self {
            Verdict::Flagged => false,
            Verdict::FineForNow => pin_holds,
            Verdict::FineAlways => true,
        }
    }
}

/// One finding somebody has decided about.
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Decision {
    /// `key_of(path, name, ord)` for a function, the path for a file.
    ///
    /// **Never the node id**, which embeds `@line`: a decision has to survive its function
    /// moving down the file, and keying durable state on a node id destroyed a project's
    /// readings once already.
    pub key: String,
    /// Which rule raised the finding, by [`Rule::id`]. A decision is about ONE claim, not about
    /// the code — the same body can be a giant function you accept and a stale doc you do not.
    pub rule: String,
    /// What that rule was CALLED when this was filed.
    ///
    /// **Stored beside the id rather than looked up.** The archive is a record of decisions
    /// somebody made, and the words they made them under are part of the record — a row that
    /// re-titled itself when the catalog was reworded would be quietly rewriting history. A
    /// rule that no longer exists still has a row here that reads.
    #[serde(default)]
    pub title: String,
    pub verdict: Verdict,
    /// The state the code was in when this was said — see [`pin_of`].
    pub pin: String,
    pub reason: String,
    pub when: String,
    pub by: String,
}

/// What a decision is pinned to, so `fine for now` can expire.
///
/// **Both halves, and either moving retires it.** The body hash is the reading store's own
/// staleness test, and it catches a body rewritten in place. The clause readings catch what a
/// hash cannot see the significance of — a file that has grown from 47 functions to 90 is not
/// the file anybody said was fine — and they are the only pin available on a file, which has
/// no body at all.
///
/// Whitespace-collapsed by `body_hash`, so `cargo fmt` does not retire a repo's archive.
pub fn pin_of(rule: &Rule, f: &Facts) -> String {
    let body = f.subject.body_pin.as_deref().unwrap_or("-");
    let vals: Vec<String> = rule
        .clauses
        .iter()
        .map(|c| match value_of(f, c.field) {
            Some(v) => format!("{}={}", c.field.name(), trim_num(v)),
            None => format!("{}=?", c.field.name()),
        })
        .collect();
    format!("{body} {}", vals.join(" "))
}

/// Where the archive lives. One file, not a shard per directory: readings are one per function
/// and decisions are one per judgement somebody actually made, which is far fewer.
fn archive_path(repo: &std::path::Path) -> std::path::PathBuf {
    findings_dir(repo).join("decisions.md")
}

/// Read the archive back. Absent file, empty archive — which is the honest reading of a repo
/// where nobody has decided anything.
pub fn archive(repo: &std::path::Path) -> Vec<Decision> {
    let Ok(text) = std::fs::read_to_string(archive_path(repo)) else { return Vec::new() };
    let mut out = Vec::new();
    let mut key = String::new();
    for line in text.lines() {
        if let Some(k) = line.strip_prefix("## ") {
            key = k.trim().to_string();
            continue;
        }
        let Some(rest) = line.strip_prefix("- ") else { continue };
        if key.is_empty() {
            continue;
        }
        let mut d = Decision {
            key: key.clone(),
            rule: String::new(),
            title: String::new(),
            verdict: Verdict::FineForNow,
            pin: String::new(),
            reason: String::new(),
            when: String::new(),
            by: String::new(),
        };
        let mut said = false;
        // Same shape the reading store parses: segments separated by `; `, each named by its
        // own prefix, so a segment nobody recognises is skipped rather than shifting the rest.
        for seg in rest.split("; ") {
            let seg = seg.trim();
            if let Some(v) = seg.strip_prefix("rule ") {
                d.rule = v.trim().trim_matches('`').to_string();
            } else if let Some(v) = seg.strip_prefix("called ") {
                d.title = v.trim().trim_matches('`').to_string();
            } else if let Some(v) = seg.strip_prefix("verdict ") {
                match Verdict::parse(v.trim().trim_matches('`')) {
                    Some(x) => {
                        d.verdict = x;
                        said = true;
                    }
                    // **A verdict nobody recognises drops the record.** Defaulting would pick
                    // one of three, and two of them HIDE a finding — a file written by a newer
                    // version, or edited by hand into something unreadable, must not quietly
                    // silence work.
                    None => return out,
                }
            } else if let Some(v) = seg.strip_prefix("pin ") {
                d.pin = v.trim().trim_matches('`').to_string();
            } else if let Some(v) = seg.strip_prefix("when ") {
                d.when = v.trim().to_string();
            } else if let Some(v) = seg.strip_prefix("by ") {
                d.by = v.trim().to_string();
            } else if let Some(v) = seg.strip_prefix("reason: ") {
                d.reason = v.trim().to_string();
            }
        }
        if !d.rule.is_empty() && said {
            out.push(d);
        }
    }
    out
}

fn escape(s: &str) -> String {
    // The format's only structural characters. A reason somebody types is prose and may
    // contain either; a newline would start a line the parser reads as a new record.
    s.replace(['\n', '\r'], " ").replace("; ", ", ")
}

/// Write the archive back, whole.
///
/// **Read back and compared, never trusted to `Ok`.** A write returning success is not proof
/// the bytes are there, and the migration that destroyed a project's readings gated its delete
/// on exactly that. Nothing here deletes anything, but the same rule applies to the answer
/// this returns: a caller that believes a decision landed will stop showing the finding.
pub fn save_archive(repo: &std::path::Path, all: &[Decision]) -> std::io::Result<()> {
    std::fs::create_dir_all(findings_dir(repo))?;
    // **The file is a pure function of what is in it, and `git blame` is why.**
    //
    // A decision's provenance — which tree it was made against — is not a field here. It is
    // the commit the line arrived in, recorded by git, which is the thing whose job that is;
    // a stored copy would be a second answer that a hand-edit or a squash could put out of
    // step with the history, with nobody able to say which was right.
    //
    // That only holds while an untouched decision keeps identical bytes. Subjects were
    // already stable — `BTreeMap` — but the decisions WITHIN one were in the order they were
    // added, and `decide` retains-and-pushes onto the end. So re-deciding one rule on a
    // subject that had two rewrote the other one's line as well, blamed it on the newer
    // commit, and cost a decision nobody had touched the only record of when it was made.
    let mut by_key: std::collections::BTreeMap<&str, Vec<&Decision>> = Default::default();
    for d in all {
        by_key.entry(d.key.as_str()).or_default().push(d);
    }
    for ds in by_key.values_mut() {
        ds.sort_by(|a, b| a.rule.cmp(&b.rule));
    }
    let mut out = String::new();
    out.push_str("# Decisions\n\n");
    out.push_str(
        "What somebody decided about a finding: that it needs doing, that it is fine as\n",
    );
    out.push_str("the code stands, or that it is fine whatever the code does. Each records the\n");
    out.push_str("rule that raised it and the state the code was in.\n\n");
    out.push_str(
        "`fine-for-now` expires when that state moves, because \"this is fine\" was said\n",
    );
    out.push_str("about code that no longer exists. `fine-always` does not.\n\n");
    out.push_str("Written by sanity. Editing it by hand is fine; it is parsed back.\n");
    for (key, ds) in by_key {
        out.push_str(&format!("\n## {key}\n\n"));
        for d in ds {
            out.push_str(&format!(
                "- rule `{}`; called `{}`; verdict `{}`; pin `{}`; when {}; by {}; reason: {}\n",
                escape(&d.rule),
                escape(&d.title),
                d.verdict.word(),
                escape(&d.pin),
                escape(&d.when),
                escape(&d.by),
                escape(&d.reason),
            ));
        }
    }
    let path = archive_path(repo);
    std::fs::write(&path, &out)?;
    // Read back: what is on disk is what the next `archive()` will answer with, and a caller
    // that stops drawing a finding on the strength of this needs the claim to be true.
    if std::fs::read_to_string(&path)? != out {
        return Err(std::io::Error::other("the archive on disk does not match what was written"));
    }
    Ok(())
}

/// Record one decision, replacing whatever stood for that finding before.
pub fn decide(repo: &std::path::Path, d: Decision) -> std::io::Result<()> {
    let mut all = archive(repo);
    all.retain(|x| !(x.key == d.key && x.rule == d.rule));
    all.push(d);
    save_archive(repo, &all)
}

/// Take a decision back, returning the finding to the list.
pub fn undecide(repo: &std::path::Path, key: &str, rule: &str) -> std::io::Result<()> {
    let mut all = archive(repo);
    all.retain(|x| !(x.key == key && x.rule == rule));
    save_archive(repo, &all)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn func(name: &str, loc: u32) -> Node {
        let mut n = Node::dir("f.rs", name);
        n.kind = NodeKind::Func;
        // The id carries `@line` exactly as a real one does — the keying test is only worth
        // anything if the thing it must not use is present to be used.
        n.id = format!("f.rs#{name}@1");
        n.loc = loc;
        n
    }

    fn file_with(children: Vec<Node>) -> Node {
        let mut f = Node::dir("f.rs", "f.rs");
        f.kind = NodeKind::File;
        f.loc = children.iter().map(|c| c.loc).sum();
        f.funcs = children.len() as u32;
        f.children = children;
        let mut root = Node::dir("", "repo");
        root.children = vec![f];
        root
    }

    /// The rule text is the settings page's own vocabulary, so it has to round-trip.
    #[test]
    fn a_rule_survives_being_written_down() {
        let r = Rule::parse("func: loc >= 200 and callers >= 20").expect("parses");
        assert_eq!(r.pop, Pop::Func);
        assert_eq!(r.clauses.len(), 2);
        assert_eq!(r.expr(), "func: loc >= 200 and callers >= 20");
        assert!(Rule::parse("dir: loc >= 10").is_err());
        assert!(Rule::parse("func: loc >= 1 and calls >= 1 and age >= 1").is_err());
    }

    /// **The rule this file exists to keep.** An unanswerable clause fails; it does not
    /// default. Without it, an untraced repo reports every function as brand new and an
    /// unread one as unsurprising — a confident answer where there is no evidence.
    #[test]
    fn a_clause_with_no_evidence_never_matches() {
        let tree = file_with(vec![func("wide", 500)]);
        let reports = HashMap::new();

        // No git read at all: an age clause cannot be answered, so it cannot fire.
        let untraced = subjects(&tree, &reports, Traced { git: false, churned: false });
        let old = Rule::parse("func: age >= 1").expect("parses");
        assert_eq!(hits(&old, &untraced).len(), 0);

        // And neither can a reading clause, on a function nobody has read.
        let hot = Rule::parse("func: surprise >= 0.1").expect("parses");
        assert_eq!(hits(&hot, &untraced).len(), 0);

        // While a clause the parse CAN answer still does, in the same tree.
        let big = Rule::parse("func: loc >= 200").expect("parses");
        assert_eq!(hits(&big, &untraced).len(), 1);

        // `read` is the exception and must stay one: "nobody has read this" is a fact, not
        // an absence, and it is what the whole tier 1 reading queue is built on.
        let unread = Rule::parse("func: read < 1").expect("parses");
        assert_eq!(hits(&unread, &untraced).len(), 1);
    }

    /// A threshold that yields a list somebody will read to the bottom, off this repo's own
    /// distribution — and a number, so the list it builds can drain.
    #[test]
    fn calibration_targets_a_count_not_a_percentile() {
        let tree = file_with((1..=100).map(|i| func(&format!("f{i}"), i * 10)).collect());
        let facts = subjects(&tree, &HashMap::new(), Traced::default());
        let rule = Rule::parse("func: loc >= 1").expect("parses");

        // Twenty findings means the twentieth-widest body: 100 functions at 10..1000 lines,
        // so the twentieth from the top is 810.
        let t = calibrate(&rule, &facts, 20).expect("enough to calibrate");
        assert_eq!(t, 810.0);
        let tuned = Rule {
            clauses: vec![Clause { field: Field::Loc, op: Op::Ge, value: t }],
            ..rule.clone()
        };
        assert_eq!(hits(&tuned, &facts).len(), 20);

        // And it says so rather than guessing when the population cannot reach the target.
        assert!(calibrate(&rule, &facts, 500).is_none());
    }

    /// The number the catalog is titrated against — a rule that finds nothing new is a
    /// second name for a list you already have, whatever its hit count says.
    #[test]
    fn marginal_contribution_sees_through_an_overlapping_rule() {
        let tree = file_with(vec![func("a", 500), func("b", 300), func("c", 50)]);
        let facts = subjects(&tree, &HashMap::new(), Traced::default());
        let wide = Rule::parse("func: loc >= 100").expect("parses");
        let wider = Rule::parse("func: loc >= 40").expect("parses");

        // `wider` has the bigger list and one row of its own; `wide` brings nothing that
        // `wider` has not already got.
        assert_eq!(hits(&wide, &facts).len(), 2);
        assert_eq!(hits(&wider, &facts).len(), 3);
        let both = vec![wide.clone(), wider.clone()];
        let sets = all_hits(&both, &facts);
        assert_eq!(marginal(0, &sets), 0);
        assert_eq!(marginal(1, &sets), 1);

        // Both are titled "ad-hoc", which is why identity here is positional: a title
        // comparison would drop each from the other's set and call every hit unique.
        assert_eq!(both[0].title, both[1].title);
    }

    /// **`Node::funcs` is zero on a full tree**, so a file population has to count its
    /// children. Reading the field found nothing on a repo whose widest file holds 161
    /// functions — and found it silently, which is how a rule with no hits and a repo with
    /// no problem come to look identical.
    #[test]
    fn a_file_is_counted_by_the_functions_it_holds() {
        let tree = file_with(vec![func("a", 10), func("b", 10), func("c", 10)]);
        // Exactly the state a full tree is in: children present, the count field unset.
        assert_eq!(tree.children[0].funcs, 3);
        let mut full = tree.clone();
        full.children[0].funcs = 0;
        let facts = subjects(&full, &HashMap::new(), Traced::default());
        let crowded = Rule::parse("file: funcs >= 3").expect("parses");
        assert_eq!(hits(&crowded, &facts).len(), 1);

        // And a slimmed tree — children dropped, the count carried — still answers.
        let mut slim = tree.clone();
        slim.children[0].children.clear();
        let facts = subjects(&slim, &HashMap::new(), Traced::default());
        assert_eq!(hits(&crowded, &facts).len(), 1);
    }

    /// **The archive round-trips through Markdown, because rewriting is reading and writing.**
    /// There is no migrator and there never will be; a record this cannot parse back is a
    /// decision somebody made that the tool has silently dropped.
    #[test]
    fn a_decision_survives_being_written_down() {
        let dir = std::env::temp_dir().join(format!("sanity-findings-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).expect("temp repo");
        let d = Decision {
            key: "src/a.rs#run".into(),
            rule: "giant-function".into(),
            title: "Giant function".into(),
            verdict: Verdict::FineForNow,
            pin: "abc123 loc=300".into(),
            // Prose, with both of the format's structural characters in it.
            reason: "it is a dispatch table; splitting it
would hide the shape"
                .into(),
            when: "2026-09-02T16:00:00Z".into(),
            by: "ross@rossturk.com".into(),
        };
        decide(&dir, d.clone()).expect("writes");
        let back = archive(&dir);
        assert_eq!(back.len(), 1);
        assert_eq!(back[0].key, d.key);
        assert_eq!(back[0].rule, d.rule);
        assert_eq!(back[0].pin, d.pin);
        assert_eq!(back[0].verdict, Verdict::FineForNow);
        assert_eq!(back[0].by, d.by);
        // The newline and the `; ` are gone, and nothing after them was lost — a reason that
        // ate the rest of its own record would take the pin with it.
        assert!(back[0].reason.starts_with("it is a dispatch table, splitting it"));
        assert!(back[0].reason.ends_with("would hide the shape"));

        // Dismissing the same finding twice replaces rather than accumulates.
        decide(&dir, Decision { reason: "second thoughts".into(), ..d.clone() }).expect("writes");
        assert_eq!(archive(&dir).len(), 1);
        assert_eq!(archive(&dir)[0].reason, "second thoughts");

        // The same body under a DIFFERENT rule is a different decision and stands alone.
        decide(&dir, Decision { rule: "tangled-for-size".into(), ..d.clone() }).expect("w");
        assert_eq!(archive(&dir).len(), 2);

        undecide(&dir, &d.key, &d.rule).expect("writes");
        let left = archive(&dir);
        assert_eq!(left.len(), 1);
        assert_eq!(left[0].rule, "tangled-for-size");
        let _ = std::fs::remove_dir_all(&dir);
    }

    /// **A dismissal expires when the thing it was about moves.** Without this the archive is
    /// a graveyard: somebody says a 200-line function is fine, it grows to 900, and the finding
    /// never comes back because the decision outlived its subject.
    #[test]
    fn fine_for_now_does_not_outlive_what_it_was_about() {
        let rule = Rule::parse("func: loc >= 100").expect("parses");
        // Filed under the ID, not the title — renaming a rule must not orphan the decisions
        // somebody made with it.
        let rule = Rule { id: "giant-function", title: "Giant function", ..rule };
        let tree = file_with(vec![func("run", 300)]);
        let facts = subjects(&tree, &HashMap::new(), Traced::default());
        let at = facts.iter().find(|f| f.subject.kind == NodeKind::Func).expect("a function");

        let d = Decision {
            key: at.subject.key.clone(),
            rule: "giant-function".into(),
            title: "Giant function".into(),
            verdict: Verdict::FineForNow,
            pin: pin_of(&rule, at),
            reason: "fine".into(),
            when: String::new(),
            by: String::new(),
        };
        let (live, aside) = live_hits(&rule, &facts, &pinned(std::slice::from_ref(&d)));
        assert_eq!((live.len(), aside), (0, 1), "dismissed while the code is as it was");

        // The title moves and the decision stands, which is the whole reason the key is an id.
        let renamed = Rule { title: "Something else entirely", ..rule.clone() };
        let (live, aside) = live_hits(&renamed, &facts, &pinned(std::slice::from_ref(&d)));
        assert_eq!((live.len(), aside), (0, 1), "a rename is not a new rule");

        // The same function, longer. The pin no longer matches, so the finding is back — and it
        // is back as a LEAD, not as a silently-kept dismissal.
        let grown = file_with(vec![func("run", 900)]);
        let facts = subjects(&grown, &HashMap::new(), Traced::default());
        let (live, aside) = live_hits(&rule, &facts, &pinned(std::slice::from_ref(&d)));
        assert_eq!((live.len(), aside), (1, 0), "the code moved out from under the decision");

        // **`fine-always` is about the subject, not a version of it**, so the same move leaves
        // it hidden. This is the whole difference between the two verdicts and it is the one
        // thing a reader of this file needs to be able to check.
        let forever = Decision { verdict: Verdict::FineAlways, ..d.clone() };
        let (live, aside) = live_hits(&rule, &facts, &pinned(std::slice::from_ref(&forever)));
        assert_eq!((live.len(), aside), (0, 1), "always means always");

        // And a flagged finding is not settled at all: it stays in the list, because somebody
        // committed to doing it.
        let flagged = Decision { verdict: Verdict::Flagged, ..d.clone() };
        let (live, aside) = live_hits(&rule, &facts, &pinned(std::slice::from_ref(&flagged)));
        assert_eq!((live.len(), aside), (1, 0), "a flag is a commitment, not a dismissal");
    }

    /// **A sentence with a hole in it is worse than the short one.** A rule may reference a
    /// number its own clauses do not guarantee — and printing `0` or `?` there would be the
    /// map claiming a measurement nobody took, on the one surface whose whole job is not to.
    #[test]
    fn a_paragraph_it_cannot_fill_is_not_printed() {
        let tree = file_with(vec![func("run", 300)]);
        let facts = subjects(&tree, &HashMap::new(), Traced::default());
        let at = facts.iter().find(|f| f.subject.kind == NodeKind::Func).expect("a function");

        let filled = Rule {
            title: "t",
            so_what: "it is long",
            says: "{{name}} is {{loc}} lines, past the {{threshold}} that counts as long.",
            ..Rule::parse("func: loc >= 100").expect("parses")
        };
        assert_eq!(
            flat(&render(&filled, at, Some(11.0))),
            "run is 300 lines, past the 100 that counts as long."
        );

        // `age` needs git, and nothing here has been traced. The sentence is abandoned whole
        // rather than printed with a gap where the number should be.
        let cannot = Rule { says: "untouched for {{age_years}} years.", ..filled.clone() };
        assert_eq!(flat(&render(&cannot, at, None)), "It is long.");

        // So is a token that is not a field at all — a typo in a template must not ship as a
        // literal `{{callerz}}` in front of somebody.
        let typo = Rule { says: "{{callerz}} things call it.", ..filled.clone() };
        assert_eq!(flat(&render(&typo, at, None)), "It is long.");

        // Thousands are grouped: a raw `147906` in a sentence reads as a typo.
        let big = file_with(vec![func("wide", 12345)]);
        let facts = subjects(&big, &HashMap::new(), Traced::default());
        let at = facts.iter().find(|f| f.subject.kind == NodeKind::Func).expect("a function");
        assert!(flat(&render(&filled, at, Some(11.0))).contains("12,345"));

        // And the number is its own span, so the window can weight it: a sentence that came
        // back as one run would have nothing to bold.
        let spans = render(&filled, at, Some(11.0));
        assert!(spans.iter().any(|s| s.filled && s.text == "12,345"));
        assert!(spans.iter().any(|s| !s.filled && s.text.contains("lines")));
    }

    /// Every shipped rule's sentence is fillable from what its own clauses guarantee.
    ///
    /// **The catalog is prose now, and prose rots.** A template referencing a field the rule
    /// does not gate on falls back silently — the tile still reads, so nobody notices that the
    /// tailored sentence never appears. This is what notices.
    #[test]
    fn every_catalog_sentence_names_only_what_its_rule_guarantees() {
        for r in catalog() {
            let mut rest = r.says;
            while let Some(at) = rest.find("{{") {
                let close = rest[at..].find("}}").expect("a token closes");
                let token = &rest[at + 2..at + close];
                rest = &rest[at + close + 2..];
                if matches!(token, "name" | "path" | "threshold" | "median" | "age_years") {
                    continue;
                }
                let field = Field::parse(token)
                    .unwrap_or_else(|| panic!("{}: `{token}` is not a field", r.title));
                // **Two fields are guaranteed by construction rather than by a clause.**
                // `facts_of` sets `loc` on every subject and `funcs` on every file, so a
                // sentence may name them whatever the rule gates on. Everything else has to
                // be earned by a clause, or the tailored sentence silently never appears.
                let always = field == Field::Loc || (field == Field::Funcs && r.pop == Pop::File);
                assert!(
                    always || r.clauses.iter().any(|c| c.field == field),
                    "{}: says `{token}`, which no clause guarantees",
                    r.title,
                );
            }
        }
    }

    /// **A calibrated threshold must still be a threshold.** Where too few bodies clear the
    /// bar, calibration reaches the bottom of the range — and zero on a count is a clause
    /// every subject satisfies, which turns a two-lens rule into a one-lens one that still
    /// shows two lenses. Nothing breaks; the rule just stops asking its second question.
    #[test]
    fn calibration_never_makes_a_clause_vacuous() {
        // Three bodies, none of them touched, against a rule wanting eight.
        let tree = file_with(vec![func("a", 300), func("b", 200), func("c", 100)]);
        let facts = subjects(&tree, &HashMap::new(), Traced::default());
        let rule = Rule {
            title: "t",
            so_what: "x",
            says: "",
            ..Rule::parse("func: loc >= 50 and calls >= 5").expect("parses")
        };
        let rule = Rule { calibrated: 1, ..rule };
        let tuned = calibrated(std::slice::from_ref(&rule), &facts);
        assert_eq!(
            tuned[0].clauses[1].value, 5.0,
            "the shipped threshold stands rather than falling to something every body clears",
        );

        // And the direction it DOES move: plenty of bodies past the bar, so the bar rises.
        let many = file_with((1..=40).map(|i| func(&format!("f{i}"), i * 10)).collect());
        let facts = subjects(&many, &HashMap::new(), Traced::default());
        let wide = Rule { calibrated: 0, ..Rule::parse("func: loc >= 50").expect("parses") };
        let wide = Rule { title: "t", so_what: "x", says: "", ..wide };
        let tuned = calibrated(&[wide], &facts);
        assert!(
            tuned[0].clauses[0].value > 50.0,
            "a repo with plenty past the bar raises it, which is the noise this exists to cut",
        );
    }

    /// **A three-line accessor called thirty times is not a finding.** Without a floor,
    /// "load-bearing and undocumented" returned eight rows of `len`, `new` and `path` — all
    /// true, and all of them work nobody should do. The same gap put a three-line accessor at
    /// the top of the reading queue, where it would have spent budget to learn that an
    /// accessor accesses something.
    #[test]
    fn a_rule_about_a_body_says_nothing_about_a_trivial_one() {
        let tree = file_with(vec![func("len", 3), func("parse_shard", 133)]);
        let facts = subjects(&tree, &HashMap::new(), Traced::default());
        let base = Rule::parse("func: loc >= 1").expect("parses");

        let unfloored = Rule { floor: 0, ..base.clone() };
        assert_eq!(hits(&unfloored, &facts).len(), 2);

        let floored = Rule { floor: 10, ..base };
        let kept = hits(&floored, &facts);
        assert_eq!(kept.len(), 1);
        assert_eq!(kept[0].name, "parse_shard");

        // And every shipped rule whose question is about a BODY has one, so the catalog
        // cannot regain the gap by adding a rule that forgets it.
        for r in catalog() {
            let about_a_body = r.pop == Pop::Func
                && !r.clauses.iter().any(|c| c.field == Field::Loc)
                && r.clauses.iter().any(|c| {
                    matches!(
                        c.field,
                        Field::Callers
                            | Field::Calls
                            | Field::Surprise
                            | Field::Documented
                            | Field::Legible
                            | Field::Trap
                            | Field::CloneSize
                    )
                });
            if about_a_body {
                assert!(r.floor > 0, "{} asks about a body and has no floor", r.title);
            }
        }
    }

    /// **The store is a pure function of its contents, because `git blame` is the record.**
    ///
    /// A decision carries no commit: which tree it was made against is the commit its line
    /// arrived in, and git already keeps that. The price of not storing it is that an
    /// untouched decision has to keep identical bytes — and it did not. Subjects were stable
    /// through a `BTreeMap`; the decisions inside one were in insertion order, so re-deciding
    /// one rule moved a sibling's line, rewrote it, and blamed it on the newer commit.
    #[test]
    fn the_same_decisions_write_the_same_bytes_whatever_order_they_arrived_in() {
        let dir = std::env::temp_dir().join(format!("sanity-order-{}", std::process::id()));
        let mut one = None;
        // The same three decisions on one subject, filed in two different orders. Two of them
        // share a subject, which is the case that was broken.
        for order in [[0usize, 1, 2], [2, 1, 0]] {
            let _ = std::fs::remove_dir_all(&dir);
            std::fs::create_dir_all(&dir).expect("temp repo");
            let all = [
                ("src/a.rs#run", "giant-function", "Giant function"),
                ("src/a.rs#run", "tangled-for-size", "Tangled for its size"),
                ("src/b.rs#go", "fossil", "Fossil"),
            ];
            for i in order {
                let (key, rule, title) = all[i];
                decide(
                    &dir,
                    Decision {
                        key: key.into(),
                        rule: rule.into(),
                        title: title.into(),
                        verdict: Verdict::FineForNow,
                        pin: "abc loc=300".into(),
                        reason: "fine".into(),
                        // Deliberately identical: `when` is the one field that legitimately
                        // differs between two filings, and it is not what this is about.
                        when: "2026-09-03T00:00:00Z".into(),
                        by: "ross".into(),
                    },
                )
                .expect("writes");
            }
            let text =
                std::fs::read_to_string(dir.join(".sanity").join("findings").join("decisions.md"))
                    .expect("reads");
            match &one {
                None => one = Some(text),
                Some(first) => assert_eq!(*first, text, "insertion order reached the file"),
            }
        }

        // And re-deciding one rule leaves its sibling's line exactly where it was — the line
        // git would otherwise re-blame.
        let before =
            std::fs::read_to_string(dir.join(".sanity").join("findings").join("decisions.md"))
                .expect("reads");
        decide(
            &dir,
            Decision {
                key: "src/a.rs#run".into(),
                rule: "giant-function".into(),
                title: "Giant function".into(),
                verdict: Verdict::FineAlways,
                pin: "abc loc=300".into(),
                reason: "second thoughts".into(),
                when: "2026-09-03T00:00:00Z".into(),
                by: "ross".into(),
            },
        )
        .expect("writes");
        let after =
            std::fs::read_to_string(dir.join(".sanity").join("findings").join("decisions.md"))
                .expect("reads");
        let moved: Vec<&str> = before
            .lines()
            .filter(|l| l.starts_with("- ") && !after.lines().any(|a| a == *l))
            .collect();
        assert_eq!(
            moved,
            vec![
                "- rule `giant-function`; called `Giant function`; verdict `fine-for-now`; \
pin `abc loc=300`; when 2026-09-03T00:00:00Z; by ross; reason: fine"
            ],
            "only the decision that changed may change",
        );
        let _ = std::fs::remove_dir_all(&dir);
    }

    /// Keys are `key_of`, never node ids — a dismissal has to survive the body moving down
    /// the file, and node ids embed `@line`.
    #[test]
    fn a_lead_is_keyed_the_way_a_reading_is() {
        let tree = file_with(vec![func("dup", 10), func("dup", 20), func("other", 30)]);
        let facts = subjects(&tree, &HashMap::new(), Traced::default());
        let keys: Vec<&str> = facts
            .iter()
            .filter(|f| f.subject.kind == NodeKind::Func)
            .map(|f| f.subject.key.as_str())
            .collect();
        assert_eq!(keys, vec!["f.rs#dup", "f.rs#dup#2", "f.rs#other"]);
        assert!(keys.iter().all(|k| !k.contains('@')));
    }
}
