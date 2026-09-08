# GMT Realms Epic — Overview

> `@northguild/gmt` expands from a single Earth-Reference datetime library into a multi-realm
> temporal library. Each realm is an expert-quality module for a specific temporal domain.

---

## What This Epic Is

GMT currently handles **one temporal domain**: Earth Reference time (IANA timezones, UTC, DST transitions). Real-world applications span multiple domains with distinct semantics:

| Domain                 | Semantics                                       | Example use cases                         |
| ---------------------- | ----------------------------------------------- | ----------------------------------------- |
| **Earth Reference**    | IANA timezones, DST, civil calendars            | Current GMT                               |
| **Precision / Core**   | Nanosecond conversion, span durations           | OTel, Prometheus, Kafka, PostGIS          |
| **IoT / Continuous**   | Monotonic clocks, device sync, span math        | Sensor events, profiling                  |
| **Healthcare**         | HL7 v2.x, FHIR R4 datetime formats              | Patient records, lab timestamps           |
| **Finance**            | Trading calendars, business day math            | NYSE close, holiday calendars             |
| **Transport (shared)** | Transit time, dwell, ETA, multi-leg scheduling  | Shared across all transport modes         |
| **Maritime**           | GPS + UTC dual-mode, AIS, MMSI                  | Ship navigation, port calls               |
| **Aviation**           | Flight schedules, crew duty, NOTAM, airline ops | Airlines, airports, crew scheduling       |
| **Rail**               | Cross-border schedules, UIC timing, shunting    | Rail operators, freight rail              |
| **Intermodal**         | Container tracking, B/L, port dwell, customs    | Multimodal freight (ocean + truck + rail) |
| **Space / Celestial**  | TAI, GPS, TT, TDB, leap seconds, CCSDS          | Satellite ops, orbital mechanics          |

Each realm is an **inner module** under `packages/gmt/src/`. Single package, tree-shakeable, shared Temporal dependency.

---

## Key Decisions

| Decision               | Choice                                                                                                                                 |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Drop gmt-otel?         | **Yes** — too niche. Telemetry consumers use core GMT primitives directly.                                                             |
| Drop gmt-time package? | **Yes** — its value (`toNanoseconds`, `fromNanoseconds`) moves into core GMT.                                                          |
| Realm architecture     | **Inner modules** — `@northguild/gmt/space`, `@northguild/gmt/finance`, etc.                                                           |
| Realm build order      | **Ease first** — IoT → Healthcare → Finance → Transport → Maritime → Aviation → Rail → Intermodal → Space                              |
| Space scales           | **Function-based** — `toTAI()`, `toGPS()`, etc. Industry standard (SPICE, SOFA, astropy pattern).                                      |
| Leap seconds           | **Handle correctly** — Space/Celestial realm needs IERS data. Other realms don't care.                                                 |
| Telemetry role         | **Output layer, not a realm** — every realm produces telemetry. GMT provides correct timestamps. Transport format is consumer-defined. |

---

## Architecture

```
@js-temporal/polyfill  ──►  @northguild/gmt  ──►  @northguild/gmt (published)
                                │
                                └── src/
                                    ├── plain/          (existing)
                                    ├── zoned/           (existing)
                                    ├── utc/             (existing)
                                    ├── unix/            (existing)
                                    ├── duration/         (existing)
                                    ├── regex/            (existing)
                                    │
                                    ├── precision/        (CORE-1: toNanoseconds, fromNanoseconds)
                                    ├── span/             (CORE-2: spanMs, spanNs)
                                    ├── iot/              (IOT-1)
                                    ├── health/           (HLTH-1, HLTH-2)
                                    ├── finance/          (FIN-1, FIN-2)
                                    ├── transport/        (TRAN-1, TRAN-2)
                                    ├── maritime/         (MAR-1, MAR-2)
                                    ├── aviation/         (AV-1, AV-2)
                                    ├── rail/             (RAI-1, RAI-2)
                                    ├── intermodal/       (INT-1, INT-2)
                                    └── space/            (SPA-1, SPA-2, SPA-3, SPA-4)

packages/gmt-time/ (DELETE — value moved to core)
packages/gmt-otel/ (DELETE — too niche)
```

---

## What's in Core After This Epic

### Existing (unchanged)

- `gmt/plain/` — Plain date/time (no timezone)
- `gmt/zoned/` — IANA timezone-aware datetime
- `gmt/utc/` — UTC datetime
- `gmt/unix/` — Unix epoch timestamps
- `gmt/duration/` — Duration arithmetic
- `gmt/regex/` — ISO 8601 parsing

### New Core Additions

