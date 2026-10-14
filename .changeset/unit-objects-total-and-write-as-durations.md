---
"@northguild/gmt": minor
---

Add `totalUnits` and `durationFromUnits` to the `duration/` namespace. Both take an amount written as a unit object, such as `{ minutes: 15 }`: `totalUnits` returns it as one number in the unit you name, and `durationFromUnits` writes it as an ISO 8601 duration string. Two changes break existing code, and **Breaking changes** covers both: `durationAs` is renamed `totalDuration`, and the `fields` type of five `set*` functions no longer has `era` and `eraYear`.

The library writes an amount of time in two shapes. Functions such as `addDate` and `addUtc` take a unit object, `{ minutes: 15 }`. The `duration/` functions take an ISO 8601 duration string, `"PT15M"`. Each function takes one shape. These two functions start from the object, so a caller who holds one does not have to write the string by hand.

```typescript
import { durationFromUnits, totalDuration, totalUnits } from "@northguild/gmt";

// A unit object as one number.
totalUnits({ minutes: 15 }, "seconds"); // 900
totalUnits({ days: 1, hours: 12 }, "seconds"); // 129600
totalUnits({ hours: 36 }, "days"); // 1.5

// A unit object as the duration string the duration functions take.
durationFromUnits({ minutes: 15 }); // "PT15M"
durationFromUnits({ days: 1, hours: 12 }); // "P1DT12H"
durationFromUnits({ years: 1, months: 2 }); // "P1Y2M"

// A duration string as one number.
totalDuration("PT36H", "days"); // 1.5

// A calendar amount: write the string, then total it from a date.
totalDuration(durationFromUnits({ months: 1 }), "days", { relativeTo: "2024-02-01" }); // 29
```

Which function to use:

- **`totalUnits(units, unit)`** when you hold a unit object of exact units and want one number, such as a lifetime in seconds.
- **`durationFromUnits(units)`** when you hold a unit object and the function you call takes a duration string.
- **`totalDuration(value, unit, options?)`** when you hold a duration string, or when the amount has a year, a month or a week in it.

What each one takes:

- **`totalUnits` takes exact units only**: `days`, `hours`, `minutes`, `seconds`, `milliseconds`, `microseconds` and `nanoseconds`. A day is 24 hours, as `Temporal.Duration.prototype.total` reads a day when it has no `relativeTo`. The function takes no options.
- **A year, a month or a week returns `null` from `totalUnits`**, as a key and as the unit asked for. TC39 Temporal gives them no length without a date to measure from. `totalUnits({ weeks: 1 }, "days")` is `null`: write `{ days: 7 }`.
- **`durationFromUnits` takes all ten units**, from `years` down to `nanoseconds`. Writing a year, a month or a week needs no date.
- **`durationFromUnits` writes years down to minutes as given.** It carries nothing into a larger unit: `{ minutes: 90 }` is `"PT90M"`. `normalizeDuration` with `largestUnit` carries it.
- **Seconds and the three smaller units are written together as one decimal number of seconds**, as `Temporal.Duration.prototype.toString` writes them: `{ milliseconds: 1500 }` is `"PT1.5S"`, and `{ seconds: 59, milliseconds: 1500 }` is `"PT60.5S"`.
- **Every key is a plural unit name and every amount is a whole number.** All nonzero amounts have the same sign, as Temporal requires of a duration. A zero amount is `"PT0S"` from `durationFromUnits` and `0` from `totalUnits`.
- **A unit set to `undefined` is absent**, as Temporal reads it: `totalUnits({ minutes: 15, hours: undefined }, "seconds")` is `900`.
- **`unit` in `totalUnits` takes the plural or the singular name**, `"seconds"` or `"second"`, as Temporal does.

What returns the sentinel, `null` from `totalUnits` and `""` from `durationFromUnits`:

- **An unknown key, even beside a valid one.** `{ minutes: 15, hour: 1 }` returns the sentinel. `Temporal.Duration.from` ignores a key it does not know, so on its own it would read that object as 15 minutes and lose the hour.
- **A fraction** (`{ minutes: 1.5 }`), **mixed signs** (`{ hours: 1, minutes: -30 }`), an object with no unit in it (`{}`), and an amount outside Temporal's duration range.
- **A value that is not a unit object.** A duration string is one: `totalUnits("PT15M", "seconds")` is `null`. Pass a string to `totalDuration`.

Also exported: the `ExactDurationUnit` type, the seven unit names `totalUnits` takes.

### Breaking changes

**1. `durationAs` is renamed `totalDuration`.** TC39 Temporal calls this operation `total` (`Temporal.Duration.prototype.total`), and the name now matches `totalUnits`, which does the same for a unit object. No alias is kept.

| 1.18 | 1.19 |
| --- | --- |
| `durationAs(value, unit, options?)` | `totalDuration(value, unit, options?)` |

Migration: rename the call and its import. The arguments, the results and the subpaths are the same: `@northguild/gmt`, `@northguild/gmt/duration` and `@northguild/gmt/duration/calculate`.

```typescript
import { totalDuration } from "@northguild/gmt/duration";

totalDuration("P1DT2H30M", "hours"); // 26.5
totalDuration("P1M", "days", { relativeTo: "2024-02-01" }); // 29
```

**2. `era` and `eraYear` are no longer in the `fields` type of five `set*` functions.** The functions are `setDate`, `setDateTime`, `setUtc`, `setUnix` and `setZoned`. `setTime` never had them. A typed call that passes either one no longer compiles.

No call could ever set an era. These functions refuse a value in a calendar other than ISO 8601 before they read `fields`, and the ISO 8601 calendar has no era, so Temporal's `with` finds no field in `{ era, eraYear }`. The type offered two fields that returned the sentinel alone, and that Temporal ignored beside a field the function does take. At run time, an era beside such a field now returns the sentinel too, as every field a `set*` function does not take now does: see the entry on the `fields` of `set*`.

| Call | 1.18 | 1.19 |
| --- | --- | --- |
| `setDate("2024-01-31", { era: "ce", eraYear: 2025 })` | Compiles. Returns `""` | Does not compile. Returns `""` at run time |
| `setDate("2024-03-10", { year: 2025, era: "ce" })` | Compiles. Returns `"2025-03-10"` | Does not compile. Returns `""` at run time |

Migration: delete `era` and `eraYear` from the object. To set a year, pass `year`: `setDate("2024-03-10", { year: 2025 })` is `"2025-03-10"`, the result the call with `era` beside it gave in 1.18. The documentation of the five functions no longer lists the two fields.
