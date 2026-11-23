import { clearHolidayMemo } from "../../internal/businessCalendar";
import {
  mockTemporalPlainDateFromThrow,
  mockTemporalPlainTimeFromThrow,
} from "../../test/mocks";
import {
  ACCEPTED_SCHEDULES,
  CLOSED_SCHEDULES,
  HOSTILE_SCHEDULES,
  OPEN_RANGE,
  REJECTED_SCHEDULES,
  nineToFive,
  valid,
} from "../../test/operatingScheduleRows";
import { operatingIntervals } from "../hours/operatingIntervals";
import { isValidOperatingSchedule } from "./isValidOperatingSchedule";

describe("isValidOperatingSchedule", () => {
  it.each(ACCEPTED_SCHEDULES)(
    "accepts a schedule with $reads",
    ({ schedule }) => {
      expect(isValidOperatingSchedule(schedule)).toBe(true);
    },
  );

  it.each(CLOSED_SCHEDULES)(
    "accepts a schedule that is closed throughout, with $reads",
    ({ schedule }) => {
      expect(isValidOperatingSchedule(schedule)).toBe(true);
    },
  );

  it.each(REJECTED_SCHEDULES)(
    "refuses a schedule with $reads",
    ({ schedule }) => {
      expect(isValidOperatingSchedule(schedule)).toBe(false);
    },
  );

  it.each(HOSTILE_SCHEDULES)(
    "returns false, never throws, for $reads",
    ({ make }) => {
      expect(isValidOperatingSchedule(make())).toBe(false);
    },
  );

  // Each @example in the JSDoc, with the reason it gives.
  it.each`
    schedule                                                                                                                                            | expected | reads
    ${{ timeZone: "Europe/Paris", weekly: { 1: [{ from: "09:00", to: "17:00" }] } }}                                                                    | ${true}  | ${"a Paris Monday"}
    ${{ timeZone: "UTC", weekly: { 5: [{ from: "23:00", to: "06:00" }] }, holidays: ["2024-11-20"], overrides: [{ date: "2024-11-19", windows: [] }] }} | ${true}  | ${"a window past midnight, a holiday and an override"}
    ${{ timeZone: "-00:44:30", weekly: {} }}                                                                                                            | ${true}  | ${"a closed schedule in a seconds offset"}
    ${{ timeZone: "UTC", weekly: { 8: [] } }}                                                                                                           | ${false} | ${"weekday 8 in the example"}
    ${{ timeZone: "UTC", weekly: { 1: [{ from: "09:00", to: "24:00" }] } }}                                                                             | ${false} | ${"24:00 in the example"}
    ${{ timeZone: "UTC", weekly: {}, holidays: ["2024-05-15[u-ca=iso8601]"] }}                                                                          | ${false} | ${"an annotated holiday in the example"}
    ${{ timeZone: "UTC", weekly: {}, overrides: [{ date: "2024-06-10", windows: [] }, { date: "+002024-06-10", windows: [] }] }}                        | ${false} | ${"two overrides for one date in the example"}
    ${{ timeZone: "Invalid/Zone", weekly: {} }}                                                                                                         | ${false} | ${"an invalid zone in the example"}
    ${null}                                                                                                                                             | ${false} | ${"null in the example"}
  `("returns $expected for $reads", ({ schedule, expected }) => {
    expect(isValidOperatingSchedule(schedule)).toBe(expected);
  });

  it("returns false when Temporal.PlainTime.from throws", () => {
    mockTemporalPlainTimeFromThrow();
    expect(isValidOperatingSchedule(valid)).toBe(false);
    vi.restoreAllMocks();
  });

  it("returns false when Temporal.PlainDate.from throws", () => {
    // The holiday memo would answer without calling `from`; start it empty.
    clearHolidayMemo();
    mockTemporalPlainDateFromThrow();
    expect(
      isValidOperatingSchedule({ ...valid, holidays: ["2031-01-01"] }),
    ).toBe(false);
    vi.restoreAllMocks();
  });

  it("agrees with operatingIntervals on every row", () => {
    const disagreements: string[] = [];
    const intervals = (schedule: unknown) =>
      operatingIntervals(schedule as never, OPEN_RANGE);

    for (const { schedule, reads } of ACCEPTED_SCHEDULES) {
      if (
        isValidOperatingSchedule(schedule) !== true ||
        intervals(schedule).length === 0
      ) {
        disagreements.push(reads);
      }
    }
    for (const { schedule, reads } of CLOSED_SCHEDULES) {
      const s = schedule as { overrides?: unknown[] };
      const proof = {
        ...s,
        overrides: [
          ...(s.overrides ?? []),
          { date: "2024-06-12", windows: nineToFive },
        ],
      };
      if (
        isValidOperatingSchedule(schedule) !== true ||
        intervals(schedule).length !== 0 ||
        intervals(proof).length === 0
      ) {
        disagreements.push(reads);
      }
    }
    const refused = [
      ...REJECTED_SCHEDULES.map(({ schedule, reads }) => ({ schedule, reads })),
      ...HOSTILE_SCHEDULES.map(({ make, reads }) => ({
        schedule: make(),
        reads,
      })),
    ];
    for (const { schedule, reads } of refused) {
      if (
        isValidOperatingSchedule(schedule) !== false ||
        intervals(schedule).length !== 0
      ) {
        disagreements.push(reads);
      }
    }

    expect({
      count: disagreements.length,
      first: disagreements.slice(0, 5),
    }).toEqual({ count: 0, first: [] });
  });
});
