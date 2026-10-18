import { bench, describe } from "vitest";
import { addOperatingTime, operatingTimeBetween } from "../src/calendar";
import { clearTransitionMemo } from "../src/internal/zonedTransitionSearch";
import { londonSchedule, utcMidnight } from "./fixtures";

describe("operatingTimeBetween, Europe/London", () => {
  const rows: Array<[string, number]> = [
    ["1 week", 7],
    ["1 year", 365],
    ["10 years", 3652],
  ];
  for (const [name, days] of rows) {
    const end = utcMidnight("2024-01-01", days);
    bench(
      name,
      () => {
        operatingTimeBetween("2024-01-01T00:00:00Z", end, londonSchedule);
      },
      { time: 500 },
    );
  }

  // Cold clears the transition memo at the start of each call, so every search runs uncached;
  // the rows above reuse what the previous call left.
  const coldEnd = utcMidnight("2024-01-01", 3652);
  bench(
    "10 years cold",
    () => {
      clearTransitionMemo();
      operatingTimeBetween("2024-01-01T00:00:00Z", coldEnd, londonSchedule);
    },
    { time: 500 },
  );
});

describe("addOperatingTime, Europe/London", () => {
  bench(
    "400 hours",
    () => {
      addOperatingTime("2024-01-01T09:00:00Z", "PT400H", londonSchedule);
    },
    { time: 500 },
  );
});
