import { Temporal } from "@js-temporal/polyfill";
import {
  battleTestTimeZones,
  calendarZonedFixtures,
  localNoonBattleCases,
} from "../../test";
import { mockTemporalZonedDateTimeFromThrow } from "../../test/mocks";
import { convertZonedToCalendar } from "../convert";
import { parseTimeZoneFromZoned } from "../parse";
import { subtractZoned } from "./subtractZoned";

// Local Mar 31 noon in each battle-test timeZone — used for overflow (month-end) tests.
const localMar31NoonBattleCases = battleTestTimeZones.map((timeZone) => ({
  timeZone,
  value: Temporal.ZonedDateTime.from({
    year: 2024,
    month: 3,
    day: 31,
    hour: 12,
    minute: 0,
    second: 0,
    timeZone,
  }).toString(),
}));

describe("subtractZoned", () => {
  it.each`
    value                               | amount | unit             | expected
    ${"2024-02-29T14:30:00+00:00[UTC]"} | ${1}   | ${"year"}        | ${"2023-02-28T14:30:00+00:00[UTC]"}
    ${"2024-02-29T14:30:00+00:00[UTC]"} | ${1}   | ${"month"}       | ${"2024-01-29T14:30:00+00:00[UTC]"}
    ${"2024-02-29T14:30:00+00:00[UTC]"} | ${2}   | ${"week"}        | ${"2024-02-15T14:30:00+00:00[UTC]"}
    ${"2024-02-29T14:30:00+00:00[UTC]"} | ${1}   | ${"day"}         | ${"2024-02-28T14:30:00+00:00[UTC]"}
    ${"2024-02-29T14:30:00+00:00[UTC]"} | ${2}   | ${"hour"}        | ${"2024-02-29T12:30:00+00:00[UTC]"}
    ${"2024-02-29T14:30:00+00:00[UTC]"} | ${45}  | ${"minute"}      | ${"2024-02-29T13:45:00+00:00[UTC]"}
    ${"2024-02-29T14:30:00+00:00[UTC]"} | ${45}  | ${"second"}      | ${"2024-02-29T14:29:15+00:00[UTC]"}
    ${"2024-02-29T14:30:00+00:00[UTC]"} | ${250} | ${"millisecond"} | ${"2024-02-29T14:29:59.75+00:00[UTC]"}
    ${"2024-02-29T14:30:00+00:00[UTC]"} | ${1}   | ${"microsecond"} | ${"2024-02-29T14:29:59.999999+00:00[UTC]"}
    ${"2024-02-29T14:30:00+00:00[UTC]"} | ${1}   | ${"nanosecond"}  | ${"2024-02-29T14:29:59.999999999+00:00[UTC]"}
  `(
    "returns $expected for $value - $amount $unit",
    ({ value, amount, unit, expected }) => {
      expect(subtractZoned(value, { [`${unit}s`]: amount } as never)).toBe(
        expected,
      );
    },
  );

  it.each`
    value                                               | expected
    ${"2024-02-29T14:30:00+00:00[UTC]"}                 | ${"2023-03-01T14:30:00+00:00[UTC]"}
    ${"2024-02-29T14:30:00+00:00[GMT]"}                 | ${"2023-03-01T14:30:00+00:00[GMT]"}
    ${"2024-02-29T14:30:00+00:00[Etc/GMT]"}             | ${"2023-03-01T14:30:00+00:00[Etc/GMT]"}
    ${"2024-02-29T14:30:00+00:00[Europe/Lisbon]"}       | ${"2023-03-01T14:30:00+00:00[Europe/Lisbon]"}
    ${"2024-02-29T14:30:00+00:00[Europe/Dublin]"}       | ${"2023-03-01T14:30:00+00:00[Europe/Dublin]"}
    ${"2024-02-29T14:30:00+01:00[Europe/Berlin]"}       | ${"2023-03-01T14:30:00+01:00[Europe/Berlin]"}
    ${"2024-02-29T14:30:00+02:00[Europe/Helsinki]"}     | ${"2023-03-01T14:30:00+02:00[Europe/Helsinki]"}
    ${"2024-02-29T14:30:00+03:00[Europe/Istanbul]"}     | ${"2023-03-01T14:30:00+03:00[Europe/Istanbul]"}
    ${"2024-02-29T14:30:00+05:30[Asia/Kolkata]"}        | ${"2023-03-01T14:30:00+05:30[Asia/Kolkata]"}
    ${"2024-02-29T14:30:00+05:45[Asia/Kathmandu]"}      | ${"2023-03-01T14:30:00+05:45[Asia/Kathmandu]"}
    ${"2024-02-29T14:30:00+08:00[Asia/Shanghai]"}       | ${"2023-03-01T14:30:00+08:00[Asia/Shanghai]"}
    ${"2024-02-29T14:30:00+11:00[Australia/Lord_Howe]"} | ${"2023-03-01T14:30:00+11:00[Australia/Lord_Howe]"}
    ${"2024-02-29T14:30:00+13:45[Pacific/Chatham]"}     | ${"2023-03-01T14:30:00+13:45[Pacific/Chatham]"}
    ${"2024-02-29T14:30:00+13:00[Pacific/Apia]"}        | ${"2023-03-01T14:30:00+13:00[Pacific/Apia]"}
    ${"2024-02-29T14:30:00-11:00[Pacific/Niue]"}        | ${"2023-03-01T14:30:00-11:00[Pacific/Niue]"}
    ${"2024-02-29T14:30:00-05:00[America/New_York]"}    | ${"2023-03-01T14:30:00-05:00[America/New_York]"}
    ${"2024-02-29T14:30:00-06:00[America/Chicago]"}     | ${"2023-03-01T14:30:00-06:00[America/Chicago]"}
    ${"2024-02-29T14:30:00-07:00[America/Phoenix]"}     | ${"2023-03-01T14:30:00-07:00[America/Phoenix]"}
  `(
    "works across ordered battle-test timeZones for $value",
    ({ value, expected }) => {
      expect(subtractZoned(value, { days: 365 })).toBe(expected);
    },
  );

  it.each`
    value                               | amount | unit        | expected
    ${"2024-02-29T14:30:00+00:00[UTC]"} | ${-1}  | ${"hour"}   | ${"2024-02-29T15:30:00+00:00[UTC]"}
    ${"2024-02-29T14:30:00+00:00[UTC]"} | ${-30} | ${"minute"} | ${"2024-02-29T15:00:00+00:00[UTC]"}
  `(
    "returns $expected for negative amount $amount",
    ({ value, amount, unit, expected }) => {
      expect(subtractZoned(value, { [`${unit}s`]: amount } as never)).toBe(
        expected,
      );
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
      expect(subtractZoned(invalidValue as never, { hours: 1 } as never)).toBe(
        "",
      );
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
        subtractZoned("2024-02-29T14:30:00+00:00[UTC]", {
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
        subtractZoned("2024-02-29T14:30:00+00:00[UTC]", {
          [String(invalidUnit)]: 1,
        } as never),
      ).toBe("");
    },
  );

  for (const { timeZone, value } of localNoonBattleCases) {
    it(`preserves battle-test timeZone ${timeZone} when subtracting`, () => {
      expect(parseTimeZoneFromZoned(subtractZoned(value, { hours: 1 }))).toBe(
        timeZone,
      );
    });
  }

  // disambiguation: fall-back overlap (result of - 1 day lands on an ambiguous local time)
  it.each`
    value                                               | disambiguation  | expected
    ${"2024-11-04T01:30:00-05:00[America/New_York]"}    | ${undefined}    | ${"2024-11-03T01:30:00-04:00[America/New_York]"}
    ${"2024-11-04T01:30:00-05:00[America/New_York]"}    | ${"compatible"} | ${"2024-11-03T01:30:00-04:00[America/New_York]"}
    ${"2024-11-04T01:30:00-05:00[America/New_York]"}    | ${"earlier"}    | ${"2024-11-03T01:30:00-04:00[America/New_York]"}
    ${"2024-11-04T01:30:00-05:00[America/New_York]"}    | ${"later"}      | ${"2024-11-03T01:30:00-05:00[America/New_York]"}
    ${"2024-11-04T01:30:00-05:00[America/New_York]"}    | ${"reject"}     | ${""}
    ${"2024-10-28T02:30:00+01:00[Europe/Berlin]"}       | ${undefined}    | ${"2024-10-27T02:30:00+02:00[Europe/Berlin]"}
    ${"2024-10-28T02:30:00+01:00[Europe/Berlin]"}       | ${"compatible"} | ${"2024-10-27T02:30:00+02:00[Europe/Berlin]"}
    ${"2024-10-28T02:30:00+01:00[Europe/Berlin]"}       | ${"earlier"}    | ${"2024-10-27T02:30:00+02:00[Europe/Berlin]"}
    ${"2024-10-28T02:30:00+01:00[Europe/Berlin]"}       | ${"later"}      | ${"2024-10-27T02:30:00+01:00[Europe/Berlin]"}
    ${"2024-10-28T02:30:00+01:00[Europe/Berlin]"}       | ${"reject"}     | ${""}
    ${"2024-04-08T01:45:00+10:30[Australia/Lord_Howe]"} | ${"compatible"} | ${"2024-04-07T01:45:00+11:00[Australia/Lord_Howe]"}
    ${"2024-04-08T01:45:00+10:30[Australia/Lord_Howe]"} | ${"earlier"}    | ${"2024-04-07T01:45:00+11:00[Australia/Lord_Howe]"}
    ${"2024-04-08T01:45:00+10:30[Australia/Lord_Howe]"} | ${"later"}      | ${"2024-04-07T01:45:00+10:30[Australia/Lord_Howe]"}
    ${"2024-04-08T01:45:00+10:30[Australia/Lord_Howe]"} | ${"reject"}     | ${""}
  `(
    "resolves fall-back overlap for $value - 1 day with disambiguation $disambiguation to $expected",
    ({ value, disambiguation, expected }) => {
      const optionsArg =
        disambiguation === undefined ? undefined : { disambiguation };
      expect(subtractZoned(value, { days: 1 }, optionsArg)).toBe(expected);
    },
  );

  // Temporal §6.5.5 AddZonedDateTime (subtraction adds the negated duration): the time portion is
  // subtracted in exact time; disambiguation applies only to the intermediate date-time.
  it.each`
    value                                            | units                       | disambiguation | expected
    ${"2024-11-03T01:50:00-05:00[America/New_York]"} | ${{ minutes: 10 }}          | ${"earlier"}   | ${"2024-11-03T01:40:00-05:00[America/New_York]"}
    ${"2024-11-03T02:30:00-05:00[America/New_York]"} | ${{ hours: 1 }}             | ${"reject"}    | ${"2024-11-03T01:30:00-05:00[America/New_York]"}
    ${"2024-11-04T02:30:00-05:00[America/New_York]"} | ${{ days: 1, hours: 1 }}    | ${"earlier"}   | ${"2024-11-03T01:30:00-05:00[America/New_York]"}
    ${"2024-11-04T01:40:00-05:00[America/New_York]"} | ${{ days: 1, minutes: 10 }} | ${"later"}     | ${"2024-11-03T01:30:00-05:00[America/New_York]"}
    ${"2024-11-04T01:40:00-05:00[America/New_York]"} | ${{ days: 1, minutes: 10 }} | ${"reject"}    | ${""}
    ${"2024-03-11T02:40:00-04:00[America/New_York]"} | ${{ days: 1, minutes: 10 }} | ${"earlier"}   | ${"2024-03-10T01:30:00-05:00[America/New_York]"}
    ${"2024-03-11T02:40:00-04:00[America/New_York]"} | ${{ days: 1, minutes: 10 }} | ${"later"}     | ${"2024-03-10T03:30:00-04:00[America/New_York]"}
    ${"2024-03-11T02:40:00-04:00[America/New_York]"} | ${{ days: 1, minutes: 10 }} | ${"reject"}    | ${""}
  `(
    "subtracts the time portion of $units from $value in exact time with disambiguation $disambiguation, returns $expected",
    ({ value, units, disambiguation, expected }) => {
      expect(subtractZoned(value, units, { disambiguation })).toBe(expected);
    },
  );

  // disambiguation: spring-forward gap. Temporal §6.5.5 AddZonedDateTime (subtraction adds the
  // negated duration) resolves the intermediate wall clock (date moved, time kept) with
  // GetEpochNanosecondsFor(timeZone, dateTime, disambiguation); DisambiguatePossibleEpochNanoseconds
  // shifts a gap landing by the gap length: "earlier" backward, "compatible"/"later" forward,
  // "reject" throws (the sentinel).
  it.each`
    value                                               | disambiguation  | expected
    ${"2024-03-11T02:30:00-04:00[America/New_York]"}    | ${undefined}    | ${"2024-03-10T03:30:00-04:00[America/New_York]"}
    ${"2024-03-11T02:30:00-04:00[America/New_York]"}    | ${"compatible"} | ${"2024-03-10T03:30:00-04:00[America/New_York]"}
    ${"2024-03-11T02:30:00-04:00[America/New_York]"}    | ${"earlier"}    | ${"2024-03-10T01:30:00-05:00[America/New_York]"}
    ${"2024-03-11T02:30:00-04:00[America/New_York]"}    | ${"later"}      | ${"2024-03-10T03:30:00-04:00[America/New_York]"}
    ${"2024-03-11T02:30:00-04:00[America/New_York]"}    | ${"reject"}     | ${""}
    ${"2024-04-01T02:30:00+02:00[Europe/Berlin]"}       | ${undefined}    | ${"2024-03-31T03:30:00+02:00[Europe/Berlin]"}
    ${"2024-04-01T02:30:00+02:00[Europe/Berlin]"}       | ${"compatible"} | ${"2024-03-31T03:30:00+02:00[Europe/Berlin]"}
    ${"2024-04-01T02:30:00+02:00[Europe/Berlin]"}       | ${"earlier"}    | ${"2024-03-31T01:30:00+01:00[Europe/Berlin]"}
    ${"2024-04-01T02:30:00+02:00[Europe/Berlin]"}       | ${"later"}      | ${"2024-03-31T03:30:00+02:00[Europe/Berlin]"}
    ${"2024-04-01T02:30:00+02:00[Europe/Berlin]"}       | ${"reject"}     | ${""}
    ${"2024-10-07T02:15:00+11:00[Australia/Lord_Howe]"} | ${"compatible"} | ${"2024-10-06T02:45:00+11:00[Australia/Lord_Howe]"}
    ${"2024-10-07T02:15:00+11:00[Australia/Lord_Howe]"} | ${"earlier"}    | ${"2024-10-06T01:45:00+10:30[Australia/Lord_Howe]"}
    ${"2024-10-07T02:15:00+11:00[Australia/Lord_Howe]"} | ${"later"}      | ${"2024-10-06T02:45:00+11:00[Australia/Lord_Howe]"}
    ${"2024-10-07T02:15:00+11:00[Australia/Lord_Howe]"} | ${"reject"}     | ${""}
    ${"2011-12-31T12:00:00+14:00[Pacific/Apia]"}        | ${"compatible"} | ${"2011-12-31T12:00:00+14:00[Pacific/Apia]"}
    ${"2011-12-31T12:00:00+14:00[Pacific/Apia]"}        | ${"earlier"}    | ${"2011-12-29T12:00:00-10:00[Pacific/Apia]"}
    ${"2011-12-31T12:00:00+14:00[Pacific/Apia]"}        | ${"later"}      | ${"2011-12-31T12:00:00+14:00[Pacific/Apia]"}
    ${"2011-12-31T12:00:00+14:00[Pacific/Apia]"}        | ${"reject"}     | ${""}
  `(
    "resolves the spring-forward gap for $value - 1 day with disambiguation $disambiguation to $expected",
    ({ value, disambiguation, expected }) => {
      const optionsArg =
        disambiguation === undefined ? undefined : { disambiguation };
      expect(subtractZoned(value, { days: 1 }, optionsArg)).toBe(expected);
    },
  );

  // `offset` was removed in 1.16.0: the result's wall clock is resolved from a plain date-time,
  // which has no UTC offset for it to act on (Temporal PlainDateTime#toZonedDateTime reads only
  // `disambiguation`). Passing it is a type error, and a JavaScript caller's stray property changes
  // nothing.
  it("treats the removed offset option as a type error and ignores it at runtime", () => {
    expect(
      subtractZoned(
        "2024-11-04T01:30:00-05:00[America/New_York]",
        { days: 1 },
        // @ts-expect-error -- `offset` was removed in 1.16.0
        { disambiguation: "later", offset: "reject" },
      ),
    ).toBe("2024-11-03T01:30:00-05:00[America/New_York]");
  });

  for (const { timeZone, value } of localMar31NoonBattleCases) {
    it(`clamps out-of-range results with the default overflow (constrain) across battle-test timeZone ${timeZone}`, () => {
      const result = subtractZoned(value, { months: 1 });
      expect(result).not.toBe("");
      expect(parseTimeZoneFromZoned(result)).toBe(timeZone);
      expect(result.startsWith("2024-02-29T12:00:00")).toBe(true);
    });

    it(`returns an empty string when overflow is reject and the result is out of range across battle-test timeZone ${timeZone}`, () => {
      expect(subtractZoned(value, { months: 1 }, { overflow: "reject" })).toBe(
        "",
      );
    });
  }

  it.each`
    value                                            | units             | overflow       | expected
    ${"2024-03-31T12:00:00-04:00[America/New_York]"} | ${{ months: 1 }}  | ${undefined}   | ${"2024-02-29T12:00:00-05:00[America/New_York]"}
    ${"2024-03-31T12:00:00-04:00[America/New_York]"} | ${{ months: 1 }}  | ${"constrain"} | ${"2024-02-29T12:00:00-05:00[America/New_York]"}
    ${"2024-03-31T12:00:00-04:00[America/New_York]"} | ${{ months: 1 }}  | ${"reject"}    | ${""}
    ${"2024-02-29T12:00:00-05:00[America/New_York]"} | ${{ years: 1 }}   | ${undefined}   | ${"2023-02-28T12:00:00-05:00[America/New_York]"}
    ${"2024-02-29T12:00:00-05:00[America/New_York]"} | ${{ years: 1 }}   | ${"reject"}    | ${""}
    ${"2024-01-15T12:00:00-05:00[America/New_York]"} | ${{ months: 1 }}  | ${"reject"}    | ${"2023-12-15T12:00:00-05:00[America/New_York]"}
    ${"2024-03-31T12:00:00-04:00[America/New_York]"} | ${{ months: -1 }} | ${undefined}   | ${"2024-04-30T12:00:00-04:00[America/New_York]"}
    ${"2024-03-31T12:00:00-04:00[America/New_York]"} | ${{ months: -1 }} | ${"constrain"} | ${"2024-04-30T12:00:00-04:00[America/New_York]"}
    ${"2024-03-31T12:00:00-04:00[America/New_York]"} | ${{ months: -1 }} | ${"reject"}    | ${""}
  `(
    "returns $expected for $value - $units with overflow $overflow",
    ({ value, units, overflow, expected }) => {
      expect(
        subtractZoned(
          value,
          units,
          overflow === undefined ? undefined : { overflow },
        ),
      ).toBe(expected);
    },
  );

  it("does not reject a non-overflowing subtract across a DST transition (overflow is orthogonal to disambiguation)", () => {
    // Apr 10 - 1 month = Mar 10, a valid date; the subtract also happens to cross the NY spring-forward
    // boundary (Mar 10 2024), but since the day-of-month never overflows, overflow: "reject" never fires.
    expect(
      subtractZoned(
        "2024-04-10T02:30:00-04:00[America/New_York]",
        { months: 1 },
        { overflow: "reject" },
      ),
    ).toBe("2024-03-10T03:30:00-04:00[America/New_York]");
  });

  it("succeeds when overflow (constrain) and disambiguation (reject) are both provided but only overflow is actually triggered", () => {
    expect(
      subtractZoned(
        "2024-03-31T12:00:00-04:00[America/New_York]",
        { months: 1 },
        { overflow: "constrain", disambiguation: "reject" },
      ),
    ).toBe("2024-02-29T12:00:00-05:00[America/New_York]");
  });
  // E5 (issue #78), decision of record D2 -- see addZoned.test.ts for the full rationale.
  // Temporal's own RFC 9557 string is GMT's calendar grammar. ISO 2024-01-01 is 20 Tevet
  // 5784; - 1 Hebrew month is 20 Kislev, ISO 2023-12-03. Expected: native Temporal (Chromium 153).
  it("subtracts a Hebrew month from Temporal's own calendar-annotated string", () => {
    expect(
      subtractZoned("2024-01-01T00:00:00+00:00[UTC][u-ca=hebrew]", {
        months: 1,
      }),
    ).toBe("2023-12-03T00:00:00+00:00[UTC][u-ca=hebrew]");
  });
});

// ---------------------------------------------------------------------------------------------
// E7 (issue #152) — calendar-annotated zoned strings, RFC 9557 since 1.16.0. Every expected value
// is native Temporal (Chromium 153), never hand-written.
// ---------------------------------------------------------------------------------------------
describe("subtractZoned with RFC 9557 calendar-annotated values", () => {
  const H = calendarZonedFixtures.hebrewLeapMonth;
  const J = calendarZonedFixtures.japaneseEraFold;

  it("crosses a Hebrew leap month and a DST transition in one call", () => {
    expect(subtractZoned(H.adar15NewYork, { months: 1 })).toBe(
      H.adarI15NewYork,
    );
  });

  it("re-derives the Heisei era on a plain -1 day in Tokyo", () => {
    expect(subtractZoned(J.reiwa1_0501Tokyo, { days: 1 })).toBe(
      J.heisei31_0430Tokyo,
    );
  });

  // R1 regression — see addZoned's equivalent test for why this returns "" without the fix.
  it("resolves a non-compatible disambiguation on a calendar-tagged value instead of returning the sentinel", () => {
    expect(
      subtractZoned(
        H.adar15NewYork,
        { months: 1 },
        { disambiguation: "later" },
      ),
    ).toBe(H.adarI15NewYork);
  });

  it.each`
    disambiguation
    ${"compatible"}
    ${"earlier"}
    ${"later"}
  `(
    "returns the Adar I value for disambiguation $disambiguation (no fold involved)",
    ({ disambiguation }) => {
      expect(
        subtractZoned(H.adar15NewYork, { months: 1 }, { disambiguation }),
      ).toBe(H.adarI15NewYork);
    },
  );

  it.each`
    value                                                         | reason
    ${"2024-03-25T14:30:00-04:00[u-ca=hebrew][America/New_York]"} | ${"calendar before zone (not RFC 9557)"}
    ${"2024-13-15T14:30:00-05:00[America/New_York][u-ca=hebrew]"} | ${"ISO month 13 (the digits are ISO)"}
    ${"2024-03-25[u-ca=hebrew]"}                                  | ${"a plain calendar date, not a zoned value"}
  `('returns "" for $value ($reason)', ({ value }) => {
    expect(subtractZoned(value, { months: 1 })).toBe("");
  });

  it('returns "" when Temporal.ZonedDateTime.from throws for a calendar-tagged value', () => {
    mockTemporalZonedDateTimeFromThrow();
    expect(subtractZoned(H.adar15NewYork, { months: 1 })).toBe("");
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
    "subtracts 1 Hebrew month from $value in $timeZone and keeps the calendar tag and zone",
    ({ timeZone, value }) => {
      const result = subtractZoned(value, { months: 1 });

      expect(result).not.toBe("");
      expect(result).toContain("[u-ca=hebrew]");
      expect(result).toContain(`[${timeZone}]`);
    },
  );
});

describe("subtractZoned at the maximum instant", () => {
  it.each`
    value                                               | units           | expected
    ${"+275760-09-12T10:00:00+10:00[Australia/Sydney]"} | ${{ days: -1 }} | ${"+275760-09-13T10:00:00+10:00[Australia/Sydney]"}
    ${"+275760-09-13T10:00:00+10:00[Australia/Sydney]"} | ${{ days: 1 }}  | ${"+275760-09-12T10:00:00+10:00[Australia/Sydney]"}
  `(
    "subtracts $units from $value giving $expected",
    ({ value, units, expected }) => {
      expect(subtractZoned(value, units)).toBe(expected);
    },
  );
});

// CORE-6 S5: a calendar-unit subtraction near the minimum instant. The polyfill's fields -> ISO
// conversion probes outside the legacy Date range there (D1). Values: Chromium 153 native Temporal,
// ISO -271820-05-23T12:00 minus 1 islamic-civil year is -271821-06-03T12:00, read as -280803|M05|7
// and -280804|M05|7.
describe("subtractZoned in non-ISO calendars (CORE-6)", () => {
  it.each`
    value                                                                      | expected
    ${"-271820-05-23T12:00:00+00:00[UTC][u-ca=islamic-civil]"}                 | ${"-271821-06-03T12:00:00+00:00[UTC][u-ca=islamic-civil]"}
    ${"-271820-05-23T12:00:00-04:56:02[America/New_York][u-ca=islamic-civil]"} | ${"-271821-06-03T12:00:00-04:56[America/New_York][u-ca=islamic-civil]"}
    ${"-271820-05-23T12:00:00-12:00[Etc/GMT+12][u-ca=islamic-civil]"}          | ${"-271821-06-03T12:00:00-12:00[Etc/GMT+12][u-ca=islamic-civil]"}
  `("subtracts 1 year from $value giving $expected", ({ value, expected }) => {
    expect(subtractZoned(value, { years: 1 })).toBe(expected);
  });
});
