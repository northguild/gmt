import { type DutyStep, dutySequence } from "../../test";
import type { PairSpec } from "../../types";
import { qualifyingRestPairs } from "./qualifyingRestPairs";

// 2024-01-01 (dateYearStart2024Jan01). Each period at least 2 hours, the longer at least 7, both
// together at least 10; a rest of 10 hours or more is a full rest and pairs with nothing.
const START = "2024-01-01T00:00:00Z";
const pair: PairSpec = {
  eachAtLeast: "PT2H",
  oneAtLeast: "PT7H",
  combinedAtLeast: "PT10H",
};
const spec = { statuses: ["off", "sleeper"], minimum: "PT10H", pair };
const pairs = (steps: readonly DutyStep[]) =>
  qualifyingRestPairs(dutySequence(START, steps), spec);

describe("qualifyingRestPairs", () => {
  it.each`
    steps                                                                                      | first                                                             | second                                                            | reason
    ${[["sleeper", "PT7H30M"], ["work", "PT4H"], ["off", "PT2H30M"]]}                          | ${{ start: "2024-01-01T00:00:00Z", end: "2024-01-01T07:30:00Z" }} | ${{ start: "2024-01-01T11:30:00Z", end: "2024-01-01T14:00:00Z" }} | ${"7.5 + 2.5"}
    ${[["sleeper", "PT8H"], ["work", "PT4H"], ["off", "PT2H"]]}                                | ${{ start: "2024-01-01T00:00:00Z", end: "2024-01-01T08:00:00Z" }} | ${{ start: "2024-01-01T12:00:00Z", end: "2024-01-01T14:00:00Z" }} | ${"8 + 2"}
    ${[["off", "PT3H"], ["work", "PT4H"], ["sleeper", "PT7H"]]}                                | ${{ start: "2024-01-01T00:00:00Z", end: "2024-01-01T03:00:00Z" }} | ${{ start: "2024-01-01T07:00:00Z", end: "2024-01-01T14:00:00Z" }} | ${"the short one first"}
    ${[["off", "PT7H"], ["work", "PT2H"], ["off", "PT1H"], ["work", "PT2H"], ["off", "PT3H"]]} | ${{ start: "2024-01-01T00:00:00Z", end: "2024-01-01T07:00:00Z" }} | ${{ start: "2024-01-01T12:00:00Z", end: "2024-01-01T15:00:00Z" }} | ${"a 1-hour rest between is neither half nor a break"}
  `("returns the pair for $reason", ({ steps, first, second }) => {
    expect(pairs(steps)).toEqual([{ first, second }]);
  });

  it.each`
    steps                                                                                       | reason
    ${[["off", "PT6H"], ["work", "PT4H"], ["off", "PT4H"]]}                                     | ${"6 + 4: neither is 7"}
    ${[["off", "PT7H"], ["work", "PT4H"], ["off", "PT1H59M"]]}                                  | ${"7 + 1:59: the shorter is under 2"}
    ${[["off", "PT7H"], ["work", "PT4H"], ["off", "PT2H59M"]]}                                  | ${"7 + 2:59: together under 10"}
    ${[["off", "PT7H"], ["work", "PT2H"], ["off", "PT10H"], ["work", "PT2H"], ["off", "PT3H"]]} | ${"a full rest between them"}
    ${[["off", "PT10H"], ["work", "PT4H"], ["off", "PT2H"]]}                                    | ${"a full rest pairs with nothing"}
  `("returns no pair for $reason", ({ steps }) => {
    expect(pairs(steps)).toEqual([]);
  });

  it("chains pairs: 7, 3 and 7 make two", () => {
    expect(
      pairs([
        ["off", "PT7H"],
        ["work", "PT4H"],
        ["off", "PT3H"],
        ["work", "PT4H"],
        ["sleeper", "PT7H"],
      ]),
    ).toEqual([
      {
        first: { start: "2024-01-01T00:00:00Z", end: "2024-01-01T07:00:00Z" },
        second: { start: "2024-01-01T11:00:00Z", end: "2024-01-01T14:00:00Z" },
      },
      {
        first: { start: "2024-01-01T11:00:00Z", end: "2024-01-01T14:00:00Z" },
        second: { start: "2024-01-01T18:00:00Z", end: "2024-01-02T01:00:00Z" },
      },
    ]);
  });

  it.each`
    candidate | badSpec                                                                                       | reason
    ${null}   | ${spec}                                                                                       | ${"a log that is not an array"}
    ${[]}     | ${null}                                                                                       | ${"a spec that is not an object"}
    ${[]}     | ${{ statuses: ["off"], minimum: "PT10H" }}                                                    | ${"no pair"}
    ${[]}     | ${{ statuses: ["off"], minimum: "PT10H", pair: { eachAtLeast: "PT2H", oneAtLeast: "PT7H" } }} | ${"a pair missing combinedAtLeast"}
    ${[]}     | ${{ statuses: ["off"], minimum: "PT10H", pair: { ...pair, eachAtLeast: "PT0S" } }}            | ${"a zero floor"}
    ${[]}     | ${{ statuses: ["off"], minimum: "x", pair }}                                                  | ${"a malformed minimum"}
  `("returns [] for $reason", ({ candidate, badSpec }) => {
    expect(qualifyingRestPairs(candidate, badSpec)).toEqual([]);
  });
});
