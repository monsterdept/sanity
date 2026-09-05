//! Findings — where what has been measured yields something needing inspection or work.
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
use std::collections::HashMap;

/// What a rule is about. Directories are deliberately absent — the rim already draws a
/// directory's distribution, and every directory rule anyone proposes is a sentence it
/// draws better. See the note; the trigger for revisiting it is a clause about SPREAD,
/// which is not this grammar.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Pop {
    Func,
    File,
}

/// How far a field reaches — see [`Field::scope`].
///
/// **Three, and only the last one is special.** A subject-scope clause is a
/// question about the body in front of it and narrows a list; a repo-scope clause is the same
/// answer for every subject and decides whether the rule applies here at all. `headcount <= 1`
/// is a finding on a repo of forty people and a tautology on a repo of one, and the only way
/// a rule can say which repo it is for is to ask about the repo.
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Scope {
    Subject,
    /// The file a function lives in. **A filter, not a gate** — two functions in different
    /// files carry different values, so it narrows a list the way a subject clause does and
    /// counts against the cap, calibrates and has a distribution. What it changes is only
    /// where the picker offers it: "how big is this body" and "how big is the file it is in"
    /// are different questions and a flat list said they were one.
    File,
    Repo,
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
    /// How hard the reader found it going — **high is worse**, which is why it is not called
    /// `legible`.
    ///
    /// The value is `Grade::surprise()`: `Full` is 0.08 and `None` is 0.92. Under the old name
    /// a rule read `legible >= 0.6` and meant "hard to read", which is the name saying the
    /// opposite of the number. Every other field here is honest about its direction —
    /// `documented` high is well documented, `surprise` high is more surprising — so the fix
    /// is the name rather than the scale.
    Legible,
    /// How many people's lines are standing in this body — see `Node::headcount`.
    ///
    /// **The one field with no lens behind it, and that is deliberate.** Every other field
    /// here is a quantity the map already paints, on the rule that a finding is a place two
    /// PICTURES disagree. This one is the third reduction of blame's line list, and blame
    /// paints names rather than counts: a ramp of headcounts under a categorical lens would
    /// be a fourth thing on a switch that has three, and the number's value is as a CLAUSE
    /// rather than as a colouring. `read` is already the precedent — a field with no lens,
    /// because an absence of readings is not a picture.
    ///
    /// **And it is the shape the two held blame rules need.** A rule may not name a person —
    /// that is a rule about what a thing is CALLED, which this grammar refuses — but it can
    /// count them: `headcount <= 1 and callers >= 20` is *load-bearing, and only one person
    /// has been in it*, with nobody named anywhere. See `TODO.md`.
    Headcount,
    /// How long the file this function lives in is, and how many functions it holds.
    ///
    /// **The file a body sits in is context the body cannot report.** A 200-line function is
    /// one thing in a file of forty and another when it IS the file — the same measurement,
    /// two different findings — and `loc` alone cannot tell them apart because it is a fact
    /// about the body and this is a fact about where it lives.
    ///
    /// Scope `File` rather than `Repo`: these vary from subject to subject, so they narrow a
    /// list rather than gating a rule, and everything except the picker treats them as
    /// ordinary. Offered on function rules only — on a file rule `loc` and `funcs` already
    /// say this, and two names for one number is where a grammar starts lying.
    FileLoc,
    FileFuncs,
    /// How many people have lines standing in the file this function lives in.
    ///
    /// **The pairing is the finding.** `headcount <= 1 and file_headcount >= 6` is a body one
    /// person has touched inside a file six people work in — a pocket somebody owns alone in
    /// shared territory, which neither number says on its own and which the repo-wide count
    /// cannot see either.
    FileHeadcount,
    /// How many people have lines standing anywhere in THIS REPO — see `ScanStats::headcount`.
    ///
    /// **The first field that is not about the subject, and the grammar had to learn the
    /// difference.** `callers`, `headcount` and this are all facts about the repo, measured
    /// over three extents: a function's call sites, a function's lines, the whole tree. What
    /// makes this one different is that every subject has the same value — so it is a GATE
    /// rather than a filter, and four things that assume a clause narrows have to know:
    /// `Spreads` (one value is not a distribution), `calibrate` (sorting identical values is a
    /// no-op that would report a suggestion), the vacuity guard (true of all or none is what
    /// this field IS, not a mistake) and the picker (choosing one is a different act). See
    /// `Field::scope`.
    ///
    /// **Not a lifecycle fact.** `blocked` says "this repo has not been read yet" — sanity's own
    /// progress, and every one of its sentences names work that would fix it. *This repo has
    /// two contributors* is not that: no pass changes it. Keeping the two lists apart is what
    /// stops the actionable one from stopping being actionable.
    RepoHeadcount,
    /// How many days this repo has existed — see `ScanStats::age_days`.
    ///
    /// **The denominator every age rule is missing.** `age >= 1825` means "no commit has
    /// changed this in five years", which is a finding in a decade-old repo and an
    /// impossibility in an eighteen-month-old one — where it does not fire, and the silence
    /// reads as a clean bill. `repo_age >= 1095 and age >= 1825` is the rule saying which
    /// repos it is for.
    RepoAge,
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
            "clone_count" | "clone_size" | "clones" => Field::CloneSize,
            "cognitive" => Field::Cognitive,
            "tangle" | "complexity" => Field::Tangle,
            "age" | "age_days" => Field::AgeDays,
            "touched" | "touched_days" => Field::TouchedDays,
            "commits" | "churn" => Field::Commits,
            "read" => Field::Read,
            "surprise" => Field::Surprise,
            "documented" | "docs" => Field::Documented,
            // `legible` is accepted and means the same thing: it is what this field was
            // called in files written before the name was found to be backwards.
            "illegible" | "legible" => Field::Legible,
            "headcount" | "hands" => Field::Headcount,
            "file_loc" | "file_lines" => Field::FileLoc,
            "file_funcs" => Field::FileFuncs,
            "file_headcount" => Field::FileHeadcount,
            "repo_headcount" => Field::RepoHeadcount,
            "repo_age" => Field::RepoAge,
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
            Field::CloneSize => "clone_count",
            Field::Cognitive => "cognitive",
            Field::Tangle => "tangle",
            Field::AgeDays => "age",
            Field::TouchedDays => "touched",
            Field::Commits => "commits",
            Field::Read => "read",
            Field::Surprise => "surprise",
            Field::Documented => "documented",
            Field::Legible => "illegible",
            Field::Headcount => "headcount",
            Field::FileLoc => "file_loc",
            Field::FileFuncs => "file_funcs",
            Field::FileHeadcount => "file_headcount",
            Field::RepoHeadcount => "repo_headcount",
            Field::RepoAge => "repo_age",
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
            // Blame paints NAMES; this is a count of them, which no lens draws. See the
            // variant, where the case for leaving it lensless is made.
            // `file_loc` and `file_funcs` ARE the size lens, one scope out: the wedge a
            // function sits in is the file, and that is the thing being asked about.
            Field::FileLoc | Field::FileFuncs => "size",
            Field::RepoAge => "age",
            Field::Headcount | Field::FileHeadcount | Field::RepoHeadcount | Field::Read => {
                return None
            }
        })
    }

    /// Every field a clause may name, in the order a picker should offer them.
    ///
    /// **One list, and the compiler keeps its length honest.** A thirteenth field added to the
    /// enum and forgotten here would be a question the evaluator can answer and the form
    /// cannot ask — invisible, because nothing fails.
    /// How many fields there are, including the one `ALL` leaves out.
    ///
    /// **The array in `Facts` is indexed by discriminant, so this must cover every variant**,
    /// not just the ones a form offers. `Trap` is absent from `ALL` and present here; a count
    /// taken from `ALL.len()` would index out of bounds the first time a trap was measured.
    pub const COUNT: usize = 21;

    pub const ALL: [Field; 20] = [
        Field::Loc,
        Field::Funcs,
        Field::Callers,
        Field::Calls,
        Field::CloneSize,
        Field::Cognitive,
        Field::Tangle,
        Field::AgeDays,
        Field::TouchedDays,
        Field::Commits,
        Field::Headcount,
        Field::FileLoc,
        Field::FileFuncs,
        Field::FileHeadcount,
        Field::RepoHeadcount,
        Field::RepoAge,
        Field::Read,
        Field::Surprise,
        Field::Documented,
        Field::Legible,
    ];

    /// Which population this field says anything about, or `None` for both.
    ///
    /// `funcs` counts what a FILE holds and means nothing on a function; everything a reader
    /// graded is per function, because a reading is of a body.
    pub fn pop(self) -> Option<Pop> {
        match self {
            Field::Funcs => Some(Pop::File),
            // **`headcount` answers for a file too, and did not always.** It was function-only
            // on the argument that a file's lines are its functions' lines pooled — which is
            // true of inferring a FUNCTION's count from its file, and not true of the file's
            // own. A file's headcount is everyone with a line standing anywhere in it,
            // including the imports and the wiring between declarations, and the node carries
            // it measured rather than derived. So a file rule may ask.
            //
            // The `file_*` three stay function-only: on a file rule they would be a second
            // name for `loc`, `funcs` and `headcount`, and two names for one number is where a
            // grammar starts lying.
            Field::FileLoc
            | Field::FileFuncs
            | Field::FileHeadcount
            | Field::Read
            | Field::Surprise
            | Field::Documented
            | Field::Legible
            | Field::Trap => Some(Pop::Func),
            _ => None,
        }
    }

    /// What this field is measured OVER, which is not the same question as which population
    /// Is this field a 0..1 grade rather than something counted?
    ///
    /// Only calibration asks, and only to decide how much precision a threshold deserves —
    /// two places on a ramp whose whole range is one, and none on a count of lines, days or
    /// people, where a fraction is an artefact of landing between two subjects.
    pub fn graded(self) -> bool {
        matches!(self, Field::Tangle | Field::Surprise | Field::Documented | Field::Legible)
    }

    /// it can be asked of.
    ///
    /// **`pop` says which subjects a rule is about; this says how far a field reaches.** They
    /// were the same thing while every field was a measurement of the subject in front of it.
    /// `repo_headcount` is the first that is not — a fact about the whole tree, the same for
    /// every subject — and everything that assumes a clause NARROWS has to be able to tell.
    pub fn scope(self) -> Scope {
        match self {
            Field::RepoHeadcount | Field::RepoAge => Scope::Repo,
            Field::FileLoc | Field::FileFuncs | Field::FileHeadcount => Scope::File,
            _ => Scope::Subject,
        }
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
    /// Every operator, in the order a picker should offer them.
    pub const ALL: [Op; 4] = [Op::Ge, Op::Gt, Op::Le, Op::Lt];

    pub fn parse(s: &str) -> Option<Op> {
        Some(match s {
            ">=" => Op::Ge,
            ">" => Op::Gt,
            "<=" => Op::Le,
            "<" => Op::Lt,
            _ => return None,
        })
    }

    pub fn name(self) -> &'static str {
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
    pub id: String,
    /// What it is called on screen. Free to change.
    pub title: String,
    /// What to do about it, in one clause. The short form: a tag's tooltip, a CLI column, and
    /// the fallback when [`Rule::says`] cannot be filled.
    pub so_what: String,
    /// What to say about ONE subject, with `{{token}}` holes for its own numbers.
    ///
    /// **A tile's paragraph is the thing somebody can act on without having read the
    /// catalog.** "Tangled for its size" is a label you have to already know; "for 340 lines
    /// this branches more than almost anything else here" is a finding. The numbers have to
    /// come from the subject or the sentence is a template pretending to be a reading — see
    /// [`render`], which refuses rather than guessing.
    pub says: String,
    /// The part of a rule's paragraph that is the same on every subject.
    ///
    /// **A finding is a measurement and a lesson, and only the measurement is new.** The two
    /// were one string, so a repo with three crowded files printed *whether they belong
    /// together is a judgement about what they do, which nothing here has made* three times,
    /// each under its own count. The lesson is worth reading once and is noise on the second
    /// tile — it says nothing about THIS file, and it pushes the next measurement off the
    /// screen.
    ///
    /// So the split is by what varies: [`Rule::says`] holds every sentence that quotes this
    /// subject's own numbers, and this holds the trailing prose that quotes none. That is a
    /// mechanical test rather than a taste one — a `{{token}}` here would be a sentence that
    /// changes per subject shown on one subject and hidden on the rest — and it is why some
    /// rules have no background at all: where the whole paragraph is about the subject,
    /// nothing repeats and nothing is held back.
    ///
    /// The window shows it under the FIRST tile a rule appears on, which is the one somebody
    /// reads first. See `Findings.tsx`.
    pub background: String,
    pub pop: Pop,
    pub clauses: Vec<Clause>,
    /// Which clause [`calibrate`] suggests a threshold for. The others are held.
    pub calibrated: usize,
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
        // **The cap counts SUBJECT clauses, because it is a cap on what a tile has to say.**
        // A tile names the lenses that raised it and carries a sentence about them, and past
        // some width that stops being a sentence — that is the whole argument for a limit. A
        // repo-scope clause contributes no lens and no phrase: it decides whether the rule
        // applies here, and then it is done. Counting it would spend a body's clause on a
        // question about the repo. See `Field::scope`.
        let body = clauses.iter().filter(|c| c.field.scope() == Scope::Subject).count();
        if clauses.is_empty() || body > 3 {
            return Err("a rule is one to three clauses".into());
        }
        Ok(Rule {
            id: "ad-hoc".to_string(),
            title: "ad-hoc".to_string(),
            so_what: "Matched an ad-hoc rule.".to_string(),
            says: String::new(),
            background: String::new(),
            pop,
            clauses,
            calibrated: 0,
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
    // **The short form, verbatim.** It was stored as a lowercase fragment and capitalised
    // here, because several rules' sentences were once joined into one paragraph and a
    // fragment joins better. That paragraph is gone — every rule has its own heading now — so
    // the fragment form was a transformation with nothing left to justify it, and a store full
    // of half-sentences to read in a diff.
    let plain = || {
        if rule.so_what.is_empty() {
            return Vec::new();
        }
        vec![Span { text: rule.so_what.clone(), filled: false }]
    };
    // **No template is the same as one that cannot be filled.** A rule somebody wrote may not
    // have a tailored sentence — `says` is optional — and walking an empty one produces an
    // empty sentence rather than the short form, so the tile drew a title with nothing under
    // it. Every test passed; the output was useless.
    if rule.says.is_empty() {
        return plain();
    }
    let mut out: Vec<Span> = Vec::new();
    let mut push = |text: &str, filled: bool| {
        if !text.is_empty() {
            out.push(Span { text: text.to_string(), filled });
        }
    };
    let mut rest = rule.says.as_str();
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
            // **Two dates, two tokens, and they are not interchangeable.** `age` is days
            // since the OLDEST surviving line was written — how long the body has existed —
            // and `touched` is days since the newest one changed. A single `age_years` token
            // reading `age` sat under the sentence "no commit has changed it in N years",
            // which is what `touched` measures: a 4,313-line body with 52 contributors is
            // nineteen years OLD and was edited last week, and the tile said nobody had
            // touched it since 2006.
            "age_years" => value_of(f, Field::AgeDays).map(years),
            "touched_years" => value_of(f, Field::TouchedDays).map(years),
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
    /// **A slot per field, not a map.** It was `HashMap<&'static str, f32>`, which is a
    /// separate allocation and a hash per lookup for a record that has fifteen possible
    /// fields and knows all of them at compile time — and there is one of these per subject,
    /// so kibana carried 180,000 of them. `Field` is a fieldless enum, so its discriminant IS
    /// the index; the array costs sixty bytes inline and answers without hashing.
    values: [Option<f32>; Field::COUNT],
}

impl Facts {
    fn get(&self, f: Field) -> Option<f32> {
        self.values[f as usize]
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
    /// How many people have lines standing in this repo — see `Field::RepoHeadcount`.
    ///
    /// **Carried here because it is repo-level context and this is the repo-level context
    /// that reaches `subjects`.** It is a FACT rather than a lifecycle flag, unlike the three
    /// beside it, and that difference matters where they are read: the flags say what has not
    /// been done and `blocked` turns them into work; this says what the repo IS and no pass
    /// changes it.
    pub headcount: u32,
    /// How many days this repo has existed — see `Field::RepoAge`. A fact like `headcount`
    /// beside it, not a lifecycle flag.
    pub age_days: u32,
    /// Whether blame was read per LINE, which is `Depth::Lines` and not `Depth::Files`.
    ///
    /// **Its own flag because it gates a different question.** The log gives every file an
    /// age, a churn and a last author; only blame gives a FUNCTION a headcount, and a repo
    /// traced to files has git in every sense the other two fields mean and none of the sense
    /// this one does. Without the distinction a headcount rule on a log-traced repo finds
    /// nothing and says nothing, which is silence standing in for a clean bill.
    pub blamed: bool,
}

/// What a finding is never about, and why.
///
/// **Excluding by path is not the same as a rule about paths.** The grammar refuses
/// `path contains "/test/"` as a clause, and it should: a rule is a statement about what was
/// MEASURED, and the moment names are measurable the catalog fills up with them. This is the
/// other thing — deciding what the instrument is pointed at, which is what `.sanityignore`
/// already does and what every scanner needs.
///
/// It was measured on kibana, where the top ten findings were a generated ANTLR parser, a
/// `.gen.ts` client, three test suites and four data literals. Two of ten were worth reading.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum NotOurs {
    /// `.sanityignore` matched it. `Node::excluded` is computed and was being ignored here.
    Excluded,
    /// Nobody wrote it, so nobody is going to split it up.
    Generated,
    /// **A test's job is different.** A long suite is normal, a surprising body is the point,
    /// and an undocumented one is fine — so every rule in the catalog means something else
    /// here. Findings about test code would be a different catalog, not a subset of this one.
    Test,
}

/// Whether this file is somebody's own code, and if not, why not.
///
/// Conservative on purpose: a directory called `build` is as likely to be source as output,
/// and a false exclusion is a finding nobody is ever told about.
pub fn not_ours(path: &str, excluded: bool) -> Option<NotOurs> {
    if excluded {
        return Some(NotOurs::Excluded);
    }
    let (dirs, file) = match path.rsplit_once('/') {
        Some((d, f)) => (d, f),
        None => ("", path),
    };
    let segs: Vec<&str> = dirs.split('/').collect();
    if segs
        .iter()
        .any(|s| matches!(*s, "generated" | "__generated__" | "antlr" | "vendor" | "node_modules"))
        || file.contains(".gen.")
        || file.contains(".pb.")
        || file.contains("_pb2.")
        || file.contains(".min.")
    {
        return Some(NotOurs::Generated);
    }
    if segs.iter().any(|s| matches!(*s, "test" | "tests" | "__tests__" | "spec" | "e2e"))
        || file.contains(".test.")
        || file.contains(".spec.")
        || file.contains("_test.")
        || file.contains("_spec.")
        || file.starts_with("test_")
    {
        return Some(NotOurs::Test);
    }
    None
}

/// Whether an owner chain runs through a module that holds tests.
///
/// The chain is dotted — `tests.Foo` for an impl inside `mod tests` — so this asks about any
/// link in it rather than the whole string.
pub fn in_a_test_module(owner: &str) -> bool {
    owner.split('.').any(|seg| matches!(seg, "tests" | "test"))
}

/// How many files each reason took out of the population.
#[derive(Debug, Default, Clone, Copy, serde::Serialize)]
pub struct Skipped {
    pub excluded: usize,
    pub generated: usize,
    pub tests: usize,
}

impl Skipped {
    pub fn any(self) -> bool {
        self.excluded + self.generated + self.tests > 0
    }
}

/// What was left out, counted so it can be said rather than merely done.
pub fn skipped(root: &Node) -> Skipped {
    fn walk(n: &Node, out: &mut Skipped) {
        match n.kind {
            NodeKind::Dir => n.children.iter().for_each(|c| walk(c, out)),
            NodeKind::File => match not_ours(&n.path, n.excluded) {
                Some(NotOurs::Excluded) => out.excluded += 1,
                Some(NotOurs::Generated) => out.generated += 1,
                Some(NotOurs::Test) => out.tests += 1,
                None => {}
            },
            NodeKind::Func => {}
        }
    }
    let mut out = Skipped::default();
    walk(root, &mut out);
    out
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
            // **Not a subject at all, rather than a subject every rule happens to miss.**
            // Leaving them in would put them in the medians as well — kibana's median file
            // "defines 1 function" partly because its generated clients define hundreds and
            // its tests define none — so a sentence quoting normal would be quoting them.
            if not_ours(&node.path, node.excluded).is_some() {
                return;
            }
            out.push(facts_of(node, &node.path, None, traced, None));
            // What every function under it is asked about the file it is in. Counted here
            // rather than read off `Node::funcs`, which is zero on a full tree — the same
            // trap `Field::Funcs` records, one caller over.
            let held = node.children.iter().filter(|c| c.kind == NodeKind::Func).count() as u32;
            let within = Some((node.loc, held.max(node.funcs), node.headcount));
            let mut seen: HashMap<&str, usize> = HashMap::new();
            for c in &node.children {
                if c.kind != NodeKind::Func {
                    continue;
                }
                let ord = seen.entry(c.name.as_str()).or_insert(0);
                let key = crate::assessment::key_of(&node.path, &c.name, *ord);
                *ord += 1;
                // **A Rust unit test is a function-level exclusion, not a file-level one.**
                // It lives in the file it tests, so `not_ours` cannot see it from the path;
                // what reaches the tree is the enclosing module, which is why `mod_item` is an
                // owner. Everything else this catches is already gone by file.
                if c.owner.as_deref().is_some_and(in_a_test_module) {
                    continue;
                }
                let report = reports.get(&key).filter(|r| !r.stale);
                out.push(facts_of(c, &key, report, traced, within));
            }
        }
        // A function reached without its file is a tree shape this does not expect; skipping
        // is right rather than guessing an ord, because a wrong ord is a wrong key and a
        // wrong key silently reads as unread.
        NodeKind::Func => {}
    }
}

