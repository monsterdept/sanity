//! Complexity, calibrated against the size of the thing being measured.
//!
//! **A longer function is naturally more complicated, and the useful question is whether it is
//! more complicated than its length suggests.** That framing is the whole module. The raw
//! count — `parse::cognitive_of`, every fork costing one plus one for each fork it nests
//! inside — is a real number and it is offered, but on its own it is largely a restatement of
//! line count, which the map already spends its width on. Measured: rank correlation with
//! `loc` of 0.48–0.68 for the count, against 0.09–0.39 for the readings a lens is supposed to
//! beat.
//!
//! Comparing each body against OTHER BODIES ITS SIZE takes that to nothing: 0.19, −0.03, 0.07
//! and 0.25 across sanity, godot, ladybird and kibana. It is also orthogonal to the lens it
//! advertises — 0.05 and 0.06 against the real Surprise grades — so it does not make the paid
//! reading look redundant. It asks a different question and hands the answer over.
//!
//! # Why bands and not a fitted curve
//!
//! A median inside a size band is explainable in a sentence — *compared with the other
//! functions this size, in this repo* — and a regression is not. It is also robust in the way
//! this corpus needs: a handful of generated files with four hundred forks moves a mean and
//! does nothing to a median.
//!
//! # Why per repo
//!
//! The same doctrine `ageSpanOf` and `edits::windows_for` follow, and for the same reason. The
//! median cognitive score of a 100–199 line function is 34 in godot and 6 in kibana — C++ with
//! real control flow against TypeScript that mostly declares things. A fixed threshold would
//! call one of those repos uniformly tangled and the other uniformly clean, which is a
//! statement about languages rather than about anybody's code.
//!
//! What it costs is comparability across repos, knowingly, exactly as Age and Churn already
//! pay it.

/// The upper line count of each size band but the last.
///
/// Six bands, roughly doubling. **Not deciles of the repo's own distribution**, which was the
/// obvious alternative and is wrong here: deciles move when the repo does, so adding a hundred
/// small helpers would re-band every large function and recolour a map nobody had touched.
/// Fixed edges mean a body's band is a fact about the body.
pub const EDGES: [u32; 5] = [14, 24, 49, 99, 199];

/// How many bands there are.
pub const BANDS: usize = EDGES.len() + 1;

/// Which band a body of `loc` lines falls in.
pub fn band_of(loc: u32) -> usize {
    EDGES.iter().position(|e| loc <= *e).unwrap_or(EDGES.len())
}

/// The count at which the RAW reading reads fully hot.
///
/// **Fifteen, which is the published default and not a number picked to make a map look
/// good.** Cognitive complexity ships with a threshold of 15 per function in the tool that
/// defined it, so a reader who has met the measure before meets the same number here. This is
/// the one figure in the module that is deliberately absolute: the raw reading exists for the
/// person who wants to triage against a bar rather than against their own repo, and a bar that
/// moved per repo would not be one.
pub const RAW_HOT: f32 = 15.0;

/// The ratio at which the WEIGHTED reading reads fully hot.
///
/// Four times the median of its own size band. Measured rather than chosen: across the four
/// repos the top decile of functions sits at 3.0–4.75× and the top percentile at 5.5–11×, so
/// four puts roughly a tenth of a repo in the top half of the ramp and leaves the extreme tail
/// saturated, which is what a ramp is for.
pub const WEIGHTED_HOT: f32 = 4.0;

/// The median cognitive score of each size band, for one repo.
///
/// `None` for a band nothing landed in — a repo with no 200-line functions has no opinion
/// about what is normal for one, and inventing a median from the band below would report the
/// first big function anybody writes as catastrophic.
#[derive(Debug, Clone, Default, serde::Serialize, serde::Deserialize)]
pub struct Bands {
    /// Indexed by [`band_of`]. Serialised for the window, which names them in the panel.
    pub median: [Option<u32>; BANDS],
}

impl Bands {
    /// Derive the bands from every function the scan could count.
    ///
    /// Only bodies whose language has a branch table — see `parse::branch_kinds`. A language
    /// nobody has taught contributes no zeroes, because a zero it did not measure would drag
    /// every band down and make the languages that ARE counted look tangled by comparison.
    pub fn of(funcs: impl Iterator<Item = (u32, u32)>) -> Bands {
        let mut seen: Vec<Vec<u32>> = vec![Vec::new(); BANDS];
        for (loc, cognitive) in funcs {
            seen[band_of(loc)].push(cognitive);
        }
        let mut median = [None; BANDS];
        for (i, v) in seen.iter_mut().enumerate() {
            if v.is_empty() {
                continue;
            }
            v.sort_unstable();
            median[i] = Some(v[v.len() / 2]);
        }
        Bands { median }
    }

