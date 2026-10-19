import { Temporal } from "./temporal";
import {
  isValidDateDurationUnit,
  isValidDateTimeDurationUnit,
  isValidTimeDurationUnit,
} from "../plain/validate";
import { readDurationUnits } from "./readDurationUnits";

/** `units` with `inherited` on its prototype and `own` as its own enumerable properties. */
const inheriting = (inherited: object, own: object = {}): object =>
  Object.assign(Object.create(inherited) as object, own);

/** `units` holding one non-enumerable own property. */
const hidden = (key: string, value: unknown): object =>
  Object.defineProperty({}, key, { value, enumerable: false });

describe("readDurationUnits", () => {
  it.each`
    units                                | isAllowed                      | expected
    ${{ days: 1 }}                       | ${isValidDateDurationUnit}     | ${{ days: 1 }}
    ${{ years: 1, months: 2, weeks: 3 }} | ${isValidDateDurationUnit}     | ${{ years: 1, months: 2, weeks: 3 }}
    ${{ hours: 1, nanoseconds: 5 }}      | ${isValidTimeDurationUnit}     | ${{ hours: 1, nanoseconds: 5 }}
    ${{ years: 1, minutes: -0 }}         | ${isValidDateTimeDurationUnit} | ${{ years: 1, minutes: -0 }}
    ${{ minutes: 0 }}                    | ${isValidTimeDurationUnit}     | ${{ minutes: 0 }}
    ${{ minutes: 1.5 }}                  | ${isValidTimeDurationUnit}     | ${{ minutes: 1.5 }}
    ${{ hours: 1, minutes: -30 }}        | ${isValidTimeDurationUnit}     | ${{ hours: 1, minutes: -30 }}
  `(
    "returns the own units of $units as a fresh object (whole numbers, one sign and the range are left to Temporal)",
    ({ units, isAllowed, expected }) => {
      const read = readDurationUnits(units, isAllowed);

      expect(read).toEqual(expected);
      expect(read).not.toBe(units);
      expect(Object.getPrototypeOf(read)).toBe(Object.prototype);
    },
  );

  // Temporal's ToTemporalPartialDurationRecord reads each unit with a property get and treats
  // undefined as absent, so an explicit undefined beside a real amount changes nothing.
  it.each`
    units                                         | expected                     | shape
    ${{ minutes: 15, hours: undefined }}          | ${{ minutes: 15 }}           | ${"an explicit undefined beside an amount"}
    ${{ hours: undefined, seconds: 0 }}           | ${{ seconds: 0 }}            | ${"an explicit undefined beside a zero"}
    ${inheriting({ minutes: 15 })}                | ${{ minutes: 15 }}           | ${"an inherited unit"}
    ${inheriting({ hours: 1 }, { minutes: 15 })}  | ${{ hours: 1, minutes: 15 }} | ${"an inherited unit beside an own one"}
    ${hidden("minutes", 15)}                      | ${{ minutes: 15 }}           | ${"a non-enumerable unit"}
    ${Object.assign(() => 0, { minutes: 15 })}    | ${{ minutes: 15 }}           | ${"a function carrying the unit"}
    ${{ minutes: 15, [Symbol("note")]: 1 }}       | ${{ minutes: 15 }}           | ${"a symbol key, which is ignored"}
    ${inheriting({ hour: 1 }, { minutes: 15 })}   | ${{ minutes: 15 }}           | ${"an inherited key that is no unit name, which is never read"}
    ${hidden("hour", 1)}                          | ${null}                      | ${"only a non-enumerable key that is no unit name"}
    ${inheriting({ days: 0 }, { minutes: 15 })}   | ${{ minutes: 15 }}           | ${"an inherited zero outside the allowed set"}
    ${inheriting({ years: -0 }, { minutes: 15 })} | ${{ minutes: 15 }}           | ${"an inherited -0 outside the allowed set"}
  `("reads $shape as $expected", ({ units, expected }) => {
    expect(readDurationUnits(units, isValidTimeDurationUnit)).toEqual(expected);
  });

  it.each`
    units                                         | reason
    ${{ minute: 15 }}                             | ${"own key that is no unit name"}
    ${{ minutes: 15, hour: 1 }}                   | ${"own key that is no unit name, beside a valid one"}
    ${{ days: 1 }}                                | ${"own key outside the allowed set"}
    ${{ days: 0, minutes: 15 }}                   | ${"own key outside the allowed set, zero amount"}
    ${{ days: undefined, minutes: 15 }}           | ${"own key outside the allowed set, undefined amount"}
    ${inheriting({ days: 1 })}                    | ${"inherited unit outside the allowed set, nonzero"}
    ${inheriting({ days: 1 }, { minutes: 15 })}   | ${"inherited unit outside the allowed set, beside a valid one"}
    ${hidden("days", 1)}                          | ${"non-enumerable unit outside the allowed set, nonzero"}
    ${inheriting({ days: "0" }, { minutes: 15 })} | ${"inherited unit outside the allowed set, not a number"}
    ${inheriting({ minutes: "15" })}              | ${"inherited string amount"}
    ${inheriting({ minutes: true })}              | ${"inherited boolean amount"}
    ${inheriting({ minutes: null })}              | ${"inherited null amount"}
    ${hidden("minutes", Number.NaN)}              | ${"non-enumerable NaN amount"}
    ${{ minutes: "15" }}                          | ${"own string amount"}
    ${{ minutes: Infinity }}                      | ${"own Infinity amount"}
    ${{ minutes: 15n }}                           | ${"own bigint amount"}
    ${{}}                                         | ${"no unit"}
    ${{ minutes: undefined }}                     | ${"only an undefined amount"}
    ${inheriting({ days: 0 })}                    | ${"only a zero amount outside the allowed set"}
    ${[]}                                         | ${"empty array"}
    ${[15]}                                       | ${"array with an index key"}
    ${"PT15M"}                                    | ${"string"}
    ${15}                                         | ${"number"}
    ${null}                                       | ${"null"}
    ${undefined}                                  | ${"undefined"}
  `("returns null for $reason", ({ units }) => {
    expect(readDurationUnits(units, isValidTimeDurationUnit)).toBeNull();
  });

  // A Temporal.Duration instance has no own property: each field is a getter on the prototype, and
  // all ten read a number. Fields outside the allowed set count only when they are not zero.
  it.each`
    value       | isAllowed                  | expected
    ${"P1D"}    | ${isValidDateDurationUnit} | ${{ years: 0, months: 0, weeks: 0, days: 1 }}
    ${"PT0S"}   | ${isValidDateDurationUnit} | ${{ years: 0, months: 0, weeks: 0, days: 0 }}
    ${"PT36H"}  | ${isValidDateDurationUnit} | ${null}
    ${"P1DT1H"} | ${isValidTimeDurationUnit} | ${null}
    ${"-P1Y2M"} | ${isValidDateDurationUnit} | ${{ years: -1, months: -2, weeks: 0, days: 0 }}
  `(
    "reads a Temporal.Duration of $value as $expected",
    ({ value, isAllowed, expected }) => {
      expect(
        readDurationUnits(Temporal.Duration.from(value), isAllowed),
      ).toEqual(expected);
    },
  );

  // ToTemporalPartialDurationRecord (7.5.18) gets the ten names in alphabetical order, which a
  // getter with a side effect can see.
  it("reads each of the ten unit names once, in Temporal's order, and nothing else", () => {
    const reads: PropertyKey[] = [];
    const units = new Proxy(
      { minutes: 15 },
      {
        get(target, key, receiver) {
          reads.push(key);
          return Reflect.get(target, key, receiver) as unknown;
        },
      },
    );

    expect(readDurationUnits(units, isValidDateTimeDurationUnit)).toEqual({
      minutes: 15,
    });
    expect(reads).toEqual([
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
  });

  it("lets a throwing getter through, for the caller's catch to turn into its sentinel", () => {
    const hostile = {
      get minutes(): never {
        throw new Error("hostile getter");
      },
    };

    expect(() => readDurationUnits(hostile, isValidTimeDurationUnit)).toThrow(
      "hostile getter",
    );
  });
});
