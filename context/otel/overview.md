# `@northguild/gmt-time` + `@northguild/gmt-otel` Package Plan

> **gmt-time**: general-purpose ISO 8601 ↔ nanosecond conversion (no OTel dependency).
> **gmt-otel**: thin OpenTelemetry layer on top of gmt-time for timezone-aware observability.

---

## What This Plan Is (and Isn't)

This is a **package plan**, not a Dox story. It defines two new published packages:

1. **`@northguild/gmt-time`** — general-purpose timestamp conversion. No OTel dependency.
   Any industry can use this: geospatial, scientific computing, IoT, finance, observability.
2. **`@northguild/gmt-otel`** — thin OpenTelemetry layer on top of gmt-time. Adds span
   timezone helpers and baggage propagation for timezone-aware observability.

Neither is part of the Dox epic. If/when these packages ship, their documentation lives in
their own READMEs, not in `apps/dox`.

---

## What the Original Plan Got Wrong

The original draft was generated without access to the actual `@northguild/gmt` source. Here are the key hallucinations:

1. **`GMTDate` does not exist.** `@northguild/gmt` is string-in, string-out. There is no `Date`-like object anywhere in the public API. Users pass ISO 8601 strings and get back ISO 8601 strings (or numbers, booleans, arrays). The polyfill (`@js-temporal/polyfill`) is an internal implementation detail.

2. **`ZonedDateTime` and `Instant` are not user-facing types.** They are Temporal types from the polyfill, used internally by gmt but never exported. The public API works with strings like `"2024-06-01T15:00:00+03:00"`.

3. **Most "timezone utilities" already exist in gmt.** Functions like `getDstTransitions`, `getWeekOfYear`, locale-aware formatting, and timezone conversion are all in `@northguild/gmt/zoned` and `@northguild/gmt/utc`. There is no need to re-implement them.

4. **Span helpers (`startSpan`, `endSpan`) are pure OTel concepts.** gmt-otel would not create its own span objects — it would wrap `@opentelemetry/api`'s `trace.startSpan()` and set attributes on the returned `Span`. The original plan's `startSpan`/`endSpan` signatures were invented from scratch with no basis in either OTel's API or gmt's design.

5. **`toISOString`/`fromISOString` already exist.** `@northguild/gmt/plain/toISO`, `@northguild/gmt/zoned/toISO`, etc. are the real functions. gmt-otel should not re-export them — it should focus on the OTel bridge.

6. **Everything was OTel-specific.** The original plan named all functions `toOtel*` and returned OTel-specific types (`bigint` nanoseconds, `[number, number]` tuples). This made the timestamp conversion unusable outside OTel — but ISO ↔ nanosecond conversion is a general-purpose need (PostGIS, GeoJSON, scientific computing, IoT, finance, any distributed system with clock skew).

---

## The Two-Package Split

### `@northguild/gmt-time` — General-purpose timestamp conversion

**No OTel dependency.** Pure gmt ↔ nanosecond bridge. Anyone can use this.

```
ISO 8601 string ──────────────────► Nanosecond precision
    ▲                                  │
    │                                  ▼
    │                          Any system that needs
    │                          nanosecond timestamps:
    │                          • PostGIS ST_MakePointM
    │                          • GeoJSON Point + time
    │                          • Scientific data (NetCDF, HDF5)
    │                          • IoT device telemetry
    │                          • Financial tick data
    │                          • OpenTelemetry (gmt-otel uses this)
    │
    └── gmt-time provides the bridge
```

**Dependencies:** `@northguild/gmt` (workspace:*) only. No OTel.

### `@northguild/gmt-otel` — Thin OTel layer on top of gmt-time

**OTel-specific helpers.** Re-exports everything from gmt-time, adds span/baggage functions.

```
@northguild/gmt-time  ──►  @northguild/gmt-otel
(general)              │   (re-exports + OTel wrappers)
                       │
                       ├── setSpanTimezone(span, tz)
                       ├── getTimezoneFromBaggage(context)
                       └── withTimezoneSpan(tracer, name, options)
```

**Dependencies:** `@northguild/gmt-time` (workspace:*) + optional peer `@opentelemetry/api`.

---

## What gmt Already Provides (Do Not Re-implement in Either Package)

| What the original plan wanted | Where it already lives in `@northguild/gmt` |
|-------------------------------|---------------------------------------------|
| `toISOString` / `fromISOString` | `plain/toISO`, `zoned/toISO`, `utc/toISO` — string-in, string-out |
| `toUTC` / `toZonedDateTime` | `zoned/fromISO`, `utc/fromISO`, `zoned.convert` |
| `formatInTimezone` | `zoned/format` — accepts format string, returns string |
| `getTimezoneOffset` | `zoned/offset` — returns offset string like `"+03:00"` |
| `isValidTimezone` | `zoned/fromISO` returns sentinel `""` on invalid timezone |
| `isDSTTransition` | `zoned/getDstTransitions` — returns array of transition dates |
| `getCurrentTimezone` | Not in gmt (browser-only concept) — gmt-otel can add this as a browser utility |
| Duration formatting | `duration/format` — string-in, string-out |

