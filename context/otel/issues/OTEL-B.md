# OTEL-B — Span timezone helpers

**Audited 2026-09-01.** All functions wrap OTel's `Span` API using gmt-time for timestamp handling. No invented types. See [overview.md](../overview.md) for the full corrected spec.

Each story below is one logical unit; its sub-stories are nested under it and ordered as
they should be built. The issue stays open until its last sub-story lands.

## Definition of done — binding for every story in this file

- `pnpm nx run-many -t lint test typecheck build` stays green, **including the 20-cell
  GMT timezone matrix**. `packages/gmt-otel` must not perturb `packages/gmt`.
- **Changesets required.** `@northguild/gmt-otel` is published to npm, so every story
  that modifies source needs a `.changeset/*.md` entry.
- No `Date` object anywhere. All inputs are ISO 8601 strings; outputs are strings, numbers,
  booleans, or arrays.
- Wrap all Temporal calls in `try-catch`. Bad input returns sentinels, never throws.
- OTel API is an optional peer dependency — span functions check for it at runtime and
  throw a clear `TypeError` if not found.

---

### OTEL-B1 — Span timezone helpers (`setSpanTimezone` + `getSpanTimezone` + `withTimezoneSpan`)

**Title:**

```
OTEL-B1 Implement span timezone helpers: setSpanTimezone, getSpanTimezone, withTimezoneSpan
```

**Description:**

```
Part of the gmt-time + gmt-otel epic — see `context/otel/overview.md`, Phase 4.
Depends on OTEL-A2 (re-export gmt-time) and GMTIME-A2 (timestamp conversion).

## Gap
OTel spans have no concept of timezone — they store absolute nanosecond timestamps.
We need helpers to attach IANA timezone metadata to spans so downstream tools can display
span times in the user's local timezone.

## Scope
- `src/span-timezone.ts`:
  - `setSpanTimezone(span: Span, timezone: string): void` — sets the `gmt.timezone`
    attribute on an OTel span. Validates timezone via `@northguild/gmt/zoned/validate`
    (`isValidTimeZone`) and throws `RangeError` if invalid.
  - `getSpanTimezone(span: Span): string | undefined` — reads the `gmt.timezone`
    attribute from a span. Returns `undefined` if not set.
  - `withTimezoneSpan(tracer: Tracer, name: string, options?: { timezone?: string, attributes?: SpanAttributes }): Span` —
    convenience wrapper around `tracer.startSpan()` + `setSpanTimezone`. Starts a span and
    immediately sets its timezone attribute if provided.
- All functions check for `@opentelemetry/api` at runtime and throw a clear `TypeError`
  if not found (OTel is an optional peer dependency).

## What gmt-time provides (do not re-implement)
- Timestamp conversion from gmt-time: `toNanoseconds`, `fromNanoseconds` for any timestamp-related operations.
- `zoned/validate` — `isValidTimeZone(tz)` validates IANA timezone strings.

## Verification
- `setSpanTimezone` + `getSpanTimezone` round-trip: setting then reading returns the same value
- Invalid timezone throws `RangeError`
- `withTimezoneSpan` creates a span with the timezone attribute set
- Missing OTel API throws clear `TypeError` at runtime (not build time)
```

---

### OTEL-B2 — Span timezone helper tests

**Title:**

```
OTEL-B2 Add comprehensive tests for span timezone helpers
```

**Description:**

```
Part of the gmt-time + gmt-otel epic — see `context/otel/overview.md`, Phase 4.
Depends on OTEL-B1 (span implementation).

## Gap
No tests exist yet for any gmt-otel function.

## Scope
- `test/span-timezone.test.ts`:
  - `setSpanTimezone` + `getSpanTimezone` round-trip: setting then reading returns the same value
  - Invalid timezone throws `RangeError`
  - `withTimezoneSpan` creates a span with the timezone attribute set
  - Missing OTel API throws clear `TypeError` at runtime (not build time)
  - Timezone variants: UTC, offset timezones, IANA timezones with DST
  - No OTel installed: functions throw `TypeError` with clear message

## Verification
- All tests pass
- `pnpm nx run gmt-otel:test` covers all exported span functions
```
