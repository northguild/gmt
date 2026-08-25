import { convertZonedToCalendar } from "../convert";
import { intervalAbutsZoned } from "./intervalAbutsZoned";
import { intervalContainsZoned } from "./intervalContainsZoned";
import { intervalDifferenceZoned } from "./intervalDifferenceZoned";
import { intervalDivideEquallyZoned } from "./intervalDivideEquallyZoned";
import { intervalEngulfsZoned } from "./intervalEngulfsZoned";
import { intervalIntersectionZoned } from "./intervalIntersectionZoned";
import { intervalOverlappingDaysZoned } from "./intervalOverlappingDaysZoned";
import { intervalSplitAtZoned } from "./intervalSplitAtZoned";
import { intervalUnionZoned } from "./intervalUnionZoned";
import { intervalXorAllZoned } from "./intervalXorAllZoned";
import { intervalXorZoned } from "./intervalXorZoned";
import { intervalsOverlapZoned } from "./intervalsOverlapZoned";
import { mergeIntervalsZoned } from "./mergeIntervalsZoned";

// E7 (issue #152) — D4-zoned is a single cross-cutting policy over 13 functions, so it is tested
// once as a policy rather than re-stated in 13 separate files. Ordering functions ACCEPT mixed
// calendars (ordering is calendar-independent); value-returning set operations REJECT a mismatch
// (there is no principled output calendar, and four of them return arrays whose elements would
// otherwise disagree about which calendar they are in).
//
// Every expected value was produced by running @js-temporal/polyfill@0.5.1.

// Four instants in America/New_York, deliberately spanning both 2024 DST transitions.
const A1 = "2024-01-01T00:00:00-05:00[America/New_York]";
const A2 = "2024-06-30T12:00:00-04:00[America/New_York]";
const B1 = "2024-04-01T00:00:00-04:00[America/New_York]";
const B2 = "2024-12-31T17:00:00-05:00[America/New_York]";
// One nanosecond after A2 — the abutting boundary.
const ADJ = "2024-06-30T12:00:00.000000001-04:00[America/New_York]";

const heb = (value: string) => convertZonedToCalendar(value, "hebrew");
const isl = (value: string) => convertZonedToCalendar(value, "islamic-civil");

describe("D4-zoned: ordering functions accept mixed calendars", () => {
  // Each row asserts the mixed-calendar answer equals the all-ISO control's answer for the same
  // instants — the actual claim, rather than a hardcoded boolean that could drift.
  it.each`
    name                               | isoCall                                               | mixedCall                                                                 | expected
    ${"intervalAbutsZoned"}            | ${() => intervalAbutsZoned(A1, A2, ADJ, B2)}          | ${() => intervalAbutsZoned(heb(A1), heb(A2), isl(ADJ), isl(B2))}          | ${true}
    ${"intervalContainsZoned (3-arg)"} | ${() => intervalContainsZoned(A1, B2, B1)}            | ${() => intervalContainsZoned(heb(A1), heb(B2), isl(B1))}                 | ${true}
    ${"intervalContainsZoned (4-arg)"} | ${() => intervalContainsZoned(A1, B2, B1, A2)}        | ${() => intervalContainsZoned(heb(A1), heb(B2), isl(B1), isl(A2))}        | ${true}
    ${"intervalsOverlapZoned"}         | ${() => intervalsOverlapZoned(A1, A2, B1, B2)}        | ${() => intervalsOverlapZoned(heb(A1), heb(A2), isl(B1), isl(B2))}        | ${true}
    ${"intervalEngulfsZoned"}          | ${() => intervalEngulfsZoned(A1, B2, B1, A2)}         | ${() => intervalEngulfsZoned(heb(A1), heb(B2), isl(B1), isl(A2))}         | ${true}
    ${"intervalOverlappingDaysZoned"}  | ${() => intervalOverlappingDaysZoned(A1, A2, B1, B2)} | ${() => intervalOverlappingDaysZoned(heb(A1), heb(A2), isl(B1), isl(B2))} | ${91}
  `(
    "$name returns $expected for mixed calendars, identical to the all-ISO control",
    ({ isoCall, mixedCall, expected }) => {
      const iso = (isoCall as () => unknown)();
      const mixed = (mixedCall as () => unknown)();

      expect(iso).toBe(expected);
      expect(mixed).toBe(iso);
    },
  );

  // Specifically called out in E7's definition of done: this one must return a NUMBER, not the
  // sentinel, on mixed calendars. It is the function that hit E5's finding-2 hazard in `plain/`
  // (`PlainDate.prototype.until` throws across calendars even though `.compare` does not), so
  // without the iso8601 normalization before `.until()` it would return null here.
  it("intervalOverlappingDaysZoned returns a number for mixed calendars, not null", () => {
    const result = intervalOverlappingDaysZoned(
      heb(A1),
      heb(A2),
      isl(B1),
      isl(B2),
    );

    expect(result).not.toBeNull();
    expect(typeof result).toBe("number");
    expect(result).toBe(91);
  });

  it("intervalOverlappingDaysZoned agrees across all-hebrew, mixed and all-ISO endpoints", () => {
    expect(
      intervalOverlappingDaysZoned(heb(A1), heb(A2), heb(B1), heb(B2)),
    ).toBe(91);
    expect(
      intervalOverlappingDaysZoned(heb(A1), heb(A2), isl(B1), isl(B2)),
    ).toBe(91);
    expect(intervalOverlappingDaysZoned(A1, A2, B1, B2)).toBe(91);
  });
});

