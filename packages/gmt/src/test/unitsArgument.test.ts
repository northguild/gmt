/**
 * The `units` contract: every public function that takes a unit object, such as `{ minutes: 15 }`,
 * checks exactly what Temporal then reads.
 *
 * TC39 Temporal reads a duration-like object with ordinary property gets
 * (ToTemporalPartialDurationRecord reads each of the ten plural unit names with `Get`), and reads
 * `undefined` as an absent unit. GMT reads each of the ten names once, the same way, checks every
 * value it read, and hands Temporal a fresh object of those values. So an inherited or
 * non-enumerable unit is checked like an own one, and nothing unchecked reaches Temporal.
 *
 * - An own enumerable string key outside the function's unit set returns the sentinel: the guard
 *   against a misspelt key.
 * - An amount that is not a finite number returns the sentinel, wherever it is read from.
 * - A unit outside the function's set returns the sentinel when its amount is not zero.
 * - No unit present returns the sentinel.
 *
 * The reader is `internal/readDurationUnits.ts`.
 */
import { Temporal } from "@js-temporal/polyfill";
import { describe, expect, it } from "vitest";
import {
  addDate,
  addDateTime,
  addTime,
  addUnix,
  addUtc,
  addZoned,
  durationFromUnits,
  subtractDate,
  subtractDateTime,
  subtractTime,
  subtractUnix,
  subtractUtc,
  subtractZoned,
  totalUnits,
} from "../index";

type Call = (units: never) => unknown;
type Units = Record<PropertyKey, unknown>;

type UnitsCase = {
  /** Calls the function with a valid value and the given `units`. */
  call: Call;
  /** A unit inside the function's set. */
  key: string;
  /** A second unit inside the function's set. */
  other: string;
  /** The result for `{ [key]: 1 }`. */
  plain: unknown;
  sentinel: unknown;
  /** An ISO 8601 duration equal to `{ [key]: 1 }`. */
  duration: string;
};

type RestrictedCase = UnitsCase & {
  /** A duration unit outside the function's set. */
  outside: string;
  /** An ISO 8601 duration holding `key` and a nonzero `outside`. */
  outsideDuration: string;
};

const run = (call: Call, units: unknown): unknown => call(units as never);

/** `own` as own enumerable properties of an object that inherits `inherited`. */
const inheriting = (inherited: object, own: object = {}): Units =>
  Object.assign(Object.create(inherited) as Units, own);

/** One non-enumerable own property. */
const hidden = (key: string, value: unknown): Units =>
  Object.defineProperty({}, key, { value, enumerable: false });

const UTC = "2024-03-10T12:00:00Z";
const ZONED = "2024-06-15T10:00:00+00:00[UTC]";
/** 2024-01-31T00:00:00Z in epoch milliseconds. */
const UNIX = 1706659200000;

