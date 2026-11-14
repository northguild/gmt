import { Temporal } from "../temporal";
import { type DefectId, type ProbeRepro, probeRepros } from "./probeRepros";

/*
 * Lazy, memoized capability probes: one answer per (defect, calendar), computed the first time a
 * workaround asks and cached for the life of the process. Results are deterministic for a given
 * polyfill + ICU, and the polyfill is imported once, so a cached answer never goes stale.
 *
 * A workaround whose probe passes never runs: behaviour is the polyfill's own. Tests never force a
 * probe; they assert spec-correct outputs that hold either way (temporalCompat README).
 */

/** The repro's output, or `ERR <name>: <message>` when it throws. */
export function runRepro(repro: Pick<ProbeRepro, "run">): string {
  try {
    return repro.run();
  } catch (error) {
    const { name, message } =
      error instanceof Error ? error : new Error(String(error));
    return `ERR ${name}: ${message}`;
  }
}

/** True when a repro's output is the spec-correct value, i.e. the installed runtime is fixed. */
export function reproPasses(
  repro: Pick<ProbeRepro, "expected">,
  output: string,
): boolean {
  return output === repro.expected;
}

/**
 * True when any of `candidates` for this defect and Temporal calendar id fails. Stops at the first
 * failure, so the order of a defect's repros is the order they are tried in.
 */
export function anyReproFails(
  candidates: readonly (Omit<ProbeRepro, "defect"> & { defect: string })[],
  defect: DefectId,
  calendar: string,
): boolean {
  return candidates.some(
    (repro) =>
      repro.defect === defect &&
      repro.calendar === calendar &&
      !reproPasses(repro, runRepro(repro)),
  );
}

const cache = new Map<string, boolean>();

/**
 * True when any repro for this defect and Temporal calendar id fails in the installed runtime.
 * A calendar with no repro for the defect is not affected by it.
 */
export function isDefectPresent(defect: DefectId, calendar: string): boolean {
  const key = `${defect}/${calendar}`;
  const cached = cache.get(key);
  if (cached !== undefined) {
    return cached;
  }
  const present = anyReproFails(probeRepros, defect, calendar);
  cache.set(key, present);
  return present;
}

/**
 * True when this runtime never retries the calendar nudge window (defect D11).
 *
 * TC39 bounds a duration between `relativeTo + r1 units` and `relativeTo + r2 units`, and recomputes
 * the window one unit further along when the target falls outside it. A runtime that computes the
 * window once answers `Duration#total`, `Duration#round` and `until`/`since` with a calendar
 * `smallestUnit` over the wrong bounds. Only a `relativeTo` on the 29th, 30th or 31st can reach it,
 * because only there does adding a month constrain the day. ISO-only: the non-ISO calendars already
 * take the spec path through `isCalendarArithmeticCompatNeeded`.
 */
export function isNudgeWindowCompatNeeded(): boolean {
  return isDefectPresent("D11", "iso8601");
}

/**
 * True when this runtime mismeasures from either pass of a repeated hour (defect D22).
 *
 * TC39 `ComputeNudgeWindow` takes the window's start from the origin's own exact time when no unit
 * has been added, and `DifferenceZonedDateTime` subtracts the exact times when both fall on one local
 * date. A runtime that turns the wall clock back into an exact time with `"compatible"` moves a
 * later-pass origin an hour early, and one with no same-date branch backs up a day from an earlier-pass
 * origin when the end falls in the later pass at a lower wall clock. So `Duration#total` in a date unit,
 * and `Duration#round` and `until` with a date `largestUnit`, answer from an instant the caller never
 * named. tc39/ecma262#3759 commit `1f4e6717ef23` decides when the window starts at the origin: an
 * empty start duration, not `r1 = 0`.
 */
export function isNudgeOriginCompatNeeded(): boolean {
  return isDefectPresent("D22", "iso8601");
}

/**
 * True when this runtime matches a zoned string's offset by minutes even when the offset is
 * written with seconds (defect D12).
 *
 * TC39 `ToTemporalZonedDateTime` matches by minutes only an offset with no seconds part; one
 * written with seconds must equal the zone's offset exactly. A runtime that always matches by
 * minutes accepts `-00:45:00[Africa/Monrovia]` for a zone at −00:44:30, and picks the wrong pass
 * of a second repeated by a sub-minute transition (Pacific/Niue, 1952).
 */
export function isSecondsOffsetMatchCompatNeeded(): boolean {
  return isDefectPresent("D12", "iso8601");
}

/**
 * True when this runtime's time zone transition search cannot be trusted (defect D13).
 *
 * TC39 `GetNamedTimeZoneNextTransition` returns the first offset change after an instant. A runtime
 * that samples the offset in steps longer than the gap between two changes skips a pair that
 * returns to the same offset, and can loop for ever on three different offsets in one step. The
 * skipped-pair repros come first and none of them can stall, so on such a runtime the probe
 * answers before a stalling repro is reached. Every repro has to pass for the workaround to go
 * dormant: a runtime that fixes the skipped pairs and still stalls on one zone keeps it.
 */
