//! What a reading is: the [`Report`] a reader sends, and the four-step [`Grade`] it uses.
//!
//! The record is the measurement, so most of this file is the reasoning behind each field —
//! which ones the reader judges, which ones the server stamps because a field whose job is
//! to be checkable later cannot be self-certified, and which absences mean "nobody asked"
//! rather than "no". The two rules the grades do not carry are applied in
//! [`Report::grades`].

use serde::{Deserialize, Serialize};

/// A four-step ordinal, for the two things a reader can judge but not measure.
///
/// Deliberately not a 0-100. A model asked for a number emits one, but 73 versus 68 is
/// noise: it is not stable across runs on unchanged code, and an unstable score quietly
/// destroys the thing the layout works hardest to protect — recognizing the shape you
/// saw last time. Four steps are a judgement a reader can actually make and repeat. The
/// arithmetic stays here, where it is inspectable, rather than in the model.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Grade {
    /// Called it. Nothing in the body the prediction missed.
    Full,
    /// Broadly right, with a detail that wasn't obvious.
    Most,
    /// Recognizable, but the body does real work the prediction didn't cover.
    Some,
    /// The prediction did not describe this code.
    None,
}

impl Grade {
    /// How surprising a prediction at this grade means the code was.
    ///
    /// Not evenly spaced: the interesting distinction is between "I basically knew this"
    /// and "I did not", so the two confident steps sit close together and leave room to
    /// separate the two that matter.
    pub fn surprise(self) -> f32 {
        match self {
            Grade::Full => 0.08,
            Grade::Most => 0.30,
            Grade::Some => 0.62,
            Grade::None => 0.92,
        }
    }

