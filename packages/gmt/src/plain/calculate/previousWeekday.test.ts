import { mockTemporalPlainDateFromThrow } from "../../test/mocks";
import { previousWeekday } from "./previousWeekday";

describe("previousWeekday", () => {
  it.each`
    dayOfWeek | expected
    ${1}      | ${"2024-03-11"}
    ${2}      | ${"2024-03-12"}
    ${3}      | ${"2024-03-13"}
    ${4}      | ${"2024-03-14"}
    ${5}      | ${"2024-03-08"}
    ${6}      | ${"2024-03-09"}
    ${7}      | ${"2024-03-10"}
  `(
    "returns $expected for previous dayOfWeek $dayOfWeek from 2024-03-15 (Friday)",
    ({ dayOfWeek, expected }) => {
      expect(previousWeekday("2024-03-15", dayOfWeek)).toBe(expected);
    },
  );

  it.each`
    value           | dayOfWeek | inclusive | expected
    ${"2024-03-15"} | ${5}      | ${false}  | ${"2024-03-08"}
    ${"2024-03-15"} | ${5}      | ${true}   | ${"2024-03-15"}
    ${"2024-03-13"} | ${5}      | ${false}  | ${"2024-03-08"}
    ${"2024-03-13"} | ${5}      | ${true}   | ${"2024-03-08"}
  `(
    "returns $expected for $value, dayOfWeek $dayOfWeek, inclusive $inclusive",
    ({ value, dayOfWeek, inclusive, expected }) => {
      expect(previousWeekday(value, dayOfWeek, { inclusive })).toBe(expected);
    },
  );

  it("defaults inclusive to false when options are omitted", () => {
    expect(previousWeekday("2024-03-15", 5)).toBe("2024-03-08");
  });

  it.each`
    value           | dayOfWeek | expected
    ${"2024-01-01"} | ${7}      | ${"2023-12-31"}
    ${"2024-02-29"} | ${1}      | ${"2024-02-26"}
  `(
    "returns $expected for $value crossing a month/year boundary to dayOfWeek $dayOfWeek",
    ({ value, dayOfWeek, expected }) => {
      expect(previousWeekday(value, dayOfWeek)).toBe(expected);
    },
  );

  it.each`
    dayOfWeek
    ${0}
    ${8}
    ${-1}
    ${1.5}
    ${NaN}
  `(
    "returns an empty string for out-of-range dayOfWeek $dayOfWeek",
    ({ dayOfWeek }) => {
      expect(previousWeekday("2024-03-15", dayOfWeek)).toBe("");
    },
  );

  it.each`
    value
    ${"invalid"}
    ${""}
    ${"2024-02-30"}
    ${"2024-13-01"}
    ${null}
    ${undefined}
  `("returns an empty string for invalid value $value", ({ value }) => {
    expect(previousWeekday(value as never, 5)).toBe("");
  });

  it("returns an empty string when Temporal.PlainDate.from throws", () => {
    mockTemporalPlainDateFromThrow();
    expect(previousWeekday("2024-03-15", 5)).toBe("");
  });
});
