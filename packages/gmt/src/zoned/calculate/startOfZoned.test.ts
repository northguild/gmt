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

  // `disambiguation` is deprecated and ignored: a boundary is always the real bucket start, as
  // TC39's `startOfDay()` takes no options. The source sits in the second, repeated 1am, so every
  // row — "reject" included — starts the hour the source is in. Verified against `floorToZone` on
  // @js-temporal/polyfill@0.5.1.
  it.each`
    value                                            | disambiguation  | expected
    ${"2024-11-03T01:45:00-05:00[America/New_York]"} | ${undefined}    | ${"2024-11-03T01:00:00-05:00[America/New_York]"}
    ${"2024-11-03T01:45:00-05:00[America/New_York]"} | ${"compatible"} | ${"2024-11-03T01:00:00-05:00[America/New_York]"}
    ${"2024-11-03T01:45:00-05:00[America/New_York]"} | ${"earlier"}    | ${"2024-11-03T01:00:00-05:00[America/New_York]"}
    ${"2024-11-03T01:45:00-05:00[America/New_York]"} | ${"later"}      | ${"2024-11-03T01:00:00-05:00[America/New_York]"}
    ${"2024-11-03T01:45:00-05:00[America/New_York]"} | ${"reject"}     | ${"2024-11-03T01:00:00-05:00[America/New_York]"}
    ${"2024-10-27T02:45:00+01:00[Europe/Berlin]"}    | ${undefined}    | ${"2024-10-27T02:00:00+01:00[Europe/Berlin]"}
    ${"2024-10-27T02:45:00+01:00[Europe/Berlin]"}    | ${"compatible"} | ${"2024-10-27T02:00:00+01:00[Europe/Berlin]"}
    ${"2024-10-27T02:45:00+01:00[Europe/Berlin]"}    | ${"earlier"}    | ${"2024-10-27T02:00:00+01:00[Europe/Berlin]"}
    ${"2024-10-27T02:45:00+01:00[Europe/Berlin]"}    | ${"later"}      | ${"2024-10-27T02:00:00+01:00[Europe/Berlin]"}
    ${"2024-10-27T02:45:00+01:00[Europe/Berlin]"}    | ${"reject"}     | ${"2024-10-27T02:00:00+01:00[Europe/Berlin]"}
  `(
    "returns the real hour start $expected for fall-back overlap $value with ignored disambiguation $disambiguation",
    ({ value, disambiguation, expected }) => {
      const optionsArg =
        disambiguation === undefined ? undefined : { disambiguation };
      expect(startOfZoned(value, "hour", optionsArg)).toBe(expected);
    },
  );

  // `offset` is deprecated and ignored too, alone or combined with `disambiguation: "reject"`.
  it.each`
    offset       | expected
    ${undefined} | ${"2024-11-03T01:00:00-05:00[America/New_York]"}
    ${"ignore"}  | ${"2024-11-03T01:00:00-05:00[America/New_York]"}
    ${"prefer"}  | ${"2024-11-03T01:00:00-05:00[America/New_York]"}
    ${"use"}     | ${"2024-11-03T01:00:00-05:00[America/New_York]"}
    ${"reject"}  | ${"2024-11-03T01:00:00-05:00[America/New_York]"}
  `(
    "returns the real hour start $expected with disambiguation reject and ignored offset $offset",
    ({ offset, expected }) => {
      const optionsArg =
        offset === undefined
          ? { disambiguation: "reject" as const }
          : { disambiguation: "reject" as const, offset };
      expect(
        startOfZoned(
          "2024-11-03T01:45:00-05:00[America/New_York]",
          "hour",
          optionsArg,
        ),
      ).toBe(expected);
    },
  );

  // Local midnight itself is a DST gap (America/Sao_Paulo jumped 00:00 -> 01:00 on 2018-11-04), so
  // the day starts at its first real instant, 01:00 — Temporal's `startOfDay()` — whatever
  // `disambiguation` says. Verified on @js-temporal/polyfill@0.5.1.
  it.each`
    disambiguation  | expected
    ${undefined}    | ${"2018-11-04T01:00:00-02:00[America/Sao_Paulo]"}
    ${"compatible"} | ${"2018-11-04T01:00:00-02:00[America/Sao_Paulo]"}
    ${"earlier"}    | ${"2018-11-04T01:00:00-02:00[America/Sao_Paulo]"}
    ${"later"}      | ${"2018-11-04T01:00:00-02:00[America/Sao_Paulo]"}
    ${"reject"}     | ${"2018-11-04T01:00:00-02:00[America/Sao_Paulo]"}
  `(
    "returns the day's first real instant $expected across a midnight gap with ignored disambiguation $disambiguation",
    ({ disambiguation, expected }) => {
      const optionsArg =
        disambiguation === undefined ? undefined : { disambiguation };
      expect(
        startOfZoned(
          "2018-11-04T12:00:00-02:00[America/Sao_Paulo]",
          "day",
          optionsArg,
        ),
      ).toBe(expected);
    },
  );

  // A Sunday week in America/Sao_Paulo starts on 2018-11-04, whose midnight is a gap. The week
  // starts at that Sunday's first real instant; `disambiguation: "reject"` no longer yields "".
  it("returns the week's first real instant across a midnight gap with ignored disambiguation reject", () => {
    expect(
      startOfZoned("2018-11-06T12:00:00-02:00[America/Sao_Paulo]", "week", {
        weekStartsOn: "sunday",
        disambiguation: "reject",
      }),
    ).toBe("2018-11-04T01:00:00-02:00[America/Sao_Paulo]");
  });

  // disambiguation has no effect on a spring-forward gap when the source itself was constructed via a valid pre/post-transition offset (arithmetic/field-set already lands on a valid instant)
  it.each`
    disambiguation
    ${"compatible"}
    ${"earlier"}
    ${"later"}
    ${"reject"}
  `(
    "returns the same start-of-day result regardless of disambiguation $disambiguation when no boundary jump crosses a transition",
    ({ disambiguation }) => {
      expect(
        startOfZoned("2024-03-10T12:00:00-04:00[America/New_York]", "day", {
          disambiguation,
        }),
      ).toBe("2024-03-10T00:00:00-05:00[America/New_York]");
    },
  );
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
  // starts at 23:01 (-04:00). An explicit `disambiguation` used to return the previous Sunday's
  // midnight, a week before the input; it is now ignored. Verified against the
  // `internal/zonedBucket.ts` walker (weekStartsOn 7) on @js-temporal/polyfill@0.5.1.
  it.each`
    options                                                     | expected
    ${{ weekStartsOn: "sunday" }}                               | ${"2010-11-06T23:01:00-04:00[America/Goose_Bay]"}
    ${{ weekStartsOn: "sunday", disambiguation: "compatible" }} | ${"2010-11-06T23:01:00-04:00[America/Goose_Bay]"}
  `(
    "returns $expected for Goose Bay's re-opened Sunday week with $options",
    ({ options, expected }) => {
      expect(
        startOfZoned(
          "2010-11-06T23:30:00-04:00[America/Goose_Bay]",
          "week",
          options,
        ),
      ).toBe(expected);
    },
  );

  // Regression: explicit `offset` or `disambiguation` used to opt into wall-clock `.with()`, which
  // moved Chatham's never-happened local 03:00 forward to 04:00 — after the 03:50 input. Both are
  // now ignored and the start is the real 03:45 boundary. Verified against `floorToZone` on
  // @js-temporal/polyfill@0.5.1.
  it.each`
    options                                           | expected
    ${{ offset: "ignore" }}                           | ${"2024-09-29T03:45:00+13:45[Pacific/Chatham]"}
    ${{ disambiguation: "compatible" }}               | ${"2024-09-29T03:45:00+13:45[Pacific/Chatham]"}
    ${{ disambiguation: "reject", offset: "reject" }} | ${"2024-09-29T03:45:00+13:45[Pacific/Chatham]"}
  `(
    "returns the real boundary $expected for Chatham's skipped hour with ignored $options",
    ({ options, expected }) => {
      expect(
        startOfZoned(
          "2024-09-29T03:50:00+13:45[Pacific/Chatham]",
          "hour",
          options,
        ),
      ).toBe(expected);
    },
  );
});

