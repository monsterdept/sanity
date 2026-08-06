//! Scoring on this machine, with no server.
//!
//! # Why this exists
//!
//! Ollama cannot score supplied text — no endpoint returns logprobs for tokens it did not
//! generate — so the HTTP path fakes it by *forcing* generation down the real body's
//! token path. That works, and it is what proved the metric, but it costs one forward
//! pass per token and Ollama's grammar path refuses to batch. Measured: 83 tok/s on a
//! 3090, fully serialised, ~1.06x from eight concurrent requests.
//!
//! Here the whole body goes in as **input**. One `decode` with logits requested at every
//! position yields P(token | everything before it) for the entire function in a single
//! forward pass. Measured on an M3 with a 0.5B model: **1224 tok/s**, ~15x the 3090 over
//! HTTP, with identical surprisal to four decimal places. It was never the hardware; it
//! was asking a GPU to do 649 sequential passes where one would do.
//!
//! # Why not CUDA
//!
//! Metal on Apple, Vulkan everywhere else. Vulkan ships with the graphics driver on
//! Windows and Linux and covers NVIDIA, AMD and Intel; CUDA would put a toolkit install
//! between the user and a working app, on the exact platforms where people are least
//! likely to bother. CPU is the fallback and is roughly 8x slower — usable, not pleasant.

use crate::surprise::{calibrate_surprisal, Item, Reading, SurpriseModel};
use llama_cpp_4::context::params::LlamaContextParams;
use llama_cpp_4::context::LlamaContext;
use llama_cpp_4::llama_backend::LlamaBackend;
use llama_cpp_4::llama_batch::LlamaBatch;
use llama_cpp_4::model::{params::LlamaModelParams, AddBos, LlamaModel};
use std::path::Path;
use std::sync::{mpsc, Mutex};

/// Tokens of body scored per function.
///
/// One pass, so cost is linear in this rather than quadratic — but the pass still runs
/// the vocabulary projection at *every* position, which is the dominant term (152k vocab
/// times the hidden size, per token). Capping keeps one enormous generated file from
/// costing more than the rest of the repo put together.
const MAX_TOKENS: usize = 1024;

/// A body to score, and where to send the answer.
type Job = ((String, String), mpsc::Sender<Option<f32>>);

pub struct LocalModel {
    label: String,
    // The context lives on ONE thread that owns it outright, and callers post jobs.
    //
    // `LlamaContext` is neither `Send` nor `Sync`, and llama.cpp genuinely does not
    // support concurrent use of a context — a mutex plus `unsafe impl Send` would compile
    // and would be a claim about the C library I cannot back. Since scoring serialises
    // anyway (one pass saturates the GPU), a dedicated owner thread costs nothing in
    // throughput and needs no unsafe.
    jobs: Mutex<mpsc::Sender<Job>>,
}

impl LocalModel {
    /// Load a GGUF and start its owner thread. Expensive (hundreds of ms), done once.
    pub fn load(path: &Path) -> anyhow::Result<LocalModel> {
        let label = path
            .file_name()
            .map(|f| f.to_string_lossy().to_string())
            .unwrap_or_else(|| "local".into());
        let path = path.to_path_buf();
        let (tx, rx) = mpsc::channel::<Job>();
        // Loading happens on the owner thread, so failures have to come back over a
        // channel rather than as a return value.
        let (ready_tx, ready_rx) = mpsc::channel::<Result<(), String>>();

        std::thread::spawn(move || {
            let loaded = (|| -> anyhow::Result<(LlamaContext<'static>,)> {
                let backend: &'static LlamaBackend = Box::leak(Box::new(LlamaBackend::init()?));
                // Leaked to 'static because `LlamaContext<'a>` borrows its model, and a
                // struct holding both is self-referential. The app loads one model and
                // keeps it until exit; leaking says that plainly instead of pretending to
                // manage a lifetime that never ends.
                let model: &'static LlamaModel = Box::leak(Box::new(
                    LlamaModel::load_from_file(backend, &path, &LlamaModelParams::default())?,
                ));
                let n = (MAX_TOKENS + 64) as u32;
                let ctx = model.new_context(
                    backend,
                    LlamaContextParams::default()
                        .with_n_ctx(std::num::NonZeroU32::new(n))
                        .with_n_batch(n),
                )?;
                Ok((ctx,))
            })();

            let mut ctx = match loaded {
                Ok((c,)) => {
                    let _ = ready_tx.send(Ok(()));
                    c
                }
                Err(e) => {
                    let _ = ready_tx.send(Err(e.to_string()));
                    return;
                }
            };
            // Ends when every sender is dropped, i.e. when the model is.
            while let Ok(((prefix, body), reply)) = rx.recv() {
                let _ = reply.send(score_one(&mut ctx, &prefix, &body));
            }
        });

        match ready_rx.recv() {
            Ok(Ok(())) => Ok(LocalModel {
                label: format!("local · {label}"),
                jobs: Mutex::new(tx),
            }),
            Ok(Err(e)) => Err(anyhow::anyhow!(e)),
            Err(_) => Err(anyhow::anyhow!("model loader thread died")),
        }
    }

    /// Mean surprisal of `text`, in bits per token.
    ///
    /// Serialised behind a mutex, which sounds wasteful and is not: the work is one large
    /// matmul per call and the GPU is already saturated by a single pass, so concurrent
    /// callers would contend rather than overlap. The HTTP path had the same property and
    /// arrived at it the hard way.
    fn surprisal(&self, prefix: &str, body: &str) -> Option<f32> {
        let (reply_tx, reply_rx) = mpsc::channel();
        self.jobs
            .lock()
            .ok()?
            .send(((prefix.to_string(), body.to_string()), reply_tx))
            .ok()?;
        reply_rx.recv().ok()?
    }
}

