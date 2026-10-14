import { dutySequence } from "../../test";
import { qualifyingRests } from "./qualifyingRests";

// 2024-01-01 (dateYearStart2024Jan01): off 00–10, work 10–16, off 16–23, work 23–02, off 5 h and
// sleeper 7 h touching (02–14), work 14–20.
const log = dutySequence("2024-01-01T00:00:00Z", [
  ["off", "PT10H"],
  ["work", "PT6H"],
  ["off", "PT7H"],
  ["work", "PT3H"],
  ["off", "PT5H"],
  ["sleeper", "PT7H"],
  ["work", "PT6H"],
]);

describe("qualifyingRests", () => {
  it.each`
    statuses              | minimum    | expected                                                                                                                            | reason
    ${["off"]}            | ${"PT10H"} | ${[{ start: "2024-01-01T00:00:00Z", end: "2024-01-01T10:00:00Z" }]}                                                                 | ${"only the first run of off is 10 hours"}
    ${["off", "sleeper"]} | ${"PT10H"} | ${[{ start: "2024-01-01T00:00:00Z", end: "2024-01-01T10:00:00Z" }, { start: "2024-01-02T02:00:00Z", end: "2024-01-02T14:00:00Z" }]} | ${"off and sleeper touching are one 12-hour rest"}
    ${["off"]}            | ${"PT7H"}  | ${[{ start: "2024-01-01T00:00:00Z", end: "2024-01-01T10:00:00Z" }, { start: "2024-01-01T16:00:00Z", end: "2024-01-01T23:00:00Z" }]} | ${"7 hours exactly counts"}
    ${["sleeper"]}        | ${"PT8H"}  | ${[]}                                                                                                                               | ${"none long enough"}
  `(
    "returns the rests of at least $minimum in $statuses ($reason)",
    ({ statuses, minimum, expected }) => {
      expect(qualifyingRests(log, { statuses, minimum })).toEqual(expected);
    },
  );

  it.each`
    candidate | spec                                       | reason
    ${null}   | ${{ statuses: ["off"], minimum: "PT10H" }} | ${"a log that is not an array"}
    ${log}    | ${null}                                    | ${"a spec that is not an object"}
    ${log}    | ${{ statuses: "off", minimum: "PT10H" }}   | ${"statuses that are not an array"}
    ${log}    | ${{ statuses: ["off"], minimum: "PT0S" }}  | ${"a zero minimum"}
    ${log}    | ${{ statuses: ["off"], minimum: "P1W" }}   | ${"a minimum in weeks, which has no exact length"}
    ${log}    | ${{ statuses: ["off"], minimum: "-PT1H" }} | ${"a negative minimum"}
  `("returns [] for $reason", ({ candidate, spec }) => {
    expect(qualifyingRests(candidate, spec)).toEqual([]);
  });
});
