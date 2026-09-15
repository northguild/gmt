# `@js-temporal/polyfill` — upstream issues and PRs GMT needs

Ready-to-file record for `js-temporal/temporal-polyfill` (and, where noted, `tc39/proposal-temporal`).
Nothing here has been posted by an agent. The owner files every item.

> **Status of this document:** complete. A, B, C and D are verified on production builds of js-temporal
> `main` `c8f344c`. With every patch here applied (build `final2`), GMT's canary reports 9 of 10 workaround
> groups removable (only D4, an ICU defect, remains), every repro passes, and the Chromium 152 month-arithmetic
> grid matches native for all 11 calendars. See "Corrections and contradictions" before changing any GMT trigger.

## Environment

|                               |                                                                                                                                                                                                                                                                                                                                                                       |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Date                          | 2026-09-15                                                                                                                                                                                                                                                                                                                                                            |
| Machine                       | macOS (Darwin 25.5.0), arm64                                                                                                                                                                                                                                                                                                                                          |
| Node                          | v24.21.0, ICU 78.3, Unicode 17.0, CLDR 48.0, tzdata 2026c                                                                                                                                                                                                                                                                                                             |
| npm release                   | `@js-temporal/polyfill` 0.5.1 (2025-03-31), still the latest on npm and GitHub                                                                                                                                                                                                                                                                                        |
| js-temporal `main`            | `c8f344c` (2026-05-14), re-checked 2026-09-15 with `gh api repos/js-temporal/temporal-polyfill/commits/main`                                                                                                                                                                                                                                                          |
| Open js-temporal PR checked   | #361 "April 2026 rebase, part 3" (branch `rebase-part3`, base `4128e12`)                                                                                                                                                                                                                                                                                              |
| tc39/proposal-temporal `main` | `e8cc03f` (2026-07-27)                                                                                                                                                                                                                                                                                                                                                |
| Build method                  | `git clone --filter=blob:none`, `npm ci --ignore-scripts`, `NODE_ENV=production npm run build` (the mode `release-checklist.md` publishes with: minified, assertions stripped). One build per patch, each on a clean `c8f344c` tree                                                                                                                                   |
| Repro runner                  | `POLYFILL=<build>/index.esm.js node <repro>.mjs`                                                                                                                                                                                                                                                                                                                      |
| GMT canary                    | `node --import <loader>/register.mjs scripts/temporal-compat.mjs check`, where the loader hook redirects the bare `@js-temporal/polyfill` specifier to the build under test. GMT's `node_modules` were not touched. The canary's header line still prints "0.5.1" because it reads the installed `package.json`; the code under test is the build named by `POLYFILL` |

Expected values are never taken from the polyfill. Their sources are the TC39 spec text, test262,
IANA tzdb rules, and Chromium 152/153 native Temporal as recorded in GMT's canary
(`packages/gmt/src/internal/temporalCompat/repros.ts`). Every repro row below agrees with that canary.

## Summary

| Id  | Title                                                                               | Ask                                                                                                                                                                                                | Verified?             | GMT workaround it retires                                                                                                                 | Floor bump                                                      |
| --- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| A   | Wall clock → exact time at the range limits                                         | **Release** of `05ce7a3` + `95237e0` (both on `main`). No new patch: `main` passes every max and min row                                                                                           | Yes (build of `main`) | `zoned.A`: defect-1 fallbacks in `internal/zonedWallClock.ts`, `zonedWallClockOperations.ts`, `*AtLimit` in `zonedWallClockDifference.ts` | `@js-temporal/polyfill` → first release containing both commits |
| B   | `GetNamedTimeZoneNextTransition` returns `null` within one search window of the max | **Bug report + PR** (new patch). Same code in proposal-temporal: file there too                                                                                                                    | Yes (patched build)   | `zoned.B`: defect-2 transition fallback in `internal/zonedWallClock.ts`                                                                   | same release                                                    |
| C   | Non-ISO calendars (D1–D8) | **Merge #361 + port + release**: #361 carries D3 `0df570c`, D5 `314b112`, D7 `0e32ee0`; port `a41eb67` + `af0cb4b` (D1), `977d11e0` + `993e6322` (D8), `196a3191` surpass hunk (**D7b**); **new patch C-D1b** (`untilCalendar` near the limits, broken in proposal-temporal too). `2bb6ba1` (D2) and `10aeb98` (D6) are on `main`. D4 is ICU `5267bb5778` (unreleased) | Yes (per-port and combined builds; canary, repros, 400-day edge scans, Chromium grid). Coptic near the min: UNVERIFIED, out of GMT scope | `internal/temporalCompat/*` D1–D3, D5–D8; D3+D4 shared code stays until ICU/Node | same release; D4: `engines.node` floor on a Node with ICU containing `5267bb5778` |
| D   | `"UTC"` fast path in `GetPossibleEpochNanoseconds` skips `IsValidEpochNanoseconds`  | **Port** proposal-temporal PR #3205 (`d90d432`) + release                                                                                                                                          | Yes (patched build)   | `zoned.D`: `checkUtcValidity` in `internal/zonedWallClockDifference.ts`                                                                   | same release                                                    |

## Duplicate search (read-only, 2026-09-15)

`gh search issues --include-prs` on both repositories.

**js-temporal/temporal-polyfill**

