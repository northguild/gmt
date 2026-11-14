/**
 * The workaround groups GMT keeps for `@js-temporal/polyfill` and runtime-ICU defects: each one's
 * removal trigger and removal steps (temporalCompat README). `scripts/temporal-compat.mjs` prints
 * and snapshots them on Node; `scripts/lib/native-suite-compat.mjs` judges them in each browser of
 * the native suite. Both read this one list, so no engine can disagree about what a group is.
 *
 * A group with `engines` is a defect only those engines show; its probes passing anywhere else
 * proves nothing (see `workaroundState`). The ids are the ones in `ENGINE_IDS`, one per JavaScript
 * engine, so the same group reads the same on Node and on Chromium, which both run V8.
 *
 * Node built-ins only, no command on import, so a test can import it.
 */
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const GMT_DIR = join(ROOT, "packages/gmt");
export const COMPAT_README =
  "packages/gmt/src/internal/temporalCompat/README.md";

/** The step the last of D1–D7 to go adds: defect 3 shares its spec path with defects 4 and 5. */
const LAST_OF_D1_D7 = `The last of D1–D7 to go also follows ${COMPAT_README} § Removal steps 6. If D11 and D22 (defects 4 and 5) are gone too, the last of defects 3–5 to go also deletes untilTakesSpecPath, the // defects 3–5 block in zonedUntil that calls untilAtLimit, and the bySpec blocks in durationTotal and durationRound. Then drop the imports and locals tsc reports unused, and the internal/zonedDifference/operations.ts exports fallow reports unused.`;

/**
 * The JavaScript engine each native-suite leg runs on, as a group's `engines` names it. Node and
 * Chromium are both V8: a defect in V8 or in the ICU it bundles reads the same on both. WebKit
 * runs on two hosts (Playwright's build on Linux, and on macOS the ICU and time zone data Apple
 * ships), so it has two legs of one engine. The keys are the native-suite legs, in leg order: the
 * one list every canary script derives its legs from.
 * @type {Readonly<Record<"node" | "chromium" | "firefox" | "webkit" | "webkit-macos",
 *   "v8" | "firefox" | "webkit">>}
 */
export const ENGINE_IDS = Object.freeze({
  node: "v8",
  chromium: "v8",
  firefox: "firefox",
  webkit: "webkit",
  "webkit-macos": "webkit",
});

