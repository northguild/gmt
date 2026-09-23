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
// calendars (Temporal.ZonedDateTime.compare has no calendar check); value-returning set
// operations REJECT a mismatch (there is no principled output calendar, and four of them return
// arrays whose elements would otherwise disagree about which calendar they are in). The
// day count of intervalOverlappingDaysZoned is a difference, so it rejects a mismatch too, as
// TC39 CalendarEquals makes ZonedDateTime#until throw (native Chromium 153: "Mismatched calendars.").
//
// Every expected value was produced by running @js-temporal/polyfill@0.5.1.

// Four instants in America/New_York, deliberately spanning both 2024 DST transitions.
const A1 = "2024-01-01T00:00:00-05:00[America/New_York]";
const A2 = "2024-06-30T12:00:00-04:00[America/New_York]";
const B1 = "2024-04-01T00:00:00-04:00[America/New_York]";
const B2 = "2024-12-31T17:00:00-05:00[America/New_York]";

const heb = (value: string) => convertZonedToCalendar(value, "hebrew");
const isl = (value: string) => convertZonedToCalendar(value, "islamic-civil");

describe("D4-zoned: ordering functions accept mixed calendars", () => {
  // Each row asserts the mixed-calendar answer equals the all-ISO control's answer for the same
  // instants — the actual claim, rather than a hardcoded boolean that could drift.
  it.each`
    name                               | isoCall                                        | mixedCall                                                          | expected
    ${"intervalAbutsZoned"}            | ${() => intervalAbutsZoned(A1, A2, A2, B2)}    | ${() => intervalAbutsZoned(heb(A1), heb(A2), isl(A2), isl(B2))}    | ${true}
    ${"intervalContainsZoned (3-arg)"} | ${() => intervalContainsZoned(A1, B2, B1)}     | ${() => intervalContainsZoned(heb(A1), heb(B2), isl(B1))}          | ${true}
    ${"intervalContainsZoned (4-arg)"} | ${() => intervalContainsZoned(A1, B2, B1, A2)} | ${() => intervalContainsZoned(heb(A1), heb(B2), isl(B1), isl(A2))} | ${true}
    ${"intervalsOverlapZoned"}         | ${() => intervalsOverlapZoned(A1, A2, B1, B2)} | ${() => intervalsOverlapZoned(heb(A1), heb(A2), isl(B1), isl(B2))} | ${true}
    ${"intervalEngulfsZoned"}          | ${() => intervalEngulfsZoned(A1, B2, B1, A2)}  | ${() => intervalEngulfsZoned(heb(A1), heb(B2), isl(B1), isl(A2))}  | ${true}
  `(
    "$name returns $expected for mixed calendars, identical to the all-ISO control",
    ({ isoCall, mixedCall, expected }) => {
      const iso = (isoCall as () => unknown)();
      const mixed = (mixedCall as () => unknown)();

      expect(iso).toBe(expected);
      expect(mixed).toBe(iso);
    },
  );

  it("intervalOverlappingDaysZoned counts 91 days for all-hebrew and all-ISO endpoints and returns null for mixed calendars", () => {
    expect(
      intervalOverlappingDaysZoned(heb(A1), heb(A2), heb(B1), heb(B2)),
    ).toBe(91);
    expect(intervalOverlappingDaysZoned(A1, A2, B1, B2)).toBe(91);
    expect(
      intervalOverlappingDaysZoned(heb(A1), heb(A2), isl(B1), isl(B2)),
    ).toBeNull();
    expect(intervalOverlappingDaysZoned(heb(A1), heb(A2), B1, B2)).toBeNull();
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
          // RFC 9557 §4.1 ordering: the time zone annotation, then the calendar annotation.
          expect(boundary.indexOf("[America/New_York]")).toBeLessThan(
            boundary.indexOf("[u-ca="),
          );
        }
      }
    },
  );

  it("intervalUnionZoned returns the resolved-calendar span for same-calendar endpoints", () => {
    expect(intervalUnionZoned(heb(A1), heb(A2), heb(B1), heb(B2))).toEqual({
      start: "2024-01-01T00:00:00-05:00[America/New_York][u-ca=hebrew]",
      end: "2024-12-31T17:00:00-05:00[America/New_York][u-ca=hebrew]",
    });
  });

  it("intervalIntersectionZoned returns the resolved-calendar overlap", () => {
    expect(
      intervalIntersectionZoned(heb(A1), heb(A2), heb(B1), heb(B2)),
    ).toEqual({
      start: "2024-04-01T00:00:00-04:00[America/New_York][u-ca=hebrew]",
      end: "2024-06-30T12:00:00-04:00[America/New_York][u-ca=hebrew]",
    });
  });

  // Half-open (coding-standards § 8): the cuts are B's own start and end, re-derived in the resolved calendar
  // by `formatZonedInCalendar` rather than copied from B's string.
  it("intervalDifferenceZoned tags the cut boundaries taken from B", () => {
    expect(intervalDifferenceZoned(heb(A1), heb(B2), heb(B1), heb(A2))).toEqual(
      [
        {
          start: "2024-01-01T00:00:00-05:00[America/New_York][u-ca=hebrew]",
          end: "2024-04-01T00:00:00-04:00[America/New_York][u-ca=hebrew]",
        },
        {
          start: "2024-06-30T12:00:00-04:00[America/New_York][u-ca=hebrew]",
          end: "2024-12-31T17:00:00-05:00[America/New_York][u-ca=hebrew]",
        },
      ],
    );
  });

  it("intervalDivideEquallyZoned tags both zero-length records", () => {
    expect(intervalDivideEquallyZoned(heb(A1), heb(A1), 2)).toEqual([
      {
        start: "2024-01-01T00:00:00-05:00[America/New_York][u-ca=hebrew]",
        end: "2024-01-01T00:00:00-05:00[America/New_York][u-ca=hebrew]",
      },
      {
        start: "2024-01-01T00:00:00-05:00[America/New_York][u-ca=hebrew]",
        end: "2024-01-01T00:00:00-05:00[America/New_York][u-ca=hebrew]",
      },
    ]);
  });

  it("intervalSplitAtZoned rejects a split point whose calendar differs from the interval's", () => {
    expect(intervalSplitAtZoned(heb(A1), heb(A2), [isl(B1)])).toEqual([]);
    expect(intervalSplitAtZoned(heb(A1), heb(A2), [heb(B1)])).toHaveLength(2);
  });
});
