---
name: implement
description: "Implement a piece of work based on a spec or set of tickets."
disable-model-invocation: true
---

Implement the work described by the user in the spec or tickets.

If the work is an epic story — a `CORE-*`/`DOX-*`/realm ID with a row in
`context/domination/tracker.md` or `context/dox/tracker.md` — read its `Blocked by` cell
first. A non-empty cell means something has to land before this can start: say so instead of
working around it. A `(parenthesised)` entry is not a blocker — it is a shared primitive this
story has to build itself, so fold it into the work and say you are doing that.
`pnpm deps:ready` lists what is startable.

Use /tdd where possible, at pre-agreed seams.

Run typechecking regularly, single test files regularly, and the full test suite once at the end.

Once done, use /code-review to review the work.

For an epic story, flip its `Status` to `Done` in the tracker and run `pnpm deps:sync`.
Flipping the status is what clears the story from every other row's `Blocked by` cell, and
`sync` is what applies it. If the work changed what the story consumes, update its
`## What gmt provides (do not re-implement)` section first — the column is generated from it.

Commit your work to the current branch.
