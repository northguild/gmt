# `@northguild/gmt-otel` — Refined Package Plan

> **A bridge between `@northguild/gmt` and OpenTelemetry for timezone-aware, nanosecond-precision observability.**

**Status:** Refined from initial hallucinated draft. All functions mapped to real gmt APIs.

---

## What the Original Plan Got Wrong

| Hallucination | Reality |
|---|---|
| `GMTDate`, `GMTDateTime` types | **Don't exist.** gmt is string-in, string-out. All inputs are ISO 8601 strings; outputs are strings, numbers, booleans, or arrays. |
| `GMTDate.now()` | Doesn't exist. Use `gmt/zoned getZonedNow()`, `gmt/utc getUtcNow()`, or `gmt/plain getNow()`. |
| `startSpan` / `endSpan` helpers | **Pure OTel concepts.** gmt has no span API. These would be gmt-otel additions that wrap `@opentelemetry/api` Span objects, using gmt for timestamp conversion. |
| `toUTC(GMTDate)` | Doesn't exist. Use `gmt/zoned convertZonedToUtc(zdtString)`. |
| `getTimezoneOffset('Europe/London', GMTDate)` | Doesn't exist. Use `gmt/zoned getTimeZoneOffset(timeZone, zdtString)`. |
| `getSpanLocalTime(span, 'Asia/Tokyo')` | Pure OTel concept. Would need to be built from scratch in gmt-otel using `convertZonedToZoned`. |
| "Zero dependencies" on OTel core | **Wrong.** This package's entire value is integrating with `@opentelemetry/api`. It must depend on it (as a peer dependency). |
| `<1KB bundle size` | Impossible with OTel API types + all conversion functions. Realistic: 8–15KB minified. |

---

## What Actually Exists in `@northguild/gmt` (v1.14.2)

### Timestamp Conversion Primitives (already exist, ready to re-export/wrap)

| gmt Function | Namespace | What It Does |
|---|---|---|
| `convertZonedToUnix(zdt)` | `gmt/zoned/convert` | ZonedDateTime string → Unix timestamp string |
| `convertUnixToZoned(ts, tz)` | `gmt/unix/convert` | Unix timestamp string → ZonedDateTime string |
| `convertUtcToUnix(dt)` | `gmt/utc/convert` | UTC datetime string → Unix timestamp string |
| `convertUnixToUtc(ts)` | `gmt/unix/convert` | Unix timestamp string → UTC datetime string |
| `convertZonedToUtc(zdt)` | `gmt/zoned/convert` | ZonedDateTime string → UTC datetime string |
| `convertUtcToZoned(dt, tz)` | `gmt/utc/convert` | UTC datetime string → ZonedDateTime string |
| `parseRfc3339(str)` | `gmt/zoned/parse` | RFC 3339 string → Instant (string) |
| `formatRfc3339(zdt)` | `gmt/zoned/format` | ZonedDateTime → RFC 3339 string |
| `parseDuration(str)` | `gmt/duration/parse` | ISO 8601 Duration string → Duration string |
| `formatDuration(dur)` | `gmt/duration/format` | Duration string → ISO 8601 string |
| `durationAs(dur, unit)` | `gmt/duration/calculate` | Duration → number in given unit |
| `getZonedNanosecond(zdt)` | `gmt/zoned/get` | Nanosecond field (0–999999999) |
| `getZonedMillisecond(zdt)` | `gmt/zoned/get` | Millisecond field (0–999) |
| `chopZonedMilliseconds(zdt)` | `gmt/zoned/chop` | Chop to millisecond precision |
| `chopZonedSeconds(zdt)` | `gmt/zoned/chop` | Chop to second precision |
| `getTimeZoneOffset(tz, zdt)` | `gmt/zoned/get` | UTC offset at a point in time |
| `getDstTransitions(tz, year)` | `gmt/zoned/get` | DST transition dates for a timezone |
| `hasDaylightSaving(tz)` | `gmt/zoned/validate` | Does a timezone have DST? |
| `isInDaylightSaving(zdt)` | `gmt/zoned/compare` | Is this point in DST? |
| `getSystemTimeZone()` | `gmt/zoned/get` | Current system timezone identifier |
| `getTimeZones()` | `gmt/zoned/get` | All IANA timezone identifiers |
| `isValidTimeZone(tz)` | `gmt/zoned/validate` | Is this a valid IANA timezone? |
| `formatTimeZoneName(tz)` | `gmt/zoned/format` | Display name for a timezone |

### Temporal Polyfill (re-exported from root)

