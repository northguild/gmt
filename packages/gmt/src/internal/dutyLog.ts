import { parseInstantNanoseconds } from "./instantNanoseconds";
import { isObject } from "./isObject";

/** A `DutyEntry` parsed once: its status and its bounds as epoch nanoseconds. */
export type DutyLogEntry = { status: string; start: bigint; end: bigint };

/** A maximal stretch of touching entries in a set of statuses, `[start, end)`. */
export type DutyRun = { start: bigint; end: bigint };

/**
 * Parse a candidate duty log, all-or-nothing.
 *
 * - An entry is any object whose `status` is a string and whose `start` and `end` are ISO 8601
 *   instant strings with `start` before `end`; extra keys are ignored (GMT rule: the type is
 *   structural). Each field is read once.
 * - Entries must be ordered by `start` and must not overlap: one may start where the previous
 *   ends (half-open), or later.
 *
 * @param value candidate array of `{ status, start, end }` records
 * @returns the parsed entries in order, or null when `value` is not a valid duty log
 *
 * @example parseDutyLog([{ status: "off", start: "1970-01-01T00:00:00Z", end: "1970-01-01T00:00:00.000000002Z" }]) // [{ status: "off", start: 0n, end: 2n }]
 * @example parseDutyLog([{ status: "off", start: "1970-01-01T00:00:00Z", end: "1970-01-01T00:00:00Z" }]) // null — zero length
 */
export function parseDutyLog(value: unknown): DutyLogEntry[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const entries: DutyLogEntry[] = [];
  const length = value.length;

  for (let index = 0; index < length; index++) {
    const candidate: unknown = value[index];

    if (!isObject(candidate)) {
      return null;
    }

    const { status, start, end } = candidate as {
      status?: unknown;
      start?: unknown;
      end?: unknown;
    };

    if (
      typeof status !== "string" ||
      typeof start !== "string" ||
      typeof end !== "string"
    ) {
      return null;
    }

    const startNs = parseInstantNanoseconds(start);
    const endNs = parseInstantNanoseconds(end);
    const previous = entries[entries.length - 1];

    if (
      startNs === null ||
      endNs === null ||
      endNs <= startNs ||
      (previous !== undefined && startNs < previous.end)
    ) {
      return null;
    }

    entries.push({ status, start: startNs, end: endNs });
  }

  return entries;
}
