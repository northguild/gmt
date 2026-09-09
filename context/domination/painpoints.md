# GMT Realms Epic — Domain Painpoints

> Researched evidence behind the realm specs. Every story in
> [tracker.md](tracker.md) traces back to a painpoint here.
> If you are about to add or change a realm function, read the relevant section first.

---

## Why this file exists

The first draft of this epic was written without domain research. It shipped three
classes of defect:

1. **Fabricated APIs** — functions describing things that do not exist (`mmsiTimestamp`
   reading a timestamp out of a number that has none) or that a time library cannot
   compute (`customsClearance` returning `estimatedHours`).
2. **Missing fundamentals** — no business calendar engine, no day-count conventions, no
   GTFS service day, no driver hours, no demurrage math.
3. **Priority by ease** rather than by value.

This file is the counterweight. It records what each industry actually struggles with,
so a later agent extends the epic from evidence rather than from plausibility.

**Rule:** do not add a realm function that is not traceable to a painpoint below. If you
find a new one, add it here first, with a source.

---

## Cross-cutting

These bite in every realm. They are why Phase 1 grew from 2 stories to 7.

| Painpoint | Why it hurts | Story |
| --- | --- | --- |
| No business-day / holiday engine | Finance, logistics, rail and healthcare all need it. Siloing it in Finance blocks logistics, which now ships first. | CORE-7 |
| No interval algebra | Overlap, clamp, split-at-boundary and merge are the shared primitive under laytime SHEX exclusions, HOS breaks, free-time working days and market sessions. Every realm would re-implement it. | CORE-6 |
| Local time with no zone | Ports, EDI feeds and clinical systems all emit local wall times with no offset. Resolving them needs a zone the sender did not send. | CORE-4 |
| Ambiguous / nonexistent wall times | The single most common datetime bug. 01:30 occurs twice on a fall-back day and never on a spring-forward day. Silent policy choices produce silent wrong answers. | CORE-4 |
| Offset is not a zone | Storing `-05:00` loses `America/New_York`. A future scheduled event stored with an offset breaks at the next DST transition. | CORE-4 |
| Zone-aware bucketing | "Group by day in `America/New_York`" over UTC nanoseconds is the most common observability bug — and the same bug decides demurrage day counts. | CORE-5 |
| ISO week date absent | Vessel schedules and retail calendars are published by week number, not date. | CORE-5 |
| `bigint` does not serialise | `JSON.stringify` throws on `bigint`. A `toNanoseconds` returning `bigint` has no round-trip story without one. | CORE-1 |
| Storage precision truncation | Postgres stores microseconds. Writing nanoseconds and reading back silently breaks round-trip equality. | CORE-1 |
| Foreign epochs | NTP (1900 epoch, rolls over 2036), Windows FILETIME (100 ns since 1601), .NET ticks, Excel serial, Postgres microseconds-since-2000. Every integration re-derives these. | CORE-3 |

---

## Precision and spans

`Number` holds integers safely only to 2^53 − 1. Nanoseconds since the Unix epoch
exceeded that in 1970 + ~104 days. `Date.now() * 1e6` is not a nanosecond timestamp;
it is a millisecond timestamp with three zeroes appended.

