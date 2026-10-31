import { isValidDateTimeDurationUnit } from "./isValidDateTimeDurationUnit";
import type { DateTimeDurationUnit } from "../../types";
import { arrives, NON_STRINGS } from "../../test/nonStrings";

describe("isValidDateTimeDurationUnit", () => {
  it.each`
    unit
    ${"years"}
    ${"months"}
    ${"weeks"}
    ${"days"}
    ${"hours"}
    ${"minutes"}
    ${"seconds"}
    ${"milliseconds"}
    ${"microseconds"}
    ${"nanoseconds"}
  `("returns true for valid date time duration unit: $unit", ({ unit }) => {
    expect(isValidDateTimeDurationUnit(unit)).toBe(true);
  });

  it.each`
    invalidUnit     | label
    ${"not-a-unit"} | ${"'not-a-unit'"}
    ${""}           | ${"''"}
  `(
    "returns false for invalid date time duration unit: $label",
    ({ invalidUnit }) => {
      expect(isValidDateTimeDurationUnit(invalidUnit)).toBe(false);
    },
  );
});

describe("isValidDateTimeDurationUnit with any value", () => {
  it("returns false for a value that is not a string", () => {
    for (const [kind, make] of NON_STRINGS) {
      expect(isValidDateTimeDurationUnit(make()), kind).toBe(false);
    }
  });
});

describe("isValidDateTimeDurationUnit types", () => {
  it("narrows a value typed unknown to DateTimeDurationUnit when it is valid", () => {
    const input = arrives("hours");
    if (isValidDateTimeDurationUnit(input)) {
      expectTypeOf(input).toEqualTypeOf<DateTimeDurationUnit>();
    }
    expect(isValidDateTimeDurationUnit(input)).toBe(true);
  });

  it("keeps string on the false branch", () => {
    const input: string = "invalid";
    if (!isValidDateTimeDurationUnit(input)) {
      expectTypeOf(input).toEqualTypeOf<string>();
    }
    expect(isValidDateTimeDurationUnit(input)).toBe(false);
  });

  it("filters an unknown[] to DateTimeDurationUnit[]", () => {
    const values = [null, "hours", 1, "invalid"].map(arrives);
    const kept = values.filter(isValidDateTimeDurationUnit);
    expectTypeOf(kept).toEqualTypeOf<DateTimeDurationUnit[]>();
    expect(kept).toEqual(["hours"]);
  });
});
