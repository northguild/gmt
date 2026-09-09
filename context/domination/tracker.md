# GMT Realms Epic — Tracker

> Stories for the GMT Realms Epic. See [overview.md](overview.md) for the full spec and
> [painpoints.md](painpoints.md) for the researched evidence behind each realm.

---

## Overview

`@northguild/gmt` expands with **53 stories across 10 realms**, built in six phases.

Story IDs are globally sequential in build order: `CORE-1` through `SPA-53`. Reading the
table top to bottom is the build order.

### Dependency graph

```
Phase 1 — Core Foundation (everything depends on this)
CORE-1 ──► CORE-2 ──► CORE-3      (precision, spans, foreign epochs)
CORE-4 ─────────────────────────  (offset-preserving instants — needed by every realm)
CORE-5 ──► CORE-6 ──► CORE-7      (boundaries, interval algebra, business calendars)

Phase 2 — Logistics & Transport (the priority realms)
TRAN-8 ──► TRAN-9 ──► TRAN-10 ─── (shared transport; TRAN-10 needs CORE-7)
                └──► INT-11 ──► INT-12 ──► INT-13 ──► INT-14
                     INT-15 ──────────────────────── (EDI interop, needs CORE-4)
                └──► MAR-16 ──► MAR-17
                     MAR-18 ──────────────────────── (independent)
                     MAR-19 ──────────────────────── (needs CORE-6 + CORE-7)
                └──► ROAD-20, ROAD-21 ────────────── (need CORE-6)
                └──► RAI-22 ──► RAI-23
                     RAI-24 ──────────────────────── (GTFS, needs CORE-4 + CORE-5)
                └──► AV-25 ──► AV-26 ──► AV-27 ──► AV-28

Phase 3 — IoT / Continuous
IOT-29 ──► IOT-30 ──► IOT-31 ──► IOT-32

Phase 4 — Healthcare
HLTH-33 ──► HLTH-34 ──► HLTH-35 ──► HLTH-36
                        HLTH-37, HLTH-38, HLTH-39 ── (independent after HLTH-35)

Phase 5 — Finance
FIN-40 ──► FIN-41 ──► FIN-42 ──► FIN-43 ──► FIN-44
FIN-45 ─────────────────────────────────── (independent, no calendar dependency)

Phase 6 — Space / Celestial
SPA-46 ──► SPA-47 ──► SPA-48 ──► SPA-49 ──► SPA-50
SPA-51, SPA-52, SPA-53 ─────────────────── (need SPA-49)
```

Cross-phase note: `SPA-48` (leap seconds) is consumed by `MAR-16` and `IOT-31`. Those two
stories depend on the leap-second table, not on the whole Space realm, and the table must be
built once and shared.

---

## Stories

