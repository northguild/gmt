import type { Temporal } from "@js-temporal/polyfill";

export const isValidDateTimeUnit = (
  unit: string,
): unit is Temporal.DateTimeUnit => {
  return (
    unit === "year" ||
    unit === "month" ||
    unit === "week" ||
    unit === "day" ||
    unit === "hour" ||
    unit === "minute" ||
    unit === "second" ||
    unit === "millisecond" ||
    unit === "microsecond" ||
    unit === "nanosecond"
  );
};
