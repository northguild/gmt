# CORE-1 — Precision bridge: `toNanoseconds` + `fromNanoseconds`

**Scope:** Add `toNanoseconds` and `fromNanoseconds` to `@northguild/gmt` core.
These are the universal precision primitives — they serve all realms and all telemetry consumers.

## Gap

GMT currently has `convertZonedToUnix` which returns `number` in milliseconds — insufficient for high-precision systems (finance, space, scientific computing, OTel). `Temporal.Instant.epochNanoseconds` returns `bigint` for full nanosecond precision.

## Scope

- `packages/gmt/src/precision/index.ts`:
  - `toNanoseconds(isoString: string): bigint` — Converts ISO 8601 string to nanoseconds since Unix epoch. Uses `Temporal.ZonedDateTime.from` + `.toInstant().epochNanoseconds` for full precision.
  - `fromNanoseconds(nanoseconds: bigint, timezone?: string): string` — Converts nanoseconds back to ISO string. Uses `Temporal.Instant.fromEpochNanoseconds`. If `timezone` is provided, returns zoned string; otherwise UTC.
- Both functions throw `RangeError` on invalid input (bridge pattern — callers expect errors, unlike gmt core's sentinel returns).
- Internal: TAI nanoseconds as the canonical representation (continuous, no leap second gaps).

## What gmt provides (do not re-implement)

- `Temporal.ZonedDateTime.from` / `Temporal.Instant.from` — parsing
- `Temporal.Instant.toString()` — ISO 8601 serialization
- `@js-temporal/polyfill` — already available via root re-export

## Precision guarantee

JavaScript `Number` safely represents integers up to 2^53 - 1 ~ 9.0 x 10^15. A nanosecond epoch timestamp for year 2255 exceeds this. `bigint` is required — no rounding.

## Verification

- Round-trip: `fromNanoseconds(toNanoseconds(iso))` returns an equivalent ISO string
- Epoch boundaries: Unix epoch (1970-01-01), far future (> year 2255)
- Invalid input throws `RangeError`
- Max safe integer: values near `Number.MAX_SAFE_INTEGER` nanoseconds should not round
- `pnpm run validate` stays green

## Implementation note

`fromNanoseconds` needs the IERS leap second table for UTC conversion. Bundle the current IERS Bulletin C data as a static table. This table is shared with the Space realm (SPA-3).
