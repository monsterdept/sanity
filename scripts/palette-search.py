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
  - Hue runs in MENU ORDER, descending once around the wheel and never doubling back. Eleven
    lenses share one pulldown and each wears its hue on its row, so that menu is the only
    place the palette is ever seen as a set — and a set arriving in no order reads as a wheel
    with colours wedged into it. This is what `order` solves and it costs the cold ends: 12.9
    when hue only had to answer "which question", 8.2 once it also has to answer "in what
    order". The 170-240 bar is gone twice over now — it was barred for a cyan that left, and
    the ordering fills that arc on purpose.
  - Surprise is pinned to amber. It has to read as heat.
  - Every cold end clears dE 10 from --unanalyzed in both themes. Draining to neutral would
    put "cold" on top of "nobody has looked at this", which is the one distinction this app
    exists to be able to state.
  - Every hot end clears dE 15 from --trap, which is drawn over the same wedges.

  Usage:  palette-search.py verify        reproduce the shipped ramps and their margins
          palette-search.py order         re-solve all eleven under the menu's hue ordering
          palette-search.py add N         hold the shipped hues, search N more
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


def hex_to_oklch(h):
    """The other direction, for the two MARKS: they keep the lightness and chroma they were
    solved for and only their hue is placed, so the solver has to read those back off the
    shipped colour rather than assume the ramps' profile."""
    r, g, b = (srgb_to_linear(c) for c in hex_to_rgb(h))
    L, A, B = linear_to_oklab(r, g, b)
    return L, math.hypot(A, B), math.degrees(math.atan2(B, A)) % 360


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
# for reach and legible, which `oklch_to_hex` reproduces by reducing chroma rather than
# clipping channels — clipping would move lightness and hue and break the shared profile
# silently. Churn used to be the clamped one; it was blue then.
SHIPPED = {
    "heat": 74.0,
    "legible": 47.0,
    "docs": 17.0,
    "churn": 144.8,
    "age": 114.0,
    "reach": 236.4,
    "callers": 268.0,
}

# What `index.css` actually holds, so `verify` compares against the file rather than against a
# remembered number. Reconstruction lands on these to within one 8-bit step everywhere; the
# stops that differ are the ones where sRGB runs out of gamut, and a single channel of rounding
# there is the whole discrepancy.
SHIPPED_STOPS = {
    "heat": ["#634f35", "#87683d", "#aa7f43", "#d09949", "#f4b04a"],
    "legible": ["#6a4b3c", "#90614a", "#b77656", "#e18d63", "#ffa67a"],
    "docs": ["#6c494a", "#935d5f", "#ba7074", "#e5858a", "#ffa1a5"],
    "churn": ["#435b43", "#547954", "#639764", "#74b876", "#82d785"],
    "age": ["#535737", "#6d7341", "#878f49", "#a4ad51", "#bec955"],
    "reach": ["#39586b", "#437492", "#4a91ba", "#52b0e4", "#70caff"],
    "callers": ["#48536e", "#5c6d98", "#7086c2", "#85a2ef", "#a4bdff"],
}

# The MENU is the constraint now, and it is what `order` solves. Eleven lenses live in one
# pulldown, each wearing its hue on its row, and that menu is the only place the palette is
# ever seen as a set. So hue descends once around the wheel as you go down it and never
# doubles back — the order itself is semantic and fixed in `colorMode.ts`, so the assignment
# is the only thing free. Five hues are pinned where they already were (heat must read as
# heat, trap must read as an alarm, and clone/callers/age had no reason to move); the other
# six are solved. Two of the eleven are not ramps at all: trap and clone are marks, and blame
# and language are chrome-only chips at the ramps' fourth stop.
# **Eleven, not twelve.** Complexity is deliberately outside this — see `--tangle` in
# `index.css`. Hue follows the menu, and the first row's arc is bounded by a pinned amber, so
# every hue the ordering could give it is gold. Adding it here and re-solving works and costs
# the set: chips 13.3 to 12.4 and six ramps recoloured. Leaving it off costs one menu row whose
# colour does not continue the run.
MENU = ["heat", "legible", "docs", "trap", "clone", "callers", "reach", "blame", "language",
        "age", "churn"]