describe("D4-zoned: value-returning set operations reject mismatched calendars", () => {
  it.each`
    name                            | mixedCall                                                                                          | sentinel
    ${"intervalUnionZoned"}         | ${() => intervalUnionZoned(heb(A1), heb(A2), isl(B1), isl(B2))}                                    | ${null}
    ${"intervalIntersectionZoned"}  | ${() => intervalIntersectionZoned(heb(A1), heb(A2), isl(B1), isl(B2))}                             | ${null}
    ${"intervalDifferenceZoned"}    | ${() => intervalDifferenceZoned(heb(A1), heb(B2), isl(B1), isl(A2))}                               | ${[]}
    ${"intervalXorZoned"}           | ${() => intervalXorZoned(heb(A1), heb(A2), isl(B1), isl(B2))}                                      | ${[]}
    ${"intervalXorAllZoned"}        | ${() => intervalXorAllZoned([{ start: heb(A1), end: heb(A2) }, { start: isl(B1), end: isl(B2) }])} | ${[]}
    ${"mergeIntervalsZoned"}        | ${() => mergeIntervalsZoned([{ start: heb(A1), end: heb(A2) }, { start: isl(B1), end: isl(B2) }])} | ${[]}
    ${"intervalDivideEquallyZoned"} | ${() => intervalDivideEquallyZoned(heb(A1), isl(A2), 2)}                                           | ${[]}
    ${"intervalSplitAtZoned"}       | ${() => intervalSplitAtZoned(heb(A1), heb(A2), [isl(B1)])}                                         | ${[]}
  `(
    "$name returns its sentinel for mismatched calendars",
    ({ mixedCall, sentinel }) => {
      expect((mixedCall as () => unknown)()).toEqual(sentinel);
    },
  );

  // The same-calendar control for each of the eight: they must succeed, and every boundary in the
  // result must carry the resolved calendar tag (D7-zoned — re-derived, never copied).
  it.each`
    name                            | sameCalendarCall
    ${"intervalUnionZoned"}         | ${() => intervalUnionZoned(heb(A1), heb(A2), heb(B1), heb(B2))}
    ${"intervalIntersectionZoned"}  | ${() => intervalIntersectionZoned(heb(A1), heb(A2), heb(B1), heb(B2))}
    ${"intervalDifferenceZoned"}    | ${() => intervalDifferenceZoned(heb(A1), heb(B2), heb(B1), heb(A2))}
    ${"intervalXorZoned"}           | ${() => intervalXorZoned(heb(A1), heb(A2), heb(B1), heb(B2))}
    ${"intervalXorAllZoned"}        | ${() => intervalXorAllZoned([{ start: heb(A1), end: heb(A2) }, { start: heb(B1), end: heb(B2) }])}
    ${"mergeIntervalsZoned"}        | ${() => mergeIntervalsZoned([{ start: heb(A1), end: heb(A2) }, { start: heb(B1), end: heb(B2) }])}
    ${"intervalDivideEquallyZoned"} | ${() => intervalDivideEquallyZoned(heb(A1), heb(A2), 2)}
    ${"intervalSplitAtZoned"}       | ${() => intervalSplitAtZoned(heb(A1), heb(A2), [heb(B1)])}
  `(
    "$name succeeds for same-calendar endpoints and tags every returned boundary",
    ({ sameCalendarCall }) => {
      const result = (sameCalendarCall as () => unknown)();

      expect(result).not.toBeNull();
      const records = (Array.isArray(result) ? result : [result]) as Array<{
        start: string;
        end: string;
      }>;
      expect(records.length).toBeGreaterThan(0);

      for (const record of records) {
        for (const boundary of [record.start, record.end]) {
          expect(boundary).toContain("[u-ca=hebrew]");
          expect(boundary).toContain("[America/New_York]");
          // Segment ordering: annotation before time zone, never the reverse.
          expect(boundary.indexOf("[u-ca=")).toBeLessThan(
            boundary.indexOf("[America/New_York]"),
          );
        }
      }
    },
  );

  it("intervalUnionZoned returns the resolved-calendar span for same-calendar endpoints", () => {
    expect(intervalUnionZoned(heb(A1), heb(A2), heb(B1), heb(B2))).toEqual({
      start: "5784-04-20T00:00:00-05:00[u-ca=hebrew][America/New_York]",
      end: "5785-03-30T17:00:00-05:00[u-ca=hebrew][America/New_York]",
    });
  });

  it("intervalIntersectionZoned returns the resolved-calendar overlap", () => {
    expect(
      intervalIntersectionZoned(heb(A1), heb(A2), heb(B1), heb(B2)),
    ).toEqual({
      start: "5784-07-22T00:00:00-04:00[u-ca=hebrew][America/New_York]",
      end: "5784-10-24T12:00:00-04:00[u-ca=hebrew][America/New_York]",
    });
  });

  // A synthesized boundary (`Instant.prototype.toZonedDateTimeISO`, which always returns an
  // iso8601-calendared value) must still come back tagged — this is the row that would fail if
  // `formatZonedInCalendar` did not re-calendar its input.
  it("intervalDifferenceZoned tags the synthesized nanosecond-offset boundaries", () => {
    expect(intervalDifferenceZoned(heb(A1), heb(B2), heb(B1), heb(A2))).toEqual(
      [
        {
          start: "5784-04-20T00:00:00-05:00[u-ca=hebrew][America/New_York]",
          end: "5784-07-21T23:59:59.999999999-04:00[u-ca=hebrew][America/New_York]",
        },
        {
          start:
            "5784-10-24T12:00:00.000000001-04:00[u-ca=hebrew][America/New_York]",
          end: "5785-03-30T17:00:00-05:00[u-ca=hebrew][America/New_York]",
        },
      ],
    );
  });

  it("intervalDivideEquallyZoned tags both zero-length records", () => {
    expect(intervalDivideEquallyZoned(heb(A1), heb(A1), 2)).toEqual([
      {
        start: "5784-04-20T00:00:00-05:00[u-ca=hebrew][America/New_York]",
        end: "5784-04-20T00:00:00-05:00[u-ca=hebrew][America/New_York]",
      },
      {
        start: "5784-04-20T00:00:00-05:00[u-ca=hebrew][America/New_York]",
        end: "5784-04-20T00:00:00-05:00[u-ca=hebrew][America/New_York]",
      },
    ]);
  });

  it("intervalSplitAtZoned rejects a split point whose calendar differs from the interval's", () => {
    expect(intervalSplitAtZoned(heb(A1), heb(A2), [isl(B1)])).toEqual([]);
    expect(intervalSplitAtZoned(heb(A1), heb(A2), [heb(B1)])).toHaveLength(2);
  });
});
