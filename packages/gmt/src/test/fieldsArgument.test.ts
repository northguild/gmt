/**
 * The `fields` contract of the six `set*` functions, read by `internal/readSetFields.ts`.
 *
 * TC39 Temporal's `with` reads each field with an ordinary property get, so an inherited,
 * non-enumerable or getter field is set like an own one. It throws for a Temporal object
 * (IsPartialTemporalObject), a `calendar` or `timeZone` property, a non-object and an object with
 * no field. GMT keeps all of that except the last, which is a no-op, and is stricter in three ways:
 *
 * - An own key that is no field of the function returns the sentinel (a misspelt key).
 * - A defined field the function does not take returns the sentinel, wherever it is read from.
 * - A value is not converted: a field is an integer number, and `monthCode` a string. Temporal
 *   would read `null` as 0, `"2025"` as 2025 and 2025.5 as 2025.
 *
 * GMT hands Temporal a fresh object of the values it checked.
 */
import { Temporal } from "@js-temporal/polyfill";
import {
  setDate,
  setDateTime,
  setTime,
  setUnix,
  setUtc,
  setZoned,
} from "../index";

type Call = (fields: never) => unknown;
type Fields = Record<PropertyKey, unknown>;

type FieldsCase = {
  /** Calls the function with a valid value and the given `fields`. */
  call: Call;
  /** A field the function sets. */
  key: string;
  /** The value `key` is set to. */
  value: number;
  /** The result for `{ [key]: value }`. */
  changed: unknown;
  /** The result when nothing is set. */
  unchanged: unknown;
  sentinel: unknown;
  /** A misspelling of `key`. */
  misspelt: string;
  /** A property `with` reads that the function does not take, with a well-formed value. */
  foreign: Fields;
};

const run = (call: Call, fields: unknown): unknown => call(fields as never);

/** `own` as own enumerable properties of an object that inherits `inherited`. */
const inheriting = (inherited: object, own: object = {}): Fields =>
  Object.assign(Object.create(inherited) as Fields, own);

/** One non-enumerable own property. */
const hidden = (key: string, value: unknown): Fields =>
  Object.defineProperty({}, key, { value, enumerable: false });

const ZONED = "2024-06-15T10:00:00+00:00[UTC]";
/** 2024-01-31T00:00:00Z in epoch milliseconds; 2025-01-31 is 366 days later. */
const UNIX = 1706659200000;

const everySetFunction = (
  title: string,
  body: (testCase: FieldsCase) => void,
) =>
  it.each`
    name             | call                                                   | key       | value   | changed                             | unchanged                 | sentinel | misspelt  | foreign
    ${"setDate"}     | ${(f: never) => setDate("2024-03-10", f)}              | ${"year"} | ${2025} | ${"2025-03-10"}                     | ${"2024-03-10"}           | ${""}    | ${"yaer"} | ${{ hour: 5 }}
    ${"setTime"}     | ${(f: never) => setTime("12:00:00", f)}                | ${"hour"} | ${5}    | ${"05:00:00"}                       | ${"12:00:00"}             | ${""}    | ${"huor"} | ${{ year: 2025 }}
    ${"setDateTime"} | ${(f: never) => setDateTime("2024-03-10T12:00:00", f)} | ${"year"} | ${2025} | ${"2025-03-10T12:00:00"}            | ${"2024-03-10T12:00:00"}  | ${""}    | ${"yaer"} | ${{ era: "ce" }}
    ${"setUtc"}      | ${(f: never) => setUtc("2024-03-10T12:00:00Z", f)}     | ${"year"} | ${2025} | ${"2025-03-10T12:00:00Z"}           | ${"2024-03-10T12:00:00Z"} | ${""}    | ${"yaer"} | ${{ offset: "+00:00" }}
    ${"setUnix"}     | ${(f: never) => setUnix(UNIX, f)}                      | ${"year"} | ${2025} | ${1738281600000}                    | ${1706659200000}          | ${null}  | ${"yaer"} | ${{ offset: "+00:00" }}
    ${"setZoned"}    | ${(f: never) => setZoned(ZONED, f)}                    | ${"year"} | ${2025} | ${"2025-06-15T10:00:00+00:00[UTC]"} | ${ZONED}                  | ${""}    | ${"yaer"} | ${{ offset: "+00:00" }}
  `(title, body as (testCase: unknown) => void);

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

