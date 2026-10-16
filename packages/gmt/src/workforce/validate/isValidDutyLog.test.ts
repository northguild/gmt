import { mockTemporalInstantFromThrow } from "../../test/mocks";
import type { DutyEntry } from "../../types";
import { isValidDutyLog } from "./isValidDutyLog";

// 2024-01-01 (unix2024Jan01T000000Ms); times of day override the canonical midnight because the
// entries' bounds are the scenario under test.
describe("isValidDutyLog", () => {
  it("accepts a DutyEntry-typed log", () => {
    const log: DutyEntry<"off" | "driving">[] = [
      {
        status: "off",
        start: "2024-01-01T00:00:00Z",
        end: "2024-01-01T10:00:00Z",
      },
      {
        status: "driving",
        start: "2024-01-01T10:00:00Z",
        end: "2024-01-01T15:00:00Z",
      },
    ];

    expect(isValidDutyLog(log)).toBe(true);
  });

  // Entries are ordered by start and may touch (one's end is the next's start, half-open) or
  // leave a gap; order is by instant, so 10:00+01:00 (09:00Z) sorts before 09:30Z.
  it.each`
    log                                                                                                                                                                   | reason
    ${[]}                                                                                                                                                                 | ${"empty log"}
    ${[{ status: "off", start: "2024-01-01T00:00:00Z", end: "2024-01-01T00:00:00.000000001Z" }]}                                                                          | ${"one nanosecond long"}
    ${[{ status: "off", start: "2024-01-01T00:00:00Z", end: "2024-01-01T08:00:00Z" }, { status: "on", start: "2024-01-01T09:00:00Z", end: "2024-01-01T10:00:00Z" }]}      | ${"a gap between entries"}
    ${[{ status: "on", start: "2024-01-01T10:00:00+01:00", end: "2024-01-01T09:15:00Z" }, { status: "off", start: "2024-01-01T09:30:00Z", end: "2024-01-01T10:00:00Z" }]} | ${"descending as text, ascending as instants"}
    ${[{ status: "", start: "2024-01-01T00:00:00Z", end: "2024-01-01T01:00:00Z" }]}                                                                                       | ${"empty-string status"}
    ${[{ status: "on", start: "2024-01-01T00:00:00Z[America/New_York]", end: "2024-01-01T01:00:00Z", note: "x" }]}                                                        | ${"bracketed zone and an extra key"}
  `("returns true for $reason", ({ log }) => {
    expect(isValidDutyLog(log)).toBe(true);
  });

  it.each`
    value
    ${null}
    ${undefined}
    ${"x"}
    ${123}
    ${{}}
  `("returns false when $value is non-array input", ({ value }) => {
    expect(isValidDutyLog(value)).toBe(false);
  });

  it.each`
    log                                                                                                                                                              | reason
    ${[null]}                                                                                                                                                        | ${"an entry that is not an object"}
    ${[{ start: "2024-01-01T00:00:00Z", end: "2024-01-01T01:00:00Z" }]}                                                                                              | ${"missing status"}
    ${[{ status: 1, start: "2024-01-01T00:00:00Z", end: "2024-01-01T01:00:00Z" }]}                                                                                   | ${"non-string status"}
    ${[{ status: "on", start: "2024-01-01T00:00:00", end: "2024-01-01T01:00:00Z" }]}                                                                                 | ${"zoneless start"}
    ${[{ status: "on", start: "2024-01-01T00:00:00Z", end: "2024-01-01" }]}                                                                                          | ${"date-only end"}
    ${[{ status: "on", start: "2016-12-31T23:00:00Z", end: "2016-12-31T23:59:60Z" }]}                                                                                | ${"leap second"}
    ${[{ status: "on", start: "2024-01-01T01:00:00Z", end: "2024-01-01T01:00:00Z" }]}                                                                                | ${"zero length"}
    ${[{ status: "on", start: "2024-01-01T02:00:00Z", end: "2024-01-01T01:00:00Z" }]}                                                                                | ${"inverted"}
    ${[{ status: "on", start: "2024-01-01T00:00:00Z", end: "2024-01-01T02:00:00Z" }, { status: "off", start: "2024-01-01T01:59:59Z", end: "2024-01-01T03:00:00Z" }]} | ${"overlapping by one second"}
    ${[{ status: "on", start: "2024-01-01T02:00:00Z", end: "2024-01-01T03:00:00Z" }, { status: "off", start: "2024-01-01T00:00:00Z", end: "2024-01-01T01:00:00Z" }]} | ${"out of order"}
  `("returns false for $reason", ({ log }) => {
    expect(isValidDutyLog(log)).toBe(false);
  });

  it("returns false when Temporal.Instant.from throws", () => {
    mockTemporalInstantFromThrow();

    expect(
      isValidDutyLog([
        {
          status: "on",
          start: "2024-01-01T00:00:00Z",
          end: "2024-01-01T01:00:00Z",
        },
      ]),
    ).toBe(false);
  });
});
