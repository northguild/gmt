# GMT Realms Epic — Tracker

> Stories for the GMT Realms Epic. See [overview.md](overview.md) for the full spec and
> [painpoints.md](painpoints.md) for the researched evidence behind each realm.

---

## Overview

`@northguild/gmt` expands with **75 stories across 10 realms**, built in six phases.

Reading the table top to bottom is the build order, and the `#` column is that order. A story
ID is a permanent name: it is what every cross-reference, spec filename and GitHub issue uses,
and it never changes. The two agreed one-to-one until `CORE-8` took slot 8; the September 2026
research spike then added three Core primitives (`CORE-54` … `CORE-56`) and nineteen realm
stories, and `TRAN-8` shipped next, so below row 8 the `#` no longer matches the number in the
ID. **The first row that is not `Done` is the next story to build.** Done rows stay at the top in
the order they shipped. `pnpm deps:check` reads build order from row position, not from the ID.

### Blocked by

**An empty cell (`—`) means the story is free to pick up.** The column shrinks as the epic
lands: a dependency drops out of every cell the moment its own row is marked `Done`.

Each cell is generated, never hand-edited. It is the story IDs named in that story's
`## What gmt provides (do not re-implement)` section in `issues/<ID>.md`, minus the ones
already `Done`. The spec is the source of truth; run `pnpm deps:sync` to regenerate.

- **`(SPA-48)`** — parenthesised, so _not_ a blocker. It is a shared primitive built later in
  the order, and whoever reaches it first builds it. You can start this story today; you will
  build that primitive as part of it. Extra scope, not a wait.
- **`⚠`** — a mutual dependency, two stories naming each other. None remain; see the SPA-47
  note below.

Because the column only shows what is left, it is not the place to look up the full graph.
For that, ask the specs: `pnpm deps -- whoneeds CORE-1` lists every story that consumes it,
`Done` or not. `pnpm deps:ready` prints what is startable right now.

---

## Stories

