---
"@northguild/gmt": patch
---

Check the `units` object of the 12 `add*` and `subtract*` functions, and the `fields` object of the six `set*` functions, before TC39 Temporal reads them. Each property is now read once, with an ordinary property get and in the order Temporal reads them, and every value read is checked. Three things change:

- **An `add*` or `subtract*` function no longer applies a unit it does not take, or an amount that is not a number, when the object inherits it.**
- **A `set*` function no longer returns its value unchanged** for an object that does set a field, or for an argument Temporal's `with` refuses.
- **A `set*` function now refuses what Temporal would quietly accept**: a value Temporal would convert, such as `"2025"` or `null`; a key that is no field of the function, even beside one that is; and an `offset`. The `add*` functions already held their `units` to this rule. A plain object of own fields with the right types gives the same result as before.

Some of these changes make a call that compiles return the sentinel where it returned a value. **Breaking changes** in the entry that adds `totalUnits` lists them, with a migration for each.

Temporal reads a duration-like object by getting each of the ten unit names from it (ToTemporalPartialDurationRecord). Its `with` methods get each field name the same way. A property get finds an own property, an inherited one, a non-enumerable one and a getter alike. GMT checked the object's own enumerable keys only. In an `add*` function, a value that check never saw still reached Temporal, and Temporal applied it. In a `set*` function, an object with no own field was read as setting nothing, and the value came back unchanged.

A Temporal object has no own keys, so it passed the check too. Temporal reads a `Temporal.Duration` from its internal slots, not from its getters (ToTemporalDuration), so all its units reached Temporal unchecked. Temporal's `with` refuses a `Temporal.PlainDate` (IsPartialTemporalObject), but GMT read it as setting nothing and returned the value unchanged.

### The `units` of `add*` and `subtract*`

The functions are `addDate`, `subtractDate`, `addTime`, `subtractTime`, `addDateTime`, `subtractDateTime`, `addUtc`, `subtractUtc`, `addUnix`, `subtractUnix`, `addZoned` and `subtractZoned`. Each one now reads the ten unit names once, checks every value it read, and passes Temporal only those values.

| Call | 1.18 | 1.19 |
| --- | --- | --- |
| `addDate("2024-01-31", Temporal.Duration.from("PT36H"))` | `"2024-02-01"` | `""` |
| `subtractDate("2024-01-31", Temporal.Duration.from("PT36H"))` | `"2024-01-30"` | `""` |
| `addTime("14:30:00", Temporal.Duration.from("P1DT1H"))` | `"15:30:00"` | `""` |
| `subtractTime("14:30:00", Temporal.Duration.from("P1DT1H"))` | `"13:30:00"` | `""` |
| `addDate("2024-01-31", Object.create({ hours: 36 }))` | `"2024-02-01"` | `""` |
| `addUtc("2024-03-10T12:00:00Z", Object.create({ days: "5" }))` | `"2024-03-15T12:00:00Z"` | `""` |
| `addUtc("2024-03-10T12:00:00Z", { days: 5, hours: undefined })` | `""` | `"2024-03-15T12:00:00Z"` |

- **A unit outside the function's set is refused wherever it is read from.** `addDate` and `subtractDate` take years, months, weeks and days. `addTime` and `subtractTime` take hours down to nanoseconds. `addDate("2024-01-31", { hours: 36 })` has always returned `""`. The same 36 hours, inherited or carried by a `Temporal.Duration`, added one day. `addTime` and `subtractTime` dropped the day of a `Temporal.Duration` and applied the rest.
- **An amount that is not a number is refused wherever it is read from.** `{ days: "5" }` has always returned the sentinel. An inherited `"5"` reached Temporal, which converts a string to a number, and five days were added. This applies to all 12 functions.
- **A unit the function takes, set to `undefined`, is absent**, as Temporal reads it. This holds in all 12 functions: `addDate("2024-01-31", { days: 5, years: undefined })` is `"2024-02-05"`, and `{ days: 5, hours: undefined }` reads as `{ days: 5 }` in the eight functions that take all ten units. Both returned the sentinel. An own key outside the function's set still returns the sentinel, whatever its value.
- **An object with no unit present still returns the sentinel**: `{}`, and `{ days: undefined }`.
- **A `Temporal.Duration` still works when its nonzero fields are units the function takes.** `addDate("2024-01-31", Temporal.Duration.from("P1D"))` is `"2024-02-01"`. The eight functions that take all ten units accept any `Temporal.Duration`, as before.
- **Unchanged:** every call with a plain object written out, such as `{ days: 5 }`. An own key that is misspelt, or that names a unit the function does not take, still returns the sentinel, whatever its value: `addDate("2024-01-31", { days: 1, hours: undefined })` is `""`.
- The sentinel is `""`, and `null` for `addUnix` and `subtractUnix`.

### The `fields` of `set*`

