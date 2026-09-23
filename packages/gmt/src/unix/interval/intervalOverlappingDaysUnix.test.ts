import { Temporal } from "@js-temporal/polyfill";
import { intervalOverlappingDaysUnix } from "./intervalOverlappingDaysUnix";
import {
  battleTestTimeZones,
  mockSystemTimeZone,
} from "../../test/timeZoneMatrix";

const D = 86400000;

describe("intervalOverlappingDaysUnix", () => {
  it.each`
    aStart | aEnd     | bStart | bEnd     | timeZone          | expected
    ${0}   | ${2 * D} | ${D}   | ${3 * D} | ${"UTC"}          | ${1}
    ${0}   | ${2 * D} | ${D}   | ${3 * D} | ${"Pacific/Apia"} | ${2}
    ${0}   | ${2 * D} | ${D}   | ${3 * D} | ${"Pacific/Niue"} | ${2}
    ${0}   | ${D}     | ${0}   | ${D}     | ${"UTC"}          | ${1}
    ${0}   | ${D + 1} | ${0}   | ${D + 1} | ${"UTC"}          | ${2}
  `(
    // Half-open: the intersection [D, 2D) is 1970-01-02 in UTC only; at -11:00 (Apia, Niue in 1970)
    // it runs from 01-01T13:00 to just before 01-02T13:00, so it touches two dates.
    "returns $expected for $aStart to $aEnd × $bStart to $bEnd in $timeZone",
    ({ aStart, aEnd, bStart, bEnd, timeZone, expected }) => {
      expect(
        intervalOverlappingDaysUnix(aStart, aEnd, bStart, bEnd, { timeZone }),
      ).toBe(expected);
    },
  );

  it("returns 0 for a zero-length interval, which holds no instant (UTC)", () => {
    expect(intervalOverlappingDaysUnix(0, 0, 0, 0, { timeZone: "UTC" })).toBe(
      0,
    );
  });

  // An empty interval strictly inside the other: the intersection is the empty span at 1970-01-02
  // 12:00 UTC (129600000 ms = 1.5 days), which holds no instant and so no date.
  it.each`
    aStart     | aEnd       | bStart     | bEnd       | epochUnit
    ${0}       | ${2 * D}   | ${1.5 * D} | ${1.5 * D} | ${"milliseconds"}
    ${1.5 * D} | ${1.5 * D} | ${0}       | ${2 * D}   | ${"milliseconds"}
    ${0}       | ${172800}  | ${129600}  | ${129600}  | ${"seconds"}
  `(
    "returns 0 when the intersection of [$aStart, $aEnd) and [$bStart, $bEnd) in $epochUnit is an empty interval inside the other",
    ({ aStart, aEnd, bStart, bEnd, epochUnit }) => {
      expect(
        intervalOverlappingDaysUnix(aStart, aEnd, bStart, bEnd, { epochUnit }),
      ).toBe(0);
    },
  );

  // Half-open (coding-standards § 8): touching intervals share no instant, so no date.
  it.each`
    aStart | aEnd     | bStart   | bEnd      | epochUnit
    ${0}   | ${D}     | ${D}     | ${2 * D}  | ${"milliseconds"}
    ${0}   | ${86400} | ${86400} | ${172800} | ${"seconds"}
  `(
    "returns 0 for touching intervals [$aStart, $aEnd) and [$bStart, $bEnd) in $epochUnit (UTC)",
    ({ aStart, aEnd, bStart, bEnd, epochUnit }) => {
      expect(
        intervalOverlappingDaysUnix(aStart, aEnd, bStart, bEnd, {
          timeZone: "UTC",
          epochUnit,
        }),
      ).toBe(0);
    },
  );

  it("returns 0 for disjoint intervals (UTC)", () => {
    expect(
      intervalOverlappingDaysUnix(0, D, 2 * D, 3 * D, { timeZone: "UTC" }),
    ).toBe(0);
  });

  it("agrees between default epochUnit and explicit milliseconds", () => {
    const withDefault = intervalOverlappingDaysUnix(0, 2 * D, D, 3 * D, {
      timeZone: "UTC",
    });
    const withExplicit = intervalOverlappingDaysUnix(0, 2 * D, D, 3 * D, {
      timeZone: "UTC",
      epochUnit: "milliseconds",
    });

    expect(withDefault).toBe(1);
    expect(withExplicit).toBe(1);
  });

  it("returns the same result for seconds as for the equivalent milliseconds", () => {
    expect(
      intervalOverlappingDaysUnix(0, 172800, 86400, 259200, {
        timeZone: "UTC",
        epochUnit: "seconds",
      }),
    ).toBe(1);
  });

  it("uses the system timeZone when options is omitted", () => {
    const restore = mockSystemTimeZone("UTC");

    try {
      expect(intervalOverlappingDaysUnix(0, 2 * D, D, 3 * D)).toBe(1);
    } finally {
      restore();
    }
  });

  it("uses the system timeZone when an explicit timeZone matches it (option not over-applying)", () => {
    const restore = mockSystemTimeZone("UTC");

    try {
      expect(
        intervalOverlappingDaysUnix(0, 2 * D, D, 3 * D, { timeZone: "UTC" }),
      ).toBe(1);
    } finally {
      restore();
    }
  });

  it("returns null for an invalid timeZone", () => {
    expect(
      intervalOverlappingDaysUnix(0, 2 * D, D, 3 * D, {
        timeZone: "not-a-timezone",
      }),
    ).toBeNull();
  });

  it.each`
    aStart | aEnd | bStart   | bEnd
    ${D}   | ${0} | ${2 * D} | ${3 * D}
    ${0}   | ${D} | ${3 * D} | ${2 * D}
  `(
    "returns null for inverted interval $aStart to $aEnd × $bStart to $bEnd",
    ({ aStart, aEnd, bStart, bEnd }) => {
      expect(
        intervalOverlappingDaysUnix(aStart, aEnd, bStart, bEnd, {
          timeZone: "UTC",
        }),
      ).toBeNull();
    },
  );

  it.each`
    aStart        | aEnd          | bStart     | bEnd
    ${NaN}        | ${1700000000} | ${1000000} | ${2000000}
    ${Infinity}   | ${1700000000} | ${1000000} | ${2000000}
    ${-Infinity}  | ${1700000000} | ${1000000} | ${2000000}
    ${1.5}        | ${1700000000} | ${1000000} | ${2000000}
    ${1700000000} | ${NaN}        | ${1000000} | ${2000000}
    ${1700000000} | ${Infinity}   | ${1000000} | ${2000000}
    ${1700000000} | ${1700000000} | ${NaN}     | ${2000000}
    ${1700000000} | ${1700000000} | ${1000000} | ${NaN}
    ${""}         | ${1700000000} | ${1000000} | ${2000000}
    ${"0"}        | ${"1.5"}      | ${1000000} | ${2000000}
    ${0}          | ${2 ** 53}    | ${1000000} | ${2000000}
    ${"   "}      | ${1700000000} | ${1000000} | ${2000000}
    ${0}          | ${1700000000} | ${1.5}     | ${2000000}
    ${0}          | ${1700000000} | ${""}      | ${2000000}
    ${0}          | ${1700000000} | ${1000000} | ${2 ** 53}
  `(
    "returns null for non-finite/non-integer: $aStart, $aEnd, $bStart, $bEnd",
    ({ aStart, aEnd, bStart, bEnd }) => {
      expect(
        intervalOverlappingDaysUnix(aStart, aEnd, bStart, bEnd, {
          timeZone: "UTC",
        }),
      ).toBeNull();
    },
  );

  it.each`
    aStart        | aEnd          | bStart       | bEnd
    ${null}       | ${1700000000} | ${1000000}   | ${2000000}
    ${undefined}  | ${1700000000} | ${1000000}   | ${2000000}
    ${"abc"}      | ${1700000000} | ${1000000}   | ${2000000}
    ${true}       | ${1700000000} | ${1000000}   | ${2000000}
    ${[]}         | ${1700000000} | ${1000000}   | ${2000000}
    ${{}}         | ${1700000000} | ${1000000}   | ${2000000}
    ${1700000000} | ${null}       | ${1000000}   | ${2000000}
    ${1700000000} | ${undefined}  | ${1000000}   | ${2000000}
    ${1700000000} | ${"abc"}      | ${1000000}   | ${2000000}
    ${1700000000} | ${1700000000} | ${null}      | ${2000000}
    ${1700000000} | ${1700000000} | ${undefined} | ${2000000}
    ${1700000000} | ${1700000000} | ${"abc"}     | ${2000000}
    ${1700000000} | ${1700000000} | ${1000000}   | ${null}
    ${1700000000} | ${1700000000} | ${1000000}   | ${undefined}
    ${1700000000} | ${1700000000} | ${1000000}   | ${"abc"}
  `("returns null for non-numeric input", ({ aStart, aEnd, bStart, bEnd }) => {
    expect(
      intervalOverlappingDaysUnix(
        aStart as never,
        aEnd as never,
        bStart as never,
        bEnd as never,
        { timeZone: "UTC" },
      ),
    ).toBeNull();
  });

  it("accepts string epoch inputs", () => {
    expect(
      intervalOverlappingDaysUnix(
        "0",
        String(2 * D),
        String(D),
        String(3 * D),
        {
          timeZone: "UTC",
        },
      ),
    ).toBe(1);
  });

  it("counts the same one-day intersection per zone across battleTestTimeZones", () => {
    // [D, 2D) is 24 hours. Where the zone's offset on 1970-01-02 is zero it is one local date; any
    // other offset starts mid-day and touches two (no battle zone changes offset that day).
    for (const timeZone of battleTestTimeZones) {
      const offset =
        Temporal.Instant.fromEpochMilliseconds(D).toZonedDateTimeISO(
          timeZone,
        ).offsetNanoseconds;

      expect(
        intervalOverlappingDaysUnix(0, 2 * D, D, 3 * D, { timeZone }),
      ).toBe(offset === 0 ? 1 : 2);
    }
  });
});

