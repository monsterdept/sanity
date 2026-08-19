#!/usr/bin/env python3
"""Solve the sunburst's ramp hues, rather than picking them.

`index.css` says "Re-solve, don't eyeball" over the five lens ramps and then describes a
search nobody could re-run: the constraints are written down, the numbers they produced are
written down, and the thing that produced them was not. So the first release that wanted a
sixth lens had no way to add one honestly. This is that search, written down.

WHAT A RAMP IS. Five stops on one shared lightness profile, so switching lens never changes
what "hot" looks like — only which question is being asked. Chroma climbs with lightness so
the bottom of every scale looks like nothing is wrong, which is what the data says about most
code. A lens is therefore ONE NUMBER: its hue.

WHAT THE SEARCH OPTIMISES. The worst CIEDE2000 distance between any two ramps' cold ends and
any two ramps' hot ends, under NORMAL VISION — and that is a deliberate difference from how
the categorical palette below it in `index.css` is scored, which is all-pairs across the three
dichromacies too. The two are scored differently because they carry meaning differently. A
categorical slot IS its color: lose the hue and an author is unidentifiable, so it has to
survive every viewer. A ramp carries its reading in the shared lightness climb, which every
viewer sees — index.css says so where it explains legibility's violet, "it takes the same
dark->light climb as the others, which is what carries the reading for anyone who cannot
separate the hues". Hue on a ramp only has to answer "which question am I looking at", and the
switcher above the map answers that too. Scoring ramps under dichromacy anyway was tried here
first and it is not a stricter version of the same search — it is a different one, and it
rejects the palette that shipped.

Validated by reproduction: `verify` recomputes every margin `index.css` states — worst hot
pair 27.2, cold ends 14-19 apart, heat at 11.5/36.0 against the unanalyzed neutral, docs the
tight one at 20.5 against --trap — and prints them beside what the file claims. If those stop
matching, this script is wrong and nothing it recommends can be trusted.

WHAT IT CONSTRAINS.
  - 170-240 degrees is barred for every lens. Cyan sat 40 degrees from churn's blue and made
    docs and churn one color; the fix was to bar the region rather than to nudge.
  - Surprise is pinned to amber. It has to read as heat.
  - Every cold end clears dE 10 from --unanalyzed in both themes. Draining to neutral would
    put "cold" on top of "nobody has looked at this", which is the one distinction this app
    exists to be able to state.
  - Every hot end clears dE 15 from --trap, which is drawn over the same wedges.

  Usage:  palette-search.py verify        reproduce the shipped five and their margins
          palette-search.py add N         hold those five, search N more hues
          palette-search.py flat          one standalone accent, for a lens that is not a ramp
"""

import math
import sys

# ── color math ───────────────────────────────────────────────────────────────────────────
def srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def linear_to_srgb(c):
    return 12.92 * c if c <= 0.0031308 else 1.055 * c ** (1 / 2.4) - 0.055


def hex_to_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i : i + 2], 16) / 255 for i in (0, 2, 4))


def rgb_to_hex(rgb):
    return "#" + "".join(f"{round(max(0.0, min(1.0, c)) * 255):02x}" for c in rgb)


# OKLab, Björn Ottosson's matrices.
def linear_to_oklab(r, g, b):
    l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b
    m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b
    s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b
    l_, m_, s_ = l ** (1 / 3) if l > 0 else 0, m ** (1 / 3) if m > 0 else 0, s ** (1 / 3) if s > 0 else 0
    return (
        0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
        1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
        0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_,
    )


def oklab_to_linear(L, a, b):
    l_ = L + 0.3963377774 * a + 0.2158037573 * b
    m_ = L - 0.1055613458 * a - 0.0638541728 * b
    s_ = L - 0.0894841775 * a - 1.2914855480 * b
    l, m, s = l_**3, m_**3, s_**3
    return (
        +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
        -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
        -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
    )


def oklch_to_hex(L, C, h_deg):
    """An OKLCH triple as sRGB hex, with chroma reduced until it fits the gamut.

    Clamping the CHANNELS instead would silently move both lightness and hue, which is how a
    ramp comes to be non-monotone at the top end where sRGB runs out — the file already notes
    churn's blue being gamut-clamped there."""
    h = math.radians(h_deg)
    lo, hi = 0.0, C
    for _ in range(40):
        mid = (lo + hi) / 2
        rgb = oklab_to_linear(L, mid * math.cos(h), mid * math.sin(h))
        # Strictly inside, with no epsilon. A tolerance of 1e-4 here is enough to land one
        # 8-bit step more saturated at the two stops where sRGB runs out, which moved the
        # docs hot end close enough to --trap to change the margin by 1.3 — so the check
        # below stopped reproducing. The gamut boundary is the boundary.
        if all(0.0 <= c <= 1.0 for c in rgb):
            lo = mid
        else:
            hi = mid
    rgb = oklab_to_linear(L, lo * math.cos(h), lo * math.sin(h))
    return rgb_to_hex(tuple(linear_to_srgb(max(0.0, min(1.0, c))) for c in rgb))


