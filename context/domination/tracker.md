# GMT Realms Epic — Tracker

> Stories for the GMT Realms Epic. See [overview.md](overview.md) for the full spec and
> [painpoints.md](painpoints.md) for the researched evidence behind each realm.

---

## Overview

`@northguild/gmt` expands with **53 stories across 10 realms**, built in six phases.

Story IDs are globally sequential in build order: `CORE-1` through `SPA-53`. Reading the
table top to bottom is the build order.

### Blocked by

**An empty cell (`—`) means the story is free to pick up.** The column shrinks as the epic
lands: a dependency drops out of every cell the moment its own row is marked `Done`.

Each cell is generated, never hand-edited. It is the story IDs named in that story's
`## What gmt provides (do not re-implement)` section in `issues/<ID>.md`, minus the ones
already `Done`. The spec is the source of truth; run `pnpm deps:sync` to regenerate.

- **`(SPA-48)`** — parenthesised, so *not* a blocker. It is a shared primitive built later in
  the order, and whoever reaches it first builds it. You can start this story today; you will
  build that primitive as part of it. Extra scope, not a wait.
- **`SPA-49 ⚠`** — a mutual dependency, two stories naming each other. See the note below the
  table.

Because the column only shows what is left, it is not the place to look up the full graph.
For that, ask the specs: `pnpm deps -- whoneeds CORE-1` lists every story that consumes it,
`Done` or not. `pnpm deps:ready` prints what is startable right now.

---

## Stories

