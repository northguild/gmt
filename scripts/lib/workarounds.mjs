/**
 * The workaround groups GMT keeps for `temporal-polyfill` and runtime-ICU defects: each one's
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
/** packages/gmt, where the polyfill is installed and resolved from. */
export const GMT_DIR = join(ROOT, "packages/gmt");
const COMPAT_README = "packages/gmt/src/internal/temporalCompat/README.md";

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
    defects: ["D19"],
    // A polyfill defect that shows only on an engine whose Intl.DateTimeFormat keeps a time zone
    // identifier as written: JavaScriptCore today. V8 and SpiderMonkey return the primary
    // identifier, so the probe passes there whatever the polyfill does.
    engines: ["webkit"],
    title:
      "D19 — ZonedDateTime#equals answers false for two identifiers of one zone where resolvedOptions keeps the identifier (JavaScriptCore)",
    trigger:
      "a temporal-polyfill release whose TimeZoneEquals finds the primary identifier on a host whose Intl.DateTimeFormat#resolvedOptions returns the identifier as written, so the D19 probe (Etc/UTC equals UTC, ECMA-402 §6.5) passes in the WebKit the native suite runs: the weekly run's compat check in WebKit (the temporal-compat-webkit and temporal-compat-webkit-macos verdicts, Linux and macOS) reports it. WebKit is the only engine in D19's scope; this check runs on Node, where D19 is out of scope and never removable",
    steps: [
      "Delete timeZoneEquals.ts, its exports in index.ts, isTimeZoneEqualsCompatNeeded in capabilities.ts and the D19 repros; isCalendarDifferenceAcrossZones (internal/zonedWallClockDifference.ts) compares with new Temporal.ZonedDateTime(0n, id).equals(...) again, and zonedUntil calls one.until(two, options) without reading two in one's identifier first (the end variable).",
      "Keep every diffZoned and intervalLengthZoned row: the values are TimeZoneEquals answers and hold either way.",
      `Full wording: ${COMPAT_README} § Removal steps 19.`,
    ],
  },
  {
    defects: ["D22"],
    title:
      "D22 — a zoned relativeTo or start in a repeated hour is measured from the wrong instant, so total, round and until in a date unit answer wrongly from the later pass, and wrongly or not at all from the earlier pass when the end falls in the later pass at a lower wall clock; where a TC39 Assert fails no value exists (tc39/proposal-temporal#3336), including after a skipped hour, and GMT returns its sentinel where the polyfill extrapolates",
    trigger:
      'a temporal-polyfill release on which every D22 repro passes, P7D with largestUnit "week" giving P1W among them, and which gives no value in totalsWithNoValue, noDayCorrection and emptyDaySpan, where TC39 Asserts (tc39/proposal-temporal#3336); if #3336 gives these lengths a value instead, the rows, the throws and the repros change together',
    steps: [
      "Delete the D22 repros and readOrNone in probeRepros.ts with readOrNone's tests in capabilities.test.ts, isNudgeOriginCompatNeeded in capabilities.ts and its export in index.ts, and internal/zonedDifference/nudgeOrigin.ts with its three calls in zonedWallClockDifference.ts (the originTotalBySpec and originRoundBySpec operands in durationTotal and durationRound, and untilTakesSpecPath with the block in zonedUntil that calls untilAtLimit), then internal/zonedDifference/operations.ts, or, while D35 stands, all of it but what plainCompare.ts imports (dateDurationDays, add24HourDaysToTimeDuration, bigintSign and toInternalDuration) and the helpers those call (fallow does not report its unused exports: every src file is a build entry), the exports of possibleEpochNanoseconds, epochNanosecondsFor, utcEpochNanoseconds and isValidEpoch from zonedWallClock.ts that nothing else calls, WHAT_BREAKS.D22 in apps/dox/src/data/temporal-compat.ts, and this entry. Then drop the imports and locals tsc reports unused.",
      "Keep the throws' rows in test/laterPassOrigin.test.ts, test/noSpecValue.test.ts and the later-pass rows in internal/lengthFromNow.test.ts: the values are the specification's, but the repros are samples, so run these on the release first and keep D22 if a row fails.",
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
      "Delete weekYearGuard.ts, weekYearSynth.ts, weekYearText.ts, weekYearRange.ts and its tests, every formatRangeChecked call (in formatRangeRepaired in rangeFields.ts, in formatZonedRange.ts and in yearPrintingRange.ts; each becomes the formatter's own formatRange), and the formatRangeChecked re-export and forgetWeekYearRange hook in rangeRepairs.ts (rangeRepairs.ts and rangeHooks.ts stay while D25, D27 or D29 is live), the construct hook and forgetWeekYearVerdicts call in formatterCache.ts, weekYearSource.test.ts and the D24 repros in repros.ts.",
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
      "Delete the era branch of repairYearPrinting in yearPrinting.ts (beforeEras, the Gregorian twin, the era flag), the era branches of yearPrintingRange.ts (eraTwinRange, spliceEra, joinedSingles, laterPair; the file itself when D27 is also gone), isJapaneseEraCompatNeeded in capabilities.ts and the D25 repros in repros.ts.",
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
      "Delete the Hijra branch of repairYearPrinting in yearPrinting.ts (beforeHijra, the islamic flag), isIslamicEraCompatNeeded in capabilities.ts and the D26 repro in repros.ts.",
      "Keep the D26 rows except those that assert the empty value, which a fixed engine replaces with the era's text.",
      `Full wording: ${COMPAT_README} § Removal steps 26.`,
    ],
  },
  {
    defects: ["D27"],
    title:
      "D27 — ja japanese leaves the era year unpadded under year 2-digit and in Latin digits under another numbering system (internal/yearPrinting.ts, internal/japaneseNumerals.ts)",
    trigger:
      "every engine's compat verdict passes both D27 repros: ja-u-ca-japanese with year 2-digit prints 令和06年 for 2024-07-10, and ja-u-ca-japanese-nu-arab with year numeric prints 令和٦年",
    steps: [
      "Delete the padding branch of repairYearPrinting in yearPrinting.ts (padPart, shiftOf, the pad flag), paddedRange in yearPrintingRange.ts, isJapaneseTwoDigitYearCompatNeeded in capabilities.ts, japaneseNumerals.ts and its call in guardedDateTimeFormat (formatterCache.ts), isJapaneseNumberingSystemCompatNeeded in capabilities.ts and the D27 repros in repros.ts.",
      "Keep every D27 row: 令和06年, 令和٦年 and 元 are the values either way.",
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
    defects: ["D29"],
    title:
      "D29 — a range drops, repeats or garbles a field of one date (internal/rangeFields.ts)",
    trigger:
      "every engine's compat verdict passes every D29 repro (rangeFieldRepros.ts, one range per upstream defect, so the gate stays on while any one fails), and the weekly sweep of scripts/canary/rangeFields.mjs flags no locale, calendar or option set",
    steps: [
      "Delete rangeFields.ts, rangeFieldValues.ts, rangeDetector.ts and their tests, isRangeFieldCompatNeeded in capabilities.ts, rangeFieldRepros.ts and the D29 repros in repros.ts, and scripts/canary/rangeFields.mjs with its entry in .fallowrc.jsonc. In formatDateRange.ts and formatDateTimeRange.ts replace formatRangeRepaired with ensureRangeHooks() and formatRangeChecked, both from internal/rangeRepairs, and in zonedRangeText (formatZonedRange.ts) delete the rangeFieldsText call and the branch that uses its text (its ensureRangeHooks call stays). When D24, D25 and D27 are also gone, delete rangeRepairs.ts and rangeHooks.ts with those calls. rangeFallback.ts stays while D25 uses it, patternKey.ts while D24 does.",
      "Keep every row of formatZonedRangeFields.test.ts: the ranges are ECMA-402's. A row whose range hit a broken pattern may now print CLDR's rewritten range text instead of the fallback; check it against the fixed engine's own formatRange and update that row.",
      `Full wording: ${COMPAT_README} § Removal steps 29.`,
    ],
  },
  {
    defects: ["D30"],
    title:
      "D30 — islamic and islamic-rgsa resolve as written (internal/formatterCache.ts)",
    trigger:
      "every engine's compat verdict passes both D30 repros: en-u-ca-islamic resolves islamic-tbla and en-u-ca-islamic-rgsa resolves a calendar other than islamic-rgsa (tc39/proposal-intl-era-monthcode#99)",
    steps: [
      "Delete islamicResolved and islamicTag and their call in construct (formatterCache.ts), isIslamicCalendarResolutionCompatNeeded in capabilities.ts and the D30 repros in repros.ts.",
      "Keep every row of islamicCalendarResolution.test.ts: the calendars are the proposal's and hold either way.",
      `Full wording: ${COMPAT_README} § Removal steps 30.`,
    ],
  },
  {
    defects: ["D31"],
    title:
      "D31 — a coptic date before AM 1 prints 1 - year and no era (internal/copticEra.ts)",
    trigger:
      "every engine's compat verdict passes the D31 repro: en-u-ca-coptic prints the signed year -285 and the same era name as a later date for ISO -0001-07-10 (ICU-23277; unicode-org/icu#4081)",
    steps: [
      "Delete internal/copticEra.ts, its call in construct (formatterCache.ts), isCopticEraCompatNeeded in capabilities.ts and the D31 repro in repros.ts.",
      "Keep every row of copticEra.test.ts and the coptic rows of weekYearRange.test.ts and weekYearRangeText.test.ts: the signed years are Intl era/monthCode Table 2's and hold either way.",
      `Full wording: ${COMPAT_README} § Removal steps 31.`,
    ],
  },
  {
    defects: ["D32"],
    // JavaScriptCore only: on any other engine the probe passes because the defect is not there.
    engines: ["webkit"],
    title:
      "D32 — the Islamic era changes in the middle of 1 Muharram of year 1 (internal/islamicEpochEra.ts)",
    trigger:
      "the weekly run's compat check in WebKit (the temporal-compat-webkit and temporal-compat-webkit-macos verdicts) passes the D32 repro: islamic-civil, islamic-tbla and islamic-umalqura print the same era at the first and the last hour of their epoch day in UTC (WebKit 331724)",
    steps: [
      "Delete internal/islamicEpochEra.ts, its call in construct (formatterCache.ts), its call in localFieldsOf (rangeFieldValues.ts), isIslamicEpochEraCompatNeeded in capabilities.ts and the D32 repro in repros.ts.",
      "Keep every row of islamicEpochEra.test.ts: the epoch day and the era are Intl era/monthCode Table 2's and hold either way.",
      `Full wording: ${COMPAT_README} § Removal steps 32.`,
    ],
  },
  {
    defects: ["D33"],
    // Every engine: the defect is host disagreement, so one engine passing proves nothing.
    title:
      "D33 — Chinese and Dangi dates differ by host; a runtime whose probe fails returns the sentinel for a chinese or dangi date format (internal/lunisolarRefusal.ts)",
    trigger:
      "every engine's compat verdict (Node, chromium, firefox, webkit, webkit-macos) passes every D33 text repro: the host's Intl.DateTimeFormat gives the Purple Mountain Observatory and KASI dates, so 2027-02-06 is the Chinese New Year and 2027-02-07 the Dangi one on every host (Intl era/monthCode §1.1 Table 1)",
    steps: [
      "Delete isLunisolarTextCompatNeeded in capabilities.ts, internal/lunisolarRefusal.ts, internal/printsDateField.ts, refuseDates and the !dates cache-key suffix, test/lunisolarGuarded.ts and the D33 repros in repros.ts; rows then read host text.",
      "Adding chinese and dangi to CalendarSystem is a separate, later minor.",
      `Full wording: ${COMPAT_README} § Removal steps 33.`,
    ],
  },
  {
    defects: ["D34"],
    // JavaScriptCore only: on any other engine the probe passes because the defect is not there.
    engines: ["webkit"],
    title:
      "D34 — the Coptic era changes in the middle of 1 Tout AM 1 (internal/copticEra.ts)",
    trigger:
      "the weekly run's compat check in WebKit (the temporal-compat-webkit and temporal-compat-webkit-macos verdicts) passes the D34 repro: en-u-ca-coptic prints the same era at the first and the last hour of ISO 0284-08-29 in UTC (WebKit/WebKit#81144, bug 331724)",
    steps: [
      "Delete isCopticEpochEraCompatNeeded in capabilities.ts, its term in repairCopticEra's activation and atRisk (copticEra.ts), copticEpochTwin, copticFieldTwin and its call in localFieldsOf (rangeFieldValues.ts), and the D34 repro in repros.ts.",
      "Keep every D34 row of copticEra.test.ts: the era is Intl era/monthCode Table 2's and holds either way.",
      `Full wording: ${COMPAT_README} § Removal steps 34.`,
    ],
  },
  {
    defects: ["D35"],
    title:
      "D35 — Duration.compare from a plain relativeTo throws for a day or time amount whose date would be past the range (internal/zonedDifference/plainCompare.ts)",
    trigger:
      "a temporal-polyfill release on which both D35 repros pass: PT3000000000H against P1Y from 2000-01-01 gives 1, and -P1D against P1W from -271821-04-19 gives -1 (fullcalendar/temporal-polyfill#130)",
    steps: [
      "Delete internal/zonedDifference/plainCompare.ts, and its call in durationCompare (the try around Temporal.Duration.compare) and the D35 bullet in the header of zonedWallClockDifference.ts; the D35 repros in probeRepros.ts and D35 in DefectId, isDurationCompareCompatNeeded in capabilities.ts with its export in index.ts and its tests in capabilities.test.ts, WHAT_BREAKS.D35 in apps/dox/src/data/temporal-compat.ts, the D35 row in apps/dox/src/data/temporal-compat.json, and this entry. In internal/zonedDifference/operations.ts, delete dateDurationDays and add24HourDaysToTimeDuration and the export on bigintSign and toInternalDuration, or the file once D22 is gone too.",
      "Keep every compareDurations row: the values are TC39's and hold either way.",
      `Full wording: ${COMPAT_README} § Removal steps 35.`,
    ],
  },
  {
    defects: ["D9"],
    title:
      "D9 — an out-of-range non-ISO month amount throws only after work linear in the amount (temporalCompat/monthRange.ts throws first)",
    trigger:
      "a temporal-polyfill release throws for an out-of-range month amount in bounded time: hebrew 2024-01-15 + 40,000,000 months throws in at most 5,000 ms (an absolute ceiling that fails the repro at once), and + 400,000,000 months throws in under 3 × the time of + 40,000,000 months + 10 ms",
    steps: [
      "Delete monthRange.ts, its export in index.ts, its calls (calendarDateAdd in calendarDateArithmetic.ts, addToZoned and subtractFromZoned in zonedWallClockOperations.ts, durationTotal, durationRound and durationCompare in zonedWallClockDifference.ts, and the others in the monthRange.ts header's call-site table), and the D9 repro with millisecondsToThrow in repros.ts.",
      "Keep largeMonthArithmetic.test.ts: its rows are spec values and must still pass, in bounded time, on the fixed polyfill.",
      `Full wording: ${COMPAT_README} § Removal steps 9.`,
    ],
  },
];

/** The installed `temporal-polyfill` entry (`import` condition), as packages/gmt resolves it. */
export function polyfillEntry() {
  return createRequire(join(GMT_DIR, "package.json")).resolve(
    "temporal-polyfill",
  );
}

/** The installed `temporal-polyfill` version, resolved the way packages/gmt resolves it. */
export function polyfillVersion() {
  const entry = polyfillEntry();
  for (let dir = dirname(entry); dir !== dirname(dir); dir = dirname(dir)) {
    const manifest = join(dir, "package.json");
    if (!existsSync(manifest)) continue;
    const { name, version } = JSON.parse(readFileSync(manifest, "utf8"));
    if (name === "temporal-polyfill") return version;
  }
  return "unknown";
}
