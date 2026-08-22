//! Persistent scores, so analysis survives closing the app.
//!
//! **Currently only [`Cache::ephemeral`] is reachable.** The persistence half existed for
//! the Ollama path, where a scan ran for tens of minutes and losing it to a quit was
//! unacceptable; the offline proxy rescans a whole repo in about a second, so there is
//! nothing worth keeping and a cache would only be a file that disagrees with the code.
//! Kept rather than deleted because a local model would want it back on the same terms —
//! but nothing writes `scores/` today, and if that stays true this should go.
//!
//! A model pass over a real repo runs for tens of minutes. Throwing that away because
//! someone quit the app — or because they want to look at the same project again
//! tomorrow — makes the model path something you use once to see if it works, rather than
//! something you actually live with.
//!
//! Entries are **content-addressed**: the key includes a hash of the function body, so
//! resuming and incremental rescanning are the same mechanism. Edit a function and it is
//! re-scored because its hash moved; edit its neighbor and it is not. Move it down the
//! file and nothing happens at all, because line numbers are deliberately not part of
//! the key — otherwise adding an import at the top of a file would invalidate every
//! score in it.

use crate::surprise::{Hotspot, Reading};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

/// Bumped when the meaning of a stored score changes — a new calibration curve, a
/// different prompt, a change to what surprisal is measured over. Without it, a cache
/// written by an older build silently pins wedges to numbers this build would never
/// produce, and the map becomes a mix of two instruments with no way to tell which.
const FORMAT_VERSION: u32 = 1;

#[derive(Debug, Clone, Serialize, Deserialize)]
struct Entry {
    body_hash: u64,
    surprise: f32,
    /// Cached alongside the score: they were produced by the same call, and a resumed
    /// scan that recovered the number but lost the evidence would show a hot wedge with
    /// nothing to say about why.
    #[serde(default)]
    hotspots: Vec<Hotspot>,
}

#[derive(Debug, Default, Serialize, Deserialize)]
struct Stored {
    version: u32,
    /// Which model produced these. A different model is a different instrument, so
    /// switching invalidates everything rather than blending two scales in one picture.
    model: String,
    entries: HashMap<String, Entry>,
}

pub struct Cache {
    path: Option<PathBuf>,
    model: String,
    inner: Mutex<Stored>,
    /// Writes since the last flush. The app can be closed at any moment, so the cache
    /// is written during the scan rather than only at the end — that is the whole point.
    dirty: Mutex<usize>,
}

/// Flush after this many new scores. Small enough that a kill loses seconds of work,
/// large enough that a fast model isn't rewriting the file hundreds of times a minute.
const FLUSH_EVERY: usize = 25;

/// Key for one function: where it lives, what it's called, what it says, and what its
/// documentation says. Line numbers are excluded on purpose — see the module docs.
///
/// The DOC is part of the key because it is part of the prompt. The model is given the
/// comment stack a reader would have, so editing a comment changes the question and must
/// change the answer. Keyed on the body alone, writing documentation would have served
/// the pre-documentation score back out of the cache for ever — the map would simply
/// stop draining, in the one interaction the whole tool is built around, and it would
/// look like the metric had failed rather than the cache.
pub fn key(path: &str, name: &str, body: &str, doc: Option<&str>) -> (String, u64) {
    let mut h = fnv(body.as_bytes());
    if let Some(d) = doc {
        h ^= fnv(d.as_bytes()).rotate_left(1);
    }
    (format!("{path}#{name}"), h)
}

/// Named for FNV-1a's shape; the multiplier is not FNV-1a's prime. See the twin in
/// `heuristic.rs` for why it stays wrong and the name stays honest about it.
fn fnv(bytes: &[u8]) -> u64 {
    let mut h: u64 = 0xcbf2_9ce4_8422_2325;
    for b in bytes {
        h ^= *b as u64;
        h = h.wrapping_mul(0x1000_0000_01b3);
    }
    h
}

impl Cache {
    /// A cache with nowhere to write. Used by tests and by the headless scanner, where
    /// persisting across runs would make experiments non-reproducible.
    pub fn ephemeral() -> Cache {
        Cache {
            path: None,
            model: String::new(),
            inner: Mutex::new(Stored::default()),
            dirty: Mutex::new(0),
        }
    }

