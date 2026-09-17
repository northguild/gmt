import { Temporal } from "@js-temporal/polyfill";
import {
  battleTestTimeZones,
  calendarZonedFixtures,
  localNoonBattleCases,
} from "../../test";
import { mockTemporalZonedDateTimeFromThrow } from "../../test/mocks";
import { convertZonedToCalendar } from "../convert";
import { parseTimeZoneFromZoned } from "../parse";
import { addZoned } from "./addZoned";

// Local Jan 31 noon in each battle-test timeZone — used for overflow (month-end) tests.
const localJan31NoonBattleCases = battleTestTimeZones.map((timeZone) => ({
  timeZone,
  value: Temporal.ZonedDateTime.from({
    year: 2024,
    month: 1,
    day: 31,
    hour: 12,
    minute: 0,
    second: 0,
    timeZone,
  }).toString(),
}));

describe("addZoned", () => {
  it.each`
    value                               | amount | unit             | expected
    ${"2024-02-29T14:30:00+00:00[UTC]"} | ${1}   | ${"year"}        | ${"2025-02-28T14:30:00+00:00[UTC]"}
    ${"2024-02-29T14:30:00+00:00[UTC]"} | ${1}   | ${"month"}       | ${"2024-03-29T14:30:00+00:00[UTC]"}
    ${"2024-02-29T14:30:00+00:00[UTC]"} | ${2}   | ${"week"}        | ${"2024-03-14T14:30:00+00:00[UTC]"}
    ${"2024-02-29T14:30:00+00:00[UTC]"} | ${1}   | ${"day"}         | ${"2024-03-01T14:30:00+00:00[UTC]"}
    ${"2024-02-29T14:30:00+00:00[UTC]"} | ${2}   | ${"hour"}        | ${"2024-02-29T16:30:00+00:00[UTC]"}
    ${"2024-02-29T14:30:00+00:00[UTC]"} | ${45}  | ${"minute"}      | ${"2024-02-29T15:15:00+00:00[UTC]"}
    ${"2024-02-29T14:30:00+00:00[UTC]"} | ${45}  | ${"second"}      | ${"2024-02-29T14:30:45+00:00[UTC]"}
    ${"2024-02-29T14:30:00+00:00[UTC]"} | ${250} | ${"millisecond"} | ${"2024-02-29T14:30:00.25+00:00[UTC]"}
    ${"2024-02-29T14:30:00+00:00[UTC]"} | ${1}   | ${"microsecond"} | ${"2024-02-29T14:30:00.000001+00:00[UTC]"}
    ${"2024-02-29T14:30:00+00:00[UTC]"} | ${1}   | ${"nanosecond"}  | ${"2024-02-29T14:30:00.000000001+00:00[UTC]"}
  `(
    "returns $expected for $value + $amount $unit",
    ({ value, amount, unit, expected }) => {
      expect(addZoned(value, { [`${unit}s`]: amount } as never)).toBe(expected);
    },
  );

  it.each`
    value                                               | expected
    ${"2024-02-29T14:30:00+00:00[UTC]"}                 | ${"2025-02-28T14:30:00+00:00[UTC]"}
    ${"2024-02-29T14:30:00+00:00[GMT]"}                 | ${"2025-02-28T14:30:00+00:00[GMT]"}
    ${"2024-02-29T14:30:00+00:00[Etc/GMT]"}             | ${"2025-02-28T14:30:00+00:00[Etc/GMT]"}
    ${"2024-02-29T14:30:00+00:00[Europe/Lisbon]"}       | ${"2025-02-28T14:30:00+00:00[Europe/Lisbon]"}
    ${"2024-02-29T14:30:00+00:00[Europe/Dublin]"}       | ${"2025-02-28T14:30:00+00:00[Europe/Dublin]"}
    ${"2024-02-29T14:30:00+01:00[Europe/Berlin]"}       | ${"2025-02-28T14:30:00+01:00[Europe/Berlin]"}
    ${"2024-02-29T14:30:00+02:00[Europe/Helsinki]"}     | ${"2025-02-28T14:30:00+02:00[Europe/Helsinki]"}
    ${"2024-02-29T14:30:00+03:00[Europe/Istanbul]"}     | ${"2025-02-28T14:30:00+03:00[Europe/Istanbul]"}
    ${"2024-02-29T14:30:00+05:30[Asia/Kolkata]"}        | ${"2025-02-28T14:30:00+05:30[Asia/Kolkata]"}
    ${"2024-02-29T14:30:00+05:45[Asia/Kathmandu]"}      | ${"2025-02-28T14:30:00+05:45[Asia/Kathmandu]"}
    ${"2024-02-29T14:30:00+08:00[Asia/Shanghai]"}       | ${"2025-02-28T14:30:00+08:00[Asia/Shanghai]"}
    ${"2024-02-29T14:30:00+11:00[Australia/Lord_Howe]"} | ${"2025-02-28T14:30:00+11:00[Australia/Lord_Howe]"}
    ${"2024-02-29T14:30:00+13:45[Pacific/Chatham]"}     | ${"2025-02-28T14:30:00+13:45[Pacific/Chatham]"}
    ${"2024-02-29T14:30:00+13:00[Pacific/Apia]"}        | ${"2025-02-28T14:30:00+13:00[Pacific/Apia]"}
    ${"2024-02-29T14:30:00-11:00[Pacific/Niue]"}        | ${"2025-02-28T14:30:00-11:00[Pacific/Niue]"}
    ${"2024-02-29T14:30:00-05:00[America/New_York]"}    | ${"2025-02-28T14:30:00-05:00[America/New_York]"}
    ${"2024-02-29T14:30:00-06:00[America/Chicago]"}     | ${"2025-02-28T14:30:00-06:00[America/Chicago]"}
    ${"2024-02-29T14:30:00-07:00[America/Phoenix]"}     | ${"2025-02-28T14:30:00-07:00[America/Phoenix]"}
  `(
    "works across ordered battle-test timeZones for $value",
    ({ value, expected }) => {
      // just add 365 days to leap day
      expect(addZoned(value, { days: 365 })).toBe(expected);
    },
  );

  it.each`
    value                               | amount | unit        | expected
    ${"2024-02-29T14:30:00+00:00[UTC]"} | ${-1}  | ${"hour"}   | ${"2024-02-29T13:30:00+00:00[UTC]"}
    ${"2024-02-29T14:30:00+00:00[UTC]"} | ${-30} | ${"minute"} | ${"2024-02-29T14:00:00+00:00[UTC]"}
  `(
    "returns $expected for negative amount $amount",
    ({ value, amount, unit, expected }) => {
      expect(addZoned(value, { [`${unit}s`]: amount } as never)).toBe(expected);
    },
  );

  it.each`
    invalidValue
    ${"invalid"}
    ${"2024-02-29T14:30:00"}
    ${""}
    ${null}
    ${undefined}
  `(
    "returns an empty string for invalid zoned datetime $invalidValue",
    ({ invalidValue }) => {
      expect(addZoned(invalidValue as never, { hours: 1 } as never)).toBe("");
    },
  );

  it.each`
    invalidAmount
    ${NaN}
    ${null}
    ${undefined}
    ${"1"}
  `(
    "returns an empty string for invalid amount $invalidAmount",
    ({ invalidAmount }) => {
      expect(
        addZoned("2024-02-29T14:30:00+00:00[UTC]", {
          hours: invalidAmount as never,
        } as never),
      ).toBe("");
    },
  );

  it.each`
    invalidUnit
    ${"timeZone"}
    ${""}
    ${null}
    ${undefined}
  `(
    "returns an empty string for invalid unit $invalidUnit",
    ({ invalidUnit }) => {
      expect(
        addZoned("2024-02-29T14:30:00+00:00[UTC]", {
          [String(invalidUnit)]: 1,
        } as never),
      ).toBe("");
    },
  );

  for (const { timeZone, value } of localNoonBattleCases) {
    it(`preserves battle-test timeZone ${timeZone} when adding`, () => {
      expect(parseTimeZoneFromZoned(addZoned(value, { hours: 1 }))).toBe(
        timeZone,
      );
    });
  }

  // disambiguation: fall-back overlap (result of + 1 day lands on an ambiguous local time)
  it.each`
    value                                               | disambiguation  | expected
    ${"2024-11-02T01:30:00-04:00[America/New_York]"}    | ${undefined}    | ${"2024-11-03T01:30:00-04:00[America/New_York]"}
    ${"2024-11-02T01:30:00-04:00[America/New_York]"}    | ${"compatible"} | ${"2024-11-03T01:30:00-04:00[America/New_York]"}
    ${"2024-11-02T01:30:00-04:00[America/New_York]"}    | ${"earlier"}    | ${"2024-11-03T01:30:00-04:00[America/New_York]"}
    ${"2024-11-02T01:30:00-04:00[America/New_York]"}    | ${"later"}      | ${"2024-11-03T01:30:00-05:00[America/New_York]"}
    ${"2024-11-02T01:30:00-04:00[America/New_York]"}    | ${"reject"}     | ${""}
    ${"2024-10-26T02:30:00+02:00[Europe/Berlin]"}       | ${undefined}    | ${"2024-10-27T02:30:00+02:00[Europe/Berlin]"}
    ${"2024-10-26T02:30:00+02:00[Europe/Berlin]"}       | ${"compatible"} | ${"2024-10-27T02:30:00+02:00[Europe/Berlin]"}
    ${"2024-10-26T02:30:00+02:00[Europe/Berlin]"}       | ${"earlier"}    | ${"2024-10-27T02:30:00+02:00[Europe/Berlin]"}
    ${"2024-10-26T02:30:00+02:00[Europe/Berlin]"}       | ${"later"}      | ${"2024-10-27T02:30:00+01:00[Europe/Berlin]"}
    ${"2024-10-26T02:30:00+02:00[Europe/Berlin]"}       | ${"reject"}     | ${""}
    ${"2024-04-06T01:45:00+11:00[Australia/Lord_Howe]"} | ${"compatible"} | ${"2024-04-07T01:45:00+11:00[Australia/Lord_Howe]"}
    ${"2024-04-06T01:45:00+11:00[Australia/Lord_Howe]"} | ${"earlier"}    | ${"2024-04-07T01:45:00+11:00[Australia/Lord_Howe]"}
    ${"2024-04-06T01:45:00+11:00[Australia/Lord_Howe]"} | ${"later"}      | ${"2024-04-07T01:45:00+10:30[Australia/Lord_Howe]"}
    ${"2024-04-06T01:45:00+11:00[Australia/Lord_Howe]"} | ${"reject"}     | ${""}
  `(
    "resolves fall-back overlap for $value + 1 day with disambiguation $disambiguation to $expected",
    ({ value, disambiguation, expected }) => {
      const optionsArg =
        disambiguation === undefined ? undefined : { disambiguation };
      expect(addZoned(value, { days: 1 }, optionsArg)).toBe(expected);
    },
  );

  // disambiguation: spring-forward gap. Temporal §6.5.5 AddZonedDateTime resolves the intermediate
  // wall clock (date added, time kept) with GetEpochNanosecondsFor(timeZone, dateTime,
  // disambiguation), and DisambiguatePossibleEpochNanoseconds shifts a gap landing by the gap
  // length: "earlier" backward, "compatible"/"later" forward, "reject" throws (the sentinel).
  it.each`
    value                                               | disambiguation  | expected
    ${"2024-03-09T02:30:00-05:00[America/New_York]"}    | ${undefined}    | ${"2024-03-10T03:30:00-04:00[America/New_York]"}
    ${"2024-03-09T02:30:00-05:00[America/New_York]"}    | ${"compatible"} | ${"2024-03-10T03:30:00-04:00[America/New_York]"}
    ${"2024-03-09T02:30:00-05:00[America/New_York]"}    | ${"earlier"}    | ${"2024-03-10T01:30:00-05:00[America/New_York]"}
    ${"2024-03-09T02:30:00-05:00[America/New_York]"}    | ${"later"}      | ${"2024-03-10T03:30:00-04:00[America/New_York]"}
    ${"2024-03-09T02:30:00-05:00[America/New_York]"}    | ${"reject"}     | ${""}
    ${"2024-03-30T02:30:00+01:00[Europe/Berlin]"}       | ${undefined}    | ${"2024-03-31T03:30:00+02:00[Europe/Berlin]"}
    ${"2024-03-30T02:30:00+01:00[Europe/Berlin]"}       | ${"compatible"} | ${"2024-03-31T03:30:00+02:00[Europe/Berlin]"}
    ${"2024-03-30T02:30:00+01:00[Europe/Berlin]"}       | ${"earlier"}    | ${"2024-03-31T01:30:00+01:00[Europe/Berlin]"}
    ${"2024-03-30T02:30:00+01:00[Europe/Berlin]"}       | ${"later"}      | ${"2024-03-31T03:30:00+02:00[Europe/Berlin]"}
    ${"2024-03-30T02:30:00+01:00[Europe/Berlin]"}       | ${"reject"}     | ${""}
    ${"2024-10-05T02:15:00+10:30[Australia/Lord_Howe]"} | ${"compatible"} | ${"2024-10-06T02:45:00+11:00[Australia/Lord_Howe]"}
    ${"2024-10-05T02:15:00+10:30[Australia/Lord_Howe]"} | ${"earlier"}    | ${"2024-10-06T01:45:00+10:30[Australia/Lord_Howe]"}
    ${"2024-10-05T02:15:00+10:30[Australia/Lord_Howe]"} | ${"later"}      | ${"2024-10-06T02:45:00+11:00[Australia/Lord_Howe]"}
    ${"2024-10-05T02:15:00+10:30[Australia/Lord_Howe]"} | ${"reject"}     | ${""}
    ${"2011-12-29T12:00:00-10:00[Pacific/Apia]"}        | ${"compatible"} | ${"2011-12-31T12:00:00+14:00[Pacific/Apia]"}
    ${"2011-12-29T12:00:00-10:00[Pacific/Apia]"}        | ${"earlier"}    | ${"2011-12-29T12:00:00-10:00[Pacific/Apia]"}
    ${"2011-12-29T12:00:00-10:00[Pacific/Apia]"}        | ${"later"}      | ${"2011-12-31T12:00:00+14:00[Pacific/Apia]"}
    ${"2011-12-29T12:00:00-10:00[Pacific/Apia]"}        | ${"reject"}     | ${""}
  `(
    "resolves the spring-forward gap for $value + 1 day with disambiguation $disambiguation to $expected",
    ({ value, disambiguation, expected }) => {
      const optionsArg =
        disambiguation === undefined ? undefined : { disambiguation };
      expect(addZoned(value, { days: 1 }, optionsArg)).toBe(expected);
    },
  );

  // Temporal §6.5.5 AddZonedDateTime: the time portion is added in exact time, so disambiguation
  // never re-resolves an instant reached by exact-time arithmetic. With a date portion, it
  // applies only to the intermediate wall-clock date-time (date added, time kept).
  it.each`
    value                                            | units                       | disambiguation | expected
    ${"2024-11-03T01:30:00-05:00[America/New_York]"} | ${{ minutes: 10 }}          | ${"earlier"}   | ${"2024-11-03T01:40:00-05:00[America/New_York]"}
    ${"2024-11-03T00:30:00-04:00[America/New_York]"} | ${{ hours: 1 }}             | ${"later"}     | ${"2024-11-03T01:30:00-04:00[America/New_York]"}
    ${"2024-11-03T00:30:00-04:00[America/New_York]"} | ${{ hours: 1 }}             | ${"reject"}    | ${"2024-11-03T01:30:00-04:00[America/New_York]"}
    ${"2024-11-02T01:30:00-04:00[America/New_York]"} | ${{ hours: 24 }}            | ${"later"}     | ${"2024-11-03T01:30:00-04:00[America/New_York]"}
    ${"2024-11-02T00:30:00-04:00[America/New_York]"} | ${{ days: 1, hours: 1 }}    | ${"later"}     | ${"2024-11-03T01:30:00-04:00[America/New_York]"}
    ${"2024-11-02T01:30:00-04:00[America/New_York]"} | ${{ days: 1, minutes: 10 }} | ${"later"}     | ${"2024-11-03T01:40:00-05:00[America/New_York]"}
    ${"2024-11-02T01:30:00-04:00[America/New_York]"} | ${{ days: 1, minutes: 10 }} | ${"reject"}    | ${""}
    ${"2024-03-09T02:30:00-05:00[America/New_York]"} | ${{ days: 1, minutes: 10 }} | ${"earlier"}   | ${"2024-03-10T01:40:00-05:00[America/New_York]"}
    ${"2024-03-09T02:30:00-05:00[America/New_York]"} | ${{ days: 1, minutes: 10 }} | ${"later"}     | ${"2024-03-10T03:40:00-04:00[America/New_York]"}
    ${"2024-03-09T02:30:00-05:00[America/New_York]"} | ${{ days: 1, minutes: 10 }} | ${"reject"}    | ${""}
  `(
    "adds the time portion of $units to $value in exact time with disambiguation $disambiguation, returns $expected",
    ({ value, units, disambiguation, expected }) => {
      expect(addZoned(value, units, { disambiguation })).toBe(expected);
    },
  );

  it("returns the sentinel for an unknown disambiguation even when the duration is time-only", () => {
    expect(
      addZoned(
        "2024-11-03T01:30:00-05:00[America/New_York]",
        { minutes: 10 },
        { disambiguation: "bogus" as never },
      ),
    ).toBe("");
  });

  // `offset` was removed in 1.16.0: the result's wall clock is resolved from a plain date-time,
  // which has no UTC offset for it to act on (Temporal PlainDateTime#toZonedDateTime reads only
  // `disambiguation`). Passing it is a type error, and a JavaScript caller's stray property changes
  // nothing.
  it("treats the removed offset option as a type error and ignores it at runtime", () => {
    expect(
      addZoned(
        "2024-11-02T01:30:00-04:00[America/New_York]",
        { days: 1 },
        // @ts-expect-error -- `offset` was removed in 1.16.0
        { disambiguation: "later", offset: "reject" },
      ),
    ).toBe("2024-11-03T01:30:00-05:00[America/New_York]");
  });

  for (const { timeZone, value } of localJan31NoonBattleCases) {
    it(`clamps out-of-range results with the default overflow (constrain) across battle-test timeZone ${timeZone}`, () => {
      const result = addZoned(value, { months: 1 });
      expect(result).not.toBe("");
      expect(parseTimeZoneFromZoned(result)).toBe(timeZone);
      expect(result.startsWith("2024-02-29T12:00:00")).toBe(true);
    });

    it(`returns an empty string when overflow is reject and the result is out of range across battle-test timeZone ${timeZone}`, () => {
      expect(addZoned(value, { months: 1 }, { overflow: "reject" })).toBe("");
    });
  }

  it.each`
    value                                            | units             | overflow       | expected
    ${"2024-01-31T12:00:00-05:00[America/New_York]"} | ${{ months: 1 }}  | ${undefined}   | ${"2024-02-29T12:00:00-05:00[America/New_York]"}
    ${"2024-01-31T12:00:00-05:00[America/New_York]"} | ${{ months: 1 }}  | ${"constrain"} | ${"2024-02-29T12:00:00-05:00[America/New_York]"}
    ${"2024-01-31T12:00:00-05:00[America/New_York]"} | ${{ months: 1 }}  | ${"reject"}    | ${""}
    ${"2024-02-29T12:00:00-05:00[America/New_York]"} | ${{ years: 1 }}   | ${undefined}   | ${"2025-02-28T12:00:00-05:00[America/New_York]"}
    ${"2024-02-29T12:00:00-05:00[America/New_York]"} | ${{ years: 1 }}   | ${"reject"}    | ${""}
    ${"2024-01-15T12:00:00-05:00[America/New_York]"} | ${{ months: 1 }}  | ${"reject"}    | ${"2024-02-15T12:00:00-05:00[America/New_York]"}
    ${"2024-03-31T12:00:00-04:00[America/New_York]"} | ${{ months: -1 }} | ${undefined}   | ${"2024-02-29T12:00:00-05:00[America/New_York]"}
    ${"2024-03-31T12:00:00-04:00[America/New_York]"} | ${{ months: -1 }} | ${"constrain"} | ${"2024-02-29T12:00:00-05:00[America/New_York]"}
    ${"2024-03-31T12:00:00-04:00[America/New_York]"} | ${{ months: -1 }} | ${"reject"}    | ${""}
  `(
    "returns $expected for $value + $units with overflow $overflow",
    ({ value, units, overflow, expected }) => {
      expect(
        addZoned(
          value,
          units,
          overflow === undefined ? undefined : { overflow },
        ),
      ).toBe(expected);
    },
  );

  it("does not reject a non-overflowing add across a DST transition (overflow is orthogonal to disambiguation)", () => {
    // Feb 10 + 1 month = Mar 10, a valid date; the add also happens to cross the NY spring-forward
    // boundary (Mar 10 2024), but since the day-of-month never overflows, overflow: "reject" never fires.
    expect(
      addZoned(
        "2024-02-10T02:30:00-05:00[America/New_York]",
        { months: 1 },
        { overflow: "reject" },
      ),
    ).toBe("2024-03-10T03:30:00-04:00[America/New_York]");
  });

  it("succeeds when overflow (constrain) and disambiguation (reject) are both provided but only overflow is actually triggered", () => {
    expect(
      addZoned(
        "2024-01-31T12:00:00-05:00[America/New_York]",
        { months: 1 },
        { overflow: "constrain", disambiguation: "reject" },
      ),
    ).toBe("2024-02-29T12:00:00-05:00[America/New_York]");
  });
  // Temporal's own RFC 9557 string is GMT's calendar grammar. ISO 2024-01-01 is 20 Tevet
  // 5784; + 1 Hebrew month is 20 Shevat, ISO 2024-01-30. Expected: native Temporal (Chromium 153).
  it("adds a Hebrew month to Temporal's own calendar-annotated string", () => {
    expect(
      addZoned("2024-01-01T00:00:00+00:00[UTC][u-ca=hebrew]", { months: 1 }),
    ).toBe("2024-01-30T00:00:00+00:00[UTC][u-ca=hebrew]");
  });

  // Temporal's ParseISODateTime clamps a second of 60 to 59 in every spelling its grammar
  // accepts (DateTimeSeparator SP/T/t, basic TimeSpec); GMT rejects a leap second instead.
  it.each`
    value                               | spelling
    ${"2016-12-31t23:59:60+00:00[UTC]"} | ${"lowercase t separator"}
    ${"2016-12-31 23:59:60+00:00[UTC]"} | ${"space separator"}
    ${"2016-12-31T235960+00:00[UTC]"}   | ${"basic HHMMSS time"}
    ${"20161231T235960Z[UTC]"}          | ${"basic date and time"}
    ${"20161231 235960.5+00:00[UTC]"}   | ${"basic, space separator, fraction"}
  `('returns "" for leap-second value $value ($spelling)', ({ value }) => {
    expect(addZoned(value, { seconds: 1 })).toBe("");
  });
});

