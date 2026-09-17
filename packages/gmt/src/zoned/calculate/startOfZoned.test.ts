import { Temporal } from "@js-temporal/polyfill";
import { floorToZone } from "../../calendar/calculate/floorToZone";
import { battleTestTimeZones } from "../../test";
import { endOfZoned } from "./endOfZoned";
import { startOfZoned } from "./startOfZoned";

describe("startOfZoned", () => {
  it.each`
    value                                         | unit             | expected
    ${"2024-02-29T12:34:56+00:00[UTC]"}           | ${"year"}        | ${"2024-01-01T00:00:00+00:00[UTC]"}
    ${"2024-02-29T12:34:56+00:00[UTC]"}           | ${"month"}       | ${"2024-02-01T00:00:00+00:00[UTC]"}
    ${"2024-02-29T12:34:56+00:00[UTC]"}           | ${"week"}        | ${"2024-02-26T00:00:00+00:00[UTC]"}
    ${"2024-02-29T12:34:56+00:00[UTC]"}           | ${"day"}         | ${"2024-02-29T00:00:00+00:00[UTC]"}
    ${"2024-02-29T12:34:56+00:00[UTC]"}           | ${"hour"}        | ${"2024-02-29T12:00:00+00:00[UTC]"}
    ${"2024-02-29T12:34:56+00:00[UTC]"}           | ${"minute"}      | ${"2024-02-29T12:34:00+00:00[UTC]"}
    ${"2024-02-29T12:34:56+00:00[UTC]"}           | ${"second"}      | ${"2024-02-29T12:34:56+00:00[UTC]"}
    ${"2024-02-29T12:34:56.999+00:00[UTC]"}       | ${"millisecond"} | ${"2024-02-29T12:34:56.999+00:00[UTC]"}
    ${"2024-02-29T12:34:56.999999+00:00[UTC]"}    | ${"microsecond"} | ${"2024-02-29T12:34:56.999999+00:00[UTC]"}
    ${"2024-02-29T12:34:56.999999999+00:00[UTC]"} | ${"nanosecond"}  | ${"2024-02-29T12:34:56.999999999+00:00[UTC]"}
  `(
    "returns $expected for value $value and unit $unit",
    ({ value, unit, expected }) => {
      expect(startOfZoned(value, unit)).toBe(expected);
    },
  );

  // supports weekStartsOn option
  it.each`
    value                               | unit      | weekStartsOn | expected
    ${"2024-02-29T12:34:56+00:00[UTC]"} | ${"week"} | ${undefined} | ${"2024-02-26T00:00:00+00:00[UTC]"}
    ${"2024-02-29T12:34:56+00:00[UTC]"} | ${"week"} | ${"monday"}  | ${"2024-02-26T00:00:00+00:00[UTC]"}
    ${"2024-02-29T12:34:56+00:00[UTC]"} | ${"week"} | ${"sunday"}  | ${"2024-02-25T00:00:00+00:00[UTC]"}
  `(
    "returns $expected for $value, $unit, and weekStartsOn $weekStartsOn, defaulting to Monday",
    ({ value, unit, weekStartsOn, expected }) => {
      expect(startOfZoned(value, unit, { weekStartsOn })).toBe(expected);
    },
  );

  // supports fractionalSecondDigits option
  it.each`
    value                                         | unit        | fractionalSecondDigits | expected
    ${"2024-02-29T12:34:56.789+00:00[UTC]"}       | ${"second"} | ${0}                   | ${"2024-02-29T12:34:56+00:00[UTC]"}
    ${"2024-02-29T12:34:56.789+00:00[UTC]"}       | ${"second"} | ${3}                   | ${"2024-02-29T12:34:56.000+00:00[UTC]"}
    ${"2024-02-29T12:34:56.789123+00:00[UTC]"}    | ${"second"} | ${6}                   | ${"2024-02-29T12:34:56.000000+00:00[UTC]"}
    ${"2024-02-29T12:34:56.789123456+00:00[UTC]"} | ${"second"} | ${9}                   | ${"2024-02-29T12:34:56.000000000+00:00[UTC]"}
    ${"2024-02-29T12:34:56.789+00:00[UTC]"}       | ${"second"} | ${undefined}           | ${"2024-02-29T12:34:56+00:00[UTC]"}
  `(
    "returns $expected for $value, $unit, and fractionalSecondDigits $fractionalSecondDigits",
    ({ value, unit, fractionalSecondDigits, expected }) => {
      expect(startOfZoned(value, unit, { fractionalSecondDigits })).toBe(
        expected,
      );
    },
  );

  // invalid value
  it.each`
    invalidZonedDateTime
    ${"invalid-zoned-datetime"}
    ${"2024-02-30T12:34:56+00:00[UTC]"}
    ${"2024-02-29T24:00:00+00:00[UTC]"}
    ${"2024-02-29T12:60:00+00:00[UTC]"}
    ${"2024-02-29T12:34:60+00:00[UTC]"}
    ${null}
    ${undefined}
    ${12}
    ${true}
    ${false}
  `(
    "returns empty string for invalid zoned datetime $invalidZonedDateTime",
    ({ invalidZonedDateTime }) => {
      expect(startOfZoned(invalidZonedDateTime, "month")).toBe("");
    },
  );

  // invalid unit
  it.each`
    invalidUnit
    ${"invalid-unit"}
    ${""}
    ${null}
    ${undefined}
    ${12}
    ${true}
    ${false}
  `("returns empty string for invalid unit $invalidUnit", ({ invalidUnit }) => {
    expect(startOfZoned("2024-02-29T12:34:56+00:00[UTC]", invalidUnit)).toBe(
      "",
    );
  });

  // A boundary is always the real bucket start, as TC39's `startOfDay()` gives. The source sits in
  // the second, repeated 1am, so the hour starts at its own 01:00. Verified against `floorToZone` on
  // @js-temporal/polyfill@0.5.1.
  it.each`
    value                                            | expected
    ${"2024-11-03T01:45:00-05:00[America/New_York]"} | ${"2024-11-03T01:00:00-05:00[America/New_York]"}
    ${"2024-10-27T02:45:00+01:00[Europe/Berlin]"}    | ${"2024-10-27T02:00:00+01:00[Europe/Berlin]"}
  `(
    "returns the real hour start $expected for fall-back overlap $value",
    ({ value, expected }) => {
      expect(startOfZoned(value, "hour")).toBe(expected);
    },
  );

  // `disambiguation` and `offset` were removed in 1.16.0: they were ignored, because a boundary is
  // always a real instant and TC39's `startOfDay()` takes neither. Passing one is a type error, and a
  // JavaScript caller's stray property changes nothing.
  it("treats the removed disambiguation option as a type error and ignores it at runtime", () => {
    expect(
      startOfZoned("2024-11-03T01:45:00-05:00[America/New_York]", "hour", {
        // @ts-expect-error -- `disambiguation` was removed in 1.16.0
        disambiguation: "reject",
      }),
    ).toBe("2024-11-03T01:00:00-05:00[America/New_York]");
  });
  it("treats the removed offset option as a type error and ignores it at runtime", () => {
    expect(
      startOfZoned("2024-11-03T01:45:00-05:00[America/New_York]", "hour", {
        // @ts-expect-error -- `offset` was removed in 1.16.0
        offset: "reject",
      }),
    ).toBe("2024-11-03T01:00:00-05:00[America/New_York]");
  });

  // Local midnight itself is a DST gap (America/Sao_Paulo jumped 00:00 -> 01:00 on 2018-11-04), so
  // the day starts at its first real instant, 01:00 — Temporal's `startOfDay()`. Verified on
  // @js-temporal/polyfill@0.5.1.
  it("returns the day's first real instant across a midnight gap", () => {
    expect(
      startOfZoned("2018-11-04T12:00:00-02:00[America/Sao_Paulo]", "day"),
    ).toBe("2018-11-04T01:00:00-02:00[America/Sao_Paulo]");
  });

  // A Sunday week in America/Sao_Paulo starts on 2018-11-04, whose midnight is a gap. The week
  // starts at that Sunday's first real instant.
  it("returns the week's first real instant across a midnight gap", () => {
    expect(
      startOfZoned("2018-11-06T12:00:00-02:00[America/Sao_Paulo]", "week", {
        weekStartsOn: "sunday",
      }),
    ).toBe("2018-11-04T01:00:00-02:00[America/Sao_Paulo]");
  });

  // A spring-forward day whose midnight exists starts at that midnight, in the pre-transition offset.
  it("returns the start of a spring-forward day at its real midnight", () => {
    expect(
      startOfZoned("2024-03-10T12:00:00-04:00[America/New_York]", "day"),
    ).toBe("2024-03-10T00:00:00-05:00[America/New_York]");
  });
});