/** Each of the 14 functions that take `units`. `plain` is one `key` added, taken away or totalled. */
const everyFunction = (title: string, body: (testCase: UnitsCase) => void) =>
  it.each`
    name                   | call                                                        | key        | other        | plain                               | sentinel | duration
    ${"addDate"}           | ${(u: never) => addDate("2024-01-31", u)}                   | ${"days"}  | ${"months"}  | ${"2024-02-01"}                     | ${""}    | ${"P1D"}
    ${"subtractDate"}      | ${(u: never) => subtractDate("2024-01-31", u)}              | ${"days"}  | ${"months"}  | ${"2024-01-30"}                     | ${""}    | ${"P1D"}
    ${"addTime"}           | ${(u: never) => addTime("14:30:00", u)}                     | ${"hours"} | ${"minutes"} | ${"15:30:00"}                       | ${""}    | ${"PT1H"}
    ${"subtractTime"}      | ${(u: never) => subtractTime("14:30:00", u)}                | ${"hours"} | ${"minutes"} | ${"13:30:00"}                       | ${""}    | ${"PT1H"}
    ${"addDateTime"}       | ${(u: never) => addDateTime("2024-01-31T10:00:00", u)}      | ${"days"}  | ${"hours"}   | ${"2024-02-01T10:00:00"}            | ${""}    | ${"P1D"}
    ${"subtractDateTime"}  | ${(u: never) => subtractDateTime("2024-01-31T10:00:00", u)} | ${"days"}  | ${"hours"}   | ${"2024-01-30T10:00:00"}            | ${""}    | ${"P1D"}
    ${"addUtc"}            | ${(u: never) => addUtc(UTC, u)}                             | ${"days"}  | ${"hours"}   | ${"2024-03-11T12:00:00Z"}           | ${""}    | ${"P1D"}
    ${"subtractUtc"}       | ${(u: never) => subtractUtc(UTC, u)}                        | ${"days"}  | ${"hours"}   | ${"2024-03-09T12:00:00Z"}           | ${""}    | ${"P1D"}
    ${"addUnix"}           | ${(u: never) => addUnix(UNIX, u)}                           | ${"days"}  | ${"hours"}   | ${1706745600000}                    | ${null}  | ${"P1D"}
    ${"subtractUnix"}      | ${(u: never) => subtractUnix(UNIX, u)}                      | ${"days"}  | ${"hours"}   | ${1706572800000}                    | ${null}  | ${"P1D"}
    ${"addZoned"}          | ${(u: never) => addZoned(ZONED, u)}                         | ${"days"}  | ${"hours"}   | ${"2024-06-16T10:00:00+00:00[UTC]"} | ${""}    | ${"P1D"}
    ${"subtractZoned"}     | ${(u: never) => subtractZoned(ZONED, u)}                    | ${"days"}  | ${"hours"}   | ${"2024-06-14T10:00:00+00:00[UTC]"} | ${""}    | ${"P1D"}
    ${"totalUnits"}        | ${(u: never) => totalUnits(u, "hours")}                     | ${"days"}  | ${"hours"}   | ${24}                               | ${null}  | ${"P1D"}
    ${"durationFromUnits"} | ${(u: never) => durationFromUnits(u)}                       | ${"days"}  | ${"hours"}   | ${"P1D"}                            | ${""}    | ${"P1D"}
  `(title, body as (testCase: unknown) => void);

/** The five functions whose unit set is narrower than the ten duration units. */
const everyRestrictedFunction = (
  title: string,
  body: (testCase: RestrictedCase) => void,
) =>
  it.each`
    name              | call                                           | key        | plain           | sentinel | outside    | outsideDuration
    ${"addDate"}      | ${(u: never) => addDate("2024-01-31", u)}      | ${"days"}  | ${"2024-02-01"} | ${""}    | ${"hours"} | ${"P1DT36H"}
    ${"subtractDate"} | ${(u: never) => subtractDate("2024-01-31", u)} | ${"days"}  | ${"2024-01-30"} | ${""}    | ${"hours"} | ${"P1DT36H"}
    ${"addTime"}      | ${(u: never) => addTime("14:30:00", u)}        | ${"hours"} | ${"15:30:00"}   | ${""}    | ${"days"}  | ${"P1DT1H"}
    ${"subtractTime"} | ${(u: never) => subtractTime("14:30:00", u)}   | ${"hours"} | ${"13:30:00"}   | ${""}    | ${"days"}  | ${"P1DT1H"}
    ${"totalUnits"}   | ${(u: never) => totalUnits(u, "hours")}        | ${"days"}  | ${24}           | ${null}  | ${"weeks"} | ${"P1W1D"}
  `(title, body as (testCase: unknown) => void);

describe("units: the baseline of each function", () => {
  everyFunction(
    "$name gives $plain for one of $key",
    ({ call, key, plain }) => {
      expect(run(call, { [key]: 1 })).toEqual(plain);
    },
  );
});

describe("units: undefined is an absent unit, as Temporal reads it", () => {
  everyFunction(
    "$name ignores an explicit undefined $other beside $key",
    ({ call, key, other, plain }) => {
      expect(run(call, { [key]: 1, [other]: undefined })).toEqual(plain);
    },
  );

  everyFunction(
    "$name returns $sentinel when no unit is present",
    ({ call, key, sentinel }) => {
      expect(run(call, {}), "{}").toEqual(sentinel);
      expect(run(call, { [key]: undefined }), "only undefined").toEqual(
        sentinel,
      );
      expect(run(call, inheriting({ [key]: undefined })), "inherited").toEqual(
        sentinel,
      );
    },
  );
});

