import type { Temporal } from "@js-temporal/polyfill";

export const isValidTimeUnit = (unit: string): unit is Temporal.TimeUnit => {
  return (
    unit === "hour" ||
    unit === "minute" ||
    unit === "second" ||
    unit === "millisecond" ||
    unit === "microsecond" ||
    unit === "nanosecond"
  );
};
