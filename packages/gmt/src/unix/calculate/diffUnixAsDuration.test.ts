import { battleTestTimeZones } from "../../test";
import * as getSystemTimeZoneModule from "../../zoned/get/getSystemTimeZone";
import { diffUnixAsDuration } from "./diffUnixAsDuration";

describe("diffUnixAsDuration", () => {
  for (const timeZone of battleTestTimeZones) {
    it(`rounds a 90-minute span to PT2H across battle-test timeZone ${timeZone}`, () => {
      expect(
        diffUnixAsDuration(1709164800000, 1709170200000, "hours", {
          smallestUnit: "hours",
          roundingMode: "halfExpand",
          timeZone,
        }),
      ).toBe("PT2H");
    });
  }

  let timeZoneSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    timeZoneSpy = vi
      .spyOn(getSystemTimeZoneModule, "getSystemTimeZone")
      .mockReturnValue("UTC");
  });

  afterEach(() => {
    timeZoneSpy.mockRestore();
  });

  it.each`
    value1        | value2        | unit       | expected
    ${1704067200} | ${1704153600} | ${"days"}  | ${"P1D"}
    ${1704067200} | ${1704153600} | ${"hours"} | ${"PT24H"}
    ${1704067200} | ${1704153600} | ${"weeks"} | ${"P1D"}
  `(
    "returns $expected for single unit difference between $value1 and $value2 for unit $unit",
    ({ value1, value2, unit, expected }) => {
      expect(
        diffUnixAsDuration(value1, value2, unit, { epochUnit: "seconds" }),
      ).toBe(expected);
    },
  );

  it.each`
    value1           | value2           | unit      | expected
    ${1706659200000} | ${1706745600000} | ${"days"} | ${"P1D"}
    ${1706745600000} | ${1706659200000} | ${"days"} | ${"-P1D"}
  `(
    "handles direction correctly: $expected for $value1 -> $value2",
    ({ value1, value2, unit, expected }) => {
      expect(diffUnixAsDuration(value1, value2, unit)).toBe(expected);
    },
  );

  it("supports seconds epochUnit", () => {
    expect(
      diffUnixAsDuration(1706659200, 1706745600, "days", {
        epochUnit: "seconds",
      }),
    ).toBe("P1D");
  });

  it.each`
    value1        | value2
    ${NaN}        | ${1704153600}
    ${1704067200} | ${NaN}
    ${null}       | ${1704153600}
    ${1704067200} | ${null}
  `(
    'returns "" for invalid inputs: $value1 | $value2',
    ({ value1, value2 }) => {
      expect(diffUnixAsDuration(value1 as never, value2 as never, "days")).toBe(
        "",
      );
    },
  );

  it.each`
    invalidUnit
    ${"invalid"}
    ${""}
    ${null}
    ${undefined}
    ${["days"]}
  `('returns "" for invalid unit $invalidUnit', ({ invalidUnit }) => {
    expect(
      diffUnixAsDuration(1704067200000, 1704153600000, invalidUnit as never),
    ).toBe("");
  });

  it.each`
    roundingMode    | expected
    ${"ceil"}       | ${"PT2H"}
    ${"floor"}      | ${"PT1H"}
    ${"trunc"}      | ${"PT1H"}
    ${"halfExpand"} | ${"PT2H"}
  `(
    "rounds a 90-minute span to $expected with smallestUnit hour, roundingMode $roundingMode",
    ({ roundingMode, expected }) => {
      expect(
        diffUnixAsDuration(1709164800000, 1709170200000, "hours", {
          smallestUnit: "hours",
          roundingMode,
        }),
      ).toBe(expected);
    },
  );

  it.each`
    roundingMode | expected
    ${"ceil"}    | ${"PT2H"}
    ${"floor"}   | ${"PT1H"}
  `(
    "rounds a 90-minute span to $expected across a DST-observing timeZone (America/New_York)",
    ({ roundingMode, expected }) => {
      expect(
        diffUnixAsDuration(1709164800000, 1709170200000, "hours", {
          smallestUnit: "hours",
          roundingMode,
          timeZone: "America/New_York",
        }),
      ).toBe(expected);
    },
  );

  it("returns the unrounded result when no rounding options are provided", () => {
    expect(
      diffUnixAsDuration(1704067200, 1704073200, "minutes", {
        epochUnit: "seconds",
      }),
    ).toBe("PT100M");
  });

  it('returns "" when roundingIncrement does not evenly divide the unit', () => {
    expect(
      diffUnixAsDuration(1704067200, 1704073200, "minutes", {
        epochUnit: "seconds",
        smallestUnit: "minutes",
        roundingIncrement: 7,
        roundingMode: "trunc",
      }),
    ).toBe("");
  });

  it("returns negative duration for value1 after value2", () => {
    expect(
      diffUnixAsDuration(1709170200000, 1709164800000, "hours", {
        smallestUnit: "hours",
        roundingMode: "halfExpand",
      }),
    ).toBe("-PT2H");
  });

  it.each`
    toStringSmallestUnit | fractionalSecondDigits | expected
    ${undefined}         | ${undefined}           | ${"PT1H"}
    ${"second"}          | ${undefined}           | ${"PT1H0S"}
    ${undefined}         | ${3}                   | ${"PT1H0.000S"}
  `(
    "applies toString precision options -> $expected",
    ({ toStringSmallestUnit, fractionalSecondDigits, expected }) => {
      expect(
        diffUnixAsDuration(1709164800000, 1709168400000, "hours", {
          toStringSmallestUnit,
          fractionalSecondDigits,
        }),
      ).toBe(expected);
    },
  );
});
