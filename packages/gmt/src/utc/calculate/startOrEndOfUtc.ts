import { Temporal } from "@js-temporal/polyfill";
import { isValidDateTimeUnit } from "../../plain";
import type { FractionalDigit } from "../../types";
import { isValidUtc } from "../validate/isValidUtc";

export function startOrEndOfUtc(
  value: string,
  unit: Temporal.DateUnit | Temporal.TimeUnit,
  options: {
    weekStartsOn?: "monday" | "sunday";
    fractionalSecondDigits?: FractionalDigit;
  },
  isEnd: boolean,
): string {
  const weekStartsOn = options.weekStartsOn ?? "monday";
  const fractionalSecondDigits = options.fractionalSecondDigits;

  if (!isValidUtc(value) || !isValidDateTimeUnit(unit)) return "";

  try {
    const instant = Temporal.Instant.from(value);
    const source = instant.toZonedDateTimeISO("UTC");
    let result: Temporal.ZonedDateTime;

    switch (unit) {
      case "year":
        result = isEnd
          ? source.with({ month: 12, day: 31 }).withPlainTime({
              hour: 23,
              minute: 59,
              second: 59,
              millisecond: 999,
              microsecond: 999,
              nanosecond: 999,
            })
          : source.with({ month: 1, day: 1 }).withPlainTime();
        break;
      case "month":
        result = isEnd
          ? source
              .with({
                day: Temporal.PlainDate.from({
                  year: source.year,
                  month: source.month,
                  day: 1,
                }).daysInMonth,
              })
              .withPlainTime({
                hour: 23,
                minute: 59,
                second: 59,
                millisecond: 999,
                microsecond: 999,
                nanosecond: 999,
              })
          : source.with({ day: 1 }).withPlainTime();
        break;
      case "week": {
        const daysToSubtract =
          weekStartsOn === "monday"
            ? source.dayOfWeek - 1
            : source.dayOfWeek % 7;
        result = isEnd
          ? source
              .subtract({ days: daysToSubtract })
              .add({ days: 6 })
              .withPlainTime({
                hour: 23,
                minute: 59,
                second: 59,
                millisecond: 999,
                microsecond: 999,
                nanosecond: 999,
              })
          : source.subtract({ days: daysToSubtract }).withPlainTime();
        break;
      }
      case "day":
        result = isEnd
          ? source.withPlainTime({
              hour: 23,
              minute: 59,
              second: 59,
              millisecond: 999,
              microsecond: 999,
              nanosecond: 999,
            })
          : source.withPlainTime();
        break;
      case "hour":
        result = isEnd
          ? source.with({
              minute: 59,
              second: 59,
              millisecond: 999,
              microsecond: 999,
              nanosecond: 999,
            })
          : source.with({
              minute: 0,
              second: 0,
              millisecond: 0,
              microsecond: 0,
              nanosecond: 0,
            });
        break;
      case "minute":
        result = isEnd
          ? source.with({
              second: 59,
              millisecond: 999,
              microsecond: 999,
              nanosecond: 999,
            })
          : source.with({
              second: 0,
              millisecond: 0,
              microsecond: 0,
              nanosecond: 0,
            });
        break;
      case "second":
        result = isEnd
          ? source.with({ millisecond: 999, microsecond: 999, nanosecond: 999 })
          : source.with({ millisecond: 0, microsecond: 0, nanosecond: 0 });
        break;
      case "millisecond":
        result = isEnd
          ? source.with({ microsecond: 999, nanosecond: 999 })
          : source.with({ microsecond: 0, nanosecond: 0 });
        break;
      case "microsecond":
        result = isEnd
          ? source.with({ nanosecond: 999 })
          : source.with({ nanosecond: 0 });
        break;
      case "nanosecond":
        result = source;
        break;
      default:
        return "";
    }

    const precisionMap: Record<string, FractionalDigit> = {
      millisecond: 3,
      microsecond: 6,
      nanosecond: 9,
    };
    const fractionalDigits =
      fractionalSecondDigits ?? (precisionMap[unit] || 0);

    return result
      .toInstant()
      .toString({ fractionalSecondDigits: fractionalDigits });
  } catch {
    return "";
  }
}
