import { Temporal } from "@js-temporal/polyfill";
import { advanceBusinessDays } from "./advanceBusinessDays";

export function adjustZonedBusinessDays(
  value: string,
  direction: 1 | -1,
  absAmount: number,
): string {
  try {
    const zoned = Temporal.ZonedDateTime.from(value);
    const plainDate = zoned.toPlainDate();
    const resultDate = advanceBusinessDays(plainDate, direction, absAmount);
    const resultZoned = resultDate
      .toZonedDateTime(zoned.timeZoneId)
      .withPlainTime(zoned.toPlainTime());
    return resultZoned.toString();
  } catch {
    return "";
  }
}