    /// How well documented this code is, at this grade.
    pub fn documented(self) -> f32 {
        match self {
            Grade::Full => 0.95,
            Grade::Most => 0.7,
            Grade::Some => 0.35,
            Grade::None => 0.0,
        }
    }
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct Report {
    pub id: String,
    /// Lines in the function this reading is about, and whether the reading has expired.
    ///
    /// **Stamped on the way out, never stored** — the same rule `legible_dated` follows, and
    /// for a stronger reason: both are facts about the CODE as it stands, and the store is a
    /// record of a reading. Writing them into `.sanity/` would freeze one scan's opinion
    /// into a file that outlives it.
    ///
    /// They exist so that a directory can draw what its readings look like when the window
    /// has not fetched its functions. The browser folds readings onto function NODES, and a
    /// large repo arrives without them (see `Node::slim`), so a reading whose function is
    /// not on screen could be counted neither by line nor as current — and counting an
    /// expired reading as a live one is the one thing this store must never do. Only the
    /// backend can answer that: staleness is a hash comparison against the live body, which
    /// is precisely what the window is missing.
    ///
    /// `loc` is `0` for a reading whose function no longer exists. That is not a size; it is
    /// how an orphan says so, and the window drops it rather than counting a phantom.
    #[serde(default)]
    pub loc: u32,
    #[serde(default)]
    pub stale: bool,
    /// What the agent expected before reading the body. Recorded even when it was right,
    /// because "expected X, found X" is the evidence that a wedge is genuinely boring.
    ///
    /// **Filled server-side from `reveal`, not from the report.** It arrived in the same
    /// call as `found`, from a reader that had by then read the code — so the one field
    /// that has to predate the body was the only part of the measurement written after it.
    /// `Default` because the report no longer carries it; see [`Project::predictions`].
    #[serde(default)]
    pub expected: String,
    /// What it actually found.
    pub found: String,
    /// How many parts the body was served in, when it took more than one.
    ///
    /// **Evidence that a large body actually arrived, kept because asking did not work.**
    /// Eighteen readings in this corpus were graded against bodies their readers never
    /// received; every one recorded the fact in a `note` and graded anyway, and all
    /// eighteen landed on the same flattering rung. So this is stamped server-side from
    /// [`Project::revealed`], beside `body`, `by` and `at`, on the standing rule that a
    /// field whose job is to be checkable later cannot be self-certified.
    ///
    /// **Absence is what makes the old readings expire, and it is not a migration.** A body
    /// over [`PART_BYTES`] can only be served in parts, so an honest reading of one carries
    /// a count here; a reading of the same body with nothing here was taken when `reveal`
    /// still handed the whole thing over in one response, which is exactly the population
    /// that could not receive it. `is_stale` reads the pair — see there. Nothing rewrites
    /// the store and nothing is deleted: the readings expire, re-queue, and are replaced by
    /// re-reading, which is the only mechanism this codebase has for a changed input.
    ///
    /// `None` on the overwhelming majority of readings, which are one part and have nothing
    /// to prove. It renders only when present, on the same rule as every other absence here.
    #[serde(default)]
    pub paged: Option<usize>,
    /// Whether the body diverged from the expectation in a way that matters.
    ///
    /// Superseded by `predicted`. Kept, and defaulted, so reports written before the
    /// grades existed still load — dropping it would silently discard every assessment
    /// already banked against a repo.
    #[serde(default)]
    pub surprised: bool,
    /// How much of the body the agent's prediction actually covered.
    #[serde(default)]
    pub predicted: Option<Grade>,
    /// How well the documentation it was given covers what the code does.
    ///
    /// Graded by the reader that just read both, which is what the old lexical score
    /// could not do: overlap can tell you a doc talks about the same words as the body,
    /// never whether it says anything true about them.
    #[serde(default)]
    pub documented: Option<Grade>,
    /// Whether that documentation could have been written from the code alone.
    ///
    /// The provenance rule, asked directly. A doc a model could regenerate from the body
    /// explains nothing that was not already there, so it must not count as
    /// documentation — otherwise anyone can run a model over a repo, turn the map green
    /// and make it a liar. A lexical score cannot ask this; a reader can.
    #[serde(default)]
    pub derivable: bool,
    /// How clear the body was ONCE OPEN — the second axis.
    ///
    /// `predicted` asks whether the intent was reachable before opening the file, which is
    /// the question the whole predict-then-read protocol is built to answer. It cannot
    /// distinguish two repos that fail it for opposite reasons: one whose bodies are plain
    /// the moment you look, and one that is unreadable all the way down. Those deserve
    /// different verdicts and scored identically.
    ///
    /// It is free to ask, because by the time this is filled in the reader has read the
    /// body anyway. And it is the half that inline comments legitimately count toward —
    /// they are invisible to `predicted` by construction, since they live inside the thing
    /// being predicted, and feeding them to the predictor would be handing over the answer.
    #[serde(default)]
    pub legible: Option<Grade>,
    /// Something here will bite whoever edits this next.
    ///
    /// Not "I was surprised" — a surprise is about the reader, and a trap is about the
    /// code: an ordering assumption nothing enforces, a silent no-op, an unguarded index, a
    /// resource that leaks on one path.
    ///
    /// **A wrong doc is not a trap**, and the first version of this field said it was. It
    /// read as an invitation on a repo whose commonest defect is exactly that, and a third
    /// of the traps in the first corpus were documentation drift — which `documented` and
    /// `derivable` already grade. Counting it twice inflated the one number whose whole
    /// value is being rare enough to work through.
    ///
    /// Separate from `legible`,
    /// because the two are independent and the dangerous quadrant is the one where they
    /// disagree: a perfectly clear body with a mine under it reads as safe.
    ///
    /// It is also what makes a notes list usable. Notes conflate defects, missing
    /// documentation and readers apologizing for their own misreadings; nothing but the
    /// reader knows which it wrote, and this is it saying so.
    #[serde(default)]
    pub trap: bool,
    /// Whether this body is test code, as the reader saw it — `None` where it was not asked.
    ///
    /// **Asked only where no toolchain answers**, which is why it is an `Option` rather than a
    /// `bool` like `trap`. Rust says `#[cfg(test)]` and Go says `_test.go`, and both are facts
    /// about what ships; asking a reader to re-derive those would spend tokens on every reading
    /// in those repos to be told what the compiler already said. Where there IS no contract —
    /// C++ loudest among them — a reader is the only source that can see a fixture living in a
    /// production file, which no path and no attribute reaches.
    ///
    /// `None` is "nobody asked", never "not a test". See [`crate::model::Tested`].
    #[serde(default)]
    pub test: Option<bool>,
    /// One sentence a human can read. Optional — a correct prediction needs no note.
    #[serde(default)]
    pub note: String,
    /// Whether the reporter was seeing this file for the first time when it predicted.
    ///
    /// Self-declared and therefore weak, but the alternative is not knowing at all. A
    /// warm reader recalls rather than predicts, so its verdicts are worth less — and the
    /// UI can say so instead of presenting every report as equally earned.
    #[serde(default)]
    pub cold: bool,
    /// How many functions this reader had already assessed when it made this reading —
    /// 1 for the first, 2 for the second.
    ///
    /// `cold` asks "had you read this FILE before?", and that is the smaller half of the
    /// question. A reader working through a batch is also learning the repo's idioms, its
    /// naming conventions, its domain vocabulary and its author's habits — so by its
    /// eighth function it predicts better for reasons that have nothing to do with the
    /// code being clearer, and `cold: true` records none of it. Two readings at different
    /// positions are not comparable measurements, and nothing in the store said which was
    /// which.
    ///
    /// The protocol now hands out one function per reader, so this should be 1 on
    /// everything. It is recorded anyway, because "should be" is not a measurement: a
    /// reader that batches regardless leaves a trace here instead of quietly widening the
    /// scale. Self-declared, and weak for the same reason as `cold`.
    #[serde(default)]
    pub position: Option<u32>,
    /// Whether the repo's own agent instructions were in the reader's context.
    ///
    /// The contamination `cold` cannot see. `cold` asks whether the reader had opened this
    /// FILE, and a host that injects `CLAUDE.md` into every subagent hands it a detailed
    /// description of the architecture it is about to predict — so the reading is honestly
    /// cold and substantially recall. It is not hypothetical: a full pass of a real repo
    /// had readers volunteering it unprompted in roughly a quarter of reports, naming
    /// fifty-odd functions they had recalled rather than inferred, and there was no field
    /// to put it in. The whole finding survives as prose in a caveats document.
    ///
    /// Self-declared, and it has to be: the server sees a tool call, never a system prompt.
    /// The reader is the only party that can see its own context, which is the same reason
    /// `cold` and `position` are asked rather than derived. What makes it checkable is the
    /// server-stamped half beside it — see [`Report::agent_docs`].
    ///
    /// **It must name WHOSE brief, because the first live wave split on exactly that.** Nine
    /// readers, one session: two answered `true` and four answered `false` while explaining,
    /// unprompted, that they were discounting the operator's personal `~/.claude/CLAUDE.md`
    /// and counting only the repo's. Four readers reasoning their way to a distinction the
    /// question never drew is four readers guessing, and the two who went the other way were
    /// not wrong so much as answering a different question — 26 readings landed on the wrong
    /// side of a rule nobody had stated. A global instructions file says nothing about the
    /// code being predicted, which is the only thing this field is about.
    #[serde(default)]
    pub primed: bool,
    /// Which instruction files the repo held when this reading landed, comma-joined.
    ///
    /// Stamped server-side from [`crate::assessment::agent_docs`], beside `body`, `by` and
    /// `at`, and for their reason. It is also the thing that gives `primed` meaning: an
    /// unprimed reading in a repo with no instructions file is trivially true, and the same
    /// reading here says a run was deliberately launched without them. Stamped rather than
    /// recomputed later because a repo can gain or lose a `CLAUDE.md` at any time, and the
    /// question is what was true when somebody read.
    #[serde(default, rename = "agentDocs")]
    pub agent_docs: String,
    /// [`crate::assessment::body_hash`] of the body this reading was made against.
    ///
    /// Filled in by the server from the scan, never by the reporter — an agent asked to
    /// hash what it just read would have to be trusted to do it, and this is the one
    /// field whose whole job is to be checkable later. Empty on readings that predate
    /// the committed store; see `assessment::is_stale`.
    #[serde(default)]
    pub body: String,
    /// Which model made this reading, name and version, as it reported itself.
    ///
    /// Self-declared, like `cold`, and weak for the same reason — but the alternative is
    /// a panel that says "an agent (MCP)" for every reading ever banked, which puts a
    /// frontier model and something small and cheap behind one label. The metric is a
    /// claim about what a competent reader could predict, so *which* reader is part of
    /// the reading. Empty on reports banked before the field existed; the UI falls back
    /// rather than inventing an attribution.
    #[serde(default)]
    pub model: String,
    /// Which model the RUN asked for, stamped server-side beside what the reader says it is.
    ///
    /// **`model` alone cannot answer the question it exists for.** It is self-declared, so a
    /// reading that says `claude-sonnet-4.5` is evidence of what the process believed it
    /// was, and nothing else — and the failure worth catching is a repo quietly read on two
    /// scales, where the thing that changed is what somebody ASKED for. Sanity spawns the
    /// readers now, so the request is a fact it holds at the moment of the report and does
    /// not have to take anybody's word for. It is stamped on the same rule as `body`, `by`,
    /// `at` and `agent_docs`: the fields whose job is to be checkable later cannot be
    /// self-certified.
    ///
    /// Empty when no model was named — the harness picked, which is itself the answer, and
    /// the one `sanity check` warns about out loud.
    ///
    /// **Not a graded input**, so it is out of `reading_hash` and did not move `SPEC`.
    /// Recording who was asked changes nothing about what the reader was asked.
    #[serde(default)]
    pub asked: String,
    /// Which agent Sanity ran to take this reading, stamped server-side.
    ///
    /// **The harness is part of the instrument, not packaging around it.** The same model
    /// id reads differently through two agents — a different system prompt, a different
    /// tool surface, a different amount of its context already spent before it sees the
    /// first function — so `read by claude-sonnet-4.6` is only half an attribution when
    /// that model can be reached through Claude Code and through Antigravity both.
    ///
    /// It is also what makes an agent PRESELECTABLE. The machine-local project index
    /// remembers which agent reads a repo, which is right for a preference and useless as
    /// a record: a repo read on somebody else's laptop, or read by hand over MCP, arrives
    /// with an index that has never heard of it while its `.sanity/` is full of readings.
    /// The corpus is the thing that travels, so the corpus is asked.
    ///
    /// Empty for a reading taken outside a run Sanity started. **Not a graded input** — out
    /// of `reading_hash`, no `SPEC` movement.
    #[serde(default)]
    pub harness: String,
    /// When this reading was taken, UTC, stamped server-side — see `assessment::now_iso`.
    ///
    /// Sortable, and the only thing in a reading that is. `at` is the commit the code was
    /// at, which every reading in one sitting shares; `by` is a person. Empty on everything
    /// banked before this existed, which is why anything reading it has to cope with a
    /// corpus that is partly undated. **Not a graded input** — out of `reading_hash`, no
    /// `SPEC` movement, nothing expires.
    #[serde(default)]
    pub when: String,
    /// Set on the way OUT when `legible` was graded under a superseded question.
    ///
    /// Computed here rather than in the browser, and that is the whole point of the split:
    /// the store records which spec a reading was taken under, and the code decides what
    /// each spec changed. Mirroring `LEGIBLE_SINCE` into TypeScript would put that decision
    /// in two places, and the copy nobody is looking at is the one that goes wrong — which
    /// is exactly how a whole repo's readings lost `derivable`.
    ///
    /// The grade itself is NOT cleared. It is what a reader said, and the panel shows it as
    /// history the same way it shows a stale reading; what it must not do is color a wedge
    /// or count toward a dial. Deleting the reader's answer to make the display simpler
    /// would be destroying evidence to avoid writing a conditional.
    #[serde(default, rename = "legibleDated")]
    pub legible_dated: bool,
    /// The same, for `trap` — see [`crate::assessment::TRAP_SINCE`]. Two flags rather than
    /// one "this reading is dated": the axes moved at different specs and a reading can be
    /// current on one and superseded on the other, so a single flag would grey out a
    /// legibility grade to report a trap question that changed.
    ///
    /// It is also the narrower of the two, and deliberately: a `false` from an older spec
    /// survives, because every change to this question has REMOVED things from it and a
    /// narrowing cannot turn a no into a yes. Only the `true`s are dated.
    #[serde(default, rename = "trapDated")]
    pub trap_dated: bool,
    /// Which reading spec this was taken under — see [`crate::assessment::SPEC`].
    ///
    /// Stamped server-side in the `report` handler, beside `body`, `by` and `at`, and for
    /// the same reason those are: a field whose whole job is to be checkable later cannot
    /// be self-certified. A reader asked to declare which question it was answering could
    /// claim the one that makes its answer look current, which is precisely the claim this
    /// exists to test.
    ///
    /// `0` on everything written before the spec existed, which is not a gap — it is the
    /// answer. An unversioned reading was taken under an unknown question.
    #[serde(default)]
    pub spec: u32,
    /// Whose git identity was configured when the reading was made.
    #[serde(default)]
    pub by: String,
    /// The short commit the repo was at. Empty outside a git repo.
    #[serde(default)]
    pub at: String,
}

impl Report {
    /// An empty reading, for parsers and tests to fill in field by field.
    pub fn blank() -> Report {
        Report {
            id: String::new(),
            // Stamped when the window asks, never stored — see the fields.
            loc: 0,
            stale: false,
            expected: String::new(),
            found: String::new(),
            paged: None,
            asked: String::new(),
            harness: String::new(),
            when: String::new(),
            surprised: false,
            predicted: None,
            documented: None,
            derivable: false,
            legible: None,
            trap: false,
            test: None,
            note: String::new(),
            cold: false,
            position: None,
            primed: false,
            agent_docs: String::new(),
            model: String::new(),
            body: String::new(),
            spec: 0,
            legible_dated: false,
            trap_dated: false,
            by: String::new(),
            at: String::new(),
        }
    }

    /// The two grades, with two rules applied that the grades themselves do not carry.
    ///
    /// An old report only knew surprised-or-not, so it maps to the ends of the scale.
    /// Coarse, but it is what that reader actually said — inventing a middle grade for
    /// it would be making up a judgement nobody made.
    ///
    /// And **`derivable` forces `documented` to `None`**, whatever grade the reader gave:
    /// a doc a model could regenerate from the body explains nothing that was not already
    /// there. That rule lived only in the inline comment below, so the number this returns
    /// was not the number the reader reported and nothing visible from outside said so —
    /// a cold reader predicted this function, found the override, and pointed out that the
    /// TypeScript mirror `reportGrades` documents both rules while this one documents one.
    pub fn grades(&self) -> (Grade, Option<Grade>) {
        let predicted =
            self.predicted.unwrap_or(if self.surprised { Grade::None } else { Grade::Full });
        // A doc the code already implies is not documentation, whatever grade it was
        // given — this is the provenance rule, applied at the point of use so no caller
        // can forget it.
        let documented = if self.derivable { Some(Grade::None) } else { self.documented };
        (predicted, documented)
    }
}