// The start is the real zone boundary — the
// bucket `floorToZone` walks — so it is never after the input. Every expected value verified
// against `floorToZone` (and Temporal's `startOfDay()` for the Sunday week) on
// @js-temporal/polyfill@0.5.1.
describe("startOfZoned across zone transitions with default options", () => {
  it.each`
    value                                               | unit        | expected                                            | description
    ${"2024-09-29T03:50:00+13:45[Pacific/Chatham]"}     | ${"hour"}   | ${"2024-09-29T03:45:00+13:45[Pacific/Chatham]"}     | ${"Chatham spring-forward leaves a 15-minute 03:00 hour"}
    ${"2024-04-07T02:50:00+12:45[Pacific/Chatham]"}     | ${"hour"}   | ${"2024-04-07T02:45:00+12:45[Pacific/Chatham]"}     | ${"Chatham fall-back, second pass"}
    ${"2020-10-04T03:30:00+11:00[Antarctica/Casey]"}    | ${"hour"}   | ${"2020-10-04T03:01:00+11:00[Antarctica/Casey]"}    | ${"Casey's three-hour jump at 00:01"}
    ${"2024-11-03T01:30:00-05:00[America/New_York]"}    | ${"hour"}   | ${"2024-11-03T01:00:00-05:00[America/New_York]"}    | ${"New York fall-back, second pass"}
    ${"2024-04-07T01:40:00+10:30[Australia/Lord_Howe]"} | ${"hour"}   | ${"2024-04-07T01:00:00+11:00[Australia/Lord_Howe]"} | ${"Lord Howe's 90-minute hour"}
    ${"2024-09-08T12:00:00-03:00[America/Santiago]"}    | ${"day"}    | ${"2024-09-08T01:00:00-03:00[America/Santiago]"}    | ${"Santiago skipped local midnight"}
    ${"2010-11-07T00:30:00-04:00[America/Goose_Bay]"}   | ${"day"}    | ${"2010-11-07T00:00:00-04:00[America/Goose_Bay]"}   | ${"Goose Bay's second local midnight"}
    ${"2010-11-06T23:30:00-04:00[America/Goose_Bay]"}   | ${"day"}    | ${"2010-11-06T23:01:00-04:00[America/Goose_Bay]"}   | ${"Goose Bay fell back at 00:01 into the previous day"}
    ${"2024-11-03T00:30:00-05:00[America/Havana]"}      | ${"day"}    | ${"2024-11-03T00:00:00-04:00[America/Havana]"}      | ${"Havana repeated midnight on the same date: one 25-hour day (second pass)"}
    ${"2024-11-03T00:30:00-04:00[America/Havana]"}      | ${"day"}    | ${"2024-11-03T00:00:00-04:00[America/Havana]"}      | ${"Havana repeated midnight on the same date: one 25-hour day (first pass)"}
    ${"2024-11-03T12:00:00-05:00[America/Havana]"}      | ${"week"}   | ${"2024-10-28T00:00:00-04:00[America/Havana]"}      | ${"Havana's repeated Sunday midnight does not split the week"}
    ${"2020-11-01T00:30:00-05:00[America/Havana]"}      | ${"month"}  | ${"2020-11-01T00:00:00-04:00[America/Havana]"}      | ${"Havana repeated 1 November's midnight: the month starts on the first pass"}
    ${"2024-09-29T03:50:00+13:45[Pacific/Chatham]"}     | ${"month"}  | ${"2024-09-01T00:00:00+12:45[Pacific/Chatham]"}     | ${"a month spanning Chatham's spring-forward"}
    ${"1970-06-15T12:34:56.789-00:45[Africa/Monrovia]"} | ${"minute"} | ${"1970-06-15T12:34:00-00:45[Africa/Monrovia]"}     | ${"Monrovia's -00:44:30 offset floors the local minute, not the UTC one"}
  `(
    "returns $expected for $value by $unit ($description)",
    ({ value, unit, expected }) => {
      expect(startOfZoned(value, unit)).toBe(expected);
    },
  );

  it("starts a Sunday week on the skipped local midnight's first real instant in America/Sao_Paulo", () => {
    expect(
      startOfZoned("2018-11-06T12:00:00-02:00[America/Sao_Paulo]", "week", {
        weekStartsOn: "sunday",
      }),
    ).toBe("2018-11-04T01:00:00-02:00[America/Sao_Paulo]");
  });

  // Goose Bay fell back at 00:01 Sunday into Saturday 23:01, re-opening a Sunday-first week that
  // starts at 23:01 (-04:00). Verified against the `internal/zonedBucket.ts` walker (weekStartsOn 7)
  // on @js-temporal/polyfill@0.5.1.
  it("returns 2010-11-06T23:01:00-04:00 for Goose Bay's re-opened Sunday week", () => {
    expect(
      startOfZoned("2010-11-06T23:30:00-04:00[America/Goose_Bay]", "week", {
        weekStartsOn: "sunday",
      }),
    ).toBe("2010-11-06T23:01:00-04:00[America/Goose_Bay]");
  });

  // Chatham's local 03:00 never happened on 2024-09-29, so the hour holding 03:50 starts at the
  // real 03:45 boundary, never after the input. Verified against `floorToZone` on
  // @js-temporal/polyfill@0.5.1.
  it("returns the real boundary 2024-09-29T03:45:00+13:45 for Chatham's skipped hour", () => {
    expect(
      startOfZoned("2024-09-29T03:50:00+13:45[Pacific/Chatham]", "hour"),
    ).toBe("2024-09-29T03:45:00+13:45[Pacific/Chatham]");
  });
});