PINNED = {"heat": 74.0, "trap": 358.0, "clone": 309.0, "callers": 268.0, "churn": 114.0}
# The two chips with no ramp under them: the level a chip quotes is stop 3.
CHIP_L, CHIP_C = L_PROFILE[3], C_PROFILE[3]
CHROME = {"blame": 206.4, "language": 176.8}
# The marks keep their lightness and chroma and only their hue is placed — a trap is meant to
# be the loudest thing in its lens, so it does not join the ramps' chroma.
MARKS = {"trap": {"light": "#ff4f95", "dark": "#ff5ea1"},
         "clone": {"light": "#b026ff", "dark": "#bd5cff"}}

BARRED = None
# Drawn over the same wedges as every ramp, so both are floors rather than preferences.
NEUTRAL = {"light": "#b3aca3", "dark": "#4a4642"}
TRAP = {"light": "#ff4f95", "dark": "#ff5ea1"}
# The directory fill IS drawn over the same wedges as every ramp, so it is a floor — it was
# missing from the first version of this search, which duly recommended a colour one step from
# a thing the map already draws. A constraint you forget is not a constraint the picture
# forgets.
STRUCTURE = {"light": "#d0c9bd", "dark": "#38342f"}
# `--agent-mark` is REPORTED and not enforced, and the difference matters. It was a floor here
# on the belief that it outlines assessed wedges; it does not, and index.css says as much where
# it defines the token — "only for annotation". Its two uses are a paragraph of text and a dot
# in the sidebar, neither of which shares a picture region with a ramp. Enforcing it cost real
# hue: churn at 224 sits 7.9 from the light-mode teal, which is why that number is printed
# rather than hidden, but a status dot in the chrome and a wedge in the ring are not two things
# anybody compares. If the mark is ever drawn ON the map again, this goes back to being a floor
# and churn has to move.
MARK = {"light": "#358189", "dark": "#42a2ab"}
# 14.0 rather than 15: the five that shipped cleared 14.3, and a floor stricter than the
# incumbent is not a fair test of a newcomer.
COLD_FLOOR, HOT_FLOOR, STRUCTURE_FLOOR = 10.0, 15.0, 14.0


def ramp(hue):
    return [oklch_to_hex(L, C, hue) for L, C in zip(L_PROFILE, C_PROFILE)]


def margins(hues):
    """Six worst-case contrasts, in the order the tuple unpacks.

    (cold pair, hot pair, cold-vs-neutral, hot-vs-trap, any-vs-structure, any-vs-mark).
    It named the first four for a while, and a caller unpacking by the docstring was two
    short — the two it left out are the ones the floors below actually reject on.
    """
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
    vs_struct = min(plain(c, v) for r in ramps.values() for c in r for v in STRUCTURE.values())
    vs_mark = min(plain(c, v) for r in ramps.values() for c in r for v in MARK.values())
    return cold, hot, vs_neutral, vs_trap, vs_struct, vs_mark


def legal(hue):
    return BARRED is None or not (BARRED[0] <= hue <= BARRED[1])


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
        cold, hot, vn, vt, vs, _vm = margins(hues)
        if vn < COLD_FLOOR or vt < HOT_FLOOR or vs < STRUCTURE_FLOOR:
            continue
        score = min(cold, hot)
        if best is None or score > best[0]:
            best = (score, pick, cold, hot, vn, vt, vs)
    if not best:
        print("NOTHING CLEARS THE FLOORS — the wheel is full at this ramp count.")
        return 1
    score, pick, cold, hot, vn, vt, vs = best
    print(f"\nbest worst-pair {score:.1f}  (cold {cold:.1f}, hot {hot:.1f})")
    print(f"floors: cold vs unanalyzed {vn:.1f} (>= {COLD_FLOOR}), hot vs trap {vt:.1f} (>= {HOT_FLOOR}), any stop vs structure {vs:.1f} (>= {STRUCTURE_FLOOR})")
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


