import { dutySequence } from "../../test";
import { longestRun } from "./longestRun";

// 2024-01-01 (dateYearStart2024Jan01): driving 00–03, on duty 03–04, driving 04–08, off 08–12,
// driving 12–16, an unlogged hour, driving 17–18.
const log = dutySequence("2024-01-01T00:00:00Z", [
  ["driving", "PT3H"],
  ["onDuty", "PT1H"],
  ["driving", "PT4H"],
  ["off", "PT4H"],
  ["driving", "PT4H"],
  [null, "PT1H"],
  ["driving", "PT1H"],
]);
const day = { start: "2024-01-01T00:00:00Z", end: "2024-01-02T00:00:00Z" };

describe("longestRun", () => {
  it.each`
    window                                                            | statuses                 | start                     | end                       | duration  | reason
    ${day}                                                            | ${["driving"]}           | ${"2024-01-01T04:00:00Z"} | ${"2024-01-01T08:00:00Z"} | ${"PT4H"} | ${"04–08 and 12–16 tie at 4 hours; the earlier wins"}
    ${day}                                                            | ${["driving", "onDuty"]} | ${"2024-01-01T00:00:00Z"} | ${"2024-01-01T08:00:00Z"} | ${"PT8H"} | ${"touching entries in the statuses join"}
    ${{ start: "2024-01-01T05:00:00Z", end: "2024-01-01T15:00:00Z" }} | ${["driving"]}           | ${"2024-01-01T05:00:00Z"} | ${"2024-01-01T08:00:00Z"} | ${"PT3H"} | ${"each run cut to the window: 05–08 and 12–15 tie, the earlier wins"}
    ${{ start: "2024-01-01T15:00:00Z", end: "2024-01-02T00:00:00Z" }} | ${["driving"]}           | ${"2024-01-01T15:00:00Z"} | ${"2024-01-01T16:00:00Z"} | ${"PT1H"} | ${"an unlogged hour ends a run"}
    ${day}                                                            | ${["off"]}               | ${"2024-01-01T08:00:00Z"} | ${"2024-01-01T12:00:00Z"} | ${"PT4H"} | ${"the off period"}
  `(
    "returns $duration from $start for $statuses ($reason)",
    ({ window, statuses, start, end, duration }) => {
      expect(longestRun(log, window, statuses)).toEqual({
        interval: { start, end },
        duration,
      });
    },
  );

  it.each`
    candidate | window                                                            | statuses       | reason
    ${log}    | ${day}                                                            | ${["sleeper"]} | ${"no time in the statuses"}
    ${log}    | ${{ start: "2024-01-01T08:00:00Z", end: "2024-01-01T12:00:00Z" }} | ${["driving"]} | ${"none inside the window"}
    ${log}    | ${day}                                                            | ${[]}          | ${"no status"}
    ${[]}     | ${day}                                                            | ${["driving"]} | ${"an empty log"}
    ${null}   | ${day}                                                            | ${["driving"]} | ${"a log that is not an array"}
    ${log}    | ${{ start: "2024-01-02T00:00:00Z", end: "2024-01-01T00:00:00Z" }} | ${["driving"]} | ${"an inverted window"}
    ${log}    | ${day}                                                            | ${[1]}         | ${"a status that is not a string"}
  `("returns null for $reason", ({ candidate, window, statuses }) => {
    expect(longestRun(candidate, window, statuses)).toBeNull();
  });
});