# CIE Lab (D65) — CIEDE2000 is defined on it, not on OKLab.
_M = [
    [0.4124564, 0.3575761, 0.1804375],
    [0.2126729, 0.7151522, 0.0721750],
    [0.0193339, 0.1191920, 0.9503041],
]
_WP = (0.95047, 1.0, 1.08883)


def hex_to_lab(h):
    r, g, b = (srgb_to_linear(c) for c in hex_to_rgb(h))
    xyz = [sum(_M[i][j] * v for j, v in enumerate((r, g, b))) for i in range(3)]
    f = []
    for v, w in zip(xyz, _WP):
        t = v / w
        f.append(t ** (1 / 3) if t > 216 / 24389 else (841 / 108) * t + 4 / 29)
    return (116 * f[1] - 16, 500 * (f[0] - f[1]), 200 * (f[1] - f[2]))


def ciede2000(lab1, lab2):
    L1, a1, b1 = lab1
    L2, a2, b2 = lab2
    C1, C2 = math.hypot(a1, b1), math.hypot(a2, b2)
    Cb = (C1 + C2) / 2
    G = 0.5 * (1 - math.sqrt(Cb**7 / (Cb**7 + 25**7))) if Cb > 0 else 0.5
    a1p, a2p = (1 + G) * a1, (1 + G) * a2
    C1p, C2p = math.hypot(a1p, b1), math.hypot(a2p, b2)
    h1p = math.degrees(math.atan2(b1, a1p)) % 360 if (a1p or b1) else 0
    h2p = math.degrees(math.atan2(b2, a2p)) % 360 if (a2p or b2) else 0
    dLp, dCp = L2 - L1, C2p - C1p
    if C1p * C2p == 0:
        dhp = 0
    elif abs(h2p - h1p) <= 180:
        dhp = h2p - h1p
    else:
        dhp = h2p - h1p - 360 if h2p > h1p else h2p - h1p + 360
    dHp = 2 * math.sqrt(C1p * C2p) * math.sin(math.radians(dhp) / 2)
    Lbp, Cbp = (L1 + L2) / 2, (C1p + C2p) / 2
    if C1p * C2p == 0:
        hbp = h1p + h2p
    elif abs(h1p - h2p) <= 180:
        hbp = (h1p + h2p) / 2
    elif h1p + h2p < 360:
        hbp = (h1p + h2p + 360) / 2
    else:
        hbp = (h1p + h2p - 360) / 2
    T = (
        1
        - 0.17 * math.cos(math.radians(hbp - 30))
        + 0.24 * math.cos(math.radians(2 * hbp))
        + 0.32 * math.cos(math.radians(3 * hbp + 6))
        - 0.20 * math.cos(math.radians(4 * hbp - 63))
    )
    dTh = 30 * math.exp(-(((hbp - 275) / 25) ** 2))
    Rc = 2 * math.sqrt(Cbp**7 / (Cbp**7 + 25**7)) if Cbp > 0 else 0
    Sl = 1 + (0.015 * (Lbp - 50) ** 2) / math.sqrt(20 + (Lbp - 50) ** 2)
    Sc, Sh = 1 + 0.045 * Cbp, 1 + 0.015 * Cbp * T
    Rt = -math.sin(math.radians(2 * dTh)) * Rc
    return math.sqrt(
        (dLp / Sl) ** 2 + (dCp / Sc) ** 2 + (dHp / Sh) ** 2 + Rt * (dCp / Sc) * (dHp / Sh)
    )


# Machado, Oliveira & Fernandes 2009, severity 1.0.
_CVD = {
    "protan": [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
    "deutan": [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]],
    "tritan": [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.303900]],
}


def simulate(h, kind):
    if kind == "normal":
        return h
    m = _CVD[kind]
    r, g, b = (srgb_to_linear(c) for c in hex_to_rgb(h))
    out = [sum(m[i][j] * v for j, v in enumerate((r, g, b))) for i in range(3)]
    return rgb_to_hex(tuple(linear_to_srgb(max(0.0, min(1.0, c))) for c in out))


VIEWS = ("normal", "protan", "deutan", "tritan")


def worst(a, b):
    """The smallest CIEDE2000 between two colors across every viewer.

    For the CATEGORICAL palette, where color is identity. The lens ramps use `plain` — see
    the module docstring for why the two are scored differently."""
    return min(ciede2000(hex_to_lab(simulate(a, v)), hex_to_lab(simulate(b, v))) for v in VIEWS)


