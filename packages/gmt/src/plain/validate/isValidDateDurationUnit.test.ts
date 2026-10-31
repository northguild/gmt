import { isValidDateDurationUnit } from "./isValidDateDurationUnit";
import type { DateDurationUnit } from "../../types";
import { arrives, NON_STRINGS } from "../../test/nonStrings";

describe("isValidDateDurationUnit", () => {
  it.each`
    unit
    ${"years"}
    ${"months"}
    ${"weeks"}
    ${"days"}
  `("returns true for valid date duration unit: $unit", ({ unit }) => {
    expect(isValidDateDurationUnit(unit)).toBe(true);
  });

  it.each`
    invalidUnit     | label
    ${"not-a-unit"} | ${"'not-a-unit'"}
    ${""}           | ${"''"}
  `(
    "returns false for invalid date duration unit: $label",
    ({ invalidUnit }) => {
      expect(isValidDateDurationUnit(invalidUnit)).toBe(false);
    },
  );
});

describe("isValidDateDurationUnit with any value", () => {
  it("returns false for a value that is not a string", () => {
    for (const [kind, make] of NON_STRINGS) {
      expect(isValidDateDurationUnit(make()), kind).toBe(false);
    }
  });
});

describe("isValidDateDurationUnit types", () => {
  it("narrows a value typed unknown to DateDurationUnit when it is valid", () => {
    const input = arrives("days");
    if (isValidDateDurationUnit(input)) {
      expectTypeOf(input).toEqualTypeOf<DateDurationUnit>();
    }
    expect(isValidDateDurationUnit(input)).toBe(true);
  });

  it("keeps string on the false branch", () => {
    const input: string = "invalid";
    if (!isValidDateDurationUnit(input)) {
      expectTypeOf(input).toEqualTypeOf<string>();
    }
    expect(isValidDateDurationUnit(input)).toBe(false);
  });

  it("filters an unknown[] to DateDurationUnit[]", () => {
    const values = [null, "days", 1, "invalid"].map(arrives);
    const kept = values.filter(isValidDateDurationUnit);
    expectTypeOf(kept).toEqualTypeOf<DateDurationUnit[]>();
    expect(kept).toEqual(["days"]);
  });
});