describe("units: a unit is read with an ordinary property get", () => {
  everyFunction(
    "$name applies an inherited and a non-enumerable $key",
    ({ call, key, plain }) => {
      expect(run(call, inheriting({ [key]: 1 })), "inherited").toEqual(plain);
      expect(run(call, hidden(key, 1)), "non-enumerable").toEqual(plain);
    },
  );

  everyFunction(
    "$name returns $sentinel for an inherited or non-enumerable $key that is not a finite number",
    ({ call, key, sentinel }) => {
      expect(run(call, inheriting({ [key]: "1" })), "string").toEqual(sentinel);
      expect(run(call, inheriting({ [key]: true })), "boolean").toEqual(
        sentinel,
      );
      expect(run(call, inheriting({ [key]: null })), "null").toEqual(sentinel);
      expect(run(call, hidden(key, Number.NaN)), "NaN").toEqual(sentinel);
      expect(run(call, hidden(key, 1n)), "bigint").toEqual(sentinel);
    },
  );

  everyFunction(
    "$name returns $sentinel when an invalid $other is inherited beside an own $key",
    ({ call, key, other, sentinel }) => {
      expect(run(call, inheriting({ [other]: "1" }, { [key]: 1 }))).toEqual(
        sentinel,
      );
    },
  );

  everyFunction(
    "$name reads each of the ten unit names once and hands Temporal none of the caller's getters",
    ({ call, key, plain }) => {
      const reads: PropertyKey[] = [];
      const units = new Proxy(
        { [key]: 1 },
        {
          get(target, property, receiver) {
            reads.push(property);
            return Reflect.get(target, property, receiver) as unknown;
          },
        },
      );

      expect(run(call, units)).toEqual(plain);
      expect([...reads].sort()).toEqual([
        "days",
        "hours",
        "microseconds",
        "milliseconds",
        "minutes",
        "months",
        "nanoseconds",
        "seconds",
        "weeks",
        "years",
      ]);
    },
  );
});

describe("units: a key that is no unit of the function", () => {
  everyFunction(
    "$name returns $sentinel for an own misspelt key beside $key",
    ({ call, key, sentinel }) => {
      expect(run(call, { [key]: 1, nope: 1 }), "nonzero").toEqual(sentinel);
      expect(run(call, { [key]: 1, nope: undefined }), "undefined").toEqual(
        sentinel,
      );
    },
  );

  // Object.keys never lists a symbol, and Temporal reads only the ten unit names.
  everyFunction(
    "$name ignores a symbol key and an inherited key that is no unit name",
    ({ call, key, plain }) => {
      expect(run(call, { [key]: 1, [Symbol("note")]: 1 }), "symbol").toEqual(
        plain,
      );
      expect(
        run(call, inheriting({ nope: 1 }, { [key]: 1 })),
        "inherited",
      ).toEqual(plain);
    },
  );
});

describe("units: a duration unit outside the function's set", () => {
  everyRestrictedFunction(
    "$name returns $sentinel for an own $outside, whatever its amount",
    ({ call, key, outside, sentinel }) => {
      expect(run(call, { [key]: 1, [outside]: 1 }), "nonzero").toEqual(
        sentinel,
      );
      expect(run(call, { [key]: 1, [outside]: 0 }), "zero").toEqual(sentinel);
      expect(
        run(call, { [key]: 1, [outside]: undefined }),
        "undefined",
      ).toEqual(sentinel);
    },
  );

  everyRestrictedFunction(
    "$name returns $sentinel for an inherited or non-enumerable nonzero $outside",
    ({ call, key, outside, sentinel }) => {
      expect(run(call, inheriting({ [outside]: 1 })), "alone").toEqual(
        sentinel,
      );
      expect(
        run(call, inheriting({ [outside]: 1 }, { [key]: 1 })),
        "beside a valid unit",
      ).toEqual(sentinel);
      expect(
        run(call, Object.assign(hidden(outside, 1), { [key]: 1 })),
        "non-enumerable",
      ).toEqual(sentinel);
    },
  );

  // Zero is no amount: Temporal too tells a calendar duration from an exact one by nonzero fields.
  everyRestrictedFunction(
    "$name ignores an inherited zero $outside",
    ({ call, key, outside, plain }) => {
      expect(
        run(call, inheriting({ [outside]: 0 }, { [key]: 1 })),
        "0",
      ).toEqual(plain);
      expect(
        run(call, inheriting({ [outside]: -0 }, { [key]: 1 })),
        "-0",
      ).toEqual(plain);
    },
  );

  everyRestrictedFunction(
    "$name returns $sentinel for a Temporal.Duration of $outsideDuration",
    ({ call, outsideDuration, sentinel }) => {
      expect(run(call, Temporal.Duration.from(outsideDuration))).toEqual(
        sentinel,
      );
    },
  );
});

