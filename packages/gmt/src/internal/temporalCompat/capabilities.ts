import { type DefectId, type Repro, repros } from "./repros";

/*
 * Lazy, memoized capability probes: one answer per (defect, calendar), computed the first time a
 * workaround asks and cached for the life of the process. Results are deterministic for a given
 * polyfill + ICU, and the polyfill is imported once, so a cached answer never goes stale.
 *
 * A workaround whose probe passes never runs: behaviour is the polyfill's own. Tests never force a
 * probe; they assert spec-correct outputs that hold either way (CORE-6 spec §4.5).
 */

/** The repro's output, or `ERR <name>: <message>` when it throws. */
export function runRepro(repro: Pick<Repro, "run">): string {
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
  repro: Pick<Repro, "expected">,
  output: string,
): boolean {
  return output === repro.expected;
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
  const present = repros.some(
    (repro) =>
      repro.defect === defect &&
      repro.calendar === calendar &&
      !reproPasses(repro, runRepro(repro)),
  );
  cache.set(key, present);
  return present;
}

/**
 * True when this runtime's `Duration#total({ unit: "month" })` divides the leftover by the wrong
 * month (defect D11). Only a `relativeTo` on the 29th, 30th or 31st can reach it, because only
 * there does adding a month constrain the day. ISO-only: the non-ISO calendars already take the
 * spec path through `isCalendarArithmeticCompatNeeded`.
 */
export function isMonthTotalCompatNeeded(): boolean {
  return isDefectPresent("D11", "iso8601");
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
];

/**
 * True when calendar arithmetic in `calendarId` needs the compat layer in this runtime: any of its
 * add, until or read probes fails (CORE-6 spec §3.6.2). `iso8601` never does, and costs nothing.
 * Callers that own a spec path for a whole operation (zoned differences, `Duration` rounding,
 * totals and comparisons) take it when this is true.
 */
export function isCalendarArithmeticCompatNeeded(calendarId: string): boolean {
  return (
    calendarId !== "iso8601" &&
    ARITHMETIC_DEFECTS.some((defect) => isDefectPresent(defect, calendarId))
  );
}
