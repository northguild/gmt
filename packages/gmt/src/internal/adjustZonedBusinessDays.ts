import { advanceBusinessDays } from "./advanceBusinessDays";
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
    const resultDate = advanceBusinessDays(plainDate, direction, absAmount);

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