def plain(a, b):
    """CIEDE2000 under normal vision. How the lens ramps are scored."""
    return ciede2000(hex_to_lab(a), hex_to_lab(b))


# ── the ramps ────────────────────────────────────────────────────────────────────────────
# The shared profile every lens is built on. Read off the shipped ramps, which is what makes
# `verify` a real check: if these were wrong the reproduction would not match.
L_PROFILE = [0.443, 0.538, 0.627, 0.721, 0.804]
C_PROFILE = [0.048, 0.071, 0.094, 0.117, 0.140]

# Read back off the shipped stops rather than remembered. Chroma is gamut-clamped at the top
# for churn and docs, which `oklch_to_hex` reproduces by reducing chroma rather than clipping
# channels — clipping would move lightness and hue and break the shared profile silently.
SHIPPED = {"heat": 74.0, "churn": 244.0, "legible": 312.0, "docs": 24.0, "age": 124.0}

# What `index.css` actually holds, so `verify` compares against the file rather than against a
# remembered number. Reconstruction lands on these to within one 8-bit step everywhere; the
# two stops that differ (legible-4 and docs-4) are the two where sRGB runs out of gamut, and a
# single channel of rounding there is the whole discrepancy.
SHIPPED_STOPS = {
    "heat": ["#634f35", "#87683d", "#aa7f43", "#d09949", "#f4b04a"],
    "churn": ["#3c576c", "#497395", "#538ebd", "#5face9", "#81c7ff"],
    "legible": ["#5c4c67", "#7c628c", "#9b77b2", "#bd8fda", "#dca5fe"],
    "docs": ["#6c4946", "#935e5a", "#ba716c", "#e58681", "#fea39c"],
    "age": ["#4e583a", "#657546", "#7c9250", "#96b15b", "#acce63"],
}
BARRED = (170, 240)
# Drawn over the same wedges as every ramp, so both are floors rather than preferences.
NEUTRAL = {"light": "#b3aca3", "dark": "#4a4642"}
TRAP = {"light": "#ff4f95", "dark": "#ff5ea1"}
# The agent outline and the directory fill are drawn over the same wedges as every ramp, so
# they are floors too — and they were missing from the first version of this search, which
# duly recommended a teal one step from `--agent-mark`. A constraint you forget is not a
# constraint the picture forgets.
MARK = {"light": "#358189", "dark": "#42a2ab"}
STRUCTURE = {"light": "#d0c9bd", "dark": "#38342f"}
# 14.0 rather than 15: the shipped five clear 14.3, and a floor stricter than the incumbent is
# not a fair test of a newcomer.
COLD_FLOOR, HOT_FLOOR, MARK_FLOOR = 10.0, 15.0, 14.0


def ramp(hue):
    return [oklch_to_hex(L, C, hue) for L, C in zip(L_PROFILE, C_PROFILE)]


def margins(hues):
    """(worst cold pair, worst hot pair, worst cold-vs-neutral, worst hot-vs-trap)."""
    ramps = {k: ramp(h) for k, h in hues.items()}
    keys = list(ramps)
    cold = min(
        (plain(ramps[a][0], ramps[b][0]) for i, a in enumerate(keys) for b in keys[i + 1 :]),
        default=math.inf,
    )
    hot = min(
        (plain(ramps[a][4], ramps[b][4]) for i, a in enumerate(keys) for b in keys[i + 1 :]),
        default=math.inf,
    )
    vs_neutral = min(plain(r[0], n) for r in ramps.values() for n in NEUTRAL.values())
    vs_trap = min(plain(r[4], t) for r in ramps.values() for t in TRAP.values())
    vs_mark = min(plain(c, m) for r in ramps.values() for c in r for m in list(MARK.values()) + list(STRUCTURE.values()))
    return cold, hot, vs_neutral, vs_trap, vs_mark


def legal(hue):
    return not (BARRED[0] <= hue <= BARRED[1])