// ---------------------------------------------------------------------------------------------
// E7 (issue #152) — GMT calendar-annotated zoned strings. Every expected value below was produced
// by running @js-temporal/polyfill@0.5.1, never hand-written.
// ---------------------------------------------------------------------------------------------
describe("addZoned with GMT calendar-annotated values", () => {
  const H = calendarZonedFixtures.hebrewLeapMonth;
  const E = calendarZonedFixtures.ethiopicPagumen;
  const J = calendarZonedFixtures.japaneseEraFold;
  const G = calendarZonedFixtures.jerusalemGap;

  // DoD-2: the calendar boundary and the DST boundary move in the SAME call, and the answer is a
  // calendar day away from the ISO control — which is the whole reason E7 exists.
  it("crosses a Hebrew leap month and a DST transition in one call", () => {
    expect(addZoned(H.adarI15NewYork, { months: 1 })).toBe(H.adar15NewYork);
  });

  it("differs from the ISO control by one calendar day for the same +1 month", () => {
    expect(addZoned(H.isoControl, { months: 1 })).toBe(H.isoControlPlusMonth);
    // Hebrew lands on 2024-03-25, ISO on 2024-03-24 — one day apart, and the Hebrew answer also
    // carries the -04:00 EDT offset rather than the input's -05:00 EST.
    expect(H.adar15NewYork).toContain("-04:00");
    expect(H.adarI15NewYork).toContain("-05:00");
  });

  // DoD-3: Ethiopic Pagumen overflow crossing Chile's 2025-09-07 spring-forward.
  it("overflows the 30-day 12th month into Pagumen while crossing a DST transition", () => {
    expect(addZoned(E.m12d30_7517Santiago, { months: 1 })).toBe(
      E.pagumen5_7517Santiago,
    );
  });

  it('returns "" for the same Pagumen overflow under overflow: "reject"', () => {
    expect(
      addZoned(E.m12d30_7517Santiago, { months: 1 }, { overflow: "reject" }),
    ).toBe("");
  });

  // DoD-4: era transition AND a DST fold in one call, across all four disambiguation values.
  it.each`
    disambiguation  | expected
    ${undefined}    | ${"2019-05-05T02:30:00+01:00[Africa/Casablanca][u-ca=japanese]"}
    ${"compatible"} | ${"2019-05-05T02:30:00+01:00[Africa/Casablanca][u-ca=japanese]"}
    ${"earlier"}    | ${"2019-05-05T02:30:00+01:00[Africa/Casablanca][u-ca=japanese]"}
    ${"later"}      | ${"2019-05-05T02:30:00+00:00[Africa/Casablanca][u-ca=japanese]"}
    ${"reject"}     | ${""}
  `(
    "resolves the Heisei->Reiwa Casablanca fold to $expected with disambiguation $disambiguation",
    ({ disambiguation, expected }) => {
      expect(
        addZoned(
          J.heisei31_0405Casablanca,
          { months: 1 },
          disambiguation === undefined ? undefined : { disambiguation },
        ),
      ).toBe(expected);
    },
  );

  // R1 regression (E7): a non-"compatible" disambiguation on a calendar-tagged value resolves
  // instead of returning the sentinel.
  it("resolves a non-compatible disambiguation on a calendar-tagged value instead of returning the sentinel", () => {
    expect(
      addZoned(
        J.heisei31_0405Casablanca,
        { months: 1 },
        { disambiguation: "later" },
      ),
    ).not.toBe("");
  });

  it("crosses the Heisei->Reiwa boundary on a plain +1 day in Tokyo", () => {
    expect(addZoned(J.heisei31_0430Tokyo, { days: 1 })).toBe(
      J.reiwa1_0501Tokyo,
    );
  });

  // DoD-7 gap half: the intermediate wall clock (Hebrew date + 1 day, 02:30) lands in the Jerusalem
  // spring-forward gap and resolves with the caller's disambiguation (Temporal §6.5.5
  // AddZonedDateTime). A calendar tag does not change that.
  it.each`
    disambiguation  | expected
    ${"compatible"} | ${G.afterGap}
    ${"earlier"}    | ${"2024-03-29T01:30:00+02:00[Asia/Jerusalem][u-ca=hebrew]"}
    ${"later"}      | ${G.afterGap}
    ${"reject"}     | ${""}
  `(
    "resolves the Jerusalem gap to $expected with disambiguation $disambiguation",
    ({ disambiguation, expected }) => {
      expect(addZoned(G.beforeGap, { days: 1 }, { disambiguation })).toBe(
        expected,
      );
    },
  );

  it.each`
    value                                                                | reason
    ${"2024-02-24T14:30:00-05:00[u-ca=hebrew][America/New_York]"}        | ${"calendar before zone (not RFC 9557)"}
    ${"2019-04-30T12:00:00+09:00[Asia/Tokyo][u-ca=japanese;era=heisei]"} | ${"';era=' is not RFC 9557 syntax"}
    ${"5784-06-15T14:30:00-05:00[America/New_York][u-ca=hebrew]"}        | ${"-05:00 is not New York's offset on ISO 5784-06-15 (EDT)"}
    ${"2024-02-24T14:30:00-05:00[America/New_York][u-ca=martian]"}       | ${"unknown calendar identifier"}
    ${"2024-02-24[u-ca=hebrew]"}                                         | ${"a plain calendar date, not a zoned value"}
  `('returns "" for $value ($reason)', ({ value }) => {
    expect(addZoned(value, { months: 1 })).toBe("");
  });

  it('returns "" when Temporal.ZonedDateTime.from throws for a calendar-tagged value', () => {
    mockTemporalZonedDateTimeFromThrow();
    expect(addZoned(H.adarI15NewYork, { months: 1 })).toBe("");
  });

  it.each(
    battleTestTimeZones.map((timeZone) => ({
      timeZone,
      value: convertZonedToCalendar(
        Temporal.Instant.from("2024-10-03T14:30:45Z")
          .toZonedDateTimeISO(timeZone)
          .toString(),
        "hebrew",
      ),
    })),
  )(
    "adds 1 Hebrew month to $value in $timeZone and keeps the calendar tag and zone",
    ({ timeZone, value }) => {
      const result = addZoned(value, { months: 1 });

      expect(result).not.toBe("");
      // RFC 9557 §4.1: the zone annotation, then the calendar annotation.
      expect(result.endsWith(`[${timeZone}][u-ca=hebrew]`)).toBe(true);
    },
  );
});

