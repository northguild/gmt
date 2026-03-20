import { Temporal } from "@js-temporal/polyfill";
import { isValidAmount } from "../../internal";
import { isValidDateTimeUnit } from "../../plain/validate";
import { isValidZonedDateTime } from "../validate";

export function subtractZoned(
  value: string,
  amount: number,
  unit: Temporal.DateTimeUnit,
): string {
  if (
    !isValidZonedDateTime(value) ||
    !isValidAmount(amount) ||
    !isValidDateTimeUnit(unit)
  ) {
    return "";
  }

  try {
    const zoned = Temporal.ZonedDateTime.from(value);
    return zoned.subtract({ [`${unit}s`]: amount }).toString();
  } catch {
    return "";
  }
}