def add(n):
    """Hold the shipped hues and search for `n` more. Existing lenses do not move: a palette
    change that recolors Churn to make room for a new lens costs every user the map they have
    already learned, and that is a worse trade than a slightly tighter margin."""
    best = None
    grid = [h for h in range(0, 360, 2) if legal(h)]
    picks = [[]]
    for _ in range(n):
        picks = [p + [h] for p in picks for h in grid if not p or h > p[-1]]
    print(f"searching {len(picks)} assignments for {n} new hue(s)…")
    for pick in picks:
        hues = dict(SHIPPED)
        for i, h in enumerate(pick):
            hues[f"new{i}"] = float(h)
        cold, hot, vn, vt, vm = margins(hues)
        if vn < COLD_FLOOR or vt < HOT_FLOOR or vm < MARK_FLOOR:
            continue
        score = min(cold, hot)
        if best is None or score > best[0]:
            best = (score, pick, cold, hot, vn, vt, vm)
    if not best:
        print("NOTHING CLEARS THE FLOORS — the wheel is full at this ramp count.")
        return 1
    score, pick, cold, hot, vn, vt, vm = best
    print(f"\nbest worst-pair {score:.1f}  (cold {cold:.1f}, hot {hot:.1f})")
    print(f"floors: cold vs unanalyzed {vn:.1f} (>= {COLD_FLOOR}), hot vs trap {vt:.1f} (>= {HOT_FLOOR}), any stop vs mark/structure {vm:.1f} (>= {MARK_FLOOR})")
    for i, h in enumerate(pick):
        print(f"\nnew hue {i}: {h} degrees")
        for j, c in enumerate(ramp(float(h))):
            print(f"  --new{i}-{j}: {c};")
    return 0


def flat():
    """One standalone color, for a lens that is not a ramp.

    `add` says the wheel is full: a sixth ramp hue costs the worst pair 14.3 -> 9.4 and lands
    30 degrees from churn, which is the cyan-against-blue failure `index.css` describes, at the
    same distance. So the wiring lenses do not get a ramp — Reach is two states and an absence
    (the shape Traps already established), and Locality mixes from the structural neutral
    toward this one color.

    A flat color is a far smaller ask than a ramp because it is only ever on screen under its
    own lenses. It has to be told apart from what sits BESIDE it there — the directory fill,
    the unread neutral, the agent outline, the trap pink and the page — and from nothing else."""
    against = {
        "structure": ("#d0c9bd", "#38342f"),
        "unanalyzed": ("#b3aca3", "#4a4642"),
        "agent-mark": ("#358189", "#42a2ab"),
        "trap": ("#ff4f95", "#ff5ea1"),
        "background": ("#f5f1ea", "#1a1a1a"),
    }
    best = None
    for L in [x / 100 for x in range(45, 81, 2)]:
        for C in [x / 1000 for x in range(60, 181, 10)]:
            for h in range(0, 360, 2):
                hexv = oklch_to_hex(L, C, h)
                m = min(plain(hexv, v) for pair in against.values() for v in pair)
                if best is None or m > best[0]:
                    best = (m, hexv, L, C, h)
    m, hexv, L, C, h = best
    print(f"best flat accent {hexv}   (L {L} C {C} h {h}deg)")
    print(f"worst margin {m:.1f} against:")
    for k, pair in against.items():
        print(f"  {k:<12} {min(plain(hexv, v) for v in pair):.1f}")
    return 0


def verify():
    """Reproduce the shipped palette, and say so or fail.

    The check is against the STOPS, not against the margins. A margin is one number summarising
    twenty-five colors and two of those colors could be wrong without moving it; and the tightest
    margin here (docs against --trap) is driven by a single channel at the gamut boundary, so
    comparing margins to one decimal would fail on rounding while comparing them loosely would
    pass on nonsense. Channel-exact-to-one is the property that actually says this script models
    the palette."""
    cold, hot, vn, vt, vm = margins(SHIPPED)
    print("shipped five:")
    worst_step = 0
    for k, h in SHIPPED.items():
        got, want = ramp(h), SHIPPED_STOPS[k]
        steps = [
            max(abs(round(a * 255) - round(b * 255)) for a, b in zip(hex_to_rgb(g), hex_to_rgb(w)))
            for g, w in zip(got, want)
        ]
        worst_step = max(worst_step, max(steps))
        flag = "" if max(steps) == 0 else f"   <- off by {max(steps)}/255"
        print(f"  {k:<8} {h:>5.0f}deg  {' '.join(got)}{flag}")
    print(f"\nworst cold pair      {cold:.1f}   (index.css says 14-19 apart)")
    print(f"worst hot pair       {hot:.1f}   (index.css says 27.2)")
    print(f"cold vs unanalyzed   {vn:.1f}   (index.css says worst 11.5)")
    print(f"hot vs trap          {vt:.1f}   (index.css says docs is tight at 20.5)")
    print(f"any stop vs mark/str {vm:.1f}")
    ok = worst_step <= 1
    print("\n" + (f"REPRODUCES the shipped palette (worst stop off by {worst_step}/255)."
                   if ok else f"DOES NOT REPRODUCE — worst stop off by {worst_step}/255."))
    return 0 if ok else 1


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "verify"
    if cmd == "verify":
        sys.exit(verify())
    if cmd == "flat":
        sys.exit(flat())
    sys.exit(add(int(sys.argv[2]) if len(sys.argv) > 2 else 1))
