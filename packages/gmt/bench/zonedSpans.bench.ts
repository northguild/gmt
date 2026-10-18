import { Temporal } from "../src/internal/temporal";
import { bench, describe } from "vitest";
import { dwellTime } from "../src/transport";
import {
  intervalCountZoned,
  intervalOverlappingDaysZoned,
  intervalSplitAtZoned,
} from "../src/zoned";

// Slice 10 fixes the loops these exercise.
const ZONE = "Europe/London";
// The string carries the zone's real offset for that date: a wrong one is invalid input.
const zoned = (date: string) =>
  Temporal.PlainDate.from(date).toZonedDateTime(ZONE).toString();
const START = zoned("2024-01-01");
const years: Array<[string, number]> = [
  ["1 year", 1],
  ["10 years", 10],
  ["100 years", 100],
];

describe("intervalCountZoned", () => {
  for (const unit of ["day", "hour", "month"]) {
    for (const [name, n] of years) {
      // An hour count over 100 years is the slowest row; the library caps it.
      const end = zoned(
        Temporal.PlainDate.from("2024-01-01").add({ years: n }).toString(),
      );
      bench(
        `${unit}, ${name}`,
        () => {
          intervalCountZoned(START, end, unit);
        },
        { time: 500 },
      );
    }
  }
});

describe("intervalOverlappingDaysZoned", () => {
  for (const [name, n] of years) {
    const end = zoned(
      Temporal.PlainDate.from("2024-01-01").add({ years: n }).toString(),
    );
    bench(
      name,
      () => {
        intervalOverlappingDaysZoned(START, end, START, end);
      },
      { time: 500 },
    );
  }
});

describe("dwellTime", () => {
  for (const [name, n] of years) {
    const exit = `${Temporal.PlainDate.from("2024-01-01").add({ years: n }).toString()}T00:00:00Z`;
    bench(
      name,
      () => {
        dwellTime("2024-01-01T00:00:00Z", exit, ZONE);
      },
      { time: 500 },
    );
  }
});

describe("intervalSplitAtZoned", () => {
  const end = zoned("2124-01-01");
  for (const count of [100, 1000]) {
    // Points spread over the 100 years, in reverse so the sort has work.
    const step = Math.floor((100 * 365) / count);
    const points = Array.from({ length: count }, (_, i) =>
      zoned(
        Temporal.PlainDate.from("2024-01-01")
          .add({ days: (count - i) * step - 1 })
          .toString(),
      ),
    );
    bench(
      `${count} points`,
      () => {
        intervalSplitAtZoned(START, end, points);
      },
      { time: 500 },
    );
  }
});