    /// Load the cache for `repo` scored by `model`, if one exists and still applies.
    pub fn open(repo: &Path, model: &str) -> Cache {
        let path = Self::path_for(repo, model);
        let stored = path
            .as_ref()
            .and_then(|p| std::fs::read_to_string(p).ok())
            .and_then(|s| serde_json::from_str::<Stored>(&s).ok())
            // A cache from another model or an older format is not merged or migrated —
            // it is dropped. Half-stale scores are worse than a slow rescan, because
            // nothing on screen would tell you which wedges came from where.
            .filter(|s| s.version == FORMAT_VERSION && s.model == model)
            .unwrap_or_else(|| Stored {
                version: FORMAT_VERSION,
                model: model.to_string(),
                entries: HashMap::new(),
            });
        Cache { path, model: model.to_string(), inner: Mutex::new(stored), dirty: Mutex::new(0) }
    }

    /// One file per (repo, model).
    ///
    /// The model belongs in the *filename*, not just in a field inside it. Keyed on the
    /// repo alone, every scorer shared one file and whichever ran last won — so the
    /// offline proxy pass, which runs immediately before every model pass, flushed an
    /// empty cache over the model's accumulated scores and resume never worked once.
    /// Separate files also mean switching models and switching back doesn't throw away
    /// the first model's work.
    fn path_for(repo: &Path, model: &str) -> Option<PathBuf> {
        let dir = crate::reports::data_dir()?.join("scores");
        std::fs::create_dir_all(&dir).ok()?;
        // Hashed rather than escaped: repo paths and model names contain separators and
        // characters that are illegal in filenames on at least one platform we ship to.
        let id = fnv(repo.to_string_lossy().as_bytes());
        let m = fnv(model.as_bytes());
        Some(dir.join(format!("{id:016x}-{m:016x}.json")))
    }

    pub fn get(&self, key: &(String, u64)) -> Option<Reading> {
        let inner = self.inner.lock().ok()?;
        inner
            .entries
            .get(&key.0)
            .filter(|e| e.body_hash == key.1)
            .map(|e| Reading { surprise: e.surprise, hotspots: e.hotspots.clone() })
    }

    pub fn put(&self, key: &(String, u64), reading: &Reading) {
        if let Ok(mut inner) = self.inner.lock() {
            inner.entries.insert(
                key.0.clone(),
                Entry {
                    body_hash: key.1,
                    surprise: reading.surprise,
                    hotspots: reading.hotspots.clone(),
                },
            );
        }
        let should_flush = match self.dirty.lock() {
            Ok(mut d) => {
                *d += 1;
                if *d >= FLUSH_EVERY {
                    *d = 0;
                    true
                } else {
                    false
                }
            }
            Err(_) => false,
        };
        if should_flush {
            self.flush();
        }
    }

    /// Write to a temp file and rename. A half-written cache that fails to parse costs a
    /// full rescan, and the likeliest moment to be interrupted is exactly when the app is
    /// being killed mid-scan — which is the case this whole module exists for.
    pub fn flush(&self) {
        let Some(path) = &self.path else { return };
        let Ok(inner) = self.inner.lock() else { return };
        let Ok(json) = serde_json::to_string(&*inner) else {
            return;
        };
        let tmp = path.with_extension("json.tmp");
        if std::fs::write(&tmp, json).is_ok() {
            let _ = std::fs::rename(&tmp, path);
        }
    }

    pub fn model(&self) -> &str {
        &self.model
    }

    pub fn len(&self) -> usize {
        self.inner.lock().map(|i| i.entries.len()).unwrap_or(0)
    }

    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The same tripwire `scancache` carries, for the same reason. See the twin there.
    ///
    /// Nothing has gone wrong here yet — `hotspots` was defaulted from the first commit,
    /// and the heuristic's computation has not moved since, so version 1 is honest. The
    /// test is not about the past. It is that this cache pins the COLOR of every wedge a
    /// model never scored, and the failure mode next door was invisible for months: a
    /// `#[serde(default)]` field lets an old record load as current, and nothing complains.
    #[test]
    fn a_new_cached_field_cannot_be_added_silently() {
        let e = Entry {
            body_hash: 1,
            surprise: 0.5,
            hotspots: vec![crate::surprise::Hotspot {
                text: "x".into(),
                expected: vec!["y".into()],
                bits: 1.0,
            }],
        };
        let v: serde_json::Value = serde_json::to_value(&e).expect("Entry serialises");
        let mut keys: Vec<&str> =
            v.as_object().expect("an object").keys().map(|k| k.as_str()).collect();
        keys.sort_unstable();
        assert_eq!(
            keys,
            vec!["body_hash", "hotspots", "surprise"],
            "the cached score's fields changed — bump FORMAT_VERSION, then update this list"
        );
    }

