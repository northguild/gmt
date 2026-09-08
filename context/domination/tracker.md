# GMT Realms Epic — Tracker

> Stories for the GMT Realms Epic. See [overview.md](overview.md) for the full spec.

---

## Overview

`@northguild/gmt` expands with 23 new stories across 9 realms + 2 core stories.

### Dependency graph

```
Core Foundation
├── CORE-1 ──────────────────► CORE-2
(precision bridge)             (span durations)

IOT-1 ────────────────────────────── (independent, needs core only)
HLTH-1 ──► HLTH-2 ────────────────── (independent after core)
FIN-1  ──► FIN-2  ────────────────── (independent after core)

Transport (shared overlap)
├── TRAN-1 ──► TRAN-2
(transit + dwell)                   (multi-leg scheduling)

MAR-1 ──► MAR-2 ────────────────── (maritime, independent after core)
AV-1  ──► AV-2  ────────────────── (aviation, independent after core)
RAI-1 ──► RAI-2 ────────────────── (rail, independent after core)
INT-1 ──► INT-2 ────────────────── (intermodal, independent after core)

SPA-1 ──► SPA-2 ──► SPA-3 ──► SPA-4 (sequential, Space realm)
```

---

## Stories

| #   | Story  | Realm      | Deliverable                                                               | Status      |
| --- | ------ | ---------- | ------------------------------------------------------------------------- | ----------- |
| 1   | CORE-1 | Core       | `toNanoseconds` + `fromNanoseconds`                                       | Not started |
| 2   | CORE-2 | Core       | `spanMs` + `spanNs`                                                       | Not started |
| 3   | IOT-1  | IoT        | `monotonicNow` + `deviceSync` + `deviceTimeAt`                            | Not started |
| 4   | HLTH-1 | Healthcare | `formatHL7` + `parseHL7` + `formatHL7Full`                                | Not started |
| 5   | HLTH-2 | Healthcare | `formatFHIR` + `parseFHIR` + `isValidFHIRPrecision`                       | Not started |
| 6   | FIN-1  | Finance    | `isMarketOpen` + `marketOpenAt` + `marketCloseAt`                         | Not started |
| 7   | FIN-2  | Finance    | `nextBusinessDay` + `previousBusinessDay` + `businessDaysBetween`         | Not started |
| 8   | TRAN-1 | Transport  | `transitTime` + `etaAtZone` + `dwellTime`                                 | Not started |
| 9   | TRAN-2 | Transport  | `scheduleDelivery` + `crossingTime`                                       | Not started |
| 10  | MAR-1  | Maritime   | `gpsToUtc` + `utcToGps`                                                   | Not started |
| 11  | MAR-2  | Maritime   | `navTimestamp` + `mmsiTimestamp`                                          | Not started |
| 12  | AV-1   | Aviation   | `flightLeg` + `crewDutyWindow` + `airportCurfew`                          | Not started |
| 13  | AV-2   | Aviation   | `blockTime` + `scheduledTime` + `notamTimestamp`                          | Not started |
| 14  | RAI-1  | Rail       | `railLeg` + `crossBorderSchedule`                                         | Not started |
| 15  | RAI-2  | Rail       | `uicDwellTime` + `shuntingWindow`                                         | Not started |
| 16  | INT-1  | Intermodal | `containerLeg` + `portDwell` + `customsClearance`                         | Not started |
| 17  | INT-2  | Intermodal | `bolTimestamp` + `multimodalETA`                                          | Not started |
| 18  | SPA-1  | Space      | `toTAI` + `fromTAI` + `toGPS` + `fromGPS`                                 | Not started |
| 19  | SPA-2  | Space      | `toTT` + `fromTT` + `toTDB` + `fromTDB`                                   | Not started |
| 20  | SPA-3  | Space      | `leapSecondsBetween` + `isLeapSecond`                                     | Not started |
| 21  | SPA-4  | Space      | `instantToJulianDate` + `instantFromJulianDate` + `instantToJ2000Seconds` | Not started |

---

## Build Order

### Phase 1 — Core Foundation (required for all realms)

- **CORE-1 is the foundation.** `toNanoseconds` + `fromNanoseconds` must exist before anything else.
- **CORE-2 can start after CORE-1.** `spanMs` + `spanNs` are simple arithmetic on top of the precision bridge.

### Phase 2 — Ease-ordered Realms (all independent of each other)

Realms are independent and can be built concurrently. Each needs CORE-1 only.

- **IOT-1** — Depends on CORE-1. Monotonic clock is the simplest extension.
- **HLTH-1 → HLTH-2** — Depend on CORE-1. Formatting/parsing, not new time math.
- **FIN-1 → FIN-2** — Depend on CORE-1. Business day math complexity is in holiday data.
- **TRAN-1 → TRAN-2** — Depend on CORE-1. Shared transport utilities.
- **MAR-1 → MAR-2** — Depend on CORE-1. GPS ↔ UTC is a known offset calculation.
- **AV-1 → AV-2** — Depend on CORE-1. Flight scheduling and airline timing.
- **RAI-1 → RAI-2** — Depend on CORE-1. Rail-specific timing.
- **INT-1 → INT-2** — Depend on CORE-1. Intermodal container tracking.

### Phase 3 — Space / Celestial

- **SPA-1 → SPA-2 → SPA-3 → SPA-4** — Sequential within the realm.
- SPA-1 (TAI/GPS) is the easiest Space scale. SPA-2 (TT/TDB) adds relativistic correction. SPA-3 (leap seconds) needs IERS data. SPA-4 (Julian Date) is independent of scales.

---

## Definition of Done — Binding for Every Story

- `pnpm run validate` stays green, including the 20-cell GMT timezone matrix.
- **Changesets required.** Every story that modifies source needs a `.changeset/*.md` entry.
- No `Date` object anywhere. All inputs are ISO 8601 strings; outputs are strings, numbers, booleans, bigint, or objects.
- Wrap all Temporal calls in `try-catch`. Bad input returns sentinels, never throws.
- Full locale matrix for any locale-aware function (17 locales, `hasFullIcu` ternaries where output differs).
- Full IANA timezone coverage for timezone-aware functions.
- JSDoc with `@example` on every public function. Cover valid, invalid, and edge-case inputs.

---

## Deleted Packages

| Package                | Action | Reason                                                                 |
| ---------------------- | ------ | ---------------------------------------------------------------------- |
| `@northguild/gmt-time` | Delete | Value (`toNanoseconds`, `fromNanoseconds`) moved to core.              |
| `@northguild/gmt-otel` | Delete | Too niche. Precision primitives in core serve all telemetry consumers. |

Both packages were never shipped to npm. No migration path needed.