describe("intervalOverlappingDaysUnix with an unrecognised epochUnit", () => {
  // isValidUnixUnit defines the domain ("seconds" | "milliseconds", singular or plural): any other value is invalid
  // input and returns the sentinel, never a silent read as milliseconds.
  it.each`
    epochUnit
    ${"nanoseconds"}
    ${"SECONDS"}
    ${"ms"}
    ${""}
    ${1000}
  `("returns null for epochUnit $epochUnit", ({ epochUnit }) => {
    expect(
      intervalOverlappingDaysUnix(
        1_706_659_200,
        1_706_659_200,
        1_706_659_200,
        1_706_659_200,
        { epochUnit: epochUnit as never, timeZone: "UTC" },
      ),
    ).toBe(null);
  });

  // Distinct local dates of the instants in the half-open span (tzdb): Goose_Bay fell back at 00:01
  // on 2010-11-07 into 2010-11-06 (1289098860000 = the transition), Apia deleted 2011-12-30, and an
  // empty span holds no instant.
  it.each`
    aStart           | aEnd             | timeZone               | expected
    ${1289098830000} | ${1289100600000} | ${"America/Goose_Bay"} | ${2}
    ${1289098740000} | ${1289100600000} | ${"America/Goose_Bay"} | ${2}
    ${1325235600000} | ${1325242800000} | ${"Pacific/Apia"}      | ${2}
    ${1712458800000} | ${1712458800000} | ${"America/Santiago"}  | ${0}
  `(
    "returns $expected local dates for the self-overlap $aStart to $aEnd in $timeZone",
    ({ aStart, aEnd, timeZone, expected }) => {
      expect(
        intervalOverlappingDaysUnix(aStart, aEnd, aStart, aEnd, { timeZone }),
      ).toBe(expected);
    },
  );
});
