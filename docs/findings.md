# Findings

Sanity gives you a list of specific places that need attention, and says why each one is on it. For example:

- a 1,000-line function that a reader had to go back over more than once to follow
- a function twenty others depend on that nobody has read
- a function whose comments describe something other than what it does
- a trap in code people are still editing: something a reader expects to break for the next person who edits it, with nothing in the code to warn them
- code copied into several places, where one copy changed and the others didn't

Each item is a **finding**, and each finding comes from a **rule** that combines a few measurements, like "over 200 lines, and hard to follow" or "depended on by ten or more functions, and undocumented." Sanity comes with about two dozen rules, and you can change their thresholds or turn them off for your repo.

<p align="center">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="images/findings-dark.png">
  <source media="(prefers-color-scheme: light)" srcset="images/findings-light.png">
  <img alt="The findings list" src="images/findings-light.png" width="560">
</picture>
</p>

```
$ sanity findings --limit 2
/Users/you/projects/sanity  14 findings

  web/src/components/Findings.tsx#Findings
    Giant and hard to follow
      1,012 lines, and a reader had to go back over it more than once to follow
      it. Anything that changes it has to hold all of it at once, and a reader
      already found that hard.
    Tangled and hard to follow
      For 720 lines of code this branches far more than bodies that size usually
      do here, and a reader had to go back over it more than once to follow it.

  web/src/App.tsx#App
    Unpredicted and far-reaching
      This calls 48 other functions and a reader still could not predict what it
      does. It coordinates work that is not apparent from its own body.
```

You decide on each finding: fix it, snooze it until the code changes, mark it wrong, or accept it. Decisions are committed with the repo, so the list gets shorter as you work through it, and anyone who picks up the repo sees the same list you do.

## Hard to predict isn't always bad

A hard-to-predict function isn't always a problem. It might be a careful algorithm or it might be a mess. Git history helps tell them apart:

|  | **Rarely changes** | **Changes often** |
|---|---|---|
| **Hard to predict** | Probably intricate and important. Document it and be careful with it. | Probably a problem. |
| **Easy to predict** | Routine. Worth a look only if there's a lot of it. | Routine work. Usually fine. |

## How rules work

A rule is a condition over measurements, applied to every function or every file:

```
func: loc >= 200 and illegible >= 0.6
```

That one is "Giant and hard to follow": at least 200 lines, and a reader had to go back over it more than once. A rule has one to four clauses joined by `and`, each a field, an operator and a number. The fields are the lenses' measurements plus a few counts, such as how many people have worked in a function or whether a test calls it.

`.sanity/rules/README.md` lists every rule that ran. To change one for your repo, edit its line in `.sanity/rules/catalog.md`: change a number, add `; off` to turn it off, or add a rule of your own. If the list is too long or too short, `sanity findings balance --target 20` suggests thresholds that give about 20 findings. [rules.md](rules.md) has every field, the file format, and what an edit does to decisions you've already made.
