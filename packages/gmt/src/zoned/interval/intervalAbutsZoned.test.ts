import { Temporal } from "@js-temporal/polyfill";
import { mockTemporalZonedDateTimeFromThrow } from "../../test/mocks";
import { battleTestTimeZones } from "../../test/timeZoneMatrix";
import { intervalAbutsZoned } from "./intervalAbutsZoned";

describe("intervalAbutsZoned", () => {
  // Half-open [start, end): two non-empty intervals abut when one's end is the same instant as the
  // other's start (Allen's "meets", either order), so they share no instant and leave no gap. An
  // empty interval abuts nothing (coding-standards § 8; A = 2024-01-01T09:00Z, B = 12:00Z,
  // C = 13:00Z, D = 17:00Z).
  it.each`
    aStart                              | aEnd                                          | bStart                                           | bEnd                                | expected | reason
    ${"2024-01-01T09:00:00+00:00[UTC]"} | ${"2024-01-01T12:00:00+00:00[UTC]"}           | ${"2024-01-01T12:00:00+00:00[UTC]"}              | ${"2024-01-01T17:00:00+00:00[UTC]"} | ${true}  | ${"[A, B) ends where [B, D) starts"}
    ${"2024-01-01T12:00:00+00:00[UTC]"} | ${"2024-01-01T17:00:00+00:00[UTC]"}           | ${"2024-01-01T09:00:00+00:00[UTC]"}              | ${"2024-01-01T12:00:00+00:00[UTC]"} | ${true}  | ${"B ends where A starts"}
    ${"2024-01-01T09:00:00+00:00[UTC]"} | ${"2024-01-01T12:00:00+00:00[UTC]"}           | ${"2024-01-01T07:00:00-05:00[America/New_York]"} | ${"2024-01-01T17:00:00+00:00[UTC]"} | ${true}  | ${"the shared instant spelled in another zone"}
    ${"2024-01-01T09:00:00+00:00[UTC]"} | ${"2024-01-01T12:00:00+00:00[UTC]"}           | ${"2024-01-01T12:00:00.000000001+00:00[UTC]"}    | ${"2024-01-01T17:00:00+00:00[UTC]"} | ${false} | ${"one nanosecond apart"}
    ${"2024-01-01T09:00:00+00:00[UTC]"} | ${"2024-01-01T12:00:00.000000001+00:00[UTC]"} | ${"2024-01-01T12:00:00+00:00[UTC]"}              | ${"2024-01-01T17:00:00+00:00[UTC]"} | ${false} | ${"one nanosecond of overlap"}
    ${"2024-01-01T09:00:00+00:00[UTC]"} | ${"2024-01-01T12:00:00+00:00[UTC]"}           | ${"2024-01-01T12:00:01+00:00[UTC]"}              | ${"2024-01-01T17:00:00+00:00[UTC]"} | ${false} | ${"a one-second gap"}
    ${"2024-01-01T09:00:00+00:00[UTC]"} | ${"2024-01-01T13:00:00+00:00[UTC]"}           | ${"2024-01-01T12:00:00+00:00[UTC]"}              | ${"2024-01-01T17:00:00+00:00[UTC]"} | ${false} | ${"overlapping [A, C) and [B, D)"}
    ${"2024-01-01T12:00:00+00:00[UTC]"} | ${"2024-01-01T12:00:00+00:00[UTC]"}           | ${"2024-01-01T12:00:00+00:00[UTC]"}              | ${"2024-01-01T17:00:00+00:00[UTC]"} | ${false} | ${"an empty A at B's start abuts nothing"}
    ${"2024-01-01T09:00:00+00:00[UTC]"} | ${"2024-01-01T12:00:00+00:00[UTC]"}           | ${"2024-01-01T12:00:00+00:00[UTC]"}              | ${"2024-01-01T12:00:00+00:00[UTC]"} | ${false} | ${"an empty B at A's end abuts nothing"}
  `(
    "returns $expected for A=[$aStart, $aEnd) and B=[$bStart, $bEnd) ($reason)",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalAbutsZoned(aStart, aEnd, bStart, bEnd)).toBe(expected);
    },
  );

  it("returns false for reversed intervals", () => {
    expect(
      intervalAbutsZoned(
        "2024-12-31T17:00:00+00:00[UTC]",
        "2024-01-01T09:00:00+00:00[UTC]",
        "2024-06-01T12:00:00+00:00[UTC]",
        "2024-07-01T13:00:00+00:00[UTC]",
      ),
    ).toBe(false);
    expect(
      intervalAbutsZoned(
        "2024-01-01T09:00:00+00:00[UTC]",
        "2024-06-30T12:00:00+00:00[UTC]",
        "2024-06-15T12:00:00+00:00[UTC]",
        "2024-06-10T12:00:00+00:00[UTC]",
      ),
    ).toBe(false);
  });

  it.each`
    aStart                              | aEnd                                | bStart                              | bEnd                                | expected
    ${"invalid"}                        | ${"2024-06-30T12:00:00+00:00[UTC]"} | ${"2024-07-01T13:00:00+00:00[UTC]"} | ${"2024-12-31T17:00:00+00:00[UTC]"} | ${false}
    ${""}                               | ${"2024-06-30T12:00:00+00:00[UTC]"} | ${"2024-07-01T13:00:00+00:00[UTC]"} | ${"2024-12-31T17:00:00+00:00[UTC]"} | ${false}
    ${"2024-01-01T09:00:00+00:00[UTC]"} | ${"invalid"}                        | ${"2024-07-01T13:00:00+00:00[UTC]"} | ${"2024-12-31T17:00:00+00:00[UTC]"} | ${false}
    ${"2024-01-01T09:00:00+00:00[UTC]"} | ${""}                               | ${"2024-07-01T13:00:00+00:00[UTC]"} | ${"2024-12-31T17:00:00+00:00[UTC]"} | ${false}
    ${"2024-01-01T09:00:00+00:00[UTC]"} | ${"2024-06-30T12:00:00+00:00[UTC]"} | ${"invalid"}                        | ${"2024-12-31T17:00:00+00:00[UTC]"} | ${false}
    ${"2024-01-01T09:00:00+00:00[UTC]"} | ${"2024-06-30T12:00:00+00:00[UTC]"} | ${""}                               | ${"2024-12-31T17:00:00+00:00[UTC]"} | ${false}
    ${"2024-01-01T09:00:00+00:00[UTC]"} | ${"2024-06-30T12:00:00+00:00[UTC]"} | ${"2024-07-01T13:00:00+00:00[UTC]"} | ${"invalid"}                        | ${false}
    ${"2024-01-01T09:00:00+00:00[UTC]"} | ${"2024-06-30T12:00:00+00:00[UTC]"} | ${"2024-07-01T13:00:00+00:00[UTC]"} | ${""}                               | ${false}
  `(
    "returns false for malformed zoned datetime: $aStart, $aEnd, $bStart, $bEnd",
    ({ aStart, aEnd, bStart, bEnd }) => {
      expect(intervalAbutsZoned(aStart, aEnd, bStart, bEnd)).toBe(false);
    },
  );

  it.each`
    aStart                              | aEnd                                | bStart                              | bEnd
    ${null}                             | ${"2024-06-30T12:00:00+00:00[UTC]"} | ${"2024-07-01T13:00:00+00:00[UTC]"} | ${"2024-12-31T17:00:00+00:00[UTC]"}
    ${"2024-01-01T09:00:00+00:00[UTC]"} | ${undefined}                        | ${"2024-07-01T13:00:00+00:00[UTC]"} | ${"2024-12-31T17:00:00+00:00[UTC]"}
    ${"2024-01-01T09:00:00+00:00[UTC]"} | ${"2024-06-30T12:00:00+00:00[UTC]"} | ${null}                             | ${"2024-12-31T17:00:00+00:00[UTC]"}
    ${"2024-01-01T09:00:00+00:00[UTC]"} | ${"2024-06-30T12:00:00+00:00[UTC]"} | ${"2024-07-01T13:00:00+00:00[UTC]"} | ${undefined}
  `("returns false for non-string input", ({ aStart, aEnd, bStart, bEnd }) => {
    expect(intervalAbutsZoned(aStart, aEnd, bStart, bEnd)).toBe(false);
  });

  it("returns false when Temporal.ZonedDateTime.from throws", () => {
    mockTemporalZonedDateTimeFromThrow();
    expect(
      intervalAbutsZoned(
        "2024-01-01T09:00:00+00:00[UTC]",
        "2024-06-30T12:00:00+00:00[UTC]",
        "2024-06-30T12:00:00.000000001+00:00[UTC]",
        "2024-12-31T17:00:00+00:00[UTC]",
      ),
    ).toBe(false);
  });

  it("proves zone-invariance across battleTestTimeZones for adjacent intervals (abuts = true)", () => {
    const aStartInstant = Temporal.Instant.from("2024-01-01T09:00:00Z");
    const aEndInstant = Temporal.Instant.from("2024-06-30T12:00:00Z");
    const bStartInstant = aEndInstant;
    const bEndInstant = Temporal.Instant.from("2024-12-31T17:00:00Z");

    for (const timeZone of battleTestTimeZones) {
      const aStart = aStartInstant.toZonedDateTimeISO(timeZone).toString();
      const aEnd = aEndInstant.toZonedDateTimeISO(timeZone).toString();
      const bStart = bStartInstant.toZonedDateTimeISO(timeZone).toString();
      const bEnd = bEndInstant.toZonedDateTimeISO(timeZone).toString();

      expect(intervalAbutsZoned(aStart, aEnd, bStart, bEnd)).toBe(true);
    }
  });

  it("proves zone-invariance across battleTestTimeZones for non-adjacent intervals with gap (abuts = false)", () => {
    const aStartInstant = Temporal.Instant.from("2024-01-01T09:00:00Z");
    const aEndInstant = Temporal.Instant.from("2024-06-30T12:00:00Z");
    const bStartInstant = Temporal.Instant.from("2024-06-30T12:00:01Z");
    const bEndInstant = Temporal.Instant.from("2024-12-31T17:00:00Z");

    for (const timeZone of battleTestTimeZones) {
      const aStart = aStartInstant.toZonedDateTimeISO(timeZone).toString();
      const aEnd = aEndInstant.toZonedDateTimeISO(timeZone).toString();
      const bStart = bStartInstant.toZonedDateTimeISO(timeZone).toString();
      const bEnd = bEndInstant.toZonedDateTimeISO(timeZone).toString();

      expect(intervalAbutsZoned(aStart, aEnd, bStart, bEnd)).toBe(false);
    }
  });

  it("proves zone-invariance across battleTestTimeZones for overlapping intervals (abuts = false)", () => {
    const aStartInstant = Temporal.Instant.from("2024-01-01T09:00:00Z");
    const aEndInstant = Temporal.Instant.from("2024-06-30T13:00:00Z");
    const bStartInstant = Temporal.Instant.from("2024-06-30T12:00:00Z");
    const bEndInstant = Temporal.Instant.from("2024-12-31T17:00:00Z");

    for (const timeZone of battleTestTimeZones) {
      const aStart = aStartInstant.toZonedDateTimeISO(timeZone).toString();
      const aEnd = aEndInstant.toZonedDateTimeISO(timeZone).toString();
      const bStart = bStartInstant.toZonedDateTimeISO(timeZone).toString();
      const bEnd = bEndInstant.toZonedDateTimeISO(timeZone).toString();

      expect(intervalAbutsZoned(aStart, aEnd, bStart, bEnd)).toBe(false);
    }
  });

  it("proves zone-invariance across battleTestTimeZones for reversed intervals (abuts = false)", () => {
    const aStartInstant = Temporal.Instant.from("2024-12-31T17:00:00Z");
    const aEndInstant = Temporal.Instant.from("2024-01-01T09:00:00Z");
    const bStartInstant = Temporal.Instant.from("2024-06-30T12:00:00Z");
    const bEndInstant = Temporal.Instant.from("2024-07-01T13:00:00Z");

    for (const timeZone of battleTestTimeZones) {
      const aStart = aStartInstant.toZonedDateTimeISO(timeZone).toString();
      const aEnd = aEndInstant.toZonedDateTimeISO(timeZone).toString();
      const bStart = bStartInstant.toZonedDateTimeISO(timeZone).toString();
      const bEnd = bEndInstant.toZonedDateTimeISO(timeZone).toString();

      expect(intervalAbutsZoned(aStart, aEnd, bStart, bEnd)).toBe(false);
    }
  });

  it("proves zone-invariance across battleTestTimeZones for a zero-length interval at another's start (abuts = false)", () => {
    const instant = Temporal.Instant.from("2024-06-15T12:00:00Z");
    const nextInstant = instant;
    const bEndInstant = Temporal.Instant.from("2024-06-15T13:00:00Z");

    for (const timeZone of battleTestTimeZones) {
      const aStart = instant.toZonedDateTimeISO(timeZone).toString();
      const aEnd = instant.toZonedDateTimeISO(timeZone).toString();
      const bStart = nextInstant.toZonedDateTimeISO(timeZone).toString();
      const bEnd = bEndInstant.toZonedDateTimeISO(timeZone).toString();

      expect(intervalAbutsZoned(aStart, aEnd, bStart, bEnd)).toBe(false);
    }
  });

  // An RFC 9557 calendar-annotated argument is valid, and ordering has no calendar check
  // (Temporal.ZonedDateTime.compare; native Chromium 153 compares the hebrew and bare 2024-01-01
  // UTC values as 0), so mixed calendars give the bare-ISO answer. Both rows are the same interval.
  it.each`
    aStart                                           | aEnd                                | bStart                                           | bEnd
    ${"2024-01-01T00:00:00+00:00[UTC][u-ca=hebrew]"} | ${"2024-06-30T23:59:59+00:00[UTC]"} | ${"2024-01-01T00:00:00+00:00[UTC]"}              | ${"2024-06-30T23:59:59+00:00[UTC]"}
    ${"2024-01-01T00:00:00+00:00[UTC]"}              | ${"2024-06-30T23:59:59+00:00[UTC]"} | ${"2024-01-01T00:00:00+00:00[UTC][u-ca=hebrew]"} | ${"2024-06-30T23:59:59+00:00[UTC]"}
  `(
    "returns false for mixed calendars (equal intervals do not abut): $aStart, $aEnd, $bStart, $bEnd",
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
      expect(intervalAbutsZoned(aStart, aEnd, bStart, bEnd)).toBe(false);
    },
  );

  // Range edge (CORE-6): the last representable instant is +275760-09-13T00:00:00Z (New York:
  // T20:00:00-04:00 on 09-12). Half-open, B ends at the instant A starts (12:00:00Z), so they abut in
  // either order with no step taken at all, and one nanosecond apart they do not.
  // Sydney (+10:00 all September) reaches the max at T10:00 on 09-13, in the last hours only a
  // positive-offset zone has: B ends at 04:00, where A starts.
  it.each`
    aStart                                              | aEnd                                                | bStart                                              | bEnd                                                | expected
    ${"+275760-09-12T12:00:00+00:00[UTC]"}              | ${"+275760-09-13T00:00:00+00:00[UTC]"}              | ${"+275760-09-12T00:00:00+00:00[UTC]"}              | ${"+275760-09-12T12:00:00+00:00[UTC]"}              | ${true}
    ${"+275760-09-12T00:00:00+00:00[UTC]"}              | ${"+275760-09-12T12:00:00+00:00[UTC]"}              | ${"+275760-09-12T12:00:00+00:00[UTC]"}              | ${"+275760-09-13T00:00:00+00:00[UTC]"}              | ${true}
    ${"+275760-09-12T12:00:00+00:00[UTC]"}              | ${"+275760-09-13T00:00:00+00:00[UTC]"}              | ${"+275760-09-12T00:00:00+00:00[UTC]"}              | ${"+275760-09-12T11:59:59.999999999+00:00[UTC]"}    | ${false}
    ${"+275760-09-12T08:00:00-04:00[America/New_York]"} | ${"+275760-09-12T20:00:00-04:00[America/New_York]"} | ${"+275760-09-11T20:00:00-04:00[America/New_York]"} | ${"+275760-09-12T08:00:00-04:00[America/New_York]"} | ${true}
    ${"+275760-09-13T00:00:00+00:00[UTC]"}              | ${"+275760-09-13T00:00:00+00:00[UTC]"}              | ${"+275760-09-12T00:00:00+00:00[UTC]"}              | ${"+275760-09-13T00:00:00+00:00[UTC]"}              | ${false}
    ${"+275760-09-13T04:00:00+10:00[Australia/Sydney]"} | ${"+275760-09-13T10:00:00+10:00[Australia/Sydney]"} | ${"+275760-09-12T10:00:00+10:00[Australia/Sydney]"} | ${"+275760-09-13T04:00:00+10:00[Australia/Sydney]"} | ${true}
  `(
    "returns $expected when A=[$aStart, $aEnd) and B=[$bStart, $bEnd) (an end at the maximum instant)",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalAbutsZoned(aStart, aEnd, bStart, bEnd)).toBe(expected);
    },
  );
});
