import { resolveDateTimeUnit } from "./resolveDateTimeUnit";

describe("resolveDateTimeUnit", () => {
  it.each`
    unit             | expected
    ${"year"}        | ${"year"}
    ${"month"}       | ${"month"}
    ${"week"}        | ${"week"}
    ${"day"}         | ${"day"}
    ${"hour"}        | ${"hour"}
    ${"minute"}      | ${"minute"}
    ${"second"}      | ${"second"}
    ${"millisecond"} | ${"millisecond"}
    ${"microsecond"} | ${"microsecond"}
    ${"nanosecond"}  | ${"nanosecond"}
  `("returns $expected unchanged for singular $unit", ({ unit, expected }) => {
    expect(resolveDateTimeUnit(unit)).toBe(expected);
  });

  it.each`
    unit              | expected
    ${"years"}        | ${"year"}
    ${"months"}       | ${"month"}
    ${"weeks"}        | ${"week"}
    ${"days"}         | ${"day"}
    ${"hours"}        | ${"hour"}
    ${"minutes"}      | ${"minute"}
    ${"seconds"}      | ${"second"}
    ${"milliseconds"} | ${"millisecond"}
    ${"microseconds"} | ${"microsecond"}
    ${"nanoseconds"}  | ${"nanosecond"}
  `("returns $expected for plural $unit", ({ unit, expected }) => {
    expect(resolveDateTimeUnit(unit)).toBe(expected);
  });

  it.each`
    unit
    ${"invalid"}
    ${""}
    ${"s"}
    ${"quarter"}
    ${"quarters"}
    ${"dayss"}
    ${"DAY"}
  `("returns $unit unchanged when it is not a DateTimeUnit", ({ unit }) => {
    expect(resolveDateTimeUnit(unit)).toBe(unit);
  });
});
