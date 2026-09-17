//! Where the surprise number comes from.
//!
//! The definition the whole product rests on: **boilerplate is code a model can predict
//! from its context.** Feed a function its name, signature and neighbors; measure how
//! surprised the model is by the body. Low surprise is scaffolding. High surprise is
//! where the thinking is.
//!
//! What the app computes itself is an honest **proxy**, not the metric — no model, no setup,
//! no network (see `heuristic.rs`). The measurement the product is
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
//! the plainer question better. A no-server local scorer followed it for the same reason.
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
//! Its cost was one decode step per token of every body scored, which is why the whole thing
//! wanted a persistent cache — and why, once it was gone, the `SurpriseModel` trait, the score
//! cache and the scan's second pass that fed it went too: one implementation, the proxy, was
//! left behind a trait asking whether it was a model.

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
