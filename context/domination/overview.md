# GMT Realms Epic — Overview

> `@northguild/gmt` expands from a single Earth-Reference datetime library into a multi-realm
> temporal library. Each realm is an expert-quality module for a specific temporal domain.

---

## What This Epic Is

GMT currently handles **one temporal domain**: Earth Reference time (IANA timezones, UTC, DST
transitions). Real-world applications span multiple domains with distinct semantics.

| Domain                 | Semantics                                             | Example use cases                    |
| ---------------------- | ----------------------------------------------------- | ------------------------------------ |
| **Earth Reference**    | IANA timezones, DST, civil calendars                  | Current GMT                          |
| **Core / Precision**   | Nanoseconds, spans, calendars, intervals, offsets     | Everything below depends on it       |
| **Transport (shared)** | Transit, dwell, ETA, multi-leg, cut-offs              | Shared across all transport modes    |
| **Intermodal**         | Containers, demurrage, filing deadlines, EDI          | Ocean freight, multimodal logistics  |
| **Maritime**           | GPS/UTC, AIS, ship's time, laytime                    | Ship navigation, chartering          |
| **Road**               | FMCSA and EU driver hours of service                  | Trucking, fleet compliance           |
| **Rail**               | Cross-border schedules, GTFS service days             | Rail operators, transit data         |
| **Aviation**           | Flight legs, IATA seasons, crew duty, NOTAM           | Airlines, airports, crew scheduling  |
| **IoT / Continuous**   | Monotonic clocks, PTP, clock drift, ingest lag        | Sensors, telemetry, observability    |
| **Healthcare**         | HL7 v2, FHIR, DICOM, clinical age, dosing windows     | Patient records, imaging, pharmacy   |
| **Finance**            | Sessions, day counts, settlement, tenors              | Trading, settlement, fixed income    |
| **Space / Celestial**  | TAI, GPS, TT, TDB, leap seconds, CCSDS, Mars          | Satellite ops, orbital mechanics     |

Each realm is an **inner module** under `packages/gmt/src/`. Single package, tree-shakeable,
shared Temporal dependency.

**Start here:** [painpoints.md](painpoints.md) records the researched evidence behind every
realm. [tracker.md](tracker.md) has the 75 stories in build order, and [research/realm-gap-spike-2026-09.md](research/realm-gap-spike-2026-09.md) records the September 2026 pass that took it from 54.

---

## Key Decisions

