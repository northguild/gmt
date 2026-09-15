import { Temporal } from "@js-temporal/polyfill";
import {
  addDateTimeUnit,
  getStartOfDateTimeUnit,
  getStartOfNextDateTimeUnit,
} from "./dateTimeUnitHelpers";

describe("getStartOfDateTimeUnit", () => {
  it.each`
    source                   | unit         | expected
    ${"2024-03-15T14:30:45"} | ${"year"}    | ${"2024-01-01T00:00:00"}
    ${"2024-03-15T14:30:45"} | ${"month"}   | ${"2024-03-01T00:00:00"}
    ${"2024-03-15T14:30:45"} | ${"week"}    | ${"2024-03-11T00:00:00"}
    ${"2024-03-15T14:30:45"} | ${"day"}     | ${"2024-03-15T00:00:00"}
    ${"2024-03-15T14:30:45"} | ${"hour"}    | ${"2024-03-15T00:00:00"}
    ${"2024-03-15T14:30:45"} | ${"invalid"} | ${"2024-03-15T00:00:00"}
  `(
    "returns $expected for $source with unit $unit",
    ({ source, unit, expected }) => {
      const result = getStartOfDateTimeUnit(
        Temporal.PlainDateTime.from(source),
        unit,
      );
      expect(result.toString()).toBe(expected);
    },
  );

  it("returns Monday for week start of Sunday", () => {
    const sunday = Temporal.PlainDateTime.from("2024-03-17T14:30:45");
    expect(getStartOfDateTimeUnit(sunday, "week").toString()).toBe(
      "2024-03-11T00:00:00",
    );
  });

  it("preserves time reset for all date units", () => {
    const dt = Temporal.PlainDateTime.from("2024-03-15T23:59:59");
    expect(getStartOfDateTimeUnit(dt, "year").toString()).toBe(
      "2024-01-01T00:00:00",
    );
    expect(getStartOfDateTimeUnit(dt, "month").toString()).toBe(
      "2024-03-01T00:00:00",
    );
    expect(getStartOfDateTimeUnit(dt, "week").toString()).toBe(
      "2024-03-11T00:00:00",
    );
  });
});

describe("addDateTimeUnit", () => {
  it.each`
    source                   | unit         | amount | expected
    ${"2024-03-15T14:30:45"} | ${"year"}    | ${1}   | ${"2025-03-15T14:30:45"}
    ${"2024-03-15T14:30:45"} | ${"year"}    | ${-1}  | ${"2023-03-15T14:30:45"}
    ${"2024-03-15T14:30:45"} | ${"month"}   | ${1}   | ${"2024-04-15T14:30:45"}
    ${"2024-03-15T14:30:45"} | ${"month"}   | ${-1}  | ${"2024-02-15T14:30:45"}
    ${"2024-03-15T14:30:45"} | ${"week"}    | ${1}   | ${"2024-03-22T14:30:45"}
    ${"2024-03-15T14:30:45"} | ${"week"}    | ${-1}  | ${"2024-03-08T14:30:45"}
    ${"2024-03-15T14:30:45"} | ${"day"}     | ${1}   | ${"2024-03-15T14:30:45"}
    ${"2024-03-15T14:30:45"} | ${"hour"}    | ${1}   | ${"2024-03-15T14:30:45"}
    ${"2024-03-15T14:30:45"} | ${"invalid"} | ${1}   | ${"2024-03-15T14:30:45"}
  `(
    "returns $expected for $source + $amount $unit",
    ({ source, unit, amount, expected }) => {
      const result = addDateTimeUnit(
        Temporal.PlainDateTime.from(source),
        unit,
        amount,
      );
      expect(result.toString()).toBe(expected);
    },
  );

  it("preserves time for year and month additions", () => {
    const dt = Temporal.PlainDateTime.from("2024-03-15T23:59:59");
    expect(addDateTimeUnit(dt, "year", 1).toString()).toBe(
      "2025-03-15T23:59:59",
    );
    expect(addDateTimeUnit(dt, "month", 1).toString()).toBe(
      "2024-04-15T23:59:59",
    );
  });
});

// The start of the date unit after `source`'s, reached without materialising `source`'s own start.
// 2024-03-15 is a Friday; -271821-04-19 is the first date, a Monday whose T00:00:00 is not itself
// representable (the first PlainDateTime is T00:00:00.000000001).
describe("getStartOfNextDateTimeUnit", () => {
  it.each`
    source                      | unit       | expected                    | description
    ${"2024-03-15T14:30:45"}    | ${"year"}  | ${"2025-01-01T00:00:00"}    | ${"the next year"}
    ${"2024-03-15T14:30:45"}    | ${"month"} | ${"2024-04-01T00:00:00"}    | ${"the next month"}
    ${"2024-01-31T23:59:59"}    | ${"month"} | ${"2024-02-01T00:00:00"}    | ${"a month-end steps to the next month, not past it"}
    ${"2024-03-15T14:30:45"}    | ${"week"}  | ${"2024-03-18T00:00:00"}    | ${"a Friday's next Monday"}
    ${"2024-03-15T14:30:45"}    | ${"day"}   | ${"2024-03-16T00:00:00"}    | ${"the next midnight"}
    ${"-271821-04-19T12:00:00"} | ${"week"}  | ${"-271821-04-26T00:00:00"} | ${"the first date's own week began before the range"}
    ${"-271821-04-19T12:00:00"} | ${"day"}   | ${"-271821-04-20T00:00:00"} | ${"the first date's own midnight is not representable"}
  `(
    "returns $expected for $source by $unit ($description)",
    ({ source, unit, expected }) => {
      const result = getStartOfNextDateTimeUnit(
        Temporal.PlainDateTime.from(source),
        unit,
      );
      expect(result.toString()).toBe(expected);
    },
  );
});
