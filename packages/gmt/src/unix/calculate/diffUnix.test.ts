import * as getSystemTimeZoneModule from "../../zoned/get/getSystemTimeZone";
import { diffUnix } from "./diffUnix";

describe("diffUnix", () => {
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
    ${1704067200} | ${1704153600} | ${"days"}  | ${1}
    ${1704067200} | ${1704153600} | ${"hours"} | ${24}
    ${1704067200} | ${1704153600} | ${"weeks"} | ${0}
  `(
    "returns $expected for single unit difference between $value1 and $value2 for unit $unit",
    ({ value1, value2, unit, expected }) => {
      expect(diffUnix(value1, value2, unit, { epochUnit: "seconds" })).toEqual(
        expected,
      );
    },
  );

  it.each`
    value1        | value2        | units                | expected
    ${1704067200} | ${1704153600} | ${["days"]}          | ${{ days: 1 }}
    ${1704067200} | ${1704153600} | ${["hours"]}         | ${{ hours: 24 }}
    ${1704067200} | ${1704326400} | ${["days", "hours"]} | ${{ days: 3, hours: 0 }}
  `(
    "returns $expected for $units difference between $value1 and $value2",
    ({ value1, value2, units, expected }) => {
      expect(diffUnix(value1, value2, units, { epochUnit: "seconds" })).toEqual(
        expected,
      );
    },
  );

  it.each`
    value1        | value2
    ${"invalid"}  | ${1704153600}
    ${1704067200} | ${"invalid"}
    ${null}       | ${1704153600}
    ${1704067200} | ${null}
  `(
    "returns null for invalid inputs: $value1 | $value2",
    ({ value1, value2 }) => {
      expect(diffUnix(value1 as never, value2 as never, "days" as never)).toBe(
        null,
      );
    },
  );

  it.each`
    roundingMode    | expected
    ${"ceil"}       | ${2}
    ${"floor"}      | ${1}
    ${"trunc"}      | ${1}
    ${"halfExpand"} | ${2}
  `(
    "rounds a 90-minute span to $expected hours with smallestUnit hour, roundingMode $roundingMode",
    ({ roundingMode, expected }) => {
      expect(
        diffUnix(1709164800000, 1709170200000, "hours", {
          smallestUnit: "hours",
          roundingMode,
        }),
      ).toBe(expected);
    },
  );

  it.each`
    roundingMode | expected
    ${"ceil"}    | ${2}
    ${"floor"}   | ${1}
  `(
    "rounds a 90-minute span to $expected hours across a DST-observing timeZone (America/New_York)",
    ({ roundingMode, expected }) => {
      expect(
        diffUnix(1709164800000, 1709170200000, "hours", {
          smallestUnit: "hours",
          roundingMode,
          timeZone: "America/New_York",
        }),
      ).toBe(expected);
    },
  );

  it("returns the unrounded result when no rounding options are provided", () => {
    expect(
      diffUnix(1704067200, 1704073200, "minutes", { epochUnit: "seconds" }),
    ).toBe(100);
  });

  it("returns null when roundingIncrement does not evenly divide the unit (minutes must divide 60)", () => {
    expect(
      diffUnix(1704067200, 1704073200, "minutes", {
        epochUnit: "seconds",
        smallestUnit: "minutes",
        roundingIncrement: 7,
        roundingMode: "trunc",
      }),
    ).toBeNull();
  });

  it("rounds a negative diff (value1 after value2)", () => {
    expect(
      diffUnix(1709170200000, 1709164800000, "hours", {
        smallestUnit: "hours",
        roundingMode: "halfExpand",
      }),
    ).toBe(-2);
  });

  it("rounds a result using seconds epochUnit", () => {
    expect(
      diffUnix(1709164800, 1709170200, "hours", {
        epochUnit: "seconds",
        smallestUnit: "hours",
        roundingMode: "halfExpand",
      }),
    ).toBe(2);
  });

  it("returns null when smallestUnit is coarser than the largest requested unit", () => {
    expect(
      diffUnix(1709164800000, 1709170200000, ["minutes", "seconds"], {
        smallestUnit: "hours",
      }),
    ).toBeNull();
  });
});
