import * as getSystemTimeZoneModule from "../../zoned/get/getSystemTimeZone";
import { startOfUnix } from "./startOfUnix";

// Epoch values used below, in ISO 8601 UTC:
// 1704067200    is 2024-01-01T00:00:00Z
// 1706400000    is 2024-01-28T00:00:00Z
// 1706486400    is 2024-01-29T00:00:00Z
// 1706659200    is 2024-01-31T00:00:00Z
// 1706745600    is 2024-02-01T00:00:00Z
// 1706778000    is 2024-02-01T09:00:00Z
// 1706780760    is 2024-02-01T09:46:00Z
// 1706780800    is 2024-02-01T09:46:40Z
// 1730610000000 is 2024-11-03T05:00:00.000Z
// 1730613600000 is 2024-11-03T06:00:00.000Z
// 1730616300000 is 2024-11-03T06:45:00.000Z
// 1541300400000 is 2018-11-04T03:00:00.000Z (2018-11-04T01:00:00-02:00[America/Sao_Paulo])
// 1541340000000 is 2018-11-04T14:00:00.000Z (2018-11-04T12:00:00-02:00[America/Sao_Paulo])

describe("startOfUnix", () => {
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
    value         | unit        | expected
    ${1706659200} | ${"year"}   | ${1704067200}
    ${1706659200} | ${"month"}  | ${1704067200}
    ${1706780800} | ${"day"}    | ${1706745600}
    ${1706780800} | ${"hour"}   | ${1706778000}
    ${1706780800} | ${"minute"} | ${1706780760}
    ${1706659200} | ${"second"} | ${1706659200}
  `(
    "returns $expected for value $value and unit $unit",
    ({ value, unit, expected }) => {
      expect(startOfUnix(value, unit, { epochUnit: "seconds" })).toBe(expected);
    },
  );

  it.each`
    value         | unit      | weekStartsOn | expected
    ${1706659200} | ${"week"} | ${"monday"}  | ${1706486400}
    ${1706659200} | ${"week"} | ${"sunday"}  | ${1706400000}
  `(
    "supports weekStartsOn $weekStartsOn returning $expected for value $value and unit $unit",
    ({ value, unit, weekStartsOn, expected }) => {
      expect(
        startOfUnix(value, unit, { epochUnit: "seconds", weekStartsOn }),
      ).toBe(expected);
    },
  );

  it.each`
    invalidValue
    ${"invalid"}
    ${1.5}
    ${null}
    ${undefined}
  `("returns null for invalid value $invalidValue", ({ invalidValue }) => {
    expect(startOfUnix(invalidValue as never, "day" as never)).toBeNull();
  });

  it.each`
    invalidUnit
    ${"invalid-unit"}
    ${""}
    ${null}
    ${undefined}
  `("returns null for invalid unit $invalidUnit", ({ invalidUnit }) => {
    expect(startOfUnix(1706659200, invalidUnit as never)).toBeNull();
  });

  // 1730616300000 is the second, repeated 1:45am of New York's 2024-11-03 fall-back.
  // `disambiguation` and `offset` were removed in 1.16.0: a boundary is always a real instant, as
  // TC39's `startOfDay()` takes neither. Passing one is a type error and changes nothing at runtime.
  it("treats the removed disambiguation option as a type error and ignores it at runtime", () => {
    expect(
      startOfUnix(1730616300000, "hour", {
        timeZone: "America/New_York",
        // @ts-expect-error -- `disambiguation` was removed in 1.16.0
        disambiguation: "reject",
      }),
    ).toBe(1730613600000);
  });
  it("treats the removed offset option as a type error and ignores it at runtime", () => {
    expect(
      startOfUnix(1730616300000, "hour", {
        timeZone: "America/New_York",
        // @ts-expect-error -- `offset` was removed in 1.16.0
        offset: "reject",
      }),
    ).toBe(1730613600000);
  });

  // Local midnight itself is a DST gap (America/Sao_Paulo jumped 00:00 -> 01:00 on 2018-11-04), so
  // the day starts at its first real instant (Temporal's `startOfDay()`, 1541300400000) whatever
  // `disambiguation` says. Verified on @js-temporal/polyfill@0.5.1.
  it.each`
    disambiguation  | expected
    ${undefined}    | ${1541300400000}
    ${"compatible"} | ${1541300400000}
    ${"earlier"}    | ${1541300400000}
    ${"later"}      | ${1541300400000}
    ${"reject"}     | ${1541300400000}
  `(
    "returns the day's first real instant $expected across a midnight gap with ignored disambiguation $disambiguation",
    ({ disambiguation, expected }) => {
      const optionsArg =
        disambiguation === undefined
          ? { timeZone: "America/Sao_Paulo" }
          : { timeZone: "America/Sao_Paulo", disambiguation };
      expect(startOfUnix(1541340000000, "day", optionsArg)).toBe(expected);
    },
  );
});

// The start is the real zone boundary, never
// after the input. Every expected value verified against `floorToZone` on
// @js-temporal/polyfill@0.5.1.
// 1727532300000 is 2024-09-29T03:50:00+13:45[Pacific/Chatham]; 1727532000000 is its 03:45
// 1712412300000 is 2024-04-07T02:50:00+12:45[Pacific/Chatham]; 1712412000000 is its 02:45
// 1601742600000 is 2020-10-04T03:30:00+11:00[Antarctica/Casey]; 1601740860000 is its 03:01
// 1730615400000 is 2024-11-03T01:30:00-05:00[America/New_York]; 1730613600000 is its 01:00
// 1712416200000 is 2024-04-07T01:40:00+10:30[Australia/Lord_Howe]; 1712412000000 is 01:00+11:00
// 1725807600000 is 2024-09-08T12:00:00-03:00[America/Santiago]; 1725768000000 is its 01:00
// 1289104200000 is 2010-11-07T00:30:00-04:00[America/Goose_Bay]; 1289102400000 is its 00:00
// 1289100600000 is 2010-11-06T23:30:00-04:00[America/Goose_Bay]; 1289098860000 is its 23:01
// 14303966789 is 1970-06-15T12:34:56.789-00:44:30[Africa/Monrovia]; 14303910000 is its 12:34:00
// (a UTC-minute truncation would give 14303940000)
// 1730611800000 is 2024-11-03T00:30:00-05:00[America/Havana] (second pass); 1730606400000 is the
// day's 00:00-04:00 and 1730088000000 is 2024-10-28T00:00:00-04:00, its week start
// 1604208600000 is 2020-11-01T00:30:00-05:00[America/Havana]; 1604203200000 is 00:00-04:00
describe("startOfUnix across zone transitions with default options", () => {
  it.each`
    value            | unit        | timeZone                 | expected
    ${1730611800000} | ${"day"}    | ${"America/Havana"}      | ${1730606400000}
    ${1730611800000} | ${"week"}   | ${"America/Havana"}      | ${1730088000000}
    ${1604208600000} | ${"month"}  | ${"America/Havana"}      | ${1604203200000}
    ${1727532300000} | ${"hour"}   | ${"Pacific/Chatham"}     | ${1727532000000}
    ${1712412300000} | ${"hour"}   | ${"Pacific/Chatham"}     | ${1712412000000}
    ${1601742600000} | ${"hour"}   | ${"Antarctica/Casey"}    | ${1601740860000}
    ${1730615400000} | ${"hour"}   | ${"America/New_York"}    | ${1730613600000}
    ${1712416200000} | ${"hour"}   | ${"Australia/Lord_Howe"} | ${1712412000000}
    ${1725807600000} | ${"day"}    | ${"America/Santiago"}    | ${1725768000000}
    ${1289104200000} | ${"day"}    | ${"America/Goose_Bay"}   | ${1289102400000}
    ${1289100600000} | ${"day"}    | ${"America/Goose_Bay"}   | ${1289098860000}
    ${14303966789}   | ${"minute"} | ${"Africa/Monrovia"}     | ${14303910000}
  `(
    "returns $expected for $value by $unit in $timeZone",
    ({ value, unit, timeZone, expected }) => {
      expect(startOfUnix(value, unit, { timeZone })).toBe(expected);
    },
  );

  // Goose Bay fell back at 00:01 Sunday into Saturday 23:01, re-opening a Sunday-first week that
  // starts at 23:01 (-04:00). An explicit `disambiguation` used to return the previous Sunday's
  // midnight (1288494000000), a week before the input; it is now ignored. Verified against the
  // `internal/zonedBucket.ts` walker (weekStartsOn 7) on @js-temporal/polyfill@0.5.1.
  it.each`
    options                                                                                    | expected
    ${{ timeZone: "America/Goose_Bay", weekStartsOn: "sunday" }}                               | ${1289098860000}
    ${{ timeZone: "America/Goose_Bay", weekStartsOn: "sunday", disambiguation: "compatible" }} | ${1289098860000}
  `(
    "returns $expected for 1289100600000 by week with $options",
    ({ options, expected }) => {
      expect(startOfUnix(1289100600000, "week", options)).toBe(expected);
    },
  );

  // 8640000000000000 ms is the last representable instant (+275760-09-13T00:00:00Z). Its Santiago
  // month starts at +275760-09-01T00:00:00-04:00 = +275760-09-01T04:00:00Z = 8639998977600000 ms.
  it.each`
    value               | unit       | timeZone              | expected
    ${8640000000000000} | ${"month"} | ${"America/Santiago"} | ${8639998977600000}
  `(
    "returns $expected for the maximum instant $value by $unit in $timeZone",
    ({ value, unit, timeZone, expected }) => {
      expect(startOfUnix(value, unit, { timeZone })).toBe(expected);
    },
  );
});

describe("startOfUnix invalid-input @example", () => {
  it('returns null for startOfUnix(NaN, "day")', () => {
    expect(startOfUnix(NaN, "day")).toBe(null);
  });
});

describe("startOfUnix unit names", () => {
  // 1706780800 is 2024-02-01T09:46:40Z. Temporal §13.17: plural unit names are the singular unit.
  it.each`
    value         | unit       | expected
    ${1706780800} | ${"days"}  | ${1706745600}
    ${1706780800} | ${"hours"} | ${1706778000}
    ${1706780800} | ${"years"} | ${1704067200}
  `(
    "returns $expected for value $value and plural unit $unit",
    ({ value, unit, expected }) => {
      expect(
        startOfUnix(value, unit, { epochUnit: "seconds", timeZone: "UTC" }),
      ).toBe(expected);
    },
  );

  // Quarters have their own functions (startOfQuarterForUnix / endOfQuarterForUnix).
  it.each`
    unit
    ${"quarter"}
    ${"quarters"}
  `("returns null for unit $unit", ({ unit }) => {
    expect(
      startOfUnix(1706780800, unit, { epochUnit: "seconds", timeZone: "UTC" }),
    ).toBeNull();
  });
});

// weekStartsOn only names "monday" or "sunday"; any other value is invalid input, for every unit
// (Temporal GetOption rejects a value outside its allowed list; undefined means the default).
// 1710504000000 is 2024-03-15T12:00:00Z.
describe("startOfUnix with an invalid weekStartsOn", () => {
  it.each`
    unit      | weekStartsOn
    ${"week"} | ${"tuesday"}
    ${"week"} | ${"Monday"}
    ${"week"} | ${""}
    ${"week"} | ${null}
    ${"week"} | ${1}
    ${"week"} | ${true}
    ${"day"}  | ${"tuesday"}
    ${"day"}  | ${"Monday"}
    ${"day"}  | ${""}
    ${"day"}  | ${null}
    ${"day"}  | ${1}
    ${"day"}  | ${true}
  `(
    "returns null for unit $unit with invalid weekStartsOn $weekStartsOn",
    ({ unit, weekStartsOn }) => {
      expect(
        startOfUnix(1710504000000, unit, { timeZone: "UTC", weekStartsOn }),
      ).toBeNull();
    },
  );
});
