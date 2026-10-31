import { epcisTimeZoneOffset } from "../../regex";
import { arrives, NON_STRINGS } from "../../test/nonStrings";
import { parseEpcisEvent } from "../parse/parseEpcisEvent";
import { isValidEpcisEvent } from "./isValidEpcisEvent";
import { isValidEpcisTimeZoneOffset } from "./isValidEpcisTimeZoneOffset";

/**
 * GS1 EPCIS 2.0 (ISO/IEC 19987). Each verdict is decided from the rule of EPCIS Standard Release
 * 2.0 §7.4.1 that `epcisTimeZoneOffset` quotes: a sign, two digits "within the range 00 through 14
 * (inclusive)", a colon, two digits "within the range 00 through 59 (inclusive), except that if
 * the value of the first two digits is 14, the value of the second two digits must be 00". For a
 * string the pattern is the whole rule, so `pattern` equals `expected` on every row. Every row
 * then checks that the event validator and the parser, given a valid `eventTime` beside it, agree.
 */
describe("isValidEpcisTimeZoneOffset", () => {
  it.each`
    value          | expected | reason
    ${"+02:00"}    | ${true}  | ${"an offset east of UTC"}
    ${"-05:00"}    | ${true}  | ${"an offset west of UTC"}
    ${"+00:00"}    | ${true}  | ${"zero"}
    ${"-00:00"}    | ${true}  | ${"negative zero: the rule allows it"}
    ${"+05:30"}    | ${true}  | ${"a half-hour offset"}
    ${"+05:45"}    | ${true}  | ${"a quarter-hour offset"}
    ${"+13:59"}    | ${true}  | ${"the last minute below 14:00"}
    ${"-13:59"}    | ${true}  | ${"the last minute below 14:00, west"}
    ${"+14:00"}    | ${true}  | ${"hour 14 with minute 00"}
    ${"-14:00"}    | ${true}  | ${"hour 14 with minute 00, west"}
    ${"+14:01"}    | ${false} | ${"hour 14 with a minute that is not 00"}
    ${"-14:01"}    | ${false} | ${"hour 14 with a minute that is not 00, west"}
    ${"+14:30"}    | ${false} | ${"past 14:00"}
    ${"-14:30"}    | ${false} | ${"past 14:00, west"}
    ${"+15:00"}    | ${false} | ${"hour 15"}
    ${"-15:00"}    | ${false} | ${"hour 15, west"}
    ${"+02:60"}    | ${false} | ${"minute 60"}
    ${"+05:30:00"} | ${false} | ${"seconds"}
    ${"Z"}         | ${false} | ${"Z is eventTime's designator, not an offset"}
    ${"+0200"}     | ${false} | ${"no colon"}
    ${"+02"}       | ${false} | ${"hours only"}
    ${"02:00"}     | ${false} | ${"no sign"}
    ${"+2:00"}     | ${false} | ${"unpadded hour"}
    ${"−02:00"}    | ${false} | ${"U+2212 minus sign"}
    ${" +02:00"}   | ${false} | ${"leading space"}
    ${"+02:00 "}   | ${false} | ${"trailing space"}
    ${"+02:00\n"}  | ${false} | ${"trailing line feed"}
    ${""}          | ${false} | ${"empty"}
  `(
    "returns $expected for '$value' ($reason), as the pattern does; isValidEpcisEvent and parseEpcisEvent agree",
    ({ value, expected }: { value: string; expected: boolean }) => {
      const event = {
        eventTime: "2024-06-15T14:30:00Z",
        eventTimeZoneOffset: value,
      };

      expect(isValidEpcisTimeZoneOffset(value)).toBe(expected);
      expect(epcisTimeZoneOffset.test(value)).toBe(expected);
      expect(isValidEpcisEvent(event)).toBe(expected);
      expect(parseEpcisEvent(event) !== null).toBe(expected);
    },
  );

  it("returns false for an argument that is not a string, as isValidEpcisEvent does for the field", () => {
    for (const [kind, make] of NON_STRINGS) {
      expect(isValidEpcisTimeZoneOffset(make()), kind).toBe(false);
      expect(
        isValidEpcisEvent({
          eventTime: "2024-06-15T14:30:00Z",
          eventTimeZoneOffset: make(),
        }),
        kind,
      ).toBe(false);
    }
  });
});

describe("isValidEpcisTimeZoneOffset types", () => {
  const sample = "-05:00";

  it("narrows a value typed unknown to string when it is valid", () => {
    const input = arrives(sample);
    if (isValidEpcisTimeZoneOffset(input)) {
      expectTypeOf(input).toEqualTypeOf<string>();
    } else {
      expectTypeOf(input).toEqualTypeOf<unknown>();
    }
    expect(isValidEpcisTimeZoneOffset(input)).toBe(true);
    expect(isValidEpcisTimeZoneOffset(sample)).toBe(true);
  });

  it("keeps a string a string when it is not valid", () => {
    const input: string = "nope";
    if (!isValidEpcisTimeZoneOffset(input)) {
      expectTypeOf(input).toEqualTypeOf<string>();
    }
    expect(isValidEpcisTimeZoneOffset(input)).toBe(false);
  });

  // A predicate on `string | null` would type an invalid string as `null` on a false result, so
  // a typed union gets a plain boolean and narrows on neither branch.
  it("leaves string | null as it is on both branches", () => {
    const check = (input: string | null): boolean => {
      if (isValidEpcisTimeZoneOffset(input)) {
        expectTypeOf(input).toEqualTypeOf<string | null>();
        return true;
      }
      expectTypeOf(input).toEqualTypeOf<string | null>();
      return false;
    };
    expect(check(sample)).toBe(true);
    expect(check(null)).toBe(false);
  });

  it("leaves string | void as it is on both branches", () => {
    const check = (input: string | void): boolean => {
      if (isValidEpcisTimeZoneOffset(input)) {
        expectTypeOf(input).toEqualTypeOf<string | void>();
        return true;
      }
      expectTypeOf(input).toEqualTypeOf<string | void>();
      return false;
    };
    expect(check(sample)).toBe(true);
    expect(check(undefined)).toBe(false);
  });

  it("filters an unknown[] to string[]", () => {
    const values = [null, sample, 1, "nope"].map(arrives);
    const kept = values.filter(isValidEpcisTimeZoneOffset);
    expectTypeOf(kept).toEqualTypeOf<string[]>();
    expect(kept).toEqual([sample]);
  });
});