| #   | Story    | Realm      | Deliverable                                                          | Status      |
| --- | -------- | ---------- | -------------------------------------------------------------------- | ----------- |
| 1   | CORE-1   | Core       | `toNanoseconds` + `fromNanoseconds` + JSON bridge + truncation       | Not started |
| 2   | CORE-2   | Core       | `spanMs` + `spanNs` + `spanWallClock`                                | Not started |
| 3   | CORE-3   | Core       | NTP / FILETIME / .NET ticks / Excel / Postgres epoch bridges         | Not started |
| 4   | CORE-4   | Core       | `toOffsetInstant` + `resolveLocal` + `classifyLocal`                 | Not started |
| 5   | CORE-5   | Core       | ISO week + ordinal + fiscal periods + `floorToZone` + `bucketRange`  | Not started |
| 6   | CORE-6   | Core       | Interval algebra: intersect, clamp, subtract, merge, split, sum      | Not started |
| 7   | CORE-7   | Core       | Business calendars, `mergeCalendars`, roll conventions               | Not started |
| 8   | TRAN-8   | Transport  | `transitTime` + `etaAtZone` + `dwellTime`                            | Not started |
| 9   | TRAN-9   | Transport  | `scheduleDelivery` + `crossingTime`                                  | Not started |
| 10  | TRAN-10  | Transport  | `cutoffAt` + `cutoffSchedule` + `isPastCutoff`                       | Not started |
| 11  | INT-11   | Intermodal | `containerLeg` + `terminalDwell`                                     | Not started |
| 12  | INT-12   | Intermodal | `freeTimeExpiry` + `chargeableDays` + `demurrageClock`               | Not started |
| 13  | INT-13   | Intermodal | `filingDeadline` + `filingStatus` (ISF / AMS / ENS)                  | Not started |
| 14  | INT-14   | Intermodal | `bolTimestamp` + `multimodalETA`                                     | Not started |
| 15  | INT-15   | Intermodal | EDIFACT DTM + EPCIS 2.0 timestamp interop                            | Not started |
| 16  | MAR-16   | Maritime   | `gpsToUtc` + `utcToGps` + GPS week rollover                          | Not started |
| 17  | MAR-17   | Maritime   | AIS `secondOfUTC` reconstruction + `navTimestamp`                    | Not started |
| 18  | MAR-18   | Maritime   | Ship's time, clock retard/advance, date line crossing                | Not started |
| 19  | MAR-19   | Maritime   | Laytime, laycan, NOR, SHEX/SHINC/WWD                                 | Not started |
| 20  | ROAD-20  | Road       | FMCSA hours of service                                               | Not started |
| 21  | ROAD-21  | Road       | EU Regulation 561/2006 driver hours                                  | Not started |
| 22  | RAI-22   | Rail       | `railLeg` + `crossBorderSchedule` + timetable year                   | Not started |
| 23  | RAI-23   | Rail       | `stationDwell` + `shuntingWindow`                                    | Not started |
| 24  | RAI-24   | Rail       | GTFS service day, times beyond 24:00:00                              | Not started |
| 25  | AV-25    | Aviation   | `flightLeg` + `dayOffset` + `blockTime` + `airTime`                  | Not started |
| 26  | AV-26    | Aviation   | IATA seasons + SSIM dates + days of operation + MCT                  | Not started |
| 27  | AV-27    | Aviation   | Crew FDP tables, acclimatisation, WOCL                               | Not started |
| 28  | AV-28    | Aviation   | NOTAM / METAR validity + curfews + CTOT slots                        | Not started |
| 29  | IOT-29   | IoT        | Monotonic readings                                                   | Not started |
| 30  | IOT-30   | IoT        | `clockOffset` + `clockDrift` + `detectClockStep`                     | Not started |
| 31  | IOT-31   | IoT        | PTP / TAI device time, `currentUtcOffset`                            | Not started |
| 32  | IOT-32   | IoT        | `observedAt` vs `receivedAt`, watermarks, late arrival               | Not started |
| 33  | HLTH-33  | Healthcare | HL7 v2.x DTM, offset-absent handling                                 | Not started |
| 34  | HLTH-34  | Healthcare | FHIR `date` / `dateTime` / `instant` precision                       | Not started |
| 35  | HLTH-35  | Healthcare | Partial-date range semantics and comparison                          | Not started |
| 36  | HLTH-36  | Healthcare | Clinical, neonatal and gestational age                               | Not started |
| 37  | HLTH-37  | Healthcare | DICOM `DA` / `TM` / `DT`                                             | Not started |
| 38  | HLTH-38  | Healthcare | Medication administration windows across DST                         | Not started |
| 39  | HLTH-39  | Healthcare | De-identification date shifting                                      | Not started |
| 40  | FIN-40   | Finance    | Market sessions, lunch breaks, half days                             | Not started |
| 41  | FIN-41   | Finance    | Exchange and currency calendar data (opt-in subpath)                 | Not started |
| 42  | FIN-42   | Finance    | Day count conventions                                                | Not started |
| 43  | FIN-43   | Finance    | Settlement and FX value dates                                        | Not started |
| 44  | FIN-44   | Finance    | Tenors and IMM dates                                                 | Not started |
| 45  | FIN-45   | Finance    | Continuous / crypto market schedules                                 | Not started |
| 46  | SPA-46   | Space      | `toTAI` + `toGPS` scale conversion                                   | Not started |
| 47  | SPA-47   | Space      | `toTT` + `toTDB` + `tdbMinusTt`                                      | Not started |
| 48  | SPA-48   | Space      | Leap second table and queries                                        | Not started |
| 49  | SPA-49   | Space      | Two-part Julian Date + MJD + J2000                                   | Not started |
| 50  | SPA-50   | Space      | UT1 / DUT1 and sidereal time                                         | Not started |
| 51  | SPA-51   | Space      | Mission clocks, TLE epochs, SCLK/SCET                                | Not started |
| 52  | SPA-52   | Space      | CCSDS time codes (ASCII A/B, CUC, CDS)                               | Not started |
| 53  | SPA-53   | Space      | Mars solar time (MSD, AMT, LMST)                                     | Not started |

