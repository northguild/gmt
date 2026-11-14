# CORE-112 slice 5 — canary groups, upstream row, docs, changeset, budget

Read with [index.md](./index.md). Two guard groups, because the two defects end on different days:

| Group | Defect | Engines | Upstream | Removing it deletes |
| --- | --- | --- | --- | --- |
| **D23** | `formatToParts` / `formatRangeToParts` abort on a `Y` field | `v8` (Node, Chromium) | nodejs/node#67076 (V8 `0426b0d1045d`) | `weekYearSynth.ts`, guard step 2 and path B: flagged formatters take path A (native parts, year patched) everywhere |
| **D24** | CLDR `Y` where `y` is meant: the week-year printed | every engine | CLDR ticket (owner question 2) | `weekYearGuard.ts`, its `construct` line, slice 2, the source rule's guard clause |

D24 gone means no `Y` pattern, so D23 cannot fire either: removing D24 removes both. D23 can go
first (a fixed V8 at the `engines.node` floor and in every Chromium the native suite runs).

## `repros.ts`

```ts
/** Engine and CLDR defects the canary reads without a probe in `probeRepros.ts` (CORE-112). */
export type CanaryDefectId = "D23" | "D24";
```

Add it to `Repro.defect`'s union. Repro inputs are the recorded failing cases, as for every other
group (no locale list): gd `{ year: "numeric", month: "short" }`, ksh `{ year: "numeric",
month: "numeric" }`, sc `{ year: "numeric", month: "numeric" }`, te-u-ca-buddhist `{ year:
"numeric", month: "long" }`, my-u-ca-japanese `{ year, month, day: "numeric" }`,
gl-u-ca-hebrew `{ dateStyle: "full" }`, de-CH gregory `{ era: "short", year, month, day,
weekday: "short" }`, all `timeZone: "UTC"`.

- **D24 repro** (in process, every engine, `format` only): each input at its trap date prints the
  Temporal-derived calendar year ([tests.md](./tests.md) values). Passes when the native text is
  already right.
- **D23 repro** (never calls parts in a browser or in the checking process):
  - Find a live `Y` formatter: an input whose D24 repro fails (its year is the week-year).
    None → D23 reports *removable* (no `Y` left to abort on).
  - Crash-free reading: that formatter (component options) reports `resolvedOptions().year`
    → the engine reads `Y` as a year (fixed V8, or not V8). `undefined` → still aborts.
  - Node only, confirmation: `child_process.spawnSync(process.execPath, ["-e", <parts call>])`;
    exit 133 → fails, exit 0 with a `"year"` part → passes. The two readings must agree, else the
    check exits non-zero (a signal GMT relies on has changed).
  - `process.versions.v8` is printed beside the verdict for the report, never decides it.

## `scripts/upstream.mjs`

- `REPOS` gains `"nodejs/node"`.
- `knownGuards()` regex: `/export type (?:DefectId|ZonedDefectId|BoundedWorkDefectId|CanaryDefectId) =([^;]+);/g`;
  update its JSDoc line to name the fourth union.
- `apps/dox/src/data/upstream-filings.json`: the nodejs/node#67076 row with `"gmtGuard": "D23"`
  and a hand-written `summary` in plain English ("Formatting some dates in Burmese, Galician,
  Scottish Gaelic and a few other languages into parts stops Node with a crash…"), `work`, `role`
  per the existing rules for a filing found by discovery. Run `node scripts/upstream.mjs` to fill
  the fetched fields; do not hand-write them.

## `scripts/lib/workarounds.mjs`

Two entries after D22, shaped like D16/D17:

- D23: `engines: ["v8"]`; title `D23 — formatToParts aborts V8 on a week-of-year year field
  (nodejs/node#67076)`; trigger: every V8 the check reads (Node at the `engines.node` floor, and
  the temporal-compat-chromium verdict) reports D23 removable; steps: delete `weekYearSynth.ts`,
  guard step 2 and path B, keep every expected-value row; `Full wording: … § Removal steps 23.`
- D24: no `engines`; title `D24 — CLDR patterns print the week-of-year year where the calendar year
  is meant`; trigger: every engine's compat verdict reports D24 removable *and* the weekly sweep
  below flags nothing; steps: delete `weekYearGuard.ts`, `weekYearSynth.ts`, the `construct`
  hook and the source rule's guard clause; keep every expected-value row (they are ECMA-402's).