The functions are `setDate`, `setTime`, `setDateTime`, `setUtc`, `setUnix` and `setZoned`. Each one now reads every property Temporal's `with` reads, once, checks every value it read, and passes Temporal only the fields the function takes. An object that sets no field still returns the value unchanged, where Temporal's `with` throws.

| Call | 1.18 | 1.19 |
| --- | --- | --- |
| `setDate("2024-03-10", Object.create({ year: 2025 }))` | `"2024-03-10"` | `"2025-03-10"` |
| `setDate("2024-03-10", Temporal.PlainDate.from("2025-06-01"))` | `"2024-03-10"` | `""` |
| `setDate("2024-03-10", Object.create({ calendar: "iso8601" }))` | `"2024-03-10"` | `""` |
| `setDate("2024-03-10", 5)` | `"2024-03-10"` | `""` |
| `setDate("2024-03-10", { year: undefined })` | `""` | `"2024-03-10"` |
| `setDate("2024-01-31", { year: null })` | `"0000-01-31"` | `""` |
| `setDate("2024-01-31", { year: "2025" })` | `"2025-01-31"` | `""` |
| `setTime("12:00:00", { hour: 9.5 })` | `"09:00:00"` | `""` |
| `setDate("2024-01-31", { year: 2025, yaer: 1 })` | `"2025-01-31"` | `""` |
| `setDate("2024-03-10", { year: 2025, hour: 5 })` | `"2025-03-10"` | `""` |
| `setZoned("2024-06-15T08:00:00+10:00[Australia/Sydney]", { hour: 9, offset: "+10:00" })` | `"2024-06-15T09:00:00+10:00[Australia/Sydney]"` | `""` |

The other functions change in the same way.

Fields GMT now reads as Temporal does:

- **An inherited field, a non-enumerable field and a field that is a getter are set**, as Temporal's `with` sets them. The function used to ignore such a field and return the value unchanged, with no sign that nothing was set.
- **That holds close to the last instant Temporal supports**, in `setZoned` and `setUnix` too: `setZoned("+275760-09-13T08:00:00+10:00[Australia/Sydney]", Object.create({ hour: 9 }))` is `"+275760-09-13T09:00:00+10:00[Australia/Sydney]"`.
- **A field set to `undefined` is absent.** Temporal's PrepareCalendarFields counts a field only when its value is not `undefined`. So `{ year: undefined }` is a no-op, like `{}`. It returned the sentinel.
- **A Temporal object returns the sentinel.** Temporal's `with` refuses one (IsPartialTemporalObject). That covers `Temporal.PlainDate`, `PlainTime`, `PlainDateTime`, `PlainYearMonth`, `PlainMonthDay` and `ZonedDateTime`. It used to be a no-op.
- **An inherited `calendar` or `timeZone` property returns the sentinel**, as an own one always has. It used to be a no-op.
- **A value that is not an object returns the sentinel.** A number, a boolean, a bigint, a symbol and an empty string used to be a no-op.

What GMT now refuses where Temporal would accept it, the same rule the `units` of `add*` follow:

- **A value is not converted.** `monthCode` must be a string, and every other field an integer number. `null`, a numeric string, a boolean and a fraction return the sentinel. Temporal would read `null` as 0, `"2025"` as 2025 and `true` as 1, and cut 2025.5 to 2025. A bigint, `NaN` and an infinity return the sentinel too, as they did in 1.18, because Temporal throws for them.
- **An own key that is no field of the function returns the sentinel, even beside a field.** A misspelt key used to return the sentinel only when no field was beside it. Beside a real field, Temporal ignored it, so `{ year: 2025, yaer: 1 }` set the year and the typo went unnoticed.
- **A field the function does not take returns the sentinel, alone or beside a field it does take, and wherever it is read from.** That is an `hour` in `setDate`, a `year` in `setTime`, and an `era` or `eraYear` in any of the six. Temporal ignores such a field beside one it reads, and an inherited one used to be a no-op.
- **An `offset` in `fields` returns the sentinel in `setUtc`, `setUnix` and `setZoned`.** Their `fields` type has never had one. In `setZoned` and `setUnix`, `options.offset` says how the value's own offset is treated, and `options.disambiguation` picks between the two instants of a repeated wall-clock time. A UTC instant's offset is always `+00:00`. `setZoned` used to apply an `offset` passed in `fields`.

Unchanged:

- **Every plain object with own fields of the right type gives the result it gave in 1.18**: integer numbers, and a string `monthCode`.
- **A number too large for its field still follows `overflow`.** `setDate("2024-01-31", { month: 13 })` is `"2024-12-31"`, and `""` with `{ overflow: "reject" }`. A month or a day below 1, and a date outside Temporal's range, return the sentinel under either setting, as before.
- **`{}` is a no-op**, and so is an object whose only key is a symbol.
- The sentinel is `""`, and `null` for `setUnix`.
- `era` and `eraYear` also leave the `fields` type of five of these functions. No call could ever set them. See breaking change 2 in the entry that adds `totalUnits`.
