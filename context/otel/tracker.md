# gmt-time + gmt-otel — Tracker

> **`@northguild/gmt-time`** — general-purpose ISO 8601 ↔ nanosecond conversion (no OTel).
> **`@northguild/gmt-otel`** — thin OpenTelemetry layer on top of gmt-time.
> See [overview.md](overview.md) for the full spec.

---

## Overview

The original draft plan was heavily hallucinated: it invented `GMTDate` types, assumed
gmt had methods like `GMTDate.now()`, claimed "zero dependencies on OTel" when the
package's entire value was integrating with `@opentelemetry/api`, and named everything
`toOtel*` — making timestamp conversion unusable outside OTel.

The corrected plan ([overview.md](overview.md)) splits into **two packages**:

1. **`@northguild/gmt-time`** — general-purpose, no OTel. Anyone can use this:
   geospatial, scientific computing, IoT, finance, observability.
2. **`@northguild/gmt-otel`** — thin OTel layer that re-exports everything from gmt-time
   and adds span/baggage helpers.

### Dependency graph

```
@northguild/gmt  ──►  @northguild/gmt-time  ──►  @northguild/gmt-otel
(required)              (required)                  (optional peer: OTel)
```

## Stories

The 6 phases map onto 14 fully independent stories. Each story is its own unit of work
with its own deliverable — no sub-stories, no nesting.

| Order | Story          | Package        | Phase              | Status      |
| ----- | -------------- | -------------- | ------------------ | ----------- |
| 1     | GMTIME-A1      | gmt-time       | Package skeleton   | Not started |
| 2     | GMTIME-A2      | gmt-time       | Timestamp conversion (bigint) | Not started |
| 3     | GMTIME-A3      | gmt-time       | Timestamp conversion (tuple) | Not started |
| 4     | GMTIME-A4      | gmt-time       | Timestamp tests    | Not started |
| 5     | GMTIME-B1      | gmt-time       | Duration conversion | Not started |
| 6     | GMTIME-B2      | gmt-time       | Duration tests     | Not started |
| 7     | OTEL-A1        | gmt-otel       | Package skeleton   | Not started |
| 8     | OTEL-A2        | gmt-otel       | Re-export gmt-time | Not started |
| 9     | OTEL-B1        | gmt-otel       | Span timezone helpers | Not started |
| 10    | OTEL-B2        | gmt-otel       | Span tests         | Not started |
| 11    | OTEL-C1        | gmt-otel       | Context/baggage propagation | Not started |
| 12    | OTEL-C2        | gmt-otel       | Context tests      | Not started |
| 13    | OTEL-D1        | gmt-otel       | Browser utility    | Not started |
| 14    | OTEL-D2        | gmt-otel       | README, LICENSE, CI polish | Not started |

**Each story is independent.** A story closes when its deliverable lands and passes CI.

## Build Order

- **GMTIME-A1 is the foundation.** Package skeleton must exist before anything else.
- **GMTIME-A2 → GMTIME-A3 are order-locked.** Timestamp conversion is the core value —
  everything else depends on it. Build A2 → A3 in sequence.
- **GMTIME-A4 may start after GMTIME-A3 lands.** Tests validate the timestamp tier.
- **GMTIME-B1 may start after GMTIME-A2 lands.** Duration conversion is independent of
  TimeInput but both depend on the package skeleton from GMTIME-A1.
- **GMTIME-B2 may start after GMTIME-B1 lands.**
- **OTEL-A1 may start after GMTIME-A1 lands.** gmt-otel skeleton depends on gmt-time
  existing (it's a dependency).
- **OTEL-A2 may start after OTEL-A1 lands.** Re-export gmt-time.
- **OTEL-B1 may start after OTEL-A2 lands.** Span helpers use timestamp conversion.
- **OTEL-B2 may start after OTEL-B1 lands.**
- **OTEL-C1 may start after OTEL-B1 lands.** Context propagation builds on span helpers.
- **OTEL-C2 may start after OTEL-C1 lands.**
- **OTEL-D1 is independent** — browser utility has no dependencies beyond gmt-time.
- **OTEL-D2 is last** — README, LICENSE, and CI polish wrap everything up.

## Definition of Done — Binding for Every Story

- `pnpm nx run-many -t lint test typecheck build` stays green, **including the 20-cell
  GMT timezone matrix**. Neither new package perturbs `packages/gmt`.
- **Changesets required.** Both packages are published to npm, so every story that
  modifies source needs a `.changeset/*.md` entry.
- No `Date` object anywhere. All inputs are ISO 8601 strings; outputs are strings, numbers,
  booleans, or arrays.
- Wrap all Temporal calls in `try-catch`. Bad input returns sentinels, never throws.
- Full IANA timezone coverage for timezone-aware functions (not locale matrix — output
  is not locale-dependent).
