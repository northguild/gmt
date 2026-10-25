import { Temporal } from "../../internal/temporal";
import { hostileProxy, revokedProxy } from "../../test/hostileValues";
import type { ExactDurationUnit } from "../../types";
import { addUtc } from "../../utc/calculate/addUtc";
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

/** The 14 names `unit` takes: each exact unit in the plural and in the singular. */
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

/** The three duration fields with no exact length, and the six names a caller could ask for. */
const CALENDAR_KEYS = ["years", "months", "weeks"] as const;
const CALENDAR_NAMES = [...CALENDAR_KEYS, "year", "month", "week"] as const;

/**
 * Nanoseconds in one of each exact unit: the SI prefixes below the second, 60 s to the minute,
 * 60 min to the hour, and a day of 24 hours (TC39 Temporal Duration.prototype.total reads a day
 * as 24 hours when it has no relativeTo).
 */
const NANOSECONDS_PER = {
  days: 86_400_000_000_000,
  hours: 3_600_000_000_000,
  minutes: 60_000_000_000,
  seconds: 1_000_000_000,
  milliseconds: 1_000_000,
  microseconds: 1_000,
  nanoseconds: 1,
} as const satisfies Record<ExactDurationUnit, number>;

/** The plural of a unit name, which is the key that holds its length. */
const pluralOf = (unit: (typeof UNIT_NAMES)[number]): ExactDurationUnit =>
  (unit.endsWith("s") ? unit : `${unit}s`) as ExactDurationUnit;

/** Every call the types accept with one key: 7 keys x 14 unit names. */
const EXACT_PAIRS = EXACT_KEYS.flatMap((key) =>
  UNIT_NAMES.map((unit) => ({ key, unit })),
);