// A Temporal.Duration instance has no own property: each field is a getter on its prototype, and
// all ten read a number. It is read like any other object.
describe("units: an object whose units are all inherited getters", () => {
  everyFunction(
    "$name reads a Temporal.Duration of $duration as one of $key",
    ({ call, duration, plain }) => {
      expect(run(call, Temporal.Duration.from(duration))).toEqual(plain);
    },
  );
});

describe("units: the reported cases", () => {
  it.each`
    name                                               | call                                                                                                 | expected
    ${"addDate, a 36-hour Duration"}                   | ${() => addDate("2024-01-31", Temporal.Duration.from("PT36H") as never)}                             | ${""}
    ${"addDate, a 15-minute Duration"}                 | ${() => addDate("2024-01-31", Temporal.Duration.from("PT15M") as never)}                             | ${""}
    ${"subtractDate, a 36-hour Duration"}              | ${() => subtractDate("2024-01-31", Temporal.Duration.from("PT36H") as never)}                        | ${""}
    ${"addTime, a Duration with a day"}                | ${() => addTime("14:30:00", Temporal.Duration.from("P1DT1H") as never)}                              | ${""}
    ${"subtractTime, a Duration with a day"}           | ${() => subtractTime("14:30:00", Temporal.Duration.from("P1DT1H") as never)}                         | ${""}
    ${"addDate, inherited hours"}                      | ${() => addDate("2024-01-31", Object.create({ hours: 36 }) as never)}                                | ${""}
    ${"durationFromUnits, inherited string amount"}    | ${() => durationFromUnits(Object.create({ minutes: "15" }) as never)}                                | ${""}
    ${"durationFromUnits, inherited true"}             | ${() => durationFromUnits(Object.create({ minutes: true }) as never)}                                | ${""}
    ${"totalUnits, inherited string amount"}           | ${() => totalUnits(Object.create({ minutes: "15" }) as never, "seconds")}                            | ${null}
    ${"addUtc, inherited string amount"}               | ${() => addUtc(UTC, Object.create({ days: "5" }) as never)}                                          | ${""}
    ${"totalUnits, undefined beside an amount"}        | ${() => totalUnits({ minutes: 15, hours: undefined }, "seconds")}                                    | ${900}
    ${"durationFromUnits, undefined beside an amount"} | ${() => durationFromUnits({ minutes: 15, hours: undefined })}                                        | ${"PT15M"}
    ${"addUtc, undefined beside an amount"}            | ${() => addUtc(UTC, { days: 5, hours: undefined })}                                                  | ${"2024-03-15T12:00:00Z"}
    ${"addDate, a one-day Duration"}                   | ${() => addDate("2024-01-31", Temporal.Duration.from("P1D"))}                                        | ${"2024-02-01"}
    ${"totalUnits, a 15-minute Duration"}              | ${() => totalUnits(Temporal.Duration.from("PT15M"), "seconds")}                                      | ${900}
    ${"totalUnits, a one-week Duration"}               | ${() => totalUnits(Temporal.Duration.from("P1W"), "days")}                                           | ${null}
    ${"totalUnits, a one-month Duration"}              | ${() => totalUnits(Temporal.Duration.from("P1M"), "days")}                                           | ${null}
    ${"totalUnits, a one-year Duration"}               | ${() => totalUnits(Temporal.Duration.from("P1Y"), "days")}                                           | ${null}
    ${"durationFromUnits, a Duration"}                 | ${() => durationFromUnits(Temporal.Duration.from("P1Y2MT15M"))}                                      | ${"P1Y2MT15M"}
    ${"totalUnits, own minutes and inherited hours"}   | ${() => totalUnits(Object.assign(Object.create({ hours: 1 }), { minutes: 15 }) as never, "seconds")} | ${4500}
    ${"totalUnits, own minutes and inherited hour"}    | ${() => totalUnits(Object.assign(Object.create({ hour: 1 }), { minutes: 15 }) as never, "seconds")}  | ${900}
    ${"totalUnits, a blank Duration"}                  | ${() => totalUnits(new Temporal.Duration(), "seconds")}                                              | ${0}
    ${"durationFromUnits, a blank Duration"}           | ${() => durationFromUnits(new Temporal.Duration())}                                                  | ${"PT0S"}
    ${"totalUnits, an empty object"}                   | ${() => totalUnits({}, "seconds")}                                                                   | ${null}
    ${"durationFromUnits, an empty object"}            | ${() => durationFromUnits({})}                                                                       | ${""}
  `("$name returns $expected", ({ call, expected }) => {
    expect((call as () => unknown)()).toBe(expected);
  });
});
