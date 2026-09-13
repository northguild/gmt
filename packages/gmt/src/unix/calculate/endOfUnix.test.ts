import { Temporal } from "@js-temporal/polyfill";
import { mockSystemTimeZone } from "../../test/timeZoneMatrix";
import { mockTemporalPlainDateFromThrow } from "../../test/mocks";
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

  // disambiguation: fall-back overlap — source sits in the second, repeated 1:45am. With no
  // disambiguation (the undefined row) the real boundary is returned: the end of the second
  // pass. An explicit disambiguation opts into wall-clock `.with()`.
  it.each`
    disambiguation  | expected
    ${undefined}    | ${1730617199999}
    ${"compatible"} | ${1730613599999}
    ${"earlier"}    | ${1730613599999}
    ${"later"}      | ${1730617199999}
    ${"reject"}     | ${null}
  `(
    "with disambiguation $disambiguation on a fall-back overlap, returns $expected",
    ({ disambiguation, expected }) => {
      const optionsArg =
        disambiguation === undefined
          ? { timeZone: "America/New_York" }
          : { timeZone: "America/New_York", disambiguation };
      expect(endOfUnix(1730616300000, "hour", optionsArg)).toBe(expected);
    },
  );

  // offset controls whether disambiguation takes effect at all
  it.each`
    offset       | expected
    ${undefined} | ${null}
    ${"ignore"}  | ${null}
    ${"prefer"}  | ${1730617199999}
  `(
    "with disambiguation reject and offset $offset, returns $expected",
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

  // Only the explicit wall-clock path measures the month with `Temporal.PlainDate.from`.
  it("returns null when Temporal.PlainDate.from throws on the explicit disambiguation path", () => {
    mockTemporalPlainDateFromThrow();
    expect(
      endOfUnix(1706659200, "month", { disambiguation: "compatible" }),
    ).toBeNull();
  });
});

// With neither `disambiguation` nor `offset` passed, the end is one millisecond-truncated
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
describe("endOfUnix across zone transitions with default options", () => {
  it.each`
    value            | unit        | timeZone                 | expected
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

  // Goose Bay fell back at 00:01 Sunday into Saturday 23:01, re-opening a Sunday-first week.
  // The default path ends it at the second pass's 23:59:59.999 (-04:00); an explicit
  // `disambiguation` keeps the legacy wall-clock `.with()` result on the first pass (-03:00),
  // before the input. Verified against the `internal/zonedBucket.ts` walker (weekStartsOn 7) and
  // Temporal on @js-temporal/polyfill@0.5.1.
  // 1289098799999 is 2010-11-06T23:59:59.999-03:00[America/Goose_Bay]
  it.each`
    options                                                                                    | expected
    ${{ timeZone: "America/Goose_Bay", weekStartsOn: "sunday" }}                               | ${1289102399999}
    ${{ timeZone: "America/Goose_Bay", weekStartsOn: "sunday", disambiguation: "compatible" }} | ${1289098799999}
  `(
    "returns $expected for 1289100600000 by week with $options",
    ({ options, expected }) => {
      expect(endOfUnix(1289100600000, "week", options)).toBe(expected);
    },
  );
});
