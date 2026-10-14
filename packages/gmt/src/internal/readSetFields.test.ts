import { Temporal } from "@js-temporal/polyfill";
import { afterEach, vi } from "vitest";
import {
  DATE_FIELDS,
  DATE_TIME_FIELDS,
  readSetFields,
  TIME_FIELDS,
} from "./readSetFields";

/** `own` as own enumerable properties of an object that inherits `inherited`. */
const inheriting = (inherited: object, own: object = {}): object =>
  Object.assign(Object.create(inherited) as object, own);

/** One non-enumerable own property. */
const hidden = (key: string, value: unknown): object =>
  Object.defineProperty({}, key, { value, enumerable: false });

/** Every property Temporal's `with` methods read, sorted. */
const WITH_NAMES = [
  "calendar",
  "day",
  "era",
  "eraYear",
  "hour",
  "microsecond",
  "millisecond",
  "minute",
  "month",
  "monthCode",
  "nanosecond",
  "offset",
  "second",
  "timeZone",
  "year",
];

describe("readSetFields", () => {
  it.each`
    fields                                     | expected                             | shape
    ${{ year: 2025 }}                          | ${{ year: 2025 }}                    | ${"an own field"}
    ${{ year: 2025, month: 13, day: 0 }}       | ${{ year: 2025, month: 13, day: 0 }} | ${"out-of-range fields, which Temporal's overflow handles"}
    ${{ monthCode: "M02", day: 29 }}           | ${{ monthCode: "M02", day: 29 }}     | ${"a month code"}
    ${{ monthCode: "nope" }}                   | ${{ monthCode: "nope" }}             | ${"a month code Temporal will refuse"}
    ${{ year: -0 }}                            | ${{ year: -0 }}                      | ${"-0, an integer"}
    ${{ year: 2025, month: undefined }}        | ${{ year: 2025 }}                    | ${"an undefined field beside one set"}
    ${inheriting({ year: 2025 })}              | ${{ year: 2025 }}                    | ${"an inherited field"}
    ${hidden("year", 2025)}                    | ${{ year: 2025 }}                    | ${"a non-enumerable field"}
    ${{ get year() {
    return 2025;
  } }} | ${{ year: 2025 }} | ${"a getter"}
    ${Object.assign(() => 0, { year: 2025 })}  | ${{ year: 2025 }}                    | ${"a function carrying the field"}
    ${{ year: 2025, [Symbol("note")]: 1 }}     | ${{ year: 2025 }}                    | ${"a symbol key, which is ignored"}
    ${inheriting({ yaer: 1 }, { year: 2025 })} | ${{ year: 2025 }}                    | ${"an inherited misspelt key, which is never read"}
    ${{}}                                      | ${{}}                                | ${"no field (a no-op)"}
    ${{ year: undefined }}                     | ${{}}                                | ${"only an undefined field (a no-op)"}
    ${() => 0}                                 | ${{}}                                | ${"a function carrying nothing (a no-op)"}
    ${[]}                                      | ${{}}                                | ${"an array, which holds no field (a no-op)"}
    ${Temporal.Duration.from("P1D")}           | ${{}}                                | ${"a Temporal.Duration, which holds no field"}
  `("reads $shape as $expected", ({ fields, expected }) => {
    const read = readSetFields(fields, DATE_FIELDS);

    expect(read).toEqual(expected);
    expect(read).not.toBe(fields);
    expect(Object.getPrototypeOf(read)).toBe(Object.prototype);
  });

  it.each`
    fields                                             | reason
    ${{ year: null }}                                  | ${"null"}
    ${{ year: "2025" }}                                | ${"a string"}
    ${{ year: true }}                                  | ${"a boolean"}
    ${{ year: 2025n }}                                 | ${"a bigint"}
    ${{ year: Number.NaN }}                            | ${"NaN"}
    ${{ year: Infinity }}                              | ${"Infinity"}
    ${{ year: 2025.5 }}                                | ${"a fraction, which Temporal would truncate"}
    ${inheriting({ year: "2025" })}                    | ${"an inherited string"}
    ${hidden("day", 1.5)}                              | ${"a non-enumerable fraction"}
    ${{ monthCode: 3 }}                                | ${"a number as month code"}
    ${{ monthCode: null }}                             | ${"null as month code"}
    ${{ year: 2025, yaer: 1 }}                         | ${"an own misspelt key beside a field"}
    ${{ yaer: 2025 }}                                  | ${"an own misspelt key alone"}
    ${{ yaer: undefined }}                             | ${"an own misspelt key that is undefined"}
    ${{ year: 2025, hour: 5 }}                         | ${"a field of another type beside a field"}
    ${{ hour: 5 }}                                     | ${"a field of another type alone"}
    ${inheriting({ hour: 5 }, { year: 2025 })}         | ${"an inherited field of another type"}
    ${hidden("hour", 0)}                               | ${"a non-enumerable field of another type, even zero"}
    ${{ hour: undefined }}                             | ${"an own key outside the fields, undefined"}
    ${{ year: 2025, era: "ce" }}                       | ${"an era beside a field"}
    ${inheriting({ eraYear: 2025 })}                   | ${"an inherited eraYear"}
    ${{ calendar: "iso8601" }}                         | ${"an own calendar"}
    ${inheriting({ calendar: "iso8601" })}             | ${"an inherited calendar"}
    ${inheriting({ timeZone: "UTC" }, { year: 2025 })} | ${"an inherited timeZone beside a field"}
    ${inheriting({ offset: "+00:00" })}                | ${"an inherited offset"}
    ${5}                                               | ${"a number"}
    ${"year"}                                          | ${"a string"}
    ${null}                                            | ${"null"}
    ${undefined}                                       | ${"undefined"}
  `("returns null for $reason", ({ fields }) => {
    expect(readSetFields(fields, DATE_FIELDS)).toBeNull();
  });

  // TC39 IsPartialTemporalObject: a Temporal object holding a date or a time is never a partial,
  // even when every field it reads is one the function takes.
  it.each`
    value                                                         | allowed
    ${Temporal.PlainDate.from("2025-06-01")}                      | ${DATE_FIELDS}
    ${Temporal.PlainYearMonth.from("2025-06")}                    | ${DATE_FIELDS}
    ${Temporal.PlainMonthDay.from("06-01")}                       | ${DATE_FIELDS}
    ${Temporal.PlainTime.from("05:00")}                           | ${TIME_FIELDS}
    ${Temporal.PlainDate.from("2025-06-01")}                      | ${DATE_TIME_FIELDS}
    ${Temporal.PlainTime.from("05:00")}                           | ${DATE_TIME_FIELDS}
    ${Temporal.PlainDateTime.from("2025-06-01T05:00")}            | ${DATE_TIME_FIELDS}
    ${Temporal.ZonedDateTime.from("2025-06-01T05:00+00:00[UTC]")} | ${DATE_TIME_FIELDS}
  `("returns null for the Temporal object $value", ({ value, allowed }) => {
    expect(readSetFields(value, allowed)).toBeNull();
  });

  it("does not take an object for a Temporal object by its prototype alone", () => {
    // Own data properties shadow the prototype's getters, as `Object.defineProperties` writes them.
    const own = (value: number) => ({ value, enumerable: true });
    const lookalike = Object.create(Temporal.PlainTime.prototype, {
      hour: own(5),
      minute: own(0),
      second: own(0),
      millisecond: own(0),
      microsecond: own(0),
      nanosecond: own(0),
    }) as object;

    expect(readSetFields(lookalike, TIME_FIELDS)).toEqual({
      hour: 5,
      minute: 0,
      second: 0,
      millisecond: 0,
      microsecond: 0,
      nanosecond: 0,
    });
  });

  describe("with another Temporal implementation in globalThis", () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    // A host that ships Temporal: its objects are Temporal objects too. Each class's getter
    // refuses a receiver that lacks its internal slot, as a real implementation's does.
    it("returns null for an object of that implementation, and reads its look-alike", () => {
      const branded = new WeakSet<object>();
      class PlainDate {
        constructor() {
          branded.add(this);
        }
        get calendarId(): string {
          if (!branded.has(this)) throw new TypeError("not a PlainDate");
          return "iso8601";
        }
        get year(): number {
          if (!branded.has(this)) throw new TypeError("not a PlainDate");
          return 2025;
        }
      }
      vi.stubGlobal("Temporal", { PlainDate });

      expect(readSetFields(new PlainDate(), DATE_FIELDS)).toBeNull();
      expect(readSetFields({ year: 2025 }, DATE_FIELDS)).toEqual({
        year: 2025,
      });
    });
  });

  describe("which objects the brand check runs on", () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    /** A host Temporal whose PlainDate getter records each receiver it is asked about. */
    const recordingHost = (): object[] => {
      const asked: object[] = [];
      class PlainDate {
        get calendarId(): string {
          asked.push(this);
          throw new TypeError("not a PlainDate");
        }
      }
      vi.stubGlobal("Temporal", { PlainDate });
      return asked;
    };

    it.each`
      shape                              | fields
      ${"a plain object"}                | ${{ year: 2025 }}
      ${"an Object.create(null) object"} | ${Object.assign(Object.create(null) as object, { year: 2025 })}
      ${"a function"}                    | ${Object.assign(() => 0, { year: 2025 })}
    `("skips the check for $shape", ({ fields }) => {
      const asked = recordingHost();

      expect(readSetFields(fields, DATE_FIELDS)).toEqual({ year: 2025 });
      expect(asked).toEqual([]);
    });

    it.each`
      shape                           | fields
      ${"a class instance"}           | ${new (class {})()}
      ${"an object with a prototype"} | ${inheriting({ year: 2025 })}
      ${"an array"}                   | ${[]}
    `("runs the check for $shape", ({ fields }) => {
      const asked = recordingHost();

      readSetFields(fields, DATE_FIELDS);
      expect(asked).toEqual([fields]);
    });

    // Accepted by owner decision: a swapped prototype hides a Temporal object from the check, and
    // with its getters out of reach it sets nothing.
    it("reads a Temporal object whose prototype was swapped to Object.prototype as setting nothing (accepted by owner decision)", () => {
      const swapped = Object.setPrototypeOf(
        Temporal.PlainDate.from("2025-06-01"),
        Object.prototype,
      ) as object;

      expect(readSetFields(swapped, DATE_FIELDS)).toEqual({});
    });

    it("lets a getPrototypeOf trap that throws through, for the caller's catch", () => {
      const fields = new Proxy(
        { year: 2025 },
        {
          getPrototypeOf() {
            throw new Error("hostile prototype");
          },
        },
      );

      expect(() => readSetFields(fields, DATE_FIELDS)).toThrow(
        "hostile prototype",
      );
    });
  });

  it("reads each with property once and nothing else", () => {
    const reads: PropertyKey[] = [];
    const fields = new Proxy(
      { year: 2025 },
      {
        get(target, key, receiver) {
          reads.push(key);
          return Reflect.get(target, key, receiver) as unknown;
        },
      },
    );

    expect(readSetFields(fields, DATE_FIELDS)).toEqual({ year: 2025 });
    expect([...reads].sort()).toEqual(WITH_NAMES);
  });

  it("lets a throwing getter through, for the caller's catch to turn into its sentinel", () => {
    const hostile = {
      get year(): never {
        throw new Error("hostile getter");
      },
    };

    expect(() => readSetFields(hostile, DATE_FIELDS)).toThrow("hostile getter");
  });
});
