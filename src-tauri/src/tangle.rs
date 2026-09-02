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
/// Roughly doubling. **Not deciles of the repo's own distribution**, which was the obvious
/// alternative and is wrong here: deciles move when the repo does, so adding a hundred small
/// helpers would re-band every large function and recolour a map nobody had touched. Fixed
/// edges mean a body's band is a fact about the body.
///
/// **It stopped at 199 and that broke the lens's own promise at the top.** The last band is
/// open, so every body past the last edge shared one median — measured on this repo, that band
/// held bodies of 203 lines and bodies of 3,014 lines, judged against the same number. "This
/// body against the others its SIZE" is the whole claim, and it was the largest bodies, the
/// ones anybody opens this lens to find, where it was least true. On kibana it was a real
/// error rather than an inelegance: a 500-line body was compared against 17 when the median
/// for bodies actually its size is 30.
///
/// The doubling simply continues. What makes that safe on a repo too small to fill the new
/// bands is [`MIN_BAND`], not a shorter list.
pub const EDGES: [u32; 8] = [14, 24, 49, 99, 199, 399, 799, 1599];

/// How many bodies a band needs before its median is a fact rather than a coincidence.
///
/// **A finer ladder is only an improvement where there is something in it.** Split naively,
/// this repo's top band holds two bodies — so the largest function here would be compared
/// against ITSELF and one other, and would read as perfectly normal. That is worse than the
/// over-broad band it replaced, and it fails silently, in the one place somebody is looking.
///
/// So a band under this is folded into the band BELOW it — shorter bodies, of which there are
/// always more — and the merged group shares one median. Sparsity is always at the top, so
/// the fold runs downward and stops as soon as a band can stand on its own. On this repo that
/// collapses everything past 199 back into a single 200+ band, which is exactly what shipped
/// before and is the most a repo this size can honestly support; on kibana it leaves 200–399,
/// 400–799 and 800+ standing apart.
///
/// Thirty because a median over fewer is noise, and the number this is defending is a claim
/// about what is NORMAL. Folding down rather than reporting `None` because `None` falls back
/// to the raw count, which saturates at 15 — every large body in a small repo would read fully
/// hot, which is a statement about the ladder rather than about the code.
pub const MIN_BAND: usize = 30;

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
#[serde(rename_all = "camelCase")]
pub struct Bands {
    /// Indexed by [`band_of`]. Serialised for the window, which names them in the panel.
    ///
    /// Bands folded together by [`MIN_BAND`] hold the SAME median — that is what folding
    /// means — so this array is still indexed by a body's own band and nothing that reads it
    /// has to know about the fold.
    pub median: [Option<u32>; BANDS],
    /// The shortest and longest body the band's median was measured over, per band.
    ///
    /// **Carried because the panel names the population out loud**, and after a fold the
    /// band's own edges are not what it was measured over: a 2,000-line body in a repo whose
    /// top bands folded is compared against everything over 199, and a caption reading
    /// `typical for repo (1600+ lines)` would be describing a population that was never used.
    /// A lens that shows its work has to show the right work.
    ///
    /// `None` for a band nothing landed in.
    pub over: [Option<(u32, u32)>; BANDS],
}