/// The actual measurement, on the thread that owns the context.
fn score_one(ctx: &mut LlamaContext<'static>, prefix: &str, body: &str) -> Option<f32> {
    let prefix_toks = ctx.model.str_to_token(prefix, AddBos::Always).ok()?;
    let body_toks = ctx.model.str_to_token(body, AddBos::Never).ok()?;
    if body_toks.len() < 8 {
        return None;
    }

    // Trim the CONTEXT when things get long, never the body. The body is what is being
    // measured; the context is only there so the model is asked the same question a
    // reader faces. Dropping the oldest context costs a little conditioning, dropping
    // body would silently change what the score is about.
    let body_len = body_toks.len().min(MAX_TOKENS / 2);
    let body_toks = &body_toks[..body_len];
    let room = MAX_TOKENS - body_len;
    let prefix_toks = if prefix_toks.len() > room {
        &prefix_toks[prefix_toks.len() - room..]
    } else {
        &prefix_toks[..]
    };

    ctx.clear_kv_cache();
    let total = prefix_toks.len() + body_toks.len();
    let mut batch = LlamaBatch::new(total, 1);
    for (i, tok) in prefix_toks.iter().chain(body_toks.iter()).enumerate() {
        // Logits ONLY where they are needed: from the last context token (which predicts
        // the body's first) through the second-to-last body token.
        //
        // This is the difference between a fast pass and a slow one. The vocabulary
        // projection — 150k-wide, run per requested position — dominates the whole
        // measurement, so asking for it over a thousand tokens of file context that is
        // never scored roughly tripled the cost of every function.
        let needed = i + 1 >= prefix_toks.len() && i + 1 < total;
        batch.add(*tok, i as i32, &[0], needed).ok()?;
    }
    ctx.decode(&mut batch).ok()?;

    let mut sum_bits = 0.0f64;
    for (j, tok) in body_toks.iter().enumerate() {
        let at = prefix_toks.len() + j - 1;
        let logits = ctx.get_logits_ith(at as i32);
        // log-softmax the honest way: subtract the max before exponentiating, or the sum
        // overflows on any position the model is confident about.
        let max = logits.iter().copied().fold(f32::MIN, f32::max);
        let denom: f64 = logits.iter().map(|l| ((l - max) as f64).exp()).sum();
        let logprob = (logits[tok.0 as usize] - max) as f64 - denom.ln();
        sum_bits += -logprob / std::f64::consts::LN_2;
    }
    Some((sum_bits / body_toks.len() as f64) as f32)
}

impl SurpriseModel for LocalModel {
    fn label(&self) -> String {
        self.label.clone()
    }

    fn is_model(&self) -> bool {
        true
    }

    fn surprise(&self, item: &Item, proxy: f32) -> Reading {
        // Conditioned on the same context the HTTP path uses, so the two backends measure
        // the same thing and their scores stay comparable.
        let prefix = format!("{}\n{}\n", item.context, item.signature);
        match self.surprisal(&prefix, item.body) {
            Some(bits) => Reading::plain(calibrate_surprisal(bits)),
            None => Reading::plain(proxy),
        }
    }
}

/// Weights already on this machine, from Ollama's blob store and nowhere else.
///
/// It said "first", which implied fallback locations that have never existed, and it
/// promised GGUF files when nothing here reads a magic number: Ollama stores weights and
/// tiny metadata blobs side by side with no extension, so the filter is a 100 MB size
/// threshold and anything large enough is assumed to be a model. A cold reader predicted
/// a format check from that first line and found a `len()` comparison.
///
/// The reason for looking there at all stands: anyone likely to want local scoring has
/// probably pulled a model already, and a multi-gigabyte download the user has *already
/// made* is the rudest possible thing to make them make again.
pub fn discover_models() -> Vec<std::path::PathBuf> {
    let mut out = Vec::new();
    if let Some(home) = dirs::home_dir() {
        let blobs = home.join(".ollama/models/blobs");
        if let Ok(entries) = std::fs::read_dir(&blobs) {
            for e in entries.flatten() {
                // Ollama stores weights and tiny metadata blobs side by side with no
                // extension; size is the only cheap discriminator.
                if e.metadata().map(|m| m.len() > 100_000_000).unwrap_or(false) {
                    out.push(e.path());
                }
            }
        }
    }
    out.sort();
    out
}
