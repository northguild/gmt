import { Temporal } from "@js-temporal/polyfill";
import { mockSystemTimeZone } from "../../test/timeZoneMatrix";
import { endOfUnix } from "./endOfUnix";

describe("endOfUnix", () => {
  let cleanup: () => void;

  beforeEach(() => {
    cleanup = mockSystemTimeZone("UTC");
  });

  afterEach(() => {
    cleanup();
  });

  it.each`
    value         | unit        | expected
    ${1706659200} | ${"year"}   | ${1735689599}
    ${1706659200} | ${"month"}  | ${1706745599}
    ${1706659200} | ${"day"}    | ${1706745599}
    ${1706659200} | ${"hour"}   | ${1706662799}
    ${1706659200} | ${"minute"} | ${1706659259}
    ${1706659200} | ${"second"} | ${1706659200}
  `(
    "returns $expected for value $value and unit $unit",
    ({ value, unit, expected }) => {
      expect(endOfUnix(value, unit, { epochUnit: "seconds" })).toBe(expected);
    },
  );

  it.each`
    value         | unit      | weekStartsOn | expected
    ${1706659200} | ${"week"} | ${"monday"}  | ${1707091199}
    ${1706659200} | ${"week"} | ${"sunday"}  | ${1707004799}
  `(
    "supports weekStartsOn $weekStartsOn returning $expected for value $value and unit $unit",
    ({ value, unit, weekStartsOn, expected }) => {
      expect(
        endOfUnix(value, unit, { epochUnit: "seconds", weekStartsOn }),
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
    expect(endOfUnix(invalidValue as never, "day" as never)).toBeNull();
  });

  it.each`
    invalidUnit
    ${"invalid-unit"}
    ${""}
    ${null}
    ${undefined}
  `("returns null for invalid unit $invalidUnit", ({ invalidUnit }) => {
    expect(endOfUnix(1706659200, invalidUnit as never)).toBeNull();
  });

  // `disambiguation` is deprecated and ignored: the source sits in the second, repeated 1:45am,
  // and every row — "reject" included — returns the real end of that second pass, never before
  // the source. Verified against `bucketRange` on @js-temporal/polyfill@0.5.1.
  it.each`
    disambiguation  | expected
    ${undefined}    | ${1730617199999}
    ${"compatible"} | ${1730617199999}
    ${"earlier"}    | ${1730617199999}
    ${"later"}      | ${1730617199999}
    ${"reject"}     | ${1730617199999}
  `(
    "returns the real hour end $expected on a fall-back overlap with ignored disambiguation $disambiguation",
    ({ disambiguation, expected }) => {
      const optionsArg =
        disambiguation === undefined
          ? { timeZone: "America/New_York" }
          : { timeZone: "America/New_York", disambiguation };
      expect(endOfUnix(1730616300000, "hour", optionsArg)).toBe(expected);
    },
  );

  // `offset` is deprecated and ignored too, alone or combined with `disambiguation: "reject"`.
  it.each`
    offset       | expected
    ${undefined} | ${1730617199999}
    ${"ignore"}  | ${1730617199999}
    ${"prefer"}  | ${1730617199999}
    ${"use"}     | ${1730617199999}
    ${"reject"}  | ${1730617199999}
  `(
    "returns the real hour end $expected with disambiguation reject and ignored offset $offset",
    ({ offset, expected }) => {
      const optionsArg =
        offset === undefined
          ? { timeZone: "America/New_York", disambiguation: "reject" as const }
          : {
              timeZone: "America/New_York",
              disambiguation: "reject" as const,
              offset,
            };
      expect(endOfUnix(1730616300000, "hour", optionsArg)).toBe(expected);
    },
  );

  it("returns null when Temporal.Instant.fromEpochMilliseconds throws", () => {
    vi.spyOn(Temporal.Instant, "fromEpochMilliseconds").mockImplementation(
      () => {
        throw new Error("simulated failure");
      },
    );
    expect(endOfUnix(1706659200, "day")).toBeNull();
  });
});

// The end is one millisecond-truncated
// nanosecond before the next real zone bucket starts, never before the input. Every expected
// value verified against `floorToZone`/`bucketRange` on @js-temporal/polyfill@0.5.1.
// 1727532300000 is 2024-09-29T03:50:00+13:45[Pacific/Chatham]
// 1712412300000 is 2024-04-07T02:50:00+12:45[Pacific/Chatham]
// 1601742600000 is 2020-10-04T03:30:00+11:00[Antarctica/Casey]
// 1730615400000 is 2024-11-03T01:30:00-05:00[America/New_York]
// 1712416200000 is 2024-04-07T01:40:00+10:30[Australia/Lord_Howe]
// 1725807600000 is 2024-09-08T12:00:00-03:00[America/Santiago]
// 1289104200000 is 2010-11-07T00:30:00-04:00[America/Goose_Bay]
// 1289100600000 is 2010-11-06T23:30:00-04:00[America/Goose_Bay]
// 14303966789 is 1970-06-15T12:34:56.789-00:44:30[Africa/Monrovia]; 14303969999 is its 12:34:59.999
// 1730608200000 / 1730611800000 are both passes of 2024-11-03T00:30[America/Havana];
// 1730696399999 is 2024-11-03T23:59:59.999-05:00, the end of that one 25-hour day and its week
// 1730304000000 is 2024-10-30T12:00:00-04:00[America/Havana]
// 1602777600000 is 2020-10-15T12:00:00-04:00[America/Havana]; 1604203199999 is
// 2020-10-31T23:59:59.999-04:00, just before 1 November's repeated midnight
describe("endOfUnix across zone transitions with default options", () => {
  it.each`
    value            | unit        | timeZone                 | expected
    ${1730608200000} | ${"day"}    | ${"America/Havana"}      | ${1730696399999}
    ${1730611800000} | ${"day"}    | ${"America/Havana"}      | ${1730696399999}
    ${1730304000000} | ${"week"}   | ${"America/Havana"}      | ${1730696399999}
    ${1602777600000} | ${"month"}  | ${"America/Havana"}      | ${1604203199999}
    ${1727532300000} | ${"hour"}   | ${"Pacific/Chatham"}     | ${1727532899999}
    ${1712412300000} | ${"hour"}   | ${"Pacific/Chatham"}     | ${1712412899999}
    ${1601742600000} | ${"hour"}   | ${"Antarctica/Casey"}    | ${1601744399999}
    ${1730615400000} | ${"hour"}   | ${"America/New_York"}    | ${1730617199999}
    ${1712416200000} | ${"hour"}   | ${"Australia/Lord_Howe"} | ${1712417399999}
    ${1725807600000} | ${"day"}    | ${"America/Santiago"}    | ${1725850799999}
    ${1289104200000} | ${"day"}    | ${"America/Goose_Bay"}   | ${1289188799999}
    ${1289100600000} | ${"day"}    | ${"America/Goose_Bay"}   | ${1289102399999}
    ${14303966789}   | ${"minute"} | ${"Africa/Monrovia"}     | ${14303969999}
  `(
    "returns $expected for $value by $unit in $timeZone",
    ({ value, unit, timeZone, expected }) => {
      expect(endOfUnix(value, unit, { timeZone })).toBe(expected);
    },
  );

  // Goose Bay fell back at 00:01 Sunday into Saturday 23:01, re-opening a Sunday-first week that
  // ends at the second pass's 23:59:59.999 (-04:00). An explicit `disambiguation` used to end it
  // on the first pass (1289098799999, -03:00), before the input; it is now ignored. Verified
  // against the `internal/zonedBucket.ts` walker (weekStartsOn 7) on @js-temporal/polyfill@0.5.1.
  it.each`
    options                                                                                    | expected
    ${{ timeZone: "America/Goose_Bay", weekStartsOn: "sunday" }}                               | ${1289102399999}
    ${{ timeZone: "America/Goose_Bay", weekStartsOn: "sunday", disambiguation: "compatible" }} | ${1289102399999}
  `(
    "returns $expected for 1289100600000 by week with $options",
    ({ options, expected }) => {
      expect(endOfUnix(1289100600000, "week", options)).toBe(expected);
    },
  );

  // -8639999956800000 ms is -271821-04-20T12:00:00Z, half a day into the first representable
  // instant's day (a Tuesday). The start of its month, year and week lies before the range, but
  // every end is representable. Each end is floor(ns / 1e6) of `next start - 1 ns`, e.g. the UTC
  // month ends at -271821-04-30T23:59:59.999999999Z = -8639999049600001 ms. New York is on local
  // mean time (-04:56:02) then, so its month ends at 05-01T04:56:01.999999999Z = -8639999031838001.
  it.each`
    value                | unit       | timeZone              | weekStartsOn | expected
    ${-8639999956800000} | ${"day"}   | ${"UTC"}              | ${"monday"}  | ${-8639999913600001}
    ${-8639999956800000} | ${"week"}  | ${"UTC"}              | ${"monday"}  | ${-8639999481600001}
    ${-8639999956800000} | ${"week"}  | ${"UTC"}              | ${"sunday"}  | ${-8639999568000001}
    ${-8639999956800000} | ${"month"} | ${"UTC"}              | ${"monday"}  | ${-8639999049600001}
    ${-8639999956800000} | ${"year"}  | ${"UTC"}              | ${"monday"}  | ${-8639977881600001}
    ${-8639999956800000} | ${"month"} | ${"America/New_York"} | ${"monday"}  | ${-8639999031838001}
  `(
    "returns $expected as the $unit end of the first-day value $value in $timeZone (weekStartsOn $weekStartsOn)",
    ({ value, unit, timeZone, weekStartsOn, expected }) => {
      expect(endOfUnix(value, unit, { timeZone, weekStartsOn })).toBe(expected);
    },
  );
});

describe("endOfUnix invalid-input @example", () => {
  it('returns null for endOfUnix(NaN, "day")', () => {
    expect(endOfUnix(NaN, "day")).toBe(null);
  });
});