| Query                                                                                      | Result                                                                                                                       |
| ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `GetNamedTimeZoneEpochNanoseconds`, `Invalid time value`                                   | none                                                                                                                         |
| `release 0.5.2`, `new release`                                                             | only old merged maintenance PRs (#320, #331, #297); no open release request                                                  |
| `GetNamedTimeZoneNextTransition`                                                           | #292 (merged 2023 rebase), unrelated                                                                                         |
| `getTimeZoneTransition null`, `startOfDay TypeError`, `Cannot read properties of null`     | none                                                                                                                         |
| `extreme dates calendar`, `Invalid ISO date`, `hebrew leap`, `Saka`, `Meiji`, `coptic era` | none                                                                                                                         |
| `calendarToIsoDate`                                                                        | #341 (open) "Incorrect conversion between calendars": buddhist/japanese before 1582, i.e. D2, fixed on `main` by `2bb6ba1`   |
| `mixed-sign`                                                                               | #347 (open): ZonedDateTime `until` mixed-sign across a DST fold in ISO. Different from D7 (non-ISO calendar `untilCalendar`) |
| `UTC fast path`, `GetPossibleEpochNanoseconds`, `outside of supported range UTC`           | none                                                                                                                         |

Related open items: PR #361 (ports D3, D5, D7 plus ICU 78 fixes for coptic and chinese/dangi; closes #360);
PR #357 (ethiopic era codes for CLDR 48); #209 (far-off DST transition look-ahead policy).

**tc39/proposal-temporal**

| Query                            | Result                                                                                                                                                                                     |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GetNamedTimeZoneNextTransition` | #3110 (closed) "startOfDay bug for edge cases": two transitions within one 14-day window. Different defect, fixed by per-zone search windows (js-temporal `a79c6a1`). Not a duplicate of B |
| `next transition null maximum`   | none. **B is unreported in both repositories**                                                                                                                                             |
| `UTC fast path`                  | #3203 (closed) + PR #3205 (merged 2025-12-11): **D, already fixed in proposal-temporal**                                                                                                   |
| `3159`                           | #3159 + PR #3176: D7, fixed as `0e32ee0`                                                                                                                                                   |

---

## A. Wall clock → exact time at the range limits: release request

### Title

Release request: `main` fixes ZonedDateTime work at both Instant limits (`05ce7a3`, `95237e0`), 0.5.1 throws

### Status

| Build                                                   | Result (`repro-A-wall-clock-range-limits.mjs`, 13 rows + 3 controls)                                   |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| npm 0.5.1                                               | **13 FAIL** (every max and min row), 3 controls pass                                                   |
| 0.5.1 + `05ce7a3` only (previous research's `fixA.mjs`) | 8 max rows pass, **5 min rows FAIL** with `RangeError: date/time value is outside the supported range` |
| js-temporal `main` `c8f344c` (production build)         | **16/16 PASS**                                                                                         |
| GMT canary on `main` build                              | `zoned.A` 10/10 REMOVABLE                                                                              |

### Correction to earlier GMT notes

GMT's canary comment, `temporalCompat/README.md`, `zonedWallClock.ts`, `zonedWallClockOperations.ts`,
`scripts/temporal-compat.mjs` and CORE-6 spec §6.5 all say the minimum edge is "still broken
upstream" and needs "a separate fix". **That is wrong for current `main`.** It was measured on
0.5.1 + `05ce7a3` only. Two commits on `main` are needed, and both are there:

1. **`05ce7a3`** "Polyfill: Correctly handle limits in GetNamedTimeZoneEpochNanoseconds" (port of
   proposal-temporal `0096343850`, merged via #359 on 2026-04-22). It clamps the ±1 day offset probes
   to `NS_MIN`/`NS_MAX` instead of back to `ns` (`lib/ecmascript.ts` l.2910–2913 on `c8f344c`).
   Fixes the max rows.
2. **`95237e0`** "Editorial: Revert inadvertent observable change" (port of proposal-temporal
   `6274e5de91`, committed 2026-04-22). It deletes `CheckISODaysRange(isoDateTime.isoDate)` before
   `GetNamedTimeZoneEpochNanoseconds` in `GetPossibleEpochNanoseconds`. For a `-271821-04-19` wall
   clock that check ran on the _local_ date and threw although the instant is valid. Fixes the min rows.

No min-edge patch is needed; none was written. The GMT trigger for `zoned.A` becomes "a release
containing `05ce7a3` and `95237e0`".

### Repro

```js
import { Temporal } from "@js-temporal/polyfill";
const MAX = 8640000000000000000000n,
  MIN = -MAX,
  D = 86400000000000n,
  H = 3600000000000n;
const z = (ns, tz) => new Temporal.ZonedDateTime(ns, tz);
// maximum edge (positive-offset zones)
Temporal.ZonedDateTime.from("+275760-09-13T09:00:00+10:00[Australia/Sydney]"); // 0.5.1: RangeError: Invalid time value
z(MAX - D, "Australia/Sydney").until(z(MAX, "Australia/Sydney"), {
  largestUnit: "day",
}); // expected P1D
z(MAX - 3n * D - 5n * H, "Australia/Sydney").since(z(MAX, "Australia/Sydney"), {
  largestUnit: "year",
}); // expected -P3DT5H
Temporal.Duration.from("PT49H").total({
  unit: "day",
  relativeTo: z(MAX - 3n * D - 5n * H, "Australia/Sydney"),
}); // expected 2.0416666666666665
// minimum edge (negative-offset zones; New York LMT is -04:56:02, min instant = -271821-04-19T19:03:58 local)
Temporal.ZonedDateTime.from("-271821-04-19T20:00:00[America/New_York]"); // expected -271821-04-19T20:00:00-04:56[America/New_York]
// 0.5.1: RangeError: date/time value is outside the supported range
z(MIN + D, "Pacific/Honolulu").until(z(MIN, "Pacific/Honolulu"), {
  largestUnit: "day",
}); // expected -P1D
```

Controls that must keep throwing (all builds throw, as the spec requires): a Sydney wall clock one
nanosecond past the max instant; a New York wall clock before the min instant; `until` with
`smallestUnit: "day"` whose rounding window ends past the max.

**Expected-value sources.** `InterpretISODateTimeOffset` → `GetPossibleEpochNanoseconds` →
`GetNamedTimeZoneEpochNanoseconds` returns an instant inside `IsValidEpochNanoseconds`; the named-zone
branch has no `CheckISODaysRange` (spec `timezone.html`, and the `6274e5de91` commit message).
`DifferenceZonedDateTime` resolves only wall clocks not after the later operand (`zoneddatetime.html`).
test262 `built-ins/Temporal/ZonedDateTime/from/argument-string-limits.js`. Chromium 152/153 return every
value (GMT canary `zoned.A`).

### Ask

> Please publish a release (0.5.2 or 0.6.0) of the current `main`. 0.5.1 throws for in-range
> ZonedDateTime values within about a day of both Instant limits: parsing, `toZonedDateTime`,
> `until`/`since`, `Duration#total`/`round`/`compare` with `relativeTo`. `main` is correct at both
> edges thanks to `05ce7a3` and `95237e0`.

---

## B. `GetNamedTimeZoneNextTransition` returns `null` within one search window of the max Instant

### Title

`getTimeZoneTransition("next")` misses a transition in the last search window before the max Instant; `startOfDay` / `toZonedDateTime` / `hoursInDay` then throw TypeError

### Status

| Build                | `repro-B-next-transition-near-max.mjs` (6 rows + 2 controls)                      | `repro-B-regression-rows.mjs` (12 rows)                                    | Canary `zoned.B`  |
| -------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ----------------- |
| npm 0.5.1            | 6 FAIL                                                                            | —                                                                          | 3/3 STILL NEEDED  |
| `main` `c8f344c`     | **6 FAIL** (`null`, `TypeError: Cannot read properties of null (reading 'sign')`) | 11 pass, **1 FAIL** (Santiago `hoursInDay` on `+275760-09-06` also throws) | 3/3 STILL NEEDED  |
| `main` + patch below | **8/8 PASS**                                                                      | **12/12 PASS**                                                             | **3/3 REMOVABLE** |

The same code is in tc39/proposal-temporal `main` (`polyfill/lib/ecmascript.mjs` l.2444–2446 at
`e8cc03f`). File in proposal-temporal as well, or ask js-temporal to upstream it.

### Repro

```js
import { Temporal } from "@js-temporal/polyfill";
// America/Santiago: -04:00 -> -03:00 at +275760-09-07T04:00:00Z (local midnight skipped), 6 days before the max.
const T = "+275760-09-07T01:00:00-03:00[America/Santiago]";
Temporal.Instant.from("+275760-09-01T00:00:00Z")
  .toZonedDateTimeISO("America/Santiago")
  .getTimeZoneTransition("next");
//   expected T; main: null
new Temporal.ZonedDateTime(
  8640000000000000000000n,
  "America/Santiago",
).getTimeZoneTransition("previous");
//   T (control: the transition exists and is found backwards)
Temporal.PlainDate.from("+275760-09-07").toZonedDateTime("America/Santiago");
//   expected T; main: TypeError: Cannot read properties of null (reading 'sign')
Temporal.ZonedDateTime.from("+275760-09-07T12:00[America/Santiago]").hoursInDay;
//   expected 23; main: same TypeError
Temporal.ZonedDateTime.from("+275760-09-06T12:00[America/Santiago]").hoursInDay;
//   expected 24; main: same TypeError (its end-of-day is the start of 09-07)
```

**Expected-value sources.** Spec `GetNamedTimeZoneNextTransition` (`timezone.html`): the result is
_null_ only "if no such transition exists for which t ≤ ℤ(nsMaxInstant)". Here t =
`+275760-09-07T04:00:00Z` ≤ nsMaxInstant. `GetStartOfDay`: midnight is in the gap, so the start of day is
the transition instant, displayed `01:00-03:00`, and the day has 23 hours. Chromium 153 returns these
values (GMT canary `zoned.B`). The offsets on either side are read directly in the same repro
(`-04:00` at `03:59:59Z`, `-03:00` at `04:00:00Z`).

### Root cause (`lib/ecmascript.ts` on `c8f344c`)

```ts
2775  while (leftOffsetNs === rightOffsetNs && leftMs < uppercap) {
2776    rightMs = leftMs + searchWindow;      // searchWindowForTransitions(id): 19 days by default
2777    if (rightMs > MS_MAX) return null;    // gives up without probing [leftMs, MS_MAX]
```

When the last offset change lies within one window of `MS_MAX`, the loop returns before probing it.
`GetStartOfDay` (l.2283) then does `castExists(GetNamedTimeZoneNextTransition(...))`. `castExists` is
stripped in production builds, so `null` reaches `ValidateEpochNanoseconds` / JSBI and throws a
TypeError instead of a RangeError.

### Patch (against `c8f344c`, verified)

```diff
diff --git a/lib/ecmascript.ts b/lib/ecmascript.ts
index 8e7dd0e..daaadbd 100644
--- a/lib/ecmascript.ts
+++ b/lib/ecmascript.ts
@@ -2772,9 +2772,10 @@ export function GetNamedTimeZoneNextTransition(id: string, epochNanoseconds: JSB
   let rightMs = leftMs;
   let rightOffsetNs = leftOffsetNs;
   const searchWindow = searchWindowForTransitions(id);
-  while (leftOffsetNs === rightOffsetNs && leftMs < uppercap) {
-    rightMs = leftMs + searchWindow;
-    if (rightMs > MS_MAX) return null;
+  // Search the last, partial window up to MS_MAX instead of giving up, so that
+  // a transition at or before nsMaxInstant is still found.
+  while (leftOffsetNs === rightOffsetNs && leftMs < uppercap && leftMs < MS_MAX) {
+    rightMs = Math.min(leftMs + searchWindow, MS_MAX);
     rightOffsetNs = GetNamedTimeZoneOffsetNanosecondsImpl(id, rightMs);
     if (leftOffsetNs === rightOffsetNs) {
       leftMs = rightMs;
```

Termination: `leftMs` strictly increases until it reaches `MS_MAX`, where the loop condition stops it,
and the existing `if (leftOffsetNs === rightOffsetNs) return null;` after the loop returns `null`.
`bisect` then works on `(leftMs, rightMs] ⊆ (…, MS_MAX]`, a valid legacy-Date range.

### Verification

Method: production build of `c8f344c` with only this diff applied (`builds/B`), against a production
build of unmodified `c8f344c` (`builds/main`).

- `repro-B-next-transition-near-max.mjs`: `main` 2 pass / 6 fail; patched 8/8.
- `repro-B-regression-rows.mjs`, rows that must not change: New York next transition from 2026-01-01
  (`2026-03-08T03:00:00-04:00`); Santiago from 2026-01-01 (`2026-04-04T23:00:00-04:00`, tzdb
  `Rule Chile 2023 max - Apr Sun>=2 3:00u`); Tokyo `null`; `null` from `+275760-09-01` in New York and
  Tokyo, from the Santiago transition itself, and from the max instant in Santiago and New York; a
  Santiago lookup from `+275760-08-20` (more than one window back); start of day on `+275760-09-06`
  Santiago and `+275760-09-12` New York. `main` 11/12 (the `+275760-09-06` `hoursInDay` row throws);
  patched 12/12.
- GMT canary on the patched build: `zoned.B` 3/3 REMOVABLE; no other group changed.
- Not run: the polyfill's own jest suite and test262 (see "Not verified").

### Ask

Bug report + PR with the diff above, in js-temporal/temporal-polyfill, and the equivalent
`ecmascript.mjs` change in tc39/proposal-temporal (same three lines).

---

## C. Non-ISO calendars: port-and-release request

### Title

Port and release the non-ISO calendar fixes from proposal-temporal (D1, D3, D5, D7, D8), plus two new fixes
for `untilCalendar` near the limits and after a constrained leap month

### What is being asked, per defect

| Defect | What goes wrong | On js-temporal `main` `c8f344c` | Upstream source | Ask | Verified |
|---|---|---|---|---|---|
| D1 | fields → ISO probes outside the legacy `Date` range near both limits (`Invalid ISO date`) | broken | proposal `a41eb67` + `af0cb4b` (not on `main`, not in #361) | port | yes, but **not sufficient alone** (see D1b) |
| D1b | `untilCalendar` month loop formats one month past the limit (hebrew, persian; islamic near the min) | broken | **none: also broken on proposal-temporal `main`** | new patch, file in both repos | yes |
| D2 | buddhist read through ICU's Julian/Gregorian hybrid before 1582-10-15 | **fixed** (`2bb6ba1`) | proposal `28fe786` | release | yes (canary D2 2/2 on `main`) |
| D3 | Hebrew `inLeapYear` wrong for negative years (`%` sign) | broken | proposal `0df570c`; ported in open #361 as `86a89df` | merge #361 + release | yes |
| D4 | ICU4C Hebrew one day off for years ≤ 0 | environment (ICU 78.3) | ICU `5267bb5778` (ICU-23007) | none to the polyfill; Node/ICU note below | n/a |
| D5 | stale "V8 bug 10529" detector (`Saka` vs `Śaka`) throws for every ISO year < 1 | broken | proposal `314b112`; ported in #361 as `b6c9844` | merge #361 + release | yes |
| D6 | `until` re-constrains the day while counting months | **fixed** (`10aeb98`) | proposal `1f6d6df` | release | yes (canary D6 10/10 on `main`) |
| D7 | `until` by years throws "mixed-sign" (proposal #3159) | broken | proposal `0e32ee0`; ported in #361 as `79fb327` | merge #361 + release | yes |
| D7b | after the D7 port, `until` by years still compares the **constrained** intermediate day: `5784-M05L-30` → `5785-M06-29` gives `P1Y` (spec and Chromium: `P12M29D`) | broken | proposal `196a3191` (the `CompareSurpasses(…, calendarOne.day, …)` hunk) | port | yes |
| D8 | Meiji starts 1868; test262 requires `ce` before Meiji 6 (1873) | partly fixed (`2bb6ba1` eras) | proposal `977d11e0` + `993e6322` | port | yes |

_Verification log:_

- **Per-port builds** (each port alone on `c8f344c`, GMT canary on the build; "unpatched" = `main`):

  | Defect | Port | Canary probe | `main` | Port alone | Other groups |
  |---|---|---|---|---|---|
  | D3 | #361 `86a89df` (= proposal `0df570c`) | `D3.-100000-01-01 hebrew` (`monthsInYear` 12) | STILL NEEDED (`Missing month converting …`) | **REMOVABLE** | unchanged |
  | D5 | #361 `b6c9844` (= proposal `314b112`), `lib/calendar.ts` hunk only (its `expected-failures-cldr48.txt` hunk conflicts with `main` and is not needed) | `D5.-000500-06-15 indian` (`-578\|M03\|25`) | STILL NEEDED (`calendar 'indian' is broken for ISO dates before 0001-01-01`) | **REMOVABLE** | unchanged |
  | D7 | #361 `79fb327` (= proposal `0e32ee0`) | `D7.mixedSign hebrew` (`P12M29D`) | STILL NEEDED (`mixed-sign values not allowed`) | **REMOVABLE** | unchanged |
  | D1 | hand port of `a41eb67` + `af0cb4b` to TypeScript | 27 `D1.*` probes; `repro-C-calendar-fields-near-limits.mjs` 21 rows | 19/27 fail; repro-C 12 FAIL | repro-C **21/21**; canary **5/27 still fail** (see below) | unchanged |

- **D1 is not fully fixed by `a41eb67` + `af0cb4b`** on js-temporal's code. With the port, these canary probes
  still throw (stacks from the source-mapped production build):
  - `D1.untilNearMax hebrew` (`Invalid ISO date: +275760-09-27`), `D1.untilNearMax persian` (`+275760-10-02`) and
    `D1.relativeTo hebrew` (`+275760-09-17`): `untilCalendar`'s month loop calls `addMonthsCalendar(current, sign)`
    one month past the target, and `addMonthsCalendar` formats `addDaysISO(isoDate, daysInMonth)` past the legacy
    `Date` maximum. `af0cb4b` shifts that probe only for islamic, indian and the orthodox calendars, so hebrew and
    persian still reach `Intl.DateTimeFormat`. proposal-temporal `main` has the same `addMonthsCalendar` and
    loop (`polyfill/lib/calendar.mjs` l.1071–1105, l.1190–1197).
  - `D1.fieldsMin hebrew` (`Invalid ISO date: -271821-04-11`): the unclamped bisection step in
    `calendarToIsoDate`. Whether it is independent of D3 is checked on the combined build.
  - `D1.fieldsMin indian` is D5 (the stale `Saka` detector), not D1.
- **Combined build** (`C-all` = D1 port + D3 + D5 + D7 + D8 ports on `c8f344c`): canary D2, D3, D5, D6, D7, D8
  groups all REMOVABLE; D4 2/3 still needed (ICU, expected); D1 **24/27**. `repro-C` 21/21. `D1.fieldsMin hebrew`
  passes here, so its bisection overshoot was a consequence of D3 (wrong leap years), not a separate D1 path.
  The 3 remaining D1 probes are the `untilCalendar` month-loop overshoot above.
- **D8 port alone** (`C-D8`): D8 3/3 REMOVABLE, nothing else changes. First attempt failed `tsc` (TS2741:
  `HelperBase`'s placeholder `anchorEra` lacked `startingYear`); the final diff sets `startingYear: 1` there.
- **Reference check against tc39/proposal-temporal `main` `e8cc03f`** (unbundled `polyfill/lib/shim.mjs`, runtime
  deps installed with `npm install --omit=dev`): `repro-A` 16/16, `repro-D` 6/6, `repro-C` 21/21 (so A, D and the
  D1 field cases are fixed there); `repro-B` still fails 6/8 (`TypeError: Cannot read properties of null (reading
  'lesser')`), and **the three residual D1 probes fail identically** (`Invalid ISO date: +275760-09-27T00:00Z`,
  `+275760-10-02`, `+275760-09-17`). The residual until defect is therefore unfixed upstream everywhere and needs a
  new patch (C-D1b, below).
- Current `main` already fixes D2 (buddhist before 1582, `2bb6ba1`) and D6 (month-end `until`,
  `10aeb98`). GMT canary on a `main` build: D2 2/2 and D6 10/10 REMOVABLE.
- **Old draft appendix, corrected** (`repros/appendix-claims.mjs`, reads of `2024-01-01`, `2024-06-15`,
  `1000-01-01`, `-000500-06-15` and a fields round trip):
  - "coptic and ethiopic throw at every date": true of **0.5.1 only** (`Era am (ISO year 1740) was not matched by
    any era`). On `main` both read correctly, e.g. `2024-01-01` → coptic `am|1740|M04|22`, ethiopic
    `am|2016|7516|M04|22`, and round-trip from fields.
  - "chinese and dangi throw" (related to #360): **still true on `main`** under ICU 78 (`RangeError: Unexpected leap
    month suffix: Mo11` / `Mo5`), because ICU now formats months as `Mo11`. Fixed only in open PR #361 by `16dff41`
    (port of proposal `835c195`). GMT exposes neither calendar, so this is not part of GMT's ask; it is one more
    reason for a release of #361.
- D8 is only partly fixed on `main`: `1800-01-01` → `ce|1800` and `0000-12-31` → `bce|1` pass, but
  `1872-12-31` still reads `meiji|5` where test262 `intl402/Temporal/PlainDate/from/japanese-pre-meiji.js`
  requires `ce` before Meiji 6 (1873). That needs proposal-temporal `977d11e0` "Fix Meiji era start
  date" + `993e6322` "Update Meiji era start date", which are not on js-temporal `main` or in #361.
- D3 (`0df570c`), D5 (`314b112`) and D7 (`0e32ee0`) are ported in **open PR #361** as `86a89df`,
  `b6c9844` and `79fb327`, not on `main`.
- D1 (`a41eb67`, `af0cb4b`) is on neither `main` nor #361. On a `main` build the canary D1 group
  still fails 19/27 probes, including **hebrew `fieldsMin`**
  (`Invalid ISO date: -271821-03-20T00:00Z`), a failure the CORE-6 spec did not list.
- **Two new fixes found and verified**, needed on top of every upstream port:
  - **C-D1b** (new; no upstream equivalent): with D1 + D3 + D5 + D7 + D8 ported, `untilCalendar` still threw for
    hebrew/persian near both limits. C-D1b alone on `main` fixes `D1.untilNearMax persian` and
    `D1.relativeTo hebrew` (the hebrew `untilNearMax` probe also needs the D1 field fix). With everything
    (`C-all2`): canary D1 **27/27**.
  - **C-D7b** (port of proposal `196a3191`'s `CompareSurpasses` hunk): `repros/hebrew-grid-residual.mjs`,
    hebrew `5784-M05L-30` until `5785-M06-29`, `largestUnit: "years"`: `main` `P1Y`, D7 port `P1Y`, **D7 + D7b
    `P12M29D`**, proposal-temporal `main` `P12M29D`, Chromium 152 `P12M29D`. Spec: `NonISODateSurpasses` compares
    the un-constrained day (30 > 29), so a year has not been reached. GMT's canary has no probe for this row.
- **Edge-window scans** (`repros/scan-edge-windows.mjs`: every ISO day within 400 days of each limit; read,
  fields → date with `monthCode` constrain/reject and ordinal `month` reject, ±1 month, ±1 year, `until(edge)` by
  months and years; hebrew, persian, islamic-civil/tbla/umalqura, indian, ethioaa, coptic, ethiopic, buddhist;
  72 000 operations each). Summaries in `results/scan-*.summary.txt`. Throws from ±1 month/year whose result is
  past the limit are required by the spec and are not listed.

  | Build | Non-required failures |
  |---|---|
  | `C-all` (D1+D3+D5+D7+D8) | hebrew and persian `until(edge)` throw at **every** sampled day at both limits (399 × 4 each); islamic-* `until(edge)` near the min: 8 days each (`Input eraYear … doesn't match`); coptic near the min (below) |
  | `C-all2` (+ C-D1b) | **only coptic near the min** |
  | proposal-temporal `main` | hebrew and persian `until(edge)` at every sampled day at both limits; islamic-* `until(edge)` at every sampled day near the min; indian `until(edge)` near the min (34 days, `Year … out of range`); coptic/ethioaa/ethiopic fields → date trip proposal's new assertion `calendarToIsoDate search should not overshoot a month entirely` at `+275760-04-20` and `-271820-01-26` (proposal #3292 assumed that block unreachable) |

  Coptic near the min (`C-all2`, not GMT-exposed, **root cause UNVERIFIED**): for ISO dates
  `-271820-01-27 … -271821-…` (400 sampled days), rebuilding a date from its own `{year, monthCode, day}` returns a
  date near `+272388`, and `until(edge)` throws "mixed-sign" for 29 days. It looks like the era-reversed coptic
  `year` (ICU 78 dropped `ERA0`, see #361's `023f6de`) but was not investigated. File separately if wanted; GMT
  does not expose `coptic`.
- **Is the spec's extra clamp on the bisection step reachable?** An out-of-range estimate is reachable: the
  instrumented build (`patches/C-D1-instrumented-NOT-FOR-UPSTREAM.diff`, D1 + D3 + D5 + D7 + D8, scan above)
  recorded 116 831 out-of-range ISO estimates at the bisection step (`addDaysISO(isoEstimate, sign * increment)`)
  and 5 375 in `calculateSameMonthResult`. **None surfaced as an error.** They occur in the shifted calendars
  (islamic, indian, orthodox), whose `isoToCalendarDate` formats them safely after `af0cb4b`; hebrew and persian
  field conversions showed no failure in 72 000 operations. The one probe that did throw from the bisection step
  (`D1.fieldsMin hebrew`, `-271821-04-11`) was caused by D3 and passes once D3 is ported. **So the extra clamp is
  not needed; the CORE-6 spec §2.1 diff should drop it** (proposal-temporal did not add it either).
- **Month-arithmetic regression oracle** (`q2-grid-*` from the earlier research: 11 calendars × 401 start days ×
  15 spans, `until` months/years both directions, `add`/`subtract`, against Chromium 152 native Temporal):

  | Build | Mismatches with Chromium 152 |
  |---|---|
  | npm 0.5.1 (earlier research) | buddhist 20, hebrew 97, islamic-civil 24, islamic-tbla 24, islamic-umalqura 20, persian 10, indian 8, ethioaa 20, japanese 20, roc 20, gregory 20 |
  | `C-all` | hebrew 1 (the C-D7b row) |
  | `C-all2` (+ C-D1b) | hebrew 1; grid output **byte-identical** to `C-all`, so C-D1b changes nothing at ordinary dates |
  | `final2` (A–D all patches, C-D1b, C-D7b) | **identical to native for all 11 calendars** |

### Patches (each a unified diff against `c8f344c` `lib/calendar.ts`, verified)

Apply order used for the combined builds: D1, D3, D5, D7, D8, D1b, D7b. D7b's context assumes D7; every other
diff applies alone to `main`.

**D1: port of proposal `a41eb67` + `af0cb4b`.** In the TypeScript classes, the shifted `isoToCalendarDate`
becomes an `override` calling `super.isoToCalendarDate`, and `ES.AddDaysToISODate` is the file's `addDaysISO`.

```diff
diff --git a/lib/calendar.ts b/lib/calendar.ts
index e840acc..d194335 100644
--- a/lib/calendar.ts
+++ b/lib/calendar.ts
@@ -636,6 +636,67 @@ function simpleDateDiff(one: CalendarYMD, two: CalendarYMD) {
   };
 }
 
+function compareISODateToLegacyDateRange({ year, month, day }: ISODate) {
+  if (year < -271821 || (year === -271821 && (month < 4 || (month === 4 && day < 19)))) return -1;
+  if (year > 275760 || (year === 275760 && (month > 9 || (month === 9 && day > 13)))) return 1;
+  return 0;
+}
+
+function clampISODate(iso: ISODate): ISODate {
+  const cmp = compareISODateToLegacyDateRange(iso);
+  if (cmp < 0) return { year: -271821, month: 4, day: 19 };
+  if (cmp > 0) return { year: 275760, month: 9, day: 13 };
+  return iso;
+}
+
+function cacheShiftedResult(isoDate: ISODate, adjusted: FullCalendarDate, cache: OneObjectCache) {
+  cache.set(OneObjectCache.generateISOToCalendarKey(isoDate), adjusted);
+  (['constrain', 'reject'] as const).forEach((overflow) => {
+    cache.set(OneObjectCache.generateCalendarToISOKey(adjusted, overflow), isoDate);
+  });
+}
+
+// For ISO dates outside the legacy Date range, format a date shifted by a whole
+// number of calendar cycles that keep the same month and day, and shift the year back.
+function shiftedIsoToCalendarDate(
+  isoDate: ISODate,
+  cache: OneObjectCache,
+  cycleYears: number,
+  base: (isoDate: ISODate, cache: OneObjectCache) => FullCalendarDate
+): FullCalendarDate {
+  if (compareISODateToLegacyDateRange(isoDate) === 0) return base(isoDate, cache);
+  const offset = Math.round((isoDate.year - 2000) / cycleYears) * cycleYears;
+  const result = base({ ...isoDate, year: isoDate.year - offset }, cache);
+  const adjusted = { ...result, year: result.year + offset };
+  if (adjusted.eraYear !== undefined) adjusted.eraYear += offset;
+  cacheShiftedResult(isoDate, adjusted, cache);
+  return adjusted;
+}
+
+function dayShiftedIsoToCalendarDate(
+  isoDate: ISODate,
+  cache: OneObjectCache,
+  cycleDays: number,
+  cycleYears: number,
+  base: (isoDate: ISODate, cache: OneObjectCache) => FullCalendarDate
+): FullCalendarDate {
+  if (compareISODateToLegacyDateRange(isoDate) === 0) return base(isoDate, cache);
+  // Shift by the minimum number of cycles to bring the date within the legacy
+  // Date range. Using a minimal shift avoids accumulated errors for calendars
+  // where the cycle length is approximate (e.g., islamic-umalqura).
+  const direction = isoDate.year > 0 ? 1 : -1;
+  const approxDaysBeyond = Math.abs(isoDate.year - direction * 2000) * 365;
+  const numCycles = Math.max(1, Math.floor(approxDaysBeyond / cycleDays));
+  const safeIsoDate = addDaysISO(isoDate, -numCycles * cycleDays * direction);
+  assert(compareISODateToLegacyDateRange(safeIsoDate) === 0, 'numCycles calculation should be correct');
+  const yearShift = numCycles * cycleYears * direction;
+  const result = base(safeIsoDate, cache);
+  const adjusted = { ...result, year: result.year + yearShift };
+  if (adjusted.eraYear !== undefined) adjusted.eraYear += yearShift;
+  cacheShiftedResult(isoDate, adjusted, cache);
+  return adjusted;
+}
+
 /**
  * Implementation helper that's common to all non-ISO calendars
  */
@@ -984,7 +1045,7 @@ abstract class HelperBase {
     }
 
     // First, try to roughly guess the result
-    let isoEstimate = this.estimateIsoDate({ year, month, day });
+    let isoEstimate = clampISODate(this.estimateIsoDate({ year, month, day }));
     const calculateSameMonthResult = (diffDays: number) => {
       // If the estimate is in the same year & month as the target, then we can
       // calculate the result exactly and short-circuit any additional logic.
@@ -1016,7 +1077,7 @@ abstract class HelperBase {
     let diff = simpleDateDiff(date, roundtripEstimate);
     if (diff.years !== 0 || diff.months !== 0 || diff.days !== 0) {
       const diffTotalDaysEstimate = diff.years * 365 + diff.months * 30 + diff.days;
-      isoEstimate = addDaysISO(isoEstimate, diffTotalDaysEstimate);
+      isoEstimate = clampISODate(addDaysISO(isoEstimate, diffTotalDaysEstimate));
       roundtripEstimate = this.isoToCalendarDate(isoEstimate, cache);
       diff = simpleDateDiff(date, roundtripEstimate);
       if (diff.years === 0 && diff.months === 0) {
@@ -1574,6 +1635,9 @@ abstract class IslamicBaseHelper extends HelperBase {
     const { year } = this.adjustCalendarDate(calendarDate);
     return { year: Math.floor((year * this.DAYS_PER_ISLAMIC_YEAR) / this.DAYS_PER_ISO_YEAR) + 622, month: 1, day: 1 };
   }
+  override isoToCalendarDate(isoDate: ISODate, cache: OneObjectCache): FullCalendarDate {
+    return dayShiftedIsoToCalendarDate(isoDate, cache, 10631, 30, (d, c) => super.isoToCalendarDate(d, c));
+  }
 }
 
 // There are 4 Islamic calendars with the same implementation in this polyfill.
@@ -1733,6 +1797,9 @@ class IndianHelper extends HelperBase {
     // 'shaka'; return it unconditionally as there is only one era
     return { era: 'shaka', eraYear: calendarDate.eraYear };
   }
+  override isoToCalendarDate(isoDate: ISODate, cache: OneObjectCache): FullCalendarDate {
+    return shiftedIsoToCalendarDate(isoDate, cache, 4, (d, c) => super.isoToCalendarDate(d, c));
+  }
 }
 
 /**
@@ -2036,6 +2103,9 @@ abstract class OrthodoxBaseHelper extends GregorianBaseHelper {
   override minimumMonthLength = OrthodoxOps.minimumMonthLength;
   override maximumMonthLength = OrthodoxOps.maximumMonthLength;
   override maxLengthOfMonthCodeInAnyYear = OrthodoxOps.maxLengthOfMonthCodeInAnyYear;
+  override isoToCalendarDate(isoDate: ISODate, cache: OneObjectCache): FullCalendarDate {
+    return dayShiftedIsoToCalendarDate(isoDate, cache, 1461, 4, (d, c) => super.isoToCalendarDate(d, c));
+  }
 }
 
 // `coptic` and `ethiopic` calendars are very similar to `ethioaa` calendar,
```

**C-D1b (new): step months arithmetically in `untilCalendar`.** The loop only compares the next month's
`year`/`month` (its day is reset to `calendarOne.day`), so materializing it with `addMonthsCalendar()` was never
needed and is what formats a date past the limit. Same `monthsInYear()` calls that `addMonthsCalendar()` already
makes. The same change applies to proposal-temporal `polyfill/lib/calendar.mjs` l.1193.

```diff
diff --git a/lib/calendar.ts b/lib/calendar.ts
index e840acc..9c77b5e 100644
--- a/lib/calendar.ts
+++ b/lib/calendar.ts
@@ -1214,12 +1214,21 @@ abstract class HelperBase {
         do {
           months += sign;
           current = next;
-          next = this.addMonthsCalendar(current, sign, 'constrain', cache);
-          if (next.day !== calendarOne.day) {
-            // In case the day was constrained down, un-constrain it (even if
-            // that's not a real date)
-            next = { ...next, day: calendarOne.day };
+          // Only the year and month of the next month are compared (its day is
+          // un-constrained to calendarOne.day), so step them arithmetically.
+          // addMonthsCalendar() would format an ISO date past the end of the
+          // supported range when calendarTwo is in the last month of the range.
+          let { year, month } = current;
+          month += sign;
+          if (month < 1) {
+            year -= 1;
+            month = this.monthsInYear({ year }, cache);
+          } else if (month > this.monthsInYear({ year }, cache)) {
+            year += 1;
+            month = 1;
           }
+          // The day may not exist in that month; that's fine for the comparison.
+          next = { year, month, day: calendarOne.day };
         } while (this.compareCalendarDates(calendarTwo, next) * sign >= 0);
         months -= sign; // correct for loop above which overshoots by 1
         const remainingDays = this.calendarDaysUntil(current, calendarTwo, cache);
```

**D3: #361 `86a89df` (proposal `0df570c`).**

```diff
diff --git a/lib/calendar.ts b/lib/calendar.ts
index e840acc..a46859b 100644
--- a/lib/calendar.ts
+++ b/lib/calendar.ts
@@ -1398,7 +1398,9 @@ class HebrewHelper extends HelperBase {
     // Given that these can be calculated by counting the number of days in
     // those months, I assume that these DO NOT need to be exposed as
     // Hebrew-only prototype fields or methods.
-    return (7 * year + 1) % 19 < 7;
+    let cycleYear = (7 * year + 1) % 19;
+    if (cycleYear < 0) cycleYear += 19;
+    return cycleYear < 7;
   }
   monthsInYear(calendarDate: CalendarYearOnly) {
     return this.inLeapYear(calendarDate) ? 13 : 12;
```

**D5: #361 `b6c9844` (proposal `314b112`), `lib/calendar.ts` hunk.**

```diff
diff --git a/lib/calendar.ts b/lib/calendar.ts
index e840acc..47af7d5 100644
--- a/lib/calendar.ts
+++ b/lib/calendar.ts
@@ -1718,8 +1718,9 @@ class IndianHelper extends HelperBase {
   // calendar output to fail for all dates before 0001-01-01 ISO.  For example,
   // in Node 12 0000-01-01 is calculated as 6146/12/-583 instead of 10/11/-79 as
   // expected.
-  vulnerableToBceBug =
-    new Date('0000-01-01T00:00Z').toLocaleDateString('en-US-u-ca-indian', { timeZone: 'UTC' }) !== '10/11/-79 Saka';
+  vulnerableToBceBug = !new Date('0000-01-01T00:00Z')
+    .toLocaleDateString('en-US-u-ca-indian', { timeZone: 'UTC' })
+    .startsWith('10/11/-79');
   override checkIcuBugs(isoDate: ISODate) {
     if (this.vulnerableToBceBug && isoDate.year < 1) {
       throw new RangeError(
```

**D7: #361 `79fb327` (proposal `0e32ee0`).** Exactly `git show 79fb327 -- lib/calendar.ts` from
js-temporal branch `rebase-part3`; it applies to `c8f344c` without conflict (41 insertions, 4 deletions, mostly
comments). The behavioural hunks:

```diff
@@ -1217,13 +1236,27 @@ abstract class HelperBase {
           }
           years = 0;
         }
+
+        // intermediate should be a date between calendarOne and calendarTwo,
+        // that is within a year of calendarTwo.
         const intermediate =
           years || months ? this.addCalendar(calendarOne, { years, months }, 'constrain', cache) : calendarOne;
+
+        // At this point, intermediate could fail to be in between calendarOne and calendarTwo
+        // due to leap years.
+        // In that case, add or subtract an extra year from years,
+        // so that the months can be totaled up correctly.
+        if (this.compareCalendarDates(intermediate, calendarTwo) * sign > 0) {
+          years -= sign;
+        }
+
         // Now we have less than one cycle remaining. Add one month at a time
         // until we go over the target, then back up one month and calculate
         // remaining days.
-        let current;
-        let next: CalendarYMD = intermediate;
+        let current: CalendarYMD;
+        // Need to re-add years and months because years might have changed
+        let next: CalendarYMD =
+          years || months ? this.addCalendar(calendarOne, { years, months }, 'constrain', cache) : calendarOne;
         do {
           months += sign;
           current = next;
```

**C-D7b: port of proposal `196a3191`'s surpass check** (on top of D7; line numbers are D7-applied `main`).

```diff
--- a/lib/calendar.ts
+++ b/lib/calendar.ts
@@ -1233,7 +1233,9 @@
         // due to leap years.
         // In that case, add or subtract an extra year from years,
         // so that the months can be totaled up correctly.
-        if (this.compareCalendarDates(intermediate, calendarTwo) * sign > 0) {
+        // Compare with the un-constrained day of calendarOne, as NonISODateSurpasses
+        // does: a constrained intermediate day must not count as reaching calendarTwo.
+        if (this.compareCalendarDates({ ...intermediate, day: calendarOne.day }, calendarTwo) * sign > 0) {
           years -= sign;
         }
 
```

**D8: port of proposal `977d11e0` + `993e6322`** (`hasYearZero` → `startingYear`, Meiji from 1873-01-01 as
6 Meiji). The `startingYear: 1` on `HelperBase`'s placeholder era is required by `tsc` (TS2741) in the TypeScript
port.

```diff
diff --git a/lib/calendar.ts b/lib/calendar.ts
index e840acc..359f0b1 100644
--- a/lib/calendar.ts
+++ b/lib/calendar.ts
@@ -661,6 +661,7 @@ abstract class HelperBase {
     // dummy era for calendars without eras
     code: '',
     genericName: '',
+    startingYear: 1,
     anchorEpoch: { year: 0, month: 1, day: 1 },
     isoEpoch: { year: 0, month: 1, day: 1 }
   };
@@ -855,14 +856,14 @@ abstract class HelperBase {
         }
         // last era always gets all "leftover" (older than epoch) years,
         // so no need for a comparison like below.
-        eraYear = year - e.anchorEpoch.year + (e.hasYearZero ? 0 : 1);
+        eraYear = year - e.anchorEpoch.year + e.startingYear;
         return true;
       }
       // FIXME: This cast may not be correct. I think month and day are always
       // present when we get here, but the type system does not prove it
       const comparison = this.compareCalendarDates(calendarDate as CalendarYMD, e.anchorEpoch);
       if (comparison >= 0) {
-        eraYear = year - e.anchorEpoch.year + (e.hasYearZero ? 0 : 1);
+        eraYear = year - e.anchorEpoch.year + e.startingYear;
         return true;
       }
       return false;
@@ -894,7 +895,7 @@ abstract class HelperBase {
       if (matchingEra.reverseOf) {
         year = matchingEra.anchorEpoch.year - eraYear;
       } else {
-        year = eraYear + matchingEra.anchorEpoch.year - (matchingEra.hasYearZero ? 0 : 1);
+        year = eraYear + matchingEra.anchorEpoch.year - matchingEra.startingYear;
       }
       if (calendarDate.year !== undefined && calendarDate.year !== year) {
         throw new RangeError(`Input year ${calendarDate.year} doesn't match calculated value ${year}`);
@@ -1768,10 +1769,10 @@ interface InputEra {
   reverseOf?: string;
 
   /**
-   * If true, the era's years are 0-based. If omitted or false,
-   * then the era's years are 1-based.
+   * Number of the era's starting year (for example, 0 if there's a Year 0).
+   * If omitted, the era's years are 1-based.
    * */
-  hasYearZero?: boolean;
+  startingYear?: number;
 
   /**
    * Override if this era is the anchor. Not normally used because
@@ -1823,10 +1824,10 @@ interface Era {
   reverseOf?: Era;
 
   /**
-   * If true, the era's years are 0-based. If omitted or false,
-   * then the era's years are 1-based.
+   * Number of the era's starting year (for example, 0 if there's a Year 0).
+   * Filled in by adjustEras(); 1 if the input omitted it.
    * */
-  hasYearZero?: boolean;
+  startingYear: number;
 
   /**
    * Override if this era is the anchor. Not normally used because
@@ -1867,10 +1868,11 @@ function adjustEras(erasParam: InputEra[]): { eras: Era[]; anchorEra: Era } {
   // anchor.
   let anchorEra: Era | InputEra | undefined;
   eras.forEach((e) => {
+    e.startingYear ??= 1;
     if (e.isAnchor || (!e.anchorEpoch && !e.reverseOf)) {
       if (anchorEra) throw new RangeError('Invalid era data: cannot have multiple anchor eras');
       anchorEra = e;
-      e.anchorEpoch = { year: e.hasYearZero ? 0 : 1 };
+      e.anchorEpoch = { year: e.startingYear };
     } else if (!e.code) {
       throw new RangeError('If era name is blank, it must be the anchor era');
     }
@@ -1973,7 +1975,7 @@ abstract class GregorianBaseHelper extends HelperBase {
     const calendarDate = this.adjustCalendarDate(calendarDateParam);
     const { year, month, day } = calendarDate;
     const { anchorEra } = this;
-    const isoYearEstimate = year + anchorEra.isoEpoch.year - (anchorEra.hasYearZero ? 0 : 1);
+    const isoYearEstimate = year + anchorEra.isoEpoch.year - anchorEra.startingYear;
     return ES.RegulateISODate(isoYearEstimate, month, day, 'constrain');
   }
 }
@@ -2133,13 +2135,8 @@ class GregoryHelper extends SameMonthDayAsGregorianBaseHelper {
 //
 // NOTE: Japan started using the Gregorian calendar in 6 Meiji, replacing a
 // lunisolar calendar. So the day before January 1 of 6 Meiji (1873) was not
-// December 31, but December 2, of 5 Meiji (1872). The existing Ecma-402
-// Japanese calendar doesn't seem to take this into account, so neither do we:
-// > args = ['en-ca-u-ca-japanese', { era: 'short' }]
-// > new Date('1873-01-01T12:00').toLocaleString(...args)
-// '1 1, 6 Meiji, 12:00:00 PM'
-// > new Date('1872-12-31T12:00').toLocaleString(...args)
-// '12 31, 5 Meiji, 12:00:00 PM'
+// December 31, but M12-02, of 5 Meiji (1872). To avoid confusion between
+// lunisolar and solar dates we count years prior to 1873 as CE.
 class JapaneseHelper extends SameMonthDayAsGregorianBaseHelper {
   constructor() {
     super('japanese', [
@@ -2149,7 +2146,7 @@ class JapaneseHelper extends SameMonthDayAsGregorianBaseHelper {
       { code: 'heisei', isoEpoch: { year: 1989, month: 1, day: 8 }, anchorEpoch: { year: 1989, month: 1, day: 8 } },
       { code: 'showa', isoEpoch: { year: 1926, month: 12, day: 25 }, anchorEpoch: { year: 1926, month: 12, day: 25 } },
       { code: 'taisho', isoEpoch: { year: 1912, month: 7, day: 30 }, anchorEpoch: { year: 1912, month: 7, day: 30 } },
-      { code: 'meiji', isoEpoch: { year: 1868, month: 9, day: 8 }, anchorEpoch: { year: 1868, month: 9, day: 8 } },
+      { code: 'meiji', isoEpoch: { year: 1873, month: 1, day: 1 }, anchorEpoch: { year: 1873 }, startingYear: 6 },
       { code: 'ce', isoEpoch: { year: 1, month: 1, day: 1 } },
       { code: 'bce', reverseOf: 'ce' }
     ]);
```

### Repro (GMT canary rows, verbatim inputs)

```js
import { Temporal } from "@js-temporal/polyfill";
const iso = (d) => d.withCalendar("iso8601").toString();
// D1 (test262 intl402/Temporal/PlainDate/from/extreme-dates.js)
iso(Temporal.PlainDate.from({ calendar: "hebrew", year: 279517, month: 10, day: 11 }, { overflow: "reject" }));      // +275760-09-13
iso(Temporal.PlainDate.from({ calendar: "islamic-civil", year: -280804, month: 3, day: 21 }, { overflow: "reject" })); // -271821-04-19
// D1 / D1b (Chromium 152/153)
Temporal.PlainDate.from("+275760-07-01").withCalendar("persian").until(Temporal.PlainDate.from("+275760-09-13").withCalendar("persian"), { largestUnit: "months" }); // P2M12D
Temporal.Duration.from("P40D").round({ largestUnit: "months", relativeTo: Temporal.PlainDate.from({ calendar: "hebrew", year: 279517, month: 8, day: 15 }) }); // P1M10D
// D3: Temporal.PlainDate.from("-100000-01-01").withCalendar("hebrew").monthsInYear            // 12
// D5: Temporal.PlainDate.from("-000500-06-15").withCalendar("indian") → -578 M03 25
// D7: hebrew {5784, month 6, day 2}.until({5785, month 6, day 1}, { largestUnit: "years" })    // P12M29D
// D7b: PlainDate.from("2024-03-10").withCalendar("hebrew").until(+384 days, { largestUnit: "years" }) // P12M29D
// D8: Temporal.PlainDate.from("1872-12-31").withCalendar("japanese") → era "ce", eraYear 1872 (test262 japanese-pre-meiji.js)
```

On `main` every row above throws or returns another value (`Invalid ISO date: …`, `Missing month converting …`,
`calendar 'indian' is broken …`, `mixed-sign values not allowed`, `P1Y`, `meiji|5`).

### D4: ICU note (not a polyfill defect)

- ICU4C `hebrwcal.cpp` mis-applies the Kislev-length and dechiyah rules for years ≤ 0, so Node reads
  `-271821-11-05` as `-268057 M05 27` and `-003761-09-01` as `0 M01 12`. Chromium (ICU4X) and the
  Dershowitz–Reingold arithmetic give day 28 and day 13. Canary D4 still fails on every build here, as expected.
- Fixed by ICU `5267bb57783a55dea0e4d35551c76740cb62c9ee` (2026-07-13) "ICU-23007 Fix Hebrew calendar year <= 0
  Kislev length and Dechiya boundary rules (ICU-23070, ICU-22441)".
- **Not released:** `gh api repos/unicode-org/icu/compare/release-78.3...5267bb5778` → diverged (276 ahead), the
  latest ICU4C release is `release-78.3` (2026-03-17), and there is no `release-79` tag. Node `main` and `v24.x`
  both bundle ICU 78.3 (`deps/icu-small/source/common/unicode/uvernum.h`).
- Ask: none to js-temporal. GMT's D3+D4 removal needs an ICU release containing `5267bb5778` **and** a Node
  release bundling it as GMT's `engines.node` floor. Optionally note it on ICU-23007 / nodejs/node when ICU 79 lands.

### Ask

> 1. Please merge #361 (it carries D3, D5, D7 and the ICU 78 fixes for chinese/dangi and coptic) and release.
> 2. Please port proposal-temporal `a41eb67`, `af0cb4b`, `977d11e0`, `993e6322` and the `CompareSurpasses`
>    hunk of `196a3191` (diffs above).
> 3. New bug + PR (also in tc39/proposal-temporal): non-ISO `until` by months/years throws `Invalid ISO date` for
>    hebrew and persian within a month of either limit, because `untilCalendar` materializes the month past the
>    target. Diff C-D1b above.
> 4. `2bb6ba1` (D2, eras) and `10aeb98` (D6) are on `main`: covered by the same release.

---

## D. `"UTC"` fast path in `GetPossibleEpochNanoseconds` skips `IsValidEpochNanoseconds`

### Title

Port proposal-temporal #3205: validate the result of the UTC fast path in `GetPossibleEpochNanoseconds`

### Status

| Build                | `repro-D-utc-fast-path-validation.mjs` (6 rows)            | `repro-D-regression-rows.mjs` (18 rows) | Canary `zoned.D`  |
| -------------------- | ---------------------------------------------------------- | --------------------------------------- | ----------------- |
| npm 0.5.1            | UTC rows return values (2 FAIL)                            | —                                       | STILL NEEDED      |
| `main` `c8f344c`     | **2 FAIL** (UTC returns `P3DT5H` and `2.0416666666666665`) | 18/18                                   | 2/2 STILL NEEDED  |
| `main` + patch below | **6/6 PASS**                                               | **18/18 PASS**                          | **2/2 REMOVABLE** |

Already fixed in tc39/proposal-temporal: issue #3203, PR #3205 (merged 2025-12-11, merge commit
`d90d432b2f`). The fix is the same three-line change as below. Not in PR #361's batch, which ends at the
2025-11-26 proposal commits.

### Repro

```js
import { Temporal } from "@js-temporal/polyfill";
const MAX = 8640000000000000000000n,
  D = 86400000000000n,
  H = 3600000000000n;
for (const zone of ["UTC", "+00:00", "Europe/London"]) {
  const start = new Temporal.ZonedDateTime(MAX - 3n * D - 5n * H, zone),
    max = new Temporal.ZonedDateTime(MAX, zone);
  start.until(max, { largestUnit: "day", smallestUnit: "hour" }); // expected RangeError in all three zones
  Temporal.Duration.from("PT49H").total({
    unit: "day",
    relativeTo: new Temporal.ZonedDateTime(MAX - 2n * D - H, zone),
  }); // expected RangeError
}
// main: "UTC" returns P3DT5H and 2.0416666666666665; "+00:00" and Europe/London throw RangeError.
```

**Expected-value sources.** Spec `GetPossibleEpochNanoseconds` (`timezone.html`): "For each value
_epochNanoseconds_ in _possibleEpochNanoseconds_, if IsValidEpochNanoseconds(_epochNanoseconds_) is
_false_, throw a _RangeError_". "UTC" takes the named-zone branch. The rounding window end is
`+275760-09-13T19:00` (`NudgeToZonedTime`) and `+275760-09-13T23:00` (`ComputeNudgeWindow`), both past
nsMaxInstant. Chromium 153 throws (GMT canary `zoned.D`); the polyfill itself throws for `+00:00`.
test262 `built-ins/Temporal/Duration/prototype/total/relativeto-date-limits.js` (cited in #3203).

### Root cause (`lib/ecmascript.ts` on `c8f344c`)

```ts
2243  if (timeZone === 'UTC') {
2244    CheckISODaysRange(isoDateTime.isoDate);
2245    return [GetUTCEpochNanoseconds(isoDateTime)];   // offset (l.2263) and named (l.2927) branches validate; this one does not
```

### Patch (against `c8f344c`, verified; identical in effect to proposal-temporal `d90d432`)

```diff
diff --git a/lib/ecmascript.ts b/lib/ecmascript.ts
index 8e7dd0e..6c8fdb0 100644
--- a/lib/ecmascript.ts
+++ b/lib/ecmascript.ts
@@ -2242,7 +2242,9 @@ function GetPossibleEpochNanoseconds(timeZone: string, isoDateTime: ISODateTime)
   // UTC fast path
   if (timeZone === 'UTC') {
     CheckISODaysRange(isoDateTime.isoDate);
-    return [GetUTCEpochNanoseconds(isoDateTime)];
+    const epochNs = GetUTCEpochNanoseconds(isoDateTime);
+    ValidateEpochNanoseconds(epochNs);
+    return [epochNs];
   }

   const offsetMinutes = ParseTimeZoneIdentifier(timeZone).offsetMinutes;
```

### Verification

Method: production build of `c8f344c` with only this diff (`builds/D`), against unmodified `main`.

- `repro-D-utc-fast-path-validation.mjs`: `main` 4 pass / 2 fail; patched 6/6.
- `repro-D-regression-rows.mjs`, in `UTC` and `+00:00`: `PlainDateTime` at the max and min →
  ZonedDateTime; one nanosecond past either limit throws; `until`/`since` near both limits without
  `smallestUnit` (`P3DT5H`, `P1D`); `startOfDay` at the max; `PT23H.total(day)` near the max
  (`0.9583333333333334`); an ordinary rounded `until` (`P1DT2H`). 18/18 on both `main` and patched, so
  no in-range UTC behaviour changes.
- GMT canary on the patched build: `zoned.D` 2/2 REMOVABLE; no other group changed.

### Ask

> Please port proposal-temporal #3205 ("Polyfill: Validate result in UTC fast path in
> GetPossibleEpochNanoseconds") and include it in the next release.

---

## Corrections and contradictions

**Contradicts GMT's canary notes and triggers (flag before retiring anything):**

1. **`zoned.A` min edge is already fixed on `main`.** `temporalCompat/README.md`, `temporalCompat/repros.ts`
   (zoned.A comment), `internal/zonedWallClock.ts`, `internal/zonedWallClockOperations.ts`,
   `scripts/temporal-compat.mjs` and CORE-6 spec §6.5 say the minimum edge needs a separate upstream fix. It
   does not: `95237e0` (on `main`) fixes it; the claim was measured on 0.5.1 + `05ce7a3` only. New trigger:
   "a release containing `05ce7a3` and `95237e0`". The canary's expected values are right; only the notes are wrong.
2. **D1 trigger is insufficient.** "ports `a41eb67` (+ `af0cb4b`)" leaves `D1.untilNearMax persian`,
   `D1.untilNearMax hebrew` and `D1.relativeTo hebrew` failing, in js-temporal and in proposal-temporal `main`.
   It also needs C-D1b (new), and `D1.fieldsMin hebrew` needs D3. The "+ a clamp of the bisection step" clause
   should be dropped: not needed.
3. **D6/D7 trigger is insufficient, and GMT has no probe for the gap.** A release with `10aeb98` + `0e32ee0`
   passes GMT's D6 and D7 probes but still returns `P1Y` for hebrew `5784-M05L-30 → 5785-M06-29`
   (`largestUnit: "years"`; spec and Chromium `P12M29D`). Retiring the D6/D7 workaround on those probes alone
   would ship that bug. Add a probe for this row and require the `196a3191` hunk (C-D7b).
4. **D8 trigger is insufficient.** `2bb6ba1` fixes `1800-01-01` and `0000-12-31` but `1872-12-31` stays
   `meiji|5`; it also needs `977d11e0` + `993e6322`.
5. **D3 is ported in open PR #361** (not "not on js-temporal main" in the sense of unavailable): merging #361
   delivers D3, D5 and D7.

**Corrections to the CORE-6 spec and the earlier draft:**

- §1.2 D1: on `main` hebrew also fails at the **min** (`D1.fieldsMin hebrew`), via D3; the spec lists hebrew max only.
- §2.1: drop the bisection-step clamp from the proposed diff (reachable as an estimate, never an error; see C).
  The D1 fix also needs C-D1b.
- §2.7: the D7 port is complete in #361 as `79fb327` (it does re-derive `next`); it still needs C-D7b.
- §2.8: D8 needs `977d11e0` + `993e6322`, not only `2bb6ba1`.
- §6.5: see contradictions 1–4.
- Draft A: not "release + min-edge fix" but release only. Draft B: exact patch now verified; `castExists` is
  stripped in production so the symptom is a TypeError. Draft D: already fixed in proposal-temporal (#3205), so
  it is a port request. Appendix: coptic/ethiopic throw only on 0.5.1; chinese/dangi still throw on `main`
  (fixed in #361 `16dff41`).

## Not verified

- The polyfill's own jest suite and test262 runner were not run for any patch. (`test262` is an
  un-checked-out submodule in the clone.) Verification is the repros, GMT canary, edge-window scans and the
  Chromium 152 grid listed per item. Before opening the PRs, run `npm test` and `npm run test262` on each.
- Coptic near the minimum (wrong `from`-fields result, "mixed-sign" `until`) on the fully patched build:
  root cause **UNVERIFIED**; GMT does not expose `coptic`.
- The final GMT canary runs (`final2`, `main` re-run) used a scratchpad loader hook that also resolves
  extensionless relative imports, because `packages/gmt/dist` was rebuilt at 10:09:54 without `tsc-alias` by a
  process outside this verification (this work only built the polyfill clone). Earlier canary runs used the
  intact dist and agree with the re-runs.
- Scratchpad artefacts (clones, builds, patches, repros, results, logs):
  `/private/tmp/claude-501/-Users-craigcurtis-workbench-northguild-gmt-worktrees-feature-187-core-6-interval-algebra-intersect-clamp-subtract-merge-split-sum-implementation/bdd796f6-e636-477b-bca7-b7182a6ed50b/scratchpad/polyfill-verify/`.
