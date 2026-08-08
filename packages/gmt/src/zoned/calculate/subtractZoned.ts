import { Temporal } from "@js-temporal/polyfill";
import { isValidAmount, resolveOverflow } from "../../internal";
import { isValidDateTimeDurationUnit } from "../../plain/validate";
import type {
  DateTimeDurationUnit,
  Disambiguation,
  Offset,
  Overflow,
} from "../../types";
import { isValidZonedDateTime } from "../validate";

/**
 * Subtract a temporal amount from a zoned ISO 8601 datetime string and return a zoned ISO 8601 string.
 *
 * - Uses Temporal.ZonedDateTime.subtract to subtract duration.
 * - Validates duration units and values.
 * - `disambiguation` controls DST resolution ONLY when the arithmetic result lands on an ambiguous
 *   local time from a fall-back (DST-end) overlap: "compatible" (default), "earlier", "later", or
 *   "reject" (throws, resulting in ""). Has no effect when the result lands in a spring-forward
 *   (DST-start) gap — Temporal's arithmetic always resolves gap landings unambiguously (by advancing
 *   past the gap) before disambiguation is ever evaluated.
 * - `offset` ("prefer" | "use" | "ignore" (default) | "reject") is accepted for API consistency with
 *   sibling zoned-construction functions (see `startOfZoned`, `endOfZoned`, etc.) but has **no effect
 *   here**: the internal rebuild step reconstructs from a plain datetime string with no UTC offset
 *   embedded, so there is never a stored offset for `offset` to prefer/use/ignore/reject against.
 *   `disambiguation` is the only option that affects this function's output.
 * - `overflow` ("constrain" (default) | "reject") controls out-of-range results, e.g. subtracting
 *   1 month from Mar 31: "constrain" clamps to Feb 29/28, "reject" throws (resulting in "").
 * - Returns "" for invalid input.
 *
 * @param value ISO 8601 zoned datetime string
 * @param units Partial<Record<DateTimeDurationUnit, number>> object specifying units to subtract
 * @param optionsArg optional: disambiguation ("compatible" | "earlier" | "later" | "reject"), offset ("prefer" | "use" | "ignore" | "reject" — accepted but inert, see above), overflow ("constrain" | "reject")
 * @returns zoned ISO 8601 string on success, or "" on invalid input
 *
 * @example subtractZoned("2024-03-10T12:00:00-04:00[America/New_York]", { days: 5 }) // "2024-03-05T12:00:00-05:00[America/New_York]"
 * @example subtractZoned("invalid", { days: 5 }) // ""
 * @example subtractZoned("2024-11-04T01:30:00-05:00[America/New_York]", { days: 1 }, { disambiguation: "later" }) // "2024-11-03T01:30:00-05:00[America/New_York]" (fall-back overlap resolved; default "compatible" would return the -04:00 instant instead)
 * @example subtractZoned("2024-11-04T01:30:00-05:00[America/New_York]", { days: 1 }, { disambiguation: "reject" }) // "" (fall-back overlap rejected)
 * @example subtractZoned("2024-03-11T03:30:00-04:00[America/New_York]", { days: 1 }, { disambiguation: "reject" }) // "2024-03-10T03:30:00-04:00[America/New_York]" (spring-forward gap — disambiguation has no effect, arithmetic already advanced past it, so "reject" does not throw here)
 * @example subtractZoned("2024-03-31T12:00:00-04:00[America/New_York]", { months: 1 }, { overflow: "reject" }) // ""
 */
export function subtractZoned(
  value: string,
  units: Partial<Record<DateTimeDurationUnit, number>>,
  optionsArg?: {
    disambiguation?: Disambiguation;
    offset?: Offset;
    overflow?: Overflow;
  },
): string {
  const validZonedDateTime = isValidZonedDateTime(value);
  const validUnits = Object.keys(units).every(isValidDateTimeDurationUnit);
  const validAmounts = Object.values(units).every(isValidAmount);

  if (!validZonedDateTime || !validUnits || !validAmounts) {
    return "";
  }

  const disambiguation = optionsArg?.disambiguation ?? "compatible";
  const offset = optionsArg?.offset ?? "ignore";
  const overflow = resolveOverflow(optionsArg?.overflow);

  try {
    const zoned = Temporal.ZonedDateTime.from(value);
    const subtracted = zoned.subtract(units, { overflow });

    if (disambiguation === "compatible") {
      return subtracted.toString();
    }

    const plainDateTime = subtracted.toPlainDateTime().toString();
    const resolved = Temporal.ZonedDateTime.from(
      `${plainDateTime}[${subtracted.timeZoneId}]`,
      { disambiguation, offset },
    );
    return resolved.toString();
  } catch {
    return "";
  }
}
