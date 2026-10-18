import { bench, describe } from "vitest";
import { formatDate, getLocaleMonthNames } from "../src/plain";

// One locale, repeated: the formatter is the cost.
describe("formatDate and getLocaleMonthNames", () => {
  bench(
    "formatDate, de-DE",
    () => {
      formatDate("2024-03-15", "de-DE", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    },
    { time: 500 },
  );
  bench(
    "getLocaleMonthNames, de-DE",
    () => {
      getLocaleMonthNames("de-DE", "long");
    },
    { time: 500 },
  );
});
