# Domination: the multi-realm temporal epic for `@northguild/gmt`

This file is a progressive-disclosure entry point. Read what you need:

- [tracker.md](tracker.md) — The stories in build order, the `Blocked by` column, and
  the Definition of Done binding every story.
- [issues/index.md](issues/index.md) — Full specs, one file per story, named by story ID.
- [definition-of-done.md](definition-of-done.md) — The checklist binding every story.
- [docs-site.md](docs-site.md) — The guide, scenarios and mistakes page every realm story ships on
  the docs site, and the rules for them.
- [specs/index.md](specs/index.md) — The spec of a story in progress; deleted when the story is Done (its decisions move to the issue file).
- [research/index.md](research/index.md) — Research a planned story still needs.

## Orientation

Beside Earth Reference time, GMT has Core primitives and nine realms, as tree-shakeable inner
modules under `packages/gmt/src/`. Five of them — Healthcare, Finance, Aviation, Rail and IoT —
hold their industry's timestamp formats. Story IDs are globally sequential, so the tracker read top
to bottom is the build order: Core, then Logistics/Transport, then Space, then the industry formats.

## Two rules that shape every story

**GMT does time math; the caller supplies the facts.** Zones, calendars, contract terms and
every regulated window, limit or table are parameters with no defaults — GMT tracks no law, and
treats a professional body's numbers and a treaty's numbers the same way. GMT bundles no place
registries; the only reference data it ships is standards-body data and operator-published
calendars, behind opt-in `…/data` subpaths with recorded provenance. A table its standards body
has closed, such as the IERS leap-second table, is a built-in constant instead.

**No invented quantities.** If a value cannot be derived from the inputs, the function does
not return it. This rule exists because the first draft of this epic returned several that
could not be — estimated customs processing times, clock drift from a single sample, a
timestamp extracted from an identifier that contains none.

## Picking up a story?

Check the story's `Blocked by` cell in [tracker.md](tracker.md) first. An empty cell means
it is free to start; a parenthesised entry means you also build that shared primitive. Or run
`pnpm deps:ready` to list every startable story at once. Then read the issue file. A new realm
function's GitHub issue cites its painpoint with a primary source; an issue without one is not
ready. If the issue has a `## Corrections` section, read it — it records an API that was removed
and why, and reintroducing it without a primary source is a regression. If the story's Gap cites a
regulation or a professional body, that is evidence of demand only: the numbers it quotes are the
caller's, not defaults, and none of them reaches JSDoc, tests' assertion labels or the docs site
(tracker, "GMT tracks no law").
