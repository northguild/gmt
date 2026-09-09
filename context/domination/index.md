# Domination: the multi-realm temporal epic for `@northguild/gmt`

This file is a progressive-disclosure entry point. Read what you need:

- [overview.md](overview.md) — What the epic is, key decisions, architecture, the corrections
  table, risks, and the verified standards list. **The entry file.**
- [painpoints.md](painpoints.md) — Researched domain evidence per realm, with primary-source
  citations. **Read this before adding or changing any realm function.**
- [tracker.md](tracker.md) — The 53 stories in build order, the `Blocked by` column, and
  the Definition of Done binding every story.
- [issues/](issues/) — Full specs, one file per story, `CORE-1` through `SPA-53`.

## Orientation

GMT today covers one temporal domain: Earth Reference time. This epic adds ten more, as
tree-shakeable inner modules under `packages/gmt/src/`.

Build order is **Core → Logistics/Transport → IoT → Healthcare → Finance → Space**, in six
phases. Story IDs are globally sequential, so reading the tracker top to bottom is the build
order. Phases 1 and 2 — Core plus the logistics realms — are the priority and stand alone as a
deliverable.

## Two rules that shape every story

**GMT does time math; the caller supplies the facts.** Zones, calendars, contract terms and
regulatory tables are parameters. GMT bundles no place registries, and what reference data it
does ship lives behind opt-in `…/data` subpaths with recorded provenance.

**No invented quantities.** If a value cannot be derived from the inputs, the function does
not return it. This rule exists because the first draft of this epic returned several that
could not be — estimated customs processing times, clock drift from a single sample, a
timestamp extracted from an identifier that contains none.

## Picking up a story?

Check the story's `Blocked by` cell in [tracker.md](tracker.md) first. An empty cell means
it is free to start; a parenthesised entry means you also build that shared primitive. Or run
`pnpm deps:ready` to list every startable story at once. Then read [overview.md](overview.md),
the realm's section in [painpoints.md](painpoints.md), and the issue file. If the issue has a `## Corrections`
section, read it — it records an API that was removed and why, and reintroducing it without a
primary source is a regression.

The first draft of this plan was written without domain research and contained fabricated
functions, an invented standards citation, and numerically wrong acceptance criteria. The
`## Corrections` sections and `painpoints.md` exist to stop that recurring. Extend the epic
from evidence, and add the evidence to `painpoints.md` before adding the story.