| Decision                    | Choice                                                                                                                                                    |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Drop gmt-otel?              | **Yes** — too niche. Telemetry consumers use core GMT primitives directly.                                                                                |
| Drop gmt-time package?      | **Yes** — its value (`toNanoseconds`, `fromNanoseconds`) moves into core GMT.                                                                             |
| Realm architecture          | **Inner modules** — `@northguild/gmt/space`, `@northguild/gmt/finance`, etc.                                                                              |
| Realm build order           | **Value first** — Core → Logistics/Transport → IoT → Healthcare → Finance → Space.                                                                        |
| Bundled place registries    | **No.** GMT takes IANA zones and calendars as parameters. It does not map UN/LOCODE, IATA, ICAO or UIC codes to timezones. Parked as separate future work. |
| Bundled reference data      | **Opt-in subpaths only** — `…/data`, never the default import path. Each records source, revision and validity.                                           |
| Space scales                | **Function-based** — `toTAI()`, `toGPS()`, etc. Industry standard (SPICE, SOFA, astropy pattern).                                                          |
| Leap seconds                | **Handle correctly** — `SPA-48` owns the IERS table; `MAR-16` and `IOT-31` consume it.                                                                    |
| Telemetry role              | **Output layer, not a realm** — every realm produces telemetry. GMT provides correct timestamps.                                                          |
| Invented quantities         | **Forbidden.** If a value cannot be derived from the inputs, the function does not return it.                                                              |
| Calendar semantics          | **TC39 Temporal is the authority.** Arithmetic clamps a non-existent day (`overflow: "constrain"`); parsers reject. Matches EU, UK and US law and every major library but date-fns. |
| Zone-aware boundaries       | **Real boundaries, never truncate-and-re-resolve.** `start ≤ input < next start`, via `internal/zonedBucket.ts`; tested on the probe zones. See [coding-standards § Calendar & zone semantics](../coding-standards.md#calendar--zone-semantics). |

### Why the build order changed

The original plan ordered realms by implementation ease — IoT, then Healthcare, then Finance,
with Transport fourth and the logistics realms after that. That buried the highest-value work
behind three lower-value realms.

The order is now by value, and it forced a structural change: business-day math, holiday
calendars and interval algebra were all specced inside Finance, but logistics needs every one
of them. They moved into Core (`CORE-5`, `CORE-6`, `CORE-7`), which is why Core grew from two
stories to seven.

### Why there are no bundled registries

Resolving a port, airport or station code to a timezone is a real, unsolved gap in the JS
ecosystem. It is also a data-maintenance commitment that would make GMT wrong on someone
else's schedule.

The rule adopted here: **GMT does time math, and the caller supplies the facts.** Zones,
calendars, contract terms, regulatory tables and filing rules are all parameters. Where
convenience data is genuinely useful, it ships behind an opt-in `…/data` subpath with recorded
provenance and a staleness check.

This rule also resolved several defects in the original plan, which hardcoded a four-port
free-time table, a four-airport curfew table and a three-country rail timezone table — none of
which were correct, complete, or GMT's facts to assert.

---

## Architecture

```
@js-temporal/polyfill  ──►  @northguild/gmt  ──►  @northguild/gmt (published)
                                │
                                └── src/
                                    ├── plain/          (existing)
                                    ├── zoned/          (existing)
                                    ├── utc/            (existing)
                                    ├── unix/           (existing)
                                    ├── duration/       (existing)
                                    ├── regex/          (existing)
                                    │
                                    ├── precision/      (CORE-1, CORE-3, CORE-56)
                                    ├── span/           (CORE-2)
                                    ├── instant/        (CORE-4)
                                    ├── calendar/       (CORE-5, CORE-7, CORE-54, CORE-55)
                                    ├── interval/       (CORE-6)
                                    │
                                    ├── transport/      (TRAN-8 … TRAN-10, TRAN-57)
                                    ├── intermodal/     (INT-12 … INT-15, INT-58)
                                    │   └── data/       (opt-in: filing-rule table)
                                    ├── road/           (ROAD-20, ROAD-21, ROAD-61, ROAD-62)
                                    ├── maritime/       (MAR-16 … MAR-19, MAR-59, MAR-60)
                                    ├── aviation/       (AV-25 … AV-28, AV-64, AV-65)
                                    │   └── data/       (opt-in: curfews, FDP tables)
                                    ├── rail/           (RAI-22 … RAI-24, RAI-63)
                                    ├── iot/            (IOT-29 … IOT-32, IOT-66)
                                    ├── health/         (HLTH-33 … HLTH-39, HLTH-67 … HLTH-70)
                                    ├── finance/        (FIN-40 … FIN-45, FIN-71 … FIN-73)
                                    │   └── data/       (opt-in: exchange calendars)
                                    └── space/          (SPA-46 … SPA-53, SPA-74, SPA-75)
                                        └── data/       (leap seconds, Bulletin A)

packages/gmt-time/ (DELETE — value moved to core)
packages/gmt-otel/ (DELETE — too niche)
```

Each realm follows the existing three-level convention
(`src/<realm>/<category>/<functionName>.ts`), one exported function per file, colocated
`.test.ts`, `index.ts` barrels at every level. Each new realm needs hand-written entries
block in `packages/gmt/package.json` `exports` (`"./realm"` plus one explicit `"./realm/<category>"`
entry per category barrel, mirrored in `typesVersions`).

---

## What's in Core After This Epic

### Existing (unchanged)

`gmt/plain/`, `gmt/zoned/`, `gmt/utc/`, `gmt/unix/`, `gmt/duration/`, `gmt/regex/`.

### New core modules

| Module       | Story          | What it provides                                                          |
| ------------ | -------------- | ------------------------------------------------------------------------- |
| `precision/` | CORE-1, CORE-3, CORE-56 | Nanosecond bridge, JSON serialisation, foreign epoch conversion, timestamps inside identifiers and data-platform encodings |
| `span/`      | CORE-2         | Exact and wall-clock spans                                                 |
| `instant/`   | CORE-4         | Instant-plus-offset pairs, explicit local-time resolution                 |
| `calendar/`  | CORE-5, CORE-7, CORE-54, CORE-55 | ISO week, ordinal, fiscal periods, zone-aware buckets, business calendars, holiday rules, operating hours |
| `interval/`  | CORE-6         | Overlap, intersect, clamp, subtract, merge, split, sum                     |

These are universal primitives. `interval/` and `calendar/` in particular are consumed by
laytime, driver hours, free time, market sessions and medication windows — five realms that
would otherwise each implement interval arithmetic and disagree about boundaries. The
September 2026 spike added `CORE-54` … `CORE-56` for the same reason: holiday rules, weekly
opening windows and identifier timestamps were each about to be written several times.

---

## Corrections to the Previous Plan

The first draft of this epic specified functions that do not correspond to reality. They are
replaced rather than patched, and each replacement issue carries a `## Corrections` section
recording what was removed and why, so the same API is not re-derived later.

| Story  | Removed                                     | Why                                                                                                         |
| ------ | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| MAR-17 | `mmsiTimestamp(mmsi, embeddedTime)`         | An MMSI is a nine-digit identity (`MIDXXXXXX`). It contains no timestamp, and the spec's "bits 20–47" do not exist in a nine-digit number. |
| INT-13 | `customsClearance(...) => estimatedHours`   | A time library cannot predict how long a customs authority takes. Replaced by advance-filing deadline math, which is deterministic. |
| TRAN-8 | `portDwell(..., port) => inFreeTime`        | Free time is set by carrier, lane and service contract — not by port. The hardcoded table encoded a non-fact. |
| IOT-30 | `deviceSync(deviceTime, serverTime)`        | Two timestamps cannot separate offset from drift. Replaced by the NTP four-timestamp exchange.               |
| IOT-29 | `monotonicNow(): string`                    | A monotonic reading has no wall-clock meaning; formatting it as ISO invites the misuse it should prevent.     |
| SPA-49 | `instantToJulianDate(): number`             | A single-double JD resolves to only ~100 µs. Replaced by a two-part JD, as used by ERFA and astropy.        |
| AV-27  | `crewDutyWindow(start, end, maxHours)`      | Max FDP is a table lookup on report time, sectors and acclimatisation — the caller does not know `maxHours` either. |
| FIN-40 | `isMarketOpen(iso, exchange)`               | Wrong for lunch-break markets (TYO, HKEX) and every half-day close. A trading day is a list of sessions.      |
| RAI-23 | The `UIC 9602` citation                     | **Does not verify.** No such leaflet; the number does not match UIC's scheme. The real reference is UIC 406. |
| SPA-48 | Leap-second acceptance criteria             | Claimed a leap second in 2022 (there was none) and ~10 between 2000–2024 (there were 5).                      |
| SPA-46 | `GPS − UTC = -18s`                          | Sign backwards — GPS runs **ahead** of UTC. The same error appeared in the original MAR-1, compounded by asserting an 18 s offset at the GPS epoch, where it was 0. |
| AV-28  | `notamTimestamp` parsing `DDHHMM`           | That is the METAR format. ICAO NOTAM items B) and C) use ten-digit `YYMMDDHHMM`, plus `EST` and `PERM`.       |
| FIN-42 | `'30/360 US'`, `'30/360 ISDA'`, `'30E+/360'` | Not ISDA or FpML codes. The set is FpML's; the February rule belongs to `30E/360.ISDA`; `ACT/ACT.ICMA`, `ACT/365L`, `BUS/252`, `RBA` were missing. |
| ROAD-20 | Day boundaries "local"                     | The FMCSA day begins "at the time designated by the motor carrier" for the home terminal (49 CFR 395.2); §395.5 has no 34-hour restart. |
| ROAD-21 | Fortnight as a rolling 14 × 24 h window    | The week is fixed Monday 00:00 – Sunday 24:00 (Art 4(i)); the fortnight is two adjacent fixed weeks.          |
| MAR-19 | Gencon NOR after noon → 08:00 next working day | Gencon 94 cl. 6(c) says **06:00**, and time used before commencement counts.                              |
| RAI-23 | UIC 406 blocking-time component list        | The leaflet is paid and its text was not reached; a list from secondary papers is not a citation. Components are the caller's. |
| SPA-47 | TT and TDB in one story, depending on SPA-49 | TDB and TCB moved to SPA-74; TT and TCG need no Julian Date. The mutual dependency is gone.                  |
| IOT-30 | Uncertainty half-width δ/2                  | RFC 5905's correctness interval uses λ = ε + δ/2; the delay-only form understates it.                          |
| AV-64  | AIRAC anchor as bundled data; 42 days a Standard | Annex 15 §6.2.1 names 8 November 2018; 28 days is the Standard, 42 a Note, 56 a Recommendation.           |

