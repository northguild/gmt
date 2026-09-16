import {
  DEFAULT_BUSINESS_CALENDAR,
  stepBusinessDates,
} from "./businessCalendar";
import { plainToZoned, zonedWithPlainTime } from "./zonedWallClockOperations";
import { zonedDateTimeFrom } from "./zonedWallClock";

export function adjustZonedBusinessDays(
  value: string,
  direction: 1 | -1,
  absAmount: number,
): string {
  try {
    const zoned = zonedDateTimeFrom(value);
    const plainDate = zoned.toPlainDate();
    const resultDate = stepBusinessDates(
      plainDate,
      direction,
      absAmount,
      DEFAULT_BUSINESS_CALENDAR,
    );

    if (resultDate === null) {
      return "";
    }

    const resultZoned = zonedWithPlainTime(
      plainToZoned(resultDate, zoned.timeZoneId),
      zoned.toPlainTime(),
    );
    return resultZoned.toString();
  } catch {
    return "";
  }
}
