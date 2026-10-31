---
"@northguild/gmt": minor
---

The core string validators now accept a value of any type. A value typed `unknown`, such as a function argument or the output of a schema check, needed a cast before you could ask whether it is valid. The functions already returned `false` for a value that is not a string, so for 26 of the 27 only the types change. Two rare type-level uses stop compiling, and **Breaking changes** covers both.

One result changes: `isValidTimeZone` returned `true` for a `Temporal.ZonedDateTime` whose `toString` gives a zone id. It now returns `false` for every value that is not a string.

- A value typed `unknown` needs no cast, and a `true` result narrows it to `string`. The three duration-unit predicates narrow it to their unit union.
- A `string` argument stays `string` when the result is `false`.
- A typed union such as `string | null` or `string | undefined` gets a plain `boolean` and is not narrowed. A `false` result does not show which part of the union the value is.
- `values.filter(isValidDate)` on an `unknown[]` gives `string[]`.

```typescript
import { isValidDate } from "@northguild/gmt";

declare const input: unknown;
if (isValidDate(input)) {
  input; // string
}
```

Two functions whose typed calls cannot fail now return a plain value. `getUnixNow()` returns `number`, so `addUnix(getUnixNow(), { years: 1 })` compiles with no null check, and `x12TimeCodeZone` returns `X12NamedZone` for an `X12ZoneTimeCode`. A value outside the parameter type, such as a `string` variable, a value typed `unknown` or a misspelt unit, still compiles and returns `number | null` or `X12NamedZone | null`. These overloads change only the types.

The validator change covers 27 functions: `isValidDate`, `isValidDateTime`, `isValidTime`, `isValidYearMonth`, `isValidMonthDay`, `isValidCalendarDate`, `isValidIsoDateLike`, `isValidSqlDateTime`, `isValidDateDurationUnit`, `isValidDateTimeDurationUnit`, `isValidTimeDurationUnit`, `isValidZonedDateTime`, `isValidTimeZone`, `isValidCalendarZonedDateTime`, `isValidRfc2822DateTime`, `isValidRfc3339DateTime`, `isValidInstant`, `isValidInt64NanosecondDateTime`, `isValidInt64NanosecondInstant`, `isValidNanoPattern`, `isValidUtc`, `isValidHttpDate`, `isValidUtcTimestamp`, `isValidDuration`, `isValidUtcOffset`, `isValidEpcisEventTime` and `isValidEpcisTimeZoneOffset`.

The clock functions no longer return a moment one millisecond early. After a test faked a clock set before 1970, the polyfill's next reading of the real clock could land one millisecond before `Date.now()`, so a test that then faked a 2027 clock could see the last millisecond of 2026. Every function that reads the clock now checks its reading against `Date.now()` and corrects a one-millisecond shortfall. A native `Temporal` and a fixed polyfill are not affected. The defect is filed as [tc39/proposal-temporal#3335](https://github.com/tc39/proposal-temporal/issues/3335).

### Breaking changes

**1. `Parameters<typeof fn>` reads `unknown`.** TypeScript takes `Parameters<>` from the last overload, which now takes `unknown`. This applies to the 27 validators above, `getUnixNow` and `x12TimeCodeZone`. Name the parameter type yourself:

```typescript
// 1.20: v is string
const f = (v: Parameters<typeof isValidDate>[0]) => v.length;

// 1.21: v is unknown, so v.length fails with TS18046. Name the type:
const f = (v: string) => v.length;

// The same for the other two:
type UnixNowOptions = { epochUnit?: UnixUnit }; // was Parameters<typeof getUnixNow>[0]
type ZoneCode = X12ZoneTimeCode; // was Parameters<typeof x12TimeCodeZone>[0]
```

**2. A value typed `any` narrows to `string`.** A `true` result from one of the 24 string validators now narrows an `any` argument to `string`, as it narrows `unknown`. Code that then assigns it to a branded string type fails with TS2322. The three duration-unit predicates already narrowed `any`, so they do not change. Only a variable or parameter typed `any` narrows. A property of an `any` value, such as `JSON.parse(text).date` or `body.date`, does not, so most untyped data is unaffected.

```typescript
type IsoDate = string & { readonly __brand: "IsoDate" };

// 1.20: a stays any after the check, so this compiled
function read(a: any): IsoDate | null {
  return isValidDate(a) ? a : null;
}

// 1.21: a is string after the check, so state the brand
function read(a: any): IsoDate | null {
  return isValidDate(a) ? (a as IsoDate) : null;
}
```