export const WORKAROUNDS = [
  {
    defects: ["D1"],
    title:
      "D1 — calendar fields → ISO, add, until and Duration relativeTo near the limits (temporalCompat)",
    trigger:
      "a js-temporal release ports proposal-temporal a41eb67 (+ af0cb4b) and becomes GMT's @js-temporal/polyfill floor (upstream-issue draft C)",
    steps: [
      "Delete the D1 entries in probeRepros.ts, the D1 term of needsFieldSearch in calendarDateFromFields.ts, and the D1 fallbacks in calendarDateArithmetic.ts (the catch branch of calendarDateAdd, the D1 term of untilWorkaroundNeeded).",
      "Delete fieldSearch.ts + test once no range guard (D2–D5) is left.",
      LAST_OF_D1_D7,
      `Full wording: ${COMPAT_README} § Removal steps 1.`,
    ],
  },
  {
    defects: ["D2"],
    title: "D2 — buddhist read through ICU4C's Julian/Gregorian hybrid",
    trigger: "a js-temporal release contains 2bb6ba1 (already on main)",
    steps: [
      "Delete buddhistFields' arithmetic branch, the buddhist case of hasReadCorrection, usesIsoArithmetic in calendarDateArithmetic.ts, and the D2 repros.",
      LAST_OF_D1_D7,
      `Full wording: ${COMPAT_README} § Removal steps 2.`,
    ],
  },
  {
    defects: ["D3", "D4"],
    title:
      "D3 + D4 — Hebrew years <= 0 (polyfill leap-year %, ICU4C one day off)",
    trigger:
      "BOTH a js-temporal release ports proposal-temporal 0df570c AND GMT's engines.node floor bundles an ICU containing 5267bb5778 (ICU-23007)",
    steps: [
      "Delete hebrewArithmetic.ts + test, hebrewFields' arithmetic branch, the hebrew case of hasReadCorrection and ownedModels, and the D3/D4 repros.",
      LAST_OF_D1_D7,
      `Full wording: ${COMPAT_README} § Removal steps 3.`,
    ],
  },
  {
    defects: ["D5"],
    title: "D5 — Indian before ISO year 1 (stale V8 bug 10529 detector)",
    trigger: "a js-temporal release ports proposal-temporal 314b112",
    steps: [
      "Delete indianArithmetic.ts + test, indianFields' arithmetic branch, the indian case of hasReadCorrection and ownedModels, and the D5 repros; fixedDay.ts once unused.",
      LAST_OF_D1_D7,
      `Full wording: ${COMPAT_README} § Removal steps 4.`,
    ],
  },
  {
    defects: ["D6"],
    title: "D6 — non-ISO until re-constrains the day while counting months",
    trigger:
      "a js-temporal release contains 10aeb98 (already on main) and no longer writes the un-constrained day into its calendar cache (tc39/proposal-temporal#3327 problem 1, on main since 853fc8b)",
    steps: [
      "Delete the D6 repros and the D6 terms in calendarDateArithmetic.ts.",
      LAST_OF_D1_D7,
      `Full wording: ${COMPAT_README} § Removal steps 5.`,
    ],
  },
  {
    defects: ["D7"],
    title:
      "D7 — Hebrew until by years throws mixed-sign (tc39/proposal-temporal#3159)",
    trigger: "a js-temporal release ports proposal-temporal 0e32ee0",
    steps: [
      "Delete the D7 repro and the D7 terms in calendarDateArithmetic.ts.",
      LAST_OF_D1_D7,
      `Full wording: ${COMPAT_README} § Removal steps 5.`,
    ],
  },
  {
    defects: ["D8"],
    title: "D8 — japanese pre-proposal era codes",
    trigger: "a js-temporal release contains 2bb6ba1",
    steps: [
      "Delete japaneseFields' remap, PRE_PROPOSAL_ERAS, and the D8 repros.",
      `Full wording: ${COMPAT_README} § Removal steps 7.`,
    ],
  },
  {
    defects: ["D10"],
    title:
      "D10 — fields → ISO skips a 5–6-day month 13 in far years (tc39/proposal-temporal#3329; ethioaa, so coptic and ethiopic)",
    trigger:
      "js-temporal ports tc39 #3292 together with the #3329 fix (0.5.1 predates #3292, so this group passes today: it guards against a port of #3292 alone)",
    steps: [
      "Delete the D10 repros in probeRepros.ts, the D10 term of needsFieldSearch in calendarDateFromFields.ts, the D10 terms in calendarDateArithmetic.ts (the catch branch of calendarDateAdd, untilWorkaroundNeeded) and D10 in ARITHMETIC_DEFECTS (capabilities.ts).",
      "Keep the non-RangeError fallbacks and the far-year month-13 rows in addDate, intervalCountDate and convertDateToCalendar tests: no expected value changes.",
      `Full wording: ${COMPAT_README} § Removal steps 10.`,
    ],
    guard: {
      package: "@js-temporal/polyfill",
      through: "0.5.1",
      reason:
        "Polyfill 0.5.1 is older than the change that exposes this bug (tc39/proposal-temporal#3292), so these checks cannot fail on it yet.",
    },
  },
  {
    defects: ["D11"],
    title:
      "D11 — the calendar nudge window is never retried, so total, round and until with a calendar smallestUnit answer over the wrong bounds (relativeTo on the 29th-31st)",
    trigger:
      "a js-temporal release contains js-temporal/temporal-polyfill#361's 50d66d2, which ports proposal-temporal #3172 (17e12be0af42, the fix for tc39 #3168) and retries the nudge window; merged to main in PR #361 as 5af905f, so no new filing is needed",
    steps: [
      "Delete the D11 repros in probeRepros.ts, isNudgeWindowCompatNeeded in capabilities.ts and its export in index.ts, and internal/zonedDifference/nudgeWindow.ts with its calls in zonedWallClockDifference.ts (the monthTotalBySpec and monthRoundBySpec operands in durationTotal and durationRound, the defect-4 term in untilTakesSpecPath, and the plainUntilWithRounding re-export), the plainUntilWithRounding export in internal/index.ts, and its call in plain/calculate/diffDateTime.ts, which calls dt1.until(dt2, { largestUnit, smallestUnit, roundingIncrement, roundingMode }) again, the same object it passes to plainUntilWithRounding now. The last of defects 3–5 to go also deletes untilTakesSpecPath, the // defects 3–5 block in zonedUntil that calls untilAtLimit, and the bySpec blocks in durationTotal and durationRound. Then drop the imports and locals tsc reports unused, and the internal/zonedDifference/operations.ts exports fallow reports unused.",
      "Keep test/nudgeWindowRetry.test.ts and test/intervalLengthOracle.test.ts, and the progress === 0n branch in nudgeToCalendarUnit (internal/zonedDifference/operations.ts; GMT's own fix, not the polyfill's).",
      `Full wording: ${COMPAT_README} § Removal steps 11.`,
    ],
  },
  {
    defects: ["D12"],
    title:
      "D12 — a zoned string's offset written with seconds is matched by minutes instead of exactly (zonedWallClock.ts defect 4)",
    trigger:
      'a js-temporal release contains 23d1275 ("Normative: Require strict matching with a precise ZonedDateTime offset", on main)',
    steps: [
      "Delete matchSecondsOffsetExactly and its call in zonedDateTimeFrom (internal/zonedWallClock.ts), isSecondsOffsetMatchCompatNeeded in capabilities.ts and its export in index.ts, and the D12 repros.",
      "Keep test/secondsOffsetMatch.test.ts: its values are test262's and hold either way.",
      `Full wording: ${COMPAT_README} § Removal steps 12.`,
    ],
  },
  {
    defects: ["D13"],
    title:
      "D13 — two offset changes inside one 14-day transition search step are skipped, or stall the search for ever (zonedWallClock.ts defect 5)",
    trigger:
      "a js-temporal release on which EVERY D13 probe returns the spec value, the stall.* probes within 20,000 offset reads. a79c6a1 (per-zone search windows, on main, in no release) alone is not enough: its 17-day window for Africa/El_Aaiun holds three offsets in April 1976, so stall.nextElAaiun fails there (not filed)",
    steps: [
      "Delete internal/zonedTransitionSearch.ts (its per-zone transition memo goes with it) and the isTransitionSearchCompatNeeded branches of zonedNextTransition and zonedPreviousTransition in internal/zonedWallClockOperations.ts; they return the polyfill path, filtered by the caller's limit.",
      "Delete isMidnightSkipped, the D13 terms of needsOwnStartOfDaySearch and needsOwnDayBoundsSearch in internal/zonedWallClock.ts, isTransitionSearchCompatNeeded in capabilities.ts and its export in index.ts, and the D13 repros with withBoundedOffsetReads.",
      "Keep internal/zonedTransitionSearch.test.ts apart from its step guard, and every Boa_Vista, Riga and Simferopol row: their values are native Temporal's and hold either way.",
      `Full wording: ${COMPAT_README} § Removal steps 13.`,
    ],
  },
  {
    defects: ["D14"],
    title:
      "D14 — ZonedDateTime#round to the day does not clamp an instant in the second piece of a date that starts twice (zonedWallClockOperations.ts roundZonedDateTime)",
    trigger:
      "a js-temporal release that ports the day-round clamp of tc39/ecma262#3966 (commit 5f44331e0a11) (tc39/proposal-temporal#3312; reference polyfill commit 59a51ea9d4); Node 26's V8 throws RangeError on the probe. Expected value: test262 intl402/Temporal/ZonedDateTime/prototype/round/same-date-starts-twice.js",
    steps: [
      "Delete the isDayRoundClampCompatNeeded() term in the day branch of roundZonedDateTime (internal/zonedWallClockOperations.ts; the branch stays for D13 and pre-1847), isDayRoundClampCompatNeeded in capabilities.ts and its export in index.ts, and the D14 repros. Keep the min(thisNs, endNs - 1) clamp in roundToDayFromOwnStartOfDay: it is the spec step.",
      "Keep the same-date-starts-twice rows in roundZoned.test.ts and roundUnix.test.ts: their values are test262's and hold either way.",
      `Full wording: ${COMPAT_README} § Removal steps 14.`,
    ],
  },
  {
    defects: ["D15"],
    title:
      'D15 — `Z` string read by wall clock under offset: "ignore" instead of as an exact instant (zonedWallClock.ts defect 6)',
    trigger:
      "a js-temporal release (and Node floor) whose ToTemporalZonedDateTime keeps a Z string's own instant under offset: \"ignore\", as InterpretISODateTimeOffset requires. Native V8 (Node 24.21 with --harmony-temporal) shares the defect; not filed upstream yet, and js-temporal main c55b211 and tc39 main e8cc03f both still have it (bug doc § O). The expected value is the specification's",
    steps: [
      "Delete zExactOptions and its call in zonedDateTimeFrom (internal/zonedWallClock.ts, with defect 6 in that file's header note), isZIgnoreExactCompatNeeded in capabilities.ts and its export in index.ts, and the D15 repros.",
      "Keep the Z rows in zonedWallClock.test.ts, calendarValueOfZoned.test.ts and the all-16-cells row in classifyStoredZoned.test.ts: their values are the specification's and hold either way.",
      `Full wording: ${COMPAT_README} § Removal steps 15.`,
    ],
  },
  {
    defects: ["D16"],
    title: "D16 — formatRange drops O and long zone-name widths (ICU-20548)",
    trigger:
      "an ICU release that fixes ICU-20548 is bundled by GMT's engines.node floor (>=22.16.0) and by every browser the native suite runs, so every D16 repro passes on every engine: this check reports Node, and the weekly run's compat check in each browser (the temporal-compat-chromium, -firefox, -webkit and -webkit-macos verdicts) reports the rest; D16 is removable only when all of them say so",
    steps: [
      "Delete rangeWithRepairedZoneNames, the zoneNames branch of rangeWithRepairedParts and their gate in zoned/format/formatZonedRange.ts, internal/repairRangeText.ts and its test, isRangeZoneNameCompatNeeded in capabilities.ts and its export in index.ts, and the D16 repros.",
      "Keep every formatZonedRange row: their values are the field formats and hold either way.",
      `Full wording: ${COMPAT_README} § Removal steps 16.`,
    ],
  },
  {
    defects: ["D17"],
    // SpiderMonkey only: on any other engine the probes pass because the defect is not there.
    engines: ["firefox"],
    title:
      "D17 — formatRange writes AM/PM for a flexible dayPeriod next to a timeZoneName (SpiderMonkey)",
    trigger:
      "the weekly run's compat check in Firefox (the temporal-compat-firefox verdict) reports D17 removable: every D17 repro passes in the Firefox the native suite runs, once Bugzilla 2085525 ships. Firefox is the only engine in D17's scope; this check runs on Node, where D17 is out of scope and never removable",
    steps: [
      "Delete the dayPeriods branch of rangeWithRepairedParts and its gate in zoned/format/formatZonedRange.ts, isRangeDayPeriodCompatNeeded in capabilities.ts and its export in index.ts, and the D17 repros.",
      "Keep every formatZonedRange row and the D17 rows of internal/repairRangeParts.test.ts: the values are the requested forms and hold either way. Delete repairRangeParts only with the last of D16 and D17.",
      `Full wording: ${COMPAT_README} § Removal steps 17.`,
    ],
  },
  {
    defects: ["D18"],
    // JavaScriptCore only: on any other engine the probes pass because the defect is not there.
    engines: ["webkit"],
    title:
      "D18 — Islamic calendar dates before the Hijra read as positive years in a second era (WebKit)",
    trigger:
      "the weekly run's compat check in WebKit (the temporal-compat-webkit and temporal-compat-webkit-macos verdicts, Linux and macOS) reports D18 removable: every D18 repro passes in the WebKit the native suite runs, once a js-temporal release reads the Islamic eras or WebKit prints the year as V8 does. WebKit is the only engine in D18's scope; this check runs on Node, where D18 is out of scope and never removable",
    steps: [
      "Delete islamicEra.ts, fixedMonthArithmetic.ts and their tests, islamicFields, polyfillMisreadsIslamicEra and polyfillCannotReturn in calendarFields.ts, the D18 branch and term in calendarDateFromFields.ts, fixedMonthsIfPolyfillCannotReturn in readArithmeticModel.ts, reachesPolyfillLimit and lowestYearOfSum in calendarDateArithmetic.ts, fixedMonthsPerYearOf in largeMonthSpan.ts, and the D18 repros.",
      "Keep every Islamic row of diffDateAsDuration.edges.test.ts and addDate.edges.test.ts: the values are the spec's and hold either way.",
      `Full wording: ${COMPAT_README} § Removal steps 18.`,
    ],
  },
  {
    defects: ["D19"],
    // A polyfill defect that shows only on an engine whose Intl.DateTimeFormat keeps a time zone
    // identifier as written: JavaScriptCore today. V8 and SpiderMonkey return the primary
    // identifier, so the probe passes there whatever the polyfill does.
    engines: ["webkit"],
    title:
      "D19 — ZonedDateTime#equals answers false for two identifiers of one zone where resolvedOptions keeps the identifier (JavaScriptCore)",
    trigger:
      "a js-temporal release whose TimeZoneEquals finds the primary identifier on a host whose Intl.DateTimeFormat#resolvedOptions returns the identifier as written, so the D19 probe (Etc/UTC equals UTC, ECMA-402 §6.5) passes in the WebKit the native suite runs: the weekly run's compat check in WebKit (the temporal-compat-webkit and temporal-compat-webkit-macos verdicts, Linux and macOS) reports it. WebKit is the only engine in D19's scope; this check runs on Node, where D19 is out of scope and never removable",
    steps: [
      "Delete timeZoneEquals.ts, its exports in index.ts, isTimeZoneEqualsCompatNeeded in capabilities.ts and the D19 repros; isCalendarDifferenceAcrossZones (internal/zonedWallClockDifference.ts) compares with new Temporal.ZonedDateTime(0n, id).equals(...) again.",
      "Keep every diffZoned and intervalLengthZoned row: the values are TimeZoneEquals answers and hold either way.",
      `Full wording: ${COMPAT_README} § Removal steps 19.`,
    ],
  },
  {
    defects: ["D20"],
    title:
      "D20 — PlainYearMonth.from and PlainMonthDay.from reject an upper-case iso8601 calendar annotation",
    trigger:
      "a js-temporal release carrying tc39 385b479bf8 (Canonicalize calendar before checking YYYY-MM or MM-DD format), so the D20 probe (--12-25[u-ca=ISO8601] reads as 12-25 and 2026-10[u-ca=ISO8601] as 2026-10) passes on Node",
    steps: [
      "Delete isoCalendarFrom.ts (monthDayFrom and yearMonthFrom) and its test, their exports in index.ts, isIsoCalendarCaseCompatNeeded in capabilities.ts and its export in index.ts, and both D20 repros; plainMonthDayOf and plainYearMonthOf (internal/inputChecks.ts) call Temporal.PlainMonthDay.from and Temporal.PlainYearMonth.from again.",
      "Keep every isValidMonthDay and isValidYearMonth row: the values are the specification's and hold either way.",
      `Full wording: ${COMPAT_README} § Removal steps 20.`,
    ],
  },
  {
    defects: ["D21"],
    title:
      "D21 — Temporal.Now reads one millisecond early after a clock before 1970 (temporalCompat/clock.ts)",
    trigger:
      "a js-temporal release whose SystemUTCEpochNanoSeconds adds a floored modulo (or no tail) so the D21 repro (the second Temporal.Now.instant() with the system clock at 1960-01-01T00:00:00Z reads 1960) passes on Node; filed as tc39/proposal-temporal#3335. The expected value is the specification's and test262's built-ins/Temporal/Now/instant/return-value-value.js",
    steps: [
      "Delete temporalCompat/clock.ts and clock.test.ts, their exports in index.ts, and the D21 repro in repros.ts; every nowInstant, nowZonedDateTimeISO, nowPlainDateTimeISO, nowPlainDateISO and nowPlainTimeISO call becomes the matching Temporal.Now member again, and the guard test in internal/temporal.test.ts goes.",
      "Keep the 1960 and 2027 clock rows (move them to the getUtcYear and getUnixNow tests): the values are the specification's and hold either way.",
      `Full wording: ${COMPAT_README} § Removal steps 21.`,
    ],
  },
  {
    defects: ["D22"],
    title:
      "D22 — a zoned relativeTo or start in a repeated hour is measured from the wrong instant, so total, round and until in a date unit answer wrongly from the later pass, and wrongly or not at all from the earlier pass when the end falls in the later pass at a lower wall clock; where a TC39 Assert fails no value exists (tc39/proposal-temporal#3336), including after a skipped hour, and GMT returns its sentinel where the polyfill extrapolates",
    trigger:
      'a js-temporal release contains 3c403686d39 ("fix for issues #3141, #3148 and #3149", on main) and tc39/proposal-temporal#3319, so every D22 repro passes, P7D with largestUnit "week" giving P1W among them, and the release gives no value in totalsWithNoValue, noDayCorrection and emptyDaySpan, where TC39 Asserts (tc39/proposal-temporal#3336) and the source on main strips three of them from production builds (read, not run); if #3336 gives these lengths a value instead, the rows, the throws and the repros change together',
    steps: [
      "Delete the D22 repros and readOrNone in probeRepros.ts with readOrNone's tests in capabilities.test.ts, isNudgeOriginCompatNeeded in capabilities.ts and its export in index.ts, and internal/zonedDifference/nudgeOrigin.ts with its three calls in zonedWallClockDifference.ts (the originTotalBySpec and originRoundBySpec operands in durationTotal and durationRound, and the defect-5 term in untilTakesSpecPath), the export of possibleEpochNanoseconds from zonedWallClock.ts, WHAT_BREAKS.D22 in apps/dox/src/data/temporal-compat.ts, and this entry. The last of defects 3–5 to go also deletes untilTakesSpecPath, the // defects 3–5 block in zonedUntil that calls untilAtLimit, and the bySpec blocks in durationTotal and durationRound. Then drop the imports and locals tsc reports unused, and the internal/zonedDifference/operations.ts exports fallow reports unused.",
      "Keep the throws in nudgeToCalendarUnit, differenceZonedDateTime, combineDateAndTimeDuration and nudgeToZonedTime, test/laterPassOrigin.test.ts, test/noSpecValue.test.ts and the later-pass rows in internal/lengthFromNow.test.ts: the values are the specification's, but the repros are samples, so run these on the release first and keep D22 if a row fails.",
      `Full wording: ${COMPAT_README} § Removal steps 22.`,
    ],
  },
  {
    defects: ["D23"],
    engines: ["v8"],
    title:
      "D23 — formatToParts and formatRangeToParts abort V8 on a week-of-year year field (nodejs/node#67076)",
    trigger:
      "every V8 the check reads (Node at the engines.node floor, and the temporal-compat-chromium verdict) passes the D23 repro: a gd formatter with year numeric and month short resolves a year, and the Node child-process confirmation of scripts/canary/weekYear.mjs exits 0 with a year part",
    steps: [
      "Delete weekYearSynth.ts and its test, the crash signal and path B in weekYearGuard.ts (a flagged formatter takes native parts with the year patched everywhere), and the D23 repro in repros.ts.",
      "Keep every expected-value row: the values are ECMA-402's and hold either way.",
      `Full wording: ${COMPAT_README} § Removal steps 23.`,
    ],
  },
  {
    defects: ["D24"],
    title:
      "D24 — CLDR date patterns print the week-of-year year where the calendar year is meant (internal/weekYearGuard.ts)",
    trigger:
      "every engine's compat verdict passes every D24 repro, and the weekly sweep of scripts/canary/weekYear.mjs flags no locale, calendar or option set",
    steps: [
      "Delete weekYearGuard.ts, weekYearSynth.ts, weekYearText.ts, weekYearRange.ts and its tests, the formatRangeChecked calls in formatDateRange.ts, formatDateTimeRange.ts and formatZonedRange.ts, the construct hook and forgetWeekYearVerdicts call in formatterCache.ts, weekYearSource.test.ts and the D24 repros in repros.ts.",
      "Keep every expected-value row (weekYearSingle.test.ts and the abort rows): the values are ECMA-402's and hold either way.",
      `Full wording: ${COMPAT_README} § Removal steps 24.`,
    ],
  },
  {
    defects: ["D25"],
    title:
      "D25 — the japanese calendar prints Japanese eras before 1873-01-01 (internal/yearPrinting.ts)",
    trigger:
      "every engine's compat verdict passes both D25 repros: en-u-ca-japanese prints 2 BC for ISO -0001-07-10 and 1872 AD for 1872-12-31 (tc39/proposal-intl-era-monthcode#86, tc39/test262#4877)",
    steps: [
      "Delete the era branch of repairYearPrinting in yearPrinting.ts (beforeEras, the Gregorian twin, the era flag), isJapaneseEraCompatNeeded in capabilities.ts and the D25 repros in repros.ts.",
      "Keep every D25 row in yearPrinting.test.ts: the values are the proposal's and hold either way.",
      `Full wording: ${COMPAT_README} § Removal steps 25.`,
    ],
  },
  {
    defects: ["D26"],
    title:
      "D26 — an islamic calendar prints a negative year before the Hijra (internal/yearPrinting.ts)",
    trigger:
      "every engine's compat verdict passes the D26 repro: en-u-ca-islamic-civil prints a different era text for ISO 600-07-10 and 2025-07-10",
    steps: [
      "Delete the Hijra branch of repairYearPrinting in yearPrinting.ts (beforeHijra, the islamic flag), isIslamicEraCompatNeeded in capabilities.ts and the D26 repro in repros.ts. guardedDateTimeFormat in formatterCache.ts stays while D18 does.",
      "Keep the D26 rows except those that assert the empty value, which a fixed engine replaces with the era's text.",
      `Full wording: ${COMPAT_README} § Removal steps 26.`,
    ],
  },
  {
    defects: ["D27"],
    title:
      "D27 — ja japanese year 2-digit leaves the era year unpadded (internal/yearPrinting.ts)",
    trigger:
      "every engine's compat verdict passes the D27 repro: ja-u-ca-japanese with year 2-digit prints 令和06年 for 2024-07-10",
    steps: [
      "Delete the padding branch of repairYearPrinting in yearPrinting.ts (padPart, paddedRange, shiftOf, the pad flag), isJapaneseTwoDigitYearCompatNeeded in capabilities.ts and the D27 repro in repros.ts.",
      "Keep every D27 row: 令和06年 and 元 are the values either way.",
      `Full wording: ${COMPAT_README} § Removal steps 27.`,
    ],
  },
  {
    defects: ["D28"],
    title:
      "D28 — chinese and dangi pad the related year under year 2-digit (internal/yearPrinting.ts)",
    trigger:
      "every engine's compat verdict passes the D28 repro: en-u-ca-chinese with year 2-digit prints the related year 5 for ISO 0005-07-10",
    steps: [
      "Delete widenRelatedYear in yearPrinting.ts and its call in guardedDateTimeFormat (formatterCache.ts), isRelatedYearWidthCompatNeeded in capabilities.ts and the D28 repro in repros.ts; with D25 to D27 gone too, delete yearPrinting.ts and its hook in construct.",
      "Keep every D28 row: the related year at full width is ECMA-402's value.",
      `Full wording: ${COMPAT_README} § Removal steps 28.`,
    ],
  },
  {
    defects: ["D9"],
    title:
      "D9 — non-ISO months added and counted one month at a time (heap OOM for in-range amounts; temporalCompat/largeMonthSpan.ts)",
    trigger:
      "a js-temporal release adds and differences non-ISO months in bounded work: each D9 probe reads at most 100 Intl dates for 1,200 months",
    steps: [
      "Delete largeMonthSpan.ts, its two calls in readArithmeticModel.ts (addMonths, monthsBetween), the two D9 branches in calendarDateArithmetic.ts, and the D9 repros with withBoundedIntlReads in repros.ts.",
      "Keep largeMonthArithmetic.test.ts: its rows are spec values and must still pass, in bounded time, on the fixed polyfill.",
      `Full wording: ${COMPAT_README} § Removal steps 9.`,
    ],
  },
  {
    defects: ["zoned.A"],
    title:
      "zoned.A — wall clock → exact time at the range limits (zonedWallClock.ts defect 1, zonedWallClockDifference.ts defect 1)",
    trigger:
      "a js-temporal release contains 05ce7a3 (the max.* probes) and 95237e0 (the min.* probes); both are on main",
    steps: [
      "Delete the defect-1 fallbacks described in the header notes of internal/zonedWallClock.ts and internal/zonedWallClockOperations.ts, and, in internal/zonedDifference/rangeLimit.ts, the try/catch in runAtRangeLimit: it becomes compute(timeZone) with no fallback argument, and the four () => …AtLimit(…) arguments in internal/zonedWallClockDifference.ts go. untilAtLimit is also called by the // defects 3–5 block in zonedUntil, and totalAtLimit, roundAtLimit and compareAtLimit by calendarArithmetic.ts, nudgeWindow.ts and nudgeOrigin.ts in internal/zonedDifference/. Delete the four *AtLimit functions in internal/zonedDifference/operations.ts only once none of those calls them. Once zoned.D is retired too, delete rangeLimit.ts and each wrapper returns its plain polyfill call. Then drop the imports and locals tsc reports unused, and the internal/zonedDifference/operations.ts exports fallow reports unused.",
      "Delete the zoned.A repros. Run internal/zonedWallClock*.test.ts: no expected value changes.",
    ],
  },
  {
    defects: ["zoned.B"],
    title:
      "zoned.B — next transition missed near the maximum (zonedWallClock.ts defect 2)",
    trigger:
      "a js-temporal release fixes GetNamedTimeZoneNextTransition near the maximum (upstream-issue draft B; not fixed on main)",
    steps: [
      "Delete the defect-2 (transition-less null) fallback described in the header note of internal/zonedWallClock.ts, and the zoned.B repros.",
      "Run internal/zonedWallClock*.test.ts: no expected value changes.",
    ],
  },
  {
    defects: ["zoned.E"],
    title:
      "zoned.E — transition search floored at 1847-01-01 (zonedWallClock.ts defect 3)",
    trigger:
      "a js-temporal release containing js-temporal/temporal-polyfill#372 (tc39/proposal-temporal#3330)",
    steps: [
      "Delete POLYFILL_TRANSITION_SEARCH_FLOOR, isBeforePolyfillTransitionSearch, missedNextTransition and missedPreviousTransition in internal/zonedWallClock.ts, and their gates: dateOnlyBeforeTransitionSearch there, and needsOwnStartOfDay, plainDateBeforeTransitionSearch and the pre-1847 check in zonedNextTransition in internal/zonedWallClockOperations.ts.",
      "zonedPreviousTransition becomes the plain polyfill call (or inline it back into zonedBucket.ts). Delete the zoned.E repros and the pre-1847 assumption guard in internal/zonedWallClock.test.ts.",
      "Run internal/zonedWallClock*.test.ts, internal/zonedBucket.test.ts and the zoned/unix/calendar test files carrying a `zoned.E` describe block: no expected value changes.",
    ],
  },
  {
    defects: ["zoned.D"],
    title:
      "zoned.D — UTC fast path skips IsValidEpochNanoseconds (zonedWallClockDifference.ts defect 2)",
    trigger:
      "a js-temporal release validates the UTC fast path of GetPossibleEpochNanoseconds (upstream-issue draft D; not fixed on main)",
    steps: [
      "Delete internal/zonedDifference/utcValidity.ts and the guarded call in runAtRangeLimit (internal/zonedDifference/rangeLimit.ts), and the zoned.D repros. If zoned.A is gone too, delete rangeLimit.ts, the reach code and atRangeLimit, and make each wrapper return its plain polyfill call. Then drop the imports and locals tsc reports unused, and the internal/zonedDifference/operations.ts exports fallow reports unused.",
      "Run internal/zonedWallClockDifference.test.ts: no expected value changes.",
    ],
  },
];

/** The installed `@js-temporal/polyfill` entry (`require` condition), as packages/gmt resolves it. */
export function polyfillEntry() {
  return createRequire(join(GMT_DIR, "package.json")).resolve(
    "@js-temporal/polyfill",
  );
}

/** The installed `@js-temporal/polyfill` version, resolved the way packages/gmt resolves it. */
export function polyfillVersion() {
  const entry = polyfillEntry();
  for (let dir = dirname(entry); dir !== dirname(dir); dir = dirname(dir)) {
    const manifest = join(dir, "package.json");
    if (!existsSync(manifest)) continue;
    const { name, version } = JSON.parse(readFileSync(manifest, "utf8"));
    if (name === "@js-temporal/polyfill") return version;
  }
  return "unknown";
}
