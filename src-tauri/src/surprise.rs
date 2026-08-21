//! Where the surprise number comes from.
//!
//! The definition the whole product rests on: **boilerplate is code a model can predict
//! from its context.** Feed a function its name, signature and neighbors; measure how
//! surprised the model is by the body. Low surprise is scaffolding. High surprise is
//! where the thinking is.
//!
//! What ships here is [`HeuristicModel`] — no model, no setup, no network — and it is an
//! honest **proxy**, not the metric (see `heuristic.rs`). The measurement the product is
//! actually built on now arrives from readers over MCP: an agent is given a function's
//! name, signature and neighbors, commits to what it expects, then opens the file. That
//! is the same question asked of something that can answer it.
//!
//! # The model path was here, and what it proved
//!
//! An `OllamaModel` scored bodies by forced decoding — Ollama's `format` takes a JSON
//! schema, and `{"type":"string","const": <the body>}` admits exactly one string, so the
//! logprobs that came back were the probabilities the model assigned to *the code the
//! human actually wrote*. Perplexity, reached sideways: no endpoint will score supplied
//! text, but constraining generation to it is the same arithmetic.
//!
//! It worked, it was measured, and it is gone — not because it failed, but because
//! configuring an endpoint and a model is not what this app is for, and an agent answers
//! the plainer question better. `local.rs` keeps a no-server scorer for `just scan`, which
//! is where metric work belongs.
//!
//! **The findings outlive the code, and they are the reason not to rebuild it naively:**
//!
//! - Generating a rival body and diffing it does not work. Tried three ways — raw
//!   distance, distance weighted by the model's confidence, and both with imports and
//!   siblings in the prompt — and the noise floor sits above the signal, because a model
//!   never reproduces real code token for token whether or not the code was predictable.
//!   Raw distance saturated: on krapow a cobra command definition and a *test function*
//!   both read 100°, alongside genuinely subtle code.
//! - The model's entropy alone grades well and ranks the wrong functions.
//! - Forced decoding scored 6/15 against a `wc -l` sort where the proxy scores 9/15, and
//!   the cobra boilerplate that every earlier design put at 96-98° dropped off entirely.
//!   Heat decoupled from length: a 24-line function at 93° outranked a 107-line one at 50°.
//!
//! Its cost was one decode step per token of every body scored, which is why `min_lines`
//! exists on the trait and why the whole thing wanted a persistent cache.

pub struct Item<'a> {
    pub name: &'a str,
    pub signature: &'a str,
    pub body: &'a str,
    /// The names of the function's peers in the same file. Part of the context a reader
    /// genuinely has, so the model gets it too — otherwise it is being asked a harder
    /// question than the human, and everything scores as surprising.
    pub peers: &'a [String],
    /// Lines in the body. A model path can use it as a cost gate — see
    /// [`SurpriseModel::min_lines`].
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
    /// will actually be visited, and the map can leave the rest uncolored instead of
    /// painting them with a proxy score the user didn't ask for.
    fn min_lines(&self) -> usize {
        0
    }

    /// Whether this scorer is a real model, as opposed to the offline stand-in.
    ///
    /// The map colors only what a model actually looked at. The proxy is measurably
    /// close to sorting by line count (`just scan` prints the baseline), so painting
    /// heat with it is a claim the numbers do not support — those wedges render neutral
    /// instead, and the color arrives when the model does.
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
        Reading { surprise, hotspots: Vec::new() }
    }
}

/// Bits per token → the 0..1 surprise scale.
///
/// Unlike the heuristic's calibration this is not spreading a bell — surprisal is already
/// a meaningful, unbounded quantity, and all this does is choose where the interesting
/// band sits. Highly predictable code runs well under a bit per token; code the model
/// genuinely did not expect runs several bits. Measured on krapow with devstral.
/// Only the local scorer produces bits now that the Ollama path is gone, and that is
/// behind a feature flag — so this is too, rather than sitting here as dead code.
#[cfg(feature = "local-model")]
pub(crate) fn calibrate_surprisal(bits: f32) -> f32 {
    const PREDICTABLE: f32 = 0.5;
    const UNEXPECTED: f32 = 4.0;
    ((bits - PREDICTABLE) / (UNEXPECTED - PREDICTABLE)).clamp(0.0, 1.0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[cfg(feature = "local-model")]
    #[test]
    fn predictable_code_is_cold_and_unexpected_code_is_hot() {
        assert_eq!(calibrate_surprisal(0.2), 0.0);
        assert_eq!(calibrate_surprisal(9.0), 1.0);
        assert!(calibrate_surprisal(1.0) < calibrate_surprisal(3.0));
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
}