describe("addZoned at the maximum instant", () => {
  // TC39 AddZonedDateTime: +1 day moves the wall clock to 09-13T10:00, which resolves to the maximum.
  it.each`
    value                                                 | units          | expected
    ${"+275760-09-12T10:00:00+10:00[Australia/Sydney]"}   | ${{ days: 1 }} | ${"+275760-09-13T10:00:00+10:00[Australia/Sydney]"}
    ${"+275760-09-12T14:00:00+14:00[Pacific/Kiritimati]"} | ${{ days: 1 }} | ${"+275760-09-13T14:00:00+14:00[Pacific/Kiritimati]"}
    ${"+275760-09-13T10:00:00+10:00[Australia/Sydney]"}   | ${{ days: 1 }} | ${""}
  `("adds $units to $value giving $expected", ({ value, units, expected }) => {
    expect(addZoned(value, units)).toBe(expected);
  });
});

// CORE-6 S5: the calendar part of a zoned add follows the Intl era/monthCode proposal's
// NonISODateAdd. Values: Chromium 153 native Temporal
// (`PlainDate.withCalendar(c).toZonedDateTime(zone).add(…)`), offsets as Chromium writes them
// (TemporalZonedDateTimeToString rounds a local mean time offset to the minute).
describe("addZoned in non-ISO calendars (CORE-6)", () => {
  it.each`
    value                                                              | units            | expected                                                           | reason
    ${"+275759-09-13T00:00:00+00:00[UTC][u-ca=buddhist]"}              | ${{ years: 1 }}  | ${"+275760-09-13T00:00:00+00:00[UTC][u-ca=buddhist]"}              | ${"D1: lands exactly on the maximum instant"}
    ${"+275759-09-12T00:00:00-04:00[America/New_York][u-ca=buddhist]"} | ${{ years: 1 }}  | ${"+275760-09-12T00:00:00-04:00[America/New_York][u-ca=buddhist]"} | ${"D1 near the maximum in a named zone"}
    ${"+275759-09-12T00:00:00-12:00[Etc/GMT+12][u-ca=buddhist]"}       | ${{ years: 1 }}  | ${"+275760-09-12T00:00:00-12:00[Etc/GMT+12][u-ca=buddhist]"}       | ${"D1 near the maximum behind UTC"}
    ${"+275760-08-14T00:00:00+00:00[UTC][u-ca=hebrew]"}                | ${{ months: 1 }} | ${"+275760-09-12T00:00:00+00:00[UTC][u-ca=hebrew]"}                | ${"hebrew near the maximum"}
    ${"+275760-08-14T00:00:00-04:00[America/New_York][u-ca=hebrew]"}   | ${{ months: 1 }} | ${"+275760-09-12T00:00:00-04:00[America/New_York][u-ca=hebrew]"}   | ${"hebrew near the maximum in a named zone"}
    ${"1000-01-31T00:00:00-04:56:02[America/New_York][u-ca=buddhist]"} | ${{ months: 1 }} | ${"1000-02-28T00:00:00-04:56[America/New_York][u-ca=buddhist]"}    | ${"proleptic buddhist: ISO 1000 has no Feb 29"}
    ${"1000-01-31T00:00:00-12:00[Etc/GMT+12][u-ca=buddhist]"}          | ${{ months: 1 }} | ${"1000-02-28T00:00:00-12:00[Etc/GMT+12][u-ca=buddhist]"}          | ${"proleptic buddhist behind UTC"}
  `(
    "adds $units to $value giving $expected ($reason)",
    ({ value, units, expected }) => {
      expect(addZoned(value, units)).toBe(expected);
    },
  );

  // Hebrew year <= 0: M06 of -96239 has 29 days (Chromium `daysInMonth`), so M06-23 + 1 month is
  // M07-23, 29 days later: ISO -100000-01-01 + 29 days = -100000-01-30. The wall clock and its
  // -04:56:02 local mean time offset are unchanged; Temporal writes that offset rounded to -04:56.
  it("adds 1 month to -096239-06-23 in hebrew in America/New_York giving -096239-07-23", () => {
    expect(
      addZoned(
        "-100000-01-01T00:00:00-04:56:02[America/New_York][u-ca=hebrew]",
        { months: 1 },
      ),
    ).toBe("-100000-01-30T00:00:00-04:56[America/New_York][u-ca=hebrew]");
  });
});
