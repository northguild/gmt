import { Temporal } from "@js-temporal/polyfill";
import { mockTemporalZonedDateTimeFromThrow } from "../../test/mocks";
import { battleTestTimeZones } from "../../test/timeZoneMatrix";
import { intervalXorZoned } from "./intervalXorZoned";

describe("intervalXorZoned", () => {
  // Half-open [start, end): the result is every maximal run covered by exactly one interval, sorted
  // by start. Touching intervals share no instant, so they join into one run, and every boundary is
  // an input's own start or end — no nanosecond step (coding-standards § 8; A = 2024-01-01T09:00Z,
  // B = 12:00Z, C = 13:00Z, D = 17:00Z).
  it.each`
    aStart                              | aEnd                                | bStart                                           | bEnd                                | expected                                                                                                                                                                                 | reason
    ${"2024-01-01T09:00:00+00:00[UTC]"} | ${"2024-01-01T13:00:00+00:00[UTC]"} | ${"2024-01-01T12:00:00+00:00[UTC]"}              | ${"2024-01-01T17:00:00+00:00[UTC]"} | ${[{ start: "2024-01-01T09:00:00+00:00[UTC]", end: "2024-01-01T12:00:00+00:00[UTC]" }, { start: "2024-01-01T13:00:00+00:00[UTC]", end: "2024-01-01T17:00:00+00:00[UTC]" }]}              | ${"[A, C) xor [B, D) is [A, B) and [C, D)"}
    ${"2024-01-01T09:00:00+00:00[UTC]"} | ${"2024-01-01T13:00:00+00:00[UTC]"} | ${"2024-01-01T07:00:00-05:00[America/New_York]"} | ${"2024-01-01T17:00:00+00:00[UTC]"} | ${[{ start: "2024-01-01T09:00:00+00:00[UTC]", end: "2024-01-01T07:00:00-05:00[America/New_York]" }, { start: "2024-01-01T13:00:00+00:00[UTC]", end: "2024-01-01T17:00:00+00:00[UTC]" }]} | ${"a boundary keeps the zone of the input that supplied it"}
    ${"2024-01-01T09:00:00+00:00[UTC]"} | ${"2024-06-30T12:00:00+00:00[UTC]"} | ${"2024-06-30T12:00:00+00:00[UTC]"}              | ${"2024-12-31T17:00:00+00:00[UTC]"} | ${[{ start: "2024-01-01T09:00:00+00:00[UTC]", end: "2024-12-31T17:00:00+00:00[UTC]" }]}                                                                                                  | ${"A ends where B starts: one joined run"}
    ${"2024-06-30T12:00:00+00:00[UTC]"} | ${"2024-12-31T17:00:00+00:00[UTC]"} | ${"2024-01-01T09:00:00+00:00[UTC]"}              | ${"2024-06-30T12:00:00+00:00[UTC]"} | ${[{ start: "2024-01-01T09:00:00+00:00[UTC]", end: "2024-12-31T17:00:00+00:00[UTC]" }]}                                                                                                  | ${"A starts where B ends: one joined run"}
    ${"2024-01-01T09:00:00+00:00[UTC]"} | ${"2024-06-30T12:00:00+00:00[UTC]"} | ${"2024-01-01T09:00:00+00:00[UTC]"}              | ${"2024-12-31T17:00:00+00:00[UTC]"} | ${[{ start: "2024-06-30T12:00:00+00:00[UTC]", end: "2024-12-31T17:00:00+00:00[UTC]" }]}                                                                                                  | ${"shared start"}
    ${"2024-01-01T09:00:00+00:00[UTC]"} | ${"2024-12-31T17:00:00+00:00[UTC]"} | ${"2024-06-30T12:00:00+00:00[UTC]"}              | ${"2024-12-31T17:00:00+00:00[UTC]"} | ${[{ start: "2024-01-01T09:00:00+00:00[UTC]", end: "2024-06-30T12:00:00+00:00[UTC]" }]}                                                                                                  | ${"shared end"}
    ${"2024-07-01T13:00:00+00:00[UTC]"} | ${"2024-12-31T17:00:00+00:00[UTC]"} | ${"2024-01-01T09:00:00+00:00[UTC]"}              | ${"2024-06-30T12:00:00+00:00[UTC]"} | ${[{ start: "2024-01-01T09:00:00+00:00[UTC]", end: "2024-06-30T12:00:00+00:00[UTC]" }, { start: "2024-07-01T13:00:00+00:00[UTC]", end: "2024-12-31T17:00:00+00:00[UTC]" }]}              | ${"disjoint, B first: sorted by start"}
    ${"2024-01-01T09:00:00+00:00[UTC]"} | ${"2024-01-01T17:00:00+00:00[UTC]"} | ${"2024-01-01T12:00:00+00:00[UTC]"}              | ${"2024-01-01T12:00:00+00:00[UTC]"} | ${[{ start: "2024-01-01T09:00:00+00:00[UTC]", end: "2024-01-01T17:00:00+00:00[UTC]" }]}                                                                                                  | ${"an empty B holds no instant"}
  `(
    "returns $expected for A=[$aStart, $aEnd) xor B=[$bStart, $bEnd) ($reason)",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalXorZoned(aStart, aEnd, bStart, bEnd)).toEqual(expected);
    },
  );

  it.each`
    aStart                              | aEnd                                | bStart                              | bEnd                                | expected
    ${"2024-01-01T09:00:00+00:00[UTC]"} | ${"2024-06-30T12:00:00+00:00[UTC]"} | ${"2024-04-01T11:00:00+00:00[UTC]"} | ${"2024-12-31T17:00:00+00:00[UTC]"} | ${{ count: 2 }}
    ${"2024-01-01T09:00:00+00:00[UTC]"} | ${"2024-12-31T17:00:00+00:00[UTC]"} | ${"2024-04-01T11:00:00+00:00[UTC]"} | ${"2024-06-30T12:00:00+00:00[UTC]"} | ${{ count: 2 }}
    ${"2024-01-01T09:00:00+00:00[UTC]"} | ${"2024-12-31T17:00:00+00:00[UTC]"} | ${"2024-01-01T09:00:00+00:00[UTC]"} | ${"2024-12-31T17:00:00+00:00[UTC]"} | ${{ count: 0 }}
    ${"2024-01-01T09:00:00+00:00[UTC]"} | ${"2024-12-31T17:00:00+00:00[UTC]"} | ${"2025-01-01T00:00:00+00:00[UTC]"} | ${"2025-06-01T00:00:00+00:00[UTC]"} | ${{ count: 2 }}
    ${"2024-06-15T12:00:00+00:00[UTC]"} | ${"2024-06-15T12:00:00+00:00[UTC]"} | ${"2024-06-15T12:00:00+00:00[UTC]"} | ${"2024-06-15T12:00:00+00:00[UTC]"} | ${{ count: 0 }}
    ${"2024-01-01T09:00:00+00:00[UTC]"} | ${"2024-06-30T12:00:00+00:00[UTC]"} | ${"2024-07-01T13:00:00+00:00[UTC]"} | ${"2024-12-31T17:00:00+00:00[UTC]"} | ${{ count: 2 }}
  `(
    "returns $expected when A=$aStart to $aEnd, B=$bStart to $bEnd",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      const result = intervalXorZoned(aStart, aEnd, bStart, bEnd);
      expect(result).toHaveLength(expected.count);
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
  `("returns [] for $reason", ({ aStart, aEnd, bStart, bEnd }) => {
    expect(intervalXorZoned(aStart as any, aEnd, bStart, bEnd)).toEqual([]);
  });

  it("returns [] when Temporal.ZonedDateTime.from throws", () => {
    mockTemporalZonedDateTimeFromThrow();
    expect(
      intervalXorZoned(
        "2024-01-01T09:00:00+00:00[UTC]",
        "2024-06-30T12:00:00+00:00[UTC]",
        "2024-04-01T11:00:00+00:00[UTC]",
        "2024-12-31T17:00:00+00:00[UTC]",
      ),
    ).toEqual([]);
  });

  it("cuts interior boundaries exactly at the overlap edges — no nanosecond step, not rounded to the second", () => {
    // Half-open: the piece before the overlap ends at B's start and the piece after it starts at A's
    // end, each excluded from the piece it bounds on the other side.
    const result = intervalXorZoned(
      "2024-01-01T09:00:00+00:00[UTC]",
      "2024-06-30T12:00:00+00:00[UTC]",
      "2024-04-01T11:00:00+00:00[UTC]",
      "2024-12-31T17:00:00+00:00[UTC]",
    );
    expect(result).toEqual([
      {
        start: "2024-01-01T09:00:00+00:00[UTC]",
        end: "2024-04-01T11:00:00+00:00[UTC]",
      },
      {
        start: "2024-06-30T12:00:00+00:00[UTC]",
        end: "2024-12-31T17:00:00+00:00[UTC]",
      },
    ]);
  });

  it("returns two remainder pieces (not one) when B is strictly contained inside A", () => {
    // Full containment leaves the part of A before B and the part after it: two pieces, the same
    // shape as a partial overlap.
    const result = intervalXorZoned(
      "2024-01-01T09:00:00+00:00[UTC]",
      "2024-12-31T17:00:00+00:00[UTC]",
      "2024-02-01T08:00:00+00:00[UTC]",
      "2024-03-01T10:00:00+00:00[UTC]",
    );
    expect(result).toEqual([
      {
        start: "2024-01-01T09:00:00+00:00[UTC]",
        end: "2024-02-01T08:00:00+00:00[UTC]",
      },
      {
        start: "2024-03-01T10:00:00+00:00[UTC]",
        end: "2024-12-31T17:00:00+00:00[UTC]",
      },
    ]);
  });

  it("proves zone-invariance across battleTestTimeZones for overlapping intervals with xor on both sides", () => {
    const aStartInstant = Temporal.Instant.from("2024-01-01T09:00:00Z");
    const aEndInstant = Temporal.Instant.from("2024-06-30T12:00:00Z");
    const bStartInstant = Temporal.Instant.from("2024-04-01T11:00:00Z");
    const bEndInstant = Temporal.Instant.from("2024-12-31T17:00:00Z");

    for (const timeZone of battleTestTimeZones) {
      const aStart = aStartInstant.toZonedDateTimeISO(timeZone).toString();
      const aEnd = aEndInstant.toZonedDateTimeISO(timeZone).toString();
      const bStart = bStartInstant.toZonedDateTimeISO(timeZone).toString();
      const bEnd = bEndInstant.toZonedDateTimeISO(timeZone).toString();

      const result = intervalXorZoned(aStart, aEnd, bStart, bEnd);

      expect(result).toHaveLength(2);
      // First piece: A start to B start
      expect(
        Temporal.ZonedDateTime.from(result[0].start).toInstant().toString(),
      ).toBe(aStartInstant.toString());
      expect(
        Temporal.ZonedDateTime.from(result[0].end).toInstant().toString(),
      ).toBe(bStartInstant.toString());
      // Second piece: A end to B end
      expect(
        Temporal.ZonedDateTime.from(result[1].start).toInstant().toString(),
      ).toBe(aEndInstant.toString());
      expect(
        Temporal.ZonedDateTime.from(result[1].end).toInstant().toString(),
      ).toBe(bEndInstant.toString());
    }
  });

  it("proves zone-invariance across battleTestTimeZones for identical intervals (xor is empty)", () => {
    const instant = Temporal.Instant.from("2024-06-15T12:00:00Z");

    for (const timeZone of battleTestTimeZones) {
      const aStart = instant.toZonedDateTimeISO(timeZone).toString();
      const aEnd = instant.toZonedDateTimeISO(timeZone).toString();
      const bStart = instant.toZonedDateTimeISO(timeZone).toString();
      const bEnd = instant.toZonedDateTimeISO(timeZone).toString();

      expect(intervalXorZoned(aStart, aEnd, bStart, bEnd)).toEqual([]);
    }
  });

  it("proves zone-invariance across battleTestTimeZones for disjoint intervals (xor is both)", () => {
    const aStartInstant = Temporal.Instant.from("2024-01-01T09:00:00Z");
    const aEndInstant = Temporal.Instant.from("2024-12-31T17:00:00Z");
    const bStartInstant = Temporal.Instant.from("2025-01-01T00:00:00Z");
    const bEndInstant = Temporal.Instant.from("2025-06-01T00:00:00Z");

    for (const timeZone of battleTestTimeZones) {
      const aStart = aStartInstant.toZonedDateTimeISO(timeZone).toString();
      const aEnd = aEndInstant.toZonedDateTimeISO(timeZone).toString();
      const bStart = bStartInstant.toZonedDateTimeISO(timeZone).toString();
      const bEnd = bEndInstant.toZonedDateTimeISO(timeZone).toString();

      const result = intervalXorZoned(aStart, aEnd, bStart, bEnd);

      expect(result).toHaveLength(2);
      expect(
        Temporal.ZonedDateTime.from(result[0].start).toInstant().toString(),
      ).toBe(aStartInstant.toString());
      expect(
        Temporal.ZonedDateTime.from(result[0].end).toInstant().toString(),
      ).toBe(aEndInstant.toString());
      expect(
        Temporal.ZonedDateTime.from(result[1].start).toInstant().toString(),
      ).toBe(bStartInstant.toString());
      expect(
        Temporal.ZonedDateTime.from(result[1].end).toInstant().toString(),
      ).toBe(bEndInstant.toString());
    }
  });

  it("proves zone-invariance across battleTestTimeZones for disjoint intervals with a 25-hour gap (xor is both)", () => {
    const aStartInstant = Temporal.Instant.from("2024-01-01T09:00:00Z");
    const aEndInstant = Temporal.Instant.from("2024-06-30T12:00:00Z");
    const bStartInstant = Temporal.Instant.from("2024-07-01T13:00:00Z");
    const bEndInstant = Temporal.Instant.from("2024-12-31T17:00:00Z");

    for (const timeZone of battleTestTimeZones) {
      const aStart = aStartInstant.toZonedDateTimeISO(timeZone).toString();
      const aEnd = aEndInstant.toZonedDateTimeISO(timeZone).toString();
      const bStart = bStartInstant.toZonedDateTimeISO(timeZone).toString();
      const bEnd = bEndInstant.toZonedDateTimeISO(timeZone).toString();

      const result = intervalXorZoned(aStart, aEnd, bStart, bEnd);

      expect(result).toHaveLength(2);
      expect(
        Temporal.ZonedDateTime.from(result[0].start).toInstant().toString(),
      ).toBe(aStartInstant.toString());
      expect(
        Temporal.ZonedDateTime.from(result[0].end).toInstant().toString(),
      ).toBe(aEndInstant.toString());
      expect(
        Temporal.ZonedDateTime.from(result[1].start).toInstant().toString(),
      ).toBe(bStartInstant.toString());
      expect(
        Temporal.ZonedDateTime.from(result[1].end).toInstant().toString(),
      ).toBe(bEndInstant.toString());
    }
  });

  it("proves zone-invariance across battleTestTimeZones for touching intervals (xor joins them into one run)", () => {
    // A ends at the instant B starts. Half-open, so no instant is covered twice and the two pieces
    // join at the shared boundary.
    const aStartInstant = Temporal.Instant.from("2024-01-01T09:00:00Z");
    const sharedInstant = Temporal.Instant.from("2024-06-30T12:00:00Z");
    const bEndInstant = Temporal.Instant.from("2024-12-31T17:00:00Z");

    for (const timeZone of battleTestTimeZones) {
      const result = intervalXorZoned(
        aStartInstant.toZonedDateTimeISO(timeZone).toString(),
        sharedInstant.toZonedDateTimeISO(timeZone).toString(),
        sharedInstant.toZonedDateTimeISO(timeZone).toString(),
        bEndInstant.toZonedDateTimeISO(timeZone).toString(),
      );
      const instants = result.map(({ start, end }) => [
        Temporal.ZonedDateTime.from(start).toInstant().toString(),
        Temporal.ZonedDateTime.from(end).toInstant().toString(),
      ]);

      expect(instants).toEqual([
        [aStartInstant.toString(), bEndInstant.toString()],
      ]);
    }
  });

  // The arguments name different calendars (hebrew and a bare iso8601 string), so the
  // result is the sentinel (there is no single output calendar).
  it.each`
    aStart                                           | aEnd                                | bStart                                           | bEnd
    ${"2024-01-01T00:00:00+00:00[UTC][u-ca=hebrew]"} | ${"2024-06-30T23:59:59+00:00[UTC]"} | ${"2024-01-01T00:00:00+00:00[UTC]"}              | ${"2024-06-30T23:59:59+00:00[UTC]"}
    ${"2024-01-01T00:00:00+00:00[UTC]"}              | ${"2024-06-30T23:59:59+00:00[UTC]"} | ${"2024-01-01T00:00:00+00:00[UTC][u-ca=hebrew]"} | ${"2024-06-30T23:59:59+00:00[UTC]"}
  `(
    "returns [] for mixed calendars: $aStart, $aEnd, $bStart, $bEnd",
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
      expect(intervalXorZoned(aStart, aEnd, bStart, bEnd)).toEqual([]);
    },
  );
});