    /// The two readings for one body, each on the 0..1 scale the ramp paints.
    ///
    /// Index 0 is WEIGHTED and index 1 is RAW — see `TangleRead` in the window, which is the
    /// control that picks between them.
    ///
    /// **Normal sits at the cold end, not in the middle.** A body at its band's median is not
    /// a finding, and every other lens here puts the end you have to act on at the bright one.
    /// The cost is real and worth naming: *simpler than its size suggests* is a true and
    /// occasionally interesting reading, and it is not drawn — everything at or below normal is
    /// one colour. Making it visible needs a divergent ramp, which this app does not have and
    /// which is a bigger decision than this lens.
    pub fn ramp(&self, loc: u32, cognitive: u32) -> [f32; 2] {
        let raw = (cognitive as f32 / RAW_HOT).clamp(0.0, 1.0);
        let weighted = match self.median[band_of(loc)] {
            // A band's median can be zero — most short functions do not branch at all — and
            // dividing by it would report every function that branches once as infinitely
            // worse than normal. Floored at one, which reads as "one fork is the unit".
            Some(m) => {
                let ratio = cognitive as f32 / (m.max(1) as f32);
                ((ratio - 1.0) / (WEIGHTED_HOT - 1.0)).clamp(0.0, 1.0)
            }
            // Nothing this size has been measured here, so there is no normal to be worse
            // than. The raw reading is all this body can honestly be given.
            None => raw,
        };
        [weighted, raw]
    }

    /// How many times its band's median this body is, for a caption. `None` where the band is
    /// empty — see `median`.
    pub fn times_normal(&self, loc: u32, cognitive: u32) -> Option<f32> {
        self.median[band_of(loc)].map(|m| cognitive as f32 / (m.max(1) as f32))
    }

    pub fn is_empty(&self) -> bool {
        self.median.iter().all(Option::is_none)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_body_is_banded_by_its_own_length() {
        assert_eq!(band_of(1), 0);
        assert_eq!(band_of(14), 0);
        assert_eq!(band_of(15), 1);
        assert_eq!(band_of(200), 5);
        assert_eq!(band_of(100_000), 5, "the top band is open, or a generated file falls out");
    }

    /// The reading the lens is FOR: two bodies with the same score, one of them ten times the
    /// size of the other, and only the small one is a finding.
    #[test]
    fn the_same_score_is_a_finding_on_a_small_body_and_not_on_a_large_one() {
        // A repo where 10-line functions normally score 1 and 100-line ones normally score 20.
        let bands = Bands::of(
            (0..50)
                .map(|_| (10u32, 1u32))
                .chain((0..50).map(|_| (100u32, 20u32))),
        );
        let small = bands.ramp(10, 8);
        let large = bands.ramp(100, 8);
        assert!(small[0] > 0.9, "eight forks in ten lines is eight times normal: {small:?}");
        assert_eq!(large[0], 0.0, "eight forks in a hundred lines is better than normal");
        // ...and the raw reading, which is the other setting, cannot tell them apart at all.
        assert_eq!(small[1], large[1], "raw is a count and a count does not know about size");
    }

    /// A band nothing landed in has no opinion, and must not borrow one.
    #[test]
    fn an_empty_band_falls_back_to_the_raw_count() {
        let bands = Bands::of((0..20).map(|_| (10u32, 1u32)));
        assert_eq!(bands.median[band_of(500)], None);
        let [weighted, raw] = bands.ramp(500, 30);
        assert_eq!(weighted, raw, "no normal to be worse than, so the count is all there is");
        assert_eq!(bands.times_normal(500, 30), None);
    }

    /// A median of zero is the common case in the smallest band — most short bodies never
    /// branch — and dividing by it would make one `if` infinitely worse than normal.
    #[test]
    fn a_band_whose_median_is_zero_does_not_divide_by_it() {
        let bands = Bands::of((0..20).map(|_| (5u32, 0u32)));
        assert_eq!(bands.median[0], Some(0));
        let [weighted, _] = bands.ramp(5, 1);
        assert!(weighted.is_finite() && weighted == 0.0, "one fork is the unit, not a finding");
        let [worse, _] = bands.ramp(5, 8);
        assert!(worse > 0.9, "eight of them is: {worse}");
    }
}