def chips(hues):
    """What the MENU shows: one colour per lens, at the level a chip quotes.

    A ramp lens quotes its fourth stop. The two marks quote themselves — they keep their own
    lightness and chroma, because a trap is meant to be louder than any ramp — and the two
    chrome-only lenses are built at the ramps' fourth stop so they sit ON the ring rather than
    beside it. Dark-mode marks, because that is the theme the menu was drawn against first and
    the light ones are a shade further from everything."""
    out = {}
    for k, h in hues.items():
        if k in MARKS:
            L, C, _ = hex_to_oklch(MARKS[k]["dark"])
            out[k] = oklch_to_hex(L, C, h)
        elif k in CHROME:
            out[k] = oklch_to_hex(CHIP_L, CHIP_C, h)
        else:
            out[k] = oklch_to_hex(L_PROFILE[3], C_PROFILE[3], h)
    return out


def ordered_score(hues):
    """(objective, cold, hot, chip) for one assignment.

    Three worst-pairs rather than two, because the menu added a third place two lenses can be
    confused: the chip column. They are weighted rather than summed — the cold ends are what
    the ordering constraint actually squeezes, so they lead, and the other two are held above
    their floors rather than optimised."""
    ramps = {k: ramp(h) for k, h in hues.items() if k not in MARKS and k not in CHROME}
    ks = list(ramps)
    cold = min(plain(ramps[a][0], ramps[b][0]) for i, a in enumerate(ks) for b in ks[i + 1:])
    hot = min(plain(ramps[a][4], ramps[b][4]) for i, a in enumerate(ks) for b in ks[i + 1:])
    c = chips(hues)
    cs = list(c)
    chip = min(plain(c[a], c[b]) for i, a in enumerate(cs) for b in cs[i + 1:])
    return min(cold, hot * 0.75, chip * 0.6), cold, hot, chip


def descending(hues):
    """The menu's hues, unwrapped onto a falling line so ordering is a plain comparison."""
    out, prev = [], None
    for k in MENU:
        h = hues[k]
        while prev is not None and h > prev:
            h -= 360
        out.append(h)
        prev = h
    return out


def start_from_pins():
    """Where the ascent begins: the free hues spread evenly across the arcs the pins leave.

    Equal spacing over all eleven was the first start and it converges half a point worse —
    it walks every free hue across a pin's arc before it finds the room, and ascent stops at
    the first ridge. Spacing WITHIN each arc starts the search where the constraint already
    put it, and the pins are what define the arcs, so this is the same solve stated in the
    order the problem has.

    Done on the unwrapped line rather than on the circle: the menu descends through 0 exactly
    once, so subtracting the wrap from every pin turns "between these two pins" into ordinary
    interpolation and the modulo goes back on at the end."""
    # **The anchor is the first PINNED lens, not the first menu row.** Unwrapping needs a hue
    # to measure from and only a pin has one; assuming the menu opens on a pin held for as long
    # as it did because it always had, and broke the moment a free lens went to the top.
    first = next(k for k in MENU if k in PINNED)
    line = {k: PINNED[first] - (PINNED[first] - h) % 360 for k, h in PINNED.items()}
    line[first] = PINNED[first]
    at = [i for i, k in enumerate(MENU) if k in PINNED]
    hues = {}
    # The arc after the LAST pin closes back onto the first one a turn further down the line,
    # and it is where a lens sitting outside every pin lives — above the first pin or below the
    # last, which are the same arc once the menu is read as the circle it is.
    n = len(MENU)
    for lo, hi in zip(at, at[1:] + [at[0] + n]):
        a = line[MENU[lo]]
        b = line[MENU[hi % n]] - (360 if hi >= n else 0)
        span = MENU[lo + 1:] + MENU[:hi % n] if hi >= n else MENU[lo + 1:hi]
        for j, k in enumerate(span, 1):
            hues[k] = (a + (b - a) * j / (hi - lo)) % 360
    hues.update(PINNED)
    return hues


