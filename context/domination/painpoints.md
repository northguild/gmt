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
| Days that do not exist | "One year after 29 February", "one month after 31 January". Libraries disagree silently, and contracts, filings and fiscal calendars depend on the answer. | CORE-5, CORE-6 |

### Non-existent days: the law and the libraries agree on clamping

GMT follows TC39 Temporal's default `overflow: "constrain"` (the last valid day of the month).
The legal and industry record behind that choice:

- **EU** — [Regulation 1182/71 Art 3(2)(c)](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:31971R1182):
  a period in months or years ending on a day that does not exist in the final month ends on
  that month's last day.
- **UK** — [Companies Act 2006 s390/s391](https://www.legislation.gov.uk/ukpga/2006/46/section/391):
  accounting reference periods end on the last day of a month, and may vary by up to seven
  days from it (52/53-week years).
- **US** — [26 CFR 1.441-2](https://www.law.cornell.edu/cfr/text/26/1.441-2): a 52–53-week
  taxable year ends on the same weekday nearest (or last in) a given month.
- **TC39** — [Temporal `PlainDate`](https://tc39.es/proposal-temporal/docs/plaindate.html):
  `add`/`with` default to `overflow: "constrain"`.
- **Libraries** — Temporal, Moment, Luxon, dayjs, spacetime and `@internationalized/date` all
  clamp. date-fns `setYear` is the outlier: it rolls 29 February forward to 1 March.

Decision of record: [coding-standards § Calendar & zone semantics](../coding-standards.md#calendar--zone-semantics).

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

- **Free days and charged days are counted on different bases.** The dominant published shape
  is free time in working days, then every calendar day charged ("FREE DAYS ARE IN WORKING DAYS
  ... BILLABLE IN CALENDAR DAYS", CMA CGM US; "Rate per Calendar day", Hapag-Lloyd US); California
  forbids charges while the gate is closed or on a holiday (Cal. Bus. & Prof. Code § 22928).
- **Each clock runs on both legs, and many carriers merge them.** Export demurrage runs from full
  gate-in to loaded on board and export detention from empty release to full gate-in; Maersk,
  CMA CGM and MSC sell a combined clock (discharge to empty return, or empty release to loaded).
- **No world standard counts the days.** DCSA defines the charges and the free-time unit; the only
  invoice regulation is the US one (46 CFR 541). Full record:
  [research/int-12-demurrage-conventions.md](research/int-12-demurrage-conventions.md).

([ACL](https://www.aclcargo.com/free-time-demurrage/),
[Navo24](https://navo24.com/blog/msc-demurrage-detention-free-time/)) → TRAN-8, INT-12

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

## Additions from the September 2026 realm spike

After 1.16.0 shipped Core, every remaining story was read against its primary source, and every
realm was searched for calculations its industry runs on that the roadmap lacked. The full
record, with quotes and clauses, is in
[research/realm-gap-spike-2026-09.md](research/realm-gap-spike-2026-09.md) and its four
verification files. What follows is the painpoint each finding traces to.

### Spike findings — Cross-cutting

| Painpoint | Why it hurts | Story |
| --- | --- | --- |
| No "is this place open" primitive | Terminal gates, trading sessions, curfews, WOCL, truck bans and support SLAs are all weekly windows with holidays; seven realms were about to implement midnight wrap and DST nights privately. | CORE-55 |
| Holidays are rules, not lists | "Third Monday in January", "Good Friday", "25 December observed Monday" — every legal and market holiday is one of three rule forms, and the observance shift differs by country ([5 U.S.C. §6103(b)](https://www.law.cornell.edu/uscode/text/5/6103)). IMM dates, crypto expiries and the IATA season boundary re-derive the same nth-weekday. | CORE-54 |
| Timestamps hidden in identifiers | UUIDv1/v6 count 100 ns ticks from 1582-10-15; UUIDv7 carries 48 bits of Unix ms ([RFC 9562 §5.1, §5.6, §5.7](https://www.rfc-editor.org/rfc/rfc9562.html)); ULID, ObjectId, Snowflake and KSUID each have an epoch; Parquet `INT96` is a Julian day plus nanoseconds; Arrow zone-less timestamps are wall-clock "as if UTC". | CORE-56 |
| Planned versus actual is every mode's question | "On-time" is "less than 15 minutes after its published arrival time" ([14 CFR 234.2](https://www.law.cornell.edu/cfr/text/14/234.2)); DCSA classifies every timestamp `PLN`/`EST`/`REQ`/`ACT` ([JIT OpenAPI 1.2.0-Beta-2](https://raw.githubusercontent.com/dcsaorg/DCSA-OpenAPI/master/jit/v1/jit_v1.2.0-Beta-2.yaml)); comparing an estimate to an actual is the standard dashboard bug. | TRAN-57 |
| One duty-log shape, five regulators | Drivers, seafarers, train crews, flight crews and residents all have rolling-window hours rules over a status log; `DutyEntry` is shared so they cannot disagree about a window. | ROAD-20, ROAD-61, ROAD-62, MAR-60, RAI-63, AV-65, HLTH-70 |

### Spike findings — Shipping and logistics

| Painpoint | Why it hurts | Story |
| --- | --- | --- |
| The FMC now regulates D&D invoices | Invoice "within thirty (30) calendar days from the date on which the charge was last incurred" or "the billed party is not required to pay"; at least 30 days to dispute; 30 to resolve; the invoice must list free-time start and end, availability or earliest-return date and the specific charged dates ([46 CFR 541.6–541.8](https://www.law.cornell.edu/cfr/text/46/541.7)). | INT-12; INT-58 ships the generic deadline chain with every window as a caller parameter (GMT tracks no law) |
| Free-time start day is a tariff term | Whether the event day counts is one full day of charges; last free day, tiered bands and a third clock (terminal storage) are all contract parameters. | INT-12 |
| Filing anchors differ by regime | ISF and AMS: lading; EU containers: loading, bulk: 4 h before first port; Japan: departure from the load port; Canada conveyance: 96 h before arrival; US NOA: 96 h ([19 CFR 149.2](https://www.law.cornell.edu/cfr/text/19/149.2), [19 CFR 4.7](https://www.law.cornell.edu/cfr/text/19/4.7), [DA 2015/2446 Art 105–106](https://www.legislation.gov.uk/eur/2015/2446/article/105/adopted), [Japan Customs](https://www.customs.go.jp/english/summary/advance5/index.htm), [SOR/86-873](https://laws-lois.justice.gc.ca/eng/regulations/SOR-86-873/FullText.html), [33 CFR 160.212](https://www.law.cornell.edu/cfr/text/33/160.212)). | INT-13 |
| X12 is half the EDI world | Data elements 1250 (formats) and 623 (time codes, with generic `ET` versus fixed `ED`/`ES` and a descending ISO run 13–24) are fixed X12 enumerations shared by 214, 315, 404 and healthcare 837 ([X12 DE 623](https://www.stedi.com/edi/x12/element/623)). | INT-15 |
| Laytime words have numbered definitions | BIMCO 2013: three weather-working-day definitions deduct differently (nos. 15–17); demurrage "shall not be subject to exceptions" (no. 30); despatch on working time saved excludes excepted periods, on all time saved includes them (nos. 32–33); Gencon 94 cl. 6(c) starts laytime at **06.00**, not 08.00, next working day ([BIMCO](https://www.bimco.org/media/qy2neqim/laytime-definitions-for-charter-parties-2013-v2.pdf)). | MAR-19 |
| Seafarer rest hours are STCW/MLC law | "ten hours in any 24-hour period; and (ii) 77 hours in any seven-day period", "no more than two periods, one of which shall be at least six hours", interval "shall not exceed 14 hours" ([MLC A2.3 §§5–6](https://www.ilo.org/sites/default/files/2024-10/NORMES_MLC%20Amendments-EN_2022_Web_1.pdf)); logged in ship's time. | MAR-60 |
| Receivers speak four GNSS scales | Galileo "GST was equal to 13 seconds at 22nd August 1999 00:00:00 UTC", 12-bit week; BeiDou epoch 2006-01-01, 13-bit week, no leap seconds; GLONASS is UTC(SU)+3 h **with** leap seconds ([ICDs](https://www.gsc-europa.eu/sites/default/files/sites/all/files/Galileo_OS_SIS_ICD_v2.0.pdf)). | MAR-16 |
| NMEA is what the bridge receiver says | RMC `hhmmss.ss` + `ddmmyy` (no century), ZDA with a local zone description whose sign the public references do not state, GGA time only ([gpsd NMEA Revealed](https://gpsd.gitlab.io/gpsd/NMEA.html)). | MAR-59 |
| Zone description and DTG are formulas | ZD "positive in west longitude and negative in east longitude", letters Z, A–M (no J), N–Y ([Bowditch 2019 ch. 16 §1607](https://msi.nga.mil/api/publications/download?key=16693975/SFH00000/Bowditch_Vol_1_LoRes_2019.pdf)); "271630Z JUN 03 represents 1630 GMT on 27th June 2003" ([ACP 121(G) para 317c](https://navy-radio.org/manuals/acp/acp121g.pdf)). | MAR-18 |
| The FMCSA day is the carrier's | "any 24-consecutive-hour period beginning at the time designated by the motor carrier for the terminal from which the driver is normally dispatched" ([49 CFR 395.2](https://www.law.cornell.edu/cfr/text/49/395.2)); ELDs record in home-terminal time; §395.5 (passenger) has no 34-hour restart. | ROAD-20 |
| FMCSA exceptions are how drivers actually run | Sleeper pairs by three constraints, not "7/3"; the 16-hour exception is "not … within the previous 6 consecutive days" ([49 CFR 395.1](https://www.law.cornell.edu/cfr/text/49/395.1)). | ROAD-61 |
| The EU week is fixed | "the period of time between 00.00 on Monday and 24.00 on Sunday" (Art 4(i)); the fortnight is adjacent fixed weeks; Mobility Package return-home and two-consecutive-reduced-rest rules ([561/2006 consolidated](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:02006R0561-20200820)). | ROAD-21 |
| Canada is a third rule set | 13 h driving, 14 h on duty, 16 h elapsed, 10 h off with 8 consecutive plus 2 in 30-minute blocks, 24 h off in 14 days, cycles 70/7 and 120/14; north of 60° 15/18/20 and cycle 2's precondition at 80 h ([SOR/2005-313](https://laws-lois.justice.gc.ca/eng/regulations/SOR-2005-313/)). | ROAD-62 |
| The rail timetable year is a Directive | Change "at midnight on the second Saturday in December", June adjustment, and a calendar of deadlines in months before the change ([Decision (EU) 2017/2075 Annex VII](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32017D2075)); railML operating periods are day bitmasks. | RAI-22 |
| UIC 406's text is paywalled | Blocking-time components cannot be cited from the leaflet; the arithmetic is generic and the components are the caller's. | RAI-23 |
| Train crews have a statute | 12 consecutive hours, 10 off in the prior 24, 276 hours a month, 48/72 hours after 6/7 consecutive days, limbo-time caps ([49 U.S.C. §21103](https://www.law.cornell.edu/uscode/text/49/21103)). | RAI-63 |
| Flights have four timestamps | Gate departure and arrival "at the gate or passenger loading area" and "Actual wheels-off and wheels-on times" ([14 CFR 234.4(a), (f)](https://www.law.cornell.edu/cfr/text/14/234.4)). | AV-25 |
| AIRAC is a 28-day arithmetic sequence | "common effective dates at intervals of 28 days, including 8 November 2018"; 28 days to reach recipients (Standard), 42 (Note), 56 (Recommendation) ([Annex 15 §6.2](https://www.icao.int/sites/default/files/safety/CAPSCA/PublishingImages/Pages/ICAO-SARPs-(Annexes-and-PANS)/an15_1.pdf)); the `YYNN` identifier is a convention, not ICAO's. | AV-64 |
| Crew limits are also cumulative | 100 h in 672 h, 1,000 h in 365 days, 60 FDP h in 168 h, 190 in 672, 30 consecutive hours rest in 168 ([14 CFR 117.23, 117.25](https://www.law.cornell.edu/cfr/text/14/117.23)); EASA 60/110/190 duty hours, 100/900/1,000 flight hours, 36-hour recurrent rest with two local nights ([ORO.FTL.210, .235](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32014R0083)). | AV-65 |
| FTL vocabulary is defined | Acclimated 72 h / 36 h, theater 60°, WOCL 0200–0559, local night 8 h in 22:00–08:00, early start and late finish bands by schedule type. | AV-27 |
| NOTAM D) is a schedule with grammar | Days or dates, never both; first activity at B), last at C); gaps ≤ 7 days; `SR MINUS30`; no oblique ([OPADD 4.1](https://www.icao.int/sites/default/files/sp-files/APAC/Documents/EUROCONTROL%20Operating%20Procedures%20for%20AIS%20Dynamic%20Data%20(OPADD)%20Edition%204.1.pdf)); TAF `DDHH/DDHH` with `DD24`, PROB only 30/40 ([WMO 306 FM 51](https://www.eoas.ubc.ca/courses/atsc303/Instruments/wmo_guides/wmo_306-vI1_en-2013.pdf)). | AV-28 |

### Spike findings — IoT and continuous time

| Painpoint | Why it hurts | Story |
| --- | --- | --- |
| The NTP bound is λ = ε + δ/2, not δ/2 | RFC 5905's correctness interval is `[θ − λ, θ + λ]` with root dispersion included ([§11.2.1](https://www.rfc-editor.org/rfc/rfc5905)); the delay-only half-width understates it. | IOT-30 |
| Ordering across devices needs a rule | HLC's Figure 5 send/receive rules with `\|l − pt\| ≤ ε` ([Kulkarni et al. 2014](https://cse.buffalo.edu/tech-reports/2014-04.pdf)); TrueTime's `[earliest, latest]` and commit wait ([Spanner §3, §4.1.2](https://static.googleusercontent.com/media/research.google.com/en//archive/spanner-osdi2012.pdf)). | IOT-66 |
| Window assignment is time math | "Fixed windows are really a special case of sliding windows where size equals period"; sessions "defined by a timeout gap" ([Dataflow Model §1.2](https://www.vldb.org/pvldb/vol8/p1792-Akidau.pdf)). | IOT-32 |

### Spike findings — Healthcare

| Painpoint | Why it hurts | Story |
| --- | --- | --- |
| Live feeds are v2.5.1 `TS`, not `DTM` | `TS` carries a degree-of-precision component that "may not indicate greater" precision; `TM` has its own offset; `0000` is the preceding midnight ([HL7 v2.5.1 ch. 2A](https://www.hl7.eu/HL7v2x/v251/std251/ch02a.html)). | HLTH-33 |
| FHIRPath defines partial-date comparison | Precision-by-precision; "the result is empty ({ })" when one side lacks a precision after shared ones agree ([FHIRPath §6.1.1, §6.2](https://hl7.org/fhirpath/N1/)); CQL normalises offsets "only when the comparison precision is hours, minutes, seconds, or milliseconds" ([CQL Appendix B](https://cql.hl7.org/09-b-cqlreference.html)). | HLTH-35, HLTH-36 |
| Preterm infants have four ages | Gestational, chronological, postmenstrual, corrected — "chronological age reduced by the number of weeks born before 40 weeks" ([AAP 2004](https://publications.aap.org/pediatrics/article/114/5/1362/67715/Age-Terminology-During-the-Perinatal-Period)); "the EDD is 280 days after the first day of the LMP", IVF 261/263 days, redating thresholds by gestational age ([ACOG CO 700](https://www.acog.org/clinical/clinical-guidance/committee-opinion/articles/2017/05/methods-for-estimating-the-due-date)). | HLTH-36 |
| `Timing.repeat.when` has no clock time | 26 EventTiming codes whose time "is unspecified and established by institution convention" ([FHIR R4](https://hl7.org/fhir/R4/valueset-event-timing.html)). | HLTH-38 |
| Dose validity has a four-day rule | "doses administered ≤4 days before the minimum interval or age are considered valid"; "≥5 days earlier … should not be counted"; not for rabies or the live-vaccine 4-week interval ([ACIP GBP](https://www.cdc.gov/vaccines/hcp/imz-best-practices/timing-spacing-immunobiologics.html)); CDSi absolute-minimum dates ([v4.6](https://www.cdc.gov/iis/downloads/logic-spec-acip-rec-4.6.pdf)). | HLTH-67 |
| Adherence is interval union with a shift | PQA PDC: same-ingredient overlaps "adjust the prescription start date to be the day after"; IPSD to year end; ≥ 91 days; 80 % ([PQA FAQ](https://pqa.memberclicks.net/assets/Measures/QRS%20Measures%20FAQs%2020200403.pdf)). | HLTH-68 |
| Inpatient days are midnights | "The midnight-to-midnight method"; admission day counts, discharge day does not, same-day is one ([MBPM ch. 3 §20.1](https://www.cms.gov/Regulations-and-Guidance/Guidance/Manuals/Downloads/bp102c03pdf.pdf)); two-midnight benchmark ([42 CFR 412.3(d)(1)](https://www.law.cornell.edu/cfr/text/42/412.3)) — the same primitive as terminal dwell. | HLTH-69 |
| Residents have hours rules too | 80 hours "averaged over a four-week period", 24 + 4, 14 hours after 24-hour call, one day in seven, every third night; renumbered 6.20–6.28 in 2025 ([ACGME CPR](https://www.acgme.org/globalassets/pfassets/programrequirements/2025-reformatted-requirements/cprresidency_2025_reformatted.pdf)). | HLTH-70 |

### Spike findings — Finance

| Painpoint | Why it hurts | Story |
| --- | --- | --- |
| Day-count names must be the scheme's | `'30/360 ISDA'` and `'30E+/360'` are not ISDA or FpML codes; `ACT/ACT.ICMA`, `ACT/365L` (366 "if the later Period End Date … falls in a leap year"), `BUS/252`, `RBA` were missing ([FpML 2-3](https://www.fpml.org/coding-scheme/day-count-fraction), [ISDA 2006 §4.16](https://www.sc.com/en/uploads/sites/66/content/docs/2006-ISDA-Definitions.pdf)). | FIN-42 |
| The trade date rolls at 17:00 CT | "Sunday, May 3 (trade date Monday, May 4)" ([CME Globex notice](https://www.cmegroup.com/notices/electronic-trading/2026/04/20260427.html)). | FIN-40 |
| T+1 has dates | US/CA/MX May 2024; EU/UK/CH 11 October 2027 ([ESMA](https://www.esma.europa.eu/press-news/esma-news/esma-proposes-move-t1-october-2027)); calendars keyed by FpML business centers. | FIN-43 |
| CDS rolls changed on 20 December 2015 | Roll frequency "reduced to March and September"; coupons stay quarterly ([ISDA 2015](https://www.isda.org/a/7qiDE/isda-recommendation-single-name-cds-roll-frequency-final-release.pdf)). | FIN-44 |
| Schedules, not single periods | FpML `CalculationPeriodDates`, `RollConventionEnum` (`EOM`, `IMM`, `SFE` "second Friday", `TBILL` "Each Monday except for U.S. (New York) holidays"), `StubPeriodTypeEnum`, `PaymentDates` ([FpML 5.12](https://www.fpml.org/spec/fpml-5-12-4-rec-1/html/confirmation/schemaDocumentation/schemas/fpml-ird-5-12_xsd/complexTypes/CalculationPeriodDates.html)). | FIN-71 |
| RFR conventions are date structures | Lookback, observation period shift, lockout, payment delay, with weights by the calculation or observation calendar ([ISDA memo §1.1–1.4](https://www.isda.org/a/alEgE/A40393158-v18.0-ISDA_Memorandum_Compounding-RFRs-under-2006-Definitions.pdf), [ARRC guide pp. 17–19](https://www.newyorkfed.org/medialibrary/Microsites/arrc/files/2021/users-guide-to-sofr2021-update.pdf)). | FIN-72 |
| Trading and payments have their own formats | FIX `UTCTimestamp` to picoseconds with `60` "only if UTC leap second", `TZTimestamp`, `MonthYear` `w1`–`w5` ([FIX Latest](https://fiximate.fixtrading.org/en/FIX.Latest/fix_datatypes.html)); SWIFT 32A `YYMMDD`, 13C/13D offsets; RTS 25 granularity tables ([2017/574](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32017R0574)). | FIN-73 |

### Spike findings — Space and celestial

| Painpoint | Why it hurts | Story |
| --- | --- | --- |
| SPA-47 and SPA-49 needed each other | TT and TCG are a constant offset and a constant rate (IAU 2000 B1.9; IERS Conventions eq. 10.1) and need no JD; TDB and TCB do (IAU 2006 B3). Splitting them removes the cycle. | SPA-47, SPA-74 |
| TAI64 is TAI | "40 00 00 00 2a 2b 2c 2d hexadecimal represent 1992-06-02 08:07:09 TAI, also known as 1992-06-02 08:06:43 UTC" ([libtai](https://cr.yp.to/libtai/tai64.html)). | SPA-46 |
| Bulletin A starts in 1973 | Earlier UT1 needs ΔT from the Espenak–Meeus polynomials, whose only stated error is "not larger than 4 seconds" for −500…+500 ([NASA GSFC](https://eclipse.gsfc.nasa.gov/SEcat5/deltatpoly.html)). | SPA-50 |
| Deep-space events have three clocks | SCET, ERT, ETT and one-way light time ([NAIF CHRONOS](https://naif.jpl.nasa.gov/pub/naif/MER/misc/chronos/ver2/Sun_Solaris/chronos.ug)); "Spacecraft Event Time, equal to ERT minus OWLT" ([NASA BSF](https://science.nasa.gov/learn/basics-of-space-flight/glossary/)). | SPA-51 |
| Sunrise is an input to rules across the epic | Aviation night (14 CFR 1.1, 61.57(b)), NOTAM `SR`/`SS`, COLREG Rule 20; zenith distance 90.8333°, twilights 6°/12°/18° ([USNO](https://aa.usno.navy.mil/faq/RST_defs)); "accurate to within a minute … between +/- 72° latitude" ([NOAA](https://gml.noaa.gov/grad/solcalc/calcdetails.html)). | SPA-75 |

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
| Recurrence / iCal RFC 5545 | Different concern from point-in-time math. CORE-55's weekly windows with dated exceptions cover every consumer in the epic without becoming a recurrence engine. |
| Polar motion (Bulletin A x, y) | Needed for full terrestrial-to-celestial transformation; SPA-50 delivers rotation about the pole only. |
| Lunar phases and rise/set | Deterministic (Meeus ch. 49) but no consumer in the epic; revisit if a maritime or religious-calendar story needs them. |
| UIC 406 blocking-time components as GMT text | The leaflet is paid; RAI-23 takes the components from the caller. Add them only from the primary text. |
| 30/360 US (SIA) February rules | The governing SIFMA book is not online; FIN-42 excludes the variant until it is cited. |