| Function          | Signature                                            | Returns                                       |
| ----------------- | ---------------------------------------------------- | --------------------------------------------- |
| `toNanoseconds`   | `(isoString: string) => bigint`                      | Nanosecond timestamp since Unix epoch.        |
| `fromNanoseconds` | `(nanoseconds: bigint, timezone?: string) => string` | ISO string from nanoseconds.                  |
| `spanMs`          | `(start: string, end: string) => number`             | Millisecond duration between two ISO strings. |
| `spanNs`          | `(start: string, end: string) => bigint`             | Nanosecond duration between two ISO strings.  |

These are universal primitives — they serve all realms and all observability consumers (OTel, Prometheus, Kafka, PostGIS, custom telemetry).

---

## Realm Specifications

### Realm 1 — IoT / Continuous Time

**Closest to existing GMT infrastructure.** Monotonic clocks, device time synchronization, span duration math.

| Function       | Signature                                                                       | Returns                                        |
| -------------- | ------------------------------------------------------------------------------- | ---------------------------------------------- |
| `monotonicNow` | `() => string`                                                                  | Monotonic ISO timestamp (wall clock agnostic). |
| `deviceSync`   | `(deviceTime: string, serverTime: string) => { drift: number, offset: number }` | Clock drift and offset.                        |
| `deviceTimeAt` | `(serverTime: string, drift: number, offset: number) => string`                 | Estimate device clock at server time.          |

### Realm 2 — Healthcare

**Well-defined standards.** HL7 v2.x formatting/parsing, FHIR R4 datetime correctness.

| Function               | Signature                         | Returns                                    |
| ---------------------- | --------------------------------- | ------------------------------------------ |
| `formatHL7`            | `(isoString: string) => string`   | ISO → HL7 v2.x timestamp (YYYYMMDDHHMMSS). |
| `parseHL7`             | `(hl7String: string) => string`   | HL7 → ISO 8601 string.                     |
| `formatHL7Full`        | `(isoString: string) => string`   | HL7 with sub-second precision.             |
| `formatFHIR`           | `(isoString: string) => string`   | ISO → FHIR datetime.                       |
| `parseFHIR`            | `(fhirString: string) => string`  | FHIR → ISO 8601 string.                    |
| `isValidFHIRPrecision` | `(fhirString: string) => boolean` | Validates FHIR precision level.            |

### Realm 3 — Finance

**Business day math and trading calendars.** Holiday data is the hardest part.

| Function              | Signature                                          | Returns                                |
| --------------------- | -------------------------------------------------- | -------------------------------------- |
| `isMarketOpen`        | `(isoString: string, exchange: string) => boolean` | Is this timestamp during market hours? |
| `marketOpenAt`        | `(isoString: string, exchange: string) => string`  | Market open time for this day.         |
| `marketCloseAt`       | `(isoString: string, exchange: string) => string`  | Market close time for this day.        |
| `nextBusinessDay`     | `(isoString: string, options?) => string`          | Next business day.                     |
| `previousBusinessDay` | `(isoString: string, options?) => string`          | Previous business day.                 |
| `businessDaysBetween` | `(start: string, end: string, options?) => number` | Count business days between dates.     |

**Phase 1 exchanges:** NYSE, NASDAQ, LSE, TYO, EURONEXT. Holiday data: hardcoded static data.

### Realm 4 — Transport (shared overlap)

**Shared transport utilities.** All transport modes use these.

| Function           | Signature                                                                                                 | Returns                                     |
| ------------------ | --------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| `transitTime`      | `(departure: string, duration: string) => string`                                                         | Arrival time from departure + duration.     |
| `etaAtZone`        | `(arrivalUtc: string, targetZone: string) => string`                                                      | UTC arrival → zone-local display time.      |
| `dwellTime`        | `(entry: string, exit: string, targetZone?: string) => { duration: string, enter: string, exit: string }` | Time spent in a zone with zone-local times. |
| `scheduleDelivery` | `(legs: Leg[], options?) => { eta: string, legTimes: string[] }`                                          | Multi-leg journey ETA (any mode).           |
| `crossingTime`     | `(entry: string, exit: string, targetZone: string) => { duration: string, enter: string, exit: string }`  | Zone-local crossing times.                  |

### Realm 5 — Maritime

**GPS + UTC dual-mode.** Ships, AIS, MMSI.

| Function        | Signature                                        | Returns                                   |
| --------------- | ------------------------------------------------ | ----------------------------------------- |
| `gpsToUtc`      | `(gpsString: string) => string`                  | GPS timestamp → UTC ISO string.           |
| `utcToGps`      | `(utcString: string) => string`                  | UTC → GPS timestamp.                      |
| `navTimestamp`  | `(isoString: string) => string`                  | Format for maritime/aerospace navigation. |
| `mmsiTimestamp` | `(mmsi: string, embeddedTime: string) => string` | Extract/reconstruct timestamp from MMSI.  |