| #  | Story   | Realm      | Deliverable                                                                 | Blocked by             | GitHub Issue                                         | Status      |
| -- | ------- | ---------- | --------------------------------------------------------------------------- | ---------------------- | ---------------------------------------------------- | ----------- |
| 1  | CORE-1  | Core       | `toNanoseconds` + `fromNanoseconds` + JSON bridge + truncation              | —                      | [#182](https://github.com/northguild/gmt/issues/182) | Done        |
| 2  | CORE-2  | Core       | `spanMs` + `spanNs` + `spanWallClock`                                       | —                      | [#183](https://github.com/northguild/gmt/issues/183) | Done        |
| 3  | CORE-3  | Core       | NTP / FILETIME / .NET ticks / Excel / Postgres epoch bridges                | —                      | [#184](https://github.com/northguild/gmt/issues/184) | Done        |
| 4  | CORE-4  | Core       | `toOffsetInstant` + `resolveLocal` + `classifyLocal`                        | —                      | [#185](https://github.com/northguild/gmt/issues/185) | Done        |
| 5  | CORE-5  | Core       | ISO week + ordinal + fiscal periods + `floorToZone` + `bucketRange`         | —                      | [#186](https://github.com/northguild/gmt/issues/186) | Done        |
| 6  | CORE-6  | Core       | Interval algebra: intersect, clamp, subtract, merge, split, sum             | —                      | [#187](https://github.com/northguild/gmt/issues/187) | Done        |
| 7  | CORE-7  | Core       | Business calendars, `mergeCalendars`, roll conventions                      | —                      | [#188](https://github.com/northguild/gmt/issues/188) | Done        |
| 8  | CORE-8  | Core       | Full-API standards review with `gmt-reviewer` (pre-1.16.0)                  | —                      | [#251](https://github.com/northguild/gmt/issues/251) | Done        |
| 9  | TRAN-8  | Transport  | `transitTime` + `etaAtZone` + `dwellTime`                                   | —                      | [#189](https://github.com/northguild/gmt/issues/189) | Done        |
| 10 | INT-12  | Intermodal | `freeTimeExpiry` + `chargeableDays` + `demurrageClock`                      | —                      | [#193](https://github.com/northguild/gmt/issues/193) | Not started |
| 11 | INT-58  | Intermodal | FMC demurrage and detention billing timelines (46 CFR 541)                  | INT-12                 | [#260](https://github.com/northguild/gmt/issues/260) | Not started |
| 12 | CORE-55 | Core       | Operating hours and recurring windows, open-time SLA arithmetic             | —                      | [#257](https://github.com/northguild/gmt/issues/257) | Not started |
| 13 | TRAN-9  | Transport  | `scheduleDelivery` + `crossingTime`                                         | —                      | [#190](https://github.com/northguild/gmt/issues/190) | Not started |
| 14 | TRAN-10 | Transport  | `cutoffAt` + `cutoffSchedule` + `isPastCutoff`                              | —                      | [#191](https://github.com/northguild/gmt/issues/191) | Not started |
| 15 | TRAN-57 | Transport  | Schedule deviation, punctuality, PLN/EST/REQ/ACT, `nextDeparture`           | —                      | [#259](https://github.com/northguild/gmt/issues/259) | Not started |
| 16 | INT-13  | Intermodal | `filingDeadline` + `applicableRule` + `filingStatus`                        | TRAN-10                | [#194](https://github.com/northguild/gmt/issues/194) | Not started |
| 17 | INT-14  | Intermodal | `bolTimestamp` + `multimodalETA`                                            | TRAN-9                 | [#195](https://github.com/northguild/gmt/issues/195) | Not started |
| 18 | INT-15  | Intermodal | EDIFACT DTM + X12 1250/623 + EPCIS 2.0 timestamp interop                    | —                      | [#196](https://github.com/northguild/gmt/issues/196) | Not started |
| 19 | ROAD-20 | Road       | FMCSA hours of service                                                      | —                      | [#201](https://github.com/northguild/gmt/issues/201) | Not started |
| 20 | ROAD-21 | Road       | EU Regulation 561/2006 driver hours                                         | ROAD-20                | [#202](https://github.com/northguild/gmt/issues/202) | Not started |
| 21 | ROAD-61 | Road       | FMCSA exceptions: sleeper berth, adverse conditions, short-haul, 16-hour    | ROAD-20                | [#263](https://github.com/northguild/gmt/issues/263) | Not started |
| 22 | ROAD-62 | Road       | Canadian hours of service (SOR/2005-313)                                    | ROAD-20                | [#264](https://github.com/northguild/gmt/issues/264) | Not started |
| 23 | MAR-16  | Maritime   | GNSS time scales (GPS, Galileo, BeiDou, GLONASS, QZSS) + week rollover      | (SPA-46), (SPA-48)     | [#197](https://github.com/northguild/gmt/issues/197) | Not started |
| 24 | MAR-17  | Maritime   | AIS `secondOfUTC` reconstruction + `navTimestamp`                           | —                      | [#198](https://github.com/northguild/gmt/issues/198) | Not started |
| 25 | MAR-18  | Maritime   | Ship's time, clock changes, zone descriptions, DTG, date line crossing      | —                      | [#199](https://github.com/northguild/gmt/issues/199) | Not started |
| 26 | MAR-19  | Maritime   | Laytime, laycan, NOR, BIMCO 2013 definitions, laytime statement             | CORE-55                | [#200](https://github.com/northguild/gmt/issues/200) | Not started |
| 27 | MAR-59  | Maritime   | NMEA 0183 time and date fields (RMC, ZDA, GGA)                              | MAR-16                 | [#261](https://github.com/northguild/gmt/issues/261) | Not started |
| 28 | MAR-60  | Maritime   | Seafarer hours of rest (STCW A-VIII/1, MLC A2.3)                            | ROAD-20, MAR-18        | [#262](https://github.com/northguild/gmt/issues/262) | Not started |
| 29 | CORE-54 | Core       | Holiday rule engine: nth weekday, Easter, observance shifts                 | —                      | [#256](https://github.com/northguild/gmt/issues/256) | Not started |
| 30 | AV-25   | Aviation   | `flightLeg` + `dayOffset` + `blockTime` + `airTime` + `oooiTimes`           | —                      | [#206](https://github.com/northguild/gmt/issues/206) | Not started |
| 31 | AV-26   | Aviation   | IATA seasons + SSIM dates, variations, days of operation + MCT              | CORE-54, AV-25         | [#207](https://github.com/northguild/gmt/issues/207) | Not started |
| 32 | AV-27   | Aviation   | Crew FDP tables, acclimatisation, WOCL, local night                         | CORE-55, AV-25         | [#208](https://github.com/northguild/gmt/issues/208) | Not started |
| 33 | AV-28   | Aviation   | NOTAM validity and D) schedules, METAR/TAF times, curfews, CTOT slots       | CORE-55                | [#209](https://github.com/northguild/gmt/issues/209) | Not started |
| 34 | AV-64   | Aviation   | AIRAC cycles and publication deadlines                                      | —                      | [#266](https://github.com/northguild/gmt/issues/266) | Not started |
| 35 | AV-65   | Aviation   | Cumulative flight and duty limits (14 CFR 117.23/.25, ORO.FTL.210/.235)     | AV-25, AV-27           | [#267](https://github.com/northguild/gmt/issues/267) | Not started |
| 36 | RAI-22  | Rail       | `railLeg` + `crossBorderSchedule` + timetable year + operating bitmasks     | TRAN-9, CORE-54, AV-26 | [#203](https://github.com/northguild/gmt/issues/203) | Not started |
| 37 | RAI-23  | Rail       | `stationDwell` + `blockingTime` + `shuntingWindow`                          | —                      | [#204](https://github.com/northguild/gmt/issues/204) | Not started |
| 38 | RAI-24  | Rail       | GTFS service day, times beyond 24:00:00                                     | —                      | [#205](https://github.com/northguild/gmt/issues/205) | Not started |
| 39 | RAI-63  | Rail       | FRA hours of service for train and signal employees (49 U.S.C. 21103–21104) | ROAD-20                | [#265](https://github.com/northguild/gmt/issues/265) | Not started |
| 40 | CORE-56 | Core       | Time-ordered identifiers (UUID, ULID, Snowflake…) + Parquet/Arrow/protobuf  | —                      | [#258](https://github.com/northguild/gmt/issues/258) | Not started |
| 41 | IOT-29  | IoT        | Monotonic readings                                                          | —                      | [#210](https://github.com/northguild/gmt/issues/210) | Not started |
| 42 | IOT-30  | IoT        | `clockOffset` + `uncertaintyInterval` + `clockDrift` + `detectClockStep`    | IOT-29                 | [#211](https://github.com/northguild/gmt/issues/211) | Not started |
| 43 | IOT-31  | IoT        | PTP / TAI device time, `currentUtcOffset`                                   | (SPA-46), (SPA-48)     | [#212](https://github.com/northguild/gmt/issues/212) | Not started |
| 44 | IOT-32  | IoT        | `observedAt` vs `receivedAt`, watermarks, late arrival, event windows       | IOT-30                 | [#213](https://github.com/northguild/gmt/issues/213) | Not started |
| 45 | IOT-66  | IoT        | Hybrid logical clocks and uncertainty-interval ordering                     | IOT-30                 | [#268](https://github.com/northguild/gmt/issues/268) | Not started |
| 46 | HLTH-33 | Healthcare | HL7 v2.x DTM, TS, DT, TM; offset-absent handling                            | —                      | [#214](https://github.com/northguild/gmt/issues/214) | Not started |
| 47 | HLTH-34 | Healthcare | FHIR `date` / `dateTime` / `instant` precision                              | —                      | [#215](https://github.com/northguild/gmt/issues/215) | Not started |
| 48 | HLTH-35 | Healthcare | Partial-date range semantics and comparison (FHIRPath, CQL)                 | HLTH-34                | [#216](https://github.com/northguild/gmt/issues/216) | Not started |
| 49 | HLTH-36 | Healthcare | Clinical, neonatal, gestational, postmenstrual and corrected age; EDD       | HLTH-35                | [#217](https://github.com/northguild/gmt/issues/217) | Not started |
| 50 | HLTH-37 | Healthcare | DICOM `DA` / `TM` / `DT`                                                    | —                      | [#218](https://github.com/northguild/gmt/issues/218) | Not started |
| 51 | HLTH-38 | Healthcare | Medication administration windows across DST; `Timing.repeat`               | —                      | [#219](https://github.com/northguild/gmt/issues/219) | Not started |
| 52 | HLTH-39 | Healthcare | De-identification date shifting                                             | HLTH-36                | [#220](https://github.com/northguild/gmt/issues/220) | Not started |
| 53 | HLTH-67 | Healthcare | Immunization dose validity: minimum age/interval, four-day grace            | HLTH-36                | [#269](https://github.com/northguild/gmt/issues/269) | Not started |
| 54 | HLTH-68 | Healthcare | Pharmacy adherence: PDC, MPR, days' supply, refill-too-soon                 | HLTH-35                | [#270](https://github.com/northguild/gmt/issues/270) | Not started |
| 55 | HLTH-69 | Healthcare | Encounter durations: length of stay, midnights, observation hours           | —                      | [#271](https://github.com/northguild/gmt/issues/271) | Not started |
| 56 | HLTH-70 | Healthcare | ACGME clinical and educational work hours                                   | ROAD-20                | [#272](https://github.com/northguild/gmt/issues/272) | Not started |
| 57 | FIN-40  | Finance    | Market sessions, lunch breaks, half days, trade date                        | CORE-55                | [#221](https://github.com/northguild/gmt/issues/221) | Not started |
| 58 | FIN-41  | Finance    | Exchange and currency calendar data (opt-in subpath)                        | FIN-40                 | [#222](https://github.com/northguild/gmt/issues/222) | Not started |
| 59 | FIN-42  | Finance    | Day count conventions (FpML codes, ISDA rules)                              | —                      | [#223](https://github.com/northguild/gmt/issues/223) | Not started |
| 60 | FIN-43  | Finance    | Settlement and FX value dates                                               | —                      | [#224](https://github.com/northguild/gmt/issues/224) | Not started |
| 61 | FIN-44  | Finance    | Tenors, IMM dates and CDS roll dates                                        | CORE-54, FIN-43        | [#225](https://github.com/northguild/gmt/issues/225) | Not started |
| 62 | FIN-45  | Finance    | Continuous / crypto market schedules                                        | —                      | [#226](https://github.com/northguild/gmt/issues/226) | Not started |
| 63 | FIN-71  | Finance    | Calculation period schedules (FpML `CalculationPeriodDates`)                | CORE-54, FIN-44        | [#273](https://github.com/northguild/gmt/issues/273) | Not started |
| 64 | FIN-72  | Finance    | RFR compounding conventions: lookback, shift, lockout, payment delay        | FIN-42, FIN-71         | [#274](https://github.com/northguild/gmt/issues/274) | Not started |
| 65 | FIN-73  | Finance    | FIX and SWIFT MT timestamps; RTS 25 granularity                             | (SPA-48)               | [#275](https://github.com/northguild/gmt/issues/275) | Not started |
| 66 | SPA-46  | Space      | `toTAI` + `toGPS` scale conversion + TAI64 labels                           | (SPA-48)               | [#227](https://github.com/northguild/gmt/issues/227) | Not started |
| 67 | SPA-47  | Space      | `toTT` + `toTCG`                                                            | SPA-46                 | [#228](https://github.com/northguild/gmt/issues/228) | Not started |
| 68 | SPA-48  | Space      | Leap second table and queries                                               | —                      | [#229](https://github.com/northguild/gmt/issues/229) | Not started |
| 69 | SPA-49  | Space      | Two-part Julian Date + MJD + J2000                                          | SPA-47, SPA-48         | [#230](https://github.com/northguild/gmt/issues/230) | Not started |
| 70 | SPA-74  | Space      | `toTDB` + `tdbMinusTt` + `toTCB`                                            | SPA-47, SPA-49         | [#276](https://github.com/northguild/gmt/issues/276) | Not started |
| 71 | SPA-50  | Space      | UT1 / DUT1, ΔT polynomials and sidereal time                                | SPA-47, SPA-48, SPA-49 | [#231](https://github.com/northguild/gmt/issues/231) | Not started |
| 72 | SPA-51  | Space      | Mission clocks, TLE epochs, SCLK/SCET, light time                           | MAR-16                 | [#232](https://github.com/northguild/gmt/issues/232) | Not started |
| 73 | SPA-52  | Space      | CCSDS time codes (ASCII A/B, CUC, CDS)                                      | SPA-46, SPA-48         | [#233](https://github.com/northguild/gmt/issues/233) | Not started |
| 74 | SPA-53  | Space      | Mars solar time (MSD, AMT, LMST)                                            | SPA-47, SPA-49, SPA-74 | [#234](https://github.com/northguild/gmt/issues/234) | Not started |
| 75 | SPA-75  | Space      | Solar events: sunrise, sunset, twilight, solar position                     | SPA-47, SPA-49         | [#277](https://github.com/northguild/gmt/issues/277) | Not started |

**`CORE-8` sits at slot 8, ahead of the realm work.** It gates everything after it: it is the
standards and consistency pass over the whole public surface before 1.16.0 ships, and a realm
story built on an API still carrying a cross-namespace defect inherits it.

**The later Core primitives are built just before their first consumer.** `CORE-55` (operating
hours) sits before the Transport rows that need it for `MAR-19`'s office hours, `CORE-54`
(holiday rules) before Aviation, whose `AV-26` season boundaries are its first use, and `CORE-56`
(identifiers) before IoT, because no story consumes it. They carry high ID numbers because they
were added after the realm IDs were assigned, which is exactly why the `#` column and not the ID
is the build order.

**Demurrage comes straight after `TRAN-8`.** `INT-12` is the first consumer of
`dwellTime.calendarDays`, and `INT-58` finishes the demurrage and detention billing rules on top
of it, so the two follow the primitive they test before the rest of Transport.

**`SPA-47` and `SPA-49` no longer name each other.** The September 2026 spike split the
JD-dependent half of `SPA-47` (TDB, TCB) into `SPA-74`. `SPA-47` keeps TT and TCG, which are a
constant offset and a constant rate from TAI and need no Julian Date; `SPA-49` depends on it
alone; `SPA-74` depends on both. Every row in the table now describes a buildable order.

**Realms interleave where a dependency demands it.** Road precedes Maritime because `MAR-60`
reuses `ROAD-20`'s duty-log shape; Aviation precedes Rail because `RAI-22` reuses `AV-26`'s
days-of-operation primitive. Read the `#` column, not the realm column, for order.

---

## Build Order

### Phase 1 — Core Foundation (required for everything)

Core grew from two stories to eleven because the reprioritisation exposed shared dependencies
that were previously buried inside realms, the surface they built needed one pass over it as a
whole before anything was built on top, and the September 2026 spike found three more primitives
that realm stories were about to implement several times over. Phase 1 is the eight shipped
stories; the three spike primitives are built inside later phases, each just before its first
consumer.

- **CORE-1, CORE-2, CORE-3** — precision, spans and foreign epoch bridges.
- **CORE-4** — the instant-plus-offset pair and explicit local-time resolution. Every realm
  that touches a local wall time depends on this.
- **CORE-5, CORE-6, CORE-7** — calendar boundaries, interval algebra, business calendars.
  `CORE-7` absorbs what was `FIN-2`; it had to move because logistics now ships before
  finance and needs business-day math.
- **CORE-8** — the standards and consistency pass over everything the seven above shipped,
  run with `gmt-reviewer` before 1.16.0. It closed the first part of Phase 1.
- **CORE-54, CORE-55, CORE-56** — holiday rules, operating hours and time-ordered identifiers,
  built later (see the Phase 2 and Phase 3 entries). `CORE-54` is under IMM dates, crypto
  expiries, the IATA season and reference calendars; `CORE-55` is under trading sessions,
  curfews, the WOCL, gate hours and laytime office hours; `CORE-56` is `CORE-3`'s second
  generation.

### Phase 2 — Logistics & Transport (the priority realms)

Highest commercial value and the thinnest coverage in the original plan.

- **TRAN-8** (done), then **INT-12 and INT-58** — dwell, then free time and demurrage and the
  FMC billing timelines that now regulate demurrage invoices, built on dwell's day count.
- **CORE-55** — operating hours, ahead of the laytime and aviation stories that use it.
- **TRAN-9, TRAN-10, TRAN-57** — the rest of the shared transport primitives. `TRAN-57` adds
  planned-versus-actual, which every mode measures.
- **INT-13 … INT-15** — filing deadlines, B/L and EDI interop.
- **ROAD-20, ROAD-21, ROAD-61, ROAD-62** — FMCSA, EU, FMCSA exceptions and Canada. Road is the
  largest logistics mode and had no coverage; it now precedes Maritime because its duty-log shape
  is reused there.
- **MAR-16 … MAR-19, MAR-59, MAR-60** — GNSS, AIS, ship's time, laytime, NMEA and seafarer rest.
- **CORE-54** — holiday rules, ahead of `AV-26`'s season boundaries.
- **AV-25 … AV-28, AV-64, AV-65** — flight legs, seasons, crew duty, aeronautical timestamps,
  AIRAC and cumulative limits.
- **RAI-22 … RAI-24, RAI-63** — rail legs, blocking time, the GTFS service-day model and FRA
  hours.

### Phase 3 — IoT / Continuous

- **CORE-56** — time-ordered identifiers and data-platform epochs. Nothing depends on it; it
  opens this phase because IoT and data pipelines are where those identifiers are read.
- **IOT-29 … IOT-32, IOT-66** — the monotonic-reading and clock-offset model, built up in order,
  then ordering under uncertainty. `IOT-31` is the exception: it is a device-time story that
  hangs off `SPA-46`/`SPA-48`, not off `IOT-30`, and can be built independently of the rest of
  the realm.

### Phase 4 — Healthcare

- **HLTH-34 → HLTH-35 → HLTH-36 → HLTH-39** is the one chain in this realm — FHIR
  precision, partial-date semantics, clinical age, de-identification. `HLTH-67` hangs off
  `HLTH-36`; `HLTH-68` off `HLTH-35`.
- **HLTH-33, HLTH-37, HLTH-38** depend only on Core and can be built at any point. `HLTH-69`
  depends on `TRAN-8`; `HLTH-70` on `ROAD-20`'s shape.

### Phase 5 — Finance

- **FIN-40 → FIN-41** (sessions, then calendar data) and **FIN-43 → FIN-44 → FIN-71 → FIN-72**
  (settlement, tenors, schedules, RFR conventions) are the two chains. **FIN-42** and **FIN-73**
  depend only on Core (and `FIN-73` on `SPA-48` for the leap-second field).
- **FIN-45** is independent — 24/7 markets have no business calendar and deliberately compose
  with nothing in `CORE-7`.

### Phase 6 — Space / Celestial

- **`SPA-48` comes first in this realm, not third.** The leap-second table is what
  `SPA-46` needs, and it is also required early by `MAR-16` and `IOT-31` in Phase 2 and
  Phase 3, and by `FIN-73` in Phase 5. Build it when the first of those stories is picked up, not
  when Phase 6 starts.
- **SPA-46 → SPA-47 → SPA-49 → SPA-74 → SPA-50, SPA-53, SPA-75** is the scale-conversion
  chain, now acyclic.
- **SPA-51** needs `MAR-16` (GPS), not `SPA-49`. **SPA-52** needs `SPA-46` and `SPA-48`.

---

## Definition of Done — Binding for Every Story

- `pnpm run validate` stays green, including the CI timezone matrix (10 zones × Node 22/24/26 — see README).
- **Changesets required** per the [changeset rule](../coding-standards.md#changesets): a new
  API story is `minor`; a fix to shipped behaviour is `patch`; no behaviour change, none.
- No `Date` object anywhere. All inputs are ISO 8601 strings; outputs are strings, numbers,
  booleans, arrays, bigint, or objects.
- Wrap all Temporal calls in `try-catch`. Bad input returns the sentinel from the
  [sentinel table](../coding-standards.md#api-contract), never throws.
- Full locale matrix for any locale-aware function (17 locales; `expectOneOfIcu` /
  `expectDateTimeEqual` from `src/test/icuVariants.ts` where CLDR wording differs).
- Timezone-aware functions run across `battleTestTimeZones`, and boundary functions add the
  probe-zone transition rows — see
  [§ Calendar & zone semantics](../coding-standards.md#calendar--zone-semantics).
- JSDoc with `@example` on every public function. Cover valid, invalid, and edge-case inputs.

### Added for this epic

- **Zones and calendars are parameters.** Realm functions take IANA zone identifiers and
  calendar objects as arguments. GMT does not bundle place registries and does not resolve a
  port, airport, station or exchange code to a timezone.
- **Bundled reference data is opt-in only.** Holiday tables, leap seconds, curfews and FDP
  tables live behind a `…/data` subpath, never on the default import path, and each records
  its source, revision and validity window.
- **Every local-to-instant conversion states its disambiguation policy** in JSDoc, using the
  vocabulary in [LOCAL_TIME_RESOLUTION.md](../reference/LOCAL_TIME_RESOLUTION.md). Ambiguous
  and nonexistent wall times are never resolved silently.
- **Every function implementing a standard cites the clause it implements** in
  `## Design notes` — and the citation must be verifiable. See `RAI-23` for what happens when
  it is not, twice.
- **A rule whose primary text was not reached is marked, not asserted.** The spike record lists
  each such case; the spec that depends on it says so in its JSDoc and takes the value from the
  caller or returns the sentinel until the text is cited.
- **Dependencies are declared, not implied.** If a story's scope changes what it consumes
  from other stories, update its `## What gmt provides (do not re-implement)` section and run
  `pnpm deps:sync` in the same PR. The `Blocked by` column is generated from that section, and
  `pnpm run validate` fails when the two disagree.
- **A story that adds public functions ships its docs-site pages in the same PR**: a guide,
  scenarios and a mistakes page, with every result checked against the built package. See
  [docs-site.md](docs-site.md).
- **Closing a story means flipping its `Status` to `Done` and running `pnpm deps:sync`.**
  That is what removes it from every other story's `Blocked by` cell. Skip it and the tracker
  keeps showing work as blocked that is not.
- **No invented quantities.** If a value cannot be derived from the inputs, the function does
  not return it. Estimating processing times, drift from one sample, or limits from no table
  is out of scope by rule, not by omission.
- **Every behaviour-changing story gets a standards review.** `gmt-reviewer` (read-only) runs
  after `tdd-dev` and `tester` in categories A, B and G; its report goes in the PR's Validation
  section; an open blocking finding blocks closure. It is what verifies the citations above.

---

## Deleted Packages

| Package                | Action | Reason                                                                 |
| ---------------------- | ------ | ---------------------------------------------------------------------- |
| `@northguild/gmt-time` | Delete | Value (`toNanoseconds`, `fromNanoseconds`) moved to core.              |
| `@northguild/gmt-otel` | Delete | Too niche. Precision primitives in core serve all telemetry consumers. |

Both packages were never shipped to npm. No migration path needed.
