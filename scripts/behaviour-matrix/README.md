# Behaviour matrix runner

Runs the cases in `cases.mjs` against Temporal, GMT, date-fns,
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
pnpm install --ignore-workspace
pnpm matrix
```

No `TZ` is needed. The runner repeats every library call under each host zone in `HOST_ZONES`
(`run.mjs`): Asia/Kolkata, Europe/London, Australia/Sydney and America/Santiago. One has no
daylight saving time and the others cover both hemispheres. None is UTC, and a child process
stops with exit code 2 if its zone resolves to UTC or `Etc/*`.

- A library cell whose comparable result changes with the host zone gets the verdict `varies`.
  It has no `returns` and carries `hosts`, a list of `{ zone, returns, verdict, detail? }`, one
  per host zone. A cell whose raw text differs between hosts but whose comparable form does not
  also carries `hosts`. A cell is `same` only when it is the same on every host.
- GMT and Temporal must give identical results on every host. If either does not, the runner
  stops with exit code 1 and names the case.
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