describe("totalUnits", () => {
  // Each expected value is the amount times the unit ratio: a minute is 60 s, an hour 3600 s, and
  // a day with no anchor is 24 hours = 86400 s (TC39 Temporal Duration.prototype.total).
  it.each`
    units                                 | unit              | expected                  | why
    ${{ minutes: 15 }}                    | ${"seconds"}      | ${900}                    | ${"15 x 60"}
    ${{ days: 30 }}                       | ${"seconds"}      | ${2592000}                | ${"30 x 86400"}
    ${{ days: 7 }}                        | ${"seconds"}      | ${604800}                 | ${"7 x 86400"}
    ${{ days: 1, hours: 12 }}             | ${"seconds"}      | ${129600}                 | ${"36 x 3600"}
    ${{ seconds: 10 }}                    | ${"milliseconds"} | ${10000}                  | ${"10 x 1000"}
    ${{ hours: 36 }}                      | ${"days"}         | ${1.5}                    | ${"36 / 24"}
    ${{ days: 1, hours: 2, minutes: 30 }} | ${"hours"}        | ${26.5}                   | ${"24 + 2 + 30/60"}
    ${{ milliseconds: 1500 }}             | ${"seconds"}      | ${1.5}                    | ${"1500 / 1000"}
    ${{ nanoseconds: 1 }}                 | ${"days"}         | ${1.1574074074074074e-14} | ${"1 / 8.64e13"}
  `(
    "totals $units as $expected in $unit ($why)",
    ({ units, unit, expected }) => {
      expect(totalUnits(units, unit)).toBe(expected);
    },
  );

  // No field is dropped: 86400 + 7200 + 180 + 4 is 93784 s, and 5 ms + 6 us + 7 ns is 5006007 ns.
  it("totals all seven fields at once: 1 d 2 h 3 min 4 s 5 ms 6 us 7 ns is 93784005006007 nanoseconds", () => {
    expect(
      totalUnits(
        {
          days: 1,
          hours: 2,
          minutes: 3,
          seconds: 4,
          milliseconds: 5,
          microseconds: 6,
          nanoseconds: 7,
        },
        "nanoseconds",
      ),
    ).toBe(93_784_005_006_007);
  });

  // One of each key, in nanoseconds: the ratio every other total is built from.
  it.each`
    key               | expected
    ${"days"}         | ${86_400_000_000_000}
    ${"hours"}        | ${3_600_000_000_000}
    ${"minutes"}      | ${60_000_000_000}
    ${"seconds"}      | ${1_000_000_000}
    ${"milliseconds"} | ${1_000_000}
    ${"microseconds"} | ${1_000}
    ${"nanoseconds"}  | ${1}
  `("totals one of $key as $expected nanoseconds", ({ key, expected }) => {
    expect(totalUnits({ [key]: 1 }, "nanoseconds")).toBe(expected);
  });

  // One 24-hour day in each unit.
  it.each`
    unit              | expected
    ${"days"}         | ${1}
    ${"hours"}        | ${24}
    ${"minutes"}      | ${1440}
    ${"seconds"}      | ${86_400}
    ${"milliseconds"} | ${86_400_000}
    ${"microseconds"} | ${86_400_000_000}
    ${"nanoseconds"}  | ${86_400_000_000_000}
  `("totals { days: 1 } as $expected in $unit", ({ unit, expected }) => {
    expect(totalUnits({ days: 1 }, unit)).toBe(expected);
  });

  // Temporal §13.17 GetTemporalUnitValuedOption: a singular unit name is the same unit as its plural.
  it.each`
    unit             | expected
    ${"day"}         | ${1.5}
    ${"hour"}        | ${36}
    ${"minute"}      | ${2160}
    ${"second"}      | ${129_600}
    ${"millisecond"} | ${129_600_000}
    ${"microsecond"} | ${129_600_000_000}
    ${"nanosecond"}  | ${129_600_000_000_000}
  `(
    "totals { hours: 36 } as $expected in the singular unit $unit",
    ({ unit, expected }) => {
      expect(totalUnits({ hours: 36 }, unit)).toBe(expected);
    },
  );

  // The 98 pairs are the whole space the types accept with one key, so no call the types accept
  // returns null for its key or its unit. The two type assertions tie the lists above to the
  // signature: a name added to either type fails typecheck until it is in the matrix.
  it("returns a number for every exact key in every accepted unit name (98 of 98 pairs)", () => {
    expectTypeOf<
      (typeof EXACT_KEYS)[number]
    >().toEqualTypeOf<ExactDurationUnit>();
    expectTypeOf(totalUnits)
      .parameter(1)
      .toEqualTypeOf<(typeof UNIT_NAMES)[number]>();

    const valid = EXACT_PAIRS.filter(({ key, unit }) =>
      Number.isFinite(totalUnits({ [key]: 1 }, unit)),
    );

    expect(EXACT_PAIRS).toHaveLength(98);
    expect(valid).toHaveLength(98);
  });

  // The count alone would pass on 98 wrong numbers. Each total is the ratio of the two unit
  // lengths, and both lengths are whole numbers under 2^53, so the division is exact to the
  // nearest double, which is what Duration.prototype.total returns.
  it("totals one of each exact key as the ratio of the two unit lengths, in all 98 pairs", () => {
    const wrong = EXACT_PAIRS.map(({ key, unit }) => ({
      key,
      unit,
      total: totalUnits({ [key]: 1 }, unit),
      expected: NANOSECONDS_PER[key] / NANOSECONDS_PER[pluralOf(unit)],
    })).filter(({ total, expected }) => total !== expected);

    expect(wrong).toEqual([]);
  });

  // TC39 Temporal Duration.prototype.total with no relativeTo throws a RangeError when the unit
  // asked for is a calendar unit, or when the duration holds one (IsCalendarUnit: year, month,
  // week). Of the 10 duration fields x 20 unit names, the 98 exact pairs are all that total.
  it("returns null for the 102 of 200 key and unit-name pairs that involve a year, month or week", () => {
    const pairs = [...CALENDAR_KEYS, ...EXACT_KEYS].flatMap((key) =>
      [...CALENDAR_NAMES, ...UNIT_NAMES].map((unit) => ({ key, unit })),
    );
    const total = ({ key, unit }: (typeof pairs)[number]) =>
      totalUnits({ [key]: 1 }, unit as never);
    const isCalendar = (name: string) =>
      (CALENDAR_NAMES as readonly string[]).includes(name);
    const calendarPairs = pairs.filter(
      ({ key, unit }) => isCalendar(key) || isCalendar(unit),
    );
    const numeric = pairs.filter((pair) => Number.isFinite(total(pair)));

    expect(pairs).toHaveLength(200);
    expect(calendarPairs).toHaveLength(102);
    expect(calendarPairs.filter((pair) => total(pair) !== null)).toEqual([]);
    expect(numeric).toHaveLength(98);
  });

  // The narrowing is in the types too: each of these is a compile error as well as null.
  it("makes a calendar key, a calendar unit and a duration string a type error", () => {
    // @ts-expect-error -- `weeks` is not an ExactDurationUnit; write { days: 7 }
    expect(totalUnits({ weeks: 1 }, "days")).toBeNull();
    // @ts-expect-error -- "weeks" is not an exact unit name
    expect(totalUnits({ days: 7 }, "weeks")).toBeNull();
    // @ts-expect-error -- a duration string goes to totalDuration
    expect(totalUnits("PT15M", "seconds")).toBeNull();
  });

  it.each`
    units                      | unit         | expected
    ${{ minutes: -90 }}        | ${"hours"}   | ${-1.5}
    ${{ minutes: -90 }}        | ${"minutes"} | ${-90}
    ${{ days: -1 }}            | ${"hours"}   | ${-24}
    ${{ days: -1, hours: -2 }} | ${"hours"}   | ${-26}
  `(
    "totals the negative amount $units as $expected in $unit",
    ({ units, unit, expected }) => {
      expect(totalUnits(units, unit)).toBe(expected);
    },
  );

  // Zero is a valid amount, and a zero field beside a nonzero one changes nothing. -0 totals as 0.
  it.each`
    units                          | unit         | expected
    ${{ minutes: 0 }}              | ${"seconds"} | ${0}
    ${{ minutes: -0 }}             | ${"seconds"} | ${0}
    ${{ minutes: 15, seconds: 0 }} | ${"seconds"} | ${900}
  `(
    "totals $units with a zero amount as $expected in $unit",
    ({ units, unit, expected }) => {
      expect(totalUnits(units, unit)).toBe(expected);
    },
  );

  // TC39 Temporal IsValidDuration: the days and time fields, summed in seconds, stay under
  // 2^53 = 9007199254740992 in absolute value. The limit is on the sum, not on a field:
  // 104249991374 days is 9007199254713600 s, the last whole day under it, and 27391 s more is
  // 2^53 - 1. An amount past Number.MAX_SAFE_INTEGER is in range while the sum is: 1e21 ns is
  // 1e12 s.
  it.each`
    units                                     | unit             | expected
    ${{ seconds: 2 ** 53 - 1 }}               | ${"seconds"}     | ${9007199254740991}
    ${{ seconds: -(2 ** 53 - 1) }}            | ${"seconds"}     | ${-9007199254740991}
    ${{ days: 104249991374 }}                 | ${"seconds"}     | ${9007199254713600}
    ${{ days: 104249991374 }}                 | ${"nanoseconds"} | ${9.0071992547136e24}
    ${{ days: 104249991374, seconds: 27391 }} | ${"seconds"}     | ${9007199254740991}
    ${{ nanoseconds: 1e21 }}                  | ${"seconds"}     | ${1e12}
  `(
    "totals $units as $expected in $unit, inside the range of a duration",
    ({ units, unit, expected }) => {
      expect(totalUnits(units, unit)).toBe(expected);
    },
  );

  // 2^53 * 1e9 is a whole number of nanoseconds a double holds exactly: 2^53 s to the nanosecond.
  it.each`
    units                                     | reason
    ${{ seconds: 2 ** 53 }}                   | ${"2^53 s"}
    ${{ seconds: -(2 ** 53) }}                | ${"-2^53 s"}
    ${{ days: 104249991375 }}                 | ${"one day past the last whole day"}
    ${{ days: 104249991374, seconds: 27392 }} | ${"fields that sum to 2^53 s"}
    ${{ nanoseconds: 2 ** 53 * 1e9 }}         | ${"2^53 s written in nanoseconds"}
  `(
    "returns null when $units is past the range of a duration ($reason)",
    ({ units }) => {
      expect(totalUnits(units, "seconds")).toBeNull();
    },
  );

  // A year, month or week has no length without a date to measure from, so it is not a key.
  // A zero amount does not make the key acceptable.
  it.each`
    units
    ${{ years: 1 }}
    ${{ months: 1 }}
    ${{ weeks: 1 }}
    ${{ weeks: 1, days: 1 }}
    ${{ weeks: 0, days: 1 }}
    ${{ years: 0, minutes: 15 }}
  `("returns null when $units holds a calendar unit key", ({ units }) => {
    expect(totalUnits(units, "seconds")).toBeNull();
  });

  it.each`
    unit
    ${"years"}
    ${"months"}
    ${"weeks"}
    ${"year"}
    ${"month"}
    ${"week"}
  `("returns null when the calendar unit $unit is asked for", ({ unit }) => {
    expect(totalUnits({ days: 7 }, unit)).toBeNull();
  });

  it("takes no options: a third argument does not make a week measurable", () => {
    const withOptions = totalUnits as (...args: unknown[]) => number | null;

    expect(
      withOptions({ weeks: 1 }, "days", { relativeTo: "2024-01-01" }),
    ).toBeNull();
    expect(
      withOptions({ days: 7 }, "weeks", { relativeTo: "2024-01-01" }),
    ).toBeNull();
  });

  // Temporal on its own ignores an unknown key, so a misspelt { minutes: 15, hour: 1 } would total
  // 900 with no warning: Duration.from({ minutes: 15, hour: 1 }) is PT15M. GMT returns null.
  // Each non-number amount has its own row because raw Temporal reads each one differently:
  // "15" as 15, null as 0, true as 1, undefined as an absent field, and 15n as a TypeError.
  it.each`
    units                             | reason
    ${{ minute: 15 }}                 | ${"unknown key alone (singular)"}
    ${{ minutes: 15, hour: 1 }}       | ${"unknown key beside a valid one"}
    ${{ Minutes: 15 }}                | ${"wrong letter case"}
    ${{ minutes: 1.5 }}               | ${"fractional amount"}
    ${{ hours: 1, minutes: -30 }}     | ${"mixed signs"}
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
  `("returns null when units is $units ($reason)", ({ units }) => {
    expect(totalUnits(units, "seconds")).toBeNull();
  });

  // The two shapes stay separate: an ISO 8601 duration string goes to `totalDuration`.
  it.each`
    units        | label
    ${"PT15M"}   | ${"'PT15M'"}
    ${""}        | ${"''"}
    ${null}      | ${"null"}
    ${undefined} | ${"undefined"}
    ${15}        | ${"15"}
    ${true}      | ${"true"}
  `("returns null when units $label is not an object", ({ units }) => {
    expect(totalUnits(units, "seconds")).toBeNull();
  });

  it.each`
    unit            | label
    ${"fortnights"} | ${"'fortnights'"}
    ${"fortnight"}  | ${"'fortnight'"}
    ${"Seconds"}    | ${"'Seconds'"}
    ${"secondss"}   | ${"'secondss'"}
    ${""}           | ${"''"}
    ${null}         | ${"null"}
    ${undefined}    | ${"undefined"}
    ${123}          | ${"123"}
    ${[]}           | ${"[]"}
    ${{}}           | ${"{}"}
  `("returns null when unit $label is not an exact unit name", ({ unit }) => {
    expect(totalUnits({ minutes: 15 }, unit)).toBeNull();
  });

  // A Temporal.Duration instance is an Object whose fields are read with an ordinary property
  // get, so it is read as the unit object it is. The add* functions read one the same way.
  it("reads a Temporal.Duration instance as its fields, as addUtc does", () => {
    const duration = Temporal.Duration.from("PT15M");

    expect(addUtc("2024-01-01T00:00:00Z", duration)).toBe(
      "2024-01-01T00:15:00Z",
    );
    expect(totalUnits(duration, "seconds")).toBe(900);
  });

  // The object is read as Temporal reads a duration-like one: each unit with an ordinary property
  // get, and undefined as an absent unit. So an inherited unit counts and is checked, an inherited
  // key that is no unit name is never read, and a Duration with every field zero is a zero amount
  // while {} is no amount. 15 min + 1 h is 900 s + 3600 s.
  it.each`
    shape                                                      | units                                                          | expected
    ${"an undefined unit beside an amount"}                    | ${{ minutes: 15, hours: undefined }}                           | ${900}
    ${"own minutes and inherited hours"}                       | ${Object.assign(Object.create({ hours: 1 }), { minutes: 15 })} | ${4500}
    ${"own minutes and an inherited key that is no unit name"} | ${Object.assign(Object.create({ hour: 1 }), { minutes: 15 })}  | ${900}
    ${"an inherited string amount"}                            | ${Object.create({ minutes: "15" })}                            | ${null}
    ${"own minutes and an inherited week"}                     | ${Object.assign(Object.create({ weeks: 1 }), { minutes: 15 })} | ${null}
    ${"a Temporal.Duration with every field zero"}             | ${new Temporal.Duration()}                                     | ${0}
    ${"an empty object"}                                       | ${{}}                                                          | ${null}
  `("returns $expected in seconds for $shape", ({ units, expected }) => {
    expect(totalUnits(units, "seconds")).toBe(expected);
  });

  it.each`
    value    | reason
    ${"P1W"} | ${"a week"}
    ${"P1M"} | ${"a month"}
    ${"P1Y"} | ${"a year"}
  `(
    "returns null for a Temporal.Duration instance of $value ($reason has no exact length)",
    ({ value }) => {
      expect(totalUnits(Temporal.Duration.from(value), "days")).toBeNull();
    },
  );

  // Reading the argument is itself the hazard here: a getter or a proxy trap that throws, and a
  // symbol, which throws on string coercion. Each returns null, never an exception.
  it("returns null rather than throwing for hostile arguments", () => {
    const throwingGetter = {
      get minutes(): never {
        throw new Error("hostile getter");
      },
    };

    expect(totalUnits(throwingGetter, "seconds")).toBeNull();
    expect(totalUnits(hostileProxy() as never, "seconds")).toBeNull();
    expect(totalUnits(revokedProxy() as never, "seconds")).toBeNull();
    expect(totalUnits({ minutes: 15 }, hostileProxy() as never)).toBeNull();
    expect(totalUnits({ minutes: 15 }, revokedProxy() as never)).toBeNull();
    expect(totalUnits({ minutes: 15 }, Symbol("unit") as never)).toBeNull();
    expect(totalUnits(null as never, "nope" as never)).toBeNull();
  });
});