def order():
    """Solve the eleven hues under the menu's ordering constraint.

    Coordinate ascent rather than exhaustive search, and the difference matters: eleven hues
    on a 1-degree grid is 360**11 assignments, and the constraint that makes the problem
    tractable — each hue is boxed between its two neighbours in the menu — is the same one
    that makes ascent from a sensible start reliable here. The start is equal spacing, which
    is what the ordering asks for when nothing is pinned, so the search only has to move hues
    toward the room the pins leave.

    What it reports is the bill, because the bill is the point: ordering costs the cold ends,
    and it costs them where three warm lenses now share the arc two used to have."""
    hues = start_from_pins()
    cur = ordered_score(hues)
    for _ in range(12):
        moved = False
        for i, k in enumerate(MENU):
            if k in PINNED:
                continue
            u = descending(hues)
            lo = (u[i + 1] if i + 1 < len(MENU) else u[0] - 360) + 4
            hi = (u[i - 1] if i else u[-1] + 360) - 4
            best, at = cur, hues[k]
            h = lo
            while h <= hi:
                trial = dict(hues)
                trial[k] = h % 360
                sc = ordered_score(trial)
                if sc[0] > best[0] + 1e-9:
                    best, at = sc, h % 360
                h += 1
            if at != hues[k]:
                hues[k], cur, moved = at, best, True
        if not moved:
            break
    obj, cold, hot, chip = cur
    print(f"worst cold pair {cold:.1f}   worst hot pair {hot:.1f}   worst chip pair {chip:.1f}\n")
    c = chips(hues)
    for i, k in enumerate(MENU):
        pin = " PINNED" if k in PINNED else ""
        print(f"  {i + 1:>2}. {k:<9} {hues[k]:>5.1f}deg  {c[k]}{pin}")
    print("\nramps:")
    for k in MENU:
        if k in MARKS or k in CHROME:
            continue
        print(f"  {k:<9} " + " ".join(ramp(hues[k])))
    print("\nchrome chips:")
    for k in CHROME:
        print(f"  --lens-{k}: {oklch_to_hex(CHIP_L, CHIP_C, hues[k])};")
    print("\nmarks (light / dark):")
    for k in MARKS:
        L, C, _ = hex_to_oklch(MARKS[k]["light"])
        Ld, Cd, _ = hex_to_oklch(MARKS[k]["dark"])
        print(f"  --{k}: {oklch_to_hex(L, C, hues[k])};  dark {oklch_to_hex(Ld, Cd, hues[k])};")
    return 0


def verify():
    """Reproduce the shipped palette, and say so or fail.

    Seven ramps since the wiring lenses got hues of their own, and all of them now placed by
    `order` rather than by the free assignment `add` searches — the menu's hue ordering is the
    binding constraint and it is a stronger one, so `add` is kept for the question it still
    answers (is there room at all) rather than as the thing that chose these.

    The check is against the STOPS, not against the margins. A margin is one number summarising
    twenty-five colors and two of those colors could be wrong without moving it; and the tightest
    margin here (docs against --trap) is driven by a single channel at the gamut boundary, so
    comparing margins to one decimal would fail on rounding while comparing them loosely would
    pass on nonsense. Channel-exact-to-one is the property that actually says this script models
    the palette."""
    cold, hot, vn, vt, vs, vm = margins(SHIPPED)
    print(f"shipped {len(SHIPPED)}:")
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
    print(f"\nworst cold pair      {cold:.1f}   (index.css says 8.2, churn against age)")
    print(f"worst hot pair       {hot:.1f}   (index.css says 13.5, reach against callers)")
    print(f"cold vs unanalyzed   {vn:.1f}   (index.css says worst 11.5, heat)")
    print(f"hot vs trap          {vt:.1f}   (index.css says docs is tight at 16.6)")
    print(f"any stop vs structure {vs:.1f}   (floor {STRUCTURE_FLOOR}; --structure is on the map)")
    print(f"any stop vs agent-mark {vm:.1f}   (reported, NOT a floor — see MARK)")
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
    if cmd == "order":
        sys.exit(order())
    sys.exit(add(int(sys.argv[2]) if len(sys.argv) > 2 else 1))