### Realm 6 — Aviation

**Full aviation stack.** Flight scheduling, crew duty, airline ops, NOTAM.

| Function         | Signature                                                                                                                                    | Returns                                      |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `flightLeg`      | `(departure: string, arrival: string, options?) => { duration: string, zonesCrossed: number, localDeparture: string, localArrival: string }` | Flight leg with timezone crossing.           |
| `crewDutyWindow` | `(start: string, end: string, maxHours: number) => { withinLimit: boolean, remaining: string }`                                              | Crew duty time limit check.                  |
| `airportCurfew`  | `(isoString: string, airport: string) => { inCurfew: boolean, curfewStart: string, curfewEnd: string }`                                      | Airport curfew check.                        |
| `blockTime`      | `(offBlocks: string, onBlocks: string) => string`                                                                                            | Flight block time (chocks-off to chocks-on). |
| `scheduledTime`  | `(isoString: string, airport: string) => string`                                                                                             | Scheduled UTC → airport local time.          |
| `notamTimestamp` | `(notamString: string) => string`                                                                                                            | Parse NOTAM timestamp → ISO 8601.            |

### Realm 7 — Rail

**Cross-border schedules, UIC timing, shunting.**

| Function              | Signature                                                                                                                                                           | Returns                             |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| `railLeg`             | `(departure: string, arrival: string, options?) => { duration: string, zonesCrossed: number, localDeparture: string, localArrival: string, usesSingleTZ: boolean }` | Rail leg with single-TZ awareness.  |
| `crossBorderSchedule` | `(departure: string, borderCrossing: string, destinationZone: string) => { beforeBorder: string, afterBorder: string, transitionPoint: string }`                    | Timezone transition at rail border. |
| `uicDwellTime`        | `(arrival: string, departure: string, station: string) => number`                                                                                                   | Dwell time in minutes (UIC 9602).   |
| `shuntingWindow`      | `(available: string, operations: string[]) => { earliest: string, latest: string, feasible: boolean }`                                                              | Shunting yard scheduling.           |

### Realm 8 — Intermodal

**Container tracking, B/L, port dwell, customs.**

| Function           | Signature                                                                                                     | Returns                             |
| ------------------ | ------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| `containerLeg`     | `(leg: Leg) => { arrival: string, mode: string, origin: string, destination: string }`                        | Container arrival for a single leg. |
| `portDwell`        | `(entry: string, exit: string, port: string) => { dwellHours: number, inFreeTime: boolean }`                  | Port/terminal dwell time.           |
| `customsClearance` | `(arrival: string, port: string) => { clearanceStart: string, clearanceEnd: string, estimatedHours: number }` | Customs processing window.          |
| `bolTimestamp`     | `(bolDate: string, format: 'issue' \| 'onBoard' \| 'received') => string`                                     | Bill of lading timestamp.           |
| `multimodalETA`    | `(legs: Leg[], options?) => { eta: string, totalLegs: number, totalDwell: string }`                           | End-to-end multimodal ETA.          |

### Realm 9 — Space / Celestial

**Most complex, most differentiated.** Time reference frames, leap seconds, CCSDS formats.

| Function                | Signature                                       | Returns                                      |
| ----------------------- | ----------------------------------------------- | -------------------------------------------- |
| `toTAI`                 | `(isoString: string) => string`                 | ISO UTC → TAI scale string.                  |
| `fromTAI`               | `(taiString: string) => string`                 | TAI → ISO UTC.                               |
| `toGPS`                 | `(isoString: string) => string`                 | ISO UTC → GPS scale string.                  |
| `fromGPS`               | `(gpsString: string) => string`                 | GPS → ISO UTC.                               |
| `toTT`                  | `(isoString: string) => string`                 | ISO UTC → TT (Terrestrial Time).             |
| `fromTT`                | `(ttString: string) => string`                  | TT → ISO UTC.                                |
| `toTDB`                 | `(isoString: string) => string`                 | ISO UTC → TDB (Barycentric Dynamical Time).  |
| `fromTDB`               | `(tdbString: string) => string`                 | TDB → ISO UTC.                               |
| `leapSecondsBetween`    | `(start: string, end: string) => number`        | Leap seconds inserted between two UTC dates. |
| `isLeapSecond`          | `(isoString: string) => boolean`                | Is this a valid leap second (23:59:60)?      |
| `instantToJulianDate`   | `(isoString: string) => number`                 | Convert to Julian Date.                      |
| `instantFromJulianDate` | `(jd: number) => string`                        | Parse Julian Date → ISO.                     |
| `instantToJ2000Seconds` | `(isoString: string, scale?: string) => number` | Seconds since J2000 epoch.                   |

**String format:** SPICE-style scale designators: `'2026-01-01T00:00:37 TAI'`, `'2026-01-01T00:00:00 TDB'`.

