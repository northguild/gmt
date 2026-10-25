import { describe } from "vitest";
import {
  cronRuns,
  expandRecurrence,
  parseCronExpression,
  parseRecurrenceRule,
} from "../src/recurrence";
import { bench } from "./fixtures";

// Benchmarks for the recurrence namespace: expansion over a week, a year and ten years, a
// fast-forward from 1970, and the never-matching rules that hit the work cap.

describe("expandRecurrence", () => {
  const zone = "America/New_York";
  const daily = parseRecurrenceRule("FREQ=DAILY")!;
  const window = (from: string, to: string) => ({ start: from, end: to });
  const rows: Array<[string, () => void]> = [
    [
      "expandRecurrence daily, 1 week",
      () =>
        expandRecurrence(
          daily,
          "2024-01-01T09:00:00",
          zone,
          window("2024-01-01T00:00:00Z", "2024-01-08T00:00:00Z"),
        ),
    ],
    [
      "expandRecurrence daily, 1 year",
      () =>
        expandRecurrence(
          daily,
          "2024-01-01T09:00:00",
          zone,
          window("2024-01-01T00:00:00Z", "2025-01-01T00:00:00Z"),
        ),
    ],
    [
      "expandRecurrence daily, 10 years",
      () =>
        expandRecurrence(
          daily,
          "2024-01-01T09:00:00",
          zone,
          window("2024-01-01T00:00:00Z", "2034-01-01T00:00:00Z"),
        ),
    ],
    [
      "expandRecurrence 20th Monday, 10 years",
      () =>
        expandRecurrence(
          parseRecurrenceRule("FREQ=YEARLY;BYDAY=20MO")!,
          "2024-01-01T09:00:00",
          zone,
          window("2024-01-01T00:00:00Z", "2034-01-01T00:00:00Z"),
        ),
    ],
    [
      "expandRecurrence COUNT from 1970",
      () =>
        expandRecurrence(
          parseRecurrenceRule("FREQ=DAILY;COUNT=9000")!,
          "1970-01-01T09:00:00",
          zone,
          window("1994-01-01T00:00:00Z", "1995-01-01T00:00:00Z"),
        ),
    ],
    [
      "expandRecurrence minutely, 1 minute at the New York DST change",
      () =>
        expandRecurrence(
          parseRecurrenceRule("FREQ=MINUTELY")!,
          "2024-01-01T00:00:00",
          zone,
          window("2024-03-10T07:00:00Z", "2024-03-10T07:01:00Z"),
        ),
    ],
    [
      "expandRecurrence never matches",
      () =>
        expandRecurrence(
          parseRecurrenceRule("FREQ=DAILY;BYMONTH=2;BYMONTHDAY=30")!,
          "2024-01-01T09:00:00",
          zone,
          { after: "2024-01-01T00:00:00Z", count: 1 },
        ),
    ],
  ];

  for (const [name, run] of rows) {
    bench(name, run, { time: 500 });
  }
});

describe("cronRuns", () => {
  const zone = "America/New_York";
  const every5 = parseCronExpression("*/5 * * * *")!;
  const nightly = parseCronExpression("30 2 * * *")!;
  const never = parseCronExpression("0 0 30 2 *")!;
  const everyMinute = parseCronExpression("* * * * *")!;
  const rows: Array<[string, () => void]> = [
    [
      "cronRuns every minute, 1 minute at the New York DST change",
      () =>
        cronRuns(
          everyMinute,
          zone,
          { start: "2024-03-10T07:00:00Z", end: "2024-03-10T07:01:00Z" },
          "daemonCatchUp",
        ),
    ],
    [
      "cronRuns every minute, 1 minute in June",
      () =>
        cronRuns(
          everyMinute,
          zone,
          { start: "2024-06-10T07:00:00Z", end: "2024-06-10T07:01:00Z" },
          "daemonCatchUp",
        ),
    ],
    [
      "cronRuns */5, 1 day",
      () =>
        cronRuns(
          every5,
          zone,
          { start: "2024-03-09T00:00:00Z", end: "2024-03-10T00:00:00Z" },
          "crontabMatch",
        ),
    ],
    [
      "cronRuns */5, 1 day over the New York DST change",
      () =>
        cronRuns(
          every5,
          zone,
          { start: "2024-03-10T00:00:00Z", end: "2024-03-11T00:00:00Z" },
          "daemonCatchUp",
        ),
    ],
    [
      "cronRuns 30 2, 1 year",
      () =>
        cronRuns(
          nightly,
          zone,
          { start: "2024-01-01T00:00:00Z", end: "2025-01-01T00:00:00Z" },
          "daemonCatchUp",
        ),
    ],
    [
      "cronRuns 30 2, 10 years",
      () =>
        cronRuns(
          nightly,
          zone,
          { start: "2024-01-01T00:00:00Z", end: "2034-01-01T00:00:00Z" },
          "daemonCatchUp",
        ),
    ],
    [
      "cronRuns never matches",
      () =>
        cronRuns(
          never,
          zone,
          { after: "2024-01-01T00:00:00Z", count: 1 },
          "crontabMatch",
        ),
    ],
  ];

  for (const [name, run] of rows) {
    bench(name, run, { time: 500 });
  }
});
