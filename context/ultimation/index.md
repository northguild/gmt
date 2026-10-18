# Ultimation: parity with every other date and time ecosystem

This file is a progressive-disclosure entry point. Read what you need:

- [tracker.md](tracker.md) — The stories in build order.
- [issues/ULT-1.md](issues/ULT-1.md) — The parity matrix, the epic's first story.
- [candidates.md](candidates.md) — Gaps known before the matrix exists, unnumbered.

## What the epic is

The [Domination epic](../domination/index.md) adds industry realms. This epic asks the other
question: which date and time calculations do other platforms and languages provide that GMT
still cannot do? Its end state is parity with the union of what TC39 Temporal and ECMA-402, and
the best library in each major language, provide, minus GMT's documented non-goals.

## The rule

- **A parity gap qualifies a candidate. It does not make a story.** "Another library has it"
  is evidence of demand, never a reason on its own.
- **A story needs a painpoint with a source other than the peer library**: a standard, a
  specification, or a recorded user need. A candidate without one becomes a documented
  non-goal in the matrix, with its reason.
- **Every Domination rule binds every story here**: the Definition of Done in
  [../domination/tracker.md](../domination/tracker.md), standards cited by clause, GMT tracks no
  law, bundled data only from standards bodies behind opt-in subpaths, the full zone and locale
  matrix, the docs-site pages and at least one teaching tool per story that adds functions.
