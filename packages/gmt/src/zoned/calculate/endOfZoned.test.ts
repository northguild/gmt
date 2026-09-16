import { Temporal } from "@js-temporal/polyfill";
import { endOfZoned } from "./endOfZoned";

describe("endOfZoned", () => {
  it.each`
    value                                         | unit             | expected
    ${"2024-02-29T12:34:56+00:00[UTC]"}           | ${"year"}        | ${"2024-12-31T23:59:59.999999999+00:00[UTC]"}
    ${"2024-02-29T12:34:56+00:00[UTC]"}           | ${"month"}       | ${"2024-02-29T23:59:59.999999999+00:00[UTC]"}
    ${"2024-02-29T12:34:56+00:00[UTC]"}           | ${"week"}        | ${"2024-03-03T23:59:59.999999999+00:00[UTC]"}
    ${"2024-02-29T12:34:56+00:00[UTC]"}           | ${"day"}         | ${"2024-02-29T23:59:59.999999999+00:00[UTC]"}
    ${"2024-02-29T12:34:56+00:00[UTC]"}           | ${"hour"}        | ${"2024-02-29T12:59:59.999999999+00:00[UTC]"}
    ${"2024-02-29T12:34:56+00:00[UTC]"}           | ${"minute"}      | ${"2024-02-29T12:34:59.999999999+00:00[UTC]"}
    ${"2024-02-29T12:34:56.123+00:00[UTC]"}       | ${"millisecond"} | ${"2024-02-29T12:34:56.123999999+00:00[UTC]"}
    ${"2024-02-29T12:34:56.123456+00:00[UTC]"}    | ${"microsecond"} | ${"2024-02-29T12:34:56.123456999+00:00[UTC]"}
    ${"2024-02-29T12:34:56.123456789+00:00[UTC]"} | ${"nanosecond"}  | ${"2024-02-29T12:34:56.123456789+00:00[UTC]"}
  `(
    "returns $expected for value $value and unit $unit",
    ({ value, unit, expected }) => {
      expect(endOfZoned(value, unit)).toBe(expected);
    },
  );

  // supports weekStartsOn option
  it.each`
    value                               | unit      | weekStartsOn | expected
    ${"2024-02-29T12:34:56+00:00[UTC]"} | ${"week"} | ${undefined} | ${"2024-03-03T23:59:59.999999999+00:00[UTC]"}
    ${"2024-02-29T12:34:56+00:00[UTC]"} | ${"week"} | ${"monday"}  | ${"2024-03-03T23:59:59.999999999+00:00[UTC]"}
    ${"2024-02-29T12:34:56+00:00[UTC]"} | ${"week"} | ${"sunday"}  | ${"2024-03-02T23:59:59.999999999+00:00[UTC]"}
  `(
    "supports weekStartOn $weekStartsOn returning $expected for value $value and unit $unit",
    ({ value, unit, weekStartsOn, expected }) => {
      expect(endOfZoned(value, unit, { weekStartsOn })).toBe(expected);
    },
  );

  // supports fractionalSecondDigits option
  it.each`
    value                                         | unit        | fractionalSecondDigits | expected
    ${"2024-02-29T12:34:56.123456789+00:00[UTC]"} | ${"second"} | ${0}                   | ${"2024-02-29T12:34:56+00:00[UTC]"}
    ${"2024-02-29T12:34:56.123456789+00:00[UTC]"} | ${"second"} | ${3}                   | ${"2024-02-29T12:34:56.999+00:00[UTC]"}
    ${"2024-02-29T12:34:56.123456789+00:00[UTC]"} | ${"second"} | ${6}                   | ${"2024-02-29T12:34:56.999999+00:00[UTC]"}
    ${"2024-02-29T12:34:56.123456789+00:00[UTC]"} | ${"second"} | ${9}                   | ${"2024-02-29T12:34:56.999999999+00:00[UTC]"}
  `(
    "supports fractionalSecondDigits $fractionalSecondDigits returning $expected for $value and $unit",
    ({ value, unit, fractionalSecondDigits, expected }) => {
      expect(endOfZoned(value, unit, { fractionalSecondDigits })).toBe(
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
      expect(endOfZoned(invalidZonedDateTime, "month")).toBe("");
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
    expect(endOfZoned("2024-02-29T12:34:56+00:00[UTC]", invalidUnit)).toBe("");
  });

  // `disambiguation` is deprecated and ignored: a boundary is always the real bucket end. The
  // source sits in the second, repeated 1am, so every row — "reject" included — ends the hour the
  // source is in, never before it. Each end is the next hour's start (02:00 -05:00, 03:00 +01:00)
  // minus 1 ns, checked with `ZonedDateTime.subtract` on @js-temporal/polyfill@0.5.1.
  it.each`
    value                                            | disambiguation  | expected
    ${"2024-11-03T01:45:00-05:00[America/New_York]"} | ${undefined}    | ${"2024-11-03T01:59:59.999999999-05:00[America/New_York]"}
    ${"2024-11-03T01:45:00-05:00[America/New_York]"} | ${"compatible"} | ${"2024-11-03T01:59:59.999999999-05:00[America/New_York]"}
    ${"2024-11-03T01:45:00-05:00[America/New_York]"} | ${"earlier"}    | ${"2024-11-03T01:59:59.999999999-05:00[America/New_York]"}
    ${"2024-11-03T01:45:00-05:00[America/New_York]"} | ${"later"}      | ${"2024-11-03T01:59:59.999999999-05:00[America/New_York]"}
    ${"2024-11-03T01:45:00-05:00[America/New_York]"} | ${"reject"}     | ${"2024-11-03T01:59:59.999999999-05:00[America/New_York]"}
    ${"2024-10-27T02:45:00+01:00[Europe/Berlin]"}    | ${undefined}    | ${"2024-10-27T02:59:59.999999999+01:00[Europe/Berlin]"}
    ${"2024-10-27T02:45:00+01:00[Europe/Berlin]"}    | ${"compatible"} | ${"2024-10-27T02:59:59.999999999+01:00[Europe/Berlin]"}
    ${"2024-10-27T02:45:00+01:00[Europe/Berlin]"}    | ${"earlier"}    | ${"2024-10-27T02:59:59.999999999+01:00[Europe/Berlin]"}
    ${"2024-10-27T02:45:00+01:00[Europe/Berlin]"}    | ${"later"}      | ${"2024-10-27T02:59:59.999999999+01:00[Europe/Berlin]"}
    ${"2024-10-27T02:45:00+01:00[Europe/Berlin]"}    | ${"reject"}     | ${"2024-10-27T02:59:59.999999999+01:00[Europe/Berlin]"}
  `(
    "returns the real hour end $expected for fall-back overlap $value with ignored disambiguation $disambiguation",
    ({ value, disambiguation, expected }) => {
      const optionsArg =
        disambiguation === undefined ? undefined : { disambiguation };
      expect(endOfZoned(value, "hour", optionsArg)).toBe(expected);
    },
  );

  // `offset` is deprecated and ignored too, alone or combined with `disambiguation: "reject"`.
  it.each`
    offset       | expected
    ${undefined} | ${"2024-11-03T01:59:59.999999999-05:00[America/New_York]"}
    ${"ignore"}  | ${"2024-11-03T01:59:59.999999999-05:00[America/New_York]"}
    ${"prefer"}  | ${"2024-11-03T01:59:59.999999999-05:00[America/New_York]"}
    ${"use"}     | ${"2024-11-03T01:59:59.999999999-05:00[America/New_York]"}
    ${"reject"}  | ${"2024-11-03T01:59:59.999999999-05:00[America/New_York]"}
  `(
    "returns the real hour end $expected with disambiguation reject and ignored offset $offset",
    ({ offset, expected }) => {
      const optionsArg =
        offset === undefined
          ? { disambiguation: "reject" as const }
          : { disambiguation: "reject" as const, offset };
      expect(
        endOfZoned(
          "2024-11-03T01:15:00-05:00[America/New_York]",
          "hour",
          optionsArg,
        ),
      ).toBe(expected);
    },
  );
});

// The end is one nanosecond before the next real zone bucket starts, written at nanosecond
// precision, so it is never before the input. Each expected value is the next bucket's start (the
// next local hour or minute, or `startOfDay()` of the next date) minus 1 ns, checked with
// `ZonedDateTime.add({ nanoseconds: 1 })` on @js-temporal/polyfill@0.5.1.
describe("endOfZoned across zone transitions with default options", () => {
  it.each`
    value                                               | unit        | expected                                                      | description
    ${"2024-09-29T03:50:00+13:45[Pacific/Chatham]"}     | ${"hour"}   | ${"2024-09-29T03:59:59.999999999+13:45[Pacific/Chatham]"}     | ${"Chatham spring-forward leaves a 15-minute 03:00 hour"}
    ${"2024-04-07T02:50:00+12:45[Pacific/Chatham]"}     | ${"hour"}   | ${"2024-04-07T02:59:59.999999999+12:45[Pacific/Chatham]"}     | ${"Chatham fall-back, second pass"}
    ${"2020-10-04T03:30:00+11:00[Antarctica/Casey]"}    | ${"hour"}   | ${"2020-10-04T03:59:59.999999999+11:00[Antarctica/Casey]"}    | ${"Casey's three-hour jump at 00:01"}
    ${"2024-11-03T01:30:00-05:00[America/New_York]"}    | ${"hour"}   | ${"2024-11-03T01:59:59.999999999-05:00[America/New_York]"}    | ${"New York fall-back, second pass"}
    ${"2024-04-07T01:40:00+10:30[Australia/Lord_Howe]"} | ${"hour"}   | ${"2024-04-07T01:59:59.999999999+10:30[Australia/Lord_Howe]"} | ${"Lord Howe's 90-minute hour ends in the new offset"}
    ${"2024-09-08T12:00:00-03:00[America/Santiago]"}    | ${"day"}    | ${"2024-09-08T23:59:59.999999999-03:00[America/Santiago]"}    | ${"Santiago skipped local midnight"}
    ${"2010-11-07T00:30:00-04:00[America/Goose_Bay]"}   | ${"day"}    | ${"2010-11-07T23:59:59.999999999-04:00[America/Goose_Bay]"}   | ${"Goose Bay's second local midnight"}
    ${"2010-11-06T23:30:00-04:00[America/Goose_Bay]"}   | ${"day"}    | ${"2010-11-06T23:59:59.999999999-04:00[America/Goose_Bay]"}   | ${"Goose Bay fell back at 00:01 into the previous day"}
    ${"2024-11-03T00:30:00-04:00[America/Havana]"}      | ${"day"}    | ${"2024-11-03T23:59:59.999999999-05:00[America/Havana]"}      | ${"Havana repeated midnight on the same date: one 25-hour day (first pass)"}
    ${"2024-11-03T00:30:00-05:00[America/Havana]"}      | ${"day"}    | ${"2024-11-03T23:59:59.999999999-05:00[America/Havana]"}      | ${"Havana repeated midnight on the same date: one 25-hour day (second pass)"}
    ${"2024-10-30T12:00:00-04:00[America/Havana]"}      | ${"week"}   | ${"2024-11-03T23:59:59.999999999-05:00[America/Havana]"}      | ${"Havana's repeated Sunday midnight does not split the week"}
    ${"2020-10-15T12:00:00-04:00[America/Havana]"}      | ${"month"}  | ${"2020-10-31T23:59:59.999999999-04:00[America/Havana]"}      | ${"both passes of Havana's repeated 1 November midnight belong to November"}
    ${"2024-09-29T03:50:00+13:45[Pacific/Chatham]"}     | ${"month"}  | ${"2024-09-30T23:59:59.999999999+13:45[Pacific/Chatham]"}     | ${"a month spanning Chatham's spring-forward"}
    ${"1970-06-15T12:34:56.789-00:45[Africa/Monrovia]"} | ${"minute"} | ${"1970-06-15T12:34:59.999999999-00:45[Africa/Monrovia]"}     | ${"Monrovia's -00:44:30 offset ends the local minute, not the UTC one"}
  `(
    "returns $expected for $value by $unit ($description)",
    ({ value, unit, expected }) => {
      expect(endOfZoned(value, unit)).toBe(expected);
    },
  );

  it("formats the default-path end with fractionalSecondDigits without opting into wall-clock resolution", () => {
    expect(
      endOfZoned("2024-11-03T01:30:00-05:00[America/New_York]", "hour", {
        fractionalSecondDigits: 9,
      }),
    ).toBe("2024-11-03T01:59:59.999999999-05:00[America/New_York]");
  });

  // Goose Bay fell back at 00:01 Sunday into Saturday 23:01, re-opening a Sunday-first week that
  // ends on the second pass (-04:00). An explicit `disambiguation` used to end it on the first pass
  // (-03:00), before the input; it is now ignored. The end is the second midnight
  // (2010-11-07T00:00:00-04:00) minus 1 ns, checked on @js-temporal/polyfill@0.5.1.
  it.each`
    options                                                     | expected
    ${{ weekStartsOn: "sunday" }}                               | ${"2010-11-06T23:59:59.999999999-04:00[America/Goose_Bay]"}
    ${{ weekStartsOn: "sunday", disambiguation: "compatible" }} | ${"2010-11-06T23:59:59.999999999-04:00[America/Goose_Bay]"}
  `(
    "returns $expected for Goose Bay's re-opened Sunday week with $options",
    ({ options, expected }) => {
      expect(
        endOfZoned(
          "2010-11-06T23:30:00-04:00[America/Goose_Bay]",
          "week",
          options,
        ),
      ).toBe(expected);
    },
  );

  // -271821-04-20T00:00:00Z is the first representable instant (a Tuesday). The start of its month,
  // year and week lies before the range, but every end is representable and must be returned.
  it.each`
    value                                  | unit       | weekStartsOn | expected
    ${"-271821-04-20T12:00:00+00:00[UTC]"} | ${"day"}   | ${undefined} | ${"-271821-04-20T23:59:59.999999999+00:00[UTC]"}
    ${"-271821-04-20T12:00:00+00:00[UTC]"} | ${"week"}  | ${"monday"}  | ${"-271821-04-25T23:59:59.999999999+00:00[UTC]"}
    ${"-271821-04-20T12:00:00+00:00[UTC]"} | ${"week"}  | ${"sunday"}  | ${"-271821-04-24T23:59:59.999999999+00:00[UTC]"}
    ${"-271821-04-20T12:00:00+00:00[UTC]"} | ${"month"} | ${undefined} | ${"-271821-04-30T23:59:59.999999999+00:00[UTC]"}
    ${"-271821-04-20T12:00:00+00:00[UTC]"} | ${"year"}  | ${undefined} | ${"-271821-12-31T23:59:59.999999999+00:00[UTC]"}
  `(
    "returns $expected as the $unit end of the first-day value $value (weekStartsOn $weekStartsOn)",
    ({ value, unit, weekStartsOn, expected }) => {
      expect(endOfZoned(value, unit, { weekStartsOn })).toBe(expected);
    },
  );
});

describe("endOfZoned at the maximum instant", () => {
  // The next hour starts at +275760-09-13T00:00:00Z, the maximum instant, so the end is one
  // nanosecond before it, written in full. Checked with `Instant` arithmetic: the polyfill cannot
  // parse these zoned strings (`Invalid time value`, see js-temporal-polyfill-bugs.md).
  it.each`
    value                                                 | unit      | expected
    ${"+275760-09-13T09:30:00+10:00[Australia/Sydney]"}   | ${"hour"} | ${"+275760-09-13T09:59:59.999999999+10:00[Australia/Sydney]"}
    ${"+275760-09-13T13:30:00+14:00[Pacific/Kiritimati]"} | ${"hour"} | ${"+275760-09-13T13:59:59.999999999+14:00[Pacific/Kiritimati]"}
  `(
    "returns $expected for the $unit of $value",
    ({ value, unit, expected }) => {
      expect(endOfZoned(value, unit)).toBe(expected);
    },
  );
});

// Calendar & zone semantics §3: end = next start − 1 ns, and never before the input. A Temporal
// string without a fraction reads as .000000000 (ParseISODateTime), so a truncated end would name
// next start − 1 s and fall before an input inside the unit's final second. Each `nextStart` is the
// real next local bucket in the probe zone; each `expected` is
// `Temporal.ZonedDateTime.from(nextStart).subtract({ nanoseconds: 1 })` on the plain polyfill.
describe("endOfZoned for an input inside the unit's final second", () => {
  it.each`
    value                                                 | unit       | nextStart                                           | expected                                                      | description
    ${"2024-03-31T23:59:59.5+00:00[UTC]"}                 | ${"month"} | ${"2024-04-01T00:00:00+00:00[UTC]"}                 | ${"2024-03-31T23:59:59.999999999+00:00[UTC]"}                 | ${"UTC month"}
    ${"2024-09-29T03:59:59.5+13:45[Pacific/Chatham]"}     | ${"hour"}  | ${"2024-09-29T04:00:00+13:45[Pacific/Chatham]"}     | ${"2024-09-29T03:59:59.999999999+13:45[Pacific/Chatham]"}     | ${"Chatham's 15-minute 03:00 hour after spring-forward"}
    ${"2020-10-04T03:59:59.5+11:00[Antarctica/Casey]"}    | ${"hour"}  | ${"2020-10-04T04:00:00+11:00[Antarctica/Casey]"}    | ${"2020-10-04T03:59:59.999999999+11:00[Antarctica/Casey]"}    | ${"Casey after its three-hour jump"}
    ${"2024-11-03T01:59:59.5-05:00[America/New_York]"}    | ${"hour"}  | ${"2024-11-03T02:00:00-05:00[America/New_York]"}    | ${"2024-11-03T01:59:59.999999999-05:00[America/New_York]"}    | ${"New York fall-back, second pass"}
    ${"2024-04-07T01:59:59.5+10:30[Australia/Lord_Howe]"} | ${"hour"}  | ${"2024-04-07T02:00:00+10:30[Australia/Lord_Howe]"} | ${"2024-04-07T01:59:59.999999999+10:30[Australia/Lord_Howe]"} | ${"Lord Howe's 90-minute hour"}
    ${"2024-09-07T23:59:59.5-04:00[America/Santiago]"}    | ${"day"}   | ${"2024-09-08T01:00:00-03:00[America/Santiago]"}    | ${"2024-09-07T23:59:59.999999999-04:00[America/Santiago]"}    | ${"the day before Santiago's skipped midnight"}
    ${"2010-11-06T23:59:59.5-04:00[America/Goose_Bay]"}   | ${"day"}   | ${"2010-11-07T00:00:00-04:00[America/Goose_Bay]"}   | ${"2010-11-06T23:59:59.999999999-04:00[America/Goose_Bay]"}   | ${"Goose Bay's re-entered 6 November"}
    ${"2011-12-29T23:59:59.5-10:00[Pacific/Apia]"}        | ${"day"}   | ${"2011-12-31T00:00:00+14:00[Pacific/Apia]"}        | ${"2011-12-29T23:59:59.999999999-10:00[Pacific/Apia]"}        | ${"the day before Apia's deleted 30 December"}
  `(
    "returns $expected (next start $nextStart − 1 ns) as the $unit end of $value ($description)",
    ({ value, unit, nextStart, expected }) => {
      const end = endOfZoned(value, unit);
      const next = Temporal.ZonedDateTime.from(nextStart);

      expect(end).toBe(expected);
      expect(
        Temporal.ZonedDateTime.from(end).equals(
          next.subtract({ nanoseconds: 1 }),
        ),
      ).toBe(true);
      expect(Temporal.ZonedDateTime.compare(end, value)).toBeGreaterThanOrEqual(
        0,
      );
      expect(Temporal.ZonedDateTime.compare(value, next)).toBe(-1);
    },
  );
});
