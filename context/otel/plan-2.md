# GMT-OTel Integration Plan (Refined)

> **Status:** Refined from original draft. All `Date` objects removed. Custom `GMT` type removed. API realigned with `@northguild/gmt`'s string-in/string-out contract. Two-package split confirmed: `@northguild/gmt-time` (general) + `@northguild/gmt-otel` (thin OTel layer).
>
> **Audited against:** `context/otel/overview.md`, `context/otel/refined-plan.md`, `context/otel/tracker.md`, `context/otel/issues/`, and `packages/gmt/src/` (audit date: 2026-09-07).

---

## Problem Statement

OpenTelemetry JavaScript (OTel JS) and the OpenTelemetry Protocol (OTLP) face critical **datetime precision, timezone, and interoperability issues** due to JavaScript's native limitations. These issues directly impact the accuracy and reliability of telemetry data (traces, metrics, logs) in observability pipelines.

### Core Problems

#### 1. Precision Loss in Timestamps

- **Root Cause**: JavaScript's `number` type (IEEE 754 double) only safely represents integers up to 2^53. Nanosecond epoch timestamps (year 2026 ~ 1.8 x 10^18) exceed this, causing rounding errors in `hrTimeToNanoseconds` and similar OTel JS functions.
- **Impact**: Sub-millisecond accuracy lost; high-performance tracing inaccurate.
- **Evidence**: [opentelemetry-js#2643](https://github.com/open-telemetry/opentelemetry-js/issues/2643), [opentelemetry-js#3986](https://github.com/open-telemetry/opentelemetry-js/issues/3986)

#### 2. Timezone and Localization Gaps

- **Root Cause**: OTel JS lacks timezone-aware timestamp handling. Timestamps assume UTC/local with no explicit IANA zone attached to spans.
- **Impact**: Misaligned traces/metrics in global applications; no timezone display context for downstream consumers.
- **Evidence**: [opentelemetry-collector-contrib#32140](https://github.com/open-telemetry/opentelemetry-collector-contrib/issues/32140)

#### 3. Inconsistent Timestamp Representations

- **Root Cause**: OTel JS mixes `Date` objects, epoch milliseconds, `HrTime` tuples, and `performance.now()` without a unified, precision-preserving format.
- **Impact**: Interoperability issues between OTel SDKs (Java/Python expect nanoseconds; JS provides milliseconds).
- **Evidence**: [opentelemetry-js#19](https://github.com/open-telemetry/opentelemetry-js/issues/19)

> **Out of scope**: Clock drift / system sleep. Requires separate `@northguild/gmt-clock` package.

---

## Architecture: Two-Package Split

```
@js-temporal/polyfill ->  @northguild/gmt  ->  @northguild/gmt-time  ->  @northguild/gmt-otel
(internal)              (root, re-exports   (general, no OTel)         (re-exports + OTel helpers)
                          polyfill)
```

### `@northguild/gmt-time` -- General-purpose ISO 8601 <-> bigint conversion

**No OTel dependency.** Any industry: geospatial, scientific computing, IoT, finance, observability.

```json
{ "dependencies": { "@northguild/gmt": "workspace:*" } }
```

### `@northguild/gmt-otel` -- Thin OTel layer

**OTel-specific helpers.** Re-exports gmt-time, adds span/baggage/browser functions.

```json
{
  "dependencies": { "@northguild/gmt-time": "workspace:*" },
  "peerDependencies": { "@opentelemetry/api": "^1.9 || ^1.10" },
  "peerDependenciesMeta": { "@opentelemetry/api": { "optional": true } }
}
```

---

## What Was Wrong with the Original plan-2.md Draft (Superseded)

> The original plan-2.md was a 235-line hallucinated draft. Its content has been replaced by this refined version. The sections below document what was wrong in that original draft for historical reference.

### Violations of gmt's Core Contract

| Violation | Detail |
|---|---|
| **Custom `GMT` type** | Original invented `GMT { epochNanos: bigint; timezone: string }`. gmt is string-in/string-out. |
| **`Date` object inputs** | `gmtFromDate(date: Date)` and `gmtFromPerformanceNow(performance.now())` use `Date`-adjacent APIs. **Fully removed.** |
| **`Date` object outputs** | `gmtToDate(gmt: GMT): Date` returns a `Date` object. **Fully removed.** |
| **`luxon` dependency suggested** | gmt already has `zoned/format` -- no external date library needed. |
| **`Intl.DateTimeFormat` suggested** | gmt uses `@js-temporal/polyfill` exclusively. |

### Removed Methods (invented or duplicate)

| Removed | Reason |
|---|---|
| `gmtNow(options)` | gmt already provides `getZonedNow(timezone)` and `getUnixNow(unit)` |
| `gmtFromDate(date: Date)` | Uses `Date` -- violates no-`Date` rule |
| `gmtFromPerformanceNow(perfNow)` | Uses `performance.now()` -- not string-in |
| `gmtToDate(gmt: GMT)` | Returns `Date` -- violates no-`Date` rule |
| `gmtToISOString(gmt: GMT)` | Redundant -- gmt has `convertZonedToUtc`, `convertUtcToZoned` |
| `gmtToOTLPTimeUnixNano(gmt: GMT)` | Redundant -- OTLP `time_unix_nano` IS `toNanoseconds` |
| `gmtToOTLPTimeUnixNanoNumber(gmt: GMT)` | Lossy conversion -- anti-pattern |
| `gmtWithTimezone(gmt: GMT, tz)` | gmt already has `convertZonedToZoned(zdt, tz)` |
| `gmtToTimezoneString(gmt: GMT, format?)` | gmt already has `formatZonedDateTime` |
| `gmtParse(datetimeString, options)` | gmt already has `parseRfc3339`, `parseRfc2822` |
| `gmtIsValid(gmt: GMT)` | gmt already has `isValidZonedDateTime`, `isValidTimeZone` |
| `gmtCompare(a, b)` | gmt already has `zoned/compare` |
| `gmtDuration(start, end)` | gmt already has `diffZoned`, `diffUnix` |
| `gmtFromOTLPTimeUnixNano(nanos: bigint)` | Redundant with `fromNanoseconds` |

### Discrepancy: `zoned/fromISO` and `zoned/toISO` Do Not Exist

refined-plan.md and issue files reference `zoned/fromISO` and `zoned/toISO` as gmt APIs. After auditing `packages/gmt/src/zoned/`, **these functions do not exist**. The actual mechanism is:

- **Parsing**: `Temporal.ZonedDateTime.from(value)` / `Temporal.Instant.from(value)` via `@northguild/gmt` root (re-exports `@js-temporal/polyfill`), plus `isValidZonedDateTime(value)` for validation
- **Serialization**: `convertZonedToUtc`, `convertUtcToZoned`, `convertZonedToZoned`, `formatRfc3339`, `Temporal.Instant.fromEpochNanoseconds(ns).toString()`

Also: `convertZonedToUnix` returns `number | null` in **milliseconds** (or seconds) -- NOT nanoseconds. gmt-time's `toNanoseconds` must use `Temporal.ZonedDateTime.from(str).toInstant().epochNanoseconds` directly (bigint) for true nanosecond precision.

---

## What Ships (23 Methods)

### Tier 1: `@northguild/gmt-time` -- Timestamp Conversion (6 methods)

| # | Function | Signature | Returns | gmt API used |
|---|---|---|---|---|
| 1 | `toNanoseconds` | `(isoString: string) => bigint` | `bigint` | `isValidZonedDateTime` + `Temporal.ZonedDateTime.from` -> `.toInstant().epochNanoseconds` |
| 2 | `fromNanoseconds` | `(nanoseconds: bigint, timezone?: string) => string` | `string` | `Temporal.Instant.fromEpochNanoseconds` + `toZonedDateTimeISO` |
| 3 | `toNanosecondTuple` | `(isoString: string) => [number, number]` | `[number, number]` | Calls #1, splits bigint |
| 4 | `fromNanosecondTuple` | `(tuple: [number, number], timezone?: string) => string` | `string` | Calls #2, reconstructs bigint |
| 5 | `toDurationNanoseconds` | `(durationString: string) => number` | `number` | `durationAs` from `gmt/duration/calculate` |
| 6 | `fromDurationNanoseconds` | `(nanoseconds: number) => string` | `string` | `Temporal.Duration.from({ nanoseconds })` |

### Tier 2: `@northguild/gmt-otel` -- Re-exports + Aliases (10 re-exports)

| # | Function | Signature | Re-exported from |
|---|---|---|---|
| 7 | `toNanoseconds` | `(isoString: string) => bigint` | gmt-time |
| 8 | `fromNanoseconds` | `(nanoseconds: bigint, timezone?: string) => string` | gmt-time |
| 9 | `toNanosecondTuple` | `(isoString: string) => [number, number]` | gmt-time |
| 10 | `fromNanosecondTuple` | `(tuple: [number, number], timezone?: string) => string` | gmt-time |
| 11 | `toDurationNanoseconds` | `(durationString: string) => number` | gmt-time |
| 12 | `fromDurationNanoseconds` | `(nanoseconds: number) => string` | gmt-time |
| 13 | `isoToHrTime` | `(isoString: string) => [number, number]` | Alias: `toNanosecondTuple` |
| 14 | `hrTimeToISO` | `(tuple: [number, number], timezone?: string) => string` | Alias: `fromNanosecondTuple` |
| 15 | `isoToNanos` | `(isoString: string) => bigint` | Alias: `toNanoseconds` |
| 16 | `nanosToISO` | `(nanoseconds: bigint, timezone?: string) => string` | Alias: `fromNanoseconds` |

### Tier 3: `@northguild/gmt-otel` -- Span Helpers (3 methods)

| # | Function | Signature | Returns | gmt API used |
|---|---|---|---|---|
| 17 | `setSpanTimezone` | `(span: Span, timezone: string) => void` | void | `isValidTimeZone` + `span.setAttribute()` |
| 18 | `getSpanTimezone` | `(span: Span) => string \| undefined` | `string \| undefined` | Pure OTel: `span.attributes` |
| 19 | `withTimezoneSpan` | `(tracer: Tracer, name: string, options?: { timezone?: string, attributes?: SpanAttributes }) => Span` | `Span` | `isValidTimeZone` + `tracer.startSpan()` + `setSpanTimezone` |

### Tier 4: `@northguild/gmt-otel` -- Baggage Helpers (3 methods)

| # | Function | Signature | Returns | gmt API used |
|---|---|---|---|---|
| 20 | `setTimezoneInBaggage` | `(context: Context, timezone: string) => Context` | `Context` | `isValidTimeZone` + OTel baggage API |
| 21 | `getTimezoneFromBaggage` | `(context: Context) => string \| undefined` | `string \| undefined` | Pure OTel: baggage API |
| 22 | `propagateTimezone` | `(carrier: Record<string, string>, timezone: string) => void` | void | `isValidTimeZone` + OTel `propagation.inject` |

### Tier 5: `@northguild/gmt-otel` -- Browser Utility (1 method)

| # | Function | Signature | Returns | gmt API used |
|---|---|---|---|---|
| 23 | `getBrowserTimezone` | `() => string` | `string` | Direct re-export: `getSystemTimeZone` from `gmt/zoned/get` |

---

## Method Audit: Re-export vs. Wrapper vs. New

| Layer | Direct re-exports | Thin wrappers | Genuinely new |
|---|---|---|---|
| gmt-time | 0 | 6 | 0 |
| gmt-otel | 7 (6 gmt-time + 1 gmt + 4 aliases) | 0 | 7 (3 span + 3 baggage + 1 browser) |

**gmt-time**: 4 methods use Temporal directly (not gmt wrapper functions) because gmt's `convertZonedToUnix` only returns `number` in ms/s -- it cannot handle `bigint` nanosecond precision. 2 methods wrap gmt's `durationAs`. No date/time arithmetic is re-implemented.

**gmt-otel**: 7 new methods. 1 is a direct gmt re-export (`getBrowserTimezone`). 2 are pure OTel with zero gmt dependency (`getSpanTimezone`, `getTimezoneFromBaggage`). 4 compose OTel API calls with gmt's `isValidTimeZone` validation.

---

## Naming Rationale: No Prefix

**No `gmt` prefix** (original plan was wrong), **no `otel`/`otlp` prefix** (package context + embedded OTel terminology suffice).

### Why no prefix works

1. **Zero name clashes** -- grep across `packages/gmt/src/` confirms none of our 23 function names exist in gmt's exported API.
2. **Package context provides disambiguation** -- `import { toNanoseconds } from "@northguild/gmt-time"` is unambiguous. Same pattern OTel JS uses.
3. **Function names embed OTel terminology**:

| Name | Embedded OTel term | Recognizable as? |
|---|---|---|
| `isoToHrTime` | `HrTime` | OTel's `[seconds, nanoseconds]` tuple |
| `hrTimeToISO` | `HrTime` | Inverse of `timeInputToHrTime()` |
| `isoToNanos` | `nanos` | OTLP's `time_unix_nano` |
| `setSpanTimezone` | `Span` | OTel `Span` object |
| `withTimezoneSpan` | `Span` | OTel `Span` creation |
| `setTimezoneInBaggage` | `Baggage` | OTel `Baggage` API |
| `propagateTimezone` | `propagate` | OTel `propagation` API |

If a prefix is absolutely required, `otel` is the only viable choice (broader than `otlp` which is protocol-only). But `otelToNanoseconds`, `otelSetSpanTimezone` etc. add 3 redundant words per call when the package name already says `gmt-otel`.

---

## What Already Exists in `@northguild/gmt` (Do Not Re-implement)

| What you need | Where it lives |
|---|---|
| Current timestamp (zoned) | `gmt/zoned/getZonedNow(timezone, options?)` |
| Current timestamp (unix epoch) | `gmt/unix/getUnixNow(unit?)` |
| Zoned -> epoch ms | `gmt/zoned/convertZonedToUnix(zdt, unit?)` |
| Epoch -> zoned | `gmt/unix/convertUnixToZoned(epoch, tz, unit?)` |
| Zoned -> UTC | `gmt/zoned/convertZonedToUtc(zdt)` |
| UTC -> zoned | `gmt/utc/convertUtcToZoned(utcStr, tz)` |
| Timezone conversion | `gmt/zoned/convertZonedToZoned(zdt, tz)` |
| Timezone validation | `gmt/zoned/isValidTimeZone(tz)` |
| DST transitions | `gmt/zoned/getDstTransitions(tz, year)` |
| DST check | `gmt/zoned/isInDaylightSaving(zdt)` |
| System timezone | `gmt/zoned/getSystemTimeZone()` |
| Duration to unit | `gmt/duration/durationAs(dur, unit, options?)` |
| Timestamp diff | `gmt/zoned/diffZoned` / `gmt/unix/diffUnix` |
| RFC 3339 parse | `gmt/zoned/parseRfc3339(str)` |
| Temporal polyfill | `@northguild/gmt` root re-exports `@js-temporal/polyfill` |

**Rule**: Neither package re-implements date/time logic. They convert between worlds (ISO <-> bigint, span <-> timezone metadata).

---

## Error Handling Strategy

| Layer | Invalid input | Rationale |
|---|---|---|
| `@northguild/gmt` | Sentinels (`""`, `null`, `false`, `[]`) | gmt core contract -- never throws |
| `@northguild/gmt-time` | Throws `RangeError` | Thin bridge -- callers expect errors |
| `@northguild/gmt-otel` (span/baggage) | `RangeError` for invalid tz; `TypeError` if OTel API missing | Optional peer dep degrades gracefully |

```typescript
// Pattern: call Temporal, detect failure, throw RangeError
function toNanoseconds(isoString: string): bigint {
  try {
    if (isValidZonedDateTime(isoString)) {
      return Temporal.ZonedDateTime.from(isoString).toInstant().epochNanoseconds;
    }
    return Temporal.Instant.from(isoString).epochNanoseconds;
  } catch {
    throw new RangeError(`Invalid ISO 8601 datetime: ${isoString}`);
  }
}
```

---

## Precision Details

### Why `BigInt` for nanosecond timestamps

JavaScript `Number` safely represents integers up to 2^53 - 1 ~ 9.0 x 10^15. A nanosecond epoch timestamp for year 2255 exceeds this. `Temporal.Instant.epochNanoseconds` returns `bigint` -- no precision loss.

### Precision preserved

| Conversion | Mechanism | Precision |
|---|---|---|
| ISO string -> nanoseconds | `Temporal.ZonedDateTime.from(str).toInstant().epochNanoseconds` | Full nanosecond |
| Nanoseconds -> ISO string | `Temporal.Instant.fromEpochNanoseconds(ns).toString()` | Full nanosecond |
| Tuple [seconds, nanos] | Split from bigint: `ns / 1e9n`, `ns % 1e9n` | Full nanosecond in nanos field |

### Precision lossy (by design)

| Conversion | Limitation | Mitigation |
|---|---|---|
| `toNanosecondTuple` (seconds field) | `seconds: number` -- exceeds 2^53 at year ~285,000 | Acceptable |
| `toDurationNanoseconds` | Returns `number` -- limited to 2^53 ns ~ 104 days | Documented; use `durationAs` directly for longer |

---

## What These Packages Do NOT Do

1. **Do not replace OTel span creation.** Use `tracer.startSpan()` or `withTimezoneSpan`.
2. **Do not re-implement timezone formatting.** Use `@northguild/gmt/zoned/format`.
3. **Do not provide a logging layer.** They attach metadata to existing spans.
4. **Do not handle timezones in OTel's internal storage.** OTel stores absolute nanoseconds; these packages add timezone as a hint attribute only.
5. **Do not provide monotonic clocks.** Requires separate `@northguild/gmt-clock`.
6. **Do not accept `Date` objects.** Everything is ISO 8601 strings.

---

## Implementation Roadmap

| Phase | Package | Deliverable | Stories |
|---|---|---|---|
| Phase 1 | gmt-time | Package skeleton + timestamp conversion + tests | GMTIME-A1, A2, A3, A4 |
| Phase 2 | gmt-time | Duration conversion + tests | GMTIME-B1, B2 |
| Phase 3 | gmt-otel | Package skeleton + re-export gmt-time | OTEL-A1, A2 |
| Phase 4 | gmt-otel | Span timezone helpers + tests | OTEL-B1, B2 |
| Phase 5 | gmt-otel | Baggage propagation + tests | OTEL-C1, C2 |
| Phase 6 | gmt-otel | Browser utility + README/LICENSE/CI | OTEL-D1, D2 |

Build order and dependencies are in [tracker.md](tracker.md).

---

## Example Usage

### Basic Timestamp Conversion (gmt-time)

```typescript
import { toNanoseconds, fromNanoseconds, toNanosecondTuple } from "@northguild/gmt-time";

const zoned = "2024-04-05T12:34:56.789012345-04:00[America/New_York]";
const ns = toNanoseconds(zoned); // 1712345678901234567n
const iso = fromNanoseconds(ns, "America/New_York");
const tuple = toNanosecondTuple(zoned); // [1712345678, 901234567]
```

### Duration Conversion (gmt-time)

```typescript
import { toDurationNanoseconds, fromDurationNanoseconds } from "@northguild/gmt-time";

const ns = toDurationNanoseconds("PT1H30M"); // 5400000000000
const iso = fromDurationNanoseconds(ns); // "PT1H30M"
```

### Span Timezone (gmt-otel)

```typescript
import { withTimezoneSpan } from "@northguild/gmt-otel";

const span = withTimezoneSpan(tracer, "my-operation", { timezone: "America/New_York" });
```

### Baggage Propagation (gmt-otel)

```typescript
import { propagateTimezone } from "@northguild/gmt-otel";

const headers: Record<string, string> = {};
propagateTimezone(headers, "Europe/Helsinki");
```

### OTLP Timestamp (precision-safe, no Date)

```typescript
import { isoToNanos } from "@northguild/gmt-otel";

const ns = isoToNanos("2024-04-05T12:34:56.789012345Z"); // 1712345678901234567n (BigInt)
```

### OTel HrTime Tuple (precision-safe)

```typescript
import { isoToHrTime, hrTimeToISO } from "@northguild/gmt-otel";

const tuple = isoToHrTime("2024-04-05T12:34:56.789012345Z"); // [1712345678, 901234567]
const iso = hrTimeToISO(tuple, "America/New_York"); // "2024-04-05T08:34:56.789012345-04:00[America/New_York]"
```

---

## Success Metrics

1. **Precision**: `toNanoseconds` uses `Temporal.Instant.epochNanoseconds` (bigint) -- no rounding errors in OTLP `time_unix_nano`.
2. **Timezone Support**: `setSpanTimezone` + `propagateTimezone` attach IANA timezone metadata.
3. **No Date objects**: Zero `Date` usage anywhere. All inputs are ISO 8601 strings.
4. **Zero OTel dependency in gmt-time**: Builds and tests pass without `@opentelemetry/api` installed.

---

## Open Questions (Resolved)

| Question | Resolution |
|---|---|
| Should `GMT` objects be custom types? | **No.** String-in/string-out. ISO strings only. |
| Should we support `Temporal.Instant` as input? | **No** -- public API takes ISO strings. |
| Should `gmt-otel` be a separate package? | **Yes** -- two packages: `gmt-time` (general) + `gmt-otel` (OTel layer). |
| How to handle environments without `BigInt`? | **Not supported.** Node >= 22.12. |
| Should we re-implement `Date`-to-timestamp conversion? | **No.** Consumers pass ISO strings; `.toISOString()` first if they have a `Date`. |
| Should we prefix with `otel`/`otlp`? | **No.** Package context + embedded OTel terminology suffice. Zero name clashes. |

---

## References

- [OpenTelemetry JS GitHub](https://github.com/open-telemetry/opentelemetry-js)
- [OTLP Specification](https://opentelemetry.io/docs/specs/otlp/)
- [Temporal API Proposal](https://tc39.es/proposal-temporal/)
- [opentelemetry-js#2643](https://github.com/open-telemetry/opentelemetry-js/issues/2643)
- [opentelemetry-js#3986](https://github.com/open-telemetry/opentelemetry-js/issues/3986)
- [overview.md](overview.md) -- two-package split spec
- [tracker.md](tracker.md) -- story breakdown and build order
- Issue files: [`GMTIME-A.md`](issues/GMTIME-A.md), [`GMTIME-B.md`](issues/GMTIME-B.md), [`OTEL-A.md`](issues/OTEL-A.md), [`OTEL-B.md`](issues/OTEL-B.md), [`OTEL-C.md`](issues/OTEL-C.md), [`OTEL-D.md`](issues/OTEL-D.md)
- [`packages/gmt/src/`](../../../packages/gmt/src) -- audited 2026-09-07