describe("fields: the baseline of each function", () => {
  everySetFunction(
    "$name gives $changed for $key $value",
    ({ call, key, value, changed }) => {
      expect(run(call, { [key]: value })).toEqual(changed);
    },
  );
});

describe("fields: an object that sets nothing is a no-op", () => {
  everySetFunction(
    "$name returns $unchanged for an object with no field",
    ({ call, unchanged }) => {
      expect(run(call, {}), "{}").toEqual(unchanged);
      expect(run(call, { [Symbol("note")]: 1 }), "symbol key").toEqual(
        unchanged,
      );
      expect(
        run(call, () => 0),
        "function",
      ).toEqual(unchanged);
    },
  );

  // Temporal reads undefined as an absent field, so this is the empty object.
  everySetFunction(
    "$name returns $unchanged when $key is undefined",
    ({ call, key, unchanged }) => {
      expect(run(call, { [key]: undefined }), "own").toEqual(unchanged);
      expect(run(call, inheriting({ [key]: undefined })), "inherited").toEqual(
        unchanged,
      );
    },
  );
});

describe("fields: a field is read with an ordinary property get", () => {
  everySetFunction(
    "$name sets an inherited and a non-enumerable $key",
    ({ call, key, value, changed }) => {
      expect(run(call, inheriting({ [key]: value })), "inherited").toEqual(
        changed,
      );
      expect(run(call, hidden(key, value)), "non-enumerable").toEqual(changed);
      expect(
        run(
          call,
          Object.assign(() => 0, { [key]: value }),
        ),
        "function",
      ).toEqual(changed);
    },
  );
});

describe("fields: what Temporal's with refuses returns the sentinel", () => {
  // IsPartialTemporalObject is false for every Temporal object that holds a date or a time.
  everySetFunction(
    "$name returns $sentinel for a Temporal object",
    ({ call, sentinel }) => {
      expect(
        run(call, Temporal.PlainDate.from("2025-06-01")),
        "PlainDate",
      ).toEqual(sentinel);
      expect(run(call, Temporal.PlainTime.from("05:00")), "PlainTime").toEqual(
        sentinel,
      );
      expect(
        run(call, Temporal.PlainDateTime.from("2025-06-01T05:00")),
        "PlainDateTime",
      ).toEqual(sentinel);
      expect(
        run(call, Temporal.PlainYearMonth.from("2025-06")),
        "PlainYearMonth",
      ).toEqual(sentinel);
      expect(
        run(call, Temporal.PlainMonthDay.from("06-01")),
        "PlainMonthDay",
      ).toEqual(sentinel);
      expect(
        run(call, Temporal.ZonedDateTime.from("2025-06-01T05:00+00:00[UTC]")),
        "ZonedDateTime",
      ).toEqual(sentinel);
    },
  );

  everySetFunction(
    "$name returns $sentinel for a calendar or timeZone property, own or inherited",
    ({ call, key, value, sentinel }) => {
      expect(run(call, { calendar: "iso8601" }), "own calendar").toEqual(
        sentinel,
      );
      expect(
        run(call, inheriting({ calendar: "iso8601" })),
        "inherited calendar",
      ).toEqual(sentinel);
      expect(
        run(call, inheriting({ timeZone: "UTC" })),
        "inherited timeZone",
      ).toEqual(sentinel);
      expect(
        run(call, inheriting({ timeZone: "UTC" }, { [key]: value })),
        "inherited timeZone beside a field",
      ).toEqual(sentinel);
    },
  );

  everySetFunction(
    "$name returns $sentinel for a value that is not an object",
    ({ call, sentinel }) => {
      expect(run(call, 5), "number").toEqual(sentinel);
      expect(run(call, true), "boolean").toEqual(sentinel);
      expect(run(call, "year"), "string").toEqual(sentinel);
      expect(run(call, null), "null").toEqual(sentinel);
      expect(run(call, undefined), "undefined").toEqual(sentinel);
    },
  );

  everySetFunction(
    "$name returns $sentinel for an object whose only own key is no field",
    ({ call, sentinel }) => {
      expect(run(call, { nope: 1 }), "nonzero").toEqual(sentinel);
      expect(run(call, { nope: undefined }), "undefined").toEqual(sentinel);
    },
  );

  // A date has no hour and a time has no year, so Temporal finds no field to set.
  it.each`
    name         | call                                      | foreign   | sentinel
    ${"setDate"} | ${(f: never) => setDate("2024-03-10", f)} | ${"hour"} | ${""}
    ${"setTime"} | ${(f: never) => setTime("12:00:00", f)}   | ${"year"} | ${""}
  `(
    "$name returns $sentinel for a $foreign alone, own or inherited",
    ({ call, foreign, sentinel }) => {
      expect(run(call as Call, { [foreign]: 5 }), "own").toEqual(sentinel);
      expect(
        run(call as Call, inheriting({ [foreign]: 5 })),
        "inherited",
      ).toEqual(sentinel);
    },
  );
});

