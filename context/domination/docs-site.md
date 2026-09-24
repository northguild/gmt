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

## Purpose-built widgets

Every function gets a live playground for free. A story may also ship one teaching widget when
the rule it teaches is better seen than read, and a playground cannot show it. TRAN-8's Dwell
Ledger is the first: `calendarDays` only makes sense drawn on a zone's real local-day grid.

A widget follows the Tier 2 shape in [../dox/built.md](../dox/built.md), under
`apps/dox/src/`:

| Piece | Path |
| --- | --- |
| Pure logic and its test | `lib/<widget>.ts`, `lib/<widget>.test.ts` |
| Template, mount and their test | `lib/<widget>-mount.ts`, `lib/<widget>-mount.test.tsx` |
| Astro shell | `components/<Widget>.astro` |
| Tool page | `content/docs/tools/<slug>.mdx` |
| Styles | `styles/gmt-<widget>.css`, registered in `astro.config.mjs` |

It is also a Dox chat tool, because the chat can only offer a widget it can mount:

- a schema, prompt copy and an `ENABLED_TOOL_NAMES` entry in `lib/dox-tools.ts`;
- a Worker tool with a trivial `execute` in `worker/tools.ts`;
- a registry entry in `components/ask/widget-registry.ts`;
- a `WidgetKind` and page path in `lib/widget-permalink.ts`;
- a starter pill in `CHAT_STARTERS` (`lib/chat-constants.ts`).

`widget-registry.test.ts`, `chat-starters.test.ts`, `widget-permalink.test.ts` and
`client-graph.test.ts` fail if any of these is missing. Add the tool page to
`scripts/html-diff.mjs` and `scripts/visual-snapshot.mjs`. Every preset shows the function's
real output, asserted in the mount test.

## Rules

- **Ported, not rewritten.** The guide ports the section the story added to
  `packages/gmt/README.md`. Prose may be tightened; examples and results are the README's.
- **Every result shown is the function's real output.** `api-surface.mjs` checks the README and
  JSDoc, not these MDX pages. Before publishing, run each page's examples against
  `packages/gmt/dist` with a throwaway script and paste the returned values. Elide nothing:
  `{ …, calendarDays: 1 }` is a result nobody can check.
- **Unreleased functions are badged for you.** The reference marks every export missing from
  the newest published release, in the sidebar and on its page. Nothing needs marking by hand.
- **Only merged functions are named.** A story whose tracker `Status` is not `Done` is not
  mentioned on the site, not as "coming soon" and not in prose. Merged but not yet on npm is
  fine: that is what the Unreleased badge is for.
- **Widgets come for free.** `fixedSpecId` and `rightSpecId` must be keys of
  `LIVE_PLAYGROUND_TEMPLATES`, which the reference generator emits for every new function. The
  build throws on an unknown key.
- **Justify with specs only**, the same rule as the specs: TC39 Temporal, ISO 8601, RFC 9557 and
  the realm's own primary source. No peer library is named.
- **MDX only unless the story ships a widget.** With no widget, there are no markup or CSS
  changes, so no `html-diff` or `visual:diff` run is owed. With one, both are owed. React stays
  inside `/dox`.

## Checks

- `pnpm --filter @gmt/dox test` and `pnpm --filter @gmt/dox check` pass; `pnpm run validate`
  passes.
- After `pnpm run generate`, the scenario index lists the new scenarios.
- Every internal link resolves to a page in the build output or a route in the reference
  manifest.
