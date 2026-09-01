# Open, and why it is not done yet

Not a backlog. Each entry is something decided-but-unbuilt, or measured-and-rejected, with
enough of the reasoning that picking it up does not mean rediscovering the argument. An item
leaves this file by being built or by being written up in the note it belongs to.

## In-product documentation of what the parser can read

The app knows exactly which languages it reads, which of them resolve calls (28 of ~60), and
which extensions it deliberately refuses — `.m` is Objective-C so MATLAB ships nowhere, `.v` is
Verilog so V does not, and `conventions.md` records why each was decided rather than guessed.
None of that is reachable from inside the app.

What it costs today: a wedge drawn grey under Callers is indistinguishable from a wedge with no
callers unless you have read `parse.rs`, and a repo whose language is unsupported looks like a
repo with no functions in it. The literal node-kind matching exists to make that loud in a test;
it is silent in the window.

## Complexity counts eleven languages of sixty-three

`parse::branch_kinds` has tables for Rust, TypeScript, TSX, JavaScript, Python, Go, C, C++,
Java, C# and Ruby. Every other language returns `None`, which the lens draws grey and says
`language not counted` — honest, and useless on a repo written in one of the other fifty-two.
Swift, Kotlin, PHP, Scala, Elixir, Zig, Lua, Haskell, Shell and Objective-C are all absent, and
several of them are what somebody's whole project is in.

This is the live gap in the newest lens, and it is the one that decides whether it works on a
given repo rather than in principle. Adding one is small: a list of node kinds, read off a real
parse, plus a line in `kinds::branch_kinds_are_real` which fails if any of them is not a kind
that grammar emits. The test is the whole safety net — a kind that does not exist matches
nothing and looks exactly like a language whose code never branches.

It shares a root with the item above it: the app cannot say what it can and cannot read, so a
grey wedge is indistinguishable from a simple one until you have read `parse.rs`.

## Mode lists that are kept by hand

Four of them decide what a lens does, and a new lens has to be added to each. Three times this
session one was missed, and every one of those failures drew a picture that looked fine:

| list | what it decides | what a missing lens looked like |
|---|---|---|
| `STANDS_IN` | may a file answer for its own functions | every container one flat shade |
| `bandLabels` | which bands a breakdown sorts by | rows in arrival order |
| `rampOf` | which ramp a lens paints from | green legend over a gold map |
| `contributeCols`'s guard | may a ring-less file answer at all | its lines missing from the rim |

`STANDS_IN` is a `Record<ColorMode, boolean>` now, so a thirteenth lens fails the build. The
other three are still `if` chains that fall through to a default. They should be records too —
the work is small and the failure mode is that nothing fails.

## Complexity: built, and what the first attempt got wrong

Shipped as the `tangle` lens. Kept here because the two rejected shapes are the useful part:
somebody will propose both again.

**Depth was measured and is not a lens.** Four variants — syntax-tree max and mean, indentation
max and mean — over five repos, all of them 0.67–0.88 rank correlation with line count, against
a bar of 0.38 (what the real Surprise grades score against the same). Depth measures how much
code sits inside blocks, which is volume, and the map already spends its width on volume. A
mean did not decorrelate it, because longer bodies really are deeper on average. Indentation
additionally reports 52–92% of a repo at one level or less and puts wrapped argument lists at
the bright end.

**A branch COUNT is not one either**, for the same reason at 0.48–0.68. What works is the count
measured against what is normal for a body that size, which takes it to 0.19, −0.03, 0.07 and
0.25 — independent of length, and independent of Surprise at 0.05 and 0.06.

The mistake worth remembering: depth failing was taken as evidence that branches would fail,
and the cost of the per-grammar table was used as a reason not to run the test. The test never
needed the table — a keyword scan settles 0.2-against-0.8 fine — and the table turned out to be
worth paying for.

**Still open on it.** `&&` and `||` are not counted: the node is `binary_expression` in most
grammars and covers `a + b` just as much, so it needs operator text per language. Leaving them
out moved kibana's independence from 0.16 to 0.22 and changed nothing on two other repos.
See the coverage item above for which grammars have tables.

## The wheel is full at eleven, and the twelfth lens is standing outside it

`index.css` orders hue by menu position so the switcher reads as a set. That rule plus heat's
pin — amber, because it must read as heat — means the FIRST row can only ever take the arc
above 74°, and everything in that arc is gold. Complexity's colour was a theorem, not a choice.

Two ways out were priced. Unpinning `age` widens the arc and works, but the first lens stays a
yellow-green and it moves the whole cool half: chips 13.3 → 12.4, hot 13.5 → 13.2, six ramps
recoloured under anybody who had learned them. Standing Complexity outside the ordering costs
one menu row whose colour does not continue the run, and nothing else — every margin is exactly
what it was for eleven. That is what shipped, at 329°.

**So a thirteenth ramp has no home.** The wheel is full: eleven hues at ~30° apart, and the one
genuinely empty region — between the clone and trap MARKS — is now taken. The next lens either
pays the re-solve, stands outside as this one does, or is not a ramp at all.

**Two gaps in the scorer, both worth closing before it is trusted again.** `--clone` is not one
of the floors ramps are scored against, so hues 4° and 10° from it score as FREE; both were
rejected by hand. And `start_from_pins` assumed the menu opens on a pinned hue and that no lens
sits past the last pin — fixed here, but only because a twelfth lens made both false.