// Invariant over every battle-test zone, sampled on either side of its first 2024 transition
// (or at mid-year noon when it has none): the default start is the `floorToZone` bucket start,
// the input lies inside [start, end], and the next bucket begins one nanosecond after end.
const transitionSampleBattleCases = battleTestTimeZones.map((timeZone) => {
  const transition = Temporal.ZonedDateTime.from({
    year: 2024,
    month: 1,
    day: 1,
    timeZone,
  }).getTimeZoneTransition("next");
  const anchor =
    transition && transition.year === 2024
      ? transition.toInstant()
      : Temporal.Instant.from("2024-06-15T12:00:00Z");

  return {
    timeZone,
    values: [-90, -30, 0, 30, 90].map((minutes) =>
      anchor.add({ minutes }).toZonedDateTimeISO(timeZone).toString(),
    ),
  };
});

describe("startOfZoned and endOfZoned bucket invariant", () => {
  it.each(transitionSampleBattleCases)(
    "agree with floorToZone and contain the input for hour/day/week/month in $timeZone",
    ({ timeZone, values }) => {
      for (const value of values) {
        const instant = Temporal.ZonedDateTime.from(value).toInstant();

        for (const unit of ["hour", "day", "week", "month"] as const) {
          const start = Temporal.ZonedDateTime.from(
            startOfZoned(value, unit),
          ).toInstant();
          const end = Temporal.ZonedDateTime.from(
            endOfZoned(value, unit, { fractionalSecondDigits: 9 }),
          ).toInstant();
          const label = `${unit} of ${value}`;

          expect(start.toString(), label).toBe(
            floorToZone(instant.toString(), unit, timeZone),
          );
          expect(
            Temporal.Instant.compare(start, instant),
            label,
          ).toBeLessThanOrEqual(0);
          expect(
            Temporal.Instant.compare(instant, end),
            label,
          ).toBeLessThanOrEqual(0);

          const afterEnd = end.add({ nanoseconds: 1 }).toString();
          expect(floorToZone(afterEnd, unit, timeZone), label).toBe(afterEnd);
        }
      }
    },
  );
});

