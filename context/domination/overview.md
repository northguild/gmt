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
realm. [tracker.md](tracker.md) has the 53 stories in build order.

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
                                    ├── precision/      (CORE-1, CORE-3)
                                    ├── span/           (CORE-2)
                                    ├── instant/        (CORE-4)
                                    ├── calendar/       (CORE-5, CORE-7)
                                    ├── interval/       (CORE-6)
                                    │
                                    ├── transport/      (TRAN-8 … TRAN-10)
                                    ├── intermodal/     (INT-11 … INT-15)
                                    ├── maritime/       (MAR-16 … MAR-19)
                                    ├── road/           (ROAD-20, ROAD-21)
                                    ├── rail/           (RAI-22 … RAI-24)
                                    ├── aviation/       (AV-25 … AV-28)
                                    │   └── data/       (opt-in: curfews, FDP tables)
                                    ├── iot/            (IOT-29 … IOT-32)
                                    ├── health/         (HLTH-33 … HLTH-39)
                                    ├── finance/        (FIN-40 … FIN-45)
                                    │   └── data/       (opt-in: exchange calendars)
                                    └── space/          (SPA-46 … SPA-53)
                                        └── data/       (leap seconds, Bulletin A)

packages/gmt-time/ (DELETE — value moved to core)
packages/gmt-otel/ (DELETE — too niche)
```

Each realm follows the existing three-level convention
(`src/<realm>/<category>/<functionName>.ts`), one exported function per file, colocated
`.test.ts`, `index.ts` barrels at every level. Each new realm needs a hand-written three-entry
block in `packages/gmt/package.json` `exports` (`"./realm"`, `"./realm/*"`,
`"./realm/*/*": null`).

---

## What's in Core After This Epic

### Existing (unchanged)

`gmt/plain/`, `gmt/zoned/`, `gmt/utc/`, `gmt/unix/`, `gmt/duration/`, `gmt/regex/`.

### New core modules

| Module       | Story          | What it provides                                                          |
| ------------ | -------------- | ------------------------------------------------------------------------- |
| `precision/` | CORE-1, CORE-3 | Nanosecond bridge, JSON serialisation, foreign epoch conversion           |
| `span/`      | CORE-2         | Exact and wall-clock spans                                                 |
| `instant/`   | CORE-4         | Instant-plus-offset pairs, explicit local-time resolution                 |
| `calendar/`  | CORE-5, CORE-7 | ISO week, ordinal, fiscal periods, zone-aware buckets, business calendars |
| `interval/`  | CORE-6         | Overlap, intersect, clamp, subtract, merge, split, sum                     |

These are universal primitives. `interval/` and `calendar/` in particular are consumed by
laytime, driver hours, free time, market sessions and medication windows — five realms that
would otherwise each implement interval arithmetic and disagree about boundaries.

---

## Corrections to the Previous Plan

The first draft of this epic specified functions that do not correspond to reality. They are
replaced rather than patched, and each replacement issue carries a `## Corrections` section
recording what was removed and why, so the same API is not re-derived later.

| Story  | Removed                                     | Why                                                                                                         |
| ------ | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| MAR-17 | `mmsiTimestamp(mmsi, embeddedTime)`         | An MMSI is a nine-digit identity (`MIDXXXXXX`). It contains no timestamp, and the spec's "bits 20–47" do not exist in a nine-digit number. |
| INT-13 | `customsClearance(...) => estimatedHours`   | A time library cannot predict how long a customs authority takes. Replaced by advance-filing deadline math, which is deterministic. |
| INT-11 | `portDwell(..., port) => inFreeTime`        | Free time is set by carrier, lane and service contract — not by port. The hardcoded table encoded a non-fact. |
| IOT-30 | `deviceSync(deviceTime, serverTime)`        | Two timestamps cannot separate offset from drift. Replaced by the NTP four-timestamp exchange.               |
| IOT-29 | `monotonicNow(): string`                    | A monotonic reading has no wall-clock meaning; formatting it as ISO invites the misuse it should prevent.     |
| SPA-49 | `instantToJulianDate(): number`             | A single-double JD resolves to only ~100 µs. Replaced by a two-part JD, as used by ERFA and astropy.        |
| AV-27  | `crewDutyWindow(start, end, maxHours)`      | Max FDP is a table lookup on report time, sectors and acclimatisation — the caller does not know `maxHours` either. |
| FIN-40 | `isMarketOpen(iso, exchange)`               | Wrong for lunch-break markets (TYO, HKEX) and every half-day close. A trading day is a list of sessions.      |
| RAI-23 | The `UIC 9602` citation                     | **Does not verify.** No such leaflet; the number does not match UIC's scheme. The real reference is UIC 406. |
| SPA-48 | Leap-second acceptance criteria             | Claimed a leap second in 2022 (there was none) and ~10 between 2000–2024 (there were 5).                      |
| SPA-46 | `GPS − UTC = -18s`                          | Sign backwards — GPS runs **ahead** of UTC. The same error appeared in the original MAR-1, compounded by asserting an 18 s offset at the GPS epoch, where it was 0. |
| AV-28  | `notamTimestamp` parsing `DDHHMM`           | That is the METAR format. ICAO NOTAM items B) and C) use ten-digit `YYMMDDHHMM`, plus `EST` and `PERM`.       |

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
| Epic size (53 stories)        | Phase boundaries are clean cut points. Phases 1–2 deliver the priority realms alone.  |
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
- [tracker.md](tracker.md) — 53 stories, `Blocked by` column, Definition of Done
- [issues/](issues/) — story specs, `CORE-1` through `SPA-53`
- `context/misc/spacetime-reference-frames.md` — research on space/satellite time standards

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
- IERS Bulletin A (Earth orientation) and Bulletin C (leap seconds)
- NAIF SPICE — TDB/TT conversion and SCLK reference
- ERFA / SOFA — two-part Julian Date, Fairhead & Bretagnon TDB−TT model
- IATA SSIM — Standard Schedules Information Manual