impl Bands {
    /// Derive the bands from every function the scan could count.
    ///
    /// Only bodies whose language has a branch table — see `parse::branch_kinds`. A language
    /// nobody has taught contributes no zeroes, because a zero it did not measure would drag
    /// every band down and make the languages that ARE counted look tangled by comparison.
    pub fn of(funcs: impl Iterator<Item = (u32, u32)>) -> Bands {
        let mut seen: Vec<Vec<(u32, u32)>> = vec![Vec::new(); BANDS];
        for (loc, cognitive) in funcs {
            seen[band_of(loc)].push((loc, cognitive));
        }
        // **A band with nothing in it stays empty, and that rule comes first.** Folding is for
        // a band that has bodies but too few of them; a band nobody has written a body for has
        // no opinion at all, and borrowing one from below would report the first big function
        // anybody writes as catastrophic — measured against ten-line helpers. That is the
        // trade `ramp` already refuses by falling back to the raw count, and it is why this
        // walks over the NON-EMPTY bands rather than over all of them.
        //
        // It is reachable: a replay reads a historical body against HEAD's bands, so a size
        // nothing at HEAD occupies is a real lookup rather than a hypothetical.
        let filled: Vec<usize> = (0..BANDS).filter(|i| !seen[*i].is_empty()).collect();
        // `group[i]` is the band whose population band `i` is measured against — itself, or
        // the nearest filled band below it once the thin ones have folded.
        let mut group: Vec<usize> = (0..BANDS).collect();
        let mut carried: Vec<Vec<(u32, u32)>> = seen.clone();
        // From the top, because sparsity is only ever at the top: there are always more short
        // bodies than long ones.
        for w in filled.windows(2).rev() {
            let (below, this) = (w[0], w[1]);
            if carried[this].len() >= MIN_BAND {
                continue;
            }
            let taken = std::mem::take(&mut carried[this]);
            carried[below].extend(taken);
            // Everything already pointing at `this` follows it down, or a three-deep fold
            // leaves the top band pointing at a band that has itself moved.
            for g in group.iter_mut() {
                if *g == this {
                    *g = below;
                }
            }
        }
        let mut median = [None; BANDS];
        let mut over = [None; BANDS];
        for v in carried.iter_mut() {
            v.sort_unstable_by_key(|p| p.1);
        }
        for i in 0..BANDS {
            let v = &carried[group[i]];
            // Its own band was empty, so it is not measured against anything — see above.
            if seen[i].is_empty() || v.is_empty() {
                continue;
            }
            median[i] = Some(v[v.len() / 2].1);
            let lo = v.iter().map(|p| p.0).min().unwrap_or(0);
            let hi = v.iter().map(|p| p.0).max().unwrap_or(0);
            over[i] = Some((lo, hi));
        }
        Bands { median, over }
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

    /// The window computes this arithmetic too, and only during a REPLAY.
    ///
    /// **The one place a ramp is solved twice, and the reason is that a frame has no scan.**
    /// Every other lens receives its position already computed: `scan()` runs here and hands
    /// `Score::tangle` over the wire. A timeline cannot — it carries a raw count per function
    /// per commit, because that is what is small enough to send — so `colorMode.ts` has a
    /// `tangleRamp` beside this one, and two implementations of one answer is how the map and
    /// the replay come to disagree about a colour.
    ///
    /// Sending the positions instead was priced: two numbers per changed function per commit
    /// rather than one, and the medians would have to exist before the first frame is emitted,
    /// which means a second pass over the whole walk. This test is the cheaper half of that
    /// trade, and it is only worth anything if it actually reads the other file.
    #[test]
    fn the_window_solves_the_same_ramp_this_module_does() {
        // **Read at RUN time, not `include_str!`.** Cargo does not track a file outside the
        // crate, so an included copy is whatever it was the last time Rust happened to
        // rebuild — this test went green against a `colorMode.ts` that had been edited to
        // disagree with it, which is the exact failure it exists to catch.
        let path = concat!(env!("CARGO_MANIFEST_DIR"), "/../web/src/lib/colorMode.ts");
        let src = std::fs::read_to_string(path).expect("the window's source is beside ours");
        let of = |name: &str| {
            let at = src
                .find(&format!("const {name} = "))
                .unwrap_or_else(|| panic!("{name} is gone from colorMode.ts — did it move?"));
            let rest = &src[at + name.len() + 9..];
            rest[..rest.find('\n').expect("a line")].trim().trim_end_matches(';').to_string()
        };
        assert_eq!(of("TANGLE_RAW_HOT"), RAW_HOT.to_string(), "the absolute bar");
        assert_eq!(of("TANGLE_WEIGHTED_HOT"), WEIGHTED_HOT.to_string(), "the ratio anchor");
        let edges = format!("[{}]", EDGES.map(|e| e.to_string()).join(", "));
        assert_eq!(of("TANGLE_EDGES"), edges, "the size bands");
    }

    #[test]
    fn a_body_is_banded_by_its_own_length() {
        assert_eq!(band_of(1), 0);
        assert_eq!(band_of(14), 0);
        assert_eq!(band_of(15), 1);
        assert_eq!(band_of(200), 5);
        assert_eq!(band_of(100_000), EDGES.len(), "the top band is open, or a generated file falls out");
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

    /// **The top band is open, and without a floor that is where the lens breaks.**
    ///
    /// Measured on this repo before the ladder was extended: one band held bodies of 203 lines
    /// and bodies of 3,014, against a single median. Extending the edges alone makes it worse
    /// on a small repo — the top band ends up holding two bodies, so the largest function in
    /// the repo is compared against ITSELF and reads as perfectly normal. Both halves are
    /// pinned here.
    #[test]
    fn a_band_too_thin_to_have_an_opinion_borrows_the_one_below_it() {
        // A repo shaped like a real one: plenty of small bodies, a handful of large, and two
        // enormous. The two enormous ones are the whole point — alone in the top band, their
        // own median is themselves.
        let repo = (0..200)
            .map(|i| (30u32, i % 5))
            .chain((0..40).map(|i| (250u32, 20 + i % 7)))
            .chain([(2_400u32, 300u32), (3_000, 400)]);
        let bands = Bands::of(repo);

        // The top band folded into the 200–399 one, which is the nearest below it with bodies
        // in it, because two is not a population.
        assert_eq!(bands.median[band_of(2_400)], bands.median[band_of(250)]);
        // ...and having folded, it is NOT reporting itself as normal.
        let [weighted, _] = bands.ramp(2_400, 300);
        assert!(weighted > 0.9, "300 against a median in the twenties: {weighted}");
        // The population it was actually measured over is carried, so the caption can name it
        // rather than naming the band's own edges, which is not what it was measured against.
        assert_eq!(bands.over[band_of(2_400)], Some((250, 3_000)));

        // The well-populated band keeps its own answer and is untouched by the fold.
        assert_eq!(bands.median[band_of(30)], Some(2));
        assert_eq!(bands.over[band_of(30)], Some((30, 30)));
    }

    /// A band with bodies in it borrows; a band with none does not.
    ///
    /// **The distinction is the whole reason the fold walks filled bands.** Borrowing from
    /// below is right between neighbours whose medians are close — the top two size bands of a
    /// real repo — and catastrophic across the whole ladder: it would measure the first
    /// five-hundred-line function anybody writes against ten-line helpers, which is the trade
    /// `ramp`'s raw fallback exists to refuse.
    #[test]
    fn a_size_nobody_has_written_borrows_nothing() {
        let bands = Bands::of((0..200).map(|i| (10u32, i % 3)));
        assert_eq!(bands.median[band_of(500)], None, "nothing that size has been measured");
        let [weighted, raw] = bands.ramp(500, 30);
        assert_eq!(weighted, raw, "so the count is all it can honestly be given");
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
