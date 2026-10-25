import { Temporal } from "../../internal/temporal";
import { hostileProxy, revokedProxy } from "../../test/hostileValues";
import type { DateTimeDurationUnit } from "../../types";
import { addUtc } from "../../utc/calculate/addUtc";
import { isValidDuration } from "../validate/isValidDuration";
import { durationFromUnits } from "./durationFromUnits";
import { totalDuration } from "./totalDuration";
import { totalUnits } from "./totalUnits";

/** The seven keys `totalUnits` takes: every duration field with an exact length. */
const EXACT_KEYS = [
  "days",
  "hours",
  "minutes",
  "seconds",
  "milliseconds",
  "microseconds",
  "nanoseconds",
] as const;

/** The 14 names `totalUnits` takes as `unit`: each exact unit in the plural and the singular. */
const UNIT_NAMES = [
  ...EXACT_KEYS,
  "day",
  "hour",
  "minute",
  "second",
  "millisecond",
  "microsecond",
  "nanosecond",
] as const;

/**
 * The largest duration: TC39 Temporal IsValidDuration keeps years, months and weeks each under
 * 2^32, and the days and time fields, summed in seconds, under 2^53.
 */
const LARGEST_DURATION = {
  years: 2 ** 32 - 1,
  months: 2 ** 32 - 1,
  weeks: 2 ** 32 - 1,
  seconds: 2 ** 53 - 1,
  milliseconds: 999,
  microseconds: 999,
  nanoseconds: 999,
};

/** The smallest duration: the limits are on absolute values, so it is the largest one negated. */
const SMALLEST_DURATION = {
  years: -(2 ** 32 - 1),
  months: -(2 ** 32 - 1),
  weeks: -(2 ** 32 - 1),
  seconds: -(2 ** 53 - 1),
  milliseconds: -999,
  microseconds: -999,
  nanoseconds: -999,
};