---

## What is NOT Part of This Epic

| Not included               | Reason                                                                              |
| -------------------------- | ------------------------------------------------------------------------------------- |
| Place registries           | UN/LOCODE, IATA, ICAO, UIC → IANA zone. Real gap, but a data commitment. Parked.     |
| tzdb version pinning       | Reproducing historical conversions exactly. Temporal exposes no version hook.        |
| OTel integration           | Precision functions in core serve all telemetry consumers.                            |
| Weather/climate timestamps | netCDF, GRIB files. Domain expertise beyond time math.                                |
| Legal timestamps           | Certificate-based, PKI, court filing. Future realm.                                   |
| Gaming timestamps          | Frame-relative time, lag compensation. Separate domain.                               |
| Historical dates           | Julian calendars, pre-1582. Complex localization. Future work.                        |
| Recurrence / iCal          | RFC 5545. Different concern from point-in-time math.                                  |
| Routing and optimisation   | GMT does time math. Route selection is the consumer's problem.                        |

See [painpoints.md](painpoints.md) for the full parked list with reasons.

---

## Risks

| Risk                          | Mitigation                                                                          |
| ----------------------------- | ------------------------------------------------------------------------------------- |
| Epic size (75 stories)        | Phase boundaries are clean cut points. Phases 1–2 deliver the priority realms alone.  |
| Bundled data staleness        | Every data module exposes provenance and a staleness predicate. Never on the hot path.|
| Holiday calendar maintenance  | Caller-supplied by default. Opt-in reference calendars carry coverage windows.        |
| IERS data staleness           | Bundle Bulletin C and A at build. `isTableStale` / `isUt1Stale` surface expiry.       |
| Regulatory tables drift       | FDP tables, driver hours and filing rules are parameters or opt-in data, not logic.   |
| Transport scope creep         | Time math only. Routing and optimisation are the consumer's problem.                  |
| Safety-critical approximation | AV-27 and ROAD-* document unimplemented rules rather than approximating them.         |
| Space realm complexity        | Model against `astrotime` and ERFA. Accuracy limits stated as numbers in JSDoc.       |
| TDB-TT accuracy               | Simplified formula first. Fairhead & Bretagnon parked as a separate story.            |
| Bundle size bloat             | Inner modules tree-shakeable; data behind subpaths. Monitor with `size-limit`.        |
| Re-derivation of bad APIs     | Every replacement carries a `## Corrections` section. Do not undo without a source.   |

