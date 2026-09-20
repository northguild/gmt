# `@js-temporal/polyfill` — upstream issues and PRs GMT needs

Record of the defects GMT needs fixed in `js-temporal/temporal-polyfill` (and, where noted,
`tc39/proposal-temporal`), the evidence for each, and what has been filed. Nothing here has been posted by an
agent. The owner files every item.

> **Status of this document:** updated 2026-09-19. **Filed:** 11 items, all open with no maintainer comment or
> review yet: six PRs and a release request in js-temporal (#367–#373) and four issues in tc39 (#3327–#3330).
> See "Filed" for the list and "Still unfiled" for what remains. A, B, C and D are verified on production
> builds of js-temporal `main` `c8f344c`. With every patch here applied (build `final2`), GMT's canary reports 9 of 10 workaround
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
| Filings checked               | 2026-09-19, read-only with `gh pr view` and `gh issue view`, comments included. js-temporal `main` still `c8f344c`, proposal-temporal `main` still `e8cc03f`, latest js-temporal release still `v0.5.1`, #361 still open                                                                                                                                              |
| Build method                  | `git clone --filter=blob:none`, `npm ci --ignore-scripts`, `NODE_ENV=production npm run build` (the mode `release-checklist.md` publishes with: minified, assertions stripped). One build per patch, each on a clean `c8f344c` tree                                                                                                                                   |
| Repro runner                  | `POLYFILL=<build>/index.esm.js node <repro>.mjs`                                                                                                                                                                                                                                                                                                                      |
| GMT canary                    | `node --import <loader>/register.mjs scripts/temporal-compat.mjs check`, where the loader hook redirects the bare `@js-temporal/polyfill` specifier to the build under test. GMT's `node_modules` were not touched. The canary's header line still prints "0.5.1" because it reads the installed `package.json`; the code under test is the build named by `POLYFILL` |

Expected values are never taken from the polyfill. Their sources are the TC39 spec text, test262,
IANA tzdb rules, and Chromium 152/153 native Temporal as recorded in GMT's canary
(`packages/gmt/src/internal/temporalCompat/repros.ts`). Every repro row below agrees with that canary.

## Summary

| Id  | Title                                                                                               | Ask                                                                                                                                                                                                                                                                                                                                                                    | Filed as                                                                                                                    | Verified?                                                                                                                                | GMT workaround it retires                                                                                                                 | Floor bump                                                                        |
| --- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| A   | Wall clock → exact time at the range limits                                                         | **Release** of `05ce7a3` + `95237e0` (both on `main`). No new patch: `main` passes every max and min row                                                                                                                                                                                                                                                               | js-temporal #373 (release request)                                                                                          | Yes (build of `main`)                                                                                                                    | `zoned.A`: defect-1 fallbacks in `internal/zonedWallClock.ts`, `zonedWallClockOperations.ts`, `*AtLimit` in `zonedWallClockDifference.ts` | `@js-temporal/polyfill` → first release containing both commits                   |
| B   | `GetNamedTimeZoneNextTransition` returns `null` within one search window of the max                 | **Bug report + PR** (new patch). Same code in proposal-temporal: file there too                                                                                                                                                                                                                                                                                        | js-temporal PR #371 + tc39 #3328                                                                                            | Yes (patched build)                                                                                                                      | `zoned.B`: defect-2 transition fallback in `internal/zonedWallClock.ts`                                                                   | same release                                                                      |
| C   | Non-ISO calendars (D1–D8)                                                                           | **Merge #361 + port + release**: #361 carries D3 `0df570c`, D5 `314b112`, D7 `0e32ee0`; port `a41eb67` + `af0cb4b` (D1), `977d11e0` + `993e6322` (D8), `196a3191` surpass hunk (**D7b**); **new patch C-D1b** (`untilCalendar` near the limits, broken in proposal-temporal too). `2bb6ba1` (D2) and `10aeb98` (D6) are on `main`. D4 is ICU `5267bb5778` (unreleased) | D1 → PR #369; D8 → PR #368; D1b → PR #370 + tc39 #3327. **Not filed:** C-D7b, the ask to merge #361 (D3, D5, D7 ride on it) | Yes (per-port and combined builds; canary, repros, 400-day edge scans, Chromium grid). Coptic near the min: UNVERIFIED, out of GMT scope | `internal/temporalCompat/*` D1–D3, D5–D8; D3+D4 shared code stays until ICU/Node                                                          | same release; D4: `engines.node` floor on a Node with ICU containing `5267bb5778` |
| D   | `"UTC"` fast path in `GetPossibleEpochNanoseconds` skips `IsValidEpochNanoseconds`                  | **Port** proposal-temporal PR #3205 (`d90d432`) + release                                                                                                                                                                                                                                                                                                              | js-temporal PR #367                                                                                                         | Yes (patched build)                                                                                                                      | `zoned.D`: `checkUtcValidity` in `internal/zonedWallClockDifference.ts`                                                                   | same release                                                                      |
| E   | Transition search starts in 1847, after the first TZDB transition (1844-12-31)                      | **Bug report + PR** (new patch), both repositories                                                                                                                                                                                                                                                                                                                     | js-temporal PR #372 + tc39 #3330                                                                                            | Only as stated in the filings; not re-run in this document's builds                                                                      | `zoned.E`: defect-3 pre-1847 checks in `internal/zonedWallClock.ts`, `zonedWallClockOperations.ts`                                        | same release                                                                      |
| F   | `calendarToIsoDate` overshoot assertion (tc39 #3292) is reachable, coptic/ethiopic/ethioaa month 13 | **Bug report** to tc39 only; js-temporal has not ported #3292                                                                                                                                                                                                                                                                                                          | tc39 #3329                                                                                                                  | Only as stated in the filing                                                                                                             | none: not in js-temporal, so not in GMT's runtime                                                                                         | none                                                                              |
| H   | The calendar nudge window is never retried (`total`, `round`, `until` with a calendar `smallestUnit`) | **Port + release**: js-temporal ports proposal-temporal #3172 (`5dd0b0d97ee1`). **Not** a new patch, and **no tc39 filing**: tc39 #3168 is already fixed by #3172 | Not filed yet (found 2026-09-20, CORE-8 review). js-temporal only | Yes (Chromium 153 vs polyfill 0.5.1: 2,016-row `total`, 12,960-row `round`, 9,940-row `until` scans; 16 + 15 + 15 mismatches, all `month`) | `D11`: the defect-4 gates in `internal/zonedWallClockDifference.ts` and `internal/plainDateUntil.ts` | same release |

## Filed

All 11 filed by the owner (`craig-o-curtis`), read back on 2026-09-19 with `gh pr view` / `gh issue view`,
comments included. All open. No maintainer has commented or reviewed; the only comments are the owner's own
cross-links on tc39 #3327, #3328 and #3330. "Filed" is `createdAt`, UTC. "js" is js-temporal/temporal-polyfill,
"tc39" is tc39/proposal-temporal.

| Repository | #    | Kind  | Title                                                                                                         | Carries                                                                       | Pairs with                                                         | Depends on | Closes                                                                                  | Filed      |
| ---------- | ---- | ----- | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------ | ---------- | --------------------------------------------------------------------------------------- | ---------- |
| js         | 367  | PR    | Polyfill: Validate result in UTC fast path in GetPossibleEpochNanoseconds                                     | D (port of tc39 `d90d432`, #3205)                                             | none open: tc39 side already merged (#3205 for #3203)              | —          | nothing open; cites tc39 #3205 and #3203                                                | 2026-09-18 |
| js         | 368  | PR    | Polyfill: Update Meiji era start date                                                                         | C-D8 (port of tc39 `977d11e` + `993e632`)                                     | none: port of tc39 commits                                         | —          | nothing                                                                                 | 2026-09-18 |
| js         | 369  | PR    | Polyfill: Fix extreme PlainYearMonth crash in non-ISO calendars                                               | C-D1 (port of tc39 `a41eb67` + `af0cb4b`)                                     | none: port of tc39 commits                                         | —          | nothing                                                                                 | 2026-09-18 |
| js         | 370  | PR    | Don't format dates past the range limit when counting months in until()                                       | C-D1b (new)                                                                   | tc39 #3327                                                         | js #369    | nothing                                                                                 | 2026-09-18 |
| js         | 371  | PR    | Search the last partial window when looking for the next time zone transition                                 | B (new)                                                                       | tc39 #3328                                                         | —          | nothing                                                                                 | 2026-09-18 |
| js         | 372  | PR    | Start the time zone transition search before the first transition in 1844                                     | E (new)                                                                       | tc39 #3330                                                         | —          | nothing                                                                                 | 2026-09-19 |
| js         | 373  | issue | Release request: main has fixes that 0.5.1 doesn't (ZonedDateTime near the Instant limits, #341, #347)        | A                                                                             | —                                                                  | —          | #341 and #347, by the release it asks for ("A release would let both issues be closed") | 2026-09-19 |
| tc39       | 3327 | issue | Polyfill: non-ISO until() by months gives wrong results since #3245, and throws near the range limits         | C-D1b, plus a regression at ordinary dates from tc39 #3245 (new; see C's log) | js #370                                                            | —          | nothing                                                                                 | 2026-09-18 |
| tc39       | 3328 | issue | Polyfill: GetNamedTimeZoneNextTransition misses a transition in the last search window before the max Instant | B                                                                             | js #371                                                            | —          | nothing                                                                                 | 2026-09-18 |
| tc39       | 3329 | issue | Polyfill: calendarToIsoDate overshoot assertion from #3292 is reachable in coptic/ethiopic/ethioaa month 13   | F (new)                                                                       | none: js-temporal has not ported #3292, so it doesn't have the bug | —          | nothing                                                                                 | 2026-09-18 |
| tc39       | 3330 | issue | Polyfill: time zone transitions before 1847 are not found (Asia/Manila and four Pacific zones on 1844-12-31)  | E                                                                             | js #372                                                            | —          | nothing                                                                                 | 2026-09-19 |

Notes on the filings:

- **#373 is an issue**, so it can't close anything by keyword. It names #341 and #347 as fixed on `main`
  (`2bb6ba1`, `3c40368`) and leaves them for the maintainer to close after a release. It mentions #361 only as
  an aside ("A release after #361 lands would be great too, since it would also fix #360") and says #367–#372
  need not hold up the release.
- **B was filed as a PR only** in js-temporal. #371's description carries the full report, so no separate
  js-temporal issue was opened.
- **#370 depends on #369.** Per #370, with #370 alone 32 `until()` calls near the minimum (persian and
  islamic-\*) that `main` answers start to throw, because `main`'s cache had hidden the unfixed D1 conversions;
  with #369 underneath all of them work. Either PR applies cleanly on `main`, on the other, and with #361.
- **#372 and #371** touch different parts of `lib/ecmascript.ts` and apply together (per #372).
- Every js-temporal PR states: Node 24.21.0 (ICU 78.3), jest 607 passed, and the pinned test262 passes with no
  new failures or unexpected passes. This closes the "run `npm test` and `npm run test262`" item under "Not
  verified" for #367–#372, as the filings' claim; it was not re-run for this document.

### Still unfiled

Built from this document's own asks and checked against the 11 filings above.

1. **C-D7b**, the port of tc39 `196a3191`'s `CompareSurpasses` hunk (C's Ask, point 2). No filing carries it.
   Port **only** that hunk: #370 and tc39 #3327 say the same commit's months-loop hunk corrupts the calendar
   cache, and that C-D1b replaces it. GMT's canary guards the row as `D7.leapMonthEnd`.
2. **The ask to merge #361** (C's Ask, point 1), which carries D3, D5 and D7, the ICU 78 fixes for chinese/dangi
   and coptic, and closes #360. Not asked anywhere. #373 mentions it as an aside, and #368, #369 and #370 cite
   #361 as the fix for neighbouring failures.
3. **D4, the ICU note** (C, "D4: ICU note"). Nothing to file with js-temporal. It waits for an ICU4C release
   containing `5267bb5778` (the latest is still `release-78.3`) and a Node release bundling it; optionally a note
   on ICU-23007 or nodejs/node then.
4. **The coptic minimum** (C's scan, "File separately if wanted"). Not filed, and probably not needed: #370
   states that #361's coptic `ERA0` change fixes the round trip before the coptic epoch (see C's log).
5. **tc39 side:** nothing outstanding. B, C-D1b and E are filed in both repositories; A is js-temporal only by
   nature; D, C-D1 and C-D8 are ports of tc39 commits; C-D7b's source is already in tc39; F is tc39 only.

Raised in the filings but not asked by this document, so not listed above as work GMT needs: tc39 #3277
(chinese/dangi far from the present, `Internal error. Icu error.`) is not ported to js-temporal (#369, #370);
tc39's comment "we count years prior to 1872 as CE" should say 1873 (#368); the mirror-image early return in
`GetNamedTimeZonePreviousTransition` has no visible effect today (#371, #3328); test262 has no test for either
problem in #3327 (#3327 suggests two).

## Upstream issues these fixes close

Verified 2026-09-18, same Environment as above (Node v24.21.0, ICU 78.3), on production builds from a fresh
`git clone` of js-temporal/temporal-polyfill whose `main` is still `c8f344c`. Each issue's reproduction was
taken verbatim from its own text and run against npm 0.5.1, `main`, and a build carrying the commit under
test. Trees were extracted with `git archive <sha>`, so no branch or checkout was created anywhere.

Three open issues are affected. Every other open issue in either repository is unrelated to A–D (as of
2026-09-18, before the owner's own filings in "Filed").

| Issue            | Title                                                                        | Closed by                                                                           | Evidence                                                                                                                                                                                                                                                                                                                                                                                |
| ---------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| js-temporal #341 | Incorrect conversion between calendars                                       | **A** (release of `main`). Fixing commit `2bb6ba1` = D2, which C's Ask item 4 names | The issue's row `PlainDate.from({ year: 1582, month: 1, day: 1 }).withCalendar('buddhist').month`: npm 0.5.1 and a build of `2bb6ba1^` give `12` (day `22`, year `2124`); builds of `2bb6ba1` and of `main` give `1` (day `1`, year `2125`), the value the issue states is correct. japanese and roc rows unchanged                                                                     |
| js-temporal #347 | ZonedDateTime until / since assertion failure: mixed-sign values not allowed | **A** (release of `main`). Fixing commit `3c40368`                                  | The issue's own America/Vancouver rows: npm 0.5.1 and a build of `3c40368^` throw `RangeError: mixed-sign values not allowed as duration fields`; builds of `3c40368` and of `main` return `-PT59M` and `PT59M`                                                                                                                                                                         |
| js-temporal #360 | Bug: Malformed leap month suffix while implementing Chinese calendar         | **C** (merge #361, which carries `16dff41`)                                         | The issue's repro (`Temporal.Now.plainDateISO()` → `withCalendar('chinese')` → `.year`/`.month`/`.monthCode`/`.monthsInYear`) throws `Unexpected leap month suffix: Mo8` on 0.5.1 and on `main`; on `main` + `16dff41` it returns `M08`, `8`, `12`. A leap-month row, `2025-08-01`, goes from `Unexpected leap month suffix: Mo6bis` to `M06L` / month 7 / 13. `dangi` behaves the same |

**Expected-value sources.** For #341, the issue's own statement and tc39/ecma402#1003: the Gregorian-derived
calendars are proleptic, so converting `1582-01-01` changes only the year. For #347, spec
`DifferenceZonedDateTime` (`zoneddatetime.html`) step 4 — when
`CompareISODate(startDateTime.[[ISODate]], endDateTime.[[ISODate]])` is 0 the result is
`CombineDateAndTimeDuration(ZeroDateDuration(), TimeDurationFromEpochNanosecondsDifference(ns2, ns1))`, a pure
time difference of −59 minutes with no day correction and so no mixed sign; `3c40368` is the port of
proposal-temporal `87af06d0`, which fixed tc39/proposal-temporal #3141, #3148 and #3149 (all closed there).
For #360, `Intl.DateTimeFormat('en-u-ca-chinese')` on the same ICU 78.3 formats `2026-09-18` as "Eighth Month"
and `2025-08-01` as "Sixth Monthbis 8, 2025(yi-si)", so `M08` and `M06L` are the codes ICU's own data implies.

**Wording to use when filing.**

| Item | Line                                                                                                                                                                     |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A    | `Closes #341` and `Closes #347`. Both are reported against 0.5.1, both are already fixed on `main`, so the release closes them.                                          |
| B    | None. No open issue in either repository describes this defect.                                                                                                          |
| C    | #361 already carries `Closes: #360` in its own description, so merging it closes #360; say "merging #361 also closes #360" in the port request rather than repeating it. |
| D    | None open. Cite the upstream pair instead: "Ports tc39/proposal-temporal#3205, which fixed tc39/proposal-temporal#3203 (both closed there)."                             |

**As filed (2026-09-19).** A: #373 names #341 and #347 but, being an issue, can't close them by keyword (see
"Filed"). B: #371 and tc39 #3328 carry no `Closes` line, as planned; they are now the reports of B in both
repositories. C: #368, #369 and #370 carry no `Closes` line; #369 mentions #360 only as fixed by #361, and the
merge-#361 request itself is unfiled. D: #367 cites "tc39/proposal-temporal#3205, which fixes
tc39/proposal-temporal#3203", as planned.

**Checked and unrelated, one line each.** #363 `Temporal.Now` property descriptor; #352 `ZonedDateTimeLike`
typing; #346 no enumerable own properties; #345 JSBI in `ZonedDateTime.compare` (the maintainer's script
already returns `-1` on 0.5.1 here); #344 Hermes/iOS `resolvedOptions().calendar` undefined; #276
error-message wording; #272 and #271 islamic/persian `inLeapYear` and `dayOfYear`, both already correct on
npm 0.5.1 (umalqura 1445 → `daysInYear` 354, `inLeapYear` false; 1445-01-01 → `dayOfYear` 1); #223 offset
zones in `toLocaleString`, an ECMA-402 gap; #209 far-off DST transition policy — a strategy-and-cost
question, and B's patch keeps the same search window and only probes the last partial one; #195 CLDR versus
IANA zone canonicalisation; #145 ISO week strings; #336, #335, #321 and #301 packaging and bundle size; the
remaining open issues are housekeeping, tooling and feature requests. None of these are in scope here.

## Duplicate search (read-only, 2026-09-15; re-checked 2026-09-18)

`gh search issues --include-prs` on both repositories. The 2026-09-18 pass instead listed **every** open
issue in js-temporal/temporal-polyfill (48) and read each candidate with `gh issue view`, comments included.
Corrections from that pass are marked **2026-09-18**.

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
| every open issue, listed and read (**2026-09-18**)                                         | 48 open. Only #341, #347 and #360 are affected by A–D; see "Upstream issues these fixes close"                               |

**2026-09-18 corrections to the two rows above.**

- **#341 confirmed by build.** `2bb6ba1^` reproduces the issue's row, `2bb6ba1` and `main` do not. It needs
  only the release, so it belongs to A's ask, not to a new patch.
- **#347 corrected.** Still different from D7, as the 2026-09-15 row says — but it is **already fixed on
  `main`**, by `3c40368` (port of proposal-temporal `87af06d0`, for the closed tc39/proposal-temporal #3141,
  #3148, #3149). It is therefore not an open defect this record has to fix; A's release closes it.

Related open items: PR #361 (ports D3, D5, D7 plus ICU 78 fixes for coptic and chinese/dangi; closes #360 —
**2026-09-18:** confirmed, #361's own description carries `Closes: #360`, and `main` + its `16dff41` fixes the
repro in #360); PR #357 (ethiopic era codes for CLDR 48); #209 (far-off DST transition look-ahead policy —
a strategy-and-cost question, unaffected by B).

**tc39/proposal-temporal**

| Query                            | Result                                                                                                                                                                                     |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GetNamedTimeZoneNextTransition` | #3110 (closed) "startOfDay bug for edge cases": two transitions within one 14-day window. Different defect, fixed by per-zone search windows (js-temporal `a79c6a1`). Not a duplicate of B |
| `next transition null maximum`   | none on 2026-09-15: B was unreported in both repositories. **Since filed** as tc39 #3328 and js-temporal #371 (2026-09-18)                                                                 |
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

**Closes:** `Closes #341` and `Closes #347`. Both are reported against 0.5.1, both already pass on `main`
(`2bb6ba1` and `3c40368` respectively), so the release closes them and no extra patch is needed. Evidence in
"Upstream issues these fixes close".

**Filed as:** js-temporal issue #373, 2026-09-19, "Release request: main has fixes that 0.5.1 doesn't
(ZonedDateTime near the Instant limits, #341, #347)". It gives three of the 13 limit rows, #341's buddhist row
and #347's Vancouver rows (0.5.1 against a production build of `c8f344c`), notes that 0.5.1 is 76 commits behind
`main`, and asks for no wait on #361 or #367–#372. As an issue it can't close #341 and #347 by keyword; it asks
for the release that lets the maintainer close them.

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
`e8cc03f`). File in proposal-temporal as well, or ask js-temporal to upstream it. **Filed in both** (see Ask).

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
- Not run here: the polyfill's own jest suite and test262 (see "Not verified"). **#371 states** jest 607 passed
  and the pinned test262 passes (intl402/Temporal 330 + 8 expected failures, built-ins/Temporal 4330).
- **Added by the filings** (#371, tc39 #3328; their own evidence, not re-run here): the miss is not limited to
  the last 19 days. From 00:00Z on each of the last 61 days, `next` in America/Santiago returns `null` on 39,
  the earliest `+275760-07-19`. Across nine zones × 61 days, `main` has 39 wrong rows (all Santiago) and the
  patch 0, against Chrome 153; `next`/`previous` from every day of 2020–2030 in the same zones (36,162 lookups)
  are byte-identical with and without the patch; the first transition after 1800 and `previous` from just after
  it are byte-identical in all 418 zones. Development builds throw `Error: Expected arg to be set.` instead of the
  TypeError. On tc39 `main` the same rows throw `TypeError: Cannot read properties of null (reading 'lesser')`
  (`'value'`, `'subtract'` for the `hoursInDay` rows); the tc39 diff uses `MathMin`.

### Ask

Bug report + PR with the diff above, in js-temporal/temporal-polyfill, and the equivalent
`ecmascript.mjs` change in tc39/proposal-temporal (same three lines).

**Closes:** nothing open. No issue in either repository described this defect before the filings below, which
are the first reports. (#209 is about the cost and strategy of the transition search, not about a missed
transition, and this patch keeps the same search window.)

**Filed as:** js-temporal PR #371 (2026-09-18), "Search the last partial window when looking for the next time
zone transition", with the diff above; and tc39/proposal-temporal issue #3328 (2026-09-18) with the same change
to `ecmascript.mjs`. Cross-linked both ways. No separate js-temporal issue: #371's description is the report.
Independent of #367–#370 and #361.

---

## C. Non-ISO calendars: port-and-release request

### Title

Port and release the non-ISO calendar fixes from proposal-temporal (D1, D3, D5, D7, D8), plus two new fixes
for `untilCalendar` near the limits and after a constrained leap month

### What is being asked, per defect

| Defect | What goes wrong                                                                                                                                                    | On js-temporal `main` `c8f344c` | Upstream source                                                          | Ask                                       | Verified                                    |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------- | ------------------------------------------------------------------------ | ----------------------------------------- | ------------------------------------------- |
| D1     | fields → ISO probes outside the legacy `Date` range near both limits (`Invalid ISO date`)                                                                          | broken                          | proposal `a41eb67` + `af0cb4b` (not on `main`, not in #361)              | port                                      | yes, but **not sufficient alone** (see D1b) |
| D1b    | `untilCalendar` month loop formats one month past the limit (hebrew, persian; islamic near the min)                                                                | broken                          | **none: also broken on proposal-temporal `main`**                        | new patch, file in both repos             | yes                                         |
| D2     | buddhist read through ICU's Julian/Gregorian hybrid before 1582-10-15                                                                                              | **fixed** (`2bb6ba1`)           | proposal `28fe786`                                                       | release                                   | yes (canary D2 2/2 on `main`)               |
| D3     | Hebrew `inLeapYear` wrong for negative years (`%` sign)                                                                                                            | broken                          | proposal `0df570c`; ported in open #361 as `86a89df`                     | merge #361 + release                      | yes                                         |
| D4     | ICU4C Hebrew one day off for years ≤ 0                                                                                                                             | environment (ICU 78.3)          | ICU `5267bb5778` (ICU-23007)                                             | none to the polyfill; Node/ICU note below | n/a                                         |
| D5     | stale "V8 bug 10529" detector (`Saka` vs `Śaka`) throws for every ISO year < 1                                                                                     | broken                          | proposal `314b112`; ported in #361 as `b6c9844`                          | merge #361 + release                      | yes                                         |
| D6     | `until` re-constrains the day while counting months                                                                                                                | **fixed** (`10aeb98`)           | proposal `1f6d6df`                                                       | release                                   | yes (canary D6 10/10 on `main`)             |
| D7     | `until` by years throws "mixed-sign" (proposal #3159)                                                                                                              | broken                          | proposal `0e32ee0`; ported in #361 as `79fb327`                          | merge #361 + release                      | yes                                         |
| D7b    | after the D7 port, `until` by years still compares the **constrained** intermediate day: `5784-M05L-30` → `5785-M06-29` gives `P1Y` (spec and Chromium: `P12M29D`) | broken                          | proposal `196a3191` (the `CompareSurpasses(…, calendarOne.day, …)` hunk) | port                                      | yes                                         |
| D8     | Meiji starts 1868; test262 requires `ce` before Meiji 6 (1873)                                                                                                     | partly fixed (`2bb6ba1` eras)   | proposal `977d11e0` + `993e6322`                                         | port                                      | yes                                         |

_Verification log:_

- **Per-port builds** (each port alone on `c8f344c`, GMT canary on the build; "unpatched" = `main`):

  | Defect | Port                                                                                                                                                 | Canary probe                                                        | `main`                                                                       | Port alone                                                | Other groups |
  | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------- | ------------ |
  | D3     | #361 `86a89df` (= proposal `0df570c`)                                                                                                                | `D3.-100000-01-01 hebrew` (`monthsInYear` 12)                       | STILL NEEDED (`Missing month converting …`)                                  | **REMOVABLE**                                             | unchanged    |
  | D5     | #361 `b6c9844` (= proposal `314b112`), `lib/calendar.ts` hunk only (its `expected-failures-cldr48.txt` hunk conflicts with `main` and is not needed) | `D5.-000500-06-15 indian` (`-578\|M03\|25`)                         | STILL NEEDED (`calendar 'indian' is broken for ISO dates before 0001-01-01`) | **REMOVABLE**                                             | unchanged    |
  | D7     | #361 `79fb327` (= proposal `0e32ee0`)                                                                                                                | `D7.mixedSign hebrew` (`P12M29D`)                                   | STILL NEEDED (`mixed-sign values not allowed`)                               | **REMOVABLE**                                             | unchanged    |
  | D1     | hand port of `a41eb67` + `af0cb4b` to TypeScript                                                                                                     | 27 `D1.*` probes; `repro-C-calendar-fields-near-limits.mjs` 21 rows | 19/27 fail; repro-C 12 FAIL                                                  | repro-C **21/21**; canary **5/27 still fail** (see below) | unchanged    |

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
- **2026-09-19, from tc39 #3327 and js-temporal #370 (the filings' own evidence, not re-run in this document's
  builds): proposal-temporal `main` is also wrong at ordinary dates, since `196a31919d` (tc39 #3245).** That
  commit turned the loop's copy into `next.day = calendarOne.day`, which writes the un-constrained day into the
  object `isoToCalendarDate()` stored in the calendar cache, so later lookups of that ISO date get the wrong day.
  Example: hebrew `2022-05-01` until `2022-03-31` by months gives `-P1M2D` (Chrome 153 `-P1M1D`); #3327 lists six
  such rows (hebrew, islamic-civil by years, chinese), none of which round-trip, and 12 wrong results in a grid
  of 126,720 `until()` calls (hebrew, islamic-civil, persian, chinese, coptic, indian; 2022–2025). This is newer
  than the reference check above, which ran only the limit repros against proposal `main` and the Chromium grid
  against js-temporal builds. It does not affect js-temporal `main`, which lacks `196a31919d`, or C-D7b, which
  ports only that commit's `CompareSurpasses` hunk. It does mean the **loop hunk of `196a31919d` must not be
  ported**; C-D1b replaces it (#370 says so), and per #3327 C-D1b on `e8cc03f` fixes both problems: every row
  expected, no wrong result in the grid, every call round-trips. #3327 says the repo's own test suite was not run
  on the change. It also flags a second `next.day = calendarOne.day` just before the loop (on the result of
  `addCalendar()`) that produced no wrong result in the grid.
- **2026-09-19, also from #370:** near the limits (every ISO day within 60 days, 240 `until()` calls per
  calendar per limit), #369 + #370 give 240/240 for hebrew, persian and islamic-civil at both limits, and with
  #361 as well every scanned calendar is 240/240 except chinese and dangi. At ordinary dates (10,200 calls, 15
  calendars) #370's output equals `main`'s except 18 coptic calls before the coptic epoch, which `main` got wrong
  and #370 answers with round-tripping values; with #361 underneath the output is identical with and without #370.
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
    the un-constrained day (30 > 29), so a year has not been reached. GMT's canary had no probe for this row
    when this was written; it now has one, `D7.leapMonthEnd` in `temporalCompat/repros.ts`.
- **Edge-window scans** (`repros/scan-edge-windows.mjs`: every ISO day within 400 days of each limit; read,
  fields → date with `monthCode` constrain/reject and ordinal `month` reject, ±1 month, ±1 year, `until(edge)` by
  months and years; hebrew, persian, islamic-civil/tbla/umalqura, indian, ethioaa, coptic, ethiopic, buddhist;
  72 000 operations each). Summaries in `results/scan-*.summary.txt`. Throws from ±1 month/year whose result is
  past the limit are required by the spec and are not listed.

  | Build                    | Non-required failures                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
  | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | `C-all` (D1+D3+D5+D7+D8) | hebrew and persian `until(edge)` throw at **every** sampled day at both limits (399 × 4 each); islamic-\* `until(edge)` near the min: 8 days each (`Input eraYear … doesn't match`); coptic near the min (below)                                                                                                                                                                                                                                                                                                  |
  | `C-all2` (+ C-D1b)       | **only coptic near the min**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
  | proposal-temporal `main` | hebrew and persian `until(edge)` at every sampled day at both limits; islamic-\* `until(edge)` at every sampled day near the min; indian `until(edge)` near the min (34 days, `Year … out of range`); coptic/ethioaa/ethiopic fields → date trip proposal's new assertion `calendarToIsoDate search should not overshoot a month entirely` at `+275760-04-20` and `-271820-01-26` (proposal #3292 assumed that block unreachable; since shown to be reachable far from the limits and filed as tc39 #3329, see F) |

  Coptic near the min (`C-all2`, unreachable in GMT, **root cause UNVERIFIED**): for ISO dates
  `-271820-01-27 … -271821-…` (400 sampled days), rebuilding a date from its own `{year, monthCode, day}` returns a
  date near `+272388`, and `until(edge)` throws "mixed-sign" for 29 days. It looks like the era-reversed coptic
  `year` (ICU 78 dropped `ERA0`, see #361's `023f6de`) but was not investigated. File separately if wanted. GMT computes `coptic` and `ethiopic` through `ethioaa` (`internal/calendarSystemIds.ts`
  `computationCalendarId`), so the polyfill never sees the id `coptic`, and GMT's own fields → ISO is a
  bisection (`internal/temporalCompat/fieldSearch.ts`), so neither this nor tc39 #3329 can reach GMT. **2026-09-19:** js-temporal #370 states that coptic dates before the coptic epoch
  don't round-trip from their own fields on `main` and that #361's coptic `ERA0` change fixes it; with #369,
  #361 and #370 its 60-day scan is 240/240 at both limits for every calendar but chinese and dangi. That
  supports the era guess above, but it is the filing's claim over 60 days, not a re-run of this 400-day scan.

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

  | Build                                    | Mismatches with Chromium 152                                                                                                                      |
  | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
  | npm 0.5.1 (earlier research)             | buddhist 20, hebrew 97, islamic-civil 24, islamic-tbla 24, islamic-umalqura 20, persian 10, indian 8, ethioaa 20, japanese 20, roc 20, gregory 20 |
  | `C-all`                                  | hebrew 1 (the C-D7b row)                                                                                                                          |
  | `C-all2` (+ C-D1b)                       | hebrew 1; grid output **byte-identical** to `C-all`, so C-D1b changes nothing at ordinary dates                                                   |
  | `final2` (A–D all patches, C-D1b, C-D7b) | **identical to native for all 11 calendars**                                                                                                      |

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
iso(
  Temporal.PlainDate.from(
    { calendar: "hebrew", year: 279517, month: 10, day: 11 },
    { overflow: "reject" },
  ),
); // +275760-09-13
iso(
  Temporal.PlainDate.from(
    { calendar: "islamic-civil", year: -280804, month: 3, day: 21 },
    { overflow: "reject" },
  ),
); // -271821-04-19
// D1 / D1b (Chromium 152/153)
Temporal.PlainDate.from("+275760-07-01")
  .withCalendar("persian")
  .until(Temporal.PlainDate.from("+275760-09-13").withCalendar("persian"), {
    largestUnit: "months",
  }); // P2M12D
Temporal.Duration.from("P40D").round({
  largestUnit: "months",
  relativeTo: Temporal.PlainDate.from({
    calendar: "hebrew",
    year: 279517,
    month: 8,
    day: 15,
  }),
}); // P1M10D
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
>    hunk of `196a3191` (diffs above). Only that hunk: the same commit's months-loop hunk corrupts the calendar
>    cache (tc39 #3327) and is replaced by C-D1b.
> 3. New bug + PR (also in tc39/proposal-temporal): non-ISO `until` by months/years throws `Invalid ISO date` for
>    hebrew and persian within a month of either limit, because `untilCalendar` materializes the month past the
>    target. Diff C-D1b above.
> 4. `2bb6ba1` (D2, eras) and `10aeb98` (D6) are on `main`: covered by the same release.

**Closes:** #360, via #361 — #361's own description already carries `Closes: #360`, so merging it closes the
issue; say "merging #361 also closes #360" in the port request rather than adding a second `Closes` line.
Verified: `main` still throws `Unexpected leap month suffix: Mo8` on #360's repro, `main` + `16dff41` returns
`M08`. `2bb6ba1` in point 4 is also what closes #341, but that is A's release line, not C's.

**Filed as** (all 2026-09-18):

- **D1** → js-temporal PR #369, "Polyfill: Fix extreme PlainYearMonth crash in non-ISO calendars", ports
  `a41eb67` + `af0cb4b` as two commits. Per #369, the test262 `extreme-dates.js` rows (112, run by hand at the
  test262 commit tc39 used for `af0cb4b`) fail 59 on `main`, 42 with #369, 8 with #369 + #361 (only chinese/dangi
  far from the present).
- **D8** → js-temporal PR #368, "Polyfill: Update Meiji era start date", ports `977d11e` + `993e632` as two
  commits (the first moves Meiji from 1868-09-08 to 1868-10-23, the second adds `startingYear`). Per #368, of 125
  `intl402/Temporal/**/*japanese*.js` tests, `main` fails 18, #368 13, #368 + #361 0.
- **D1b** → js-temporal PR #370, "Don't format dates past the range limit when counting months in until()"
  (depends on #369), and tc39/proposal-temporal issue #3327 with the same change, which also reports the
  `196a31919d` regression above. Cross-linked both ways.
- **D3, D5, D7:** not filed separately; they are in the maintainer's own PR #361.
- **Not filed:** C-D7b, and point 1's request to merge #361 (see "Still unfiled").

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

**Closes:** nothing open in js-temporal. Cite the upstream pair instead — "Ports
tc39/proposal-temporal#3205, which fixed tc39/proposal-temporal#3203" — both of which are already closed
there.

**Filed as:** js-temporal PR #367 (2026-09-18), "Polyfill: Validate result in UTC fast path in
GetPossibleEpochNanoseconds", the same three lines as tc39 `d90d432`. Beyond this section's evidence it states:
tc39 #3203's own case, `new Temporal.Duration(0).total({ unit: 'days', relativeTo:
'+275760-09-12T23:59:60+00:00[UTC]' })`, returns `0` on `main` and throws with the PR; jest 607 passed; the
pinned test262 passes in default and `NODE_ENV=production` builds (4828 passed); and test262
`Duration/prototype/total/relativeto-date-limits.js`, run by hand at tc39/test262@416f2a3de8 (newer than the
pin), fails on `main` and passes with the PR, while its `round` sibling passes on both.

---

## E. Transition search starts in 1847, after the first TZDB transition (1844-12-31)

Found and filed after the rest of this document was verified. Everything below is taken from the filings'
own text; none of it was re-run in this document's builds.

### Title

Start the time zone transition search before the first transition in 1844

### What goes wrong

`GetNamedTimeZoneNextTransition` jumps forward to `BEFORE_FIRST_DST` (1847-01-01T00:00:00Z) and
`GetNamedTimeZonePreviousTransition` stops there, on the assumption (per #372, from js-temporal `e70d632`) that
1847 is the year of the first TZDB transition. It no longer is. Five zones cross the date line on 1844-12-31 and
skip that local day: Asia/Manila (`-15:56` → `+08:04`), Pacific/Guam and Pacific/Saipan (`-14:21` → `+09:39`),
Pacific/Kosrae (`-13:08` → `+10:52`) and Pacific/Palau (`-15:02` → `+08:58`). The offsets are right, because they
come from `Intl.DateTimeFormat`; only the transition search misses the change. Because local 1844-12-31 doesn't
exist, `GetStartOfDay` searches for the next transition after the day before, jumps to 1847, and returns
Manila's 1899 transition (Guam, Saipan, Kosrae and Palau: their 1901 one). Same code in js-temporal
`lib/ecmascript.ts` and tc39 `polyfill/lib/ecmascript.mjs` l.143 at `e8cc03f`; development builds give the same
results.

### Repro (from #372 and tc39 #3330; `main` = production build of js-temporal `main`, and tc39 `main` alike)

| Call                                                                                                                       | `main`                                     | Expected                                 |
| -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | ---------------------------------------- |
| `Temporal.Instant.from('1800-01-01T00:00:00Z').toZonedDateTimeISO('Asia/Manila').getTimeZoneTransition('next')`            | `1899-09-06T12:00:00+08:00[Asia/Manila]`   | `1845-01-01T00:00:00+08:04[Asia/Manila]` |
| `Temporal.Instant.from('1846-06-01T00:00:00Z').toZonedDateTimeISO('Asia/Manila').getTimeZoneTransition('previous')`        | `null`                                     | `1845-01-01T00:00:00+08:04[Asia/Manila]` |
| `Temporal.PlainDate.from('1844-12-31').toZonedDateTime('Asia/Manila')`                                                     | `1899-09-06T12:00:00+08:00[Asia/Manila]`   | `1845-01-01T00:00:00+08:04[Asia/Manila]` |
| `Temporal.ZonedDateTime.from('1844-12-30T12:00[Asia/Manila]').hoursInDay`                                                  | `479340.06444444443`                       | `24`                                     |
| `Temporal.ZonedDateTime.from('1844-12-30T12:00[Asia/Manila]').round({ smallestUnit: 'day' })`                              | `1844-12-30T00:00:00-15:56[Asia/Manila]`   | `1845-01-01T00:00:00+08:04[Asia/Manila]` |
| control: `Temporal.Instant.from('1800-01-01T00:00:00Z').toZonedDateTimeISO('Europe/London').getTimeZoneTransition('next')` | `1847-12-01T00:01:15+00:00[Europe/London]` | same                                     |

**Expected-value sources** (as the filings give them). Chrome 153 native Temporal. The tzdb `asia` file cites
the governor-general's proclamation of 1844-08-16 that 1844-12-30 be followed by 1845-01-01; `australasia` says
the other islands "kept American time until the Philippines switched at the end of 1844". In Chrome 153,
`previous` from 1844-12-31T00:00Z is `null` in all 418 zones of `Intl.supportedValuesOf('timeZone')`, so these
are the earliest transitions today.

### Patch (js-temporal, from `gh pr diff 372`)

```diff
--- a/lib/ecmascript.ts
+++ b/lib/ecmascript.ts
@@ -81,7 +81,9 @@ const DATETIME_NS_MAX = JSBI.subtract(JSBI.add(NS_MAX, DAY_NANOS_JSBI), ONE);
 const MS_IN_400_YEAR_CYCLE = (400 * 365 + 97) * DAY_MS;
 const YEAR_MIN = -271821;
 const YEAR_MAX = 275760;
-const BEFORE_FIRST_DST = Date.UTC(1847, 0, 1); // 1847-01-01T00:00:00Z
+// The first transition in the TZDB is on 1844-12-31, when Asia/Manila and some
+// Pacific zones moved across the date line.
+const BEFORE_FIRST_DST = Date.UTC(1844, 0, 1); // 1844-01-01T00:00:00Z
```

tc39 #3330 proposes the same line with `DateUTC`. 1844-01-01 is almost a year before the first transition, as
1847-01-01 was before Europe/London's on 1847-12-01, so the early `return null` in the previous-transition
search still can't cut off a 19-day window.

### Verification (stated in the filings, not re-run here)

- #372, against Chrome 153: 157 rows around the five zones (`next` from 1800, `previous` from 1846, 1848, 1900
  and 1 ns after the transition; `toZonedDateTime`, `hoursInDay`, `startOfDay` on 1844-12-29 … 1845-01-02; the
  skipped day with each `disambiguation`; `add`/`subtract`/`round`/`until` across it; London and New York
  controls; 2026 lookups): `main` 36 wrong, PR 0. All 418 zones, four lookups each (1,672 rows): `main` 20 wrong,
  all in the five zones; PR 0. Rows outside the five zones and `next`/`previous` from the first of every month of
  2020–2030 in 24 zones (6,336 lookups) are byte-identical. With #371 as well, all 1,829 rows match.
- #372: jest 607 passed, eslint/prettier/`tscheck` clean, pinned test262 passes. No jest test added: the
  expected values depend on the runtime ICU's tz data, and older data lacks the 1844 transitions.
- Cost: Antarctica/Troll (first transition 2005) is the worst case. #372 measures `previous` from just before it
  at 4.2–4.3 ms before and after; #3330 measures 4.86 ms → 4.95 ms on tc39 `main`.
- tc39 #3330: same change on `e8cc03f`, all 1,829 rows match Chrome 153; on `main` 56 are wrong.
- Not fixed by either: the constant is still a hard-coded assumption about the TZDB, so an earlier transition
  added later would be missed the same way.

### GMT impact and workaround (`zoned.E`, verified against Chrome 153)

Before the workaround, GMT on polyfill 0.5.1 was wrong wherever it relied on the polyfill's transition search or
`GetStartOfDay` in these five zones: `getDstTransitions(zone, 1845)` was `[]`; `startOfZoned`/`endOfZoned`,
`floorToZone` and `areZonedEqualBy` by week were a day off across the crossing; `getHoursInZonedDay` for
1844-12-30 was 479,340.06; `roundZoned`/`roundUnix` by day rounded 1844-12-30 noon down instead of up to the
crossing; `intervalCountZoned` over 1844-12-01 … 1845-02-01 counted the skipped day (62, not 61) and
`intervalOverlappingDaysZoned` counted it too; `addZonedBusinessDays` landing on the skipped Tuesday jumped to
1899. GMT's own day boundaries elsewhere (`addZoned`, `mapZonedHoursInDay`, day buckets) were already right.

The workaround is `internal/zonedWallClock.ts` defect 3. It runs only for a named zone and an instant before
1847-01-01 (or a local date on or before it), so every later receiver pays one bigint comparison and no `Intl`
read. There it compares the offset at the receiver with the offset at the floor (for `previous`, at the
minimum instant) and, when they differ, bisects with the existing `transitionBetween` — the offsets are right,
only the polyfill's search is floored. Start of day, `hoursInDay`, `round` by day and a `PlainDate`'s
`toZonedDateTime` before the floor use GMT's own `GetStartOfDay` (`startOfDayEpochNanoseconds`). It rests on one
assumption, pinned over every zone in `internal/zonedWallClock.test.ts`: no zone changes offset between the
minimum instant and 1844-01-01, and exactly these five change between 1844 and 1847, once each. Canary: the
`zoned.E` group in `internal/temporalCompat/repros.ts` (5 probes, all STILL NEEDED on 0.5.1). **Remove when** a
js-temporal release containing #372 is GMT's dependency floor; the removal steps are in `pnpm compat`, and no
expected value changes.

**Filed as:** js-temporal PR #372 and tc39/proposal-temporal issue #3330, both 2026-09-19, cross-linked.
Independent of #367–#371 and #361. **Closes:** nothing open.

---

## F. `calendarToIsoDate` overshoot assertion from tc39 #3292 is reachable (tc39 only)

Found and filed after the rest of this document was verified. Facts from tc39 #3329 only; nothing below was
re-run in this document's builds.

### What goes wrong

tc39 #3292 (`17d7ff1f94`) replaced the overshoot handling in `calendarToIsoDate()`'s search loop with the
assertion "calendarToIsoDate search should not overshoot a month entirely", on the grounds that it seemed
unreachable. Month 13 of coptic, ethiopic and ethioaa (5 or 6 days) can be skipped entirely by the search's 8-day
step. C's edge-window scan above already hit this assertion on proposal-temporal `main` at `+275760-04-20` and
`-271820-01-26`; #3329 shows it is reachable far from the limits too, in most far-off years.

**Not in js-temporal and not in GMT's runtime.** js-temporal has not ported #3292 (#3329 says so). Whoever ports
that commit to js-temporal should take the fix with it.

**Can't reach GMT, and pinned so it stays that way (2026-09-19).** GMT computes `coptic` and `ethiopic` through
`ethioaa` (`internal/calendarSystemIds.ts` `computationCalendarId`), and its fields → ISO is a bisection over epoch
days (`internal/temporalCompat/fieldSearch.ts`), which can't skip a short month; the polyfill's answer is kept
only when its fields read back unchanged (`calendarDateFromFields.ts`). Chromium 153 matches GMT on every far-year
month-13 row: `ethioaa` `{ year: 18196, month: 13, day: 1 }` is `+012704-11-26` and `{ year: 18196, month: 12,
day: 30 }` is `+012704-11-25`. Those two rows are the `D10` canary group in `repros.ts` / `pnpm compat`: it passes
on 0.5.1 (no #3292) and fails only on a js-temporal release that ports #3292 without this fix, which then routes
every ethioaa fields → ISO through the bisection and add/until through the spec algorithms. Independently, any
polyfill throw other than a `RangeError` (such as this assertion) now takes GMT's own path instead of becoming
the public sentinel.

### Repro (from #3329; `Temporal.PlainDate.from(…)` on tc39 `main`)

| Fields                                                                                 | tc39 `main`       | Expected        |
| -------------------------------------------------------------------------------------- | ----------------- | --------------- |
| `{ calendar: 'coptic', year: 12420, month: 13, day: 1 }`                               | assertion failure | `+012704-11-26` |
| `{ calendar: 'coptic', year: -35585, month: 13, day: 6 }`                              | assertion failure | `-035302-12-05` |
| `{ calendar: 'coptic', year: 50000, month: 13, day: 1 }`                               | assertion failure | `+050285-09-03` |
| `{ calendar: 'ethiopic', year: 12696, month: 13, day: 1 }`                             | assertion failure | `+012704-11-26` |
| `{ calendar: 'ethioaa', year: 18196, month: 13, day: 1 }`                              | assertion failure | `+012704-11-26` |
| `{ calendar: 'coptic', year: 275470, month: 13, day: 1 }` (fields of `+275760-04-20`)  | assertion failure | `+275760-04-20` |
| `{ calendar: 'coptic', year: -272099, month: 13, day: 5 }` (fields of `-271820-01-26`) | assertion failure | `-271820-01-26` |

**Expected-value sources** (as the filing gives them): Chrome 153 native Temporal, and the rule that each result
is the day after month 12, day 30 of the same year, plus `day` days. Scale: every coptic year from -272090 to
275470, month 13 days 1–6 (3,285,360 calls), 489,845 hit the assertion; the failing years nearest 0 are 12420
and -35585; 1800–2200 is clean. With #3292 reverted, all 3,285,360 pass the check.

### Proposed fix (tc39 #3329)

Search in 5-day steps instead of 8 (`const increment = 5;` in `polyfill/lib/calendar.mjs` near l.1025 at
`e8cc03f`, with a comment). No month in any supported calendar is shorter than 5 days, so a step can't skip the
target month.

### Verification (stated in the filing, not re-run here)

- On `e8cc03f` with the change: all 3,285,360 month-13 calls give the expected date and all table rows match
  Chrome 153. Round-tripping coptic, ethiopic and ethioaa fields holds for every ISO day in 1800–2200,
  −5000..−4000, +100000..+100400, the last 760 years before the maximum and the first 820 after the minimum
  (7.4M calls).
- Side effects, 15 non-ISO calendars × 1,662,015 rows (from fields, `with({ day: 1 })`, `add({ months: 1 })`):
  984 rows change from an assertion to a value; 96 chinese/dangi rows within ~100 years of a limit change, all
  already wrong against Chrome in both versions; everything else identical.
- The filing does not say whether proposal-temporal's own tests or test262 were run with the change.

**Filed as:** tc39/proposal-temporal issue #3329, 2026-09-18. No js-temporal counterpart (not affected).
**Closes:** nothing open. GMT workaround it retires: none (the `D10` group is a regression guard, not a
workaround 0.5.1 needs).

---

## G. CLDR calendar-alias asymmetry: `ethiopic-amete-alem` is accepted, `gregorian` is not (ICU note, not a polyfill defect)

**Status: no ask. GMT matches both engines exactly; recorded so nobody "fixes" it.** Reviewed 2026-09-20
(baldurpan, CORE-8). Owner decision: `gregorian` stays rejected and `ethiopic-amete-alem` stays accepted.

CLDR `bcp47/calendar.xml` gives four calendar types an `alias` attribute naming their legacy Unicode name:
`gregory`/`gregorian`, `roc`/`taiwan`, `islamic-tbla`/`islamic-tabular`, `ethioaa`/`ethiopic-amete-alem`.
Only the last of the four is usable as a Temporal calendar id. That is not GMT's choice and not the
polyfill's: Chromium 153 (ICU4X) and `@js-temporal/polyfill` 0.5.1 agree row for row, and GMT agrees with
both.

`Temporal.PlainDate.from("2024-10-03").withCalendar(id).toString()`, and
`new Intl.DateTimeFormat("en-US", { calendar: id }).resolvedOptions().calendar`:

| `id` | Chromium 153 Temporal | polyfill 0.5.1 | GMT `convertDateToCalendar` | Chromium `Intl` |
| --- | --- | --- | --- | --- |
| `gregorian` | `RangeError` | `RangeError` | `""` | `RangeError` |
| `gregory` | `[u-ca=gregory]` | `[u-ca=gregory]` | `[u-ca=gregory]` | `gregory` |
| `ethiopic-amete-alem` | `[u-ca=ethioaa]` | `[u-ca=ethioaa]` | `[u-ca=ethioaa]` | `ethioaa` |
| `ethioaa` | `[u-ca=ethioaa]` | `[u-ca=ethioaa]` | `[u-ca=ethioaa]` | `ethioaa` |
| `islamic-tabular` | `RangeError` | `RangeError` | `""` | `gregory` |
| `islamic-tbla` | `[u-ca=islamic-tbla]` | `[u-ca=islamic-tbla]` | `[u-ca=islamic-tbla]` | `islamic-tbla` |
| `taiwan` | `RangeError` | `RangeError` | `""` | `gregory` |
| `roc` | `[u-ca=roc]` | `[u-ca=roc]` | `[u-ca=roc]` | `roc` |

Two separate mechanisms produce the three rejections, which is why they are not one bug:

- **`gregorian` is structurally invalid.** A Unicode locale extension `type` subtag is 3–8 alphanumerics
  (UTS 35). `gregorian` is nine letters, so it fails the syntax check before any calendar lookup — which is
  why `Intl` throws for it too, while it merely falls back for the other two.
- **`islamic-tabular` and `taiwan` are structurally valid but not available calendars.** ECMA-402's
  `AvailableCanonicalCalendars` is ICU's list; ICU canonicalizes `ethiopic-amete-alem` to `ethioaa` but does
  not canonicalize these two, so Temporal's `CanonicalizeCalendar` throws while `Intl.DateTimeFormat`'s
  option path silently falls back to `gregory`.

**Why GMT does not paper over it.** GMT's calendar ids are exactly the ids Temporal accepts (Core Rule: the
public string contract is Temporal's). Accepting `gregorian` would mean GMT's accepted set is wider than
Temporal's, so a string GMT validated would throw the moment it reached `Temporal` — including the `Temporal`
GMT itself re-exports. The `Intl` fallback is worse than the throw: `{ calendar: "taiwan" }` formatting as
Gregorian is a silently wrong date, not an error. GMT surfaces both as its `""`/`null` sentinel.

**Documented at:** `convertDateToCalendar`, `convertZonedToCalendar`, `isValidCalendarDate` and
`isValidCalendarZonedDateTime` JSDoc, and `context/domination/research/calendar-standards-decisions.md`.

**Trigger to revisit:** an ICU release that adds `islamic-tabular`/`taiwan` to the canonicalization table, or
a TC39 amendment to `CanonicalizeCalendar`. Neither is filed; neither is being asked for.


## H. The calendar nudge window is never retried (`total`, `round`, `until`)

**Status: not filed yet — one filing, to js-temporal only.** Found 2026-09-20 while closing a coverage
gap baldurpan raised in the CORE-8 review (`intervalLength*` in calendar units had only ever been
compared against the same `until`/`total` primitives the implementation calls).

### Already fixed upstream in tc39 — do not file there

This is **tc39/proposal-temporal [#3168](https://github.com/tc39/proposal-temporal/issues/3168)**
("Assertion failure in year-and-a-bit durations relative to leap day", closed), fixed by
**[#3172](https://github.com/tc39/proposal-temporal/pull/3172)** (Normative, commit `5dd0b0d97ee1`,
merged 2025-11-19). ptomato's diagnosis there is exactly ours: "_destEpochNs_ (2021-02-28T01:00Z) >
_endEpochNs_ (2021-02-28T00:00Z) … _r1_ and _r2_ should be 1 and 2 instead of 0 and 1."

`@js-temporal/polyfill` has **not** ported it — not in 0.5.1, and not on `main`, where
`lib/ecmascript.ts`'s `NudgeToCalendarUnit` still computes `r1`/`r2` once. No js-temporal issue
mentions it. **The ask is therefore a port-and-release request**, the same shape as item C.

### The defect

TC39 bounds the duration between `relativeTo + r1 units` and `relativeTo + r2 units`, where `r1` is
the duration's own count of that unit, then checks that the target falls inside the window. When it
does not, `ComputeNudgeWindow` runs again with `additionalShift = true`, so `r1` becomes 1 rather
than 0 (spec/duration.html, `NudgeToCalendarUnit` steps 2–9). The polyfill computes the window once;
its `assert(start <= dest <= end)` is compiled out of production builds, so `progress` silently
exceeds 1 and the answer comes from bounds that exclude the target.

Reachable only when the duration's own month count is one short of the truth, which is exactly when
adding a month constrains the day — a `relativeTo` on the 29th, 30th or 31st.

### Repro

```js
const from = Temporal.PlainDateTime.from("2024-01-31T00:00:00");
const to = Temporal.PlainDateTime.from("2024-02-29T12:00:00");

from.until(to, { largestUnit: "month" }).toString();
// "P29DT12H" — both engines agree, so r1 = 0 months

from.until(to, { largestUnit: "month" }).total({ unit: "month", relativeTo: from });
// polyfill 0.5.1: 1.0172413793103448   Chromium 153: 1.0161290322580645

from.until(to, { largestUnit: "month", smallestUnit: "month", roundingMode: "trunc" }).toString();
// polyfill 0.5.1: "PT0S"               Chromium 153: "P1M"     <- a whole month

Temporal.Duration.from("P29DT12H")
  .round({ smallestUnit: "month", roundingMode: "floor", relativeTo: Temporal.PlainDate.from("2024-01-31") })
  .toString();
// polyfill 0.5.1: "PT0S"               Chromium 153: "P1M"
```

Note that #3168's own reproducer (`new Temporal.Duration(1, 0, 0, 0, 1)` relative to `2020-02-29`,
unit `years`) **passes** on js-temporal 0.5.1 — there `r1` is already 1 from the duration's own years,
so no retry is needed. The month reproducers above are the ones to file.

### Scope, as scanned (Chromium 153.0.8010.12 vs `@js-temporal/polyfill` 0.5.1)

| Operation | Rows | Mismatches |
| --- | --- | --- |
| `Duration#total` | 2,016 | 16 |
| `Duration#round` | 12,960 | 15 |
| `until` / `since` with a calendar `smallestUnit` | 9,940 | 15 |
| `Duration.compare` | 256 | **0** — reaches no nudge window |

Every mismatch is `unit: "month"`. `round` and `until` diverge only in the directed rounding modes
(`ceil`, `floor`, `trunc`); the half modes agree either way. `until` without rounding agrees on all
rows, so only the rounded forms are affected.

### Ask

Bug report + **port** request against `js-temporal/temporal-polyfill`: port proposal-temporal
`5dd0b0d97ee1` (#3172) and release. Because `main` is affected too, it cannot ride the existing
release request #373. **No tc39 filing** — already fixed there.

### GMT

Fixed as compat defect **D11** (`packages/gmt/src/internal/temporalCompat/README.md`). GMT already
owned a spec-current `computeNudgeWindow` with `additionalShift`, so the fix routes the three
operations to it when the probe fails and the `relativeTo` is past the 28th:
`monthTotalBySpec` and `monthRoundBySpec` in `durationTotal`/`durationRound`, a defect-4 gate in
`zonedUntil` (which covers `diffUtc`, `diffUnix` and `diffZoned`), the new `plainUntilWithRounding`
(for `diffDateTime`), and a D11 term in `internal/plainDateUntil.ts` (for `diffDate`). After the fix
all three scans match Chromium exactly. Probe-gated, retires by canary.

**A second defect, in GMT's own mirror, found by the same scan.** When the target lands exactly on
the window's lower bound the duration is already rounded, which TC39 handles inside
`ApplyUnsignedRoundingMode` ("if x is equal to r1, return r1"). GMT's form takes a comparison rather
than the value, so `ceil` expanded an exact boundary to the next whole unit — `P60D` from
`2024-01-31` gave `P3M` where Chromium gives `P2M`. It was live for the non-ISO calendars before this
change, since they already took this path. Fixed by the `progress === 0n` branch in
`nudgeToCalendarUnit`; it is GMT's bug, not the polyfill's, and stays when D11 retires.

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
   would ship that bug. Add a probe for this row and require the `196a3191` hunk (C-D7b). **Since done** for
   the probe: `D7.leapMonthEnd` in `temporalCompat/repros.ts`. C-D7b itself is still unfiled.
4. **D8 trigger is insufficient.** `2bb6ba1` fixes `1800-01-01` and `0000-12-31` but `1872-12-31` stays
   `meiji|5`; it also needs `977d11e0` + `993e6322`.
5. **D3 is ported in open PR #361** (not "not on js-temporal main" in the sense of unavailable): merging #361
   delivers D3, D5 and D7.

**Corrections from the filings (2026-09-19):**

- "B is unreported in both repositories" (duplicate search, 2026-09-15) no longer holds: B is js-temporal #371
  and tc39 #3328.
- The reference check against proposal-temporal `main` found only the limit failures of the months loop. tc39
  #3327 shows the same loop has also been wrong at ordinary dates since `196a31919d` (tc39 #3245), which is why
  C-D7b must port only that commit's `CompareSurpasses` hunk (C's log and Ask).
- The assertion C's scan hit on proposal-temporal `main` near the limits is reachable far from them too (F, tc39
  #3329).
- Two defects this document did not have are now recorded: E (transition search before 1847) and F.
- "Run `npm test` and `npm run test262` before opening the PRs": the six js-temporal PRs state they did (see
  "Not verified").

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
  **2026-09-19:** each js-temporal PR (#367–#372) states jest 607 passed and the pinned test262 passes on Node
  24.21.0 (ICU 78.3). That is the filings' claim; it was not re-run for this document. The tc39 issues state no
  test-suite run: #3327 says the repo's own suite was not run, and #3328, #3329 and #3330 don't say.
- Coptic near the minimum (wrong `from`-fields result, "mixed-sign" `until`) on the fully patched build:
  root cause **UNVERIFIED**. GMT computes `coptic` and `ethiopic` through `ethioaa`
  (`internal/calendarSystemIds.ts`), and its fields → ISO is a bisection (`internal/temporalCompat/fieldSearch.ts`),
  so this and tc39 #3329 can't reach GMT. js-temporal #370 states #361's coptic `ERA0` change
  fixes it (see C); not re-run here.
- E and F, and every figure in the "Filed as" notes that goes beyond this document's own verification
  (the 61-day and 418-zone transition scans, the 60-day until scan, the 126,720-call grid, the month-13 sweep,
  the test262 by-hand runs), come from the filings' text and were not re-run in this document's builds.
- E's effect on GMT: not checked (GMT has no canary probe or workaround for it).
- The final GMT canary runs (`final2`, `main` re-run) used a scratchpad loader hook that also resolves
  extensionless relative imports, because `packages/gmt/dist` was rebuilt at 10:09:54 without `tsc-alias` by a
  process outside this verification (this work only built the polyfill clone). Earlier canary runs used the
  intact dist and agree with the re-runs.
- Scratchpad artefacts (clones, builds, patches, repros, results, logs):
  `/private/tmp/claude-501/-Users-craigcurtis-workbench-northguild-gmt-worktrees-feature-187-core-6-interval-algebra-intersect-clamp-subtract-merge-split-sum-implementation/bdd796f6-e636-477b-bca7-b7182a6ed50b/scratchpad/polyfill-verify/`.