- **OpenTelemetry** specifies `time_unix_nano` as `uint64`. It is not representable in a
  JS `number`, and the value overflows `uint64` in 2262.
  ([opentelemetry-js#2643](https://github.com/open-telemetry/opentelemetry-js/issues/2643))
- **Prometheus / OpenMetrics** timestamps are float64 seconds. Rendering a
  nanosecond-precision value through float64 loses precision; OpenMetrics explicitly
  warns against exponential float rendering where precision matters.
  ([OpenMetrics spec](https://prometheus.io/docs/specs/om/open_metrics_spec/))

Span math has three traps the current `spanMs` / `spanNs` spec does not address:

- **Negative spans.** Sign convention must be stated, not inferred.
- **Wall clock vs exact time.** "One day later" and "24 hours later" differ across a DST
  transition. A span computed from two zoned strings is not the span a human means.
- **Leap seconds and smearing.** A span computed from UTC strings across a leap second
  is off by one second. Against a smeared clock (Google, AWS, Meta) it is off by up to a
  second, spread across the smear window.

---

## Shipping and logistics

The highest-value realm, and the thinnest in the original plan.

### The two-field instant is the industry pattern

Every serious logistics standard stores an instant **and** the local offset that was in
force where the event happened — because the absolute ordering and the human-readable
local time are both load-bearing, and neither can be derived from the other.

- **GS1 EPCIS 2.0** requires `eventTime` (UTC) plus `eventTimeZoneOffset`, precisely so
  the event can be displayed in the local time where it occurred.
  ([OpenEPCIS](https://openepcis.io/docs/epcis/))
- **UN/EDIFACT DTM** format qualifier `303` is `CCYYMMDDHHMMZZZ` and `304` is
  `CCYYMMDDHHMMSSZZZ` — both carry the offset. Qualifiers `102` and `203` do not, and
  the industry uses all four.
  ([UNECE D.03A DTM](https://service.unece.org/trade/untdid/d03a/trsd/trsddtm.htm))
- **DCSA Track & Trace** carries `eventDateTime` with an `eventClassifierCode` marking
  it planned, estimated or actual — three different meanings on one field.
  ([DCSA](https://dcsa.org/standards/track-and-trace/standard-documentation-track-and-trace))

GMT has no primitive for this shape. → CORE-4, INT-15

### Free time, demurrage and detention

This is money, and the current spec gets the model wrong.

- The clock starts at **discharge from the vessel** for demurrage and at **gate-out**
  for detention. Two different events, two different clocks.
- Most carriers count **calendar days**, but some tariffs count **working days**, and
  usually only for detention. On calendar days a weekend burns two free days while the
  terminal is shut.
- Free time is set by carrier, lane, trade and service contract — **not** by port. A
  hardcoded per-port free-time table encodes a fact that is not a fact.
- Day boundaries are counted in terminal-local time, so the zone-aware bucketing
  problem decides the charge.

([ACL](https://www.aclcargo.com/free-time-demurrage/),
[Navo24](https://navo24.com/blog/msc-demurrage-detention-free-time/)) → INT-11, INT-12

### Laytime and laycan

Entirely absent from the original plan, and among the most precise time math in any
industry — it settles charter-party disputes.

- **Laycan** is the laydays/cancelling window: the range in which the vessel must
  present.
- **NOR** (Notice of Readiness) tender is the trigger event. The classic rule: NOR
  tendered before noon → laytime starts 13:00 the same day; after noon → 08:00 the next
  day. Turn time may be interposed.
- Exclusion clauses change which hours count: **SHEX** (Sundays and Holidays Excepted),
  **SHINC** (included), **WWD** (weather working days — time does not accrue during
  weather that stops work), WIBON / WIPON.
- Output is laytime consumed, then demurrage or despatch.

([HandyBulk](https://www.handybulk.com/laytime-calculation-in-ship-chartering-complete-guide-to-laydays-nor-demurrage-and-time-sheets/),
[Maritime Optima](https://maritimeoptima.com/shipping-academy/laytime)) → MAR-19

### Cut-offs

Ocean bookings have a stack of deadlines anchored to vessel departure, each in
terminal-local time, and **all of them move when the schedule moves**.

Documentation / SI cut-off, VGM cut-off, CY (gate-in) cut-off, customs cut-off. Typical
shape: vessel departs Friday 18:00 → doc cut-off Wednesday 17:00, VGM Thursday 10:00,
gate-in Thursday 18:00.
([DCSA](https://dcsa.org/newsroom/cut-off-times-in-shipping),
[BRF](https://brf-logistics.com/sailing-schedules-si-cut-off-port-cut-off-and-customs-cut-off/))
→ TRAN-10

### Advance filing deadlines

Deterministic, legally binding, and the correct replacement for the fabricated
`customsClearance`:

- **ISF 10+2** and the **AMS 24-Hour Rule**: 24 hours before cargo is **laden aboard**
  at the foreign port — measured against loading, not departure and not arrival.
- **ENS / ICS2** (EU): 24 hours before commencement of loading.

([exFreight](https://www.exfreight.com/what-is-isf-102-complete-guide-to-importer-security-filing-for-us-imports/),
[Hapag-Lloyd](https://www.hapag-lloyd.com/en/services-information/security-information/europe-security-information/faq-24h-rule-ens.html))
→ INT-13

### Ship's time

A ship's clock is declared by the master. It advances or retards on passage, need not
match any IANA zone, and crosses the International Date Line. AIS reports UTC; the deck
log reports ship's time; the port reports port-local. Three clocks, one voyage.
→ MAR-18

### Road — zero coverage

Road is the largest logistics mode by volume and had no realm at all, while aviation
crew duty was specced.

- **FMCSA**: 11 hours driving inside a 14-hour window, 30-minute break after 8 hours
  driving, 60/70 hours in 7/8 days, 34-hour restart.
- **EU Regulation 561/2006**: 9 hours daily driving (10 twice weekly), 45-minute break
  after 4.5 hours (splittable 15 + 30), 56 hours weekly, 90 hours per fortnight, plus
  daily and weekly rest. Tachographs record UTC.

([FMCSA](https://www.fmcsa.dot.gov/regulations/hours-of-service),
[EUR-Lex](https://eur-lex.europa.eu/EN/legal-content/summary/driving-time-and-rest-periods-in-the-road-transport-sector.html))
→ ROAD-20, ROAD-21

---

## Rail

### GTFS is the gap

GTFS is the dominant public-transport data format and was missing entirely. It contains
the highest-frequency temporal bug class in transit software:

**`stop_times.arrival_time` may exceed 24:00:00.** `25:35:00` means 01:35 the following
calendar day, expressed in the local time of the day the trip **began**. Times are tied
to a *service day*, not a calendar date, because agencies run past midnight and group
those trips with the previous day's service.

The consequence is a query bug: to find trips between 00:00 and 01:00 on 30 January you
must search `00:00–01:00` for service date `20140130` **and** `24:00–25:00` for service
date `20140129`. A correct consumer handles ranges like `00:00–27:00`.

Also: `calendar_dates.txt` exceptions, the noon-minus-12-hours rule for DST correctness,
and GTFS-RT POSIX seconds.

([MobilityData reference](https://github.com/MobilityData/gtfs-reference/blob/master/en/stop_times.md),
[transit-developers](https://groups.google.com/g/transit-developers/c/ZkfnuNv1gho))
→ RAI-24

### Other rail

- European timetable year changes on the second Sunday in December.
- DST transitions strand trains: held an hour on fall-back, cancelled on spring-forward.
- **`UIC 9602` does not verify.** The original spec cited it as "rail running time and
  dwell time". Repeated searching found no such leaflet, and it does not match UIC's
  numbering (three digits with optional sub-numbers: `406`, `920-9`, `912-3`). Treat it
  as unsourced. The real, verifiable reference for blocking time, dwell and capacity
  consumption is the **UIC 406 capacity leaflet**.
  ([UIC 406 method](https://www.witpress.com/Secure/elibrary/papers/CR08/CR08006FU1.pdf))

→ RAI-22, RAI-23

---

## Aviation

- **Day offset.** Schedules carry an arrival day indicator (+1, −1, +2). `flightLeg`
  returning only a duration cannot express an arrival on a different date.
- **Schedule seasons.** IATA Northern Summer runs from the last Sunday in March to the
  last Saturday in October; Northern Winter covers the remainder — deliberately aligned
  to EU DST. Written NS26 / NW25. Airline scheduling is unusable without season
  boundaries. ([Simple Flying](https://simpleflying.com/iata-summer-winter-schedule/))
- **`DDHHMMZ` is ambiguous; NOTAM validity is not.** METAR and TAF report times carry
  day-of-month, hour and minute only — **no month, no year** — so parsing one *requires*
  a reference instant to disambiguate. ICAO NOTAM items B) and C), by contrast, use a
  ten-digit `YYMMDDHHMM` group, plus the non-numeric values `EST` and `PERM`. The
  original spec described `notamTimestamp` as parsing `DDHHMM` ("251200 = 25th day,
  12:00 UTC"), which is the METAR format, not the NOTAM one, and it handled neither
  `EST` nor `PERM`.
  ([FAA NOTAM primer](https://www.faa.gov/sites/faa.gov/files/about/initiatives/notam/what_is_a_notam/Pilots_NOTAM_primer_for_2021.pdf))
- **Crew FDP is a table, not a number.** Maximum flight duty period is a lookup on
  report-time band × sector count: FAA Part 117 Table B, EASA ORO.FTL.205 Table 2. It is
  keyed to the crew member's **acclimatised** local time, and the WOCL (window of
  circadian low, 02:00–05:59 local) shifts the answer. Acclimatisation moves at roughly
  one time zone per day. "Caller passes `maxHours`" dodges the entire problem.
  ([FAR 117](https://far117understanding.com/tag/wocl/),
  [Aviatize](https://www.aviatize.com/glossary/easa-ftl))
- Minimum connect time is in local time at the connecting airport; CTOT slot windows run
  −5/+10 minutes.

→ AV-25, AV-26, AV-27, AV-28

---

## IoT and continuous time

- **PTP is TAI, not UTC.** IEEE 1588 shares the Unix epoch but counts TAI. The
  `currentUtcOffset` field (37 s) must be applied, and failing to apply it produces a
  silent 37-second error — a documented, recurring production failure across lidar,
  industrial and broadcast deployments.
  ([DMC](https://www.dmcinfo.com/latest-thinking/blog/id/12639/time-sync-leap-seconds-utc-offsets-on-pxi-and-crio-using-ptp))
- **GPS week rollover.** The week number is 10 bits — it wrapped in 1999 and 2019, and
  wraps next in 2038. Receivers emit dates 1024 weeks in the past.
- **Two timestamps cannot yield offset and drift.** That is one equation in two
  unknowns. The NTP exchange uses four: θ = ((T2−T1) + (T3−T4)) / 2,
  δ = (T4−T1) − (T3−T2). Drift needs two or more offset samples separated in time.
- **Monotonic readings are not wall-clock times.** Formatting one as ISO 8601 invites
  the exact misuse the function exists to prevent. A reading is `{ timeOrigin,
  elapsedNs }`; conversion to wall clock is lossy and must be explicit.
- **`observedAt` vs `receivedAt`.** Devices buffer offline and upload later. Without two
  fields, backfilled data is indistinguishable from live data, and late arrivals cannot
  be classified against a watermark.

→ IOT-29, IOT-30, IOT-31, IOT-32

---

## Healthcare

- **Partial dates need range semantics.** FHIR permits `2024` and `2024-06`. For
  comparison, `2022` means the range 2022-01-01 … 2022-12-31. `isValidFHIRPrecision`
  validates a string but cannot compare or sort two of them.
  ([HL7 VRCL](https://build.fhir.org/ig/HL7/vr-common-library//StructureDefinition-Extension-partial-date-vr.html))
- **Age has a documented off-by-one.** Timezone offsets must be normalised only when the
  comparison precision is hours or finer. Normalising for a months-or-years comparison
  introduces the error it was meant to prevent.
  ([US CQL IG](https://build.fhir.org/ig/HL7/us-cql-ig/patterns-patient.html))
  Add the 29 February birthday rule, neonatal age in hours and days, and gestational age
  as weeks + days.
- **DICOM** DA / TM / DT value representations (`20240101`, `120000.000000`,
  `20240101120000.000000+0500`) are absent, and imaging is a large share of clinical
  timestamps.
- **`Timing.repeat`** encodes administration schedules (BID, TID, `when: MORN`,
  `boundsPeriod`). On a DST-transition night the 02:00 dose is duplicated or skipped.
- **HL7 v2 DTM without an offset** means "local to the sending facility" — an ambiguity
  that must be surfaced, not silently resolved to UTC.
- **De-identification** requires consistent per-patient date shifting, with HIPAA Safe
  Harbor capping ages above 89.

→ HLTH-33 … HLTH-39

---

## Finance

The original spec had market hours and business days, and missed the fundamentals.

- **Day-count conventions are absent.** 30/360 US, 30/360 ISDA, 30E/360, 30E+/360,
  ACT/360, ACT/365F, ACT/ACT ISDA. The variants differ in how they treat the 31st and
  the end of February. This is the most fundamental date primitive in finance.
  ([FINCAD](https://docs.fincad.com/support/developerfunc/mathref/Daycount.htm))
- **Business-day conventions are absent.** Following, Modified Following, Preceding,
  Modified Preceding, plus the end-of-month rule.
- **Settlement and value dates.** US equities moved to **T+1 in May 2024**. FX spot is
  T+2 and requires **both** currencies' calendars — a holiday in either pushes the date
  out. USD/CAD, USD/TRY, USD/RUB and USD/PHP are T+1. USD holidays do not affect T+1
  except for ARS, CLP and MXN, which roll to T+3.
  ([Just](https://gojust.com/guides/fx-value-dates/),
  [ObjectLab](https://objectlabkit.sourceforge.net/currency.html))
- **`isMarketOpen` is wrong as specced.** TYO and HKEX have lunch breaks, so a trading
  day is a *list* of intervals, not one. Half-day early closes (the day after
  Thanksgiving, Christmas Eve) are unrepresented.
- **US and EU DST changeovers do not coincide** — roughly three weeks of misalignment
  each spring and autumn, which shifts the London/New York overlap.
- Tenor arithmetic (`3M`, `2Y`) and IMM dates (third Wednesday of Mar/Jun/Sep/Dec).

→ FIN-40 … FIN-45

---

## Space and celestial

Best-specified realm in the original plan, with real gaps.

- **Julian Date as a single `double` resolves to only ~100 µs.** ERFA and astropy both
  carry a two-part JD (integer day + fraction) for exactly this reason, and ERFA
  documents the single-value form as acceptable only where losing several digits is
  fine. `instantToJulianDate(): number` bakes in the precision loss.
  ([USNO AA TN2011-02](https://aa.usno.navy.mil/downloads/novas/USNOAA-TN2011-02.pdf),
  [astropy](https://docs.astropy.org/en/stable/time/index.html))
- **No UT1 / DUT1**, so no sidereal time (GMST, GAST, ERA). The plan bundles IERS
  Bulletin C (leap seconds) but not Bulletin A (Earth orientation).
- **No TLE epoch** (`YYDDD.DDDDDDDD` — two-digit year plus fractional day of year),
  which is how every published orbital element set is dated.
- **No mission clocks** — mission elapsed time, spacecraft clock (SCLK) to spacecraft
  event time (SCET) correlation, GPS week + time-of-week decomposition.
- **No CCSDS time codes** despite CCSDS 301.0-B-4 being cited: ASCII codes A and B, and
  the binary CUC / CDS codes.
- **The original leap-second examples were wrong.** SPA-3 asserted "one leap second in
  2022" and roughly ten between 2000 and 2024. There was **no** leap second in 2022 — the
  last insertion was 2016-12-31, none has occurred since, and 2000→2024 contains five
  (2005, 2008, 2012, 2015, 2016). Since 1972 there have been 27, giving TAI − UTC = 37 s.
  ([BIPM](https://www.bipm.org/documents/20126/52354616/CCTF_UTC_presentation.pdf/0a8f0954-7c00-9142-8da2-f4221c7e0269))
- **The original GPS−UTC sign was backwards.** The spec wrote `GPS − UTC = -18 s` and gave
  `utcToGps('1980-01-06T00:00:00Z')` → `'...T00:00:18Z'`. GPS runs **ahead** of UTC by
  18 s (since January 2017), and the offset was **0** at the GPS epoch, not 18. Both the
  sign and the epoch example were wrong.
  ([TimeTools](https://timetoolsltd.com/gps/what-is-gps-time/))
- **Pre-1972 UTC used rubber seconds** — the TAI−UTC relationship was a rate offset, not
  an integer count. `fromTAI` is wrong before 1972 unless handled or refused.
- **Leap smearing** (Google, AWS, Meta) and the decision to retire leap seconds by 2035
  are undocumented.

→ SPA-46 … SPA-53

---

## Parked

Researched, deliberately unscheduled. Do not re-propose without new evidence.

| Item | Why parked |
| --- | --- |
| Place registries (UN/LOCODE, IATA, ICAO, UIC → IANA zone) | Real and unsolved in JS, but data-heavy and a maintenance commitment. GMT takes zones as parameters instead. Revisit as a separate package. |
| tzdb version pinning | Reproducing a historical conversion exactly needs the tzdb version in force at the time. Deep change; Temporal exposes no version hook. |
| Full Fairhead & Bretagnon TDB−TT model | Simplified formula first; sub-10 ns accuracy is a later story. |
| Weather / climate timestamps | netCDF, GRIB. Domain expertise beyond time math. |
| Legal timestamps | PKI and court filing. Certificate-based, not time math. |
| Historical calendars | Julian calendar, pre-1582. Complex localisation. |
| Recurrence / iCal RFC 5545 | Different concern from point-in-time math. |