---

## References

- [painpoints.md](painpoints.md) — researched evidence per realm, with citations
- [tracker.md](tracker.md) — 75 stories, `Blocked by` column, Definition of Done
- [research/realm-gap-spike-2026-09.md](research/realm-gap-spike-2026-09.md) — the September 2026 research spike: corrections, additions and what could not be verified
- [issues/](issues/) — story specs, one file per story, named by story ID
- [research/spacetime-reference-frames.md](research/spacetime-reference-frames.md) — research on space/satellite time standards

Standards cited by stories in this epic, each verified against a primary source:

- CCSDS 301.0-B-4 — Time Code Formats (CUC §3.2, CDS §3.3, ASCII §3.5)
- CCSDS 502.0-B-3 — Orbit Data Messages
- ITU-R M.585 — Assignment and use of maritime mobile service identities
- IEEE 1588 / 802.1AS — Precision Time Protocol
- UN/EDIFACT DTM — date/time/period segment, format qualifiers 102 / 203 / 303 / 304
- GS1 EPCIS 2.0 — `eventTime` + `eventTimeZoneOffset`
- DCSA Track & Trace — `eventDateTime`, `eventClassifierCode`
- GTFS — `stop_times`, service days, "noon minus 12h"
- FAA 14 CFR Part 117 / EASA ORO.FTL.205 — flight duty period tables
- FMCSA 49 CFR Part 395 / EU Regulation (EC) No 561/2006 — driver hours
- HL7 v2.x DTM, FHIR R4, DICOM PS3.5 §6.2 — clinical and imaging timestamps
- UIC 406 — capacity, blocking time and dwell (**not** "UIC 9602", which does not exist)
- IERS Bulletin A (Earth orientation) and Bulletin C (leap seconds); IERS Conventions (2010) ch. 10
- IAU 2000 Resolution B1.9 (TT/TCG rate) and IAU 2006 Resolution B3 (TDB/TCB)
- NAIF SPICE — TDB/TT conversion and SCLK reference; CHRONOS time types
- ERFA / SOFA — two-part Julian Date, Fairhead & Bretagnon TDB−TT model
- IATA SSIM — Standard Schedules Information Manual (paid; field layout labelled secondary)
- 49 CFR 395.1, 395.2, 395.3, 395.5 and Subpart B Appendix A — FMCSA hours of service and ELDs
- SOR/2005-313 — Canadian Commercial Vehicle Drivers Hours of Service Regulations
- 49 U.S.C. §§21103–21104 — railroad hours of service
- 14 CFR 117.3, 117.23, 117.25; ORO.FTL.105, .210, .235 (Regulation (EU) 83/2014) — crew limits
- 14 CFR 234.2, 234.4 — on-time performance and OOOI reporting
- ICAO Annex 15 ch. 6 (AIRAC); EUROCONTROL OPADD 4.1 (NOTAM item D); WMO-No. 306 FM 51 (TAF)
- BIMCO Laytime Definitions for Charter Parties 2013; Gencon 1994 cl. 6(c); *Dias v Louis Dreyfus* [1978] 1 WLR 261
- MLC 2006 Standard A2.3; STCW Code A-VIII/1 (Manila) via UK MCA MGN 566
- Bowditch, *The American Practical Navigator* (2019) ch. 16 §1607; ACP 121(G) para 317c
- IS-GPS-200N; Galileo OS SIS ICD 2.0; BDS-SIS-ICD 2.0; GLONASS ICD 5.1; IS-QZSS-PNT-003
- 46 CFR Part 541 — FMC demurrage and detention billing
- 19 CFR 149.2, 19 CFR 4.7, 33 CFR 160.212; DA (EU) 2015/2446 Art 105–106; SOR/86-873 — advance filing
- X12 data elements 623 and 1250; UN/EDIFACT data element 2379
- Decision (EU) 2017/2075 Annex VII — rail working timetable; railML `operatingPeriod`
- RFC 5905 (NTP); RFC 9562 (UUID); Kulkarni et al. 2014 (HLC); Corbett et al. 2012 (Spanner); Akidau et al. 2015 (Dataflow)
- HL7 v2.5.1 ch. 2A; FHIRPath N1 / v3.0.0; CQL v2.0.0 Appendix B; FHIR R4 `Timing`
- AAP 2004 age terminology; ACOG Committee Opinion 700; CDC ACIP GBP and CDSi 4.6; PQA PDC; CMS MBPM ch. 3 §20.1; 42 CFR 412.3; ACGME CPR
- FpML day-count-fraction 2-3, business-center 9-4, `CalculationPeriodDates`, `RollConventionEnum`; ISDA 2006 Definitions §4.16 with Supplements 14 and 43; ISDA RFR memorandum; ARRC SOFR guide; ISDA CDS roll FAQ (2015)
- FIX Latest data types; SWIFT MT fields 32A, 13C, 13D; RTS 25 (Regulation (EU) 2017/574)
- 5 U.S.C. §6103 — US federal holidays and observance
- D. J. Bernstein, libtai TAI64; Espenak & Meeus ΔT polynomials; USNO rise/set definitions; NOAA solar calculator
