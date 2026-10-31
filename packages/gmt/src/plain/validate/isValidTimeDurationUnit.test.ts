import { isValidTimeDurationUnit } from "./isValidTimeDurationUnit";
import type { TimeDurationUnit } from "../../types";
import { arrives, NON_STRINGS } from "../../test/nonStrings";

describe("isValidTimeDurationUnit", () => {
  it.each`
    unit
    ${"hours"}
    ${"minutes"}
    ${"seconds"}
    ${"milliseconds"}
    ${"microseconds"}
    ${"nanoseconds"}
  `("returns true for valid time duration unit: $unit", ({ unit }) => {
    expect(isValidTimeDurationUnit(unit)).toBe(true);
  });

  it.each`
    invalidUnit     | label
    ${"not-a-unit"} | ${"'not-a-unit'"}
    ${""}           | ${"''"}
  `(
    "returns false for invalid time duration unit: $label",
    ({ invalidUnit }) => {
      expect(isValidTimeDurationUnit(invalidUnit)).toBe(false);
    },
  );
});

describe("isValidTimeDurationUnit with any value", () => {
  it("returns false for a value that is not a string", () => {
    for (const [kind, make] of NON_STRINGS) {
      expect(isValidTimeDurationUnit(make()), kind).toBe(false);
    }
  });
});

describe("isValidTimeDurationUnit types", () => {
  it("narrows a value typed unknown to TimeDurationUnit when it is valid", () => {
    const input = arrives("minutes");
    if (isValidTimeDurationUnit(input)) {
      expectTypeOf(input).toEqualTypeOf<TimeDurationUnit>();
    }
    expect(isValidTimeDurationUnit(input)).toBe(true);
  });

  it("keeps string on the false branch", () => {
    const input: string = "invalid";
    if (!isValidTimeDurationUnit(input)) {
      expectTypeOf(input).toEqualTypeOf<string>();
    }
    expect(isValidTimeDurationUnit(input)).toBe(false);
  });

  it("filters an unknown[] to TimeDurationUnit[]", () => {
    const values = [null, "minutes", 1, "invalid"].map(arrives);
    const kept = values.filter(isValidTimeDurationUnit);
    expectTypeOf(kept).toEqualTypeOf<TimeDurationUnit[]>();
    expect(kept).toEqual(["minutes"]);
  });
});
