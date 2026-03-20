import type { Temporal } from "@js-temporal/polyfill";

export const isValidDateUnit = (unit: string): unit is Temporal.DateUnit => {
  return (
    unit === "year" || unit === "month" || unit === "week" || unit === "day"
  );
};
