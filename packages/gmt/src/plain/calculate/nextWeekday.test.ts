import { mockTemporalPlainDateFromThrow } from "../../test/mocks";
import { nextWeekday } from "./nextWeekday";

describe("nextWeekday", () => {
  it.each`
    dayOfWeek | expected
    ${1}      | ${"2024-03-18"}
    ${2}      | ${"2024-03-19"}
    ${3}      | ${"2024-03-20"}
    ${4}      | ${"2024-03-21"}
    ${5}      | ${"2024-03-22"}
    ${6}      | ${"2024-03-16"}
    ${7}      | ${"2024-03-17"}
  `(
    "returns $expected for next dayOfWeek $dayOfWeek from 2024-03-15 (Friday)",
    ({ dayOfWeek, expected }) => {
      expect(nextWeekday("2024-03-15", dayOfWeek)).toBe(expected);
    },
  );

  it.each`
    value           | dayOfWeek | inclusive | expected
    ${"2024-03-15"} | ${5}      | ${false}  | ${"2024-03-22"}
    ${"2024-03-15"} | ${5}      | ${true}   | ${"2024-03-15"}
    ${"2024-03-13"} | ${5}      | ${false}  | ${"2024-03-15"}
    ${"2024-03-13"} | ${5}      | ${true}   | ${"2024-03-15"}
  `(
    "returns $expected for $value, dayOfWeek $dayOfWeek, inclusive $inclusive",
    ({ value, dayOfWeek, inclusive, expected }) => {
      expect(nextWeekday(value, dayOfWeek, { inclusive })).toBe(expected);
    },
  );

  it("defaults inclusive to false when options are omitted", () => {
    expect(nextWeekday("2024-03-15", 5)).toBe("2024-03-22");
  });

  it.each`
    value           | dayOfWeek | expected
    ${"2023-12-31"} | ${1}      | ${"2024-01-01"}
    ${"2024-02-29"} | ${5}      | ${"2024-03-01"}
  `(
    "returns $expected for $value crossing a month/year boundary to dayOfWeek $dayOfWeek",
    ({ value, dayOfWeek, expected }) => {
      expect(nextWeekday(value, dayOfWeek)).toBe(expected);
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
      expect(nextWeekday("2024-03-15", dayOfWeek)).toBe("");
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
    expect(nextWeekday(value as never, 5)).toBe("");
  });

  it("returns an empty string when Temporal.PlainDate.from throws", () => {
    mockTemporalPlainDateFromThrow();
    expect(nextWeekday("2024-03-15", 5)).toBe("");
  });
});