describe("fields: a value is not converted", () => {
  everySetFunction(
    "$name returns $sentinel for a $key that is not an integer number",
    ({ call, key, value, sentinel }) => {
      expect(run(call, { [key]: null }), "null").toEqual(sentinel);
      expect(run(call, { [key]: String(value) }), "string").toEqual(sentinel);
      expect(run(call, { [key]: true }), "boolean").toEqual(sentinel);
      expect(run(call, { [key]: BigInt(value) }), "bigint").toEqual(sentinel);
      expect(run(call, { [key]: Number.NaN }), "NaN").toEqual(sentinel);
      expect(run(call, { [key]: Infinity }), "Infinity").toEqual(sentinel);
      expect(run(call, { [key]: value + 0.5 }), "fraction").toEqual(sentinel);
      expect(
        run(call, inheriting({ [key]: String(value) })),
        "inherited string",
      ).toEqual(sentinel);
    },
  );

  // A month code is a string; Temporal still checks its content. A time has no month code.
  everySetFunction(
    "$name returns $sentinel for a number as monthCode",
    ({ call, sentinel }) => {
      expect(run(call, { monthCode: 3 })).toEqual(sentinel);
    },
  );

  it.each`
    name             | call                                                              | expected
    ${"setDate"}     | ${() => setDate("2024-03-10", { monthCode: "M02" })}              | ${"2024-02-10"}
    ${"setDateTime"} | ${() => setDateTime("2024-03-10T12:00:00", { monthCode: "M02" })} | ${"2024-02-10T12:00:00"}
    ${"setDate"}     | ${() => setDate("2024-03-10", { monthCode: "M13" })}              | ${""}
  `(
    "$name sets a month code as Temporal reads it, giving $expected",
    ({ call, expected }) => {
      expect((call as () => unknown)()).toBe(expected);
    },
  );
});

describe("fields: a key or a field the function does not take", () => {
  everySetFunction(
    "$name returns $sentinel for an own misspelt key ($misspelt)",
    ({ call, key, value, misspelt, sentinel }) => {
      expect(
        run(call, { [key]: value, [misspelt]: 1 }),
        "beside the field",
      ).toEqual(sentinel);
      expect(run(call, { [misspelt]: value }), "alone").toEqual(sentinel);
      expect(run(call, { [misspelt]: undefined }), "undefined").toEqual(
        sentinel,
      );
    },
  );

  // An inherited key that `with` does not read is not an entry and is never read.
  everySetFunction(
    "$name ignores an inherited misspelt key ($misspelt)",
    ({ call, key, value, misspelt, changed }) => {
      expect(
        run(call, inheriting({ [misspelt]: 1 }, { [key]: value })),
      ).toEqual(changed);
    },
  );

  everySetFunction(
    "$name returns $sentinel for $foreign, alone, beside $key, or inherited",
    ({ call, key, value, foreign, sentinel }) => {
      expect(run(call, foreign), "alone").toEqual(sentinel);
      expect(run(call, { [key]: value, ...foreign }), "beside").toEqual(
        sentinel,
      );
      expect(
        run(call, inheriting(foreign, { [key]: value })),
        "inherited",
      ).toEqual(sentinel);
    },
  );

  // The three zoned functions leave `offset` out of `fields`: it is weighed by `options.offset`.
  it.each`
    name          | call                                               | sentinel
    ${"setUtc"}   | ${(f: never) => setUtc("2024-03-10T12:00:00Z", f)} | ${""}
    ${"setUnix"}  | ${(f: never) => setUnix(UNIX, f)}                  | ${null}
    ${"setZoned"} | ${(f: never) => setZoned(ZONED, f)}                | ${""}
  `(
    "$name returns $sentinel for an offset, a string or a number",
    ({ call, sentinel }) => {
      expect(
        run(call as Call, { year: 2025, offset: "+00:00" }),
        "string",
      ).toEqual(sentinel);
      expect(run(call as Call, { year: 2025, offset: 0 }), "number").toEqual(
        sentinel,
      );
    },
  );
});