---

## Build Order

### Phase 1 — Core Foundation (required for everything)

Core grew from two stories to seven because the reprioritisation exposed shared dependencies
that were previously buried inside realms.

- **CORE-1 → CORE-2 → CORE-3** — precision, spans and foreign epoch bridges.
- **CORE-4** — the instant-plus-offset pair and explicit local-time resolution. Every realm
  that touches a local wall time depends on this.
- **CORE-5 → CORE-6 → CORE-7** — calendar boundaries, interval algebra, business calendars.
  `CORE-7` absorbs what was `FIN-2`; it had to move because logistics now ships before
  finance and needs business-day math.

### Phase 2 — Logistics & Transport (the priority realms)

Highest commercial value and the thinnest coverage in the original plan.

- **TRAN-8 → TRAN-9 → TRAN-10** — shared transport primitives; every other realm here builds
  on them.
- **INT-11 → INT-15** — container legs, demurrage, filing deadlines, B/L, EDI interop.
- **MAR-16 → MAR-19** — GPS, AIS, ship's time, laytime.
- **ROAD-20, ROAD-21** — a new realm. Road is the largest logistics mode and had no coverage.
- **RAI-22 → RAI-24** — rail legs and the GTFS service-day model.
- **AV-25 → AV-28** — flight legs, seasons, crew duty, aeronautical timestamps.

### Phase 3 — IoT / Continuous

- **IOT-29 → IOT-32** — sequential. Each builds on the previous story's clock model.

### Phase 4 — Healthcare

- **HLTH-33 → HLTH-36** sequential; **HLTH-37, HLTH-38, HLTH-39** independent afterwards.

### Phase 5 — Finance

- **FIN-40 → FIN-44** sequential. **FIN-45** is independent — 24/7 markets have no business
  calendar and deliberately compose with nothing in `CORE-7`.

### Phase 6 — Space / Celestial

- **SPA-46 → SPA-50** sequential; **SPA-51, SPA-52, SPA-53** need `SPA-49`.
- **`SPA-48` is required early by `MAR-16` and `IOT-31`.** Build the leap-second table when
  the first of those stories is picked up, not when Phase 6 starts.

---

## Definition of Done — Binding for Every Story

- `pnpm run validate` stays green, including the 20-cell GMT timezone matrix.
- **Changesets required.** Every story that modifies source needs a `.changeset/*.md` entry.
- No `Date` object anywhere. All inputs are ISO 8601 strings; outputs are strings, numbers,
  booleans, bigint, or objects.
- Wrap all Temporal calls in `try-catch`. Bad input returns sentinels, never throws.
- Full locale matrix for any locale-aware function (17 locales, `hasFullIcu` ternaries where
  output differs).
- Full IANA timezone coverage for timezone-aware functions.
- JSDoc with `@example` on every public function. Cover valid, invalid, and edge-case inputs.

### Added for this epic

- **Zones and calendars are parameters.** Realm functions take IANA zone identifiers and
  calendar objects as arguments. GMT does not bundle place registries and does not resolve a
  port, airport, station or exchange code to a timezone.
- **Bundled reference data is opt-in only.** Holiday tables, leap seconds, curfews and FDP
  tables live behind a `…/data` subpath, never on the default import path, and each records
  its source, revision and validity window.
- **Every local-to-instant conversion states its disambiguation policy** in JSDoc, using
  `CORE-4`'s vocabulary. Ambiguous and nonexistent wall times are never resolved silently.
- **Every function implementing a standard cites the clause it implements** in
  `## Design notes` — and the citation must be verifiable. See `RAI-23` for what happens when
  it is not.
- **No invented quantities.** If a value cannot be derived from the inputs, the function does
  not return it. Estimating processing times, drift from one sample, or limits from no table
  is out of scope by rule, not by omission.

---

## Deleted Packages

| Package                | Action | Reason                                                                 |
| ---------------------- | ------ | ---------------------------------------------------------------------- |
| `@northguild/gmt-time` | Delete | Value (`toNanoseconds`, `fromNanoseconds`) moved to core.              |
| `@northguild/gmt-otel` | Delete | Too niche. Precision primitives in core serve all telemetry consumers. |

Both packages were never shipped to npm. No migration path needed.
