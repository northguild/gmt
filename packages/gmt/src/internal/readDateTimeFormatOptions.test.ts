import { describe, expect, it } from "vitest";
import { readDateTimeFormatOptions } from "./readDateTimeFormatOptions";

describe("readDateTimeFormatOptions", () => {
  // ECMA-402 CoerceOptionsToObject: undefined is no options; ToObject of a string or a number is
  // an object with none of the date-time options. GetOption then converts a value that is not
  // undefined by its type: ToBoolean for hour12 (null is false, "x" is true), ToNumber for
  // fractionalSecondDigits ("2" is 2, null is 0), ToString for the rest (null is "null", 2 is "2").
  it.each`
    label                                    | options                                | expected
    ${"undefined"}                           | ${undefined}                           | ${{}}
    ${"{}"}                                  | ${{}}                                  | ${{}}
    ${'"x"'}                                 | ${"x"}                                 | ${{}}
    ${"1"}                                   | ${1}                                   | ${{}}
    ${'{ dateStyle: "long" }'}               | ${{ dateStyle: "long" }}               | ${{ dateStyle: "long" }}
    ${'{ dateStyle: "long", extra: 1 }'}     | ${{ dateStyle: "long", extra: 1 }}     | ${{ dateStyle: "long" }}
    ${'{ year: "numeric", day: undefined }'} | ${{ year: "numeric", day: undefined }} | ${{ year: "numeric" }}
    ${"{ hour12: false }"}                   | ${{ hour12: false }}                   | ${{ hour12: false }}
    ${"{ hour12: null }"}                    | ${{ hour12: null }}                    | ${{ hour12: false }}
    ${'{ hour12: "x" }'}                     | ${{ hour12: "x" }}                     | ${{ hour12: true }}
    ${"{ timeStyle: null }"}                 | ${{ timeStyle: null }}                 | ${{ timeStyle: "null" }}
    ${"{ month: 2 }"}                        | ${{ month: 2 }}                        | ${{ month: "2" }}
    ${'{ fractionalSecondDigits: "2" }'}     | ${{ fractionalSecondDigits: "2" }}     | ${{ fractionalSecondDigits: 2 }}
    ${"{ fractionalSecondDigits: null }"}    | ${{ fractionalSecondDigits: null }}    | ${{ fractionalSecondDigits: 0 }}
  `("returns $expected for options $label", ({ options, expected }) => {
    expect(readDateTimeFormatOptions(options)).toEqual(expected);
  });

  // ECMA-402 CoerceOptionsToObject: ToObject(null) throws TypeError.
  it("throws TypeError for null options", () => {
    expect(() => readDateTimeFormatOptions(null)).toThrow(TypeError);
  });

  // Get reads through the prototype chain, so an inherited option is an option.
  it('returns { dateStyle: "full" } for an object that inherits dateStyle: "full"', () => {
    expect(
      readDateTimeFormatOptions(Object.create({ dateStyle: "full" })),
    ).toEqual({ dateStyle: "full" });
  });

  // ECMA-402 CreateDateTimeFormat reads each option with one Get, in a fixed order.
  it("reads each of the 20 options once, in ECMA-402 CreateDateTimeFormat order", () => {
    const reads: string[] = [];
    const options = new Proxy(
      {},
      {
        get(_target, name) {
          reads.push(String(name));
          return undefined;
        },
      },
    );

    expect(readDateTimeFormatOptions(options)).toEqual({});
    expect(reads).toEqual([
      "localeMatcher",
      "calendar",
      "numberingSystem",
      "hour12",
      "hourCycle",
      "timeZone",
      "weekday",
      "era",
      "year",
      "month",
      "day",
      "dayPeriod",
      "hour",
      "minute",
      "second",
      "fractionalSecondDigits",
      "timeZoneName",
      "formatMatcher",
      "dateStyle",
      "timeStyle",
    ]);
  });

  // ECMA-402 GetOption converts the value it read once: ToString for a string option, ToNumber
  // (GetNumberOption) for fractionalSecondDigits. An object is asked for its value here and never
  // again, so every later use sees the primitive it answered with first.
  it.each`
    name                        | method        | first        | second      | expected
    ${"month"}                  | ${"toString"} | ${"long"}    | ${"narrow"} | ${"long"}
    ${"dateStyle"}              | ${"toString"} | ${"full"}    | ${"short"}  | ${"full"}
    ${"timeZoneName"}           | ${"toString"} | ${"short"}   | ${"long"}   | ${"short"}
    ${"calendar"}               | ${"toString"} | ${"gregory"} | ${"hebrew"} | ${"gregory"}
    ${"fractionalSecondDigits"} | ${"valueOf"}  | ${2}         | ${3}        | ${2}
  `(
    "calls $method() of option $name once and copies its first answer, $expected",
    ({ name, method, first, second, expected }) => {
      let coercions = 0;
      const value = {
        [method as string]() {
          coercions += 1;
          return coercions === 1 ? first : second;
        },
      };
      const read = readDateTimeFormatOptions({ [name as string]: value });
      new Intl.DateTimeFormat("en-US", read);
      new Intl.DateTimeFormat("en-US", read);
      expect({ read, coercions }).toEqual({
        read: { [name as string]: expected },
        coercions: 1,
      });
    },
  );

  // ToString and ToNumber throw TypeError for a symbol, and ToNumber for a bigint.
  it.each`
    label                               | options
    ${"{ month: Symbol() }"}            | ${{ month: Symbol("long") }}
    ${"{ fractionalSecondDigits: 1n }"} | ${{ fractionalSecondDigits: 1n }}
  `("throws TypeError for options $label", ({ options }) => {
    expect(() => readDateTimeFormatOptions(options)).toThrow(TypeError);
  });

  // `timeZone` is the one option copied as it was read. Each caller has its own rule for it — the
  // zoned formatters reject any, formatUtc and formatUnix accept only a string — and a caller
  // that hands it to Intl.DateTimeFormat does so once.
  it("copies a timeZone object as it is, without converting it", () => {
    let coercions = 0;
    const timeZone = {
      toString() {
        coercions += 1;
        return "UTC";
      },
    };
    const read = readDateTimeFormatOptions({ timeZone });
    expect({ same: read.timeZone === (timeZone as never), coercions }).toEqual({
      same: true,
      coercions: 0,
    });
  });
});
