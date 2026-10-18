import { bench, describe } from "vitest";
import { bucketRange } from "../src/calendar";
import { utcMidnight } from "./fixtures";

// Exercises `certainlyTouchesMoreBuckets` (slice 5).
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
