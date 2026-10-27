# Behaviour matrix runner

Runs sixteen cases (M1 to M16, some with a lettered variant) against Temporal, GMT, date-fns,
Luxon, Day.js, Moment.js and `@internationalized/date`, and writes the committed record
`apps/dox/src/data/behaviour-matrix.json`. The Dox pages `/compare/behaviour/` and
`/migrate/` read that file.

This folder is not part of the pnpm workspace. It has its own `package.json` with exact
versions, so the root lockfile and the root `pnpm audit` never see the libraries it measures.
Its own `pnpm-lock.yaml` and `node_modules` are ignored by git; the JSON record is what is kept.

## Run

Node 26 or newer is needed (it ships native `Temporal`).

```sh
cd scripts/behaviour-matrix
pnpm install
TZ=Asia/Kolkata pnpm matrix
```

`TZ` must be set to a zone that is not UTC. A library that reads the host zone then shows its
offset instead of looking correct by accident. The runner stops with exit code 2 otherwise.

- Each Temporal call runs on `@js-temporal/polyfill` and on native `Temporal`. If the two give
  different results the runner stops with exit code 1 and names the case.
- GMT is bundled from `packages/gmt/src` into `.cache/gmt.mjs` with esbuild. The runner never
  builds `packages/gmt` and never reads `packages/gmt/dist`.
- Every result is reduced to the comparable form named in the case (`compare` in `cases.mjs`).
  A cell is "same" when the strings match, "differs" when they do not, and "unsupported" when
  the library has no such operation. A call that throws counts as "rejected".
- An upstream issue is attached to a cell only when that cell differs.

## When to run again

Run it again, and commit the JSON, when a pinned version in `package.json` changes or a case is
added or edited. The versions move only with a re-run: Renovate ignores this `package.json`.