// The last representable instant is +275760-09-13T00:00:00Z. Nothing can be added to it, so the
// walker must find the zone transition at or before it without stepping past it. Neither local
// midnight below is a transition day: New York is on EST (-05:00) on 1 January, and Santiago's
// last transition before the maximum is 7 September, after 1 September (-04:00).
describe("startOfZoned at the maximum instant in a DST zone", () => {
  it.each`
    value                                               | unit       | expected
    ${"+275760-09-12T20:00:00-04:00[America/New_York]"} | ${"year"}  | ${"+275760-01-01T00:00:00-05:00[America/New_York]"}
    ${"+275760-09-12T21:00:00-03:00[America/Santiago]"} | ${"month"} | ${"+275760-09-01T00:00:00-04:00[America/Santiago]"}
  `(
    "returns $expected as the $unit start of $value",
    ({ value, unit, expected }) => {
      expect(startOfZoned(value, unit)).toBe(expected);
    },
  );
});

describe("startOfZoned at the maximum instant", () => {
  it.each`
    value                                                 | unit      | expected
    ${"+275760-09-13T10:00:00+10:00[Australia/Sydney]"}   | ${"day"}  | ${"+275760-09-13T00:00:00+10:00[Australia/Sydney]"}
    ${"+275760-09-13T14:00:00+14:00[Pacific/Kiritimati]"} | ${"hour"} | ${"+275760-09-13T14:00:00+14:00[Pacific/Kiritimati]"}
    ${"+275760-09-13T09:30:00+10:00[Australia/Sydney]"}   | ${"hour"} | ${"+275760-09-13T09:00:00+10:00[Australia/Sydney]"}
  `(
    "returns $expected for the $unit of $value",
    ({ value, unit, expected }) => {
      expect(startOfZoned(value, unit)).toBe(expected);
    },
  );

  // Temporal §13.17 GetTemporalUnitValuedOption: a plural unit name is the same unit as its singular.
  it.each`
    unit              | expected
    ${"years"}        | ${"2024-01-01T00:00:00+01:00[Europe/Berlin]"}
    ${"months"}       | ${"2024-02-01T00:00:00+01:00[Europe/Berlin]"}
    ${"weeks"}        | ${"2024-02-26T00:00:00+01:00[Europe/Berlin]"}
    ${"days"}         | ${"2024-02-29T00:00:00+01:00[Europe/Berlin]"}
    ${"hours"}        | ${"2024-02-29T13:00:00+01:00[Europe/Berlin]"}
    ${"minutes"}      | ${"2024-02-29T13:45:00+01:00[Europe/Berlin]"}
    ${"seconds"}      | ${"2024-02-29T13:45:30+01:00[Europe/Berlin]"}
    ${"milliseconds"} | ${"2024-02-29T13:45:30.123+01:00[Europe/Berlin]"}
    ${"microseconds"} | ${"2024-02-29T13:45:30.123456+01:00[Europe/Berlin]"}
    ${"nanoseconds"}  | ${"2024-02-29T13:45:30.123456789+01:00[Europe/Berlin]"}
  `(
    "returns $expected for plural unit $unit on 2024-02-29T13:45:30.123456789+01:00[Europe/Berlin]",
    ({ unit, expected }) => {
      expect(
        startOfZoned(
          "2024-02-29T13:45:30.123456789+01:00[Europe/Berlin]",
          unit,
        ),
      ).toBe(expected);
    },
  );

  // weekStartsOn only names "monday" or "sunday"; any other value is invalid input, for every unit
  // (Temporal GetOption rejects a value outside its allowed list; undefined means the default).
  it.each`
    unit      | weekStartsOn
    ${"week"} | ${"tuesday"}
    ${"week"} | ${"Monday"}
    ${"week"} | ${""}
    ${"week"} | ${null}
    ${"week"} | ${1}
    ${"week"} | ${true}
    ${"day"}  | ${"tuesday"}
    ${"day"}  | ${"Monday"}
    ${"day"}  | ${""}
    ${"day"}  | ${null}
    ${"day"}  | ${1}
    ${"day"}  | ${true}
  `(
    "returns an empty string for unit $unit with invalid weekStartsOn $weekStartsOn",
    ({ unit, weekStartsOn }) => {
      expect(
        startOfZoned(
          "2024-02-29T13:45:30.123456789+01:00[Europe/Berlin]",
          unit,
          { weekStartsOn },
        ),
      ).toBe("");
    },
  );
});
