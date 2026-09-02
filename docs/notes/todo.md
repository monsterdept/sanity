# Open, and why it is not done yet

Not a backlog. Each entry is something decided-but-unbuilt, or measured-and-rejected, with
enough of the reasoning that picking it up does not mean rediscovering the argument. An item
leaves this file by being built or by being written up in the note it belongs to.

## In-product documentation of what the parser can read

The app knows exactly which languages it reads, which of them resolve calls (57 of 63), and
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

**Thirty of sixty-three now**, up from eleven: Swift, Kotlin, PHP, Scala, Dart, Lua, Zig,
Shell, Zsh, Perl, Objective-C, GDScript, Julia, Solidity, Groovy, R, OCaml, Erlang and Nix
joined the original eleven. Each was read off a real parse and each is pinned by
`kinds::branch_kinds_are_real`, which fails if a listed kind is not one that grammar emits — the
whole safety net, because a kind that does not exist matches nothing and looks exactly like a
language whose code never branches.

Two are deliberately absent and the reasons are in `branch_kinds`. Elixir's `if`, `case` and
`cond` are macros, so the grammar reports them as `call` nodes and telling them apart needs the
callee's TEXT — a different mechanism, and the first thing here somebody would guess at rather
than read. Haskell's forks are guards and `case` arms, and counting `case` alone charges one for
a twelve-way dispatch, which is the cyclomatic mistake this formula exists to avoid.

The rest are mostly small or single-construct languages. Adding one is a list of node kinds plus
a line in the test.

It shares a root with the item above it: the app cannot say what it can and cannot read, so a
grey wedge is indistinguishable from a simple one until you have read `parse.rs`.

## Two holes in `func_kinds` — closed

Objective-C matched `method_definition` only, so a plain C function in a `.m` was found by
nothing at all, and `.m` files routinely hold them. Groovy matched a top-level `def f()` and
not a CLASS method, which is where most Groovy lives. Both are listed now and both are pinned
by a test that asserts the NAME and the BODY rather than a count.

**The kind was only half of it.** Adding `function_definition` to Objective-C found the node
and still produced nothing, because `name_node`'s ObjC arm searches direct children for an
`identifier` — right for a method, whose selector is a bare child, and wrong for a C function,
whose name sits inside a `function_declarator`. C and C++ already walked that chain; the arm is
shared now, guarded on the node kind so the method keeps its own search. A kind that matches
while `name_node` does not know it yields a function called nothing, which is why the tests
assert the name.

Both were found by a Complexity test failing to produce a function to count, which is a poor
way to learn it: the map had been drawing those repos as having fewer functions than they
have, and nothing said so. The languages sheet cannot say it either — it reports what the
parser can do with a language, not which shapes inside it are missed. **That is the part still
open**, and it is the same root as the two items above.

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

**Logical operators are counted now**, and it was worth the work the estimate said it might
not be: independence from line count improved on all four repos, kibana most (0.25 → 0.18) and
sanity, godot and ladybird to 0.16, −0.05 and 0.05. The node kind cannot distinguish `a && b`
from `a + b` — both are `binary_expression` nearly everywhere — so the operator TEXT is read,
and a run of one operator costs one because `a && b && c` is a single condition a reader holds.

**What it turned up is the part worth keeping.** Ruby's table names its constructs `if`,
`while`, `case` — bare words, because that is what the grammar calls them — and an anonymous
keyword token's KIND is its own text. So the `if` KEYWORD matched too, one level inside the
`if` it opens, and a single fork cost three. It shipped that way. Every other grammar names its
kinds with a suffix no keyword shares, which is why nothing caught it and why `is_branch` now
requires a NAMED node.

## The wheel is full at eleven, and the twelfth lens is standing outside it

`index.css` orders hue by menu position so the switcher reads as a set. That rule plus heat's
pin — amber, because it must read as heat — means the FIRST row can only ever take the arc
above 74°, and everything in that arc is gold. Complexity's colour was a theorem, not a choice.

Two ways out were priced. Unpinning `age` widens the arc and works, but the first lens stays a
yellow-green and it moves the whole cool half: chips 13.3 → 12.4, hot 13.5 → 13.2, six ramps
recoloured under anybody who had learned them. Standing Complexity outside the ordering costs
one menu row whose colour does not continue the run, and nothing else — every margin is exactly
what it was for eleven. That is what shipped, at 329°.

**A thirteenth ramp costs about two points, which is not the same as having no home.** This
said the wheel was full and that was written from counting gaps by eye — the same way 313° got
rejected, and wrong the same way. Scanned properly with the twelve held fixed, the best
thirteenth is 294°, between the clone violet and callers: it clears both marks easily (15.2 and
25.5) and takes the set from 8.2 / 13.5 / 13.3 to 6.9 / 10.2 / 11.3.

Two points at the CHIP level — what the menu is read as — is the real price, and it is a price
rather than a wall. Worth knowing before a thirteenth lens is proposed, and worth re-measuring
then rather than trusting this paragraph.

**The scorer's gaps are closed, and closing them corrected the record.** `--clone` is now a
floor like `--trap`, both are scored against every ramp stop rather than only the hot end, and
`ordered_score` — which compared ramps with each other and nothing else — now rejects an
assignment that puts a ramp inside `MARK_FLOOR` of either mark. `start_from_pins` was fixed
earlier in the same run: it assumed the menu opens on a pinned hue and that no lens sits past
the last pin, and a twelfth lens made both false.

What it found is the opposite of what it was opened for. The two slots rejected by hand for
sitting 4° and 10° off the clone violet score 14.0 and 14.4, above the floor and in line with
the 13.3 the shipped palette holds against the trap. Hue degrees are not perceptual distance
once lightness and chroma differ. The gap was real; the thing it was accused of costing was
not, and the rejection was a judgement made by eye off a wheel.
