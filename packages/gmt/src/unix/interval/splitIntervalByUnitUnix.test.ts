import { Temporal } from "@js-temporal/polyfill";
import { mockSystemTimeZone } from "../../test";
import { splitIntervalByUnitUnix } from "./splitIntervalByUnitUnix";

describe("splitIntervalByUnitUnix", () => {
  // Each boundary is start + k × amount (Temporal and Luxon Interval.splitBy), so month ends don't drift.
  // 2024-01-31T10:00:00Z to 2024-05-15T10:00:00Z, stepped in a UTC system timeZone.
  it.each`
    start            | end              | unit       | expected
    ${1706695200000} | ${1715767200000} | ${"month"} | ${[{ start: 1706695200000, end: 1709200800000 }, { start: 1709200800000, end: 1711879200000 }, { start: 1711879200000, end: 1714471200000 }, { start: 1714471200000, end: 1715767200000 }]}
  `(
    "computes every $unit boundary of $start to $end from the start, without month-end drift",
    ({ start, end, unit, expected }) => {
      const restore = mockSystemTimeZone("UTC");
      try {
        expect(splitIntervalByUnitUnix(start, end, unit, 1)).toEqual(expected);
      } finally {
        restore();
      }
    },
  );

  // amount > 1 from a month end, stepped in a UTC system timeZone: step k is start + 3k months.
  // 1701338400000 is 2023-11-30T10:00:00Z; 1709200800000 is 2024-02-29T10:00:00Z;
  // 1717063200000 is 2024-05-30T10:00:00Z (compounding from Feb 29 would give May 29);
  // 1725012000000 is 2024-08-30T10:00:00Z; 1725184800000 is 2024-09-01T10:00:00Z.
  it.each`
    start            | end              | unit       | amount | expected
    ${1701338400000} | ${1725184800000} | ${"month"} | ${3}   | ${[{ start: 1701338400000, end: 1709200800000 }, { start: 1709200800000, end: 1717063200000 }, { start: 1717063200000, end: 1725012000000 }, { start: 1725012000000, end: 1725184800000 }]}
  `(
    "computes every $amount $unit boundary of $start to $end from the start",
    ({ start, end, unit, amount, expected }) => {
      const restore = mockSystemTimeZone("UTC");
      try {
        expect(splitIntervalByUnitUnix(start, end, unit, amount)).toEqual(
          expected,
        );
      } finally {
        restore();
      }
    },
  );

  // Pacific/Apia deleted 30 December 2011 (UTC-10 → UTC+14). 1325109600000 is
  // 2011-12-28T12:00:00-10:00; day steps 2 and 3 both resolve to 1325282400000
  // (2011-12-31T12:00:00+14:00), so step 3 is skipped instead of discarding the whole split.
  // 1325368800000 is 2012-01-01T12:00:00+14:00. Verified against Temporal.ZonedDateTime.add.
  it.each`
    start            | end              | unit     | amount | expected
    ${1325109600000} | ${1325368800000} | ${"day"} | ${1}   | ${[{ start: 1325109600000, end: 1325196000000 }, { start: 1325196000000, end: 1325282400000 }, { start: 1325282400000, end: 1325368800000 }]}
  `(
    "skips the deleted local day when splitting $start to $end by $amount $unit in Pacific/Apia",
    ({ start, end, unit, amount, expected }) => {
      const restore = mockSystemTimeZone("Pacific/Apia");
      try {
        expect(splitIntervalByUnitUnix(start, end, unit, amount)).toEqual(
          expected,
        );
      } finally {
        restore();
      }
    },
  );

  // Exact units step from the previous boundary. 3 × 3033333333333333 ns exceeds 2^53 and rounds
  // to 9100000000000000, so an anchored third boundary would be 9100000000 ms instead of the
  // exact 9099999999.999999 ms (floored to 9099999999). Verified against Temporal.ZonedDateTime.add
  // stepping incrementally in UTC.
  it.each`
    start | end            | unit            | amount              | expected
    ${0}  | ${10000000000} | ${"nanosecond"} | ${3033333333333333} | ${[{ start: 0, end: 3033333333 }, { start: 3033333333, end: 6066666666 }, { start: 6066666666, end: 9099999999 }, { start: 9099999999, end: 10000000000 }]}
  `(
    "steps $amount $unit boundaries of $start to $end without losing precision past 2^53",
    ({ start, end, unit, amount, expected }) => {
      const restore = mockSystemTimeZone("UTC");
      try {
        expect(splitIntervalByUnitUnix(start, end, unit, amount)).toEqual(
          expected,
        );
      } finally {
        restore();
      }
    },
  );

  // Loop bound: steps that never advance past the previous boundary return [] instead of spinning.
  it.each`
    unit
    ${"day"}
    ${"hour"}
  `("returns [] when $unit steps stop advancing", ({ unit }) => {
    vi.spyOn(Temporal.ZonedDateTime.prototype, "add").mockImplementation(
      function (this: Temporal.ZonedDateTime) {
        return this;
      },
    );

    expect(splitIntervalByUnitUnix(0, 864000000, unit, 1)).toEqual([]);
  });

  // No-progress guard: a step that does not move past the previous boundary returns [] rather
  // than looping forever.
  it("returns [] when a step lands before the previous boundary", () => {
    vi.spyOn(Temporal.ZonedDateTime.prototype, "add").mockImplementation(
      function (this: Temporal.ZonedDateTime) {
        return this.subtract({ hours: 1 });
      },
    );

    expect(splitIntervalByUnitUnix(0, 36000000, "hour", 1)).toEqual([]);
  });

  const expectedExactDivision = [
    { start: 0, end: 21600000 },
    { start: 21600000, end: 43200000 },
    { start: 43200000, end: 64800000 },
    { start: 64800000, end: 86400000 },
  ];

  const expectedRemainder = [
    { start: 0, end: 3600000 },
    { start: 3600000, end: 5400000 },
  ];

  const expectedDayUnit = [
    { start: 0, end: 172800000 },
    { start: 172800000, end: 345600000 },
    { start: 345600000, end: 518400000 },
    { start: 518400000, end: 691200000 },
    { start: 691200000, end: 864000000 },
  ];

  const expectedZeroLength = [{ start: 0, end: 0 }];

  const expectedSingleStep = [{ start: 0, end: 3600000 }];

  it.each`
    start  | end           | unit      | amount | expected
    ${0}   | ${86400000}   | ${"hour"} | ${6}   | ${expectedExactDivision}
    ${0}   | ${5400000}    | ${"hour"} | ${1}   | ${expectedRemainder}
    ${0}   | ${864000000}  | ${"day"}  | ${2}   | ${expectedDayUnit}
    ${"0"} | ${"86400000"} | ${"hour"} | ${6}   | ${expectedExactDivision}
  `(
    "returns $expected for $start..$end split by $amount $unit",
    ({ start, end, unit, amount, expected }) => {
      expect(splitIntervalByUnitUnix(start, end, unit, amount)).toEqual(
        expected,
      );
    },
  );

  it.each`
    start | end        | unit      | amount | expected
    ${0}  | ${0}       | ${"hour"} | ${1}   | ${expectedZeroLength}
    ${0}  | ${3600000} | ${"hour"} | ${2}   | ${expectedSingleStep}
  `(
    "returns $expected for edge-case $start..$end split by $amount $unit",
    ({ start, end, unit, amount, expected }) => {
      expect(splitIntervalByUnitUnix(start, end, unit, amount)).toEqual(
        expected,
      );
    },
  );

  it.each`
    start        | end          | unit         | amount
    ${NaN}       | ${86400000}  | ${"hour"}    | ${1}
    ${Infinity}  | ${86400000}  | ${"hour"}    | ${1}
    ${-Infinity} | ${86400000}  | ${"hour"}    | ${1}
    ${0}         | ${NaN}       | ${"hour"}    | ${1}
    ${0}         | ${Infinity}  | ${"hour"}    | ${1}
    ${0}         | ${-Infinity} | ${"hour"}    | ${1}
    ${86400000}  | ${0}         | ${"hour"}    | ${1}
    ${0}         | ${86400000}  | ${"invalid"} | ${1}
    ${0}         | ${86400000}  | ${""}        | ${1}
    ${0}         | ${86400000}  | ${"hour"}    | ${0}
    ${0}         | ${86400000}  | ${"hour"}    | ${-1}
    ${0}         | ${86400000}  | ${"hour"}    | ${1.5}
  `(
    "returns [] for invalid $start, $end, $unit, or $amount",
    ({ start, end, unit, amount }) => {
      expect(splitIntervalByUnitUnix(start, end, unit, amount)).toEqual([]);
    },
  );

  it.each`
    start        | end          | unit         | amount
    ${null}      | ${86400000}  | ${"hour"}    | ${1}
    ${undefined} | ${86400000}  | ${"hour"}    | ${1}
    ${"abc"}     | ${86400000}  | ${"hour"}    | ${1}
    ${true}      | ${86400000}  | ${"hour"}    | ${1}
    ${[]}        | ${86400000}  | ${"hour"}    | ${1}
    ${{}}        | ${86400000}  | ${"hour"}    | ${1}
    ${0}         | ${null}      | ${"hour"}    | ${1}
    ${0}         | ${undefined} | ${"hour"}    | ${1}
    ${0}         | ${"abc"}     | ${"hour"}    | ${1}
    ${0}         | ${true}      | ${"hour"}    | ${1}
    ${0}         | ${[]}        | ${"hour"}    | ${1}
    ${0}         | ${{}}        | ${"hour"}    | ${1}
    ${0}         | ${86400000}  | ${null}      | ${1}
    ${0}         | ${86400000}  | ${undefined} | ${1}
    ${0}         | ${86400000}  | ${123}       | ${1}
    ${0}         | ${86400000}  | ${true}      | ${1}
    ${0}         | ${86400000}  | ${[]}        | ${1}
    ${0}         | ${86400000}  | ${{}}        | ${1}
    ${0}         | ${86400000}  | ${"hour"}    | ${null}
    ${0}         | ${86400000}  | ${"hour"}    | ${undefined}
    ${0}         | ${86400000}  | ${"hour"}    | ${"1"}
    ${0}         | ${86400000}  | ${"hour"}    | ${true}
  `(
    "returns [] for non-string or non-number input: $start, $end, $unit, $amount",
    ({ start, end, unit, amount }) => {
      expect(
        splitIntervalByUnitUnix(
          start as never,
          end as never,
          unit as never,
          amount as never,
        ),
      ).toEqual([]);
    },
  );
});
