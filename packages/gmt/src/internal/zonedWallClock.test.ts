import { Temporal } from "./temporal";
import { dateLineCrossingTimeZones } from "../test/timeZoneMatrix";
import {
  isWithinIsoDaysRange,
  POLYFILL_TRANSITION_SEARCH_FLOOR,
  zonedDateTimeFrom,
} from "./zonedWallClock";

// Epoch nanoseconds of the last representable instant, +275760-09-13T00:00:00Z (TC39 nsMaxInstant).
const MAX_INSTANT = 8_640_000_000_000_000_000_000n;

describe("zonedDateTimeFrom", () => {
  describe("in-range values at the maximum instant", () => {
    // Expected string = new Temporal.ZonedDateTime(epochNs, zone).toString(): the constructor never
    // resolves a wall clock, so it is an independent oracle (native V8 Temporal prints the same).
    it.each`
      value                                                     | timeZone                | point                                 | epochNanoseconds
      ${"+275760-09-13T10:00:00+10:00[Australia/Sydney]"}       | ${"Australia/Sydney"}   | ${"max"}                              | ${MAX_INSTANT}
      ${"+275760-09-13T09:00:00+10:00[Australia/Sydney]"}       | ${"Australia/Sydney"}   | ${"max - 1h"}                         | ${MAX_INSTANT - 3_600_000_000_000n}
      ${"+275760-09-13T00:00:00.001+10:00[Australia/Sydney]"}   | ${"Australia/Sydney"}   | ${"max - offset + 1ms"}               | ${MAX_INSTANT - 36_000_000_000_000n + 1_000_000n}
      ${"+275760-09-13T14:00:00+14:00[Pacific/Kiritimati]"}     | ${"Pacific/Kiritimati"} | ${"max"}                              | ${MAX_INSTANT}
      ${"+275760-09-13T13:00:00+14:00[Pacific/Kiritimati]"}     | ${"Pacific/Kiritimati"} | ${"max - 1h"}                         | ${MAX_INSTANT - 3_600_000_000_000n}
      ${"+275760-09-13T00:00:00.001+14:00[Pacific/Kiritimati]"} | ${"Pacific/Kiritimati"} | ${"max - offset + 1ms"}               | ${MAX_INSTANT - 50_400_000_000_000n + 1_000_000n}
      ${"+275760-09-13T02:00:00+02:00[Europe/Paris]"}           | ${"Europe/Paris"}       | ${"max"}                              | ${MAX_INSTANT}
      ${"+275760-09-13T01:00:00+02:00[Europe/Paris]"}           | ${"Europe/Paris"}       | ${"max - 1h"}                         | ${MAX_INSTANT - 3_600_000_000_000n}
      ${"+275760-09-13T00:00:00.001+02:00[Europe/Paris]"}       | ${"Europe/Paris"}       | ${"max - offset + 1ms"}               | ${MAX_INSTANT - 7_200_000_000_000n + 1_000_000n}
      ${"+275760-09-12T20:00:00-04:00[America/New_York]"}       | ${"America/New_York"}   | ${"max (negative offset)"}            | ${MAX_INSTANT}
      ${"+275760-09-12T19:00:00-04:00[America/New_York]"}       | ${"America/New_York"}   | ${"max - 1h (negative offset)"}       | ${MAX_INSTANT - 3_600_000_000_000n}
      ${"+275760-09-13T00:00:00+00:00[UTC]"}                    | ${"UTC"}                | ${"max"}                              | ${MAX_INSTANT}
      ${"+275760-09-12T23:00:00+00:00[UTC]"}                    | ${"UTC"}                | ${"max - 1h"}                         | ${MAX_INSTANT - 3_600_000_000_000n}
      ${"+275760-09-13T10:00:00+10:00[+10:00]"}                 | ${"+10:00"}             | ${"max (offset zone)"}                | ${MAX_INSTANT}
      ${"+275760-09-13T00:00:00.001+10:00[+10:00]"}             | ${"+10:00"}             | ${"max - offset + 1ms (offset zone)"} | ${MAX_INSTANT - 36_000_000_000_000n + 1_000_000n}
    `(
      "resolves $value ($timeZone at $point)",
      ({ value, timeZone, epochNanoseconds }) => {
        const expected = new Temporal.ZonedDateTime(
          epochNanoseconds,
          timeZone,
        ).toString();

        expect(expected).toBe(value);
        expect(zonedDateTimeFrom(value).toString()).toBe(expected);
      },
    );
  });

  describe("values the spec rejects at the maximum instant", () => {
    it.each`
      value                                                           | reason
      ${"+275760-09-13T10:00:00.000000001+10:00[Australia/Sydney]"}   | ${"Sydney max + 1ns"}
      ${"+275760-09-13T14:00:00.000000001+14:00[Pacific/Kiritimati]"} | ${"Kiritimati max + 1ns"}
      ${"+275760-09-13T02:00:00.000000001+02:00[Europe/Paris]"}       | ${"Paris max + 1ns"}
      ${"+275760-09-12T20:00:00.000000001-04:00[America/New_York]"}   | ${"New York max + 1ns"}
      ${"+275760-09-13T00:00:00.000000001+00:00[UTC]"}                | ${"UTC max + 1ns"}
      ${"+275760-09-13T10:00:00.000000001+10:00[+10:00]"}             | ${"offset zone max + 1ns"}
      ${"+275760-09-13T10:00:00.000000001[Australia/Sydney]"}         | ${"Sydney wall clock 1ns past max, no offset"}
      ${"+275760-09-13T09:00:00+09:00[Australia/Sydney]"}             | ${"wrong offset +09:00; its instant (max) is in range"}
      ${"+275760-09-13T09:30:00+09:00[Australia/Sydney]"}             | ${"wrong offset +09:00; its instant is past max"}
      ${"+275760-09-13T10:00:00+11:00[Australia/Sydney]"}             | ${"wrong offset +11:00; its instant is in range"}
      ${"+275760-09-13T13:00:00+13:00[Pacific/Kiritimati]"}           | ${"wrong offset +13:00 in Kiritimati"}
    `("throws for $value ($reason)", ({ value }) => {
      expect(() => zonedDateTimeFrom(value)).toThrow(RangeError);
    });
  });

  describe("offset option at the maximum instant", () => {
    // InterpretISODateTimeOffset: "use" takes the string's own instant; "ignore" resolves the wall
    // clock; "prefer" keeps a matching candidate or else resolves the wall clock; "reject" throws on
    // a mismatch. Sydney is on +10:00 all of September.
    it.each`
      value                                               | offset      | expected
      ${"+275760-09-13T09:30:00+09:00[Australia/Sydney]"} | ${"prefer"} | ${"+275760-09-13T09:30:00+10:00[Australia/Sydney]"}
      ${"+275760-09-13T09:30:00+09:00[Australia/Sydney]"} | ${"ignore"} | ${"+275760-09-13T09:30:00+10:00[Australia/Sydney]"}
      ${"+275760-09-13T10:00:00+11:00[Australia/Sydney]"} | ${"prefer"} | ${"+275760-09-13T10:00:00+10:00[Australia/Sydney]"}
      ${"+275760-09-13T10:00:00+11:00[Australia/Sydney]"} | ${"ignore"} | ${"+275760-09-13T10:00:00+10:00[Australia/Sydney]"}
      ${"+275760-09-13T10:00:00+11:00[Australia/Sydney]"} | ${"use"}    | ${"+275760-09-13T09:00:00+10:00[Australia/Sydney]"}
      ${"+275760-09-13T09:00:00+09:00[Australia/Sydney]"} | ${"use"}    | ${"+275760-09-13T10:00:00+10:00[Australia/Sydney]"}
      ${"+275760-09-13T10:00:00+10:00[Australia/Sydney]"} | ${"reject"} | ${"+275760-09-13T10:00:00+10:00[Australia/Sydney]"}
    `(
      "resolves $value with offset=$offset to $expected",
      ({ value, offset, expected }) => {
        expect(zonedDateTimeFrom(value, { offset }).toString()).toBe(expected);
      },
    );

    it.each`
      value                                               | offset
      ${"+275760-09-13T09:30:00+09:00[Australia/Sydney]"} | ${"use"}
      ${"+275760-09-13T09:30:00+09:00[Australia/Sydney]"} | ${"reject"}
    `(
      "throws for $value with offset=$offset (the string's own instant is past max)",
      ({ value, offset }) => {
        expect(() => zonedDateTimeFrom(value, { offset })).toThrow(RangeError);
      },
    );
  });

  describe("a Z string is an exact instant under every offset option (temporalCompat D15)", () => {
    // ToTemporalZonedDateTime sets offsetBehaviour to ~exact~ for a `Z` or `z` designator, and
    // InterpretISODateTimeOffset applies "ignore" only when offsetBehaviour is ~option~, so the
    // string's own instant is kept under "ignore" as under "use", "prefer" and "reject".
    // London is on +01:00 in July and repeats 01:00-02:00 local on 2026-10-25 (01:00Z falls back).
    const offsets = ["ignore", "use", "prefer", "reject"] as const;

    it.each`
      value                                    | expected
      ${"2022-07-08T00:14:07Z[Europe/London]"} | ${"2022-07-08T01:14:07+01:00[Europe/London]"}
      ${"2022-07-08T00:14:07z[Europe/London]"} | ${"2022-07-08T01:14:07+01:00[Europe/London]"}
      ${"2026-10-25T00:30:00Z[Europe/London]"} | ${"2026-10-25T01:30:00+01:00[Europe/London]"}
      ${"2026-10-25T01:30:00Z[Europe/London]"} | ${"2026-10-25T01:30:00+00:00[Europe/London]"}
      ${"2022-07-08T00:14:07Z[+05:00]"}        | ${"2022-07-08T05:14:07+05:00[+05:00]"}
      ${"2022-07-08T00:14:07Z[Asia/Kolkata]"}  | ${"2022-07-08T05:44:07+05:30[Asia/Kolkata]"}
    `(
      "reads $value as $expected under every offset option",
      ({ value, expected }) => {
        for (const offset of offsets) {
          expect(zonedDateTimeFrom(value, { offset }).toString(), offset).toBe(
            expected,
          );
        }
      },
    );

    it.each`
      value                                           | expected
      ${"+275760-09-13T00:00:00Z[America/Sao_Paulo]"} | ${"+275760-09-12T21:00:00-03:00[America/Sao_Paulo]"}
      ${"-271821-04-20T00:00:00Z[Asia/Kolkata]"}      | ${"-271821-04-20T05:53:28+05:53[Asia/Kolkata]"}
    `(
      "reads $value at a range limit as $expected under offset=ignore",
      ({ value, expected }) => {
        expect(zonedDateTimeFrom(value, { offset: "ignore" }).toString()).toBe(
          expected,
        );
      },
    );

    it("still reads a numeric offset by wall clock under offset=ignore", () => {
      expect(
        zonedDateTimeFrom("2022-07-08T00:14:07+05:00[Europe/London]", {
          offset: "ignore",
        }).toString(),
      ).toBe("2022-07-08T00:14:07+01:00[Europe/London]");
    });
  });

  describe("strings without an offset at the maximum instant", () => {
    it.each`
      value                                           | expected                                              | reason
      ${"+275760-09-13T10:00:00[Australia/Sydney]"}   | ${"+275760-09-13T10:00:00+10:00[Australia/Sydney]"}   | ${"wall clock resolves to max"}
      ${"+275760-09-13T14:00:00[Pacific/Kiritimati]"} | ${"+275760-09-13T14:00:00+14:00[Pacific/Kiritimati]"} | ${"wall clock resolves to max"}
      ${"+275760-09-07[America/Santiago]"}            | ${"+275760-09-07T01:00:00-03:00[America/Santiago]"}   | ${"date only: midnight is skipped, the day starts at the 04:00Z transition"}
      ${"+275760-09-13[Pacific/Kiritimati]"}          | ${"+275760-09-13T00:00:00+14:00[Pacific/Kiritimati]"} | ${"date only: last Kiritimati day starts at 00:00"}
    `("resolves $value to $expected ($reason)", ({ value, expected }) => {
      expect(zonedDateTimeFrom(value).toString()).toBe(expected);
    });
  });

  describe("the minimum instant", () => {
    // -271821-04-19T20:00 in New York (LMT -04:56:02) is min + 56min 02s, a valid instant.
    // InterpretISODateTimeOffset runs CheckISODaysRange(-271821-04-19) only for offset "prefer" and
    // "reject"; a string without an offset, or offset "ignore", resolves the wall clock alone.
    it.each`
      value                                                  | offset       | expected
      ${"-271821-04-19T20:00:00[America/New_York]"}          | ${undefined} | ${"-271821-04-19T20:00:00-04:56[America/New_York]"}
      ${"-271821-04-19T20:00:00-04:56:02[America/New_York]"} | ${"ignore"}  | ${"-271821-04-19T20:00:00-04:56[America/New_York]"}
      ${"-271821-04-20T00:00:00+00:00[UTC]"}                 | ${undefined} | ${"-271821-04-20T00:00:00+00:00[UTC]"}
    `(
      "resolves $value with offset=$offset to $expected",
      ({ value, offset, expected }) => {
        expect(zonedDateTimeFrom(value, { offset }).toString()).toBe(expected);
      },
    );

    it.each`
      value                                                  | offset
      ${"-271821-04-19T20:00:00-04:56:02[America/New_York]"} | ${"reject"}
      ${"-271821-04-19T20:00:00-04:56:02[America/New_York]"} | ${"prefer"}
      ${"-271821-04-19T19:03:58-04:56[America/New_York]"}    | ${"reject"}
    `(
      "throws for $value with offset=$offset (CheckISODaysRange rejects -271821-04-19)",
      ({ value, offset }) => {
        expect(() => zonedDateTimeFrom(value, { offset })).toThrow(RangeError);
      },
    );
  });

  describe("normal-range DST resolution is unchanged", () => {
    // Expected values come straight from Temporal.ZonedDateTime.from, which is correct away from
    // the range limits: the helper must not change a single one of them.
    it.each`
      value                                            | disambiguation  | offset
      ${"2024-03-10T02:30:00[America/New_York]"}       | ${"compatible"} | ${undefined}
      ${"2024-03-10T02:30:00[America/New_York]"}       | ${"earlier"}    | ${undefined}
      ${"2024-03-10T02:30:00[America/New_York]"}       | ${"later"}      | ${undefined}
      ${"2024-11-03T01:30:00[America/New_York]"}       | ${"compatible"} | ${undefined}
      ${"2024-11-03T01:30:00[America/New_York]"}       | ${"earlier"}    | ${undefined}
      ${"2024-11-03T01:30:00[America/New_York]"}       | ${"later"}      | ${undefined}
      ${"2024-11-03T01:30:00-05:00[America/New_York]"} | ${"compatible"} | ${"reject"}
      ${"2024-03-10T02:30:00-05:00[America/New_York]"} | ${"compatible"} | ${"prefer"}
      ${"2024-09-08[America/Santiago]"}                | ${"compatible"} | ${undefined}
    `(
      "matches Temporal for $value (disambiguation=$disambiguation, offset=$offset)",
      ({ value, disambiguation, offset }) => {
        const expected = Temporal.ZonedDateTime.from(value, {
          disambiguation,
          offset,
        }).toString();

        expect(
          zonedDateTimeFrom(value, { disambiguation, offset }).toString(),
        ).toBe(expected);
      },
    );

    it.each`
      value                                            | disambiguation  | offset
      ${"2024-03-10T02:30:00[America/New_York]"}       | ${"reject"}     | ${undefined}
      ${"2024-11-03T01:30:00[America/New_York]"}       | ${"reject"}     | ${undefined}
      ${"2024-03-10T02:30:00-05:00[America/New_York]"} | ${"compatible"} | ${"reject"}
      ${"not-a-date"}                                  | ${"compatible"} | ${undefined}
      ${"2024-01-01T00:00:00+10:00"}                   | ${"compatible"} | ${undefined}
    `(
      "throws like Temporal for $value (disambiguation=$disambiguation, offset=$offset)",
      ({ value, disambiguation, offset }) => {
        expect(() =>
          Temporal.ZonedDateTime.from(value, { disambiguation, offset }),
        ).toThrow(RangeError);
        expect(() =>
          zonedDateTimeFrom(value, { disambiguation, offset }),
        ).toThrow(RangeError);
      },
    );
  });
});

