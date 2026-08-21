import { intervalOverlappingDaysUnix } from "./intervalOverlappingDaysUnix";
import {
  battleTestTimeZones,
  mockSystemTimeZone,
} from "../../test/timeZoneMatrix";

const D = 86400000;

describe("intervalOverlappingDaysUnix", () => {
  it.each`
    aStart | aEnd     | bStart | bEnd     | timeZone          | expected
    ${0}   | ${2 * D} | ${D}   | ${3 * D} | ${"UTC"}          | ${2}
    ${0}   | ${2 * D} | ${D}   | ${3 * D} | ${"Pacific/Apia"} | ${2}
    ${0}   | ${2 * D} | ${D}   | ${3 * D} | ${"Pacific/Niue"} | ${2}
  `(
    "returns $expected for $aStart..$aEnd × $bStart..$bEnd in $timeZone",
    ({ aStart, aEnd, bStart, bEnd, timeZone, expected }) => {
      expect(
        intervalOverlappingDaysUnix(aStart, aEnd, bStart, bEnd, { timeZone }),
      ).toBe(expected);
    },
  );

  it("returns 1 for a zero-length interval sitting mid-day (UTC)", () => {
    expect(intervalOverlappingDaysUnix(0, 0, 0, 0, { timeZone: "UTC" })).toBe(
      1,
    );
  });

  it("returns 1 for adjacent intervals sharing one instant (UTC)", () => {
    expect(
      intervalOverlappingDaysUnix(0, D, D, 2 * D, { timeZone: "UTC" }),
    ).toBe(1);
  });

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

    expect(withDefault).toBe(2);
    expect(withExplicit).toBe(2);
  });

  it("returns the same result for seconds as for the equivalent milliseconds", () => {
    expect(
      intervalOverlappingDaysUnix(0, 172800, 86400, 259200, {
        timeZone: "UTC",
        epochUnit: "seconds",
      }),
    ).toBe(2);
  });

  it("uses the system timeZone when options is omitted", () => {
    const restore = mockSystemTimeZone("UTC");

    try {
      expect(intervalOverlappingDaysUnix(0, 2 * D, D, 3 * D)).toBe(2);
    } finally {
      restore();
    }
  });

  it("uses the system timeZone when an explicit timeZone matches it (option not over-applying)", () => {
    const restore = mockSystemTimeZone("UTC");

    try {
      expect(
        intervalOverlappingDaysUnix(0, 2 * D, D, 3 * D, { timeZone: "UTC" }),
      ).toBe(2);
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
    "returns null for inverted interval $aStart..$aEnd × $bStart..$bEnd",
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
    ).toBe(2);
  });

  it("proves zone-invariance across battleTestTimeZones for a fixed 2-day epoch span", () => {
    for (const timeZone of battleTestTimeZones) {
      expect(
        intervalOverlappingDaysUnix(0, 2 * D, D, 3 * D, { timeZone }),
      ).toBe(2);
    }
  });
});
