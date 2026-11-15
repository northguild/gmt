import { readDateTimeFormatOptions } from "./readDateTimeFormatOptions";

describe("readDateTimeFormatOptions", () => {
  // ECMA-402 CoerceOptionsToObject: undefined is no options; ToObject of a string or a number is
  // an object with none of the date-time options. A member that is present has to hold its
  // declared type (a boolean, a number or a string); the next table covers the ones that do not.
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
    ${"{ fractionalSecondDigits: 2 }"}       | ${{ fractionalSecondDigits: 2 }}       | ${{ fractionalSecondDigits: 2 }}
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

  // GMT reads the declared type exactly: ECMA-402 GetOption would convert each of these (ToBoolean
  // for hour12, ToNumber for fractionalSecondDigits, ToString for the rest), and an object would
  // run its own toString or valueOf. Each is refused with a TypeError instead, and the object's
  // methods are never called.
  it.each`
    label                                 | options
    ${"{ hour12: null }"}                 | ${{ hour12: null }}
    ${'{ hour12: "x" }'}                  | ${{ hour12: "x" }}
    ${"{ timeStyle: null }"}              | ${{ timeStyle: null }}
    ${"{ month: 2 }"}                     | ${{ month: 2 }}
    ${'{ fractionalSecondDigits: "2" }'}  | ${{ fractionalSecondDigits: "2" }}
    ${"{ fractionalSecondDigits: null }"} | ${{ fractionalSecondDigits: null }}
    ${"{ month: new String('long') }"}    | ${{ month: new String("long") }}
    ${"{ month: Symbol() }"}              | ${{ month: Symbol("long") }}
    ${"{ fractionalSecondDigits: 1n }"}   | ${{ fractionalSecondDigits: 1n }}
  `("throws TypeError for options $label", ({ options }) => {
    expect(() => readDateTimeFormatOptions(options)).toThrow(TypeError);
  });

  it.each`
    name                        | method
    ${"month"}                  | ${"toString"}
    ${"dateStyle"}              | ${"toString"}
    ${"timeZoneName"}           | ${"toString"}
    ${"calendar"}               | ${"toString"}
    ${"fractionalSecondDigits"} | ${"valueOf"}
  `(
    "never calls $method() of an object given as option $name",
    ({ name, method }) => {
      let calls = 0;
      const value = {
        [method as string]() {
          calls += 1;
          return "long";
        },
      };
      expect(() =>
        readDateTimeFormatOptions({ [name as string]: value }),
      ).toThrow(TypeError);
      expect(calls).toBe(0);
    },
  );

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