describe("fields: each property is read once, with a get", () => {
  everySetFunction(
    "$name sets $key from a getter, own or on a class",
    ({ call, key, value, changed }) => {
      const own = Object.defineProperty({}, key, {
        get: () => value,
        enumerable: true,
      });
      const Klass = class {};
      Object.defineProperty(Klass.prototype, key, { get: () => value });

      expect(run(call, own), "own getter").toEqual(changed);
      expect(run(call, new Klass()), "class getter").toEqual(changed);
    },
  );

  everySetFunction(
    "$name reads each property with reads once and hands Temporal none of the caller's getters",
    ({ call, key, value, changed }) => {
      const reads: PropertyKey[] = [];
      const fields = new Proxy(
        { [key]: value },
        {
          get(target, property, receiver) {
            reads.push(property);
            return Reflect.get(target, property, receiver) as unknown;
          },
        },
      );

      expect(run(call, fields)).toEqual(changed);
      expect([...reads].sort()).toEqual(WITH_NAMES);
    },
  );
});

/** A class whose `hour` is a getter on its prototype, as a caller's own value object may have. */
class NineOClock {
  get hour(): number {
    return 9;
  }
}

// The last instant Temporal supports is +275760-09-13T00:00:00Z, which is 8.64e15 ms and 10:00 on
// that date in Sydney (+10:00). 08:00 there is two hours before it and 09:00 is one hour before:
// 8.64e15 - 3600000 = 8639999996400000. Setting a field this close to the limit takes the
// range-limit path of `withZonedFields`. `readSetFields` reads `fields` the way `with` does and
// hands both paths the same fresh object, so an inherited or getter field must still be set.
describe("fields: a field read with a get at the limit of the instant range", () => {
  const SYDNEY_NEAR_MAX = "+275760-09-13T08:00:00+10:00[Australia/Sydney]";
  const UNIX_NEAR_MAX = 8.64e15 - 7200000;

  it.each`
    shape                        | fields
    ${"an own hour"}             | ${{ hour: 9 }}
    ${"an inherited hour"}       | ${inheriting({ hour: 9 })}
    ${"a non-enumerable hour"}   | ${hidden("hour", 9)}
    ${"a class getter for hour"} | ${new NineOClock()}
  `("setZoned sets $shape one hour before the last instant", ({ fields }) => {
    expect(setZoned(SYDNEY_NEAR_MAX, fields as never)).toBe(
      "+275760-09-13T09:00:00+10:00[Australia/Sydney]",
    );
  });

  // `offset` is not a field of setZoned, so the range-limit path refuses it as the other path does.
  it.each`
    shape                                       | value                                            | fields
    ${"an inherited hour beside an own offset"} | ${SYDNEY_NEAR_MAX}                               | ${inheriting({ hour: 9 }, { offset: "+10:00" })}
    ${"an own hour beside an inherited offset"} | ${SYDNEY_NEAR_MAX}                               | ${inheriting({ offset: "+10:00" }, { hour: 9 })}
    ${"an own hour beside an own offset"}       | ${"2024-06-15T08:00:00+10:00[Australia/Sydney]"} | ${{ hour: 9, offset: "+10:00" }}
  `("setZoned returns '' for $shape at $value", ({ value, fields }) => {
    expect(setZoned(value, fields as never)).toBe("");
  });

  it.each`
    shape                        | fields
    ${"an own hour"}             | ${{ hour: 9 }}
    ${"an inherited hour"}       | ${inheriting({ hour: 9 })}
    ${"a non-enumerable hour"}   | ${hidden("hour", 9)}
    ${"a class getter for hour"} | ${new NineOClock()}
  `("setUnix sets $shape one hour before the last instant", ({ fields }) => {
    expect(
      setUnix(UNIX_NEAR_MAX, fields as never, { timeZone: "Australia/Sydney" }),
    ).toBe(8639999996400000);
  });
});

