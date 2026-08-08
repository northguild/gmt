import { Temporal } from "@js-temporal/polyfill";
import { isValidAmount } from "../../internal";
import { isValidDateTimeDurationUnit } from "../../plain/validate";
import type { DateTimeDurationUnit, Disambiguation } from "../../types";
import { isValidZonedDateTime } from "../validate";

/**
 * Add a temporal amount to a zoned ISO 8601 datetime string and return a zoned ISO 8601 string.
 *
 * - Uses Temporal.ZonedDateTime.add to add duration.
 * - Validates duration units and values.
 * - `disambiguation` controls DST resolution ONLY when the arithmetic result lands on an ambiguous
 *   local time from a fall-back (DST-end) overlap: "compatible" (default), "earlier", "later", or
 *   "reject" (throws, resulting in ""). Has no effect when the result lands in a spring-forward
 *   (DST-start) gap — Temporal's arithmetic always resolves gap landings unambiguously (by advancing
 *   past the gap) before disambiguation is ever evaluated.
 * - Returns "" for invalid input.
 *
 * @param value ISO 8601 zoned datetime string
 * @param units Partial<Record<DateTimeDurationUnit, number>> object specifying units to add
 * @param optionsArg optional: disambiguation ("compatible" | "earlier" | "later" | "reject")
 * @returns zoned ISO 8601 string on success, or "" on invalid input
 *
 * @example addZoned("2024-02-29T14:30:45.123-05:00[America/New_York]", { days: 1 }) // "2024-03-01T14:30:45.123-05:00[America/New_York]"
 * @example addZoned("invalid", { days: 1 }) // ""
 * @example addZoned("2024-11-02T01:30:00-04:00[America/New_York]", { days: 1 }, { disambiguation: "later" }) // "2024-11-03T01:30:00-05:00[America/New_York]" (fall-back overlap resolved; default "compatible" would return the -04:00 instant instead)
 * @example addZoned("2024-11-02T01:30:00-04:00[America/New_York]", { days: 1 }, { disambiguation: "reject" }) // "" (fall-back overlap rejected)
 * @example addZoned("2024-03-09T02:30:00-05:00[America/New_York]", { days: 1 }, { disambiguation: "reject" }) // "2024-03-10T03:30:00-04:00[America/New_York]" (spring-forward gap — disambiguation has no effect, arithmetic already advanced past it, so "reject" does not throw here)
 */
export function addZoned(
  value: string,
  units: Partial<Record<DateTimeDurationUnit, number>>,
  optionsArg?: { disambiguation?: Disambiguation },
): string {
  const validZonedDateTime = isValidZonedDateTime(value);
  const validUnits = Object.keys(units).every(isValidDateTimeDurationUnit);
  const validAmounts = Object.values(units).every(isValidAmount);

  if (!validZonedDateTime || !validUnits || !validAmounts) {
    // TODO descriptive messages of what failed - likely could be GMT offset for historical changes and DST
    return "";
  }

  const disambiguation = optionsArg?.disambiguation ?? "compatible";

  try {
    const zoned = Temporal.ZonedDateTime.from(value);
    const added = zoned.add(units);

    if (disambiguation === "compatible") {
      return added.toString();
    }

    const plainDateTime = added.toPlainDateTime().toString();
    const resolved = Temporal.ZonedDateTime.from(
      `${plainDateTime}[${added.timeZoneId}]`,
      { disambiguation },
    );
    return resolved.toString();
  } catch {
    return "";
  }
}
