# GMT Realms Epic — Tracker

> Stories for the GMT Realms Epic. See [overview.md](overview.md) for the full spec and
> [painpoints.md](painpoints.md) for the researched evidence behind each realm.

---

## Overview

`@northguild/gmt` expands with **66 stories across 9 realms**, built in six phases.

Reading the table top to bottom is the build order, and the `#` column is that order. A story
ID is a permanent name: it is what every cross-reference, spec filename and GitHub issue uses,
and it never changes. The `#` and the number in the ID do not match: Core primitives sit just
before their first consumer whatever their ID. **The first row that is not `Done` is the next
story to build.** Done rows stay at the top in
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

### Release

Merging a story publishes nothing. A human cuts a release by opening a PR that runs
`pnpm run changeset:version` (see [PUBLISHING.md](../../PUBLISHING.md)), and that release carries
every story merged since the last one. This column says when to do it.

- **A version** (`1.16.0`): the npm release the story shipped in.
- **`Cut`**: a release point. Once this row is `Done`, cut a release. It ships every row
  above it still marked `—`, whatever its realm. Until then those functions are on the docs
  site with an Unreleased badge.
- **`—`**: merged or not, it ships with the next `Cut` below it.

When a release publishes, replace `—` and `Cut` on every row it shipped with the version. Moving,
adding or removing a `Cut` is an owner decision; nothing generates this column.

**Where the cuts sit, and why.** A release ships a whole capability someone can adopt, usually the
end of a realm, and never more than about seven stories, so the docs site is never far ahead of
npm. A Core primitive ships with the realm that first uses it.

