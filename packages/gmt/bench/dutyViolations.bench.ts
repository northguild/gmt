import { describe } from "vitest";
import { dutyViolations } from "../src/workforce";
import { type DutyStep, dutySequence } from "../src/test";
import type { DutyEntry, DutyRule } from "../src/types";
import { bench, drivingCap, dutyLog, dutyRange, utcMidnight } from "./fixtures";

const label = (days: number) => (days === 3650 ? "10 y log" : `${days} d log`);

describe("dutyViolations", () => {
  for (const days of [7, 90, 365, 3650]) {
    const log = dutyLog(days);
    const range = dutyRange(days);
    bench(
      label(days),
      () => {
        dutyViolations(log, range, drivingCap, { timeZone: "UTC" });
      },
      { time: 500 },
    );
  }
});

/**
 * A split-sleeper day that never has a 10 h rest: 5 h driving, 2 h off, 5 h driving, 3 h off, 4 h
 * on, 5 h off. Every rest is a half of a pair, so the pair search reads a whole log's runs.
 */
function splitSleeperLog(days: number): DutyEntry[] {
  const day: DutyStep[] = [
    ["driving", "PT5H"],
    ["off", "PT2H"],
    ["driving", "PT5H"],
    ["off", "PT3H"],
    ["on", "PT4H"],
    ["off", "PT5H"],
  ];

  return dutySequence(
    "2024-01-01T00:00:00Z",
    Array.from({ length: days }, () => day).flat(),
  );
}

const splitSleeperRule: DutyRule[] = [
  {
    label: "14 h window with split sleeper",
    kind: "elapsedWindow",
    startStatuses: ["driving"],
    length: "PT14H",
    restrictedStatuses: ["driving"],
    since: { statuses: ["off"], consecutive: "PT10H" },
    exclude: {
      eachAtLeast: "PT2H",
      oneAtLeast: "PT3H",
      combinedAtLeast: "PT5H",
    },
  },
];

describe("dutyViolations, split sleeper", () => {
  for (const days of [90, 365, 3650]) {
    const log = splitSleeperLog(days);
    const range = dutyRange(days);
    bench(
      label(days),
      () => {
        dutyViolations(log, range, splitSleeperRule, { timeZone: "UTC" });
      },
      { time: 500 },
    );
  }
});

/** One use a day, at midnight: every 7-day window holds seven, and no 34 h rest restores it. */
function usageRule(days: number): DutyRule[] {
  return [
    {
      label: "one use in 7 days",
      kind: "usageLookback",
      uses: Array.from({ length: days }, (_, d) =>
        utcMidnight("2024-01-01", d),
      ),
      notWithin: { calendarDays: 7 },
      reset: { statuses: ["off"], consecutive: "PT34H" },
    },
  ];
}

describe("dutyViolations, usage lookback", () => {
  for (const days of [90, 365, 3650]) {
    const log = dutyLog(days);
    const range = dutyRange(days);
    const rules = usageRule(days);
    bench(
      label(days),
      () => {
        dutyViolations(log, range, rules, { timeZone: "UTC" });
      },
      { time: 500 },
    );
  }
});
