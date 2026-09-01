# OTEL-C — Context / baggage propagation

**Audited 2026-09-01.** All functions wrap OTel's Baggage API. No invented types. See [overview.md](../overview.md) for the full corrected spec.

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
- OTel API is an optional peer dependency — baggage functions check for it at runtime and
  throw a clear `TypeError` if not found.

---

### OTEL-C1 — Context / baggage propagation (`setTimezoneInBaggage` + `getTimezoneFromBaggage` + `propagateTimezone`)

**Title:**

```
OTEL-C1 Implement context/baggage propagation: setTimezoneInBaggage, getTimezoneFromBaggage, propagateTimezone
```

**Description:**

```
Part of the gmt-time + gmt-otel epic — see `context/otel/overview.md`, Phase 5.
Depends on OTEL-B1 (span helpers) and OTEL-A2 (re-export gmt-time).

## Gap
OTel has no concept of timezone propagation across service boundaries. We need helpers to
attach IANA timezone metadata to OTel context/baggage so downstream services can display
times in the user's local timezone.

## Scope
- `src/context.ts`:
  - `setTimezoneInBaggage(context: Context, timezone: string): Context` — sets the
    `gmt-timezone` key in OTel baggage for propagation. Validates timezone via
    `@northguild/gmt/zoned/validate` (`isValidTimeZone`) and throws `RangeError` if invalid.
  - `getTimezoneFromBaggage(context: Context): string | undefined` — reads `gmt-timezone`
    from baggage. Returns `undefined` if not set.
  - `propagateTimezone(carrier: Record<string, string>, timezone: string): void` —
    injects `gmt-timezone` header into a carrier (e.g., HTTP headers) for cross-service
    propagation via W3C baggage. Validates timezone and throws `RangeError` if invalid.
- All functions check for `@opentelemetry/api` at runtime and throw a clear `TypeError`
  if not found (OTel is an optional peer dependency).

## What gmt-time provides (do not re-implement)
- `zoned/validate` — `isValidTimeZone(tz)` validates IANA timezone strings.

## Verification
- `setTimezoneInBaggage` + `getTimezoneFromBaggage` round-trip: setting then reading returns the same value
- Invalid timezone throws `RangeError`
- `propagateTimezone` injects correct header format into carrier
- Missing OTel API throws clear `TypeError` at runtime (not build time)
```

---

### OTEL-C2 — Context / baggage propagation tests

**Title:**

```
OTEL-C2 Add comprehensive tests for context/baggage propagation
```

**Description:**

```
Part of the gmt-time + gmt-otel epic — see `context/otel/overview.md`, Phase 5.
Depends on OTEL-C1 (context implementation).

## Gap
No tests exist yet for any gmt-otel function.

## Scope
- `test/context.test.ts`:
  - `setTimezoneInBaggage` + `getTimezoneFromBaggage` round-trip: setting then reading returns the same value
  - Invalid timezone throws `RangeError`
  - `propagateTimezone` injects correct header format into carrier
  - Missing OTel API throws clear `TypeError` at runtime (not build time)
  - Timezone variants: UTC, offset timezones, IANA timezones with DST
  - No OTel installed: functions throw `TypeError` with clear message

## Verification
- All tests pass
- `pnpm nx run gmt-otel:test` covers all exported context functions
```
