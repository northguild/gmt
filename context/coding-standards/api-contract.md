# Coding Standards: API Contract and Try-Catch

## API Contract

- All public functions accept **ISO 8601 strings** (or numeric Unix epochs where the domain requires it).
- Return types: ISO strings, numbers, booleans, arrays, `bigint`, or plain objects — never `Date` objects or Temporal objects.
- Invalid input returns a typed sentinel — never throws. **This table is the single source of truth for sentinels**; every other doc links here:

| Return type                                    | Sentinel | Examples                                                |
| ---------------------------------------------- | -------- | ------------------------------------------------------- |
| `string`                                       | `""`     | `addDate`, `floorToZone`, `resolveLocal`                |
| `number`                                       | `null`   | `getDay`, `spanMs`                                      |
| `boolean`                                      | `false`  | `isValidDate`, `isAfterZoned`                           |
| array                                          | `[]`     | `bucketRange`, `splitIntervalByUnitDate`                |
| object (`{ … } \| null`)                       | `null`   | `getIsoWeekDate`, `getFiscalPeriod`, `toOffsetInstant`  |
| `bigint` (`precision/` converters and parsers) | `0n`     | `toNanoseconds`, `parseNanoseconds`, `toPgMicroseconds` |
| `span/` functions (any numeric type)           | `null`   | `spanMs`, `spanNs` (`bigint \| null`), `spanWallClock`  |

- **Arguments follow TC39's option-reading rules** (1.16.0):
  - An explicit `undefined` positional argument is the same as omitting it (`GetOption`).
  - An options argument must be omitted, `undefined` or an Object. `null`, a string or a number returns the sentinel (`GetOptionsObject`). A function is an Object (ECMA-262 §6.1.7), so a function carrying the options is read like any other bag, as Temporal reads it; the same holds for every other object argument, a property bag or a GMT record. `internal/isObject.ts` is the one check: never test `typeof x === "object"` by hand. A member is read with an ordinary property get, as `GetOption` reads one, so a function's own `name` is a value like any other: a `cutoffSchedule` entry written as a function is labelled with it. The `Intl.DateTimeFormat`-backed formatters follow ECMA-402's `CoerceOptionsToObject` instead: `null` returns `""`, and a string or number means the defaults.
  - A locale is `string | string[]` everywhere (`CanonicalizeLocaleList`). An invalid tag returns the sentinel. `[]` means the default locale where the locale is optional, and returns the sentinel where it is required (`getLocaleMonthNames([])` is `[]`).
  - Unit names are accepted singular or plural (`"day"` and `"days"`), as Temporal §13.17 does.
- **One documented exception:** the `min*`/`max*` aggregators (`minDate`, `maxZoned`, …) return `string | null`, with `null` meaning "no valid item". Do not copy that shape into new string functions.

- **`get/` namespaces hold current-moment accessors only.** Each reads the clock and takes no date value: no argument, a time zone, output options, or a length counted from now (`getDay()`, `getZonedDay(timeZone)`, `getZonedIn(timeZone, units)`). Any function taking a date value belongs in `calculate/` (or `parse/`, `compare/`, `format/` as its verb dictates) — see J0b, which relocated `getLocaleDayOfWeek`/`getLocaleZonedDayOfWeek` out of `get/` for violating this.

## Allowed vs. Forbidden Patterns

### Allowed

| Pattern                          | Example                                 |
| -------------------------------- | --------------------------------------- |
| ISO strings                      | `"2024-03-10"`                          |
| Temporal objects (internal only) | `Temporal.PlainDate.from("2024-03-10")` |
| Tree-shakable exports            | `export * from "./plain"`               |

### Forbidden

| Pattern               | Replacement                                |
| --------------------- | ------------------------------------------ |
| `new Date()`          | `Temporal.Now.instant()`                   |
| `date.getTime()`      | `Temporal.Instant.from(date).epochSeconds` |
| Manual string parsing | `Temporal.PlainDate.from(string)`          |
| Mutating methods      | Use Temporal's immutable methods           |

## Always Wrap Temporal Calls in Try-Catch

Temporal's static methods (`.from()`, `.add()`, `.subtract()`, `.since()`, `.until()`, etc.) throw `RangeError` on invalid input. Every call must be wrapped:

```ts
export function addDays(dateStr: string, days: number): string {
  try {
    const date = Temporal.PlainDate.from(dateStr);
    return date.add({ days }).toString();
  } catch {
    return "";
  }
}
```

- Wrap the entire block that uses Temporal methods.
- The catch block takes no argument (`catch { ... }`) — we never need the error value.
- Return the appropriate sentinel for the function's return type.
- **Validate, then parse, is intentional.** A public function runs its `isValid*` guard and then parses the same string again inside `try`. The double parse keeps each function's contract explicit and self-contained; do not "optimise" it away or flag it in review.

### Scoped exception: the UTC clock readers

A function has no try-catch and documents no sentinel when all four of these hold:

1. It takes no argument.
2. Its only Temporal entry point is `Temporal.Now.instant()`.
3. Every conversion of that instant names `"UTC"` explicitly (`.toZonedDateTimeISO("UTC")`), or is `.toString()` with no options.
4. After the conversion it only reads a field or calls `.toString()` with no options — no arithmetic, rounding, `.with()` or options bag. `.add({ days: 1 })` throws at the upper limit of the `Instant` range.

On a conformant clock nothing in that chain can throw. ECMA-262 defines `Date.now()` as an integral time value within ±8.64e15 ms, Temporal's `HostSystemUTCEpochNanoseconds` keeps the reading inside the `Instant` range, and `"UTC"` is always a valid time zone. A catch there is dead code, and a documented `""` is a result no caller can receive. Do not add either. The one way to make these functions throw is to replace `Date.now` with a function that returns a non-integer, which no host does.

The functions are `getUtcNow`, `getUtc{Year,Month,Day,Hour,Minute,Second,Millisecond,Microsecond,Nanosecond}` and `getUnix{Year,Month,Day,Hour,Minute,Second,Millisecond,Microsecond,Nanosecond}`.

The exception is narrow. It does **not** cover:

- **A read of the system time zone** — `Temporal.Now.zonedDateTimeISO()` with no argument, `Temporal.Now.timeZoneId()`, or `Intl.DateTimeFormat().resolvedOptions().timeZone`. A host can report no usable zone: Node reports `Etc/Unknown` for an empty `TZ` and `undefined` for an unknown one, and `Temporal.Now.zonedDateTimeISO()` throws on both. `getNow`, `getToday`, `getSystemTimeZone` and the other system-zone readers keep their try-catch and their sentinel.
- **Any function that takes an argument**, even one validated before the clock is read (`getUtcNowUnit`, `getUnixNow`, `getZonedNow`, the `getZoned*` readers). It keeps its validation, its try-catch and its sentinel.
