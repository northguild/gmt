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
 * True when this runtime mismeasures from either pass of a repeated hour, or answers a length there
 * that has no spec value (defect D22). `temporal-polyfill` 1.0.8 does only the second.
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