export function isTransitionSearchCompatNeeded(): boolean {
  return isDefectPresent("D13", "iso8601");
}

/**
 * True when this runtime rounds to the day wrongly where a date starts twice (defect D14).
 *
 * A fall-back across midnight re-enters a date after the next date has started, as
 * America/Goose_Bay did on 2010-11-06, and America/Sitka on 1867-10-18. TC39
 * `ZonedDateTime#round` clamps an instant in the second piece of that date to the end of the date
 * (tc39/ecma262#3966, commit 5f44331e0a11; test262 `same-date-starts-twice.js`). A runtime without
 * that change answers the next date for `floor` and `trunc`, and in some zones (Sitka 1867) for the
 * half modes, `ceil` and `expand` too, or throws.
 */
export function isDayRoundClampCompatNeeded(): boolean {
  return isDefectPresent("D14", "iso8601");
}

/**
 * True when this runtime applies `offset: "ignore"` to a `Z` string (defect D15).
 *
 * TC39 `ToTemporalZonedDateTime` reads a `Z` string as an exact instant under every `offset`
 * option; `InterpretISODateTimeOffset` applies `ignore` only to an offset written as an option. A
 * runtime that ignores the `Z` and reads the wall clock in the zone returns a different instant
 * whenever the zone's offset is not zero.
 */
export function isZIgnoreExactCompatNeeded(): boolean {
  return isDefectPresent("D15", "iso8601");
}

const rangeZoneNameCache = new Map<string, boolean>();

/**
 * True when this runtime's `formatRange` changes the `timeZoneName` width of a range (defect D16).
 *
 * UTS #35 (Matching Skeletons) expects "fields in the skeleton and pattern ... to be adjusted in
 * parallel", so the range pattern chosen for a `timeZoneName: "long"` skeleton keeps a long zone
 * name; ECMA-402 §11.5.8 builds each range part with FormatDateTimePattern over the range
 * pattern's own fields, so it prints what that pattern holds. ICU-20548 makes `DateIntervalFormat`
 * cut `long` and `longGeneric` to short names and drop `shortOffset` and `longOffset`. The probe
 * runs once per style, on the first call for it. A style with no repro (an unknown one) is not
 * affected, and is not cached, so a caller passing arbitrary text cannot grow the cache.
 */
export function isRangeZoneNameCompatNeeded(style: string): boolean {
  const cached = rangeZoneNameCache.get(style);
  if (cached !== undefined) {
    return cached;
  }
  const name = `range.${style}`;
  const candidates = probeRepros.filter(
    (repro) => repro.defect === "D16" && repro.name === name,
  );
  if (candidates.length === 0) {
    return false;
  }
  const present = anyReproFails(candidates, "D16", "iso8601");
  rangeZoneNameCache.set(style, present);
  return present;
}

/**
 * True when this runtime's `formatRange` writes the AM/PM day period where `dayPeriod` asks for a
 * flexible one, with a `timeZoneName` set (defect D17).
 *
 * Not a width rule (UTS #35 treats a, b and B as close matches). ECMA-402 §11.5.8 picks the range
 * pattern by the resolved [[HourCycle]] only: en-US resolves to h12 whether `hourCycle: "h12"` is
 * given or omitted, yet SpiderMonkey (Firefox 155) prints the flexible period for the first and
 * AM/PM for the second. Identical resolved options give two range outputs, and GMT's contract is
 * that a range keeps the fields the caller asked for.
 */
export function isRangeDayPeriodCompatNeeded(): boolean {
  return isDefectPresent("D17", "iso8601");
}

/**
 * True when this runtime's `ZonedDateTime#equals` answers false for two identifiers of one time
 * zone (defect D19).
 *
 * ECMA-262 TimeZoneEquals compares the two [[PrimaryIdentifier]]s, and ECMA-402 §6.5 fixes
 * `"UTC"` as primary and `"Etc/UTC"` as a non-primary identifier that resolves to it. The polyfill
 * finds a non-primary identifier's primary through `Intl.DateTimeFormat#resolvedOptions`, which
 * JavaScriptCore returns as written, so `Etc/UTC` and `UTC` compare unequal there.
 */
export function isTimeZoneEqualsCompatNeeded(): boolean {
  return isDefectPresent("D19", "iso8601");
}

/**
 * True when this runtime's `Temporal.PlainMonthDay.from` or `Temporal.PlainYearMonth.from` throws
 * for an upper-case `iso8601` calendar annotation (defect D20).
 *
 * Temporal ParseISODateTime, for the goals TemporalMonthDayString (no DateYear) and
 * TemporalYearMonthString (no DateDay), lower-cases the `u-ca` value before comparing it with
 * `"iso8601"`; polyfill 0.5.1 compares it as written in both parsers.
 */
export function isIsoCalendarCaseCompatNeeded(): boolean {
  return isDefectPresent("D20", "iso8601");
}

