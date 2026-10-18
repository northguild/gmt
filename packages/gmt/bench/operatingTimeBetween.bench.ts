import { bench, describe } from "vitest";
import { operatingTimeBetween } from "../src/calendar";
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
});
