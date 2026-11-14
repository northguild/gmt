import { describe } from "vitest";
import { clearFormatterCache } from "../src/internal/formatterCache";
import { formatDate, getLocaleMonthNames } from "../src/plain";
import { bench } from "./fixtures";

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

// CORE-112: the week-year guard. `en` is the dormant path (the native formatter, unchanged); `gd`
// prints the week-year in CLDR 48, so its formatter is a guarded stand-in whose `format` repairs
// the year. The first call pays the verdict once per pattern; a repeat call pays the repair only.
describe("formatDate, week-year guard", () => {
  const options = { year: "numeric", month: "short" } as const;
  bench(
    "formatDate gd first call",
    () => {
      clearFormatterCache();
      formatDate("2024-12-30", "gd", options);
    },
    { time: 500 },
  );
  bench(
    "formatDate gd cached",
    () => {
      formatDate("2024-12-30", "gd", options);
    },
    { time: 500 },
  );
  bench(
    "formatDate en cached",
    () => {
      formatDate("2024-12-30", "en", options);
    },
    { time: 500 },
  );
});
