# Slice 6 — Bundle-size script, JSON and budgets

`scripts/bundle-size.mjs` measures GMT on `temporal-polyfill` (gated, as today) and also measures
the last GMT release on `@js-temporal/polyfill` (reported, never gated), so Dox `/bundle-size` can
chart both from generated figures. The page and its charts are the Dox spec's; this slice fixes the
JSON they read. Authority row: index § Authority, "The old figures come from the last GMT release on
`@js-temporal/polyfill`, as published".

## What is measured

| Set | Source | Entries | Gated |
| --- | ------ | ------- | ----- |
| `temporal-polyfill` (shipped) | `packages/gmt/src`, as today | `root`, `polyfill` (floor), `isValidDate`, `formatDate`, `businessDaysBetween`, `addBusinessDays`, `chargeableDays`, `operatingTimeBetween`, `dutyViolations` | yes, `check` |
| `@js-temporal/polyfill` (previous) | the published `@northguild/gmt` release before this change, installed as a root devDependency alias | the same names | never |

Why the published release and not GMT's new source on the old polyfill: the release is what users
ran, workarounds included; the new source on the old polyfill never shipped and would be missing the
workarounds slice 3 removes, so its figure would be too small and its code wrong.

Root `package.json` devDependencies:

```json
"gmt-js-temporal-release": "npm:@northguild/gmt@1.21.0"
```

1.21.0 is the newest published release today and the last on `@js-temporal/polyfill`. If another
release ships before this change merges, pin that one instead. This pin never moves afterwards: it
names a fixed past release, not a window. Check the lockfile resolves it from the registry (a tarball
URL), not by linking the workspace's `packages/gmt`. Add it to `.fallowrc.jsonc`
`ignoreDependencies` with a comment (only esbuild input strings name it).

`@js-temporal/polyfill` itself is not added to any manifest: the release depends on it, and the floor
is resolved from the release's own directory.

## Script changes

- `ENTRIES` becomes per set. Shipped: `polyfill: export { Temporal } from "temporal-polyfill/full/implementation";`,
  function entries from `./src/index.ts`, `resolveDir: GMT_DIR` (unchanged). Previous: function
  entries `export { <name> } from "gmt-js-temporal-release";`, `root: export * from "gmt-js-temporal-release";`,
  `resolveDir: ROOT`; floor `export { Temporal } from "@js-temporal/polyfill";` with `resolveDir` =
  `realpathSync` of the release's package directory (pnpm's strict layout).
- Same esbuild settings for both sets (minify, esm, neutral, `mainFields` module/main, es2022, gzip 9).
- `check` measures and gates the shipped set only (it runs in `ci.yml`; keep it fast). Only a run with
  `--json` measures the previous set. An entry name missing from the release
  (none today) is recorded as `null`, never an error.
- Versions are read, never typed: `temporal-polyfill`'s version from `packages/gmt/node_modules/temporal-polyfill/package.json`;
  the release's version and its installed `@js-temporal/polyfill` version from their `package.json`s.
- `--compare` keeps comparing top-level `entries` only.
- `absent`: a listed path that is not a file under `packages/gmt` is a failure (`absent path … does
  not exist`), so a list never goes stale. Then drop each path slice 3 deleted.
- Header comment: describe both sets and the JSON below.

## JSON (`--json`, read by `apps/dox`)

Top-level keys stay, so nothing that reads them breaks; one key is added.

```jsonc
{
  "measuredAt": "…", "node": "…", "esbuild": "…", "commit": "…", "dirty": false,
  "floor": "polyfill",
  "entries": { "<name>": { "minified": 0, "gzipped": 0, "budget": 0 } },   // shipped set, as today
  "polyfills": [
    {
      "package": "temporal-polyfill", "version": "1.0.8",
      "import": "temporal-polyfill/full/implementation",
      "shipped": true, "gmt": "<packages/gmt version>", "from": "source",
      "entries": { "<name>": { "minified": 0, "gzipped": 0 } }
    },
    {
      "package": "@js-temporal/polyfill", "version": "0.5.1",
      "import": "@js-temporal/polyfill",
      "shipped": false, "gmt": "1.21.0", "from": "npm",
      "entries": { "<name>": { "minified": 0, "gzipped": 0 } | null }
    }
  ]
}
```

`polyfills[0].entries` equals top-level `entries` without `budget`. `gmt` is the measured GMT's
version, read from its `package.json`; `from` says whether it was bundled from this checkout's source
or from the published package. Order: shipped first. In `check` mode without `--json` nothing is written.

## Dox reader, kept true

`apps/dox/src/lib/bundle-size.ts` `importOf` hard-codes `import { Temporal } from "@js-temporal/polyfill"`
for the floor row. Change it to read the shipped entry of `report.polyfills` (`import { Temporal }
from "${shipped.import}"`) so the existing table is right the moment the polyfill changes. Everything
else on that page (the new section, charts, colours) is the Dox spec's.

## Budgets

After slices 2 and 3: `node scripts/bundle-size.mjs --update` (size + 1%), then review the edit to
`scripts/bundle-size.budgets.json` like any budget change. Every entry falls (the floor drops from
about 44.2 kB to 23.3 kB gzipped; research § 5). The root budget stays an absolute gate. Quote the
before/after table (`--compare` against a `main` JSON saved to the scratchpad) in the review notes.

## Tests

The script has no unit tests today; add `scripts/bundle-size.test.mjs` only for the pure parts
(the JSON shape builder, the `absent` existence check) if they are factored out. Otherwise verify by
running:

- `node scripts/bundle-size.mjs check` → exit 0.
- `node scripts/bundle-size.mjs report --json <scratch>/b.json` → both sets present, versions read,
  the previous floor about 44 kB gzipped, the shipped floor about 23 kB.
- An `absent` entry naming a missing file → exit 1 with that message (then revert).
- `pnpm --filter @gmt/dox run generate` then the Dox build pass (`deploy-dox.yml` runs `pnpm install`
  then `generate`, which now needs the alias installed; it is a root devDependency, so it is).

## Done when

`check` passes in CI with the new budgets; the generated JSON carries both sets; the Dox table's
floor row names `temporal-polyfill/full/implementation`.