**Rule:** Neither package re-implements date/time logic. They convert between worlds; they do not compute dates.

---

## Package Structures

### `packages/gmt-time/`

```
packages/
  gmt-time/
    src/
      index.ts              # Public exports (all functions)
      timestamps.ts         # toNanoseconds, fromNanoseconds, toNanosecondTuple, fromNanosecondTuple
      durations.ts          # toDurationNanoseconds, fromDurationNanoseconds
    test/
      timestamps.test.ts
      durations.test.ts
    package.json
    tsconfig.json
    tsconfig.build.json
    vitest.config.ts
    README.md
    LICENSE
```

**No `types.ts` file.** All types are ISO strings (`string`), bigint, number, or tuples.

**No `iso.ts` file.** ISO parsing/serialization is gmt's job.

**No `validation.ts` file.** Validation is gmt's job — invalid input returns sentinels.

### `packages/gmt-otel/`

```
packages/
  gmt-otel/
    src/
      index.ts              # Re-exports from gmt-time + OTel-specific exports
      span-timezone.ts      # setSpanTimezone, getSpanTimezone, withTimezoneSpan
      context.ts            # setTimezoneInBaggage, getTimezoneFromBaggage, propagateTimezone
      browser.ts            # getCurrentBrowserTimezone (browser-only, conditional export)
    test/
      span-timezone.test.ts
      context.test.ts
      browser.test.ts
    package.json
    tsconfig.json
    tsconfig.build.json
    vitest.config.ts
    README.md
    LICENSE
```

**No `timestamps.ts` file.** gmt-otel re-exports from gmt-time.

**No `durations.ts` file.** gmt-otel re-exports from gmt-time.

---

## Public API

### `@northguild/gmt-time` (general, no OTel)

#### Timestamp Conversion

| Function | Signature | Returns | Description |
|----------|-----------|---------|-------------|
| `toNanoseconds` | `(isoString: string) => bigint` | Nanosecond timestamp since Unix epoch | Converts any ISO 8601 string (plain, zoned, or UTC) to nanoseconds. Throws `RangeError` on invalid input. |
| `fromNanoseconds` | `(nanoseconds: bigint, timezone?: string) => string` | ISO 8601 string | Converts nanosecond timestamp to an ISO string. If `timezone` is provided, the result is in that timezone; otherwise UTC. Throws on invalid input. |
| `toNanosecondTuple` | `(isoString: string) => [number, number]` | `[seconds, nanoseconds]` tuple | Converts ISO string to a `[seconds, nanoseconds]` tuple (for systems that prefer tuples over bigint). |
| `fromNanosecondTuple` | `(tuple: [number, number], timezone?: string) => string` | ISO 8601 string | Converts a `[seconds, nanoseconds]` tuple back to ISO string. |

#### Duration Conversion

| Function | Signature | Returns | Description |
|----------|-----------|---------|-------------|
| `toDurationNanoseconds` | `(durationString: string) => number` | Nanoseconds as number | Converts a gmt-style duration string (e.g., `"PT1H30M"`) to nanoseconds. |
| `fromDurationNanoseconds` | `(nanoseconds: number) => string` | ISO 8601 duration | Converts nanoseconds back to an ISO 8601 duration string. |

### `@northguild/gmt-otel` (OTel-specific, re-exports gmt-time)

#### Re-exports from gmt-time

All functions from `@northguild/gmt-time` are re-exported from `@northguild/gmt-otel`:

```typescript
export * from '@northguild/gmt-time';
// Consumers can use toNanoseconds, fromNanoseconds, etc. directly
```

#### Span Timezone Helpers

| Function | Signature | Returns | Description |
|----------|-----------|---------|-------------|
| `setSpanTimezone` | `(span: Span, timezone: string) => void` | — | Sets the `gmt.timezone` attribute on an OTel span. |
| `getSpanTimezone` | `(span: Span) => string \| undefined` | IANA timezone or undefined | Reads the `gmt.timezone` attribute from a span. |
| `withTimezoneSpan` | `(tracer: Tracer, name: string, options?: { timezone?: string, attributes?: SpanAttributes }) => Span` | OTel Span | Starts a span and immediately sets its timezone attribute. Convenience wrapper around `tracer.startSpan()` + `setSpanTimezone`. |

#### Context / Baggage Helpers

| Function | Signature | Returns | Description |
|----------|-----------|---------|-------------|
| `setTimezoneInBaggage` | `(context: Context, timezone: string) => Context` | New context | Sets `gmt-timezone` key in OTel baggage for propagation. |
| `getTimezoneFromBaggage` | `(context: Context) => string \| undefined` | IANA timezone or undefined | Reads `gmt-timezone` from baggage. |
| `propagateTimezone` | `(carrier: Record<string, string>, timezone: string) => void` | — | Injects `gmt-timezone` header into a carrier (e.g., HTTP headers) for cross-service propagation via W3C baggage. |

