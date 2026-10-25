import { type BenchRunOptions, test } from "vitest";
import { Temporal } from "../src/internal/temporal";
import type {
  BusinessCalendar,
  DutyEntry,
  DutyRule,
  OperatingSchedule,
} from "../src/types";

/**
 * Inputs for the benchmarks, the audit's shapes (perf-and-bundle-size-audit, appendix). Each is
 * generated from integers so a fixture costs nothing to describe and nothing to keep.
 */

const HOUR_MS = 3_600_000;

/** An ISO date string `days` after `start`. */
export function addDaysTo(start: string, days: number): string {
  return Temporal.PlainDate.from(start).add({ days }).toString();
}

/** An instant string `days` after `start`, a UTC midnight. */
export function utcMidnight(start: string, days: number): string {
  return `${addDaysTo(start, days)}T00:00:00Z`;
}

/**
 * A repeating 24-hour day: 10 h off, 1 h on, 5 h driving, 0.5 h off, 5.5 h driving, 2 h on,
 * from 2024-01-01T00:00:00Z, `days` days long.
 */
export function dutyLog(days: number): DutyEntry[] {
  const day: Array<[string, number]> = [
    ["off", 10],
    ["on", 1],
    ["driving", 5],
    ["off", 0.5],
    ["driving", 5.5],
    ["on", 2],
  ];
  const origin = Temporal.Instant.from(
    "2024-01-01T00:00:00Z",
  ).epochMilliseconds;
  const log: DutyEntry[] = [];
  let cursor = origin;
  for (let d = 0; d < days; d += 1) {
    for (const [status, hours] of day) {
      const next = cursor + hours * HOUR_MS;
      log.push({
        status,
        start: Temporal.Instant.fromEpochMilliseconds(cursor).toString(),
        end: Temporal.Instant.fromEpochMilliseconds(next).toString(),
      });
      cursor = next;
    }
  }
  return log;
}

/** An 11-hour driving cap that resets after 10 hours off. */
export const drivingCap: DutyRule[] = [
  {
    label: "11 driving",
    kind: "cumulativeCap",
    statuses: ["driving"],
    cap: "PT11H",
    since: { statuses: ["off"], consecutive: "PT10H" },
  },
];

/** The range a log of `days` days covers. */
export function dutyRange(days: number): { start: string; end: string } {
  return {
    start: "2024-01-01T00:00:00Z",
    end: utcMidnight("2024-01-01", days),
  };
}

/** 480 holidays: the 15th of each month over 2020-2059. */
export const holidays480: string[] = Array.from({ length: 480 }, (_, i) => {
  const year = 2020 + Math.floor(i / 12);
  const month = String((i % 12) + 1).padStart(2, "0");
  return `${year}-${month}-15`;
});

/** Mon-Fri 09:00-17:00, Wednesday split 09:00-12:00 and 13:00-17:00, `Europe/London`. */
export const londonSchedule: OperatingSchedule = {
  timeZone: "Europe/London",
  weekly: {
    1: [{ from: "09:00", to: "17:00" }],
    2: [{ from: "09:00", to: "17:00" }],
    3: [
      { from: "09:00", to: "12:00" },
      { from: "13:00", to: "17:00" },
    ],
    4: [{ from: "09:00", to: "17:00" }],
    5: [{ from: "09:00", to: "17:00" }],
  },
};

/** A Monday-Friday business calendar with `holidays` (none, or the 480). */
export function businessCalendar(holidays: string[]): BusinessCalendar {
  return { weekend: [6, 7], holidays, timeZone: "Europe/London" };
}

/** The free-time clock start the audit used. */
export const freeTimeStart = "2024-06-14T19:00:00Z";

/**
 * One benchmark row. Vitest 5 has no top-level `bench`: a row is a `test` that takes the `bench`
 * fixture and runs it, so this keeps the call shape the files had.
 */
export function bench(
  name: string,
  fn: () => void,
  options: BenchRunOptions,
): void {
  test(name, async ({ bench: register }) => {
    await register(name, fn).run(options);
  });
}