| Cut after     | Ships                             | Why here                                                                                             |
| ------------- | --------------------------------- | ---------------------------------------------------------------------------------------------------- |
| INT-58 (#11)  | TRAN-8, INT-12, INT-58            | Dwell plus free time, demurrage and the billing deadline chain: the demurrage calculations, complete |
| TRAN-57 (#15) | CORE-55, TRAN-9, TRAN-10, TRAN-57 | The rest of the transport primitives, with operating hours                                           |
| INT-15 (#17)  | INT-14, INT-15                    | Intermodal complete: B/L and EDI interop                                                             |
| CORE-76 (#18) | CORE-76                           | Hours of work: the one duty-log engine driver, seafarer, crew and resident rules run on              |
| MAR-59 (#23)  | MAR-16 … MAR-19, MAR-59           | Maritime complete, laytime included                                                                  |
| AV-64 (#29)   | CORE-54, AV-25 … AV-28, AV-64     | Aviation complete, with the holiday rules its seasons use                                            |
| RAI-24 (#32)  | RAI-22 … RAI-24                   | Rail complete; Phase 2 done                                                                          |
| IOT-66 (#38)  | CORE-56, IOT-29 … IOT-32, IOT-66  | IoT complete, with the identifier timestamps                                                         |
| HLTH-39 (#45) | HLTH-33 … HLTH-39                 | The clinical date and time foundations                                                               |
| HLTH-68 (#47) | HLTH-67, HLTH-68                  | Immunisation and adherence                                                                           |
| FIN-45 (#53)  | FIN-40 … FIN-45                   | Sessions, day counts, settlement, tenors, 24/7 markets                                               |
| FIN-73 (#56)  | FIN-71 … FIN-73                   | Schedules, RFR conventions, message timestamps                                                       |
| SPA-74 (#61)  | SPA-46 … SPA-49, SPA-74           | The time-scale chain: TAI, TT, leap seconds, Julian Date, TDB                                        |
| SPA-75 (#66)  | SPA-50 … SPA-53, SPA-75           | UT1, mission clocks, CCSDS, Mars time, solar events                                                  |

---

## Stories

| #  | Story   | Realm      | Deliverable                                                                      | Blocked by             | Issue | Release | Status      |
| -- | ------- | ---------- | -------------------------------------------------------------------------------- | ---------------------- | ----- | ------- | ----------- |
| 1  | CORE-1  | Core       | `toNanoseconds` + `fromNanoseconds`<br>+ JSON bridge + truncation                | —                      | #182  | 1.16.0  | Done        |
| 2  | CORE-2  | Core       | `spanMs` + `spanNs` +<br>`spanWallClock`                                         | —                      | #183  | 1.16.0  | Done        |
| 3  | CORE-3  | Core       | NTP / FILETIME / .NET ticks / Excel<br>/ Postgres epoch bridges                  | —                      | #184  | 1.16.0  | Done        |
| 4  | CORE-4  | Core       | `toOffsetInstant` + `resolveLocal` +<br>`classifyLocal`                          | —                      | #185  | 1.16.0  | Done        |
| 5  | CORE-5  | Core       | ISO week + ordinal + fiscal periods<br>+ `floorToZone` + `bucketRange`           | —                      | #186  | 1.16.0  | Done        |
| 6  | CORE-6  | Core       | Interval algebra: intersect, clamp,<br>subtract, merge, split, sum               | —                      | #187  | 1.16.0  | Done        |
| 7  | CORE-7  | Core       | Business calendars,<br>`mergeCalendars`, roll conventions                        | —                      | #188  | 1.16.0  | Done        |
| 8  | CORE-8  | Core       | Full-API standards review with<br>`gmt-reviewer` (pre-1.16.0)                    | —                      | #251  | 1.16.0  | Done        |
| 9  | TRAN-8  | Transport  | `transitTime` + `etaAtZone` +<br>`dwellTime`                                     | —                      | #189  | 1.17.0  | Done        |
| 10 | INT-12  | Intermodal | `freeTimeExpiry` + `chargeableDays`<br>+ `demurrageClock`                        | —                      | #193  | 1.17.0  | Done        |
| 11 | INT-58  | Intermodal | `billingTimeline`: invoice, dispute and<br>resolution deadlines                  | —                      | #260  | 1.17.0  | Done        |
| 12 | CORE-55 | Core       | Operating hours and recurring<br>windows, open-time SLA arithmetic               | —                      | #257  | —       | Done        |
| 13 | TRAN-9  | Transport  | `scheduleDelivery` + `crossingTime`                                              | —                      | #190  | —       | Not started |
| 14 | TRAN-10 | Transport  | `cutoffAt` + `cutoffSchedule` +<br>`isPastCutoff`                                | —                      | #191  | —       | Not started |
| 15 | TRAN-57 | Transport  | Schedule deviation, punctuality,<br>PLN/EST/REQ/ACT, `nextDeparture`             | —                      | #259  | Cut     | Not started |
| 16 | INT-14  | Intermodal | `bolTimestamp` + `multimodalETA`                                                 | TRAN-9                 | #195  | —       | Not started |
| 17 | INT-15  | Intermodal | EDIFACT DTM + X12 1250/623 + EPCIS<br>2.0 timestamp interop                      | —                      | #196  | Cut     | Not started |
| 18 | CORE-76 | Core       | Hours of work: composable duty-log<br>rules, `dutyDayFor`, violations report     | —                      | #283  | Cut     | Not started |
| 19 | MAR-16  | Maritime   | GNSS time scales (GPS, Galileo,<br>BeiDou, GLONASS, QZSS) + week<br>rollover     | (SPA-46), (SPA-48)     | #197  | —       | Not started |
| 20 | MAR-17  | Maritime   | AIS `secondOfUTC` reconstruction +<br>`navTimestamp`                             | —                      | #198  | —       | Not started |
| 21 | MAR-18  | Maritime   | Ship's time, clock changes, zone<br>descriptions, DTG, date line<br>crossing     | —                      | #199  | —       | Not started |
| 22 | MAR-19  | Maritime   | Laytime, laycan, NOR, BIMCO 2013<br>definitions, laytime statement               | —                      | #200  | —       | Not started |
| 23 | MAR-59  | Maritime   | NMEA 0183 time and date fields (RMC,<br>ZDA, GGA)                                | MAR-16                 | #261  | Cut     | Not started |
| 24 | CORE-54 | Core       | Holiday rule engine: nth weekday,<br>Easter, observance shifts                   | —                      | #256  | —       | Not started |
| 25 | AV-25   | Aviation   | `flightLeg` + `dayOffset` +<br>`blockTime` + `airTime` +<br>`oooiTimes`          | —                      | #206  | —       | Not started |
| 26 | AV-26   | Aviation   | IATA seasons + SSIM dates,<br>variations, days of operation + MCT                | CORE-54, AV-25         | #207  | —       | Not started |
| 27 | AV-27   | Aviation   | Crew FDP table lookup, acclimatisation,<br>recurring local windows               | AV-25                  | #208  | —       | Not started |
| 28 | AV-28   | Aviation   | NOTAM validity and D) schedules,<br>METAR/TAF times, curfews, CTOT slots         | —                      | #209  | —       | Not started |
| 29 | AV-64   | Aviation   | AIRAC cycles and publication<br>deadlines                                        | —                      | #266  | Cut     | Not started |
| 30 | RAI-22  | Rail       | `railLeg` + `crossBorderSchedule` +<br>operating bitmasks                        | TRAN-9, AV-26          | #203  | —       | Not started |
| 31 | RAI-23  | Rail       | `stationDwell` + `blockingTime` +<br>`shuntingWindow`                            | —                      | #204  | —       | Not started |
| 32 | RAI-24  | Rail       | GTFS service day, times beyond<br>24:00:00                                       | —                      | #205  | Cut     | Not started |
| 33 | CORE-56 | Core       | Time-ordered identifiers (UUID,<br>ULID, Snowflake…) +<br>Parquet/Arrow/protobuf | —                      | #258  | —       | Not started |
| 34 | IOT-29  | IoT        | Monotonic readings                                                               | —                      | #210  | —       | Not started |
| 35 | IOT-30  | IoT        | `clockOffset` +<br>`uncertaintyInterval` + `clockDrift`<br>+ `detectClockStep`   | IOT-29                 | #211  | —       | Not started |
| 36 | IOT-31  | IoT        | PTP / TAI device time,<br>`currentUtcOffset`                                     | (SPA-46), (SPA-48)     | #212  | —       | Not started |
| 37 | IOT-32  | IoT        | `observedAt` vs `receivedAt`,<br>watermarks, late arrival, event<br>windows      | IOT-30                 | #213  | —       | Not started |
| 38 | IOT-66  | IoT        | Hybrid logical clocks and<br>uncertainty-interval ordering                       | IOT-30                 | #268  | Cut     | Not started |
| 39 | HLTH-33 | Healthcare | HL7 v2.x DTM, TS, DT, TM;<br>offset-absent handling                              | —                      | #214  | —       | Not started |
| 40 | HLTH-34 | Healthcare | FHIR `date` / `dateTime` / `instant`<br>precision                                | —                      | #215  | —       | Not started |
| 41 | HLTH-35 | Healthcare | Partial-date range semantics and<br>comparison (FHIRPath, CQL)                   | HLTH-34                | #216  | —       | Not started |
| 42 | HLTH-36 | Healthcare | Clinical, neonatal, gestational,<br>postmenstrual and corrected age; EDD         | HLTH-35                | #217  | —       | Not started |
| 43 | HLTH-37 | Healthcare | DICOM `DA` / `TM` / `DT`                                                         | —                      | #218  | —       | Not started |
| 44 | HLTH-38 | Healthcare | Medication administration windows<br>across DST; `Timing.repeat`                 | —                      | #219  | —       | Not started |
| 45 | HLTH-39 | Healthcare | De-identification date shifting                                                  | HLTH-36                | #220  | Cut     | Not started |
| 46 | HLTH-67 | Healthcare | Immunization dose validity: minimum<br>age/interval, grace window                | HLTH-36                | #269  | —       | Not started |
| 47 | HLTH-68 | Healthcare | Pharmacy adherence: PDC, MPR, days'<br>supply, refill-too-soon                   | HLTH-35                | #270  | Cut     | Not started |
| 48 | FIN-40  | Finance    | Market sessions, lunch breaks, half<br>days, trade date                          | —                      | #221  | —       | Not started |
| 49 | FIN-41  | Finance    | Exchange and payment-system calendar<br>data (opt-in subpath)                    | FIN-40                 | #222  | —       | Not started |
| 50 | FIN-42  | Finance    | Day count conventions (FpML codes,<br>ISDA rules)                                | —                      | #223  | —       | Not started |
| 51 | FIN-43  | Finance    | Settlement and FX value dates                                                    | —                      | #224  | —       | Not started |
| 52 | FIN-44  | Finance    | Tenors, IMM dates and CDS roll dates                                             | CORE-54, FIN-43        | #225  | —       | Not started |
| 53 | FIN-45  | Finance    | Continuous / crypto market schedules                                             | —                      | #226  | Cut     | Not started |
| 54 | FIN-71  | Finance    | Calculation period schedules (FpML<br>`CalculationPeriodDates`)                  | CORE-54, FIN-44        | #273  | —       | Not started |
| 55 | FIN-72  | Finance    | RFR compounding conventions:<br>lookback, shift, lockout, payment<br>delay       | FIN-42, FIN-71         | #274  | —       | Not started |
| 56 | FIN-73  | Finance    | FIX and SWIFT MT timestamps;<br>precision checks                                 | (SPA-48)               | #275  | Cut     | Not started |
| 57 | SPA-46  | Space      | `toTAI` + `toGPS` scale conversion +<br>TAI64 labels                             | (SPA-48)               | #227  | —       | Not started |
| 58 | SPA-47  | Space      | `toTT` + `toTCG`                                                                 | SPA-46                 | #228  | —       | Not started |
| 59 | SPA-48  | Space      | Leap second table and queries                                                    | —                      | #229  | —       | Not started |
| 60 | SPA-49  | Space      | Two-part Julian Date + MJD + J2000                                               | SPA-47, SPA-48         | #230  | —       | Not started |
| 61 | SPA-74  | Space      | `toTDB` + `tdbMinusTt` + `toTCB`                                                 | SPA-47, SPA-49         | #276  | Cut     | Not started |
| 62 | SPA-50  | Space      | UT1 / DUT1, ΔT polynomials and<br>sidereal time                                  | SPA-47, SPA-48, SPA-49 | #231  | —       | Not started |
| 63 | SPA-51  | Space      | Mission clocks, TLE epochs,<br>SCLK/SCET, light time                             | MAR-16                 | #232  | —       | Not started |
| 64 | SPA-52  | Space      | CCSDS time codes (ASCII A/B, CUC,<br>CDS)                                        | SPA-46, SPA-48         | #233  | —       | Not started |
| 65 | SPA-53  | Space      | Mars solar time (MSD, AMT, LMST)                                                 | SPA-47, SPA-49, SPA-74 | #234  | —       | Not started |
| 66 | SPA-75  | Space      | Solar events: sunrise, sunset,<br>twilight, solar position                       | SPA-47, SPA-49         | #277  | Cut     | Not started |

**`CORE-8` sits at slot 8, ahead of the realm work.** It gates everything after it: it is the
standards and consistency pass over the whole public surface before 1.16.0 ships, and a realm
story built on an API still carrying a cross-namespace defect inherits it.

**The later Core primitives are built just before their first consumer.** `CORE-55` (operating
hours) sits before the Transport rows that need it for `MAR-19`'s office hours, `CORE-54`
(holiday rules) before Aviation, whose `AV-26` season boundaries are its first use, and `CORE-56`
(identifiers) before IoT, because no story consumes it. They carry high ID numbers because they
were added after the realm IDs were assigned, which is exactly why the `#` column and not the ID
is the build order. `CORE-76` (hours of work) is Core because five realms' duty rules run on it;
no story names it as a dependency, so it takes the slot of its first intended consumer.

**Demurrage comes straight after `TRAN-8`.** `INT-12` is the first consumer of
`dwellTime.calendarDays`, and `INT-58` adds the billing deadline chain, every window a caller
parameter, on top of it, so the two follow the primitive they test before the rest of Transport.

**`SPA-47`, `SPA-49` and `SPA-74` form a chain, not a cycle.** `SPA-47` owns TT and TCG, which
are a constant offset and a constant rate from TAI and need no Julian Date; `SPA-49` depends on it
alone; `SPA-74` owns TDB and TCB and depends on both. Every row in the table is a buildable order.

**Realms interleave where a dependency demands it.** `CORE-76` precedes Maritime so ship's time
(`MAR-18`) is shown feeding a duty log in the same release cycle; Aviation precedes Rail because `RAI-22` reuses `AV-26`'s
days-of-operation primitive. Read the `#` column, not the realm column, for order.

---

## Build Order

### Phase 1 — Core Foundation (required for everything)

Core is twelve stories: the primitives several realms share, and one pass over the whole
surface before anything is built on top. Phase 1 is the eight shipped stories; the four later primitives (`CORE-54`, `CORE-55`, `CORE-56`, `CORE-76`) are built inside
later phases, each just before its first consumer.

- **CORE-1, CORE-2, CORE-3** — precision, spans and foreign epoch bridges.
- **CORE-4** — the instant-plus-offset pair and explicit local-time resolution. Every realm
  that touches a local wall time depends on this.
- **CORE-5, CORE-6, CORE-7** — calendar boundaries, interval algebra, business calendars.
  `CORE-7` absorbs what was `FIN-2`; it had to move because logistics now ships before
  finance and needs business-day math.
- **CORE-8** — the standards and consistency pass over everything the seven above shipped,
  run with `gmt-reviewer` before 1.16.0. It closed the first part of Phase 1.
- **CORE-54, CORE-55, CORE-56, CORE-76** — holiday rules, operating hours, time-ordered
  identifiers and the hours-of-work engine, built later (see the Phase 2 and Phase 3 entries).
  `CORE-54` is under IMM dates, crypto expiries, the IATA season and reference calendars;
  `CORE-55` is under trading sessions, curfews, recurring crew windows, gate hours and laytime
  office hours; `CORE-56` is `CORE-3`'s second generation; `CORE-76` is the one engine under
  every duty-log rule a caller states.

### Phase 2 — Logistics & Transport (the priority realms)

Highest commercial value and the thinnest coverage in the original plan.

- **TRAN-8** (done), then **INT-12 and INT-58** — dwell, then free time and demurrage and the
  billing deadline chain around a demurrage invoice, every window a caller parameter, built on
  dwell's day count.
- **CORE-55** — operating hours, ahead of the laytime and aviation stories that use it.
- **TRAN-9, TRAN-10, TRAN-57** — the rest of the shared transport primitives. `TRAN-57` adds
  planned-versus-actual, which every mode measures.
- **INT-14, INT-15** — B/L and EDI interop. Advance-filing deadlines are `TRAN-10`'s cut-off
  math anchored to a caller's event.
- **CORE-76** — the hours-of-work engine: composable rule objects over a duty log, every number
  the caller's. It precedes Maritime.
- **MAR-16 … MAR-19, MAR-59** — GNSS, AIS, ship's time, laytime and NMEA.
- **CORE-54** — holiday rules, ahead of `AV-26`'s season boundaries.
- **AV-25 … AV-28, AV-64** — flight legs, seasons, crew duty, aeronautical timestamps and
  AIRAC.
- **RAI-22 … RAI-24** — rail legs, blocking time and the GTFS service-day model.

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
- **HLTH-33, HLTH-37, HLTH-38** depend only on Core and can be built at any point; `HLTH-38`'s
  guide also carries the hospital-midnights example on `TRAN-8`'s `dwellTime`.

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
- **Bundled reference data is opt-in only, and limited to two kinds.** Data published by a
  standards body (IERS leap seconds and Earth orientation, IANA, CLDR) and calendars published
  by an operator such as an exchange or a payment system. No national holiday tables, no
  regulator tables, no dealer-convention tables. It lives behind a `…/data` subpath, never on
  the default import path, and each record carries its source, revision and validity window.
- **Every local-to-instant conversion states its disambiguation policy** in JSDoc, using the
  vocabulary in [LOCAL_TIME_RESOLUTION.md](../reference/LOCAL_TIME_RESOLUTION.md). Ambiguous
  and nonexistent wall times are never resolved silently.
- **Every function implementing a standard cites the clause it implements** in
  `## Design notes` — and the citation must be verifiable. See `RAI-23` for what happens when
  it is not, twice. A function that implements no standard says so in its JSDoc and takes every
  number from the caller; the citation rule then applies to the arithmetic's own references
  (Temporal, ISO 8601, CORE stories), not to the caller's regime.
- **A rule whose primary text was not reached is marked, not asserted.** The verification files
  in `research/spike-2026-09/` list each such case; the spec that depends on it says so in its JSDoc and takes the value from the
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
- **GMT tracks no law.** Windows, limits, thresholds and tables from a statute, regulation,
  treaty, agency, accreditation body, professional body or court are caller parameters with no
  defaults, the same rule as tariff terms. That covers legislatures and regulators, treaties
  ratified into national law (maritime labour and watchkeeping conventions, collision
  regulations), and professional, accreditation and public-health bodies (residency work-hour
  rules, immunisation grace periods, obstetric dating thresholds, adherence cut-offs): a body's
  _format, vocabulary, cadence or algorithm_ is a standard GMT may implement and cite; a body's
  _limit, window, threshold or table on conduct_ is treated like law, whoever publishes it.
  Library code rests on TC39 Temporal, ISO 8601, the RFCs and the realm's industry standards
  only; no statute, regulation number, agency, court decision or jurisdiction label appears in
  code, JSDoc or on the docs site. A function is generic or it is not shipped; a docs example is
  labelled by its numbers ("30-day windows", "a 14/14/45 contract", "an 11-hour cap inside a
  14-hour window"), never by a jurisdiction or a body. Evidence records — `painpoints.md` and
  `research/*.md` — may cite law as proof that a painpoint exists and that its numbers are real;
  nothing downstream of them (specs, code, docs, changesets, issue titles) may. Reading public
  regulation text during research is fine; shipping it is not.

---

## Deleted Packages

| Package                | Action | Reason                                                                 |
| ---------------------- | ------ | ---------------------------------------------------------------------- |
| `@northguild/gmt-time` | Delete | Value (`toNanoseconds`, `fromNanoseconds`) moved to core.              |
| `@northguild/gmt-otel` | Delete | Too niche. Precision primitives in core serve all telemetry consumers. |

Both packages were never shipped to npm. No migration path needed.