describe("durationFromUnits", () => {
  // TC39 TemporalDurationToString writes each field from years to minutes as it is stored, so
  // nothing is carried into a larger unit. The seconds field and the three below it are written
  // as one decimal number of seconds: 1 s + 1500 ms is 2.5 s, and 60000 ms is 60 s, not a minute.
  it.each`
    units                                 | expected      | why
    ${{ minutes: 15 }}                    | ${"PT15M"}    | ${"one time field"}
    ${{ days: 1, hours: 12 }}             | ${"P1DT12H"}  | ${"a date field and a time field"}
    ${{ minutes: 90 }}                    | ${"PT90M"}    | ${"not carried into hours"}
    ${{ seconds: 90061 }}                 | ${"PT90061S"} | ${"not carried into minutes, hours or days"}
    ${{ years: 1, months: 2 }}            | ${"P1Y2M"}    | ${"calendar fields need no anchor"}
    ${{ weeks: 1 }}                       | ${"P1W"}      | ${"a week stays a week"}
    ${{ milliseconds: 1500 }}             | ${"PT1.5S"}   | ${"1500 / 1000 seconds"}
    ${{ seconds: 1, milliseconds: 1500 }} | ${"PT2.5S"}   | ${"1 + 1500 / 1000 seconds"}
    ${{ milliseconds: 60000 }}            | ${"PT60S"}    | ${"60 seconds, not carried into minutes"}
    ${{ minutes: 15, seconds: 0 }}        | ${"PT15M"}    | ${"a zero field is not written"}
  `("writes $units as $expected ($why)", ({ units, expected }) => {
    const value = durationFromUnits(units);

    expect(value).toBe(expected);
    expect(isValidDuration(value)).toBe(true);
  });

  it.each`
    key               | expected
    ${"years"}        | ${"P1Y"}
    ${"months"}       | ${"P1M"}
    ${"weeks"}        | ${"P1W"}
    ${"days"}         | ${"P1D"}
    ${"hours"}        | ${"PT1H"}
    ${"minutes"}      | ${"PT1M"}
    ${"seconds"}      | ${"PT1S"}
    ${"milliseconds"} | ${"PT0.001S"}
    ${"microseconds"} | ${"PT0.000001S"}
    ${"nanoseconds"}  | ${"PT0.000000001S"}
  `("writes one of $key as $expected", ({ key, expected }) => {
    const value = durationFromUnits({ [key]: 1 });

    expect(value).toBe(expected);
    expect(isValidDuration(value)).toBe(true);
  });

  // 7 s + 8 ms + 9 us + 10 ns is 7.008 009 010 s, written without its trailing zero.
  it("writes all ten fields in ISO 8601 order", () => {
    const value = durationFromUnits({
      nanoseconds: 10,
      microseconds: 9,
      milliseconds: 8,
      seconds: 7,
      minutes: 6,
      hours: 5,
      days: 4,
      weeks: 3,
      months: 2,
      years: 1,
    });

    expect(value).toBe("P1Y2M3W4DT5H6M7.00800901S");
    expect(isValidDuration(value)).toBe(true);
  });

  // TC39 Temporal's duration grammar has one optional sign, before the P, and
  // TemporalDurationToString writes "-" there for a negative duration.
  it.each`
    units                      | expected
    ${{ minutes: -15 }}        | ${"-PT15M"}
    ${{ years: -1, days: -2 }} | ${"-P1Y2D"}
    ${{ milliseconds: -1500 }} | ${"-PT1.5S"}
  `("writes the negative amount $units as $expected", ({ units, expected }) => {
    const value = durationFromUnits(units);

    expect(value).toBe(expected);
    expect(isValidDuration(value)).toBe(true);
  });

  // Every zero duration is "PT0S", the one spelling Temporal writes for it. -0 is zero.
  it.each`
    units
    ${{ minutes: 0 }}
    ${{ years: 0 }}
    ${{ minutes: -0 }}
    ${{ days: 0, seconds: 0 }}
  `("writes the zero amount $units as PT0S", ({ units }) => {
    const value = durationFromUnits(units);

    expect(value).toBe("PT0S");
    expect(isValidDuration(value)).toBe(true);
  });

  // TC39 Temporal IsValidDuration: years, months and weeks are each under 2^32 in absolute value,
  // and the days and time fields, summed in seconds, are under 2^53 = 9007199254740992.
  // 104249991374 days is 9007199254713600 s, the last whole day under it. An amount past
  // Number.MAX_SAFE_INTEGER is in range while the sum is: 1e21 ns is 1e12 s.
  it.each`
    units                            | expected
    ${{ years: 2 ** 32 - 1 }}        | ${"P4294967295Y"}
    ${{ seconds: 2 ** 53 - 1 }}      | ${"PT9007199254740991S"}
    ${{ milliseconds: 2 ** 53 - 1 }} | ${"PT9007199254740.991S"}
    ${{ days: 104249991374 }}        | ${"P104249991374D"}
    ${{ nanoseconds: 1e21 }}         | ${"PT1000000000000S"}
    ${LARGEST_DURATION}              | ${"P4294967295Y4294967295M4294967295WT9007199254740991.999999999S"}
    ${SMALLEST_DURATION}             | ${"-P4294967295Y4294967295M4294967295WT9007199254740991.999999999S"}
  `(
    "writes $units as $expected, inside the range of a duration",
    ({ units, expected }) => {
      const value = durationFromUnits(units);

      expect(value).toBe(expected);
      expect(isValidDuration(value)).toBe(true);
    },
  );

  // 2^53 * 1e9 is a whole number of nanoseconds a double holds exactly: 2^53 s to the nanosecond.
  it.each`
    units                                         | reason
    ${{ years: 2 ** 32 }}                         | ${"2^32 years"}
    ${{ months: 2 ** 32 }}                        | ${"2^32 months"}
    ${{ weeks: 2 ** 32 }}                         | ${"2^32 weeks"}
    ${{ years: -(2 ** 32) }}                      | ${"-2^32 years"}
    ${{ seconds: 2 ** 53 }}                       | ${"2^53 s"}
    ${{ seconds: -(2 ** 53) }}                    | ${"-2^53 s"}
    ${{ days: 104249991375 }}                     | ${"one day past the last whole day"}
    ${{ ...LARGEST_DURATION, nanoseconds: 1000 }} | ${"one nanosecond past the largest duration"}
    ${{ nanoseconds: 2 ** 53 * 1e9 }}             | ${"2^53 s written in nanoseconds"}
  `(
    'returns "" when $units is past the range of a duration ($reason)',
    ({ units }) => {
      expect(durationFromUnits(units)).toBe("");
    },
  );

  // Temporal on its own ignores an unknown key, so a misspelt { minutes: 15, hour: 1 } would be
  // written "PT15M" with no warning: Duration.from({ minutes: 15, hour: 1 }) is PT15M. GMT returns "".
  // Each non-number amount has its own row because raw Temporal reads each one differently:
  // "15" as 15, null as 0, true as 1, undefined as an absent field, and 15n as a TypeError.
  it.each`
    units                             | reason
    ${{ minute: 15 }}                 | ${"unknown key alone (singular)"}
    ${{ minutes: 15, hour: 1 }}       | ${"unknown key beside a valid one"}
    ${{ Minutes: 15 }}                | ${"wrong letter case"}
    ${{ minutes: 1.5 }}               | ${"fractional amount"}
    ${{ hours: 1, minutes: -30 }}     | ${"mixed signs"}
    ${{ years: 1, days: -1 }}         | ${"mixed signs across date fields"}
    ${{}}                             | ${"no key"}
    ${[]}                             | ${"empty array"}
    ${[15]}                           | ${"array with an index key"}
    ${{ minutes: Number.NaN }}        | ${"NaN amount"}
    ${{ minutes: Infinity }}          | ${"Infinity amount"}
    ${{ minutes: "15" }}              | ${"string amount"}
    ${{ minutes: null }}              | ${"null amount"}
    ${{ minutes: undefined }}         | ${"undefined amount"}
    ${{ minutes: true }}              | ${"boolean amount"}
    ${{ minutes: 15n }}               | ${"bigint amount"}
    ${{ minutes: 15, seconds: "30" }} | ${"string amount beside a valid one"}
  `('returns "" when units is $units ($reason)', ({ units }) => {
    expect(durationFromUnits(units)).toBe("");
  });

  // The two shapes stay separate: a duration string is already what this function writes.
  it.each`
    units        | label
    ${"PT15M"}   | ${"'PT15M'"}
    ${""}        | ${"''"}
    ${null}      | ${"null"}
    ${undefined} | ${"undefined"}
    ${15}        | ${"15"}
    ${true}      | ${"true"}
  `("returns '' when units $label is not an object", ({ units }) => {
    expect(durationFromUnits(units)).toBe("");
  });

  // The signature says the same: each of these is a compile error as well as "".
  it("makes an unknown key and a duration string a type error", () => {
    expectTypeOf(durationFromUnits)
      .parameter(0)
      .toEqualTypeOf<Partial<Record<DateTimeDurationUnit, number>>>();

    // @ts-expect-error -- `minute` is not a duration field; the keys are plural
    expect(durationFromUnits({ minute: 15 })).toBe("");
    // @ts-expect-error -- a duration string is already what this function writes
    expect(durationFromUnits("PT15M")).toBe("");
  });

  // The string is the one the other duration functions take, and it totals to the same number as
  // the unit object it was written from.
  it.each`
    units                                 | unit
    ${{ minutes: 15 }}                    | ${"seconds"}
    ${{ days: 30 }}                       | ${"seconds"}
    ${{ days: 1, hours: 12 }}             | ${"seconds"}
    ${{ seconds: 10 }}                    | ${"milliseconds"}
    ${{ hours: 36 }}                      | ${"days"}
    ${{ minutes: -90 }}                   | ${"hours"}
    ${{ days: -1, hours: -2 }}            | ${"hours"}
    ${{ minutes: 0 }}                     | ${"seconds"}
    ${{ nanoseconds: 1 }}                 | ${"days"}
    ${{ days: 1, hours: 2, minutes: 30 }} | ${"hours"}
    ${{ milliseconds: 1500 }}             | ${"second"}
    ${{ seconds: 1, milliseconds: 1500 }} | ${"milliseconds"}
    ${{ days: 104249991374 }}             | ${"nanoseconds"}
    ${{ seconds: 2 ** 53 - 1 }}           | ${"seconds"}
    ${{ seconds: -(2 ** 53 - 1) }}        | ${"seconds"}
    ${{ nanoseconds: 1e21 }}              | ${"seconds"}
  `(
    "round trip: totalDuration(durationFromUnits($units), $unit) equals totalUnits",
    ({ units, unit }) => {
      const value = durationFromUnits(units);
      const total = totalUnits(units, unit);

      expect(isValidDuration(value)).toBe(true);
      expect(total).not.toBeNull();
      expect(totalDuration(value, unit)).toBe(total);
    },
  );

  // The same round trip over every call `totalUnits` accepts with one key: 7 keys x 14 unit names.
  it("round trip: holds for one of each exact key in every unit name (98 of 98 pairs)", () => {
    const pairs = EXACT_KEYS.flatMap((key) =>
      UNIT_NAMES.map((unit) => ({ key, unit })),
    );
    const held = pairs.filter(({ key, unit }) => {
      const value = durationFromUnits({ [key]: 1 });
      const total = totalUnits({ [key]: 1 }, unit);

      return (
        isValidDuration(value) &&
        total !== null &&
        totalDuration(value, unit) === total
      );
    });

    expect(pairs).toHaveLength(98);
    expect(held).toHaveLength(98);
  });

  // A calendar amount goes through the string to `totalDuration`, which takes the anchor.
  // 2024 is a leap year of 366 days and its February has 29; a week is 7 days from any date.
  it.each`
    units            | unit      | relativeTo      | expected
    ${{ years: 1 }}  | ${"days"} | ${"2024-01-01"} | ${366}
    ${{ months: 1 }} | ${"days"} | ${"2024-02-01"} | ${29}
    ${{ weeks: 1 }}  | ${"days"} | ${"2024-01-01"} | ${7}
  `(
    "bridges the calendar amount $units to $expected $unit relativeTo $relativeTo",
    ({ units, unit, relativeTo, expected }) => {
      expect(totalUnits(units, unit)).toBeNull();
      expect(
        totalDuration(durationFromUnits(units), unit, { relativeTo }),
      ).toBe(expected);
    },
  );

  // A Temporal.Duration instance is an Object whose fields are read with an ordinary property
  // get, so it is read as the unit object it is. The add* functions read one the same way.
  it("reads a Temporal.Duration instance as its fields, as addUtc does", () => {
    const duration = Temporal.Duration.from("P1Y2MT15M");

    expect(addUtc("2024-01-01T00:00:00Z", duration)).toBe(
      "2025-03-01T00:15:00Z",
    );
    expect(durationFromUnits(duration)).toBe("P1Y2MT15M");
  });

  // The object is read as Temporal reads a duration-like one: each unit with an ordinary property
  // get, and undefined as an absent unit. So an inherited unit counts and is checked, an inherited
  // key that is no unit name is never read, and a Duration with every field zero is a zero amount
  // while {} is no amount.
  it.each`
    shape                                                      | units                                                          | expected
    ${"an undefined unit beside an amount"}                    | ${{ minutes: 15, hours: undefined }}                           | ${"PT15M"}
    ${"own minutes and inherited hours"}                       | ${Object.assign(Object.create({ hours: 1 }), { minutes: 15 })} | ${"PT1H15M"}
    ${"own minutes and an inherited key that is no unit name"} | ${Object.assign(Object.create({ hour: 1 }), { minutes: 15 })}  | ${"PT15M"}
    ${"an inherited string amount"}                            | ${Object.create({ minutes: "15" })}                            | ${""}
    ${"an inherited boolean amount"}                           | ${Object.create({ minutes: true })}                            | ${""}
    ${"a Temporal.Duration with every field zero"}             | ${new Temporal.Duration()}                                     | ${"PT0S"}
    ${"an empty object"}                                       | ${{}}                                                          | ${""}
  `("returns '$expected' for $shape", ({ units, expected }) => {
    expect(durationFromUnits(units)).toBe(expected);
  });

  // Reading the argument is itself the hazard here: a getter or a proxy trap that throws.
  // Each returns "", never an exception.
  it('returns "" rather than throwing for hostile arguments', () => {
    const throwingGetter = {
      get minutes(): never {
        throw new Error("hostile getter");
      },
    };

    expect(durationFromUnits(throwingGetter)).toBe("");
    expect(durationFromUnits(hostileProxy() as never)).toBe("");
    expect(durationFromUnits(revokedProxy() as never)).toBe("");
  });
});
