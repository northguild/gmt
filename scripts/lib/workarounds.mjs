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
 * Chromium are both V8: a defect in V8 or in the ICU it bundles reads the same on both.
 * @type {Readonly<Record<"node" | "chromium" | "firefox" | "webkit", "v8" | "firefox" | "webkit">>}
 */
export const ENGINE_IDS = Object.freeze({
  node: "v8",
  chromium: "v8",
  firefox: "firefox",
  webkit: "webkit",
});

export const WORKAROUNDS = [
  {
    defects: ["D16"],
    title: "D16 — formatRange drops O and long zone-name widths (ICU-20548)",
    trigger:
      "an ICU release that fixes ICU-20548 is bundled by GMT's engines.node floor (>=22.16.0) and by every browser the native suite runs, so every D16 repro passes on every engine: this check reports Node, and the weekly run's compat check in each browser (the temporal-compat-chromium, -firefox and -webkit verdicts) reports the rest; D16 is removable only when all of them say so",
    steps: [
      "Delete the zoneNames branch of rangeWithRepairedParts and its gate in zoned/format/formatZonedRange.ts, isRangeZoneNameCompatNeeded in capabilities.ts and its export in index.ts, and the D16 repros.",
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
      "a temporal-polyfill release whose TimeZoneEquals finds the primary identifier on a host whose Intl.DateTimeFormat#resolvedOptions returns the identifier as written, so the D19 probe (Etc/UTC equals UTC, ECMA-402 §6.5) passes in the WebKit the native suite runs: the weekly run's compat check in WebKit (the temporal-compat-webkit verdict) reports it. WebKit is the only engine in D19's scope; this check runs on Node, where D19 is out of scope and never removable",
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
      "Delete the D22 repros and readOrNone in probeRepros.ts with readOrNone's tests in capabilities.test.ts, isNudgeOriginCompatNeeded in capabilities.ts and its export in index.ts, and internal/zonedDifference/nudgeOrigin.ts with its three calls in zonedWallClockDifference.ts (the originTotalBySpec and originRoundBySpec operands in durationTotal and durationRound, and untilTakesSpecPath with the block in zonedUntil that calls untilAtLimit), then internal/zonedDifference/operations.ts, the exports of possibleEpochNanoseconds, epochNanosecondsFor, utcEpochNanoseconds and isValidEpoch from zonedWallClock.ts that nothing else calls, WHAT_BREAKS.D22 in apps/dox/src/data/temporal-compat.ts, and this entry. Then drop the imports and locals tsc reports unused.",
      "Keep the throws' rows in test/laterPassOrigin.test.ts, test/noSpecValue.test.ts and the later-pass rows in internal/lengthFromNow.test.ts: the values are the specification's, but the repros are samples, so run these on the release first and keep D22 if a row fails.",
      `Full wording: ${COMPAT_README} § Removal steps 22.`,
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