// The ISO 8601 calendar has no era, so Temporal finds no field in `{ era, eraYear }` and throws.
// A value in a calendar that has eras is refused before its fields are read. So no set* function
// can set an era, and the `fields` types leave both out.
describe("fields: era and eraYear are not fields", () => {
  it("makes era and eraYear a type error, and returns the sentinel at run time", () => {
    const era = { era: "ce", eraYear: 2025 };

    // @ts-expect-error era and eraYear are not fields of setDate
    expect(setDate("2024-01-31", era)).toBe("");
    // @ts-expect-error era and eraYear are not fields of setDateTime
    expect(setDateTime("2024-01-31T10:00:00", era)).toBe("");
    // @ts-expect-error era and eraYear are not fields of setUtc
    expect(setUtc("2024-03-10T12:00:00Z", era)).toBe("");
    // @ts-expect-error era and eraYear are not fields of setUnix
    expect(setUnix(UNIX, era)).toBeNull();
    // @ts-expect-error era and eraYear are not fields of setZoned
    expect(setZoned(ZONED, era)).toBe("");
    // @ts-expect-error a time has no era
    expect(setTime("12:00:00", era)).toBe("");
  });

  // Temporal reads only the fields of the value's calendar and would ignore these beside a field
  // it does read. GMT returns the sentinel, as it does for each of them alone.
  it.each`
    name         | call                                                               | expected
    ${"setDate"} | ${() => setDate("2024-03-10", { year: 2025, hour: 5 } as never)}   | ${""}
    ${"setDate"} | ${() => setDate("2024-03-10", { year: 2025, era: "ce" } as never)} | ${""}
    ${"setTime"} | ${() => setTime("12:00:00", { hour: 5, year: 2025 } as never)}     | ${""}
  `(
    "$name returns $expected for a field it does not take beside one it does",
    ({ call, expected }) => {
      expect((call as () => unknown)()).toBe(expected);
    },
  );
});

// TC39 Temporal Table 19: month and day are read with ToPositiveIntegerWithTruncation, which throws
// below 1 before `overflow` is consulted. A number too large for its field follows `overflow`, and
// a date outside Temporal's range (years -271821 to 275760) is refused under either setting.
describe("fields: a number out of range for its field", () => {
  it.each`
    name             | call                                                                    | expected
    ${"setDate"}     | ${() => setDate("2024-01-31", { month: 0 })}                            | ${""}
    ${"setDate"}     | ${() => setDate("2024-01-31", { month: -1 })}                           | ${""}
    ${"setDate"}     | ${() => setDate("2024-01-31", { day: 0 })}                              | ${""}
    ${"setDate"}     | ${() => setDate("2024-01-31", { day: -1 })}                             | ${""}
    ${"setDate"}     | ${() => setDate("2024-01-31", { month: 0 }, { overflow: "constrain" })} | ${""}
    ${"setDate"}     | ${() => setDate("2024-01-31", { year: 300000 })}                        | ${""}
    ${"setDate"}     | ${() => setDate("2024-01-31", { month: 13 })}                           | ${"2024-12-31"}
    ${"setDate"}     | ${() => setDate("2024-01-31", { month: 13 }, { overflow: "reject" })}   | ${""}
    ${"setDateTime"} | ${() => setDateTime("2024-01-31T12:00:00", { day: 0 })}                 | ${""}
    ${"setDateTime"} | ${() => setDateTime("2024-01-31T12:00:00", { month: 13 })}              | ${"2024-12-31T12:00:00"}
    ${"setUtc"}      | ${() => setUtc("2024-01-31T12:00:00Z", { year: 300000 })}               | ${""}
    ${"setUtc"}      | ${() => setUtc("2024-01-31T12:00:00Z", { month: 0 })}                   | ${""}
    ${"setZoned"}    | ${() => setZoned(ZONED, { day: 0 })}                                    | ${""}
    ${"setZoned"}    | ${() => setZoned(ZONED, { year: 300000 })}                              | ${""}
    ${"setUnix"}     | ${() => setUnix(UNIX, { month: 0 })}                                    | ${null}
    ${"setUnix"}     | ${() => setUnix(UNIX, { year: 300000 })}                                | ${null}
    ${"setUnix"}     | ${() => setUnix(UNIX, { month: 13 })}                                   | ${1735603200000}
  `("$name returns $expected ($call)", ({ call, expected }) => {
    expect((call as () => unknown)()).toBe(expected);
  });
});

