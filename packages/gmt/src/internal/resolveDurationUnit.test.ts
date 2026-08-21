import { resolveDurationUnit } from "./resolveDurationUnit";

describe("resolveDurationUnit", () => {
  it.each`
    unit              | expected
    ${"years"}        | ${"years"}
    ${"months"}       | ${"months"}
    ${"weeks"}        | ${"weeks"}
    ${"days"}         | ${"days"}
    ${"hours"}        | ${"hours"}
    ${"minutes"}      | ${"minutes"}
    ${"seconds"}      | ${"seconds"}
    ${"milliseconds"} | ${"milliseconds"}
    ${"microseconds"} | ${"microseconds"}
    ${"nanoseconds"}  | ${"nanoseconds"}
  `(
    "returns already-plural recognized unit $unit unchanged",
    ({ unit, expected }) => {
      expect(resolveDurationUnit(unit)).toBe(expected);
    },
  );

  it.each`
    unit        | expected
    ${"year"}   | ${"years"}
    ${"month"}  | ${"months"}
    ${"week"}   | ${"weeks"}
    ${"day"}    | ${"days"}
    ${"hour"}   | ${"hours"}
    ${"minute"} | ${"minutes"}
    ${"second"} | ${"seconds"}
  `("pluralizes singular unit $unit to $expected", ({ unit, expected }) => {
    expect(resolveDurationUnit(unit)).toBe(expected);
  });

  it("returns an already-plural but unrecognized unit unchanged, without appending a second 's'", () => {
    expect(resolveDurationUnit("bananas")).toBe("bananas");
  });

  it("returns a singular unrecognized unit unchanged when pluralizing it doesn't produce a valid unit either", () => {
    expect(resolveDurationUnit("banana")).toBe("banana");
  });

  it("returns an empty string unchanged", () => {
    expect(resolveDurationUnit("")).toBe("");
  });
});
