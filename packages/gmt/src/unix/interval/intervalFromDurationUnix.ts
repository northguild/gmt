import { Temporal } from "@js-temporal/polyfill";
import { isValidDuration } from "../../duration/validate";
import { resolveOverflow } from "../../internal";
import { resolveUnixTimeZone } from "../../internal/resolveUnixTimeZone";
import type { Overflow } from "../../types";

/**
 * Construct a Unix epoch interval from a single point plus an ISO 8601 duration, anchored at either end.
 *
 * - `anchor: "start"` treats `value` as the interval start and adds `duration` to get the end.
 * - `anchor: "end"` treats `value` as the interval end and subtracts `duration` to get the start.
 * - Converts to `ZonedDateTime` (system timeZone by default, consistent with `addUnix`), adds/subtracts
 *   the duration there, then converts back to epoch — this is what lets calendar units (years/months/
 *   weeks/days) resolve without a `relativeTo`: unlike a bare `Temporal.Instant`, the `ZonedDateTime`
 *   supplies its own implicit reference point.
 * - A negative `duration` (e.g. `"-P1D"`) can invert the computed span; returns null when that
 *   happens, mirroring `intervalIntersectionUnix`'s `start > end` rejection.
 * - `overflow` ("constrain" (default) | "reject") controls out-of-range results, e.g. adding 1 month
 *   to Jan 31: "constrain" clamps to Feb 29/28, "reject" returns null.
 * - Returns null on invalid input (non-finite/non-integer `value`, invalid `duration`, an `anchor`
 *   other than `"start"`/`"end"`, or an invalid/unavailable timeZone).
 *
 * @param value Unix epoch value (seconds or milliseconds)
 * @param duration ISO 8601 duration string
 * @param anchor "start" | "end" — which endpoint `value` represents
 * @param options optional: epochUnit ("seconds" | "milliseconds"), timeZone (IANA), overflow ("constrain" | "reject")
 * @returns `{ start, end }` with the constructed span (epoch numbers), or null on invalid input
 *
 * @example intervalFromDurationUnix(1704067200000, "P1D", "start", { timeZone: "UTC" }) // { start: 1704067200000, end: 1704153600000 }
 * @example intervalFromDurationUnix(1704153600000, "P1D", "end", { timeZone: "UTC" }) // { start: 1704067200000, end: 1704153600000 }
 * @example intervalFromDurationUnix(1706659200000, "P1M", "start", { timeZone: "UTC", overflow: "reject" }) // null (Jan 31 + 1 month overflows)
 * @example intervalFromDurationUnix(1704067200000, "-P10D", "start", { timeZone: "UTC" }) // null (inverted span)
 * @example intervalFromDurationUnix(NaN, "P1D", "start") // null
 */
export function intervalFromDurationUnix(
  value: number | string,
  duration: string,
  anchor: "start" | "end",
  options?: {
    epochUnit?: "seconds" | "milliseconds";
    timeZone?: string;
    overflow?: Overflow;
  },
): { start: number; end: number } | null {
  if (typeof value !== "number" && typeof value !== "string") {
    return null;
  }

  const valueMs = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(valueMs) || !Number.isInteger(valueMs)) {
    return null;
  }

  if (!isValidDuration(duration)) {
    return null;
  }

  if (anchor !== "start" && anchor !== "end") {
    return null;
  }

  const epochUnit = options?.epochUnit ?? "milliseconds";
  const timeZone = resolveUnixTimeZone(options?.timeZone);

  if (!timeZone) {
    return null;
  }

  try {
    const instant = Temporal.Instant.fromEpochMilliseconds(
      epochUnit === "seconds" ? valueMs * 1000 : valueMs,
    );
    const point = instant.toZonedDateTimeISO(timeZone);
    const dur = Temporal.Duration.from(duration);
    const overflow = resolveOverflow(options?.overflow);

    const other =
      anchor === "start"
        ? point.add(dur, { overflow })
        : point.subtract(dur, { overflow });

    const start = anchor === "start" ? point : other;
    const end = anchor === "start" ? other : point;

    if (Temporal.ZonedDateTime.compare(start, end) > 0) {
      return null;
    }

    const toEpoch = (zdt: Temporal.ZonedDateTime) =>
      epochUnit === "seconds"
        ? Math.floor(zdt.epochMilliseconds / 1000)
        : zdt.epochMilliseconds;

    return { start: toEpoch(start), end: toEpoch(end) };
  } catch {
    return null;
  }
}