    #[test]
    fn two_models_never_share_a_cache_file() {
        // The regression this guards: the proxy pass runs immediately before every model
        // pass, and when both wrote the same file it wiped the model's scores every time.
        let repo = Path::new("/tmp/repo");
        let a = Cache::path_for(repo, "heuristic (no model)");
        let b = Cache::path_for(repo, "ollama · llama3.2:3b");
        assert!(a.is_some() && b.is_some());
        assert_ne!(a, b);
    }

    #[test]
    fn a_hit_needs_the_same_body_not_just_the_same_name() {
        let c = Cache::ephemeral();
        let k = key("src/a.rs", "run", "let x = 1;", None);
        c.put(&k, &Reading::plain(0.8));
        assert_eq!(c.get(&k).map(|r| r.surprise), Some(0.8));

        // Same function, edited — must miss, or the map keeps showing a score for code
        // that no longer exists.
        let edited = key("src/a.rs", "run", "let x = 2;", None);
        assert!(c.get(&edited).is_none());
    }

    #[test]
    fn moving_a_function_within_a_file_does_not_invalidate_it() {
        // Line numbers are not part of the key, so adding an import at the top of a file
        // must not force a rescan of everything below it.
        let a = key("src/a.rs", "run", "body", None);
        let b = key("src/a.rs", "run", "body", None);
        assert_eq!(a, b);
    }

    #[test]
    fn renaming_or_moving_a_function_misses() {
        let c = Cache::ephemeral();
        c.put(&key("src/a.rs", "run", "body", None), &Reading::plain(0.5));
        assert!(c.get(&key("src/a.rs", "walk", "body", None)).is_none());
        assert!(c.get(&key("src/b.rs", "run", "body", None)).is_none());
    }

    #[test]
    fn an_ephemeral_cache_never_touches_disk() {
        let c = Cache::ephemeral();
        c.put(&key("a", "b", "c", None), &Reading::plain(1.0));
        c.flush();
        assert_eq!(c.len(), 1);
    }

    #[test]
    fn a_cache_written_by_another_model_is_dropped_not_merged() {
        // **It never called `open`.** This planted a file, read it back with plain serde and
        // asserted `"old-model" != "new-model"` — true by construction, and green with the
        // filter in `open` deleted. A test named for a rule has to run the rule.
        let _home = crate::agentapi::tests::data_home();
        let repo = std::path::Path::new("/repo/under/test");
        let plant = |model: &str| {
            let stored = Stored {
                version: FORMAT_VERSION,
                model: model.into(),
                entries: HashMap::from([(
                    "src/a.rs#run".to_string(),
                    Entry { body_hash: 1, surprise: 0.9, hotspots: Vec::new() },
                )]),
            };
            let path = Cache::path_for(repo, model).expect("a data dir");
            std::fs::write(&path, serde_json::to_string(&stored).unwrap()).unwrap();
        };
        let key = ("src/a.rs#run".to_string(), 1u64);

        plant("old-model");
        assert!(
            Cache::open(repo, "old-model").get(&key).is_some(),
            "its own model reads its own file, or the rest of this proves nothing"
        );

        // The same entry, reached by a different instrument. One file per (repo, model), so
        // this is the case where the filename collides only if `path_for` stops keying on the
        // model — which is the other half of the same rule.
        assert!(
            Cache::open(repo, "new-model").get(&key).is_none(),
            "a score from another model is dropped, never merged"
        );

        // And an older FORMAT_VERSION under the RIGHT model, which is the second clause of
        // the filter and the one no name comparison can stand in for.
        let stale = Stored {
            version: FORMAT_VERSION - 1,
            model: "old-model".into(),
            entries: HashMap::from([(
                "src/a.rs#run".to_string(),
                Entry { body_hash: 1, surprise: 0.9, hotspots: Vec::new() },
            )]),
        };
        let path = Cache::path_for(repo, "old-model").expect("a data dir");
        std::fs::write(&path, serde_json::to_string(&stale).unwrap()).unwrap();
        assert!(
            Cache::open(repo, "old-model").get(&key).is_none(),
            "an older format is dropped by the same filter"
        );
    }
}