/** Defects that make the runtime's calendar arithmetic or reads differ from the spec. */
const ARITHMETIC_DEFECTS: readonly DefectId[] = [
  "D1",
  "D2",
  "D3",
  "D4",
  "D5",
  "D6",
  "D7",
  "D10",
  "D18",
];

/**
 * True when calendar arithmetic in `calendarId` needs the compat layer in this runtime: any of its
 * add, until or read probes fails. `iso8601` never does, and costs nothing.
 * Callers that own a spec path for a whole operation (zoned differences, `Duration` rounding,
 * totals and comparisons) take it when this is true.
 */
export function isCalendarArithmeticCompatNeeded(calendarId: string): boolean {
  return (
    calendarId !== "iso8601" &&
    ARITHMETIC_DEFECTS.some((defect) => isDefectPresent(defect, calendarId))
  );
}

const engineProbeCache = new Map<string, boolean>();

/** `Intl.DateTimeFormat` text for a UTC date given as year, month and day (any year, 0 to 99 too). */
function textAt(
  locale: string,
  options: Intl.DateTimeFormatOptions,
  date: readonly [number, number, number],
): string {
  const time = Temporal.PlainDate.from({
    year: date[0],
    month: date[1],
    day: date[2],
  }).toZonedDateTime("UTC").epochMilliseconds;
  return new Intl.DateTimeFormat(locale, {
    ...options,
    timeZone: "UTC",
  }).format(time);
}

/** One engine probe, answered the first time it is asked and kept: `true` when the engine has the defect. */
function engineDefect(key: string, fails: () => boolean): boolean {
  const cached = engineProbeCache.get(key);
  if (cached !== undefined) {
    return cached;
  }
  let present: boolean;
  try {
    present = fails();
  } catch {
    // An engine that cannot run the probe cannot print the calendar either: nothing to repair.
    present = false;
  }
  engineProbeCache.set(key, present);
  return present;
}

/**
 * True when this runtime's japanese calendar prints a Japanese era for a date the Gregorian
 * eras cover (defect D25, ICU-23341 and ICU-23619).
 *
 * Intl era/monthCode Table 2, as amended by tc39/proposal-intl-era-monthcode#86 (test262
 * tc39/test262#4877): for dates up to and including 1872-12-31 the japanese calendar uses the
 * Gregorian eras. ICU 78 prints `-645 Taika` for ISO -0001-07-10 and `5 Meiji` for 1872-12-31. The
 * probe compares the japanese calendar's era and year with the Gregorian calendar's at both dates.
 */
export function isJapaneseEraCompatNeeded(): boolean {
  return engineDefect("D25", () =>
    (
      [
        [-1, 7, 10],
        [1872, 12, 31],
      ] as const
    ).some(
      (date) =>
        textAt("en-u-ca-japanese", { era: "short", year: "numeric" }, date) !==
        textAt("en-u-ca-gregory", { era: "short", year: "numeric" }, date),
    ),
  );
}

/**
 * True when this runtime prints a date before the Hijra in the one Islamic era, as a negative year
 * (defect D26, ICU-23327).
 *
 * Intl era/monthCode Table 2 and § 4.1.12 give the `bh` era, and test262
 * `intl402/DateTimeFormat/prototype/formatToParts/era.js` requires ISO 600 and 2025 to print
 * different era names. The probe compares the text with its digits and signs taken out.
 */
export function isIslamicEraCompatNeeded(): boolean {
  const eraOf = (date: readonly [number, number, number]): string =>
    textAt(
      "en-u-ca-islamic-civil",
      { era: "short", year: "numeric" },
      date,
    ).replace(/[\p{Nd}\p{Pd}\p{Z}−]/gu, "");
  return engineDefect(
    "D26",
    () => eraOf([600, 7, 10]) === eraOf([2025, 7, 10]),
  );
}

/**
 * True when this runtime does not pad a Japanese era year under `year: "2-digit"` (defect D27,
 * ICU-23620).
 *
 * ECMA-402 FormatDateTimePattern, the "2-digit" branch: FormatNumeric with `minimumIntegerDigits:
 * 2`, so Reiwa 6 is `06`. ICU's `jpanyear` numbering ignores the minimum digit count.
 */
export function isJapaneseTwoDigitYearCompatNeeded(): boolean {
  return engineDefect(
    "D27",
    () =>
      !/\p{Nd}{2}/u.test(
        textAt("ja-u-ca-japanese", { year: "2-digit" }, [2024, 7, 10]),
      ),
  );
}

/**
 * True when this runtime pads the related year of the chinese and dangi calendars under `year:
 * "2-digit"` (defect D28, ICU-23621).
 *
 * ECMA-402 FormatDateTimePattern: `relatedYear` is FormatNumeric of the related year at full width,
 * with no 2-digit form. ICU prints its `rr` field, padded to two digits: `05` for ISO 0005.
 */
export function isRelatedYearWidthCompatNeeded(): boolean {
  return engineDefect(
    "D28",
    () =>
      /\p{Nd}+/u.exec(
        textAt("en-u-ca-chinese", { year: "2-digit" }, [5, 7, 10]),
      )?.[0] !== "5",
  );
}
