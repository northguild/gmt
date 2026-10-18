import { bench, describe } from "vitest";
import { bucketRange } from "../src/calendar";
import { clearTransitionMemo } from "../src/internal/zonedTransitionSearch";
import { utcMidnight } from "./fixtures";

// Exercises `certainlyTouchesMoreBuckets`.
describe("bucketRange by day", () => {
  for (const timeZone of ["Asia/Kolkata", "Europe/London"]) {
    for (const start of ["1900-01-01", "2400-01-01"]) {
      for (const days of [1, 365, 10_001]) {
        const from = `${start}T00:00:00Z`;
        const to = utcMidnight(start, days);
        bench(
          `${timeZone}, from ${start}, ${days} d`,
          () => {
            bucketRange(from, to, "day", timeZone);
          },
          { time: 500 },
        );
      }
    }
  }
});

// A 40-year range is 14,610 days: past the 10,000-bucket cap by more than the pre-check's two-day
// margin, so `certainlyTouchesMoreBuckets` refuses it from the zone's transitions without a walk.
// Cold clears the transition memo inside every call (one `Map.clear`, nothing next to the search); warm leaves it filled by the one before.
describe("bucketRange by day, a 40-year range refused by the pre-check", () => {
  const rows: Array<[string, string]> = [
    ["Asia/Kolkata", "1900-01-01"],
    ["Europe/London", "1900-01-01"],
    ["Europe/London", "2400-01-01"],
  ];
  for (const [timeZone, start] of rows) {
    const from = `${start}T00:00:00Z`;
    const to = utcMidnight(start, 14_610);
    bench(
      `${timeZone}, from ${start}, 40 y cold`,
      () => {
        clearTransitionMemo();
        bucketRange(from, to, "day", timeZone);
      },
      { time: 500 },
    );
    bench(
      `${timeZone}, from ${start}, 40 y warm`,
      () => {
        bucketRange(from, to, "day", timeZone);
      },
      { time: 500 },
    );
  }
});