| #  | Story   | Realm      | Deliverable                                                         | Blocked by                     | GitHub Issue                                         | Status      |
| -- | ------- | ---------- | ------------------------------------------------------------------- | ------------------------------ | ---------------------------------------------------- | ----------- |
| 1  | CORE-1  | Core       | `toNanoseconds` + `fromNanoseconds` + JSON bridge + truncation      | —                              | [#182](https://github.com/northguild/gmt/issues/182) | Done        |
| 2  | CORE-2  | Core       | `spanMs` + `spanNs` + `spanWallClock`                               | —                              | [#183](https://github.com/northguild/gmt/issues/183) | Done        |
| 3  | CORE-3  | Core       | NTP / FILETIME / .NET ticks / Excel / Postgres epoch bridges        | —                              | [#184](https://github.com/northguild/gmt/issues/184) | Done        |
| 4  | CORE-4  | Core       | `toOffsetInstant` + `resolveLocal` + `classifyLocal`                | —                              | [#185](https://github.com/northguild/gmt/issues/185) | Done        |
| 5  | CORE-5  | Core       | ISO week + ordinal + fiscal periods + `floorToZone` + `bucketRange` | —                              | [#186](https://github.com/northguild/gmt/issues/186) | Not started |
| 6  | CORE-6  | Core       | Interval algebra: intersect, clamp, subtract, merge, split, sum     | CORE-5                         | [#187](https://github.com/northguild/gmt/issues/187) | Not started |
| 7  | CORE-7  | Core       | Business calendars, `mergeCalendars`, roll conventions              | CORE-5                         | [#188](https://github.com/northguild/gmt/issues/188) | Not started |
| 8  | TRAN-8  | Transport  | `transitTime` + `etaAtZone` + `dwellTime`                           | CORE-5                         | [#189](https://github.com/northguild/gmt/issues/189) | Not started |
| 9  | TRAN-9  | Transport  | `scheduleDelivery` + `crossingTime`                                 | CORE-6, TRAN-8                 | [#190](https://github.com/northguild/gmt/issues/190) | Not started |
| 10 | TRAN-10 | Transport  | `cutoffAt` + `cutoffSchedule` + `isPastCutoff`                      | CORE-7                         | [#191](https://github.com/northguild/gmt/issues/191) | Not started |
| 11 | INT-11  | Intermodal | `containerLeg` + `terminalDwell`                                    | CORE-5, TRAN-8, TRAN-9         | [#192](https://github.com/northguild/gmt/issues/192) | Not started |
| 12 | INT-12  | Intermodal | `freeTimeExpiry` + `chargeableDays` + `demurrageClock`              | CORE-5, CORE-6, CORE-7, INT-11 | [#193](https://github.com/northguild/gmt/issues/193) | Not started |
| 13 | INT-13  | Intermodal | `filingDeadline` + `filingStatus` (ISF / AMS / ENS)                 | CORE-7, TRAN-10                | [#194](https://github.com/northguild/gmt/issues/194) | Not started |
| 14 | INT-14  | Intermodal | `bolTimestamp` + `multimodalETA`                                    | CORE-5, CORE-6, TRAN-9, INT-11 | [#195](https://github.com/northguild/gmt/issues/195) | Not started |
| 15 | INT-15  | Intermodal | EDIFACT DTM + EPCIS 2.0 timestamp interop                           | —                              | [#196](https://github.com/northguild/gmt/issues/196) | Not started |
| 16 | MAR-16  | Maritime   | `gpsToUtc` + `utcToGps` + GPS week rollover                         | (SPA-48)                       | [#197](https://github.com/northguild/gmt/issues/197) | Not started |
| 17 | MAR-17  | Maritime   | AIS `secondOfUTC` reconstruction + `navTimestamp`                   | CORE-5                         | [#198](https://github.com/northguild/gmt/issues/198) | Not started |
| 18 | MAR-18  | Maritime   | Ship's time, clock retard/advance, date line crossing               | CORE-6                         | [#199](https://github.com/northguild/gmt/issues/199) | Not started |
| 19 | MAR-19  | Maritime   | Laytime, laycan, NOR, SHEX/SHINC/WWD                                | CORE-5, CORE-6, CORE-7         | [#200](https://github.com/northguild/gmt/issues/200) | Not started |
| 20 | ROAD-20 | Road       | FMCSA hours of service                                              | CORE-5, CORE-6                 | [#201](https://github.com/northguild/gmt/issues/201) | Not started |
| 21 | ROAD-21 | Road       | EU Regulation 561/2006 driver hours                                 | CORE-5, CORE-6, ROAD-20        | [#202](https://github.com/northguild/gmt/issues/202) | Not started |
| 22 | RAI-22  | Rail       | `railLeg` + `crossBorderSchedule` + timetable year                  | TRAN-8, TRAN-9                 | [#203](https://github.com/northguild/gmt/issues/203) | Not started |
| 23 | RAI-23  | Rail       | `stationDwell` + `shuntingWindow`                                   | CORE-6, TRAN-8                 | [#204](https://github.com/northguild/gmt/issues/204) | Not started |
| 24 | RAI-24  | Rail       | GTFS service day, times beyond 24:00:00                             | CORE-5, CORE-6                 | [#205](https://github.com/northguild/gmt/issues/205) | Not started |
| 25 | AV-25   | Aviation   | `flightLeg` + `dayOffset` + `blockTime` + `airTime`                 | CORE-5, TRAN-8                 | [#206](https://github.com/northguild/gmt/issues/206) | Not started |
| 26 | AV-26   | Aviation   | IATA seasons + SSIM dates + days of operation + MCT                 | CORE-5                         | [#207](https://github.com/northguild/gmt/issues/207) | Not started |
| 27 | AV-27   | Aviation   | Crew FDP tables, acclimatisation, WOCL                              | CORE-5, CORE-6, AV-25          | [#208](https://github.com/northguild/gmt/issues/208) | Not started |
| 28 | AV-28   | Aviation   | NOTAM / METAR validity + curfews + CTOT slots                       | CORE-6                         | [#209](https://github.com/northguild/gmt/issues/209) | Not started |
| 29 | IOT-29  | IoT        | Monotonic readings                                                  | —                              | [#210](https://github.com/northguild/gmt/issues/210) | Not started |
| 30 | IOT-30  | IoT        | `clockOffset` + `clockDrift` + `detectClockStep`                    | IOT-29                         | [#211](https://github.com/northguild/gmt/issues/211) | Not started |
| 31 | IOT-31  | IoT        | PTP / TAI device time, `currentUtcOffset`                           | (SPA-46), (SPA-48)             | [#212](https://github.com/northguild/gmt/issues/212) | Not started |
| 32 | IOT-32  | IoT        | `observedAt` vs `receivedAt`, watermarks, late arrival              | CORE-5, CORE-6, IOT-30         | [#213](https://github.com/northguild/gmt/issues/213) | Not started |
| 33 | HLTH-33 | Healthcare | HL7 v2.x DTM, offset-absent handling                                | —                              | [#214](https://github.com/northguild/gmt/issues/214) | Not started |
| 34 | HLTH-34 | Healthcare | FHIR `date` / `dateTime` / `instant` precision                      | —                              | [#215](https://github.com/northguild/gmt/issues/215) | Not started |
| 35 | HLTH-35 | Healthcare | Partial-date range semantics and comparison                         | CORE-6, HLTH-34                | [#216](https://github.com/northguild/gmt/issues/216) | Not started |
| 36 | HLTH-36 | Healthcare | Clinical, neonatal and gestational age                              | HLTH-35                        | [#217](https://github.com/northguild/gmt/issues/217) | Not started |
| 37 | HLTH-37 | Healthcare | DICOM `DA` / `TM` / `DT`                                            | —                              | [#218](https://github.com/northguild/gmt/issues/218) | Not started |
| 38 | HLTH-38 | Healthcare | Medication administration windows across DST                        | CORE-5, CORE-6                 | [#219](https://github.com/northguild/gmt/issues/219) | Not started |
| 39 | HLTH-39 | Healthcare | De-identification date shifting                                     | CORE-7, HLTH-36                | [#220](https://github.com/northguild/gmt/issues/220) | Not started |
| 40 | FIN-40  | Finance    | Market sessions, lunch breaks, half days                            | CORE-5, CORE-6, CORE-7         | [#221](https://github.com/northguild/gmt/issues/221) | Not started |
| 41 | FIN-41  | Finance    | Exchange and currency calendar data (opt-in subpath)                | CORE-7, FIN-40                 | [#222](https://github.com/northguild/gmt/issues/222) | Not started |
| 42 | FIN-42  | Finance    | Day count conventions                                               | CORE-5                         | [#223](https://github.com/northguild/gmt/issues/223) | Not started |
| 43 | FIN-43  | Finance    | Settlement and FX value dates                                       | CORE-7                         | [#224](https://github.com/northguild/gmt/issues/224) | Not started |
| 44 | FIN-44  | Finance    | Tenors and IMM dates                                                | CORE-7, FIN-43                 | [#225](https://github.com/northguild/gmt/issues/225) | Not started |
| 45 | FIN-45  | Finance    | Continuous / crypto market schedules                                | CORE-5, CORE-6                 | [#226](https://github.com/northguild/gmt/issues/226) | Not started |
| 46 | SPA-46  | Space      | `toTAI` + `toGPS` scale conversion                                  | (SPA-48)                       | [#227](https://github.com/northguild/gmt/issues/227) | Not started |
| 47 | SPA-47  | Space      | `toTT` + `toTDB` + `tdbMinusTt`                                     | SPA-46, SPA-49 ⚠               | [#228](https://github.com/northguild/gmt/issues/228) | Not started |
| 48 | SPA-48  | Space      | Leap second table and queries                                       | —                              | [#229](https://github.com/northguild/gmt/issues/229) | Not started |
| 49 | SPA-49  | Space      | Two-part Julian Date + MJD + J2000                                  | SPA-47 ⚠, SPA-48               | [#230](https://github.com/northguild/gmt/issues/230) | Not started |
| 50 | SPA-50  | Space      | UT1 / DUT1 and sidereal time                                        | SPA-47, SPA-49                 | [#231](https://github.com/northguild/gmt/issues/231) | Not started |
| 51 | SPA-51  | Space      | Mission clocks, TLE epochs, SCLK/SCET                               | CORE-5, MAR-16                 | [#232](https://github.com/northguild/gmt/issues/232) | Not started |
| 52 | SPA-52  | Space      | CCSDS time codes (ASCII A/B, CUC, CDS)                              | CORE-5, SPA-46, SPA-48         | [#233](https://github.com/northguild/gmt/issues/233) | Not started |
| 53 | SPA-53  | Space      | Mars solar time (MSD, AMT, LMST)                                    | SPA-47, SPA-49                 | [#234](https://github.com/northguild/gmt/issues/234) | Not started |

**`SPA-47` and `SPA-49` name each other.** `SPA-47` needs `toJulianDateParts` from
`SPA-49` for the TDB correction formula; `SPA-49` needs `toTT` from `SPA-47` to compute JD
in a scale other than UTC. Both cannot go second. Resolve this before starting either — the
likely split is to separate the TT half of `SPA-47` (a constant offset from TAI, no JD
involved) from the TDB half. Until it is resolved, this is the one row in the table that does
not describe a buildable order.

---

## Build Order

### Phase 1 — Core Foundation (required for everything)

Core grew from two stories to seven because the reprioritisation exposed shared dependencies
that were previously buried inside realms.

- **CORE-1, CORE-2, CORE-3** — precision, spans and foreign epoch bridges.
- **CORE-4** — the instant-plus-offset pair and explicit local-time resolution. Every realm
  that touches a local wall time depends on this.
- **CORE-5, CORE-6, CORE-7** — calendar boundaries, interval algebra, business calendars.
  `CORE-7` absorbs what was `FIN-2`; it had to move because logistics now ships before
  finance and needs business-day math.

### Phase 2 — Logistics & Transport (the priority realms)

Highest commercial value and the thinnest coverage in the original plan.

- **TRAN-8, TRAN-9, TRAN-10** — shared transport primitives; every other realm here builds
  on them.
- **INT-11 … INT-15** — container legs, demurrage, filing deadlines, B/L, EDI interop.
- **MAR-16 … MAR-19** — GPS, AIS, ship's time, laytime.
- **ROAD-20, ROAD-21** — a new realm. Road is the largest logistics mode and had no coverage.
- **RAI-22 … RAI-24** — rail legs and the GTFS service-day model.
- **AV-25 … AV-28** — flight legs, seasons, crew duty, aeronautical timestamps.

### Phase 3 — IoT / Continuous

- **IOT-29 … IOT-32** — the monotonic-reading and clock-offset model, built up in order.
  `IOT-31` is the exception: it is a device-time story that hangs off `SPA-46`/`SPA-48`,
  not off `IOT-30`, and can be built independently of the rest of the realm.

### Phase 4 — Healthcare

- **HLTH-34 → HLTH-35 → HLTH-36 → HLTH-39** is the one chain in this realm — FHIR
  precision, partial-date semantics, clinical age, de-identification.
- **HLTH-33, HLTH-37, HLTH-38** depend only on Core and can be built at any point.

### Phase 5 — Finance

- **FIN-40 → FIN-41** (sessions, then calendar data) and **FIN-43 → FIN-44** (settlement,
  then tenors) are the two chains. **FIN-42** depends only on Core.
- **FIN-45** is independent — 24/7 markets have no business calendar and deliberately compose
  with nothing in `CORE-7`.

### Phase 6 — Space / Celestial

- **`SPA-48` comes first in this realm, not third.** The leap-second table is what
  `SPA-46` needs, and it is also required early by `MAR-16` and `IOT-31` in Phase 2 and
  Phase 3. Build it when the first of those three stories is picked up, not when Phase 6
  starts.
- **SPA-46 → SPA-47/SPA-49 → SPA-50, SPA-53** is the scale-conversion chain, subject to the
  `SPA-47`/`SPA-49` split noted above.
- **SPA-51** needs `MAR-16` (GPS), not `SPA-49`. **SPA-52** needs `SPA-46` and `SPA-48`.

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
- **Dependencies are declared, not implied.** If a story's scope changes what it consumes
  from other stories, update its `## What gmt provides (do not re-implement)` section and run
  `pnpm deps:sync` in the same PR. The `Blocked by` column is generated from that section, and
  `pnpm run validate` fails when the two disagree.
- **Closing a story means flipping its `Status` to `Done` and running `pnpm deps:sync`.**
  That is what removes it from every other story's `Blocked by` cell. Skip it and the tracker
  keeps showing work as blocked that is not.
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
