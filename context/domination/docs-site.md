# Realm pages on the docs site

Every realm story that adds public functions ships its pages on the docs site (`apps/dox`) in
the same PR. There is no separate docs story: the pages are part of the story's Definition of
Done, and the story's spec lists them under `## Scope`. TRAN-8 is the first; its pages set the
shape the rest follow.

## What a story ships

| Piece | Path under `apps/dox/src/content/docs/` | Shape |
| --- | --- | --- |
| Guide | `guides/industries/<realm>-<topic>.mdx` | One `##` per function or rule; a closing `## See it break, then work` list |
| Scenarios | `scenarios/<slug>.mdx` | `<Scenario>` with `naiveCode`, `explanation`, `gmtCode`, `fixedSpecId`, then a paragraph saying what to edit in the widget |
| Mistakes | `mistakes/<realm>.mdx` | `<Mistake>` entries with severity, Wrong/Correct pairs, `rightSpecId` where a widget exists |
| Indexes | `guides/industries/index.mdx`, `guides/index.mdx`, `mistakes/index.mdx` | Hand-maintained: add the story's links. `scenarios/index.mdx` is generated; never edit it |

A later story in a realm that already has pages extends them rather than adding a parallel set.

## Rules

- **Ported, not rewritten.** The guide ports the section the story added to
  `packages/gmt/README.md`. Prose may be tightened; examples and results are the README's.
- **Every result shown is the function's real output.** `api-surface.mjs` checks the README and
  JSDoc, not these MDX pages. Before publishing, run each page's examples against
  `packages/gmt/dist` with a throwaway script and paste the returned values. Elide nothing:
  `{ …, calendarDays: 1 }` is a result nobody can check.
- **Only shipped functions are named.** A story still in the tracker is not mentioned on the
  site, not as "coming soon" and not in prose.
- **Widgets come for free.** `fixedSpecId` and `rightSpecId` must be keys of
  `LIVE_PLAYGROUND_TEMPLATES`, which the reference generator emits for every new function. The
  build throws on an unknown key.
- **Justify with specs only**, the same rule as the specs: TC39 Temporal, ISO 8601, RFC 9557 and
  the realm's own primary source. No peer library is named.
- **MDX only.** No widget markup or CSS changes, so no `html-diff` or `visual:diff` run is owed.
  React stays inside `/dox`.

## Checks

- `pnpm --filter @gmt/dox test` and `pnpm --filter @gmt/dox check` pass; `pnpm run validate`
  passes.
- After `pnpm run generate`, the scenario index lists the new scenarios.
- Every internal link resolves to a page in the build output or a route in the reference
  manifest.