describe("isWithinIsoDaysRange", () => {
  // CheckISODaysRange: |epoch days| <= 100_000_000; day 100_000_000 is +275760-09-13, day
  // -100_000_000 is -271821-04-20 (TC39 §6.5.1 step 7 bounds). A PlainDateTime cannot be built past +275760-09-13,
  // so only the lower limit has an out-of-range row.
  it.each`
    wall                        | expected
    ${"-271821-04-20T00:00:00"} | ${true}
    ${"-271821-04-19T23:59:59"} | ${false}
    ${"+275760-09-13T23:59:59"} | ${true}
    ${"2024-03-10T12:00:00"}    | ${true}
  `("returns $expected for $wall", ({ wall, expected }) => {
    expect(isWithinIsoDaysRange(Temporal.PlainDateTime.from(wall))).toBe(
      expected,
    );
  });
});

describe("the pre-1847 transition assumption (zoned.E)", () => {
  // `missedNextTransition` / `missedPreviousTransition` find the one offset change a zone makes
  // before the polyfill's transition search starts (1847-01-01) by comparing two offsets and
  // bisecting. That is only sound while no zone changes offset before 1844 and each of the five
  // date-line zones changes exactly once in 1844-1847. Offsets come from Intl, which the polyfill
  // reads correctly; only its transition *search* is floored. A tzdb release that adds an earlier
  // change fails here, naming the zone, instead of being silently mishandled.
  const MIN_INSTANT = -8_640_000_000_000_000_000_000n;
  const offsetAt = (timeZone: string, epochNanoseconds: bigint) =>
    new Temporal.ZonedDateTime(epochNanoseconds, timeZone).offsetNanoseconds;
  const epochOf = (instant: string) =>
    Temporal.Instant.from(instant).epochNanoseconds;
  const monthStarts = Array.from({ length: 37 }, (_, month) =>
    epochOf(
      `${1844 + Math.floor(month / 12)}-${String((month % 12) + 1).padStart(2, "0")}-01T00:00:00Z`,
    ),
  );
  const timeZones = Intl.supportedValuesOf("timeZone");

  it.each(dateLineCrossingTimeZones)(
    "starts the date-only 1844-12-31 string in $timeZone at the crossing, $instant",
    ({ timeZone, instant }) => {
      // TC39 ToTemporalZonedDateTime: a string without a time resolves to GetStartOfDay; the
      // whole of 1844-12-31 was skipped, so the day "starts" at the crossing (Chromium 153).
      expect(
        zonedDateTimeFrom(`1844-12-31[${timeZone}]`).toInstant().toString(),
      ).toBe(instant);
    },
  );

  it("puts the floor at 1847-01-01T00:00:00Z (js-temporal lib/ecmascript.ts BEFORE_FIRST_DST)", () => {
    expect(POLYFILL_TRANSITION_SEARCH_FLOOR).toBe(
      epochOf("1847-01-01T00:00:00Z"),
    );
  });

  it("finds no zone whose offset changes between the minimum instant and 1844-01-01", () => {
    const changed = timeZones.filter(
      (timeZone) =>
        offsetAt(timeZone, MIN_INSTANT) !==
        offsetAt(timeZone, epochOf("1844-01-01T00:00:00Z")),
    );

    expect(changed).toEqual([]);
  });

  it("finds exactly the five date-line zones changing between 1844-01-01 and 1847-01-01, once each", () => {
    const changes = timeZones
      .map((timeZone) => {
        const offsets = monthStarts.map((epoch) => offsetAt(timeZone, epoch));
        const count = offsets.filter(
          (offset, index) => index > 0 && offset !== offsets[index - 1],
        ).length;
        return { timeZone, count };
      })
      .filter(({ count }) => count > 0);

    expect(changes).toEqual(
      dateLineCrossingTimeZones
        .map(({ timeZone }) => ({ timeZone, count: 1 }))
        .sort((a, b) => a.timeZone.localeCompare(b.timeZone)),
    );
  });
});
