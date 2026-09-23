import { mockTemporalZonedDateTimeFromThrow } from "../../test/mocks";
import { intervalsOverlapZoned } from "./intervalsOverlapZoned";

describe("intervalsOverlapZoned", () => {
  // Half-open [start, end), as in `intervalsOverlap`: `aStart < bEnd && bStart < aEnd` by instant.
  // A = 2024-01-01T09:00Z, B = 12:00Z, C = 13:00Z, D = 17:00Z (coding-standards § 8).
  it.each`
    aStart                                           | aEnd                                             | bStart                                        | bEnd                                | expected | reason
    ${"2024-01-01T09:00:00+00:00[UTC]"}              | ${"2024-01-01T13:00:00+00:00[UTC]"}              | ${"2024-01-01T12:00:00+00:00[UTC]"}           | ${"2024-01-01T17:00:00+00:00[UTC]"} | ${true}  | ${"partial overlap [A, C) and [B, D)"}
    ${"2024-01-01T09:00:00+00:00[UTC]"}              | ${"2024-01-01T17:00:00+00:00[UTC]"}              | ${"2024-01-01T12:00:00+00:00[UTC]"}           | ${"2024-01-01T13:00:00+00:00[UTC]"} | ${true}  | ${"[B, C) strictly inside [A, D)"}
    ${"2024-01-01T09:00:00+00:00[UTC]"}              | ${"2024-01-01T12:00:00+00:00[UTC]"}              | ${"2024-01-01T12:00:00+00:00[UTC]"}           | ${"2024-01-01T17:00:00+00:00[UTC]"} | ${false} | ${"touching: [A, B) ends where [B, D) starts"}
    ${"2024-01-01T12:00:00+00:00[UTC]"}              | ${"2024-01-01T17:00:00+00:00[UTC]"}              | ${"2024-01-01T09:00:00+00:00[UTC]"}           | ${"2024-01-01T12:00:00+00:00[UTC]"} | ${false} | ${"touching, arguments swapped"}
    ${"2024-01-01T04:00:00-05:00[America/New_York]"} | ${"2024-01-01T07:00:00-05:00[America/New_York]"} | ${"2024-01-01T12:00:00+00:00[UTC]"}           | ${"2024-01-01T17:00:00+00:00[UTC]"} | ${false} | ${"touching across zones: 07:00-05:00 is B"}
    ${"2024-01-01T09:00:00+00:00[UTC]"}              | ${"2024-01-01T12:00:00+00:00[UTC]"}              | ${"2024-01-01T12:00:00.000000001+00:00[UTC]"} | ${"2024-01-01T17:00:00+00:00[UTC]"} | ${false} | ${"one-nanosecond gap"}
    ${"2024-01-01T09:00:00+00:00[UTC]"}              | ${"2024-01-01T12:00:00.000000001+00:00[UTC]"}    | ${"2024-01-01T12:00:00+00:00[UTC]"}           | ${"2024-01-01T17:00:00+00:00[UTC]"} | ${true}  | ${"one-nanosecond overlap"}
    ${"2024-01-01T09:00:00+00:00[UTC]"}              | ${"2024-01-01T17:00:00+00:00[UTC]"}              | ${"2024-01-01T12:00:00+00:00[UTC]"}           | ${"2024-01-01T12:00:00+00:00[UTC]"} | ${true}  | ${"empty [B, B) strictly inside [A, D)"}
    ${"2024-01-01T09:00:00+00:00[UTC]"}              | ${"2024-01-01T17:00:00+00:00[UTC]"}              | ${"2024-01-01T09:00:00+00:00[UTC]"}           | ${"2024-01-01T09:00:00+00:00[UTC]"} | ${false} | ${"empty [A, A) at the start edge"}
    ${"2024-01-01T09:00:00+00:00[UTC]"}              | ${"2024-01-01T17:00:00+00:00[UTC]"}              | ${"2024-01-01T17:00:00+00:00[UTC]"}           | ${"2024-01-01T17:00:00+00:00[UTC]"} | ${false} | ${"empty [D, D) at the end edge"}
    ${"2024-01-01T12:00:00+00:00[UTC]"}              | ${"2024-01-01T12:00:00+00:00[UTC]"}              | ${"2024-01-01T12:00:00+00:00[UTC]"}           | ${"2024-01-01T12:00:00+00:00[UTC]"} | ${false} | ${"two identical empty intervals"}
  `(
    "returns $expected for [$aStart, $aEnd) and [$bStart, $bEnd) ($reason)",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalsOverlapZoned(aStart, aEnd, bStart, bEnd)).toBe(expected);
    },
  );

  it.each`
    aStart                              | aEnd                                | bStart                              | bEnd                                | expected
    ${"2024-06-30T23:59:59+00:00[UTC]"} | ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-12-31T23:59:59+00:00[UTC]"} | ${"2024-04-01T00:00:00+00:00[UTC]"} | ${false}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-06-30T23:59:59+00:00[UTC]"} | ${"2024-06-30T23:59:59+00:00[UTC]"} | ${"2024-05-01T00:00:00+00:00[UTC]"} | ${false}
  `(
    "returns $expected for reversed intervals",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalsOverlapZoned(aStart, aEnd, bStart, bEnd)).toBe(expected);
    },
  );

  it.each`
    aStart                              | aEnd                                | bStart                              | bEnd
    ${"invalid"}                        | ${"2024-06-30T23:59:59+00:00[UTC]"} | ${"2024-04-01T00:00:00+00:00[UTC]"} | ${"2024-12-31T23:59:59+00:00[UTC]"}
    ${""}                               | ${"2024-06-30T23:59:59+00:00[UTC]"} | ${"2024-04-01T00:00:00+00:00[UTC]"} | ${"2024-12-31T23:59:59+00:00[UTC]"}
    ${"not-a-zoned"}                    | ${"2024-06-30T23:59:59+00:00[UTC]"} | ${"2024-04-01T00:00:00+00:00[UTC]"} | ${"2024-12-31T23:59:59+00:00[UTC]"}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"invalid"}                        | ${"2024-04-01T00:00:00+00:00[UTC]"} | ${"2024-12-31T23:59:59+00:00[UTC]"}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${""}                               | ${"2024-04-01T00:00:00+00:00[UTC]"} | ${"2024-12-31T23:59:59+00:00[UTC]"}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"not-a-zoned"}                    | ${"2024-04-01T00:00:00+00:00[UTC]"} | ${"2024-12-31T23:59:59+00:00[UTC]"}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-06-30T23:59:59+00:00[UTC]"} | ${"invalid"}                        | ${"2024-12-31T23:59:59+00:00[UTC]"}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-06-30T23:59:59+00:00[UTC]"} | ${""}                               | ${"2024-12-31T23:59:59+00:00[UTC]"}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-06-30T23:59:59+00:00[UTC]"} | ${"not-a-zoned"}                    | ${"2024-12-31T23:59:59+00:00[UTC]"}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-06-30T23:59:59+00:00[UTC]"} | ${"2024-04-01T00:00:00+00:00[UTC]"} | ${"invalid"}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-06-30T23:59:59+00:00[UTC]"} | ${"2024-04-01T00:00:00+00:00[UTC]"} | ${""}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-06-30T23:59:59+00:00[UTC]"} | ${"2024-04-01T00:00:00+00:00[UTC]"} | ${"not-a-zoned"}
  `("returns false for malformed zoned", ({ aStart, aEnd, bStart, bEnd }) => {
    expect(intervalsOverlapZoned(aStart, aEnd, bStart, bEnd)).toBe(false);
  });

  it.each`
    aStart          | aEnd            | bStart          | bEnd
    ${null}         | ${"2024-01-01"} | ${"2024-01-01"} | ${"2024-01-01"}
    ${"2024-01-01"} | ${null}         | ${"2024-01-01"} | ${"2024-01-01"}
    ${"2024-01-01"} | ${"2024-01-01"} | ${null}         | ${"2024-01-01"}
    ${"2024-01-01"} | ${"2024-01-01"} | ${"2024-01-01"} | ${null}
  `("returns false for non-string input", ({ aStart, aEnd, bStart, bEnd }) => {
    expect(
      intervalsOverlapZoned(
        aStart as never,
        aEnd as never,
        bStart as never,
        bEnd as never,
      ),
    ).toBe(false);
  });

  it("returns false when Temporal.ZonedDateTime.from throws", () => {
    mockTemporalZonedDateTimeFromThrow();
    expect(
      intervalsOverlapZoned(
        "2024-01-01T00:00:00+00:00[UTC]",
        "2024-06-30T23:59:59+00:00[UTC]",
        "2024-04-01T00:00:00+00:00[UTC]",
        "2024-12-31T23:59:59+00:00[UTC]",
      ),
    ).toBe(false);
  });

  // An RFC 9557 calendar-annotated argument is valid, and ordering has no calendar check
  // (Temporal.ZonedDateTime.compare; native Chromium 153 compares the hebrew and bare 2024-01-01
  // UTC values as 0), so mixed calendars give the bare-ISO answer. Both rows are the same interval.
  it.each`
    aStart                                           | aEnd                                | bStart                                           | bEnd
    ${"2024-01-01T00:00:00+00:00[UTC][u-ca=hebrew]"} | ${"2024-06-30T23:59:59+00:00[UTC]"} | ${"2024-01-01T00:00:00+00:00[UTC]"}              | ${"2024-06-30T23:59:59+00:00[UTC]"}
    ${"2024-01-01T00:00:00+00:00[UTC]"}              | ${"2024-06-30T23:59:59+00:00[UTC]"} | ${"2024-01-01T00:00:00+00:00[UTC][u-ca=hebrew]"} | ${"2024-06-30T23:59:59+00:00[UTC]"}
  `(
    "returns true for mixed calendars (equal non-empty intervals overlap): $aStart, $aEnd, $bStart, $bEnd",
    ({
      aStart,
      aEnd,
      bStart,
      bEnd,
    }: {
      aStart: string;
      aEnd: string;
      bStart: string;
      bEnd: string;
    }) => {
      expect(intervalsOverlapZoned(aStart, aEnd, bStart, bEnd)).toBe(true);
    },
  );
});
