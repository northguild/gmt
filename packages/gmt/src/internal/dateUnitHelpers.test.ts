import { Temporal } from "@js-temporal/polyfill";
import { addDateUnit, getStartOfDateUnit } from "./dateUnitHelpers";

describe("getStartOfDateUnit", () => {
  it.each`
    source          | unit         | expected
    ${"2024-03-13"} | ${"year"}    | ${"2024-01-01"}
    ${"2024-03-13"} | ${"month"}   | ${"2024-03-01"}
    ${"2024-03-13"} | ${"week"}    | ${"2024-03-11"}
    ${"2024-03-13"} | ${"day"}     | ${"2024-03-13"}
    ${"2024-03-13"} | ${"invalid"} | ${"2024-03-13"}
  `(
    "returns $expected for $source with unit $unit",
    ({ source, unit, expected }) => {
      const result = getStartOfDateUnit(Temporal.PlainDate.from(source), unit);
      expect(result.toString()).toBe(expected);
    },
  );

  it("returns Monday for week start of Sunday", () => {
    const sunday = Temporal.PlainDate.from("2024-03-17");
    expect(getStartOfDateUnit(sunday, "week").toString()).toBe("2024-03-11");
  });

  it("returns Monday for week start of Monday", () => {
    const monday = Temporal.PlainDate.from("2024-03-11");
    expect(getStartOfDateUnit(monday, "week").toString()).toBe("2024-03-11");
  });

  it("handles year start on January 1", () => {
    const jan1 = Temporal.PlainDate.from("2024-01-01");
    expect(getStartOfDateUnit(jan1, "year").toString()).toBe("2024-01-01");
  });

  it("handles leap year February 29", () => {
    const leap = Temporal.PlainDate.from("2024-02-29");
    expect(getStartOfDateUnit(leap, "year").toString()).toBe("2024-01-01");
    expect(getStartOfDateUnit(leap, "month").toString()).toBe("2024-02-01");
  });
});

describe("addDateUnit", () => {
  it.each`
    source          | unit       | amount | expected
    ${"2024-03-13"} | ${"year"}  | ${1}   | ${"2025-03-13"}
    ${"2024-03-13"} | ${"year"}  | ${-1}  | ${"2023-03-13"}
    ${"2024-03-13"} | ${"month"} | ${1}   | ${"2024-04-13"}
    ${"2024-03-13"} | ${"month"} | ${-1}  | ${"2024-02-13"}
    ${"2024-03-13"} | ${"week"}  | ${1}   | ${"2024-03-20"}
    ${"2024-03-13"} | ${"week"}  | ${-1}  | ${"2024-03-06"}
    ${"2024-03-13"} | ${"day"}   | ${1}   | ${"2024-03-14"}
    ${"2024-03-13"} | ${"day"}   | ${-1}  | ${"2024-03-12"}
    ${"2024-03-13"} | ${"day"}   | ${0}   | ${"2024-03-13"}
  `(
    "returns $expected for $source + $amount $unit",
    ({ source, unit, amount, expected }) => {
      const result = addDateUnit(Temporal.PlainDate.from(source), unit, amount);
      expect(result.toString()).toBe(expected);
    },
  );

  it("handles month overflow from January 31", () => {
    const jan31 = Temporal.PlainDate.from("2024-01-31");
    expect(addDateUnit(jan31, "month", 1).toString()).toBe("2024-02-29");
  });

  it("handles large week additions", () => {
    const base = Temporal.PlainDate.from("2024-03-13");
    expect(addDateUnit(base, "week", 52).toString()).toBe("2025-03-12");
  });
});