fn facts_of(
    node: &Node,
    key: &str,
    report: Option<&Report>,
    traced: Traced,
    // The file this body lives in — its lines and how many functions it holds. `None` for a
    // file, which IS that file: `loc` and `funcs` already say it, and a second name for one
    // number is where a grammar starts lying.
    within: Option<(u32, u32, Option<u32>)>,
) -> Facts {
    let mut v: [Option<f32>; Field::COUNT] = [None; Field::COUNT];
    let mut set = |f: Field, x: Option<f32>| {
        if let Some(x) = x {
            v[f as usize] = Some(x);
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
    if let Some((loc, funcs, hands)) = within {
        set(Field::FileLoc, Some(loc as f32));
        set(Field::FileFuncs, Some(funcs as f32));
        set(Field::FileHeadcount, hands.map(|h| h as f32));
    }
    set(Field::Callers, node.callers.map(|x| x as f32));
    // **`None` and never zero where blame has not read this range.** A zero would be a claim
    // that nobody's lines are here, which is a confident answer to a question nobody asked —
    // and `headcount <= 1` would then be true of every function in an untraced repo. The
    // absence stays an absence; `blocked` is what says why.
    set(Field::Headcount, node.headcount.map(|x| x as f32));
    // The same value on every subject, which is what a gate is. `None` rather than zero where
    // blame has not run, so the clause cannot be quietly true of a repo nobody has measured.
    set(Field::RepoHeadcount, (traced.headcount > 0).then_some(traced.headcount as f32));
    set(Field::RepoAge, (traced.age_days > 0).then_some(traced.age_days as f32));
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

/// Days as years, at the precision a year deserves: whole once it is a decade, one place
/// under that. Shared by the two date tokens so they cannot print differently.
fn years(days: f32) -> String {
    let y = days / 365.0;
    if y >= 10.0 {
        format!("{}", y.round() as i64)
    } else {
        format!("{y:.1}")
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
    decided: &HashMap<&str, HashMap<&str, (Verdict, &str)>>,
) -> (Vec<&'a Subject>, usize) {
    let mut keep: Vec<(&Subject, bool)> = Vec::new();
    let mut settled = 0usize;
    for f in facts.iter().filter(|f| matches(rule, f)) {
        let mut flagged = false;
        if let Some((verdict, pin)) =
            decided.get(f.subject.key.as_str()).and_then(|by_rule| by_rule.get(rule.id.as_str()))
        {
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

/// The archive as the evaluator wants it: subject, then rule id.
///
/// **Nested rather than keyed on a `(String, String)` pair**, because a tuple key cannot be
/// looked up without building one. Matching a subject against a rule happens once per subject
/// per rule — 147,906 × 15 on kibana — and a pair key made two `String`s every time to ask a
/// question whose answer is almost always "there is no decision".
pub fn pinned(archive: &[Decision]) -> HashMap<&str, HashMap<&str, (Verdict, &str)>> {
    let mut out: HashMap<&str, HashMap<&str, (Verdict, &str)>> = HashMap::new();
    for d in archive {
        out.entry(d.key.as_str()).or_default().insert(d.rule.as_str(), (d.verdict, d.pin.as_str()));
    }
    out
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
    // **A gate cannot be calibrated, and failing loudly is not the answer either.** Every
    // subject carries the same value for a repo-scope field, so the sort below would return
    // that value and report it as a suggestion — a number that changes nothing, offered as
    // though it were tuning. See `Field::scope`.
    if c.field.scope() == Scope::Repo {
        return None;
    }
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
/// How many of each rule's hits no other rule also found.
///
/// **This, not the hit count, is what a rule is titrated against.** "Long and undocumented"
/// scored 3,455 hits on kibana and was worthless, because 18 of its top 20 were already in
/// "giant function" — a rule whose marginal contribution is near zero is a second name for
/// a list you already have. See the note, which cut it on this number.
///
/// **Identified by POSITION, never by title.** Two ad-hoc rules off the command line are
/// both called "ad-hoc", and a title comparison quietly excluded each from the other's
/// "others" — so two rules matching the same bodies each reported every hit as unique,
/// which is the exact opposite of what this number is for.
///
/// **Counted once for the whole catalog, not once per rule.** This was a function that
/// rebuilt the union of every OTHER rule's hits from scratch each time it was asked:
/// quadratic in the catalog and linear in the hits, which on a repo where rules find
/// thousands apiece is tens of millions of string hashes to produce eighteen numbers. It was
/// most of an eight-second project switch on ceph. A subject that exactly one rule found is
/// a subject with a count of one — that is the whole insight, and it turns the thing into one
/// pass over the hits plus a lookup per hit.
///
/// It takes the hit lists rather than the rules for the same family of reason: recomputing
/// them here turned one call into ninety filter-and-sorts of kibana's 147,906 subjects.
pub struct Marginal<'a> {
    /// How many rules found each subject. Keyed on `Subject::key`, which is what a rule's
    /// hits are identified by everywhere else — never a node id.
    seen: HashMap<&'a str, u32>,
}

impl<'a> Marginal<'a> {
    pub fn of(sets: &[Vec<&'a Subject>]) -> Marginal<'a> {
        let mut seen: HashMap<&'a str, u32> = HashMap::new();
        for set in sets {
            for s in set {
                *seen.entry(s.key.as_str()).or_insert(0) += 1;
            }
        }
        Marginal { seen }
    }

    /// What rule `at` contributes that nothing else does.
    pub fn only(&self, at: usize, sets: &[Vec<&Subject>]) -> usize {
        let Some(mine) = sets.get(at) else { return 0 };
        mine.iter().filter(|s| self.seen.get(s.key.as_str()) == Some(&1)).count()
    }
}

/// Every rule's hits, once. The input to [`marginal`], and to anything that draws a group.
pub fn all_hits<'a>(rules: &[Rule], facts: &'a [Facts]) -> Vec<Vec<&'a Subject>> {
    rules.iter().map(|r| hits(r, facts)).collect()
}

/// One field, as the form offers it, and what normal looks like for it here.
///
/// **The picker is built from `Field::ALL`, so a fifteenth field cannot be added without
/// appearing in it.** The alternative — a list in the frontend — is the same list written
/// twice, and the copy nobody compiles is the one that goes stale.
#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FieldView {
    pub name: &'static str,
    /// What it is measured over — see `Field::scope`. The picker groups on it: a fact about
    /// this function and a fact about the repo it lives in are different KINDS of choice, and
    /// a flat list of sixteen names says they are the same one.
    pub scope: Scope,
    /// The lens that paints it, or null. `read` has none: an absence of readings is not a
    /// lens, and colouring it as one invents a picture that is not drawn anywhere.
    pub lens: Option<&'static str>,
    /// The population it can only be asked of, or null for both. A form that offers `funcs`
    /// on a function rule is offering a clause the backend will refuse.
    pub pop: Option<Pop>,
    /// Tier 2: this field is silent until somebody has run `sanity check` here.
    pub needs_reading: bool,
    /// What normal is, for each population the field applies to. Null where nothing in this
    /// repo has a value — which is itself the answer, and the reason a number typed against
    /// it would be a guess.
    pub func: Option<Spread>,
    pub file: Option<Spread>,
}

/// One walk's worth of answers — what the panel, the grid and the creature all read.
///
/// Named `ProjectReport` rather than `Report`, which in this file is a READER's report — the
/// thing a model sends back about one function. Two Reports in one module is the kind of
/// collision that gets resolved by whichever import is written last.
///
/// **Together because they are one answer about one repo.** They were three commands and
/// three walks of the tree; the counts in the grid, the tiles in the list and the number on
/// the mascot are the same measurement seen three ways, and issuing them separately was both
/// three times the work and three chances to describe different states of the same repo.
#[derive(Clone, serde::Serialize, Default)]
pub struct ProjectReport {
    pub groups: Vec<Group>,
    pub rules: Vec<RuleView>,
    pub grammar: Grammar,
}

/// Every field and every operator, with what this repo makes of them.
#[derive(Clone, serde::Serialize, Default)]
pub struct Grammar {
    pub fields: Vec<FieldView>,
    pub ops: Vec<&'static str>,
}

/// The grammar, measured against one repo.
pub fn grammar(facts: &[Facts]) -> Grammar {
    Grammar {
        fields: Field::ALL
            .iter()
            .map(|&f| FieldView {
                name: f.name(),
                scope: f.scope(),
                lens: f.lens(),
                pop: f.pop(),
                needs_reading: f.needs_reading(),
                func: (f.pop() != Some(Pop::File)).then(|| spread(facts, Pop::Func, f)).flatten(),
                file: (f.pop() != Some(Pop::Func)).then(|| spread(facts, Pop::File, f)).flatten(),
            })
            .collect(),
        ops: Op::ALL.iter().map(|o| o.name()).collect(),
    }
}

/// The distribution of one field, for the calibration hint beside a threshold box.
#[derive(Clone, serde::Serialize)]
pub struct Spread {
    pub n: usize,
    pub median: f32,
    pub p95: f32,
    pub max: f32,
}

/// Every distribution a set of rules will ask for, computed once.
///
/// **`rules_view` was sorting the repo once per CLAUSE.** Eighteen rules of one to three
/// clauses is fifty-odd `spread` calls, each a filter and a sort over every function in the
/// repo — 738ms of a one-second answer on a repo ceph's size, to produce about fifteen
/// distinct answers. A field's distribution does not depend on which rule is asking.
///
/// Keyed on `(pop, field)` because that is what a spread is OF. The population count comes
/// with it: it is the same walk, and `RuleView::population` needed its own pass otherwise.
pub struct Spreads {
    by: HashMap<(Pop, &'static str), Option<Spread>>,
    pub funcs: usize,
    pub files: usize,
}

impl Spreads {
    pub fn of(facts: &[Facts], rules: &[Rule]) -> Spreads {
        let mut by = HashMap::new();
        for r in rules {
            for c in &r.clauses {
                // A repo-scope field has one value across every subject, so its median is that
                // value and its spread is nothing. Left out rather than computed: the row
                // shows a gate as a fact, not as a distribution somebody could tune against.
                if c.field.scope() == Scope::Repo {
                    continue;
                }
                by.entry((r.pop, c.field.name())).or_insert_with(|| spread(facts, r.pop, c.field));
            }
        }
        Spreads {
            by,
            funcs: facts.iter().filter(|f| f.subject.kind == NodeKind::Func).count(),
            files: facts.iter().filter(|f| f.subject.kind == NodeKind::File).count(),
        }
    }

    fn get(&self, pop: Pop, field: Field) -> Option<&Spread> {
        self.by.get(&(pop, field.name())).and_then(|s| s.as_ref())
    }

    fn population(&self, pop: Pop) -> usize {
        if pop == Pop::File {
            self.files
        } else {
            self.funcs
        }
    }
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
    /// Why this rule could not answer, or `None` where it could — see [`Blocked`].
    ///
    /// **A rule with an unanswerable clause finds nothing, and nothing looks exactly like a
    /// clean bill.** That is the failure this whole surface is written against, so the
    /// absence is stated rather than drawn as a zero — the same discipline the lens follows
    /// when it says `no git history` on the repo instead of on every wedge.
    pub blocked: Option<Blocked>,
    /// The rule's constant half — see [`Rule::background`]. Empty where it has none.
    ///
    /// On the GROUP rather than on every finding, which is where it would have to be joined
    /// back together: it is one string per rule and the window shows it once.
    pub background: String,
    pub hits: Vec<Finding>,
}

/// Why a rule cannot answer, and the one thing that would let it.
///
/// **Two strings because the two are read at different distances.** `why` is the sentence a
/// rule states about itself, and it belongs where one rule is being looked at. `need` is what
/// somebody would have to DO, and it is what the panel's footer folds by: seven rules blocked
/// on seven sentences that all mean *read the repo* is one job printed seven times, and the
/// count that matters — how much of the catalog one pass would light up — cannot be reached
/// from the sentences without matching on their words.
///
/// Both come out of the same branch in [`blocked`], so they cannot drift into disagreeing
/// about which fix a rule is waiting on.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Blocked {
    pub why: String,
    /// The fix, as a short label rather than a sentence: `read required`, `trace required`,
    /// or `nothing to compare` where no button exists at all.
    pub need: String,
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
pub fn blocked(rule: &Rule, facts: &[Facts], traced: Traced, read: bool) -> Option<Blocked> {
    /// The two buttons, and the absence that is neither. Named here so the branches below
    /// spell the fix the same way every time — a footer that folds by `need` turns a typo
    /// into a second row claiming a second job.
    const READ: &str = "read required";
    const TRACE: &str = "trace required";
    let of = |why: &str, need: &str| {
        Some(Blocked { why: why.into(), need: need.into() })
    };
    for c in &rule.clauses {
        if c.field.needs_reading() && !read {
            return of("this repo has not been read yet", READ);
        }
        let git = matches!(
            c.field,
            Field::AgeDays | Field::TouchedDays | Field::Commits | Field::RepoAge
        );
        if git && !traced.git {
            return of("no git history has been read", TRACE);
        }
        if c.field == Field::Commits && !traced.churned {
            return of("the timeline has not been walked", TRACE);
        }
        // Named rather than left to the catch-all below, which would say "nothing here has a
        // headcount to compare" — true, and no help. This one has a fix and the sentence is
        // where somebody finds out what it is.
        if matches!(c.field, Field::Headcount | Field::FileHeadcount | Field::RepoHeadcount)
            && !traced.blamed
        {
            return of("git history has not been read per line", TRACE);
        }
        // Whatever is left: the field exists for this population and nothing has one. On
        // Callers and Reach that is a language whose call shape was never parsed, which is
        // exactly the gray the map paints rather than a zero.
        if !facts.iter().any(|f| value_of(f, c.field).is_some()) {
            // No button opens this one, so the fix reads as an absence rather than a job —
            // see [`Blocked::need`].
            return of(
                &format!("nothing here has a {} to compare", c.field.name()),
                "nothing to compare",
            );
        }
    }
    None
}

/// Run a catalog over a scan, ready for the window.
/// Run a catalog over facts the caller has already built.
///
/// **It walked the tree for itself, and every caller had walked it a moment earlier.** The
/// facts are what `rules_for` calibrates against and what `rules_view` measures, so a command
/// that wants both plus a list built the same 180,000 records twice. Taking them as an
/// argument is also the honest signature: this function reports on a set of subjects, and
/// which tree they came from is the caller's business.
pub fn report(
    facts: &[Facts],
    traced: Traced,
    read: bool,
    rules: &[Rule],
    archive: &[Decision],
) -> Vec<Group> {
    let pins = pinned(archive);
    // Dismissed findings are gone before this runs, not after: a rule whose every finding
    // somebody has set aside contributes nothing NOW, which is what the number is asked for.
    // One median per rule, over the population its calibrated clause measures — the
    // comparison its sentence quotes. Computed here rather than per finding: it is a property of
    // the repo, and a sort of every value for every row is the cost this avoids.
    let spreads = Spreads::of(facts, rules);
    let medians: Vec<Option<f32>> = rules
        .iter()
        .map(|r| {
            r.clauses.get(r.calibrated).and_then(|c| spreads.get(r.pop, c.field)).map(|s| s.median)
        })
        .collect();
    let by_key: HashMap<&str, &Facts> = facts.iter().map(|f| (f.subject.key.as_str(), f)).collect();
    let (sets, aside): (Vec<_>, Vec<_>) = rules.iter().map(|r| live_hits(r, facts, &pins)).unzip();
    let solo = Marginal::of(&sets);
    rules
        .iter()
        .enumerate()
        .map(|(i, rule)| Group {
            id: rule.id.clone(),
            title: rule.title.clone(),
            so_what: rule.so_what.clone(),
            tier: rule.tier(),
            expr: rule.expr(),
            total: sets[i].len(),
            dismissed: aside[i],
            only: solo.only(i, &sets),
            lenses: rule.lenses(),
            blocked: blocked(rule, facts, traced, read),
            background: rule.background.clone(),
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
                        .get(s.key.as_str())
                        .and_then(|by_rule| by_rule.get(rule.id.as_str()))
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

/// One rule as the editor sees it: what it asks, what it finds here, and what this repo
/// would suggest instead.
///
/// **Structured clauses, not the rendered `expr`.** `func: loc >= 257` is the right thing to
/// show and the wrong thing to populate three controls from — a form that parsed the string
/// it had just been given back would be a second parser, disagreeing with the first the day
/// somebody adds an operator.
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuleView {
    pub id: String,
    pub title: String,
    pub so_what: String,
    pub says: String,
    pub pop: Pop,
    pub clauses: Vec<ClauseView>,
    pub calibrated: usize,
    pub tier: u8,
    pub expr: String,
    pub lenses: Vec<String>,
    /// False where this repo's file says `off`. The rule is still listed — a silenced rule
    /// somebody has to go and find again is a rule they will not turn back on.
    pub on: bool,
    /// True where the catalog ships it. A rule of somebody's own can be deleted; a built-in
    /// can only be silenced, because a later release would bring it back anyway.
    pub built_in: bool,
    /// What it finds here, now — and how much of that nothing else found.
    pub hits: usize,
    /// How many subjects this rule's population HAS here.
    ///
    /// **The denominator, because a count with no share is half a fact.** Sixteen hundred
    /// findings is a rule working on kibana and a rule that has stopped discriminating on a
    /// repo with four thousand functions — the number is the same and the two are opposite.
    /// Sent rather than derived in the window, which cannot see the population at all.
    pub population: usize,
    pub only: usize,
    /// Why it cannot answer here, in words, or `None`.
    ///
    /// The SENTENCE alone — see [`Blocked`]. The editor shows one rule at a time, which is
    /// exactly the distance at which the short form says less than the sentence does.
    pub blocked: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClauseView {
    pub field: String,
    pub op: String,
    pub value: f32,
    /// The lens this clause is painted by, if any — see [`Field::lens`].
    ///
    /// **Per clause, not per rule.** `RuleView::lenses` is the deduped set for a chip row; a
    /// grid that colours the field NAMES inside the expression needs to know which colour goes
    /// with which word, and `read` needs to come back with none: an absence of readings is not
    /// a lens, and a word coloured as though it were would be inventing one.
    ///
    /// **Outbound only, hence the default.** This and the two below are what the backend
    /// measured about a clause; a form sending a clause back has nothing to say about them
    /// and must not have to invent nulls to be heard. Not a format change — the cached
    /// record is the Markdown in `.sanity/rules/`, which never carried these.
    #[serde(default)]
    pub lens: Option<String>,
    /// What this field's normal looks like across the rule's population.
    ///
    /// **On the clause, because it is a fact about the FIELD.** It sat on the rule, which
    /// meant one arbitrary clause's median described in prose beside the expression — "median
    /// here is 1", of what, and why that one. A number about `callers` belongs where `callers`
    /// is written.
    #[serde(default)]
    pub median: Option<f32>,
    /// The bar this repo would suggest for this clause, where that is not the bar it has.
    /// Only ever on the clause [`Rule::calibrated`] names.
    #[serde(default)]
    pub suggestion: Option<f32>,
}

/// Every rule this repo runs, plus the ones its file has silenced.
///
/// **Silenced rules are included and marked, not omitted.** The editor is where somebody goes
/// to turn one back on, and a list that dropped them would make that impossible from the one
/// screen built for it.
pub fn rules_view(
    repo: &std::path::Path,
    facts: &[Facts],
    traced: Traced,
    read: bool,
) -> Vec<RuleView> {
    let saved = saved_rules(repo);
    let live = merge(catalog(), &saved);
    let sets = all_hits(&live, facts);
    let known = catalog();
    // Every distribution these rules will ask for, once — see `Spreads`. The silenced ones
    // are in here too, because they are drawn with their medians like any other row.
    let spreads = Spreads::of(facts, &[&live[..], &known[..]].concat());
    let solo = Marginal::of(&sets);
    let at = Viewing { facts, spreads: &spreads, traced, read, known: &known };

    let mut out: Vec<RuleView> = live
        .iter()
        .enumerate()
        .map(|(i, r)| view_of(r, true, Some((&sets, i, &solo)), &at))
        .collect();

    // The silenced ones, from the catalog and from the file, in the order they would run.
    for k in known.iter() {
        if saved.iter().any(|l| l.id == k.id && l.off) {
            out.push(view_of(k, false, None, &at));
        }
    }
    out
}

/// What every row of the grid is drawn against: one repo, measured once.
///
/// **A struct because the argument list was the smell.** Each of these is here for a reason
/// and none of them belongs to a rule — they are the repo, and passing five of them per row
/// meant every new one touched every call site.
struct Viewing<'a> {
    facts: &'a [Facts],
    spreads: &'a Spreads,
    traced: Traced,
    /// Whether anything here has been read, which is what gates the tier 2 rules.
    read: bool,
    /// The shipped catalog, for telling a rule of somebody's own from one of sanity's.
    known: &'a [Rule],
}

fn view_of(
    r: &Rule,
    on: bool,
    found: Option<(&[Vec<&Subject>], usize, &Marginal)>,
    at: &Viewing,
) -> RuleView {
    let Viewing { facts, spreads, traced, read, known } = *at;
    RuleView {
        id: r.id.clone(),
        population: spreads.population(r.pop),
        title: r.title.clone(),
        so_what: r.so_what.clone(),
        says: r.says.clone(),
        pop: r.pop,
        clauses: r
            .clauses
            .iter()
            .enumerate()
            .map(|(i, c)| ClauseView {
                field: c.field.name().to_string(),
                op: c.op.name().to_string(),
                value: c.value,
                lens: c.field.lens().map(str::to_string),
                median: spreads.get(r.pop, c.field).map(|s| s.median),
                // Only where it would actually be taken: `calibrated` refuses to loosen a
                // rule, so a looser number is one this program would never apply, and
                // offering it invites widening a rule on advice that was never given.
                suggestion: (i == r.calibrated && on)
                    .then(|| calibrate(r, facts, TARGET))
                    .flatten()
                    .filter(|v| match c.op {
                        Op::Ge | Op::Gt => *v > c.value,
                        Op::Le | Op::Lt => *v < c.value,
                    }),
            })
            .collect(),
        calibrated: r.calibrated,
        tier: r.tier(),
        expr: r.expr(),
        lenses: r.lenses(),
        on,
        built_in: known.iter().any(|k| k.id == r.id),
        hits: found.map(|(sets, i, _)| sets[i].len()).unwrap_or(0),
        only: found.map(|(sets, i, solo)| solo.only(i, sets)).unwrap_or(0),
        blocked: blocked(r, facts, traced, read).map(|b| b.why),
    }
}

/// A rule as the form hands it back.
#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RuleEdit {
    /// Empty for a rule being created — [`apply_edit`] mints one from the title.
    #[serde(default)]
    pub id: String,
    pub title: String,
    pub so_what: String,
    #[serde(default)]
    pub says: String,
    pub pop: Pop,
    pub clauses: Vec<ClauseView>,
    #[serde(default)]
    pub calibrated: usize,
    #[serde(default = "yes")]
    pub on: bool,
}

fn yes() -> bool {
    true
}

/// Fold one edit into the rules this repo runs, or say why it is not a rule.
///
/// **Every refusal here is argued in `findings.md`**, and each refuses with a sentence rather
/// than a silent correction: a form that quietly fixed what somebody typed would be teaching
/// them a grammar that is not the one they are writing in.
pub fn apply_edit(live: &mut Vec<Rule>, edit: RuleEdit) -> Result<(), String> {
    if edit.title.trim().is_empty() {
        return Err("a rule needs a title — it is what a decision is filed under".into());
    }
    // Counted the way `Rule::parse` counts it: a gate is not one of the three — see there.
    let body = edit
        .clauses
        .iter()
        .filter(|c| Field::parse(&c.field).map(|f| f.scope()) == Some(Scope::Subject))
        .count();
    if edit.clauses.is_empty() || body > 3 {
        // **Three, and the cap is about precedence rather than about counting.** Conjunction
        // needs none at any width; it is OR that would, and there is no OR. Two was the number
        // while the size guard was a separate `floor` field — see `findings.md`, where making
        // it a clause is argued: a rule that gates on size is asking a size question, and size
        // is a lens like any other.
        return Err("a rule is one to three clauses".into());
    }

    let mut clauses = Vec::new();
    for c in &edit.clauses {
        let field = Field::parse(&c.field).ok_or(format!("`{}` is not a field", c.field))?;
        let op = Op::parse(&c.op).ok_or(format!("`{}` is not an operator", c.op))?;
        if let Some(only) = field.pop() {
            if only != edit.pop {
                return Err(format!(
                    "`{}` says nothing about a {}",
                    c.field,
                    if edit.pop == Pop::File { "file" } else { "function" }
                ));
            }
        }
        // **A threshold no subject can fail is not a threshold.** `trap >= 1 and commits >= 0`
        // was real: the clause is true of everything, the rule quietly becomes single-lens,
        // and the tile goes on naming two.
        // **A gate is true of every subject or of none, and that is the point of it.** The
        // guard below exists because a clause that fails to narrow makes a rule quietly
        // single-lens; a repo-scope clause is not failing to narrow, it is answering a
        // question about the repo. See `Field::scope`.
        if field.scope() == Scope::Repo {
            clauses.push(Clause { field, op, value: c.value });
            continue;
        }
        if matches!(op, Op::Ge) && c.value <= 0.0 && field != Field::Read {
            return Err(format!("`{} {} {}` is true of everything", c.field, c.op, c.value));
        }
        clauses.push(Clause { field, op, value: c.value });
    }

    // **A template may only name what the rule guarantees.** `render` falls back silently when
    // it cannot fill a token, which is right at draw time and wrong here: somebody would write
    // a sentence that never appears and never be told why.
    check_template(&edit.says, &clauses)?;

    let id = if edit.id.is_empty() { mint_id(&edit.title, live) } else { edit.id.clone() };
    // **The background survives an edit it was never on.** It is the rule's constant half —
    // see `Rule::background` — and the form does not carry it, so rebuilding a rule from the
    // form alone would silently drop it the first time somebody renamed a built-in.
    let background =
        live.iter().find(|r| r.id == id).map(|r| r.background.clone()).unwrap_or_default();
    let rule = Rule {
        id: id.clone(),
        title: edit.title.trim().to_string(),
        so_what: edit.so_what.trim().to_string(),
        says: edit.says.trim().to_string(),
        background,
        pop: edit.pop,
        calibrated: edit.calibrated.min(clauses.len() - 1),
        clauses,
    };
    match live.iter().position(|r| r.id == id) {
        Some(at) if edit.on => live[at] = rule,
        Some(at) => {
            live.remove(at);
        }
        None if edit.on => live.push(rule),
        None => {}
    }
    Ok(())
}

/// Refuse a template that names something the rule cannot answer.
fn check_template(says: &str, clauses: &[Clause]) -> Result<(), String> {
    let mut rest = says;
    while let Some(at) = rest.find("{{") {
        let close = rest[at..].find("}}").ok_or("a `{{` with no `}}`")?;
        let token = &rest[at + 2..at + close];
        rest = &rest[at + close + 2..];
        if matches!(token, "name" | "path" | "threshold" | "median") {
            continue;
        }
        // The two date tokens name a field like any other, and have to earn it like any
        // other — see the catalog test, where exempting `age_years` is what let `fossil`
        // print "no commit has changed it in N years" off a clause about how OLD it was.
        let field = match token {
            "age_years" => Field::AgeDays,
            "touched_years" => Field::TouchedDays,
            other => Field::parse(other).ok_or(format!("`{other}` is not a field"))?,
        };
        // `loc` and `funcs` are set on every subject; everything else has to be earned by a
        // clause, or the sentence silently falls back and nobody finds out.
        let always = field == Field::Loc || field == Field::Funcs;
        if !always && !clauses.iter().any(|c| c.field == field) {
            return Err(format!("`{token}` is not something this rule measures"));
        }
    }
    Ok(())
}

/// An id from a title, unique against what is already here.
///
/// **Minted once and never regenerated.** The id is what a decision is filed under, so a rule
/// that re-slugged itself when it was retitled would orphan every decision made with it — the
/// failure `Rule::id` exists to prevent, arriving by another door. Built-in ids are reserved
/// too: a later release adding a rule by this name would merge two different questions and
/// the decisions filed under both.
fn mint_id(title: &str, live: &[Rule]) -> String {
    let base: String =
        title.to_lowercase().chars().map(|c| if c.is_alphanumeric() { c } else { '-' }).collect();
    let mut base = base.trim_matches('-').to_string();
    while base.contains("--") {
        base = base.replace("--", "-");
    }
    if base.is_empty() {
        base = "rule".to_string();
    }
    let taken = |id: &str| live.iter().any(|r| r.id == id) || catalog().iter().any(|r| r.id == id);
    if !taken(&base) {
        return base;
    }
    (2..).map(|n| format!("{base}-{n}")).find(|id| !taken(id)).unwrap_or(base)
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
    // `<=` is used by exactly one rule and is still worth the line: `headcount <= 1` says
    // *one pair of hands*, where `< 2` says the same thing and makes the reader do the
    // arithmetic to find out.
    let le = |field, value| Clause { field, op: Op::Le, value };
    // `background` after `says` because it is the tail of the same paragraph — see
    // `Rule::background`. Empty where every sentence quotes the subject.
    let rule = |id: &str,
                title: &str,
                so_what: &str,
                says: &str,
                background: &str,
                pop,
                clauses,
                calibrated| Rule {
        id: id.to_string(),
        title: title.to_string(),
        so_what: so_what.to_string(),
        says: says.to_string(),
        background: background.to_string(),
        pop,
        clauses,
        calibrated,
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
            "Unusually long, and not just a lot of data.",
            "This is {{loc}} lines with {{cognitive}} branch points, where the median function \
             here is {{median}} lines.",
            "Length on its own is not a defect and does not mean this is several functions — it \
             means anything reading it has to take all of it at once, and breaking it up is the \
             usual thing to try.",
            Pop::Func,
            // **A giant body with no branching is DATA, and this is what stops the rule
            // finding it.** On kibana the top of this list was an index-mapping literal, a
            // table of saved-object types and an i18n string map — 5,337, 1,920 and 1,879
            // lines apiece, every one of them a single object with nothing to follow. They are
            // long and they are not complicated, and nobody is going to split them up.
            //
            // Ten branch points is a low bar on purpose: this is not "tangled", which is its
            // own rule and asks whether the complexity is explained by the length. It is only
            // "there is control flow here at all".
            vec![ge(Field::Loc, 200.0), ge(Field::Cognitive, 10.0)],
            0,
        ),
        rule(
            "crowded-file",
            "Crowded file",
            "Unusually many functions in one file.",
            "This file defines {{funcs}} functions, where the median file here defines {{median}}.",
            "That is a count rather than a verdict: whether they belong together is a judgement \
             about what they do, which nothing here has made.",
            Pop::File,
            vec![ge(Field::Funcs, 40.0)],
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
            "Read this one next.",
            "{{callers}} call sites depend on this and no reader has assessed it.",
            "It is the cheapest assessment available here, in the sense that what one of these \
             turns out to be matters to every call site that depends on it.",
            Pop::Func,
            vec![ge(Field::Callers, 20.0), lt(Field::Read, 1.0), ge(Field::Loc, 10.0)],
            0,
        ),
        rule(
            "knotty-load-bearing",
            "Knotty and load-bearing",
            "Branches a lot, and widely depended on.",
            // Every sentence quotes the subject, so nothing is held back — see
            // `Rule::background`.
            "{{callers}} call sites depend on this, and for {{loc}} lines it branches more than \
             its length accounts for. A change here has to be checked against all {{callers}}.",
            "",
            Pop::Func,
            vec![ge(Field::Tangle, 0.8), ge(Field::Callers, 10.0), ge(Field::Loc, 10.0)],
            1,
        ),
        rule(
            "load-bearing-illegible",
            "Load-bearing and hard to read",
            "Hard to follow, and widely depended on.",
            "A reader assessed this as hard to follow, and {{callers}} call sites depend on it.",
            "Every later edit pays that reading cost again.",
            Pop::Func,
            vec![ge(Field::Legible, 0.6), ge(Field::Callers, 10.0), ge(Field::Loc, 10.0)],
            1,
        ),
        // **`documented` runs HIGH for well documented**, so this clause is `lt` — written as
        // `ge` first, which quietly asked for load-bearing code somebody had already
        // explained. A rule can be exactly backwards and still return a plausible list, which
        // is the failure mode this whole surface is built around: nothing crashes, the tiles
        // look right, and the sentence on them is false.
        rule(
            "load-bearing-undocumented",
            "Load-bearing and undocumented",
            "Widely depended on, with nothing written about it.",
            "{{callers}} call sites depend on this and there is no documentation on it.",
            "This is among the most used code here that nothing explains.",
            Pop::Func,
            vec![lt(Field::Documented, 0.35), ge(Field::Callers, 10.0), ge(Field::Loc, 10.0)],
            1,
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
            "Changing often, and nobody predicted it.",
            "A reader could not predict this body, and it changed in {{commits}} commits recently.",
            "Either on its own is ordinary; both at once is worth knowing before the next edit.",
            Pop::Func,
            vec![ge(Field::Surprise, 0.6), ge(Field::Commits, 4.0), ge(Field::Loc, 10.0)],
            1,
        ),
        rule(
            "surprising-far-reaching",
            "Surprising and far-reaching",
            "It calls a great deal and nobody predicted it.",
            "This calls {{calls}} other functions and a reader still could not predict what it \
             does.",
            "It coordinates work that is not apparent from its own body.",
            Pop::Func,
            vec![ge(Field::Surprise, 0.6), ge(Field::Calls, 10.0), ge(Field::Loc, 10.0)],
            1,
        ),
        rule(
            "stale-doc",
            "Stale doc",
            "Documented, and a reader still could not predict it.",
            "This has documentation and a reader still could not predict the body.",
            "Either the documentation describes behaviour the code no longer has, or it describes \
             it in terms that do not help.",
            Pop::Func,
            // **`Some` is not a stale doc, and 0.6 was catching it.** The grades are words
            // before they are numbers: `Grade::Some` is "recognizable, but the body does real
            // work the prediction did not cover" — an incomplete doc, which is most docs.
            // `Grade::None` at 0.92 is "the prediction did not describe this code", which is
            // what the rule is named for. At 0.6 it returned 58 findings on this repo and
            // owned the list; the number was not the problem, the reading of it was.
            vec![ge(Field::Documented, 0.7), ge(Field::Surprise, 0.9), ge(Field::Loc, 10.0)],
            // Calibrated on the surprise rather than the doc grade: neither is continuous, so
            // neither hits a target exactly, but `documented`'s useful value is its top one,
            // which leaves nothing between "everything" and "almost nothing".
            1,
        ),
        // **Traps, finally used.** A trap is a mark a reader leaves on a body that will bite
        // whoever edits it next — which is a prediction about an edit, and worth nothing until
        // you know whether anybody is editing. Against churn it is a warning; on its own it is
        // a note about code that may never be touched again.
        rule(
            "trap-being-edited",
            "Trap in code people are editing",
            "Easy to break when edited, and being edited.",
            "A reader flagged this as easy to break when edited, and it changed in {{commits}} \
             commits recently.",
            "",
            Pop::Func,
            vec![ge(Field::Trap, 1.0), ge(Field::Commits, 3.0), ge(Field::Loc, 10.0)],
            1,
        ),
        rule(
            "fossil-trap",
            "Fossil trap",
            "Easy to break when edited, and years since anyone did.",
            "A reader flagged this as easy to break when edited, and no commit has changed it in \
             {{touched_years}} years.",
            "",
            Pop::Func,
            // Gated the same way `fossil` is, and for the same reason one rung down: a trap
            // nobody has touched in three years is a different statement in a repo that is
            // two years old, where it cannot be made at all.
            vec![
                ge(Field::RepoAge, 730.0),
                ge(Field::Trap, 1.0),
                // "Years since anyone did" is `touched` — see `fossil`, where the same
                // confusion is written up.
                ge(Field::TouchedDays, 1095.0),
                ge(Field::Loc, 10.0),
            ],
            1,
        ),
        // **Clones against churn rather than against size.** A clone group is only a problem
        // once somebody starts editing it: that is the moment one copy gets the fix and the
        // rest quietly do not. Size says only that there is a lot of it.
        rule(
            "clone-being-edited",
            "Clone being edited",
            "One copy changed and the others did not.",
            "This body appears {{clone_count}} times in the repo, and this copy changed in \
             {{commits}} commits.",
            "Changes made in one copy are not applied to the others.",
            Pop::Func,
            vec![ge(Field::CloneSize, 3.0), ge(Field::Commits, 2.0), ge(Field::Loc, 10.0)],
            1,
        ),
        rule(
            "widely-cloned",
            "Widely cloned",
            "The same body, in several places.",
            "The same {{loc}} lines appear {{clone_count}} times in this repo.",
            "",
            Pop::Func,
            vec![ge(Field::CloneSize, 4.0), ge(Field::Loc, 30.0)],
            1,
        ),
        rule(
            "fossil",
            "Fossil",
            "No commit has changed it in years.",
            "{{loc}} lines that no commit has changed in {{touched_years}} years.",
            "",
            Pop::Func,
            // **Gated on the repo's own age, because "years" is relative to it.** Five years
            // untouched is a finding in a decade-old codebase and an impossibility in an
            // eighteen-month-old one — where the rule simply finds nothing, and nothing reads
            // as a clean bill. Three years is the judgement: below it, a repo has not been
            // going long enough for "nobody has touched this in ages" to mean ages.
            //
            // Calibration still moves the bar, so a repo old enough to be asked gets its
            // own. What the gate decides is whether asking is meaningful at all.
            // **`touched`, not `age`, and the difference is the whole rule.** `age` is days
            // since the oldest surviving line was written, so on any long-lived body it is
            // large whatever happened yesterday — ceph's `OSDMonitor::prepare_command_impl`
            // is 4,313 lines with 52 people's work standing in it, nineteen years old, and
            // edited constantly. This rule called it a fossil and printed "no commit has
            // changed it in 19 years" over the top. `touched` is days since the newest line
            // moved, which is what "nobody has been back here" actually means.
            vec![ge(Field::RepoAge, 1095.0), ge(Field::TouchedDays, 1825.0), ge(Field::Loc, 100.0)],
            1,
        ),
        rule(
            "tangled-for-size",
            "Tangled for its size",
            "More complicated than its length accounts for.",
            "For {{loc}} lines this branches more than almost anything else in the repo.",
            "Its complexity is not explained by its length.",
            Pop::Func,
            vec![ge(Field::Tangle, 0.8), ge(Field::Loc, 40.0)],
            1,
        ),
        // ── Blame's other two reductions ───────────────────────────────────────────────
        //
        // **Both count people and neither names one.** A rule that named somebody would be a
        // rule about what a thing is CALLED, which this grammar refuses — see `Field::pop` and
        // the note. `headcount` is the count of whose lines are standing, and these are the two
        // ends of it: nobody else has been here, and a lot of people have.
        //
        // **Blocked without `sanity trace --lines`**, which is a rung most repos are not
        // traced to. That is stated rather than silent: `blocked` names the fix.
        rule(
            "sole-author",
            "Load-bearing, and only one person has been in it",
            "Widely depended on, and every line of it was last touched by the same person.",
            "{{callers}} things call this, and every line of it was last touched by the same \
             person — out of {{repo_headcount}} who have worked on this repo.",
            "That is fine until that person is unavailable.",
            Pop::Func,
            // **The gate comes first because it is what makes the rest of the rule true.**
            // "Only one person has been in it" is a finding in a repo of forty people and a
            // tautology in a repo of one, and nothing about the FUNCTION can tell those apart
            // — so the rule asks about the repo. Four is a judgement and it is meant to be
            // edited: it is the number at which a body only one person has touched stops
            // being what everything looks like. See `Field::scope`.
            //
            // `callers` calibrates, not `headcount` and not the gate: tightening a `<=` means
            // lowering it and below one is nothing, and a gate cannot be calibrated at all.
            vec![
                ge(Field::RepoHeadcount, 4.0),
                le(Field::Headcount, 1.0),
                ge(Field::Callers, 10.0),
                ge(Field::Loc, 10.0),
            ],
            2,
        ),
        // **The same gate and the other end of the wiring.** `sole-author` asks who depends on
        // this body; this asks what it depends ON, which is the axis the bench keeps finding
        // is the productive one — `surprise >= 0.6 and calls >= 10` brought 20 rows of its own
        // where the same rule against SIZE brought none, because size is what almost every
        // other clause is already gated on and reach is drawn by nothing.
        //
        // Measured before it shipped, one candidate at a time against the raw catalog: flox
        // 44 hits and 25 of them nobody else's, openlineage 16 and 11. Ungated it was 2,315
        // hits on a solo repo — which is the clause doing nothing at all, since `headcount <=
        // 1` is true of every body in a repo one person wrote. `repo_headcount` is what makes
        // the sentence a finding rather than a description of the project, exactly as it is
        // on `sole-author` above.
        rule(
            "sole-author-coordinator",
            "Coordinates a lot, and only one person has been in it",
            "It calls a great deal, and every line of it was last touched by the same person.",
            "This calls {{calls}} things in the repo, and every line of it was last touched by \
             the same person — out of {{repo_headcount}} who have worked on this repo.",
            "Nobody else has had to hold what it coordinates in their head.",
            Pop::Func,
            // `calls` calibrates, for the reason `sole-author` gives about `callers`: a gate
            // cannot be calibrated and tightening a `<=` means lowering it, and below one is
            // nothing.
            vec![
                ge(Field::RepoHeadcount, 4.0),
                le(Field::Headcount, 1.0),
                ge(Field::Calls, 10.0),
                ge(Field::Loc, 10.0),
            ],
            2,
        ),
        rule(
            "alone-in-shared-code",
            "Alone in a file others work in",
            "Only one person's lines are in this body, in a file several people work in.",
            "Every line of this was last touched by the same person, in a file \
             {{file_headcount}} people have lines in.",
            "A pocket somebody owns alone, in shared territory.",
            Pop::Func,
            // **The file's count is the gate and the finding at once.** Six people in a file
            // is what makes one person in a body of it worth saying — on a repo where nobody
            // shares a file the clause is false everywhere and the rule is silent, which is
            // the right answer and needs no `repo_headcount` beside it to reach it.
            //
            // `loc` calibrates: the other two are the statement and moving either would
            // change what the rule means rather than how much of it there is.
            vec![
                ge(Field::FileHeadcount, 6.0),
                le(Field::Headcount, 1.0),
                ge(Field::Loc, 20.0),
            ],
            2,
        ),
        rule(
            "lone-file",
            "A file nobody else has been in",
            "A whole file with only one or two people's lines in it, on a project with many.",
            "{{funcs}} functions, and every line of this file was last touched by one of \
             {{headcount}} people — out of {{repo_headcount}} who have worked on this repo.",
            "",
            Pop::File,
            // The same question one scope out from `alone-in-shared-code`, and a different
            // answer: that one is a pocket inside shared territory, this is territory nobody
            // else has entered. Gated on the repo because on a small team it is every file.
            vec![
                ge(Field::RepoHeadcount, 6.0),
                ge(Field::Funcs, 5.0),
                le(Field::Headcount, 2.0),
            ],
            1,
        ),
        rule(
            "crowded-and-knotty",
            "Many have been in it, and it is knotty",
            "Several people have been in something more complicated than its length accounts for.",
            "{{headcount}} people's lines are standing in this, and for {{loc}} lines it branches \
             more than almost anything else here.",
            "Everyone who touched it had to hold that shape in their head.",
            Pop::Func,
            // **Paired with `tangle` rather than with `loc`, and that is the whole design.** A
            // headcount rises with size — a 362-line function has more hands than a 10-line
            // one because it has more lines to touch — so `headcount >= 6 and loc >= 10` is
            // mostly a long-function rule wearing a headcount. `tangle` is already measured
            // against the other bodies its size in this repo, so the conjunction says
            // something size does not: on htop it cuts `tangle >= 0.8` from 47 hits to 10, and
            // on ceph 86,269 functions down to 581.
            vec![ge(Field::Headcount, 4.0), ge(Field::Tangle, 0.8), ge(Field::Loc, 10.0)],
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
/// Move a rule's calibrated threshold to `v`, if that asks for MORE.
///
/// **Calibration may TIGHTEN a rule and may never loosen it.**
///
/// The shipped number is the rule's meaning: a fossil is code nothing has touched in five
/// years, and no repo gets to redefine that. Loosening was tried, on the argument that a small
/// repo should still get a list — and it produced `trap >= 1 and commits >= 0`, which is "any
/// trap" wearing two lenses, and `Fossil trap ... age >= 5.77`, where the unit is DAYS and the
/// word had come to mean "older than a week". Nothing breaks. The rule simply stops asking its
/// second question, and the tile still names both lenses.
///
/// So the number moves only in the direction that asks for more, and what a small repo gets is
/// a short list — which is the honest answer for a repo that has little wrong with it, and the
/// one thing a percentile could never say.
fn tighten(r: &mut Rule, v: f32) {
    let Some(c) = r.clauses.get_mut(r.calibrated) else { return };
    // **Rounded to the unit the field is actually measured in.** `catalog.md` is a file a
    // person reads and edits, and `touched >= 2430.4443` is four digits of noise on a
    // quantity counted in whole days — the calibrator lands between two subjects, and the
    // fraction is where it landed, not anything about the repo. The graded lenses are the
    // exception and keep two places, because there `0.8` and `1` are the whole range apart.
    let v = if c.field.graded() { (v * 100.0).round() / 100.0 } else { v.round() };
    let tighter = match c.op {
        Op::Ge | Op::Gt => v > c.value,
        Op::Le | Op::Lt => v < c.value,
    };
    if tighter {
        c.value = v;
    }
}

pub fn calibrated(rules: &[Rule], facts: &[Facts]) -> Vec<Rule> {
    rules
        .iter()
        .map(|r| {
            let mut tuned = r.clone();
            if let Some(v) = calibrate(r, facts, TARGET) {
                tighten(&mut tuned, v);
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

/// One line of `catalog.md`: what this repo says about one rule.
///
/// **Three cases, told apart without a flag saying which.** A built-in carries an id the
/// catalog knows and overrides only what it names, so a shipped improvement to a rule's prose
/// still reaches a repo that has tuned its number. A disabled rule carries `off`. A user rule
/// carries an id the catalog has never heard of and must therefore carry everything, because
/// there is nothing to fall back to.
#[derive(Debug, Default, Clone)]
pub struct Line {
    pub id: String,
    pub off: bool,
    pub pop: Option<Pop>,
    pub clauses: Option<Vec<Clause>>,
    pub floor: Option<u32>,
    pub title: Option<String>,
    pub so_what: Option<String>,
    pub says: Option<String>,
    /// A threshold on its own, from the format that predates the grammar — see `parse_line`.
    pub bare: Option<Clause>,
    /// The shipped rule this line was written against — see [`stale`].
    pub was: Option<Vec<Clause>>,
}

/// Has the shipped rule moved out from under a line that was tuned for it?
///
/// **A saved number is an answer to the question the rule asked when it was saved.** `fossil`
/// shipped as `age >= 1825`, every scanned repo saved that number, and the rule later moved to
/// `touched` because `age` is days since the OLDEST line was written — a different quantity,
/// and on ceph a nineteen-year gap from the one the rule wanted. The saved line went on
/// overriding, so the fix reached no repo that had ever been scanned, and the tile printed a
/// sentence about a field its own clause did not gate on.
///
/// **Shape, not value, and that distinction is the whole point.** Comparing the numbers would
/// void somebody's tuning every time a shipped default moved, which is exactly the tuning
/// worth keeping. What cannot survive is a threshold whose FIELD or OPERATOR is gone: `1825`
/// meant five years of not being touched, and there is nothing to carry it onto.
///
/// **A line with no `was` is judged on its own shape**, which is the whole legacy estate: every
/// file written before provenance existed. Trusting them wholesale was tried for exactly one
/// run and is worse than useless — sanity's own `fossil` line came through untouched and was
/// then rewritten WITH a `was` recording the shape it had never been tuned against, so the
/// stale number got certified by the mechanism built to catch it. Judging the line itself gets
/// every legacy case right: a number tuned for the rule as it stands has the rule's shape and
/// survives, and one left over from a rule that has since moved does not.
///
/// It costs the one case it cannot tell apart — somebody who hand-edited a rule's CLAUSES
/// before this shipped loses that edit and gets the shipped rule back, calibrated. There is
/// nothing on disk that distinguishes it from the fossil case, and of the two ways to be
/// wrong, handing back a current rule beats defending a dead one.
fn stale(line: &Line, shipped: &Rule) -> bool {
    let Some(mine) = &line.clauses else { return false };
    let shape = |cs: &[Clause]| -> Vec<(Field, Op)> { cs.iter().map(|c| (c.field, c.op)).collect() };
    shape(line.was.as_ref().unwrap_or(mine)) != shape(&shipped.clauses)
}

/// What this repo has said about its rules, in the order the file says it.
///
/// **A line this cannot read is dropped, and dropping is the safe direction.** Of the three
/// things a malformed line could do, two hide work: a half-read expression could silence a
/// rule or narrow it without saying so. A dropped line means the catalog's own version runs,
/// which is the same outcome as never having edited it.
pub fn saved_rules(repo: &std::path::Path) -> Vec<Line> {
    let Ok(text) = std::fs::read_to_string(rules_path(repo)) else { return Vec::new() };
    text.lines().filter_map(parse_line).collect()
}

/// `loc >= 339` — a clause with no population, which is what a line used to carry.
fn bare_clause(seg: &str) -> Option<Clause> {
    let [f, o, v] = seg.split_whitespace().collect::<Vec<_>>()[..] else { return None };
    Some(Clause { field: Field::parse(f)?, op: Op::parse(o)?, value: v.parse().ok()? })
}

fn parse_line(line: &str) -> Option<Line> {
    let rest = line.trim().strip_prefix("- ")?;
    let mut segs = rest.split("; ").map(str::trim);
    let mut out = Line { id: segs.next()?.trim_matches('`').to_string(), ..Line::default() };
    if out.id.is_empty() {
        return None;
    }
    for seg in segs {
        if seg == "off" {
            out.off = true;
        } else if let Some(v) = seg.strip_prefix("floor ") {
            out.floor = Some(v.trim().parse().ok()?);
        } else if let Some(v) = seg.strip_prefix("title: ") {
            out.title = Some(v.to_string());
        } else if let Some(v) = seg.strip_prefix("so what: ") {
            out.so_what = Some(v.to_string());
        } else if let Some(v) = seg.strip_prefix("says: ") {
            out.says = Some(v.to_string());
        } else if let Some(c) = bare_clause(seg) {
            // **The format this file had before it could hold a whole rule**, where a line was
            // an id and one threshold for the clause `calibrated` names. Read rather than
            // dropped: dropping is the right default for a line nobody can parse, and it is
            // the wrong one for a line an earlier version of this program WROTE. Every repo
            // tuned before today would have quietly gone back to shipped defaults, which on
            // this one meant 120 findings where there had been 43.
            out.bare = Some(c);
        } else if let Some(v) = seg.strip_prefix("was: ") {
            // Dropped rather than fatal if it will not parse: a `was` nobody can read is a
            // line with no provenance, which is the case every line predating this was in.
            out.was = Rule::parse(v).ok().map(|r| r.clauses);
        } else if seg.starts_with("func:") || seg.starts_with("file:") {
            // The expression, in the grammar `Rule::parse` already speaks — the same string a
            // person could have typed at `just findings --rule`, and the same one `expr()`
            // renders. One parser, so a rule the file can hold is a rule the bench can run.
            let parsed = Rule::parse(seg).ok()?;
            out.pop = Some(parsed.pop);
            out.clauses = Some(parsed.clauses);
        }
        // Anything else is a segment written by a version that knows something this one does
        // not. Skipped rather than fatal: the prefixes name themselves, so an unknown one
        // cannot shift the meaning of the ones around it.
    }
    Some(out)
}

/// Write what this repo has CHANGED about its rules — and nothing it has not.
///
/// **Only the deviations, and this used to be the other way round.** The file held every rule
/// whole, on the argument that it was then a complete statement of what ran and worth reading
/// in a diff. What it actually became is the `httpd.conf` problem: a repo scanned once froze
/// that day's defaults into itself, `merge` could not tell a number somebody chose from a
/// number that merely shipped, and so it defended both. Every later improvement to a rule's
/// clauses stopped at the repo boundary — sanity's own file was fifteen lines of which eight
/// were the shipped defaults verbatim, blocking changes to rules nobody had ever touched.
///
/// It was not even complete any more, which was its only justification: written once and never
/// rewritten, it listed fifteen of the nineteen rules that ran, and two of those fifteen were
/// no longer the rules those ids name.
///
/// So the file is small, hand-editable, and the only thing that overrides anything. What a
/// person without the app needs — every rule, what it asks, what it says — is [`save_listing`],
/// which is generated, complete and current, and which nobody edits. One file cannot be both:
/// the record of what ran wants to be regenerated, and the statement of what you changed has
/// to be durable.
///
/// **A deviation carries what it deviated FROM.** See [`stale`]: without it, a tuned number
/// outlives the question it answered and there is no way to notice.
pub fn save_rules(repo: &std::path::Path, rules: &[Rule]) -> std::io::Result<()> {
    let known = catalog();
    let mut out = String::new();
    out.push_str("# Rule changes\n\n");
    out.push_str("What THIS repo has changed about its rules. Everything not listed here runs\n");
    out.push_str("as sanity ships it — see `README.md` in this directory for the whole set,\n");
    out.push_str("which is regenerated on every scan and not worth editing.\n\n");
    out.push_str("Edit a number and it is used as written. Add `; off` to silence a rule.\n");
    out.push_str("Delete a line and that rule goes back to the shipped one. Delete the file\n");
    out.push_str("and every rule does.\n\n");
    out.push_str("`was:` records the rule a number was tuned against. When a release changes\n");
    out.push_str("which fields a rule asks about, the number no longer answers anything and is\n");
    out.push_str("dropped rather than left overriding the new rule.\n\n");
    let mut lines = String::new();
    for r in rules {
        let Some(k) = known.iter().find(|k| k.id == r.id) else {
            // A rule somebody wrote is a deviation entire — there is no shipped version of it
            // to fall back on, so it carries its own prose or it is not a rule at all.
            lines.push_str(&format!("- `{}`; {}", r.id, r.expr()));
            lines.push_str(&format!("; title: {}", one_line(&r.title)));
            lines.push_str(&format!("; so what: {}", one_line(&r.so_what)));
            if !r.says.is_empty() {
                lines.push_str(&format!("; says: {}", one_line(&r.says)));
            }
            lines.push('\n');
            continue;
        };
        if r.expr() == k.expr() && r.title == k.title && r.so_what == k.so_what && r.says == k.says
        {
            continue;
        }
        lines.push_str(&format!("- `{}`; {}", r.id, r.expr()));
        if r.expr() != k.expr() {
            lines.push_str(&format!("; was: {}", k.expr()));
        }
        if r.title != k.title {
            lines.push_str(&format!("; title: {}", one_line(&r.title)));
        }
        if r.so_what != k.so_what {
            lines.push_str(&format!("; so what: {}", one_line(&r.so_what)));
        }
        if r.says != k.says && !r.says.is_empty() {
            lines.push_str(&format!("; says: {}", one_line(&r.says)));
        }
        lines.push('\n');
    }
    // Rules silenced here rather than deleted: an id with no line is a rule that RUNS, so a
    // catalog that simply omitted them would turn every `off` back on at the next release.
    for k in &known {
        if !rules.iter().any(|r| r.id == k.id) {
            lines.push_str(&format!("- `{}`; off\n", k.id));
        }
    }
    let path = rules_path(repo);
    if lines.is_empty() {
        // **A repo that has changed nothing gets no file.** A directory left behind by a look
        // is a surprise where people run `git status` — `assessments.md` argues this for
        // readings — and a file whose entire content is "no changes" is worse than absent,
        // because it reads as a thing to maintain. Removed rather than left stale if it once
        // had content: what it would otherwise hold is a set of overrides nobody asked for.
        if path.exists() {
            std::fs::remove_file(&path)?;
        }
        return Ok(());
    }
    std::fs::create_dir_all(rules_dir(repo))?;
    out.push_str(&lines);
    std::fs::write(&path, &out)?;
    // Read back rather than trusting `Ok`: everything downstream treats these numbers as
    // settled, and a threshold that did not land would silently move on the next open.
    if std::fs::read_to_string(&path)? != out {
        return Err(std::io::Error::other("the rules on disk do not match what was written"));
    }
    Ok(())
}

/// The whole rule set as it ran, for somebody reading `.sanity/` without the app.
///
/// **Generated, complete and current — the job `catalog.md` used to do badly.** That file has
/// to be durable to be worth hand-editing, and durable is what made it stale. This one is
/// rewritten on every scan, so a rule added by a release shows up, a rule that changed shows
/// its new shape, and prose improvements arrive. Nothing reads it back: it is a report.
pub fn save_listing(repo: &std::path::Path, rules: &[Rule]) -> std::io::Result<()> {
    std::fs::create_dir_all(rules_dir(repo))?;
    let known = catalog();
    let mut out = String::new();
    out.push_str("# What this repo looks for\n\n");
    out.push_str("Every rule that ran on the last scan. A finding is one subject — a function\n");
    out.push_str("or a file — that answers every clause of a rule at once.\n\n");
    out.push_str("Generated on every scan. Editing it does nothing; `catalog.md` beside it is\n");
    out.push_str("where changes go, and it exists only once this repo has made one.\n\n");
    out.push_str("| Rule | Asks | Says |\n|---|---|---|\n");
    let cell = |s: &str| one_line(s).replace('|', "\\|");
    for r in rules {
        let mark = match known.iter().find(|k| k.id == r.id) {
            None => " *(yours)*",
            Some(k) if k.expr() != r.expr() => " *(tuned here)*",
            Some(_) => "",
        };
        out.push_str(&format!(
            "| **{}**{mark}<br>`{}` | `{}` | {} |\n",
            cell(&r.title),
            r.id,
            cell(&r.expr()),
            cell(&r.so_what),
        ));
    }
    let off: Vec<&str> =
        known.iter().filter(|k| !rules.iter().any(|r| r.id == k.id)).map(|k| k.id.as_str()).collect();
    if !off.is_empty() {
        // Named rather than merely absent: a reader who cannot see what was silenced cannot
        // tell a rule this repo turned off from one this build never had.
        out.push_str(&format!("\nSilenced here: {}\n", off.join(", ")));
    }
    std::fs::write(rules_dir(repo).join("README.md"), &out)
}

/// Prose, flattened onto the one line a record gets — see `escape`, which does the same for a
/// decision's reason and for the same reason.
fn one_line(s: &str) -> String {
    s.replace(['\n', '\r'], " ").replace("; ", ", ")
}

/// The catalog this repo actually runs: saved where it has been tuned, calibrated and saved
/// where it has not.
///
/// **The saving is the point.** Calibration is an authoring aid — the scan suggests a number
/// and the number is what gets kept. Doing it without keeping it would make every rule a
/// percentile.
pub fn rules_for(repo: &std::path::Path, facts: &[Facts]) -> Vec<Rule> {
    let base = catalog();
    // **A line whose rule has changed shape is dropped before it can override anything.**
    // See `stale`. Dropping is what lets a shipped fix reach a repo that was scanned before it
    // — the rule below is then unspoken-for, and gets calibrated against this repo like any
    // rule being met for the first time.
    let saved: Vec<Line> = saved_rules(repo)
        .into_iter()
        .filter(|l| !base.iter().any(|k| k.id == l.id && stale(l, k)))
        .collect();
    let spoken_for: Vec<&str> = saved.iter().map(|l| l.id.as_str()).collect();
    let mut live = merge(base, &saved);

    // **Calibration runs for every rule the file does not speak for, and its result sticks by
    // being written.** Not per-scan re-derivation: a threshold that re-computes itself to yield
    // eight every time is a percentile in disguise, so what makes a number settled is that it
    // lands in `catalog.md` and is read back next time. A rule calibration declines to move
    // writes nothing, comes back unspoken-for, and is calibrated again — which is only ever
    // true of a rule already producing a list short enough to work down.
    //
    // **Nothing is created for a repo with nothing in it.** `assessments.md` states this for
    // readings — "an open is a look, and a look that leaves a directory behind is a surprise
    // where people run `git status`" — and it is the guard that would have contained a real
    // one: a path that resolved to the empty string scanned the current directory, found
    // nothing, and wrote a rule catalog into whatever the caller happened to be standing in.
    if facts.is_empty() {
        return live;
    }
    for r in &mut live {
        if spoken_for.contains(&r.id.as_str()) {
            continue;
        }
        if let Some(v) = calibrate(r, facts, TARGET) {
            tighten(r, v);
        }
    }
    // A failure here costs a file, not an answer: the thresholds are still right for this run,
    // they will simply be calibrated again next time.
    let _ = save_rules(repo, &live);
    let _ = save_listing(repo, &live);
    live
}

/// The catalog this repo runs: the shipped rules as its file amends them, then the rules only
/// its file knows about.
///
/// **Catalog order first, then user rules in file order.** A person who turns a rule off and
/// back on should find it where it was; a list that reordered itself as it was edited would
/// make the marginal-contribution column jump around for reasons nothing on screen explains.
pub fn merge(base: Vec<Rule>, saved: &[Line]) -> Vec<Rule> {
    let mut out: Vec<Rule> = Vec::new();
    for mut r in base {
        let Some(line) = saved.iter().find(|l| l.id == r.id) else {
            // **A built-in the file does not mention still runs.** The file is a list of
            // amendments, not a whitelist: a rule added by a later release reaches every repo,
            // including ones tuned before it existed. Silencing is what `off` is for and it
            // has to be said.
            out.push(r);
            continue;
        };
        if line.off {
            continue;
        }
        amend(&mut r, line);
        out.push(r);
    }
    for line in saved {
        if line.off || out.iter().any(|r| r.id == line.id) {
            continue;
        }
        // An id the catalog has never heard of is a rule somebody wrote. It has to carry
        // everything, because there is nothing to fall back on — a user line without an
        // expression or a title is not a rule, and is dropped rather than half-built.
        let (Some(pop), Some(mut clauses), Some(title)) =
            (line.pop, line.clauses.clone(), line.title.clone())
        else {
            continue;
        };
        if let Some(floor) = line.floor {
            if !clauses.iter().any(|c| c.field == Field::Loc) {
                clauses.push(Clause { field: Field::Loc, op: Op::Ge, value: floor as f32 });
            }
        }
        out.push(Rule {
            id: line.id.clone(),
            title,
            so_what: line.so_what.clone().unwrap_or_else(|| "Matched a rule of yours.".into()),
            says: line.says.clone().unwrap_or_default(),
            // A rule somebody wrote has one paragraph and it is all about the subject. The
            // background is the catalog's, and there is no catalog rule behind this one.
            background: String::new(),
            pop,
            clauses,
            calibrated: 0,
        });
    }
    out
}

/// Apply one line's amendments to the rule it names, leaving everything it does not name.
fn amend(r: &mut Rule, line: &Line) {
    if let Some(pop) = line.pop {
        r.pop = pop;
    }
    // A bare threshold names the clause `calibrated` points at, which is what it meant when
    // that was the only thing a line could say.
    if let Some(bare) = line.bare {
        if let Some(c) = r.clauses.iter_mut().find(|c| c.field == bare.field) {
            c.op = bare.op;
            c.value = bare.value;
        }
    }
    if let Some(clauses) = &line.clauses {
        // **The calibrated clause follows its FIELD, not its index.** An edit that reorders a
        // rule's clauses would otherwise point `calibrated` at the other one, and the next
        // suggestion would offer a threshold for a question nobody asked.
        let was = r.clauses.get(r.calibrated).map(|c| c.field);
        r.clauses = clauses.clone();
        r.calibrated = was
            .and_then(|f| r.clauses.iter().position(|c| c.field == f))
            .unwrap_or(0)
            .min(r.clauses.len().saturating_sub(1));
    }
    // **`floor N` was a field and is a clause now** — see `findings.md`: a rule that gates on
    // size is asking a size question, and size is a lens like any other. A file written before
    // that still says `floor 10`, and it still means the same thing, so it is read as the
    // clause it always was rather than dropped.
    if let Some(floor) = line.floor {
        if !r.clauses.iter().any(|c| c.field == Field::Loc) {
            r.clauses.push(Clause { field: Field::Loc, op: Op::Ge, value: floor as f32 });
        }
    }
    if let Some(title) = &line.title {
        r.title = title.clone();
    }
    if let Some(so_what) = &line.so_what {
        r.so_what = so_what.clone();
    }
    if let Some(says) = &line.says {
        r.says = says.clone();
    }
    // **A saved rule keeps the shipped sentence only while its own clauses still answer it.**
    // A repo's `catalog.md` holds the numbers somebody tuned; the prose keeps coming from the
    // catalog, so a shipped improvement reaches a tuned repo. That is worth having and it has
    // one edge: when a shipped rule changes which FIELD it asks about, the tuned clause stays
    // as written and the new sentence names something the clause no longer gates on. `fossil`
    // moved from `age` to `touched` and ceph's saved `age >= 1825` began printing "no commit
    // has changed it in 0.1 years" — filled from facts, fluent, and false.
    //
    // The editor refuses such a pairing outright (`check_template`); here the rule is already
    // saved and refusing it would drop somebody's tuning, so the sentence falls back to the
    // generic one instead. The number the reader tuned survives, and the tile stops claiming
    // something the rule did not ask.
    if check_template(&r.says, &r.clauses).is_err() {
        r.says = String::new();
        // The background is the tail of that paragraph, and a tail with no head is a lesson
        // hanging under the generic one-liner. It goes with it.
        r.background = String::new();
    }
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
    /// **Everything the picker offers, the parser accepts.** The form's field list comes from
    /// `Field::ALL` via `grammar`, and the evaluator reads clauses through `Field::parse`; if
    /// those two ever disagree the form offers a field that saving refuses, which looks like
    /// the save being broken rather than the name being wrong. `legible` became `illegible`
    /// with `name()` and `parse` in one edit — this is what makes the next such rename fail
    /// loudly instead of shipping a picker full of options nobody can save.
    #[test]
    fn grammar_offers_only_fields_the_parser_knows() {
        let g = super::grammar(&[]);
        assert_eq!(g.fields.len(), super::Field::ALL.len());
        for f in &g.fields {
            let back = super::Field::parse(f.name)
                .unwrap_or_else(|| panic!("`{}` is offered and does not parse", f.name));
            assert_eq!(back.name(), f.name, "`{}` does not round-trip", f.name);
        }
        for op in &g.ops {
            let back = super::Op::parse(op)
                .unwrap_or_else(|| panic!("`{op}` is offered and does not parse"));
            assert_eq!(back.name(), *op);
        }
    }

    /// **A form sends what it typed, not what the backend measured.** `lens`, `median` and
    /// `suggestion` are outbound annotations; a clause coming back has nothing to say about
    /// them, and requiring them would make the frontend invent three nulls per clause to be
    /// heard — the kind of shape that gets one field wrong and fails at the wire.
    #[test]
    fn a_clause_needs_only_what_somebody_typed() {
        let c: super::ClauseView =
            serde_json::from_str(r#"{"field":"loc","op":">=","value":100}"#).unwrap();
        assert_eq!(c.field, "loc");
        assert_eq!(c.value, 100.0);
        assert!(c.lens.is_none() && c.median.is_none() && c.suggestion.is_none());
    }

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

    /// **A gate is what makes "only one person has been in it" true in one repo and vacuous
    /// in another**, and the test has to show both halves — a rule that fired either way, or
    /// neither, would not be gated, it would be broken.
    #[test]
    fn a_repo_scope_clause_gates_the_whole_rule() {
        let tree = file_with(vec![func("a", 200), func("b", 200)]);
        let rule = Rule::parse("func: repo_headcount >= 4 and loc >= 100").expect("parses");

        // A repo with people in it: the gate is open and the body clause decides.
        let many = subjects(
            &tree,
            &HashMap::new(),
            Traced { git: true, churned: true, blamed: true, headcount: 9, age_days: 900 },
        );
        assert_eq!(hits(&rule, &many).len(), 2);

        // The same tree, the same bodies, one author: nothing, and nothing is the right
        // answer rather than a missing one.
        let solo = subjects(
            &tree,
            &HashMap::new(),
            Traced { git: true, churned: true, blamed: true, headcount: 1, age_days: 900 },
        );
        assert_eq!(hits(&rule, &solo).len(), 0);

        // **Never true where blame has not run.** A zero would make `repo_headcount >= 4`
        // false and `repo_headcount <= 1` TRUE of an unmeasured repo, which is a gate opening
        // on an absence — so the field is absent and `blocked` says why instead.
        let cold = subjects(
            &tree,
            &HashMap::new(),
            Traced { git: true, churned: true, blamed: false, headcount: 0, age_days: 0 },
        );
        assert_eq!(hits(&rule, &cold).len(), 0);
        assert!(blocked(&rule, &cold, Traced::default(), false).is_some());
    }

    /// **A gate is not one of the three clauses a tile can carry.**
    ///
    /// The cap is on what a tile has to SAY — it names the lenses that raised a finding and
    /// writes a sentence about them. A repo-scope clause contributes neither, so counting it
    /// would spend a body's clause on a question about the repo.
    #[test]
    fn a_gate_does_not_count_against_the_clause_cap() {
        let four = "func: repo_headcount >= 4 and headcount <= 1 and callers >= 10 and loc >= 10";
        assert!(Rule::parse(four).is_ok(), "a gate plus three body clauses is a rule");
        let five = "func: repo_headcount >= 4 and headcount <= 1 and callers >= 10 and loc >= 10 and calls >= 5";
        assert!(Rule::parse(five).is_err(), "four body clauses is not");
    }

    /// **`Facts` is indexed by discriminant, so the count has to cover every variant.**
    ///
    /// `ALL` is what a form offers and deliberately leaves `Trap` out; the array is what every
    /// subject carries. Taking the size from `ALL.len()` would index out of bounds the first
    /// time a reader reported a trap — on a repo that had been read, months after the change.
    #[test]
    fn every_field_has_a_slot() {
        for f in super::Field::ALL {
            assert!((f as usize) < super::Field::COUNT, "`{}` is past the end", f.name());
        }
        assert!((super::Field::Trap as usize) < super::Field::COUNT, "trap is past the end");
        // And nothing is wasted: the last variant is the last slot.
        assert_eq!(super::Field::Trap as usize, super::Field::COUNT - 1);
    }

    /// **Not a correctness test — a measurement, kept out of the default run.**
    ///
    /// It exists because "opening kibana got slower" is a question a proxy cannot answer, and
    /// this file gained a third caller of [`subjects`] the day it did: `project_findings`,
    /// `project_rules` and `rule_grammar` each build the whole fact set for themselves.
    ///
    /// At 180,000 subjects, which is kibana's order:
    ///
    /// | | release | dev |
    /// |---|---|---|
    /// | `subjects()` | 41ms | 221ms |
    /// | `grammar()` | 29ms | 430ms |
    /// | `all_hits()` | 23ms | 366ms |
    ///
    /// So the three commands together are about 90ms in a shipped build and about 1.8s under
    /// `just dev`, which is where it was noticed — and they hold the projects lock while they
    /// run, so they serialise. The cost is dominated by the fact set being built three times
    /// rather than by anything the grammar does; `Facts::values` is a `HashMap` per subject,
    /// so that is 540,000 small maps to answer three questions about one repo.
    #[test]
    #[ignore]
    fn bench_grammar_at_kibana_scale() {
        use std::time::Instant;
        let mut files = Vec::new();
        for i in 0..20_000u32 {
            let mut kids = Vec::new();
            for j in 0..8u32 {
                // **Sized so the catalog actually FIRES.** The first version of this made
                // every function 10 to 50 lines, so no rule matched anything and every
                // measurement over hit sets came out at zero — which is how a quadratic
                // `marginal` sat under a bench that reported it as free.
                kids.push(func(
                    &format!("f{i}_{j}"),
                    if j == 0 { 400 + i % 900 } else { 8 + j * 5 },
                ));
            }
            let mut f = Node::dir(&format!("d{}/f{i}.rs", i % 400), &format!("f{i}.rs"));
            f.kind = NodeKind::File;
            f.loc = kids.iter().map(|c| c.loc).sum();
            f.funcs = kids.len() as u32;
            f.children = kids;
            files.push(f);
        }
        let mut root = Node::dir("", "repo");
        root.children = files;
        let reports = HashMap::new();
        let traced = Traced { git: true, churned: true, blamed: true, headcount: 0, age_days: 0 };

        let t = Instant::now();
        let facts = subjects(&root, &reports, traced);
        let built = t.elapsed();

        let t = Instant::now();
        let g = grammar(&facts);
        let grammared = t.elapsed();
        assert_eq!(g.fields.len(), Field::ALL.len());

        let t = Instant::now();
        let cat = catalog();
        let _ = all_hits(&cat, &facts);
        let hit = t.elapsed();

        // The two the window actually calls, which the first version of this bench did not
        // cover — and covering them is how the eight seconds on ceph got found.
        let repo = std::env::temp_dir().join("sanity-bench-repo");
        let _ = std::fs::create_dir_all(&repo);
        let t = Instant::now();
        let live = calibrated(&cat, &facts);
        let cal = t.elapsed();
        let t = Instant::now();
        let _ = rules_view(&repo, &facts, traced, false);
        let view = t.elapsed();
        let _ = live;
        // What one `project_report` costs: the walk, plus everything read off it.
        let whole = built + grammared + hit;

        // **The catalog cannot fire on a synthetic tree** — its rules want `callers`,
        // `cognitive`, `age`, a reading — so hit-set cost has to be measured against rules
        // that can. Eighteen overlapping `loc` bands is the shape a real catalog has on a
        // real repo: several thousand hits apiece, heavily overlapping.
        let bands: Vec<Rule> = (0..18)
            .map(|k| Rule::parse(&format!("func: loc >= {}", 300 + k * 30)).expect("parses"))
            .collect();
        let sets = all_hits(&bands, &facts);
        let total: usize = sets.iter().map(|s| s.len()).sum();

        let t = Instant::now();
        let solo = Marginal::of(&sets);
        let only: usize = (0..sets.len()).map(|i| solo.only(i, &sets)).sum();
        let counted = t.elapsed();

        // The version this replaced, inline: the union of every other rule, rebuilt per rule.
        let t = Instant::now();
        let mut was = 0usize;
        for at in 0..sets.len() {
            let theirs: std::collections::HashSet<&str> = sets
                .iter()
                .enumerate()
                .filter(|(i, _)| *i != at)
                .flat_map(|(_, o)| o.iter())
                .map(|s| s.key.as_str())
                .collect();
            was += sets[at].iter().filter(|s| !theirs.contains(s.key.as_str())).count();
        }
        let quadratic = t.elapsed();
        assert_eq!(only, was, "the fast one has to agree with the one it replaced");
        println!(
            "  {total} hits over 18 rules — Marginal {counted:?}, rebuilt-per-rule {quadratic:?}"
        );
        // **The command's own sequence, end to end.** The pieces above are diagnostic; this
        // is what a project switch actually pays, and it is the number to argue about.
        let arch: Vec<Decision> = Vec::new();
        let t = Instant::now();
        let f2 = subjects(&root, &reports, traced);
        let live2 = calibrated(&bands, &f2);
        let _ = report(&f2, traced, false, &live2, &arch);
        let _ = rules_view(&repo, &f2, traced, false);
        let _ = grammar(&f2);
        let whole_report = t.elapsed();
        println!("  project_report(): {whole_report:?}");

        println!(
            "{} subjects — subjects() {built:?}, grammar() {grammared:?}, all_hits() {hit:?}, calibrated() {cal:?}, rules_view() {view:?}, one report {whole:?}",
            facts.len(),
        );
    }

    /// The rule text is the settings page's own vocabulary, so it has to round-trip.
    #[test]
    fn a_rule_survives_being_written_down() {
        let r = Rule::parse("func: loc >= 200 and callers >= 20").expect("parses");
        assert_eq!(r.pop, Pop::Func);
        assert_eq!(r.clauses.len(), 2);
        assert_eq!(r.expr(), "func: loc >= 200 and callers >= 20");
        assert!(Rule::parse("dir: loc >= 10").is_err());
        // Three is the cap, and it is about precedence rather than counting: conjunction
        // needs none at any width, and there is no OR.
        assert!(Rule::parse("func: loc >= 1 and calls >= 1 and age >= 1").is_ok());
        assert!(Rule::parse("func: loc >= 1 and calls >= 1 and age >= 1 and read < 1").is_err());
    }

    /// **The rule this file exists to keep.** An unanswerable clause fails; it does not
    /// default. Without it, an untraced repo reports every function as brand new and an
    /// unread one as unsurprising — a confident answer where there is no evidence.
    #[test]
    fn a_clause_with_no_evidence_never_matches() {
        let tree = file_with(vec![func("wide", 500)]);
        let reports = HashMap::new();

        // No git read at all: an age clause cannot be answered, so it cannot fire.
        let untraced = subjects(
            &tree,
            &reports,
            Traced { git: false, churned: false, blamed: false, headcount: 0, age_days: 0 },
        );
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
        let solo = Marginal::of(&sets);
        assert_eq!(solo.only(0, &sets), 0);
        assert_eq!(solo.only(1, &sets), 1);

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
        let rule = Rule { id: "giant-function".into(), title: "Giant function".into(), ..rule };
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
        let renamed = Rule { title: "Something else entirely".into(), ..rule.clone() };
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
            title: "t".to_string(),
            so_what: "It is long.".to_string(),
            says: "{{name}} is {{loc}} lines, past the {{threshold}} that counts as long."
                .to_string(),
            ..Rule::parse("func: loc >= 100").expect("parses")
        };
        assert_eq!(
            flat(&render(&filled, at, Some(11.0))),
            "run is 300 lines, past the 100 that counts as long."
        );

        // `age` needs git, and nothing here has been traced. The sentence is abandoned whole
        // rather than printed with a gap where the number should be.
        let cannot =
            Rule { says: "untouched for {{age_years}} years.".to_string(), ..filled.clone() };
        assert_eq!(flat(&render(&cannot, at, None)), "It is long.");

        // A rule with no template at all falls back too — `says` is optional on a rule
        // somebody wrote, and an empty sentence under a title is worse than a short one.
        let none = Rule { says: String::new(), ..filled.clone() };
        assert_eq!(flat(&render(&none, at, None)), "It is long.");

        // So is a token that is not a field at all — a typo in a template must not ship as a
        // literal `{{callerz}}` in front of somebody.
        let typo = Rule { says: "{{callerz}} things call it.".to_string(), ..filled.clone() };
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

    /// A tuned number does not survive the rule changing which field it asks about.
    #[test]
    fn a_release_that_moves_a_rules_field_moves_past_the_saved_number() {
        let fossil = catalog().into_iter().find(|r| r.id == "fossil").expect("ships");

        // What every repo scanned before yesterday has on disk.
        let old = parse_line("- `fossil`; func: age >= 1825 and loc >= 100; was: func: age >= 1825 and loc >= 100")
            .expect("parses");
        assert!(stale(&old, &fossil), "the rule asks `touched` now; `age` cannot carry over");

        // The same number, tuned against the rule as it stands. Nothing to void.
        let now = parse_line(
            "- `fossil`; func: repo_age >= 1095 and touched >= 4000 and loc >= 100; was: func: repo_age >= 1095 and touched >= 1825 and loc >= 100",
        )
        .expect("parses");
        assert!(!stale(&now, &fossil), "same shape, different number — that IS the tuning");

        // **A shipped default moving is not a shape change.** Voiding on value would throw
        // away tuning every time a catalog number was adjusted, which is the tuning worth
        // keeping: `was` is compared on fields and operators only.
        let renumbered = parse_line(
            "- `fossil`; func: repo_age >= 1095 and touched >= 4000 and loc >= 100; was: func: repo_age >= 900 and touched >= 1200 and loc >= 50",
        )
        .expect("parses");
        assert!(!stale(&renumbered, &fossil));

        // **A line from before provenance existed is judged on its own shape.** One that asks
        // what the rule asks is a tuning and survives; one left over from the rule's previous
        // shape does not — and that second case is the entire reason this exists, so trusting
        // every `was`-less line would have let it through on the one run that mattered.
        let ancient = parse_line("- `fossil`; func: repo_age >= 1095 and touched >= 4000 and loc >= 100")
            .expect("parses");
        assert!(!stale(&ancient, &fossil), "tuned for the rule as it stands");
        let legacy = parse_line("- `fossil`; func: age >= 1825 and loc >= 100").expect("parses");
        assert!(stale(&legacy, &fossil), "tuned for a rule that no longer exists");
    }

    /// The file holds what this repo changed, and a repo that changed nothing has no file.
    #[test]
    fn only_the_deviations_are_written() {
        let dir = tempfile::tempdir().expect("tmp");
        let repo = dir.path();

        // Shipped, unchanged, every rule: nothing to say.
        save_rules(repo, &catalog()).expect("writes");
        assert!(!rules_path(repo).exists(), "an untouched repo gets no catalog.md");

        // One tuned rule and one silenced. Both are deviations; the other seventeen are not.
        let mut rules = catalog();
        let at = rules.iter().position(|r| r.id == "giant-function").expect("ships");
        rules[at].clauses[0].value = 339.0;
        rules.retain(|r| r.id != "widely-cloned");
        save_rules(repo, &rules).expect("writes");
        let text = std::fs::read_to_string(rules_path(repo)).expect("now it exists");
        let body: Vec<&str> = text.lines().filter(|l| l.starts_with("- ")).collect();
        assert_eq!(body.len(), 2, "two changes, two lines: {body:?}");
        assert!(body[0].contains("loc >= 339") && body[0].contains("; was: "), "{}", body[0]);
        assert!(body[1].contains("`widely-cloned`; off"));

        // And it round-trips: the file is read back into the same two rules.
        let live = merge(catalog(), &saved_rules(repo));
        assert_eq!(live.iter().find(|r| r.id == "giant-function").expect("kept").clauses[0].value, 339.0);
        assert!(!live.iter().any(|r| r.id == "widely-cloned"), "still silenced");

        // Undo them both and the file goes, rather than sitting there saying nothing.
        save_rules(repo, &catalog()).expect("writes");
        assert!(!rules_path(repo).exists());
    }

    /// Somebody without the app can read what the repo looks for.
    #[test]
    fn the_listing_names_every_rule_that_ran() {
        let dir = tempfile::tempdir().expect("tmp");
        let mut rules = catalog();
        rules.retain(|r| r.id != "widely-cloned");
        save_listing(dir.path(), &rules).expect("writes");
        let text = std::fs::read_to_string(rules_dir(dir.path()).join("README.md")).expect("read");
        for r in &rules {
            assert!(text.contains(&r.title), "{} is missing from the listing", r.id);
            assert!(text.contains(&r.expr()), "{} runs but the listing does not say what it asks", r.id);
        }
        assert!(text.contains("Silenced here: widely-cloned"), "a silenced rule is named, not just absent");
    }

    /// A tuned clause that outlives the sentence it was written for loses the sentence.
    ///
    /// **ceph, exactly.** `fossil` shipped as `age >= 1825`, ceph saved that number, and the
    /// rule later moved to `touched` because `age` is days since the OLDEST line was written
    /// — which on a 4,313-line body with fifty-two contributors is nineteen years and says
    /// nothing about whether anyone has been back. The saved clause stayed `age`; the shipped
    /// sentence now said `touched`; and the tile read "4,313 lines that no commit has changed
    /// in 0.1 years", filled from facts the rule never gated on.
    #[test]
    fn a_saved_clause_cannot_keep_a_sentence_it_stopped_answering() {
        let base = catalog();
        let fossil = base.iter().find(|r| r.id == "fossil").expect("fossil ships").clone();
        assert!(fossil.says.contains("{{touched_years}}"), "the sentence names touched");

        let line = parse_line("- `fossil`; func: age >= 1825 and loc >= 100").expect("parses");
        let merged = merge(base.clone(), &[line]);
        let tuned = merged.iter().find(|r| r.id == "fossil").expect("still there");
        assert!(tuned.clauses.iter().any(|c| c.field == Field::AgeDays), "tuning survives");
        assert!(tuned.says.is_empty(), "but the sentence it no longer answers does not");

        // And a saved line that still asks the question keeps its prose.
        let ok = parse_line("- `fossil`; func: touched >= 900 and loc >= 100").expect("parses");
        let kept = merge(base, &[ok]);
        let kept = kept.iter().find(|r| r.id == "fossil").expect("still there");
        assert_eq!(kept.says, fossil.says);
    }

    /// Every shipped rule's sentence is fillable from what its own clauses guarantee.
    ///
    /// **The catalog is prose now, and prose rots.** A template referencing a field the rule
    /// does not gate on falls back silently — the tile still reads, so nobody notices that the
    /// tailored sentence never appears. This is what notices.
    #[test]
    fn every_catalog_sentence_names_only_what_its_rule_guarantees() {
        for r in catalog() {
            let mut rest = r.says.as_str();
            while let Some(at) = rest.find("{{") {
                let close = rest[at..].find("}}").expect("a token closes");
                let token = &rest[at + 2..at + close];
                rest = &rest[at + close + 2..];
                if matches!(token, "name" | "path" | "threshold" | "median") {
                    continue;
                }
                // **The two date tokens are checked, not exempted, and that is the point.**
                // `age_years` used to sit in the skip list above, so `fossil` could say "no
                // commit has changed it in {{age_years}} years" while gating on nothing of
                // the sort — `age` is days since the OLDEST line was written, and the rule
                // needed `touched`. The sentence read fine and was false. Resolving each
                // token to the field it prints is what makes the clause requirement bite.
                let field = match token {
                    "age_years" => Field::AgeDays,
                    "touched_years" => Field::TouchedDays,
                    other => Field::parse(other)
                        .unwrap_or_else(|| panic!("{}: `{other}` is not a field", r.title)),
                };
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
            title: "t".to_string(),
            so_what: "x".to_string(),
            says: String::new(),
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
        let wide = Rule { title: "t".into(), so_what: "x".into(), says: String::new(), ..wide };
        let tuned = calibrated(&[wide], &facts);
        assert!(
            tuned[0].clauses[0].value > 50.0,
            "a repo with plenty past the bar raises it, which is the noise this exists to cut",
        );
    }

    /// **A three-line accessor called thirty times is not a finding.** Without a size clause,
    /// "load-bearing and undocumented" returned eight rows of `len`, `new` and `path` — all
    /// true, and all of them work nobody should do. The same gap put a three-line accessor at
    /// the top of the reading queue, where it would have spent budget to learn that an
    /// accessor accesses something.
    ///
    /// It was a `floor` field first, on the argument that it was about the instrument's
    /// resolution rather than about the repo. It is a clause now: a rule that gates on size is
    /// asking a size question, and size is a lens like any other.
    #[test]
    fn a_rule_about_a_body_says_nothing_about_a_trivial_one() {
        let tree = file_with(vec![func("len", 3), func("parse_shard", 133)]);
        let facts = subjects(&tree, &HashMap::new(), Traced::default());

        let unfloored = Rule::parse("func: loc >= 1").expect("parses");
        assert_eq!(hits(&unfloored, &facts).len(), 2);

        let floored = Rule::parse("func: loc >= 10").expect("parses");
        let kept = hits(&floored, &facts);
        assert_eq!(kept.len(), 1);
        assert_eq!(kept[0].name, "parse_shard");

        // And every shipped rule whose question is about a BODY gates on size, so the catalog
        // cannot regain the gap by adding a rule that forgets to.
        for r in catalog() {
            let about_a_body = r.pop == Pop::Func
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
                assert!(
                    r.clauses.iter().any(|c| c.field == Field::Loc),
                    "{} asks about a body and does not gate on its size",
                    r.title
                );
            }
        }
    }

    /// **A line an earlier version wrote is still read.** The first format was an id and one
    /// threshold for the clause `calibrated` names; dropping it — right for a line nobody can
    /// parse — would have taken every repo tuned before the grammar existed back to shipped
    /// defaults, silently. On this repo that was 120 findings where there had been 43.
    #[test]
    fn a_line_from_the_first_format_still_tunes_its_rule() {
        let base = catalog();
        let giant = base.iter().find(|r| r.id == "giant-function").expect("shipped");
        let was = giant.clauses[giant.calibrated].value;

        let tuned = merge(base.clone(), &[parse_line("- `giant-function`; loc >= 339").unwrap()]);
        let now = tuned.iter().find(|r| r.id == "giant-function").expect("still here");
        assert_ne!(was, 339.0, "the shipped default is not the number under test");
        assert_eq!(now.clauses[now.calibrated].value, 339.0);
        // And the rest of the rule is untouched — the old format named one threshold and knew
        // nothing about the clause beside it.
        assert_eq!(now.clauses.len(), giant.clauses.len());
        assert_eq!(now.expr(), "func: loc >= 339 and cognitive >= 10");
    }

    /// The three things a line can be, and the fourth that it cannot.
    #[test]
    fn a_file_can_silence_a_rule_define_one_and_be_wrong() {
        let base = catalog();
        let first = base[0].id.clone();

        // Off: gone from the catalog this repo runs, and it is the only way to lose a rule —
        // a rule the file does not mention still runs, so a later release reaches every repo.
        let off = merge(base.clone(), &[parse_line(&format!("- `{first}`; off")).unwrap()]);
        assert_eq!(off.len(), base.len() - 1);
        assert!(!off.iter().any(|r| r.id == first));
        assert_eq!(merge(base.clone(), &[]).len(), base.len(), "silence is not absence");

        // A threshold, amended, with the rest of the rule inherited.
        let tuned =
            merge(base.clone(), &[parse_line(&format!("- `{first}`; func: loc >= 999")).unwrap()]);
        assert_eq!(tuned[0].expr(), "func: loc >= 999");
        assert_eq!(tuned[0].title, base[0].title, "prose still the catalog's");

        // A rule of somebody's own, which has to carry everything.
        let mine = merge(
            base.clone(),
            &[parse_line(
                "- `mine`; func: callers >= 20 and commits >= 4; floor 10; \
                 title: Hot paths; so what: widely depended on, and moving",
            )
            .unwrap()],
        );
        let last = mine.last().expect("a rule");
        assert_eq!(last.id, "mine");
        assert_eq!(last.title, "Hot paths");
        // The `floor 10` segment is read as the size clause it always meant.
        assert_eq!(last.expr(), "func: callers >= 20 and commits >= 4 and loc >= 10");

        // And the ways a line is not a rule. Each drops to the catalog's own answer rather
        // than half-building one: of the things a malformed line could do, two hide work.
        assert!(parse_line("not a bullet").is_none());
        assert!(
            parse_line("- `x`; func: loc >>> 3").is_none(),
            "an expression that will not parse"
        );
        assert!(parse_line("- `x`; floor twelve").is_none(), "a floor that is not a number");
        let no_title = merge(base.clone(), &[parse_line("- `x`; func: loc >= 5").unwrap()]);
        assert_eq!(no_title.len(), base.len(), "an unknown id with no title is not a rule");
    }

    /// **The field list and the parser agree, in both directions.** A field the evaluator can
    /// answer and the form cannot offer is invisible: nothing fails, the question simply
    /// cannot be asked.
    #[test]
    fn every_field_is_offered_and_every_name_parses() {
        for f in Field::ALL {
            assert_eq!(Field::parse(f.name()), Some(f), "`{}` does not parse back", f.name());
        }
        // `trap` is answerable and deliberately NOT offered: it is a mark rather than a
        // measurement, and a picker would have to present `trap >= 1` as though the number
        // meant something. The catalog uses it; a person reaches it by choosing the rule.
        assert!(!Field::ALL.contains(&Field::Trap));
        assert_eq!(Field::parse("trap"), Some(Field::Trap));

        for op in Op::ALL {
            assert_eq!(Op::parse(op.name()), Some(op));
        }
    }

    /// **What the form refuses, and refuses out loud.** Every one of these is a rule the
    /// evaluator would happily run and a person would be worse off for having: a silent
    /// correction teaches a grammar that is not the one they are writing in.
    #[test]
    fn a_rule_that_is_not_one_is_refused_with_a_reason() {
        let edit = |clauses: Vec<(&str, &str, f32)>, pop| RuleEdit {
            id: String::new(),
            title: "Mine".into(),
            so_what: "x".into(),
            says: String::new(),
            pop,
            clauses: clauses
                .into_iter()
                .map(|(f, o, v)| ClauseView {
                    field: f.into(),
                    op: o.into(),
                    value: v,
                    lens: None,
                    median: None,
                    suggestion: None,
                })
                .collect(),
            calibrated: 0,
            on: true,
        };
        let mut live = catalog();
        let err = |e: Result<(), String>| e.unwrap_err();

        assert!(err(apply_edit(
            &mut live,
            RuleEdit { title: "  ".into(), ..edit(vec![("loc", ">=", 5.0)], Pop::Func) }
        ))
        .contains("title"));
        assert!(err(apply_edit(&mut live, edit(vec![], Pop::Func))).contains("one to three"));
        assert!(err(apply_edit(
            &mut live,
            edit(
                vec![
                    ("loc", ">=", 5.0),
                    ("callers", ">=", 5.0),
                    ("calls", ">=", 5.0),
                    ("commits", ">=", 5.0),
                ],
                Pop::Func
            )
        ))
        .contains("one to three"));
        assert!(err(apply_edit(&mut live, edit(vec![("nope", ">=", 5.0)], Pop::Func)))
            .contains("not a field"));
        // A grade on a file, which is a reading of a body.
        assert!(err(apply_edit(&mut live, edit(vec![("surprise", ">=", 0.6)], Pop::File)))
            .contains("says nothing about a file"));
        // The vacuity guard — `trap >= 1 and commits >= 0` shipped once and turned a two-lens
        // rule into a one-lens rule that went on naming two.
        assert!(err(apply_edit(&mut live, edit(vec![("commits", ">=", 0.0)], Pop::Func)))
            .contains("true of everything"));
        // A template naming what the rule does not measure — `render` would fall back and
        // nobody would find out.
        let mut bad = edit(vec![("callers", ">=", 10.0)], Pop::Func);
        bad.says = "changed in {{commits}} commits".into();
        assert!(err(apply_edit(&mut live, bad)).contains("not something this rule measures"));

        // And one that IS a rule: it lands, keeps its own id, and takes nothing from a
        // built-in.
        let before = live.len();
        apply_edit(&mut live, edit(vec![("callers", ">=", 10.0)], Pop::Func)).expect("a rule");
        assert_eq!(live.len(), before + 1);
        assert_eq!(live.last().unwrap().id, "mine");
        assert!(catalog().iter().all(|r| r.id != "mine"));
    }

    /// **An id is minted once and reserved against the catalog.** A rule that re-slugged
    /// itself on a retitle would orphan every decision filed with it, and one that took a
    /// built-in's id would merge two different questions the next time a release shipped one.
    #[test]
    fn a_minted_id_never_collides_with_a_shipped_one() {
        let mut live = catalog();
        let first = live[0].title.clone();
        // A user rule titled exactly like a built-in cannot take its id.
        let taken = mint_id(&first, &live);
        assert_ne!(taken, live[0].id);
        assert!(taken.starts_with(&live[0].id));

        // Punctuation and spacing collapse; an empty title still yields something.
        assert_eq!(mint_id("Hot   paths!!", &live), "hot-paths");
        assert_eq!(mint_id("!!!", &live), "rule");

        // And the id survives a retitle, because it is only minted when there is not one.
        live.push(Rule { id: "mine".into(), title: "Mine".into(), ..live[0].clone() });
        let edit = RuleEdit {
            id: "mine".into(),
            title: "Something else".into(),
            so_what: "x".into(),
            says: String::new(),
            pop: Pop::Func,
            clauses: vec![ClauseView {
                field: "loc".into(),
                op: ">=".into(),
                value: 5.0,
                lens: None,
                median: None,
                suggestion: None,
            }],
            calibrated: 0,
            on: true,
        };
        apply_edit(&mut live, edit).expect("a rule");
        let mine = live.iter().find(|r| r.id == "mine").expect("still there");
        assert_eq!(mine.title, "Something else");
    }

    /// Keys are `key_of`, never node ids — a dismissal has to survive the body moving down
    /// the file, and node ids embed `@line`.
    #[test]
    fn a_finding_is_keyed_the_way_a_reading_is() {
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