// A host's `globalThis.Temporal` is consulted only to recognise its objects. A malformed one is
// ignored, so it never changes the result for an ordinary field object.
describe("fields: a malformed globalThis.Temporal", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each`
    shape                                | host
    ${"a class whose prototype is null"} | ${{ PlainDate: { prototype: null } }}
    ${"a prototype getter that throws"} | ${{ get PlainDate() {
    throw new Error("hostile host");
  } }}
    ${"a class whose prototype throws"} | ${{ PlainDate: { get prototype() {
      throw new Error("hostile host");
    } } }}
    ${"a Proxy that throws on any read"} | ${new Proxy({}, { get() {
      throw new Error("hostile host");
    } })}
    ${"a getter that is not a function"} | ${{ PlainDate: { prototype: Object.defineProperty({}, "calendarId", { get: undefined, set: () => undefined }) } }}
  `("setDate still sets the year with $shape", ({ host }) => {
    vi.stubGlobal("Temporal", host);

    expect(setDate("2024-01-31", { year: 2025 })).toBe("2025-01-31");
  });
});

// A plain object, an Object.create(null) object and a function cannot be Temporal objects unless
// someone swapped a Temporal object's prototype, so the brand check is skipped for them.
describe("fields: the prototype decides whether the brand check runs", () => {
  // Accepted by owner decision: with its prototype swapped to Object.prototype, a Temporal object
  // has no readable field left, so it sets nothing and the value comes back unchanged.
  everySetFunction(
    "$name returns $unchanged for a Temporal object whose prototype was swapped to Object.prototype (accepted by owner decision)",
    ({ call, unchanged }) => {
      const swapped = Object.setPrototypeOf(
        Temporal.PlainDateTime.from("2025-06-01T05:00"),
        Object.prototype,
      ) as object;

      expect(run(call, swapped)).toEqual(unchanged);
    },
  );

  everySetFunction(
    "$name sets $key from an Object.create(null) object",
    ({ call, key, value, changed }) => {
      expect(
        run(
          call,
          Object.assign(Object.create(null) as Fields, { [key]: value }),
        ),
      ).toEqual(changed);
    },
  );

  everySetFunction(
    "$name returns $sentinel when reading the prototype throws",
    ({ call, key, value, sentinel }) => {
      const fields = new Proxy(
        { [key]: value },
        {
          getPrototypeOf() {
            throw new Error("hostile prototype");
          },
        },
      );

      expect(() => run(call, fields)).not.toThrow();
      expect(run(call, fields)).toEqual(sentinel);
    },
  );
});

describe("fields: the reported cases", () => {
  it.each`
    name                                | call                                                                   | expected
    ${"setDate, an inherited year"}     | ${() => setDate("2024-03-10", Object.create({ year: 2025 }) as never)} | ${"2025-03-10"}
    ${"setDate, a PlainDate"}           | ${() => setDate("2024-03-10", Temporal.PlainDate.from("2025-06-01"))}  | ${""}
    ${"setDate, an empty object"}       | ${() => setDate("2024-03-10", {})}                                     | ${"2024-03-10"}
    ${"setDate, year null"}             | ${() => setDate("2024-01-31", { year: null } as never)}                | ${""}
    ${"setDate, year a string"}         | ${() => setDate("2024-01-31", { year: "2025" } as never)}              | ${""}
    ${"setDate, a misspelt key"}        | ${() => setDate("2024-01-31", { year: 2025, yaer: 1 } as never)}       | ${""}
    ${"setDate, an hour beside a year"} | ${() => setDate("2024-03-10", { year: 2025, hour: 5 } as never)}       | ${""}
    ${"setDate, year undefined"}        | ${() => setDate("2024-03-10", { year: undefined })}                    | ${"2024-03-10"}
  `("$name returns $expected", ({ call, expected }) => {
    expect((call as () => unknown)()).toBe(expected);
  });
});