## `scripts/canary/weekYear.mjs` (new, weekly, Node)

The recorded inputs cannot see a new locale's `Y`. The weekly sweep can: the locale list is the
directory listing of the `cldr-dates-full` package for the CLDR version the engine reports
(`process.versions.cldr`), fetched at run time with `npm pack` into a temporary directory, never a
dependency and never shipped, filtered by `Intl.DateTimeFormat.supportedLocalesOf`. For every
locale × `Intl.supportedValuesOf("calendar")` × the 30 option sets of the validation plus the
synthesis twin shapes ([single-repair.md](./single-repair.md) step 1):

1. In process, `format` only: the guard's verdict; a repaired `format` that keeps the digit-run
   count (slice 2 step 2); synthesis non-null and its parts joined equal to the repaired text.
2. Child processes, batched (one per locale): native `formatToParts` on every unflagged formatter
   and every twin shape — any exit 133 is a guard false negative and fails the run.

Output: counts per group, every failing case, `process.versions`. Exit non-zero on any failure.
Matrix: the CI Node versions (22 floor, 24, 26).

## `packages/gmt/src/internal/temporalCompat/README.md`

- Defect table: rows **D23** and **D24** after D22, in the existing column shape (defect,
  where it is fixed, when it fires). D23 text names the abort, the V8 commit, the crash signal and
  the source rule; D24 names the CLDR patterns, the text verdict and the ECMA-402 expected value.
- § Removal triggers: one row each, wording as in `workarounds.mjs`.
- § Removal steps: 23 and 24, as above, with "keep every expected-value row".

## Bug doc

`context/domination/js-temporal-polyfill-bugs.md` gains **§ AF. Some languages' date patterns use
the week-of-year year: wrong year everywhere, and a V8 crash in `formatToParts` (engine and CLDR)**,
after § AE, in the shape of § AD/AE: what happens, smallest repro (gd 2024-12-30, and the
my-u-ca-buddhist range), affected engines and versions measured, the spec text that decides the
right value (UTS #35 `y`/`Y`; ECMA-402 FormatDateTimePattern), the upstream links (nodejs/node#67076,
V8 `0426b0d1045d`, the CLDR ticket when filed) and the GMT guards (D23, D24).

## Changeset — `.changeset/core-112-week-year.md`

```md
---
"@northguild/gmt": patch
---

Formatting no longer stops Node with a crash, and prints the right year, for languages whose date
patterns print the week-of-year year instead of the calendar year. `formatZonedRange`,
`formatCalendar` and the `…ToParts` functions crashed Node 22, 24 and 26 for some languages and
calendars (for example Burmese with the Buddhist calendar, and Galician with the Hebrew, Buddhist
or ROC calendar and a full date style). Every format function also printed the wrong year near the
start or end of a year, or all year in the Buddhist, Japanese and ROC calendars: Scottish Gaelic
printed `Dùbh 2025` for 30 December 2024, and now prints `Dùbh 2024`.
```

The `/changelog` skill polishes it at finalize time.

## READMEs

The landing READMEs get no section (house rule: no per-fix sections). The guide that documents
locale formatting (`apps/dox/src/content/docs/…` where `formatDate` is documented) gets one
sentence under its compatibility notes; `dox: none` stands because no tool changes.

## Bundle budget

`scripts/bundle-size.budgets.json` `entries.root.minified`: raise by the measured growth of the
guard and synthesis in one reviewed edit (owner question 7). Measure after slices 1–4 with the
repo's bundle-size script in the worktree (never a build in the main checkout).