The root entry point re-exports all `@js-temporal/polyfill` symbols:
- `Temporal.ZonedDateTime`, `Temporal.Instant`, `Temporal.Duration`, `Temporal.TimeZone`
- `Temporal.PlainDateTime`, `Temporal.PlainDate`, `Temporal.PlainTime`
- All `*Like` interfaces, `RoundingMode`, etc.

### gmt's Core Contract (non-negotiable)

1. **String-in, string-out.** Public APIs accept ISO 8601 strings; return strings, numbers, booleans, or arrays.
2. **No `Date` object anywhere.** Use `@js-temporal/polyfill` exclusively.
3. **Invalid input returns a sentinel, never throws.** `""` for strings, `null` for numbers, `false` for booleans, `[]` for arrays.
4. **Wrap all Temporal calls in `try-catch`.** `.from()`, `.add()`, `.since()`, etc. throw `RangeError` on bad input.

---

## What gmt-otel Actually Needs to Build

### Tier 1: Timestamp Conversion (the core value)

OTel uses **nanosecond-precision timestamps** represented as `[seconds, nanoseconds]` tuples (called `TimeInput` in OTel's type system). gmt works with ISO 8601 strings. The bridge is:

| Function | Signature | Uses gmt |
|---|---|---|
| `toOtelTimestamp(zdt)` | `(zdt: string) => [number, number]` | `convertZonedToUnix` for seconds + nanosecond field extraction |
| `fromOtelTimestamp([s, ns], tz?)` | `(tuple: [number, number], tz?: string) => string` | Build ISO string from epoch, then `convertUnixToZoned` or `convertUnixToUtc` |
| `toOtelTimeInput(zdt)` | `(zdt: string) => [number, number]` | Same as `toOtelTimestamp` — OTel's `TimeInput` IS `[seconds, nanoseconds]` |
| `fromOtelTimeInput([s, ns], tz?)` | `(tuple: [number, number], tz?: string) => string` | Same as `fromOtelTimestamp` |
| `zdtToUnix(zdt)` | `(zdt: string) => string` | Direct re-export of `convertZonedToUnix` |
| `unixToZoned(ts, tz)` | `(ts: string, tz: string) => string` | Direct re-export of `convertUnixToZoned` |
| `utcToUnix(dt)` | `(dt: string) => string` | Direct re-export of `convertUtcToUnix` |
| `unixToUtc(ts)` | `(ts: string) => string` | Direct re-export of `convertUnixToUtc` |

### Tier 2: Timezone Intelligence (observability-specific)

| Function | Signature | Uses gmt |
|---|---|---|
| `getServerTimezone()` | `() => string` | Re-export of `getSystemTimeZone` |
| `getTimezoneOffset(tz, zdt)` | `(tz: string, zdt: string) => number` | Re-export of `getTimeZoneOffset` |
| `isInDst(zdt)` | `(zdt: string) => boolean` | Re-export of `isInDaylightSaving` |
| `getDstTransitions(tz, year)` | `(tz: string, year: number) => { start: string, end: string }[]` | Re-export of `getDstTransitions`, wrap output |
| `formatTimezoneName(tz)` | `(tz: string) => string` | Re-export of `formatTimeZoneName` |
| `listTimezones()` | `() => string[]` | Re-export of `getTimeZones` |
| `isValidTimezone(tz)` | `(tz: string) => boolean` | Re-export of `isValidTimeZone` |

### Tier 3: Duration Conversion

| Function | Signature | Uses gmt |
|---|---|---|
| `durationToNanoseconds(dur)` | `(dur: string) => number` | `durationAs(dur, 'nanosecond')` |
| `nanosecondsToDuration(ns)` | `(ns: number) => string` | Build ISO duration string from nanoseconds |
| `spanDurationMs(startZdt, endZdt)` | `(start: string, end: string) => number` | `diffZoned` with unit `'millisecond'` |

### Tier 4: OTel Span Integration (the "smart" layer)

These are **new** functions that wrap OTel's `Span` API using gmt for timestamp handling:

| Function | Signature | Notes |
|---|---|---|
| `setSpanTimezone(span, tz)` | `(span: Span, tz: string) => void` | Sets `semanticAttributes['gmt.timezone']` on the span |
| `getSpanTimezone(span)` | `(span: Span) => string \| undefined` | Reads `semanticAttributes['gmt.timezone']` |
| `setSpanStartZoned(span, zdt)` | `(span: Span, zdt: string) => void` | Converts zdt string → OTel TimeInput, sets span start time |
| `setSpanEndZoned(span, zdt)` | `(span: Span, zdt: string) => void` | Converts zdt string → OTel TimeInput, sets span end time |
| `getSpanDurationMs(span)` | `(span: Span) => number` | Computes duration from span start/end using gmt conversion |
| `createZonedSpan(tracer, name, zdt?, tz?)` | `(tracer: Tracer, name: string, zdt?: string, tz?: string) => Span` | Factory: creates a span with optional explicit start time and timezone attribute |

### Tier 5: Context Propagation (optional, advanced)

| Function | Signature | Notes |
|---|---|---|
| `setTimezoneInBaggage(timezone)` | `(tz: string) => void` | Sets timezone in OTel Baggage for cross-service propagation |
| `getTimezoneFromBaggage()` | `() => string \| undefined` | Reads timezone from OTel Baggage |
| `propagateTimezone(headers, tz)` | `(headers: Record<string, string>, tz: string) => void` | Injects `X-GMT-Timezone` header for HTTP propagation |

---

## Package Structure (Corrected)

```
packages/gmt-otel/
├── src/
│   ├── index.ts                    # Barrel export — all public APIs
│   ├── timestamps.ts               # Tier 1: toOtelTimestamp, fromOtelTimestamp, etc.
│   ├── timezones.ts                # Tier 2: getServerTimezone, isInDst, etc.
│   ├── durations.ts                # Tier 3: durationToNanoseconds, spanDurationMs
│   ├── spans.ts                    # Tier 4: setSpanTimezone, createZonedSpan
│   ├── baggage.ts                  # Tier 5: setTimezoneInBaggage, getTimezoneFromBaggage
│   └── types.ts                    # Shared type definitions (minimal — OTel types are peer-dep)
├── test/
│   ├── timestamps.test.ts
│   ├── timezones.test.ts
│   ├── durations.test.ts
│   ├── spans.test.ts
│   ├── baggage.test.ts
│   └── helpers.ts                  # Shared test utilities
├── package.json
├── tsconfig.json
├── tsconfig.build.json
├── vitest.config.ts
├── README.md
└── LICENSE
```

## Dependencies

```jsonc
{
  "dependencies": {
    "@northguild/gmt": "workspace:*"
  },
  "peerDependencies": {
    "@opentelemetry/api": "^1.9 || ^1.10"
  },
  "peerDependenciesMeta": {
    "@opentelemetry/api": {
      "optional": true   // Allow building without OTel installed; span/baggage functions gracefully degrade
    }
  },
  "devDependencies": {
    "@opentelemetry/api": "^1.9",       // For type checking and tests
    "@northguild/gmt": "workspace:*",
    "typescript": "^5.x",
    "vitest": "^3.x"
  }
}
```

**Key design decision:** OTel API is an **optional peer dependency**. The timestamp/timezone/duration tiers work with just `@northguild/gmt` and are useful even without OTel (e.g., for logging systems that use nanosecond timestamps). The span/baggage tiers require the OTel API at runtime.

---

## What This Package Does NOT Do

1. **No `GMTDate` or any custom date type.** gmt-otel works with ISO 8601 strings exclusively, just like gmt.
2. **No replacement for OTel's core SDK.** This is a thin bridge layer, not a tracing framework.
3. **No browser-specific code.** OTel JS SDK already handles browser compatibility.
4. **No performance monitoring of gmt itself.** That's a different concern.

---

## Comparison: Original Plan vs Refined Plan

| Aspect | Original (Hallucinated) | Refined (Grounded) |
|---|---|---|
| Custom date types | `GMTDate`, `ZonedDateTime`, `Instant` as custom types | All ISO 8601 strings; Temporal types via peer-dep or gmt re-export |
| Span helpers | 7 functions, all new | 6 functions, all wrapping OTel API + gmt conversions |
| Duration | 2 functions | 3 functions, one uses `diffZoned` |
| Context propagation | 3 functions with OTel `Context` | 3 functions using OTel `Baggage` (the actual propagation mechanism) |
| Dependencies | "Zero dependencies on OTel" | Optional peer dep on `@opentelemetry/api`; required dep on `@northguild/gmt` |
| Bundle size | "<1KB" (impossible) | 8–15KB minified (realistic with OTel types) |
| Reuses gmt APIs | Mostly no — invented `GMTDate` methods | **Yes — every function maps to an existing gmt API** |
| Test matrix | Not specified | Full locale matrix not needed (no locale-aware output); but needs full timezone coverage |