**IERS data:** Bundle latest IERS Bulletin C at build time. Document update cadence.

**TDB-TT correction:** Start with simplified formula (~50µs). Full Fairhead & Bretagnon (1990) model as future story.

---

## What is NOT Part of This Epic

| Not included               | Reason                                                                                            |
| -------------------------- | ------------------------------------------------------------------------------------------------- |
| OTel integration           | Precision functions in core serve all telemetry consumers. OTel SDK docs explain how to use them. |
| Weather/climate timestamps | netCDF, GRIB files. Domain expertise beyond time math.                                            |
| Legal timestamps           | Certificate-based, PKI, court filing. Future realm.                                               |
| Gaming timestamps          | Frame-relative time, lag compensation. Separate domain.                                           |
| Historical dates           | Julian calendars, pre-1582. Complex localization. Future work.                                    |
| Recurrence / iCal          | RFC 5545. Different concern from point-in-time math.                                              |

---

## Build Order

```
Core Foundation
├── CORE-1  Precision bridge: toNanoseconds + fromNanoseconds         (easiest)
└── CORE-2  Span durations: spanMs + spanNs                           (easy)

Realm 1 — IoT / Continuous Time
└── IOT-1   Monotonic now, device sync, device time estimation

Realm 2 — Healthcare
├── HLTH-1  HL7 v2.x formatting/parsing
└── HLTH-2  FHIR R4 datetime support

Realm 3 — Finance
├── FIN-1   Market hours: isMarketOpen, marketOpenAt, marketCloseAt
└── FIN-2   Business day math: nextBusinessDay, businessDaysBetween

Realm 4 — Transport (shared overlap)
├── TRAN-1  Transit time + ETA + dwell
└── TRAN-2  Multi-leg scheduling + crossing time

Realm 5 — Maritime
├── MAR-1   GPS ↔ UTC conversion: gpsToUtc, utcToGps
└── MAR-2   Navigation timestamps: navTimestamp, mmsiTimestamp

Realm 6 — Aviation
├── AV-1    Flight schedules: flightLeg, crewDutyWindow, airportCurfew
└── AV-2    Airline timing: blockTime, scheduledTime, notamTimestamp

Realm 7 — Rail
├── RAI-1   Rail schedules: railLeg, crossBorderSchedule
└── RAI-2   UIC timing: uicDwellTime, shuntingWindow

Realm 8 — Intermodal
├── INT-1   Container tracking: containerLeg, portDwell, customsClearance
└── INT-2   Bill of lading: bolTimestamp, multimodalETA

Realm 9 — Space / Celestial (hardest, most differentiated)
├── SPA-1   Scale conversion: toTAI, toGPS, fromTAI, fromGPS
├── SPA-2   TT + TDB: toTT, fromTT, toTDB, fromTDB
├── SPA-3   Leap seconds: leapSecondsBetween, isLeapSecond
└── SPA-4   Julian Date + J2000: instantToJulianDate, instantFromJulianDate, instantToJ2000Seconds
```

Each realm's stories are order-locked within the realm. Realms are independent of each other — they can be built concurrently by different developers.

---

## Risks

| Risk                         | Mitigation                                                          |
| ---------------------------- | ------------------------------------------------------------------- |
| Holiday calendar maintenance | Start hardcoded. Plan for external API (nasdaq, holidays-api).      |
| IERS data staleness          | Bundle Bulletin C at build. Document update cadence.                |
| Transport scope creep        | Keep to time math only. Routing/optimization is consumer's problem. |
| Aviation complexity          | Crew duty limits vary by jurisdiction. Caller passes maxHours.      |
| Rail single-TZ awareness     | Start with hardcoded list. Plan for external registry.              |
| Space realm complexity       | Model against `astrotime` (validated against SPICE).                |
| TDB-TT accuracy              | Simplified formula first. Fairhead & Bretagnon as separate story.   |
| Bundle size bloat            | Inner modules are tree-shakeable. Monitor with `size-limit`.        |

---

## References

- `context/domination/issues/` — Story specs (CORE-1 through SPA-4)
- `context/domination/tracker.md` — Stories table and build dependencies
- `context/misc/spacetime-reference-frames.md` — Research on space/satellite time standards
- CCSDS 301.0-B-4 — Time Code Formats
- CCSDS 502.0-B-3 — Orbit Data Messages
- NAIF SPICE Time Subsystem — TDB/TT conversion reference
- ERFA/SOFA — TDB-TT Fairhead & Bretagnon model
- `astrotime` — JS reference for space time (validated against SPICE)
- IATA SSIM — Standard Schedules Information Manual
- UIC 9602 — Rail running time and dwell time
- ICAO Doc 8643 — Aircraft type designators