#### Browser Utility

| Function | Signature | Returns | Description |
|----------|-----------|---------|-------------|
| `getCurrentBrowserTimezone` | `() => string` | IANA timezone | Returns `Intl.DateTimeFormat().resolvedOptions().timeZone`. Browser-only — conditionally exported so bundlers can tree-shake it in Node. |

---

## Dependencies

### `@northguild/gmt-time`

```json
{
  "dependencies": {
    "@northguild/gmt": "workspace:*"
  }
}
```

**Only one dependency:** `@northguild/gmt`. No OTel. No polyfill needed (gmt provides it transitively).

### `@northguild/gmt-otel`

```json
{
  "dependencies": {
    "@northguild/gmt-time": "workspace:*"
  },
  "peerDependencies": {
    "@opentelemetry/api": "^1.9.0"
  }
}
```

**One real dependency:** `@northguild/gmt-time`. OTel is an optional peer (the consumer already has it if they're using gmt-otel).

---

## What These Packages Do NOT Do

- **Do not replace OTel span creation.** Consumers still call `tracer.startSpan()` directly or use `withTimezoneSpan` as a convenience wrapper. Neither package manages span lifecycles.
- **Do not re-implement date formatting.** Use `@northguild/gmt/zoned/format` for that.
- **Do not provide a logging layer.** They attach metadata to existing OTel spans/logs; they do not create loggers.
- **Do not handle timezones in OTel's internal storage.** OTel stores everything as absolute nanoseconds. These packages only add timezone as a *hint* attribute for downstream consumers.
- **Do not work with `Date` objects.** There are no `Date` inputs or outputs. Everything is ISO strings.

---

## Implementation Roadmap (Phases → Stories)

### Phase 1 — `@northguild/gmt-time`: Core timestamp conversion (MVP)

The absolute minimum: convert between ISO 8601 strings and nanosecond precision. No OTel.

- **GMTIME-A1** — Package skeleton for `@northguild/gmt-time`
- **GMTIME-A2** — `toNanoseconds` + `fromNanoseconds` (bigint nanoseconds)
- **GMTIME-A3** — `toNanosecondTuple` + `fromNanosecondTuple` (tuple format)
- **GMTIME-A4** — Tests for timestamp conversion (round-trip, edge cases)

### Phase 2 — `@northguild/gmt-time`: Duration conversion

- **GMTIME-B1** — `toDurationNanoseconds` + `fromDurationNanoseconds`
- **GMTIME-B2** — Tests for duration conversion

### Phase 3 — `@northguild/gmt-otel`: Skeleton + re-exports

Thin OTel layer that re-exports everything from gmt-time.

- **OTEL-A1** — Package skeleton for `@northguild/gmt-otel` (depends on gmt-time)
- **OTEL-A2** — Re-export all of gmt-time + OTel-specific aliases

### Phase 4 — `@northguild/gmt-otel`: Span timezone helpers

- **OTEL-B1** — `setSpanTimezone` + `getSpanTimezone` + `withTimezoneSpan`
- **OTEL-B2** — Tests for span helpers

### Phase 5 — `@northguild/gmt-otel`: Context / baggage propagation

- **OTEL-C1** — `setTimezoneInBaggage` + `getTimezoneFromBaggage` + `propagateTimezone`
- **OTEL-C2** — Tests for context propagation

### Phase 6 — Browser utility + polish

- **OTEL-D1** — `getCurrentBrowserTimezone` (conditional export)
- **OTEL-D2** — README, LICENSE, final integration tests, CI wiring for both packages

---

## Testing Strategy

Every function follows gmt's conventions:

1. **Round-trip tests.** `fromNanoseconds(toNanoseconds(iso)) === iso` for valid inputs.
2. **Invalid input throws.** Both packages are thin bridges — they do not use sentinels. Invalid ISO strings throw `RangeError`.
3. **Edge cases.** Epoch, max safe nanoseconds, DST transition boundaries, leap seconds (if applicable).
4. **Integration with real OTel.** Spin up a no-op tracer, create spans, verify attributes are set correctly (gmt-otel only).
5. **gmt-time has zero OTel dependency.** Its tests pass without OTel installed.
6. **gmt-otel works without OTel installed.** Span/baggage functions throw a clear `TypeError` at runtime if OTel is not available.

---

## CI / Monorepo Integration

- Both packages live in `packages/` alongside the other gmt packages.
- Included in the root `pnpm-workspace.yaml` and `package.json` workspaces array.
- Each gets automatic `lint`, `test`, `typecheck`, and `build` targets from the root Vitest config (add to workspace glob).
- Both follow the repo's changeset convention for version bumps.
- The 20-cell GMT timezone matrix test runs against `packages/gmt` only — neither new package perturbs it.
