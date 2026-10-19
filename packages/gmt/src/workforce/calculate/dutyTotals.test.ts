import { Temporal } from "../../internal/temporal";
import {
  intersectIntervals,
  mergeIntervals,
  sumIntervals,
} from "../../interval/calculate";
import { dutySequence } from "../../test";
import { mockTemporalInstantFromThrow } from "../../test/mocks";
import type { Interval } from "../../types";
import { dutyTotals } from "./dutyTotals";

// 2024-01-01 (dateYearStart2024Jan01): off 00–10, driving 10–15, on duty 15–17, driving 17–20,
// off 20–24.
const log = dutySequence("2024-01-01T00:00:00Z", [
  ["off", "PT10H"],
  ["driving", "PT5H"],
  ["onDuty", "PT2H"],
  ["driving", "PT3H"],
  ["off", "PT4H"],
]);
const day = { start: "2024-01-01T00:00:00Z", end: "2024-01-02T00:00:00Z" };

describe("dutyTotals", () => {
  it.each`
    window                                                                      | statuses                 | expected   | reason
    ${day}                                                                      | ${["driving"]}           | ${"PT8H"}  | ${"5 + 3 hours of driving"}
    ${day}                                                                      | ${["driving", "onDuty"]} | ${"PT10H"} | ${"driving and on duty together"}
    ${day}                                                                      | ${["off"]}               | ${"PT14H"} | ${"10 + 4 hours off"}
    ${{ start: "2024-01-01T12:00:00Z", end: "2024-01-01T18:00:00Z" }}           | ${["driving"]}           | ${"PT4H"}  | ${"12–15 and 17–18: cut at the window"}
    ${{ start: "2024-01-01T12:00:00Z", end: "2024-01-01T12:00:00Z" }}           | ${["driving"]}           | ${"PT0S"}  | ${"an empty window"}
    ${day}                                                                      | ${["sleeper"]}           | ${"PT0S"}  | ${"a status the log never uses"}
    ${day}                                                                      | ${[]}                    | ${"PT0S"}  | ${"no status"}
    ${{ start: "2024-01-01T05:00:00-05:00", end: "2024-01-01T13:00:00-05:00" }} | ${["driving"]}           | ${"PT6H"}  | ${"10:00Z–18:00Z written in another offset"}
  `(
    "returns $expected for $statuses ($reason)",
    ({ window, statuses, expected }) => {
      expect(dutyTotals(log, window, statuses)).toBe(expected);
    },
  );

  // The total is the interval algebra: merge the entries in the statuses, cut each run to the
  // window, sum what is left (CORE-6).
  it.each`
    window                                                            | statuses
    ${day}                                                            | ${["driving"]}
    ${{ start: "2024-01-01T12:00:00Z", end: "2024-01-01T18:00:00Z" }} | ${["driving", "onDuty"]}
    ${{ start: "2024-01-01T09:30:00Z", end: "2024-01-01T21:15:00Z" }} | ${["off", "driving"]}
  `(
    "equals the merged, intersected, summed intervals for $statuses",
    ({ window, statuses }) => {
      const pieces = mergeIntervals(
        log.filter((entry) => statuses.includes(entry.status)),
      ).flatMap((run: Interval) => {
        const part = intersectIntervals(run, window);
        return part === null ? [] : [part];
      });

      expect(
        Temporal.Duration.compare(
          Temporal.Duration.from(dutyTotals(log, window, statuses)),
          Temporal.Duration.from(sumIntervals(pieces)),
        ),
      ).toBe(0);
    },
  );

  it("returns PT0S for an empty log", () => {
    expect(dutyTotals([], day, ["driving"])).toBe("PT0S");
  });

  it.each`
    candidate                                                                         | window                                                            | statuses          | reason
    ${[{ status: "on", start: "2024-01-01T02:00:00Z", end: "2024-01-01T01:00:00Z" }]} | ${day}                                                            | ${["on"]}         | ${"an inverted entry"}
    ${null}                                                                           | ${day}                                                            | ${["on"]}         | ${"a log that is not an array"}
    ${log}                                                                            | ${{ start: "2024-01-02T00:00:00Z", end: "2024-01-01T00:00:00Z" }} | ${["driving"]}    | ${"an inverted window"}
    ${log}                                                                            | ${"2024-01-01"}                                                   | ${["driving"]}    | ${"a window that is not an Interval"}
    ${log}                                                                            | ${day}                                                            | ${"driving"}      | ${"statuses that are not an array"}
    ${log}                                                                            | ${day}                                                            | ${["driving", 1]} | ${"a status that is not a string"}
  `('returns "" for $reason', ({ candidate, window, statuses }) => {
    expect(dutyTotals(candidate, window, statuses)).toBe("");
  });

  it('returns "" when Temporal.Instant.from throws', () => {
    mockTemporalInstantFromThrow();
    expect(dutyTotals(log, day, ["driving"])).toBe("");
  });
});
