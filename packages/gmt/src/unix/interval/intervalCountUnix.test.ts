import { mockSystemTimeZone } from "../../test";
import { Temporal } from "@js-temporal/polyfill";
import { battleTestTimeZones } from "../../test/timeZoneMatrix";
import * as getSystemTimeZoneModule from "../../zoned/get/getSystemTimeZone";
import { intervalCountUnix } from "./intervalCountUnix";

// Epoch values used below, in ISO 8601 UTC:
// 0             is 1970-01-01T00:00:00Z
// 1704067200000 is 2024-01-01T00:00:00Z
// 1704085200000 is 2024-01-01T05:00:00Z
// 1704105000000 is 2024-01-01T10:30:00Z
// 1704110400000 is 2024-01-01T12:00:00Z
// 1704153540000 is 2024-01-01T23:59:00Z
// 1704153660000 is 2024-01-02T00:01:00Z
// 1704240000000 is 2024-01-03T00:00:00Z
// 1709596800000 is 2024-03-05T00:00:00Z
// 1735689600000 is 2025-01-01T00:00:00Z
// 1710046800000 is 2024-03-10T00:00:00-05:00[America/New_York]
// 1710129600000 is 2024-03-11T00:00:00-04:00[America/New_York]

describe("intervalCountUnix", () => {
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
    start            | end              | unit        | expected
    ${1704067200000} | ${1704240000000} | ${"day"}    | ${2}
    ${1704153540000} | ${1704153660000} | ${"day"}    | ${2}
    ${1704105000000} | ${1704110400000} | ${"hour"}   | ${2}
    ${1704067200000} | ${1709596800000} | ${"month"}  | ${3}
    ${1704067200000} | ${1735689600000} | ${"year"}   | ${1}
    ${0}             | ${86400000}      | ${"hour"}   | ${24}
    ${0}             | ${86400000}      | ${"day"}    | ${1}
    ${0}             | ${3600000}       | ${"minute"} | ${60}
  `(
    "returns $expected $unit boundaries for $start to $end",
    ({ start, end, unit, expected }) => {
      expect(intervalCountUnix(start, end, unit)).toBe(expected);
    },
  );

  it.each`
    start            | end              | unit       | expected
    ${1704067200000} | ${1704240000000} | ${"days"}  | ${2}
    ${1704105000000} | ${1704110400000} | ${"hours"} | ${2}
  `(
    "returns $expected for $start to $end with plural unit $unit",
    ({ start, end, unit, expected }) => {
      expect(intervalCountUnix(start, end, unit)).toBe(expected);
    },
  );

  it.each`
    start              | end                | unit      | expected
    ${"1704067200000"} | ${"1704240000000"} | ${"day"}  | ${2}
    ${"0"}             | ${"86400000"}      | ${"hour"} | ${24}
  `(
    "returns $expected for numeric-string input $start to $end counted in $unit",
    ({ start, end, unit, expected }) => {
      expect(intervalCountUnix(start, end, unit)).toBe(expected);
    },
  );

  it.each`
    start            | end              | unit      | expected
    ${1704067200000} | ${1704067200000} | ${"day"}  | ${0}
    ${1704085200000} | ${1704085200000} | ${"day"}  | ${0}
    ${0}             | ${0}             | ${"hour"} | ${0}
    ${1800000}       | ${1800000}       | ${"hour"} | ${0}
  `(
    "returns $expected for zero-length $start to $end counted in $unit (an empty interval holds no instant)",
    ({ start, end, unit, expected }) => {
      expect(intervalCountUnix(start, end, unit)).toBe(expected);
    },
  );

  it("returns 23 hour boundaries for the spring-forward local day in America/New_York", () => {
    expect(
      intervalCountUnix(1710046800000, 1710129600000, "hour", {
        timeZone: "America/New_York",
      }),
    ).toBe(23);
  });

  it("counts calendar units in the timeZone option for every battleTestTimeZone", () => {
    for (const timeZone of battleTestTimeZones) {
      const start = Temporal.ZonedDateTime.from({
        year: 2024,
        month: 6,
        day: 15,
        hour: 0,
        timeZone,
      }).epochMilliseconds;
      const end = Temporal.ZonedDateTime.from({
        year: 2024,
        month: 6,
        day: 16,
        hour: 0,
        timeZone,
      }).epochMilliseconds;

      expect(
        intervalCountUnix(start, end, "hour", { timeZone }),
        `hour count in ${timeZone}`,
      ).toBe(24);
      expect(
        intervalCountUnix(start, end, "day", { timeZone }),
        `day count in ${timeZone}`,
      ).toBe(1);
    }
  });

  it.each`
    start             | end         | unit
    ${NaN}            | ${86400000} | ${"hour"}
    ${Infinity}       | ${86400000} | ${"hour"}
    ${-Infinity}      | ${86400000} | ${"hour"}
    ${1.5}            | ${86400000} | ${"hour"}
    ${0}              | ${NaN}      | ${"hour"}
    ${0}              | ${Infinity} | ${"hour"}
    ${0}              | ${1.5}      | ${"hour"}
    ${"not-a-number"} | ${86400000} | ${"hour"}
    ${86400000}       | ${0}        | ${"hour"}
    ${0}              | ${86400000} | ${"invalid"}
    ${0}              | ${86400000} | ${""}
    ${0}              | ${86400000} | ${"quarter"}
    ${""}             | ${86400000} | ${"hour"}
    ${0}              | ${""}       | ${"hour"}
    ${"0"}            | ${"1.5"}    | ${"hour"}
    ${0}              | ${2 ** 53}  | ${"hour"}
    ${"   "}          | ${86400000} | ${"hour"}
    ${-(2 ** 53)}     | ${0}        | ${"hour"}
  `(
    "returns null for invalid $start, $end, or $unit",
    ({ start, end, unit }) => {
      expect(intervalCountUnix(start, end, unit)).toBeNull();
    },
  );

  it.each`
    start        | end          | unit
    ${null}      | ${86400000}  | ${"hour"}
    ${undefined} | ${86400000}  | ${"hour"}
    ${true}      | ${86400000}  | ${"hour"}
    ${[]}        | ${86400000}  | ${"hour"}
    ${{}}        | ${86400000}  | ${"hour"}
    ${0}         | ${null}      | ${"hour"}
    ${0}         | ${undefined} | ${"hour"}
    ${0}         | ${true}      | ${"hour"}
    ${0}         | ${[]}        | ${"hour"}
    ${0}         | ${{}}        | ${"hour"}
    ${0}         | ${86400000}  | ${null}
    ${0}         | ${86400000}  | ${undefined}
    ${0}         | ${86400000}  | ${123}
    ${0}         | ${86400000}  | ${true}
    ${0}         | ${86400000}  | ${[]}
    ${0}         | ${86400000}  | ${{}}
  `(
    "returns null for non-number or non-string input: $start, $end, $unit",
    ({ start, end, unit }) => {
      expect(
        intervalCountUnix(start as never, end as never, unit as never),
      ).toBeNull();
    },
  );

  it("returns null for timeZone local when the system timeZone is unavailable", () => {
    timeZoneSpy.mockReturnValue("");

    expect(
      intervalCountUnix(0, 86400000, "hour", { timeZone: "local" }),
    ).toBeNull();
  });
});

// Transition zones, counted in the timeZone option. Epochs are the same instants as
// intervalCountZoned.test.ts's transition table; every expected value verified against
// `bucketRange(...).length` on @js-temporal/polyfill@0.5.1.
// 1727532300000 is 2024-09-29T03:50:00+13:45[Pacific/Chatham]
// 1727533500000 is 2024-09-29T04:10:00+13:45[Pacific/Chatham]
// 1712408700000 is 2024-04-07T02:50:00+13:45[Pacific/Chatham]
// 1712412300000 is 2024-04-07T02:50:00+12:45[Pacific/Chatham]
// 1727522100000 is 2024-09-29T00:00:00+12:45[Pacific/Chatham]
// 1727608500000 is 2024-09-30T01:00:00+13:45[Pacific/Chatham]
// 1601740830000 is 2020-10-04T00:00:30+08:00[Antarctica/Casey]
// 1601742600000 is 2020-10-04T03:30:00+11:00[Antarctica/Casey]
// 1325196000000 is 2011-12-29T12:00:00-10:00[Pacific/Apia]
// 1325282400000 is 2011-12-31T12:00:00+14:00[Pacific/Apia]
// 1289097000000 is 2010-11-06T23:30:00-03:00[America/Goose_Bay]
// 1289104200000 is 2010-11-07T00:30:00-04:00[America/Goose_Bay]
// 8639997552000000 is +275760-08-15T12:00:00-04:00[America/Santiago]
// 8640000000000000 is +275760-09-12T21:00:00-03:00[America/Santiago], the last representable instant
describe("intervalCountUnix across zone transitions", () => {
  it.each`
    start               | end                 | unit       | timeZone               | expected
    ${1727532300000}    | ${1727533500000}    | ${"hour"}  | ${"Pacific/Chatham"}   | ${2}
    ${1712408700000}    | ${1712412300000}    | ${"hour"}  | ${"Pacific/Chatham"}   | ${3}
    ${1727522100000}    | ${1727608500000}    | ${"hour"}  | ${"Pacific/Chatham"}   | ${25}
    ${1601740830000}    | ${1601742600000}    | ${"hour"}  | ${"Antarctica/Casey"}  | ${2}
    ${1325196000000}    | ${1325282400000}    | ${"day"}   | ${"Pacific/Apia"}      | ${2}
    ${1289097000000}    | ${1289104200000}    | ${"hour"}  | ${"America/Goose_Bay"} | ${4}
    ${8639997552000000} | ${8640000000000000} | ${"month"} | ${"America/Santiago"}  | ${2}
  `(
    "returns $expected $unit buckets for $start to $end in timeZone $timeZone",
    ({ start, end, unit, timeZone, expected }) => {
      expect(intervalCountUnix(start, end, unit, { timeZone })).toBe(expected);
    },
  );

  // -271821-04-20T00:00:00Z is Temporal's minimum instant and a Tuesday. The week (from Monday
  // 04-19), month and year holding it began before it, but the interval still touches exactly that
  // one bucket — and one more once it reaches the next bucket start (04-26, 05-01, -271820-01-01).
  // -8640000000000000 is -271821-04-20T00:00:00Z; -8639999996400000 is one hour later;
  // -8639999395200000 is -271821-04-27T00:00:00Z.
  it.each`
    end                  | unit       | expected
    ${-8639999996400000} | ${"week"}  | ${1}
    ${-8639999996400000} | ${"month"} | ${1}
    ${-8639999996400000} | ${"year"}  | ${1}
    ${-8639999395200000} | ${"week"}  | ${2}
  `(
    "counts $expected $unit buckets from the minimum instant to $end in a UTC system timeZone",
    ({ end, unit, expected }) => {
      const restore = mockSystemTimeZone("UTC");
      try {
        expect(intervalCountUnix(-8640000000000000, end, unit)).toBe(expected);
      } finally {
        restore();
      }
    },
  );
});

describe("intervalCountUnix epochUnit and timeZone options", () => {
  // 1704151800000–1704155400000 is 2024-01-01T23:30Z–2024-01-02T00:30Z: it crosses UTC midnight,
  // but is 08:30–09:30 on 2024-01-02 in Asia/Tokyo.
  it.each`
    start            | end              | unit      | options                                             | expected
    ${1704151800000} | ${1704155400000} | ${"day"}  | ${undefined}                                        | ${2}
    ${1704151800000} | ${1704155400000} | ${"day"}  | ${{ timeZone: "Asia/Tokyo" }}                       | ${1}
    ${1704151800}    | ${1704155400}    | ${"days"} | ${{ epochUnit: "seconds", timeZone: "Asia/Tokyo" }} | ${1}
    ${"1704151800"}  | ${"1704155400"}  | ${"day"}  | ${{ epochUnit: "second" }}                          | ${2}
    ${1704151800000} | ${1704155400000} | ${"day"}  | ${{ timeZone: "Asia/Tokio" }}                       | ${null}
    ${1704151800000} | ${1704155400000} | ${"day"}  | ${{ epochUnit: "minutes" }}                         | ${null}
  `(
    "returns $expected for [$start, $end) in $unit with options $options",
    ({ start, end, unit, options, expected }) => {
      expect(intervalCountUnix(start, end, unit, options)).toBe(expected);
    },
  );
});