// The deprecated options never change a boundary: every explicit `disambiguation`/`offset` value
// gives exactly the no-options output, at probe-zone transitions for every bucketing unit.
describe("startOfZoned and endOfZoned ignore the deprecated resolution options", () => {
  const explicitOptions = [
    { disambiguation: "compatible" },
    { disambiguation: "earlier" },
    { disambiguation: "later" },
    { disambiguation: "reject" },
    { offset: "prefer" },
    { offset: "use" },
    { offset: "ignore" },
    { offset: "reject" },
    { disambiguation: "reject", offset: "reject" },
  ] as const;

  it.each`
    value
    ${"2024-09-29T03:50:00+13:45[Pacific/Chatham]"}
    ${"2024-11-03T01:30:00-05:00[America/New_York]"}
    ${"2024-11-03T00:30:00-05:00[America/Havana]"}
    ${"2010-11-06T23:30:00-04:00[America/Goose_Bay]"}
    ${"2018-11-04T12:00:00-02:00[America/Sao_Paulo]"}
  `(
    "returns identical output to no options for $value by hour/day/week/month",
    ({ value }) => {
      for (const unit of ["hour", "day", "week", "month"] as const) {
        for (const options of explicitOptions) {
          const label = `${unit} with ${JSON.stringify(options)}`;
          expect(startOfZoned(value, unit, options), label).toBe(
            startOfZoned(value, unit),
          );
          expect(endOfZoned(value, unit, options), label).toBe(
            endOfZoned(value, unit),
          );
        }
      }
    },
  );
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
