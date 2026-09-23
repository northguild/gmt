import { Temporal } from "@js-temporal/polyfill";
import { mockTemporalZonedDateTimeFromThrow } from "../../test/mocks";
import { battleTestTimeZones } from "../../test/timeZoneMatrix";
import { intervalEngulfsZoned } from "./intervalEngulfsZoned";

describe("intervalEngulfsZoned", () => {
  it.each`
    aStart                              | aEnd                                | bStart                              | bEnd                                | expected
    ${"2024-01-01T09:00:00+00:00[UTC]"} | ${"2024-12-31T17:00:00+00:00[UTC]"} | ${"2024-06-01T12:00:00+00:00[UTC]"} | ${"2024-07-01T13:00:00+00:00[UTC]"} | ${true}
    ${"2024-01-01T09:00:00+00:00[UTC]"} | ${"2024-12-31T17:00:00+00:00[UTC]"} | ${"2024-01-01T09:00:00+00:00[UTC]"} | ${"2024-12-31T17:00:00+00:00[UTC]"} | ${true}
    ${"2024-01-01T09:00:00+00:00[UTC]"} | ${"2024-12-31T17:00:00+00:00[UTC]"} | ${"2024-01-01T09:00:00+00:00[UTC]"} | ${"2024-06-30T12:00:00+00:00[UTC]"} | ${true}
    ${"2024-06-01T12:00:00+00:00[UTC]"} | ${"2024-07-01T13:00:00+00:00[UTC]"} | ${"2024-01-01T09:00:00+00:00[UTC]"} | ${"2024-12-31T17:00:00+00:00[UTC]"} | ${false}
    ${"2024-01-01T09:00:00+00:00[UTC]"} | ${"2024-12-31T17:00:00+00:00[UTC]"} | ${"2023-12-01T00:00:00+00:00[UTC]"} | ${"2024-06-15T12:00:00+00:00[UTC]"} | ${false}
    ${"2024-01-01T09:00:00+00:00[UTC]"} | ${"2024-12-31T17:00:00+00:00[UTC]"} | ${"2024-06-15T12:00:00+00:00[UTC]"} | ${"2025-01-01T00:00:00+00:00[UTC]"} | ${false}
    ${"2024-06-15T12:00:00+00:00[UTC]"} | ${"2024-06-15T12:00:00+00:00[UTC]"} | ${"2024-06-15T12:00:00+00:00[UTC]"} | ${"2024-06-15T12:00:00+00:00[UTC]"} | ${false}
    ${"2024-01-01T09:00:00+00:00[UTC]"} | ${"2024-12-31T17:00:00+00:00[UTC]"} | ${"2024-06-15T12:00:00+00:00[UTC]"} | ${"2024-06-10T00:00:00+00:00[UTC]"} | ${false}
  `(
    "returns $expected when A=$aStart to $aEnd, B=$bStart to $bEnd",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalEngulfsZoned(aStart, aEnd, bStart, bEnd)).toBe(expected);
    },
  );

  // Half-open [start, end) (coding-standards § 8; A = 2024-01-01T09:00Z, B = 12:00Z, C = 13:00Z,
  // D = 17:00Z). B is inside A when the two overlap and B's bounds lie within A's by instant, so B
  // may share A's end, and an empty B counts only strictly inside A — as `clampInterval` clamps it
  // to itself there and to `null` at an edge.
  it.each`
    aStart                              | aEnd                                | bStart                                           | bEnd                                             | expected | reason
    ${"2024-01-01T09:00:00+00:00[UTC]"} | ${"2024-01-01T17:00:00+00:00[UTC]"} | ${"2024-01-01T12:00:00+00:00[UTC]"}              | ${"2024-01-01T17:00:00+00:00[UTC]"}              | ${true}  | ${"[B, D) shares the end of [A, D)"}
    ${"2024-01-01T09:00:00+00:00[UTC]"} | ${"2024-01-01T17:00:00+00:00[UTC]"} | ${"2024-01-01T07:00:00-05:00[America/New_York]"} | ${"2024-01-01T12:00:00-05:00[America/New_York]"} | ${true}  | ${"[B, D) in New York shares the end of [A, D)"}
    ${"2024-01-01T09:00:00+00:00[UTC]"} | ${"2024-01-01T17:00:00+00:00[UTC]"} | ${"2024-01-01T12:00:00+00:00[UTC]"}              | ${"2024-01-01T12:00:00+00:00[UTC]"}              | ${true}  | ${"empty [B, B) strictly inside"}
    ${"2024-01-01T09:00:00+00:00[UTC]"} | ${"2024-01-01T17:00:00+00:00[UTC]"} | ${"2024-01-01T17:00:00+00:00[UTC]"}              | ${"2024-01-01T17:00:00+00:00[UTC]"}              | ${false} | ${"empty [D, D) at the end edge"}
    ${"2024-01-01T09:00:00+00:00[UTC]"} | ${"2024-01-01T17:00:00+00:00[UTC]"} | ${"2024-01-01T09:00:00+00:00[UTC]"}              | ${"2024-01-01T09:00:00+00:00[UTC]"}              | ${false} | ${"empty [A, A) at the start edge"}
    ${"2024-01-01T09:00:00+00:00[UTC]"} | ${"2024-01-01T12:00:00+00:00[UTC]"} | ${"2024-01-01T13:00:00+00:00[UTC]"}              | ${"2024-01-01T13:00:00+00:00[UTC]"}              | ${false} | ${"empty [C, C) beyond the end of [A, B)"}
    ${"2024-01-01T09:00:00+00:00[UTC]"} | ${"2024-01-01T12:00:00+00:00[UTC]"} | ${"2024-01-01T12:00:00+00:00[UTC]"}              | ${"2024-01-01T12:00:00.000000001+00:00[UTC]"}    | ${false} | ${"B runs one nanosecond past A's end"}
  `(
    "returns $expected for A=[$aStart, $aEnd) and B=[$bStart, $bEnd) ($reason)",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalEngulfsZoned(aStart, aEnd, bStart, bEnd)).toBe(expected);
    },
  );

  it.each`
    aStart                              | aEnd                                | bStart                              | bEnd                                | reason
    ${"2024-12-31T17:00:00+00:00[UTC]"} | ${"2024-01-01T09:00:00+00:00[UTC]"} | ${"2024-06-01T12:00:00+00:00[UTC]"} | ${"2024-07-01T13:00:00+00:00[UTC]"} | ${"reversed A"}
    ${"2024-06-01T12:00:00+00:00[UTC]"} | ${"2024-07-01T13:00:00+00:00[UTC]"} | ${"2024-12-31T17:00:00+00:00[UTC]"} | ${"2024-01-01T09:00:00+00:00[UTC]"} | ${"reversed B"}
    ${"invalid"}                        | ${"2024-12-31T17:00:00+00:00[UTC]"} | ${"2024-06-01T12:00:00+00:00[UTC]"} | ${"2024-07-01T13:00:00+00:00[UTC]"} | ${"invalid A start"}
    ${"2024-01-01T09:00:00+00:00[UTC]"} | ${"invalid"}                        | ${"2024-06-01T12:00:00+00:00[UTC]"} | ${"2024-07-01T13:00:00+00:00[UTC]"} | ${"invalid A end"}
    ${"2024-01-01T09:00:00+00:00[UTC]"} | ${"2024-12-31T17:00:00+00:00[UTC]"} | ${"invalid"}                        | ${"2024-07-01T13:00:00+00:00[UTC]"} | ${"invalid B start"}
    ${"2024-01-01T09:00:00+00:00[UTC]"} | ${"2024-12-31T17:00:00+00:00[UTC]"} | ${"2024-06-01T12:00:00+00:00[UTC]"} | ${"invalid"}                        | ${"invalid B end"}
    ${123}                              | ${"2024-12-31T17:00:00+00:00[UTC]"} | ${"2024-06-01T12:00:00+00:00[UTC]"} | ${"2024-07-01T13:00:00+00:00[UTC]"} | ${"wrong type A start"}
    ${null}                             | ${"2024-12-31T17:00:00+00:00[UTC]"} | ${"2024-06-01T12:00:00+00:00[UTC]"} | ${"2024-07-01T13:00:00+00:00[UTC]"} | ${"null A start"}
  `("returns false for $reason", ({ aStart, aEnd, bStart, bEnd }) => {
    expect(intervalEngulfsZoned(aStart as any, aEnd, bStart, bEnd)).toBe(false);
  });

  it("returns false when Temporal.ZonedDateTime.from throws", () => {
    mockTemporalZonedDateTimeFromThrow();
    expect(
      intervalEngulfsZoned(
        "2024-01-01T09:00:00+00:00[UTC]",
        "2024-12-31T17:00:00+00:00[UTC]",
        "2024-06-01T12:00:00+00:00[UTC]",
        "2024-07-01T13:00:00+00:00[UTC]",
      ),
    ).toBe(false);
  });

  it("proves zone-invariance across battleTestTimeZones for B fully inside A (engulfs = true)", () => {
    const aStartInstant = Temporal.Instant.from("2024-01-01T09:00:00Z");
    const aEndInstant = Temporal.Instant.from("2024-12-31T17:00:00Z");
    const bStartInstant = Temporal.Instant.from("2024-06-01T12:00:00Z");
    const bEndInstant = Temporal.Instant.from("2024-07-01T13:00:00Z");

    for (const timeZone of battleTestTimeZones) {
      const aStart = aStartInstant.toZonedDateTimeISO(timeZone).toString();
      const aEnd = aEndInstant.toZonedDateTimeISO(timeZone).toString();
      const bStart = bStartInstant.toZonedDateTimeISO(timeZone).toString();
      const bEnd = bEndInstant.toZonedDateTimeISO(timeZone).toString();

      expect(intervalEngulfsZoned(aStart, aEnd, bStart, bEnd)).toBe(true);
    }
  });

  it("proves zone-invariance across battleTestTimeZones for identical intervals (engulfs = true)", () => {
    const startInstant = Temporal.Instant.from("2024-06-15T12:00:00Z");
    const endInstant = Temporal.Instant.from("2024-06-15T13:00:00Z");

    for (const timeZone of battleTestTimeZones) {
      const aStart = startInstant.toZonedDateTimeISO(timeZone).toString();
      const aEnd = endInstant.toZonedDateTimeISO(timeZone).toString();
      const bStart = startInstant.toZonedDateTimeISO(timeZone).toString();
      const bEnd = endInstant.toZonedDateTimeISO(timeZone).toString();

      expect(intervalEngulfsZoned(aStart, aEnd, bStart, bEnd)).toBe(true);
    }
  });

  it("proves zone-invariance across battleTestTimeZones for B partially outside A start (engulfs = false)", () => {
    const aStartInstant = Temporal.Instant.from("2024-01-01T09:00:00Z");
    const aEndInstant = Temporal.Instant.from("2024-12-31T17:00:00Z");
    const bStartInstant = Temporal.Instant.from("2023-12-01T00:00:00Z");
    const bEndInstant = Temporal.Instant.from("2024-06-15T12:00:00Z");

    for (const timeZone of battleTestTimeZones) {
      const aStart = aStartInstant.toZonedDateTimeISO(timeZone).toString();
      const aEnd = aEndInstant.toZonedDateTimeISO(timeZone).toString();
      const bStart = bStartInstant.toZonedDateTimeISO(timeZone).toString();
      const bEnd = bEndInstant.toZonedDateTimeISO(timeZone).toString();

      expect(intervalEngulfsZoned(aStart, aEnd, bStart, bEnd)).toBe(false);
    }
  });

  it("proves zone-invariance across battleTestTimeZones for B partially outside A end (engulfs = false)", () => {
    const aStartInstant = Temporal.Instant.from("2024-01-01T09:00:00Z");
    const aEndInstant = Temporal.Instant.from("2024-12-31T17:00:00Z");
    const bStartInstant = Temporal.Instant.from("2024-06-15T12:00:00Z");
    const bEndInstant = Temporal.Instant.from("2025-01-01T00:00:00Z");

    for (const timeZone of battleTestTimeZones) {
      const aStart = aStartInstant.toZonedDateTimeISO(timeZone).toString();
      const aEnd = aEndInstant.toZonedDateTimeISO(timeZone).toString();
      const bStart = bStartInstant.toZonedDateTimeISO(timeZone).toString();
      const bEnd = bEndInstant.toZonedDateTimeISO(timeZone).toString();

      expect(intervalEngulfsZoned(aStart, aEnd, bStart, bEnd)).toBe(false);
    }
  });

  it("proves zone-invariance across battleTestTimeZones for reversed intervals (engulfs = false)", () => {
    const aStartInstant = Temporal.Instant.from("2024-12-31T17:00:00Z");
    const aEndInstant = Temporal.Instant.from("2024-01-01T09:00:00Z");
    const bStartInstant = Temporal.Instant.from("2024-06-01T12:00:00Z");
    const bEndInstant = Temporal.Instant.from("2024-07-01T13:00:00Z");

    for (const timeZone of battleTestTimeZones) {
      const aStart = aStartInstant.toZonedDateTimeISO(timeZone).toString();
      const aEnd = aEndInstant.toZonedDateTimeISO(timeZone).toString();
      const bStart = bStartInstant.toZonedDateTimeISO(timeZone).toString();
      const bEnd = bEndInstant.toZonedDateTimeISO(timeZone).toString();

      expect(intervalEngulfsZoned(aStart, aEnd, bStart, bEnd)).toBe(false);
    }
  });

  it("proves zone-invariance across battleTestTimeZones for B completely outside A (engulfs = false)", () => {
    const aStartInstant = Temporal.Instant.from("2024-01-01T09:00:00Z");
    const aEndInstant = Temporal.Instant.from("2024-06-30T12:00:00Z");
    const bStartInstant = Temporal.Instant.from("2024-07-01T13:00:00Z");
    const bEndInstant = Temporal.Instant.from("2024-12-31T17:00:00Z");

    for (const timeZone of battleTestTimeZones) {
      const aStart = aStartInstant.toZonedDateTimeISO(timeZone).toString();
      const aEnd = aEndInstant.toZonedDateTimeISO(timeZone).toString();
      const bStart = bStartInstant.toZonedDateTimeISO(timeZone).toString();
      const bEnd = bEndInstant.toZonedDateTimeISO(timeZone).toString();

      expect(intervalEngulfsZoned(aStart, aEnd, bStart, bEnd)).toBe(false);
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
    "returns true for mixed calendars (equal intervals engulf each other): $aStart, $aEnd, $bStart, $bEnd",
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
      expect(intervalEngulfsZoned(aStart, aEnd, bStart, bEnd)).toBe(true);
    },
  );
});
