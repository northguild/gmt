---
"@northguild/gmt": minor
---

GMT runs on `temporal-polyfill` in place of `@js-temporal/polyfill`. Every import is smaller, month arithmetic takes bounded time for any amount, and `Temporal`, `Intl` and `toTemporalInstant` are re-exported from `temporal-polyfill`. Two results and some type names change, and **Breaking changes** covers each.

| Measured with esbuild, minified ES modules | `@js-temporal/polyfill` 0.5.1 | `temporal-polyfill` 1.0.8 |
| --- | --- | --- |
| The polyfill alone, the floor of every import | 152.5 kB minified, 44.2 kB gzipped | 65.4 kB minified, 23.3 kB gzipped |
| The whole package (`import * from "@northguild/gmt"`) | 567.8 kB minified, 154.9 kB gzipped | 438.8 kB minified, 121.9 kB gzipped |

### Breaking changes

**1. `compareDurations` returns `0` for two durations with the same fields, even when adding them to `relativeTo` would go past Temporal's date range.** Temporal's `Duration.compare` answers `0` for these before any arithmetic. 1.21 returned `null` when `relativeTo` was in a calendar other than ISO 8601. Equal durations that stay in range gave `0` before and still do:

```typescript
import { compareDurations } from "@northguild/gmt";

compareDurations("P4294967295M", "P4294967295M", { relativeTo: "2024-01-15[u-ca=hebrew]" }); // 1.21: null. Now: 0
compareDurations("P1Y", "P1Y"); // 0 in both
```

Code that treated `null` from such a call as "equal" now checks for `0`:

```typescript
const same = compareDurations(a, b, { relativeTo }) === 0;
```

**2. `smallestUnit` no longer accepts `"minute"` or `"minutes"` at the type level** in `parseDuration`, and neither does `toStringSmallestUnit` in `DurationStringOptions`. The Temporal specification's `Duration#toString` takes `"second"` and smaller only. What these do at run time is unchanged, so only the type check fails:

```typescript
import { parseDuration } from "@northguild/gmt";

parseDuration("PT1M30.5S", { smallestUnit: "minute" }); // now a type error
parseDuration("PT1M30.5S", { smallestUnit: "second", roundingMode: "trunc" }); // "PT1M30S"
```

**3. Some `Temporal.*` type names change.** `Temporal` is re-exported from `temporal-polyfill`, whose types follow `temporal-spec`. GMT's own types (`DateTimeDurationUnit`, `RoundingOptions`, `Overflow`, `Disambiguation`, `Offset`, `NowUnit`, `UtcNowUnit` and the rest) keep their names and accept the same values. Code that names a `Temporal.*` type through `@northguild/gmt` changes as follows:

| 1.21 name | Now |
| --- | --- |
| `Temporal.DurationLike` (the fields object) | `Temporal.DurationLikeObject`. `Temporal.DurationLike` still exists but means `Duration \| DurationLikeObject \| string`, so `keyof Temporal.DurationLike` is no longer the unit names. |
| `Temporal.PlainDateLike`, `Temporal.PlainDateTimeLike`, `Temporal.PlainTimeLike`, `Temporal.ZonedDateTimeLike` (the fields objects) | `Temporal.DateLikeObject`, `Temporal.DateTimeLikeObject`, `Temporal.TimeLikeObject`, `Temporal.ZonedDateTimeLikeObject`. The old names still exist but now also take a Temporal object or a string. |
| `Temporal.SmallestUnit<U>`, `Temporal.LargestUnit<U>`, `Temporal.TotalUnit<U>` | `Temporal.PluralizeUnit<U>` (add `"auto"` for a largest unit) |
| `Temporal.PluralUnit<U>` | `Exclude<Temporal.PluralizeUnit<U>, U>` |
| `Temporal.DateTimeUnit` | `Temporal.DateUnit \| Temporal.TimeUnit` |
| `Temporal.RoundingMode` | `NonNullable<Temporal.RoundingOptions<Temporal.DateUnit \| Temporal.TimeUnit>["roundingMode"]>` |
| `Temporal.ArithmeticOptions`, `Temporal.ToInstantOptions`, `Temporal.ZonedDateTimeAssignmentOptions` | `Temporal.OverflowOptions`, `Temporal.DisambiguationOptions`, `Temporal.ZonedDateTimeFromOptions` |
| `Temporal.DifferenceOptions<U>`, `Temporal.RoundTo<U>`, `Temporal.DurationRoundTo`, `Temporal.DurationTotalOf` | `Temporal.RoundingOptionsWithLargestUnit<U>`, `Temporal.RoundingOptions<U>`, `Temporal.DurationRoundingOptions`, `Temporal.DurationTotalOptions` |
| `Temporal.ToStringPrecisionOptions` | `Temporal.DurationToStringOptions` (a duration) or `Temporal.ToStringRoundingOptionsWithFractionalSeconds<U>` |
| `Temporal.ComparisonResult` | `-1 \| 0 \| 1` |

The parameter types of these functions are printed with the new names. Each accepts the same values as before:

- `durationFromUnits`, `ttlFromNow`, `totalUnitsFromNow`, `formatHttpDateFromNow`, and the `add*`, `subtract*`, `get*Ago` and `get*In` functions of `datetime/`, `unix/`, `utc/` and `zoned/`: `Record<keyof Temporal.DurationLikeObject, number>`.
- `getDurationUnit`, `totalDuration`, `getLargestDateTimeDurationUnit`, `isValidDateTimeDurationUnit`, and the `diff*` and `diff*AsDuration` functions of `datetime/`, `unix/`, `utc/` and `zoned/`: `keyof Temporal.DurationLikeObject`.
- `setDate`, `setDateTime`, `setTime`, `setUnix`, `setUtc` and `setZoned`: the fields they take, every one optional, era fields left out as before.
- `parseDuration`: `roundingMode` lists the nine rounding modes.
- `convertPlainDateTimeToZoned` and `getZonedNow`: `smallestUnit` is `"minute"` through `"nanosecond"`, singular or plural.
