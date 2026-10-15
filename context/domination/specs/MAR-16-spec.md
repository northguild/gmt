# MAR-16 — GNSS time scales, the leap-second table and TAI: implementation spec

Story: [`issues/MAR-16.md`](../issues/MAR-16.md) (tracker #197). This story also builds **all of
[SPA-48](../issues/SPA-48.md)** (#229, which flips to Done with it) and **`toTAI` / `fromTAI`
from [SPA-46](../issues/SPA-46.md)** (#227, which keeps only the TAI64 labels). GMT supports the
**world-standard set of six satellite time scales** as peers: GPS, Galileo, BeiDou, QZSS, GLONASS
and NavIC, by their RINEX 4.02 §5.2.8 identifiers. No system is a default and none has functions of
its own (D6; tracker, "International authority first"). Owner decisions on scope, the six systems as
peers, the leap-second table, GLONASS, NavIC and the namespace layout are final; this spec does not
re-open them.

**Where the code lives (owner decision, D13).** Two new building-block namespaces, neither of them
an industry layer:

- **`timescale/`** — a Core primitive like `precision/`: the leap-second table and its queries, and
  `toTAI` / `fromTAI`.
- **`gnss/`** — a cross-industry primitive: the six satellite system times, the week and rollover
  functions, and the RINEX week functions.

There is no `space/` and no `maritime/` namespace in this story. Story IDs (MAR-16, SPA-48, SPA-46)
do not change; only code locations do.

**Sources.** Clause wording and editions come from
[`research/mar-16-gnss-icd-clauses.md`](../research/mar-16-gnss-icd-clauses.md) (2026-10-15; "R§n"
is its section n). Its §12 rows are folded into §0 and its §11 corrections into §8.1, including
§5a (NavIC) and correction 13.

**Verification.** Every expected value below was produced by running code, not from memory:

- `@js-temporal/polyfill` 0.5.1 on Node 24.21.0, through a scratch reference implementation of
  the algorithms in §3;
- the leap-second table parsed from IERS `Leap_Second.dat`, fetched 2026-10-15 (header "Updated
  through IERS Bulletin 72 issued in July 2026"; SHA-256
  `6cb6f5d4b819f2e568e25db4b0b26d89dedf031fdffb18bc94d40f4e94e268d7`), each row's MJD checked
  against its date by code; the researcher's parse (R§6.1) gives the same 28 rows;
- IERS Bulletin C 72 and ITU-R TF.460-6, fetched and quoted verbatim (R§6.2, R§7.1 agree);
- rollover instants that match the researcher's own runs (R§8, R§5a.7).

A round-trip sweep (every TAI-based system and TAI, ±2 s, ±1 s, ±1 ns and the inserted second
around each of the 27 leap seconds) ran 563 conversions with 0 failures. tdd-dev re-verifies each
row in its red step.

---

## Decisions this spec makes

### D1. The leap-second table is closed and built in

**Owner decision**, under the reference-data rule as now amended (tracker DoD; overview "Bundled
reference data"): "a table its standards body has closed … ships on the default path as an
internal constant, with its source and final revision cited beside it". The IERS leap-second
table is closed:

- CGPM 2026 Resolution 5 "decides that continuous UTC will become effective on 20 May 2027" (R§7.3);
- IERS Bulletin C 72 (6 July 2026): "NO leap second will be introduced at the end of December
  2026" and "Leap seconds can be introduced in UTC at the end of the months of December or June"
  (R§6.2). The next date IERS names, the end of June 2027, falls after continuous UTC begins.

So:

- The 28 rows are a module-level constant in `packages/gmt/src/internal/leapSeconds.ts`, with the
  source and final revision in its comment. **No function takes a table argument.**
- **After the last row, TAI − UTC is 37 s indefinitely.** No function has an upper date bound of
  its own; the limits are Temporal's instant range and, for scale strings, the four-digit year.
- **No `…/data` subpath.** Nothing in this story is opt-in data.
- A weekly IERS canary (§5.8) runs until IERS publishes its file format for continuous UTC, and is
  retired then (**owner decision**, §9.1). ITU-R TF.460-6 §2.1 still allows a month end other than
  June or December with eight weeks' notice (§2.3), so until 20 May 2027 the canary is what would
  catch a Bulletin C 73 announcing, say, an end-of-March 2027 insertion.

### D2. SPA-48's table functions: what survives the no-catch-all rule

Decided by the rule "a call the types accept must return a value", read strictly: no function
whose typed calls can only return one value.

| SPA-48 function | Decision | Reason |
| --- | --- | --- |
| `taiMinusUtc(isoString)` | **Keep** | Varies with the date (10 … 37, `null` before 1972) |
| `leapSecondsBetween(start, end)` | **Keep** | Varies with both dates |
| `isLeapSecond(isoString)` | **Keep** | `true` on 27 seconds, `false` elsewhere |
| `nextLeapSecond(isoString)` | **Keep** | 27 different answers for dates up to 2016-12-31T23:59:59Z, `""` after |
| `leapSecondTable()` | **Drop** | No argument and a constant result: one value for every call. The rows are reachable through the kept functions (`nextLeapSecond` walks every insertion; `taiMinusUtc` reads every value), and the guide prints them with their source |
| `tableProvenance()` | **Drop** | Same reason, and with no caller-supplied table there is no second table whose provenance could differ. Source and revision are cited in the constant's comment, the JSDoc and the guide |
| `isTableStale(at)` | **Drop** | Can never return `true`: the table is closed, so no date is beyond it |
| `isValidLeapSecondTable(table)` | **Drop** | No caller-supplied tables |

The SPA-48 issue edits record each drop (§8.1).

### D3. `isLeapSecond`: the table lookup takes the name; the syntax check becomes `hasSecond60`

`plain/validate/isLeapSecond(value)` exists, root-exported, and only tests that a seconds field
reads `60`. A second root `isLeapSecond` breaks `export *` (TS2308) and `build-reference.ts`.
**Resolution (breaking, `minor` with a Breaking changes section):** rename the syntax check to
`hasSecond60` (same location, behaviour and tests); `timescale/validate/isLeapSecond(isoString)` is the
table lookup.

- ITU-R TF.460-6 Annex 1 §2.1–2.2 defines a leap second as "the last second of a UTC month" that
  "begins at 23h 59m 60s". `isLeapSecond("2024-06-15T12:34:60Z") // true` is false by that
  definition. SPA-48: "`isLeapSecond` is a table lookup, not a pattern match."
- `hasSecond60` names what the old function tests: RFC 3339 §5.6's `time-second` holding 60.
- The old one-argument call keeps compiling but changes meaning: `isLeapSecond("2024-06-15T12:34:60Z")`
  was `true` and is now `false`. The changeset says so in its Breaking changes section.
- Owner policy allows the break: no 2.0.0, no shim, no deprecation (coding-standards § Changesets).

### D4. A `:60` input is accepted only for a listed insertion

TF.460-6 Annex 3 dates events inside a leap second as "30 June, 23h 59m 60.6s UTC". Every
UTC-reading function here:

- accepts `…T23:59:60[.f]Z` (and any offset spelling of the same instant,
  `2017-01-01T08:59:60+09:00`) **only when** the table lists an insertion at the next 00:00 UTC, and
  maps it to the inserted TAI second: `2016-12-31T23:59:60Z` → `2017-01-01T00:00:36 TAI`;
- returns the sentinel for any other second-60 string;
- writes `…T23:59:60[.f]Z` when a TAI, GPS, GAL, BDT, QZS or IRN label falls inside an inserted
  second: `fromTAI("2017-01-01T00:00:36.5 TAI") // "2016-12-31T23:59:60.5Z"`.

Continuous scales (TAI, GPS, GAL, BDT, QZS, IRN) have no second 60. `GLO`
inserts leap seconds with UTC ("it introduces the same leap seconds as UTC", RINEX 4.02 §4.1.2), so
`…T23:59:60 GLO` is valid exactly when UTC's label is.

Nothing else widens: `parseInstantNanoseconds`, `toNanoseconds`, `spanNs` and every other GMT
function still reject `:60`. A `:60` string these functions write is readable only by this story's
functions; the JSDoc says so.

### D5. Scale strings: one fixed grammar, FITS and RINEX tokens, a new scoped exception

A time-scale string is an ISO 8601 extended local date-time, one space, and a token naming the
scale: `'2026-01-01T00:00:37 TAI'`. It is not SPICE syntax: `str2et_c` accepts only "TDB, TDT, UTC"
(and `TT`) as labels (R§9.1). The tokens come from the standards that define them (R§9.2–9.4):

| Scale | Token | Authority |
| --- | --- | --- |
| TAI | `TAI` | FITS 4.0 §9.2.1 Table 30, p. 38 (IAU FITS Working Group) |
| GPS time | `GPS` | RINEX 4.02 / 3.05 §5.2.8 ("GPS to identify GPS time"); FITS 4.0 Table 30 |
| Galileo time | `GAL` | RINEX §5.2.8 ("GAL to identify Galileo time") |
| BeiDou time | `BDT` | RINEX §5.2.8 ("BDT to identify BDS time") |
| QZSS time | `QZS` | RINEX §5.2.8 ("QZS to identify QZSS time") |
| GLONASS time | `GLO` | RINEX §5.2.8 ("GLO to identify the GLONASS UTC time") |
| NavIC time | `IRN` | RINEX §5.2.8 ("IRN to identify NavIC time") |

The "date-time, space, token" arrangement is a **GMT rule**; no standard joins the two. The token is
the same string as the `GnssSystem` member, so `gnssToUtc("GAL", "2024-01-01T00:00:18 GAL")`.

### D6. `GnssSystem` is the six RINEX identifiers; week functions take a named counter

`GnssSystem = "GPS" | "GAL" | "BDT" | "QZS" | "GLO" | "IRN"`: the complete RINEX 4.02 §5.2.8 list.
MAR-16's `'BDS'` names the constellation, not a time token, and becomes `'BDT'`. The six are the
systems the IMO recognises as components of the World-Wide Radionavigation System under Resolution
A.1046(27) (BeiDou by SN.1/Circ.329, 2014), each with its own receiver standard in the IEC 61108
series; the recognition texts for the other five and the IEC 61108 part list were not reached —
marked, not asserted.

**No system-specific functions (owner decision).** Every system goes through the same functions:
`utcToGnss` / `gnssToUtc` for scale strings, `gnssWeekToUtc` / `utcToGnssWeek` for broadcast weeks,
`rinexWeekToUtc` / `utcToRinexWeek` for RINEX weeks. No system has a function or type of its own:
a national system never gets its own named function (tracker, "International authority first").

GPS and QZSS each broadcast two week counters: LNAV "a modulo 1024 binary representation", CNAV "a
modulo-8192 binary representation" (IS-GPS-200N §20.3.3.3.1.1, §30.3.3.1.1.1; IS-QZSS-PNT-006
§4.1.2.3(1), §4.2.2). A week number means nothing without its counter's width, and guessing is a
catch-all. So the week functions take the counter by name, a union in which each member has exactly
one modulus:

```ts
type GnssWeekCounter =
  | "GPS-LNAV" | "GPS-CNAV" | "GAL" | "BDT" | "QZS-LNAV" | "QZS-CNAV" | "IRN-LNAV" | "IRN-L1NV";
```

NavIC also has two: the L5/S message's week "is coded on 10 bits … which covers 1024 weeks" (ISRO
IRNSS ICD SPS 1.1 §5.7), the L1 message's "on 13 bits … which covers 8192 weeks" (NavIC ICD SPS L1
1.0 §5.6) (R§5a.2). The member names are the RINEX 4.02 navigation-message names: `LNAV` and `CNAV`
for GPS and QZSS, `LNAV` (Table A30) and `L1NV` (Table A31) for NavIC. Joining them to the system
token with `-` is a **GMT rule**. Galileo (12 bits, "covers 4096 weeks", Issue 2.2 Table 69) and
BeiDou (13 bits, "0 through 8191", B1I 3.0 §5.2.4.4) each have one counter. **GLONASS has no week
counter, so `GLO` is not a member**: a typed call could only return the sentinel. An untyped `'GLO'`
still returns it (MAR-16's verification line, tested with `// @ts-expect-error`).

Each counter's time of week is taken in **seconds of week**, 0 up to 604 800. Where a message
broadcasts it coarser — NavIC L5/S in 12 s counts 1–50400, NavIC L1 as a two-hour index plus an
18 s count (R§5a.2) — the caller converts to seconds first; the JSDoc says so.

### D7. `rolloverEra` is required: an integer, `"rolling"`, or a caller-stated pivot

The house precedent is the two-digit year (coding-standards § EDI): `yearWindow` is a fixed start or
`"rolling"`, named by the caller; "GMT never picks a century where it has a choice". So
`rolloverEra: RolloverEra` is a required positional argument, in one of three forms:

- an integer ≥ 0 is the era (full week = era × modulus + week): the form for stored data whose era is
  known;
- `"rolling"` is the era that puts the full week within half a counter period of the current week
  (§3.9): the form for live receiver output. It reads the clock once and is computed, never a fixed
  year;
- `{ notBefore: string }` (owner decision) is a caller-stated pivot: an ISO 8601 UTC instant, and the
  week resolves to the **earliest instant at or after it** (§3.9). It models a receiver that
  resolves the week against its firmware build date, and replays a recorded log the way that
  receiver did. The pivot is the caller's value, never GMT's.

All three are total: every call the types accept returns a value or the sentinel for invalid input.
`utcToGnssWeek` needs nothing new: it already returns the era, and an instant has only one.

### D8. One signature order

The system or counter is first in every GNSS function: the story's `utcToGnssWeek(utcString,
system)` becomes `utcToGnssWeek(counter, utcString)`, matching `utcToGnss(system, utcString)`.

### D9. CGPM 2022 and 2026

SPA-48's "discontinue leap seconds by 2035" is wrong and is replaced (§8.1): CGPM 2022 Resolution 4
"decides that the maximum value for the difference (UT1-UTC) will be increased in, or before, 2035"
and never says "discontinue" (R§7.2); CGPM 2026 Resolution 5 sets continuous UTC from 20 May 2027,
with a maximum |UT1 − UTC| of 3600 s (R§7.3). Rollover instants after 2027 (GPS LNAV
2038-11-20T23:59:42Z, Galileo 2078-02-19T23:59:42Z) now rest on Resolution 5, not on a guess.

### D10. GLONASS: the world-standard meaning only

**Owner decision:** `GLO` follows RINEX 4.02 and BIPM, and GMT does not implement any other GLONASS
scale.

- RINEX 4.02 §4.1.2: "The reported GLONASS time has the same hours as UTC and not UTC+3 h … RINEX
  uses GLO as system time identifier for the reported GLONASS time." §5.2.8: "GLO to identify the
  GLONASS UTC time". BIPM Annual Report vol. 15, p. 49: "[UTC - GLONASS time] = 0 s + C1".
- So a `GLO` label is UTC's own wall clock, leap seconds included: `utcToGnss("GLO",
  "2024-01-01T00:00:00Z") // "2024-01-01T00:00:00 GLO"`.
- **Why GMT does not offer UTC + 3 h:** the system's own interface document defines its internal
  system time three hours ahead of UTC(SU) (GLONASS ICD Ed. 5.1 §3.3.3, R§4.1), but RINEX and BIPM,
  the interchange and metrology standards, report GLONASS time in UTC hours, and that is the form
  callers hold. The JSDoc says a reader of raw broadcast GLONASS system time must subtract 3 h
  themselves. This is the only place the ICD is cited.
- **The `GLO` boundary is 1972-01-01T00:00:00Z.** RINEX and BIPM define `GLO` as UTC hours and state
  no epoch, so a `GLO` label exists wherever UTC has whole-second leap seconds: from the table's
  first row. **Owner decision** (§9.1).
- UTC(SU) is read as UTC: BIPM's C1 is a broadcast correction of nanoseconds, not an input.

### D11. NavIC (`IRN`)

**Owner decision** to support it; the facts are R§5a.

- **Scale name and epoch.** The scale is IRNSST (RINEX 4.02 §4.1.6; the ICDs say "IRNSS System
  Time" and "NavIC System Time"; IRNWT is the facility that generates it). Its start epoch is
  00:00:00 IRNSST on 22 August 1999 = **1999-08-21T23:59:47Z**: "At the start epoch, IRNSS System
  Time shall be ahead of UTC by 13 leap seconds. (i.e. IRNSS time, August 22 nd 1999, 00:00:00
  corresponds to UTC time August 21st 1999, 23:59:47)" (ICD SPS 1.1 §5.7 p. 15; L1 ICD 1.0 §5.6
  p. 34; RINEX 4.02 §4.1.6). The ICD's "00:00 UT" is a label on the NavIC scale.
- **TAI − IRNSST = 19 s is derived, not stated.** No ICD mentions TAI and BIPM publishes no NavIC
  relation (R§5a.4–5a.5). 32 s (TAI − UTC at the epoch, IERS table) minus the 13 s NavIC led UTC by
  gives 19 s; RINEX 4.02 Table 1, "GPS = IRN = UTC + ΔtLS", agrees. NavIC is the only one of the six
  without BIPM backing, and its JSDoc says the offset is derived.
- **No leap seconds, also derived:** the epoch is stated as a lead of "13 leap seconds"; both ICDs
  broadcast ΔtLS and ΔtLSF and convert to UTC with the GPS-style algorithm (ICD 1.1 App. F.1); RINEX
  Table 1 equates IRN with GPS. So `IRN` is a continuous TAI-based scale, the same branch as GPS.
- **Week 0 = GPS week 1024**, so the two NavIC 10-bit rollovers fall on the GPS ones
  (2019-04-06T23:59:42Z, 2038-11-20T23:59:42Z); the first 13-bit rollover is 2156-08-21T23:59:42Z
  (R§5a.7; verified here).

### D12. RINEX navigation weeks have their own functions

**The trap.** A RINEX navigation file's NavIC week is "Continuous number, not mod (1024), counted
from 1980 (same as GPS)" (RINEX 4.02 Table A30, p. 109), not the NavIC broadcast count from 1999
(R§5a.6). Passed to a NavIC broadcast counter it is 1024 weeks off: `gnssWeekToUtc("IRN-L1NV", 2295,
86418, 0)` would return 2043-08-17T00:00:00Z for a record meant as 2024-01-01 (verified). RINEX 4.02
§4.1.8 Table 3 shows the same continuous count for the "GPS/QZS/IRN/GAL RINEX" row (R§5a.6).

**Decision (no-catch-all: split by kind).** A RINEX week and a broadcast week are different kinds
of number — one never wraps and has no era, the other wraps and needs one — so they get different
functions, and a RINEX week can never reach a broadcast counter by type:

```ts
type RinexWeekSystem = "GPS" | "GAL" | "BDT" | "QZS" | "IRN";
function rinexWeekToUtc(system: RinexWeekSystem, week: number, timeOfWeekSeconds: number): string;
function utcToRinexWeek(system: RinexWeekSystem, utcString: string): RinexWeek | null;
```

- `GPS`, `QZS`, `IRN`, `GAL`: the week counts from the GPS epoch, 1980-01-06 (Table A30 for IRN;
  Table 3's "GPS/QZS/IRN/GAL RINEX" row for all four). For these four the answer is the same, since
  the four scales share whole seconds (RINEX Table 1); the system argument names which record the
  week came from.
- `BDT`: the only RINEX system counted from its own epoch — BDT weeks from 2006-01-01T00:00:00 BDT
  (RINEX 4.02 §5.4.6 p. 41; Table A23 p. 99). Table A27's worked example, C05 at 2021-07-05 22:00 BDT
  → week 809, Toe 165600, is a test row.
- `GPS`, `QZS`, `GAL`, `IRN` are confirmed continuous from 1980-01-06 on each system's own scale
  (Tables A9, A19, A13 footnote 5*, A30). No system needs a rollover era.
- CNAV/CNAV-2, BDS CNAV-1/2/3 and NavIC L1NV records carry no week column; their week comes from the
  record's epoch line. The JSDoc says so.
- `GLO` is not a member: RINEX GLONASS navigation records carry no week number.
- A full GPS week from any other source (IS-GPS-200N §6.2.4: the week number "continuously
  increments by one (1) at each end/start of week epoch without ever resetting to zero") is the same
  count, so `rinexWeekToUtc("GPS", …)` reads it too; the JSDoc says so.
- `gnssWeekToUtc`'s JSDoc says a RINEX week is not a broadcast week and names `rinexWeekToUtc`.

For the 10-bit counters the types alone already protect: a RINEX week such as 2295 is out of range
(≥ 1024) and returns the sentinel. The 13-bit counters (`GPS-CNAV`, `QZS-CNAV`, `IRN-L1NV`) and
Galileo's 12-bit one accept such numbers, which is why the separate function matters.

### D13. Namespaces: `timescale/` and `gnss/`; the Space realm's name is unsettled

**Owner decision.** `timescale/` is a Core primitive (like `precision/`): TAI − UTC, leap seconds,
`toTAI` / `fromTAI`. `gnss/` is a cross-industry primitive: satellite system times and weeks, used
by maritime, aviation, IoT, finance timestamping and space alike. Neither is an industry layer on
the docs site. `maritime/` is created by the first story that ships something maritime-only
(MAR-17, MAR-18, MAR-19 or MAR-59).

**The Space realm's own namespace name is deliberately unsettled.** "space" will collide with a
planned spatial/geo expansion (GeoJSON, coordinates). The name is decided when the SPA stories
start; `space/` is not reserved, and nothing in this story creates it.

---

## 0. Authority — what each rule rests on

| Rule | Source |
| --- | --- |
| The 28 table rows, 1972-01-01 (10 s) to 2017-01-01 (37 s) | IERS `Leap_Second.dat`, "Updated through IERS Bulletin 72 issued in July 2026" (R§6.1; verified here, MJD cross-checked by code) |
| The table is closed; TAI − UTC = 37 s after its last row | CGPM 2026 Resolution 5: "continuous UTC will become effective on 20 May 2027" (R§7.3); IERS Bulletin C 72: "NO leap second will be introduced at the end of December 2026", "Leap seconds can be introduced in UTC at the end of the months of December or June", "from 2017 January 1, 0h UTC, until further notice : UTC-TAI = -37 s" (R§6.2). Built in by the amended reference-data rule (tracker DoD) |
| An end-of-March 2027 insertion is still allowed by TF.460-6, hence the canary | TF.460-6 Annex 1 §2.1 (second preference March and September), §2.3 (at least eight weeks' notice) |
| UTC differs from TAI by an integer number of seconds | TF.460-6 Annex 1 §C, p. 2 |
| A leap second is the last second of a UTC month; positive is 23:59:60, negative is 23:59:58 followed by 00:00:00 | TF.460-6 Annex 1 §2.1, §2.2, p. 3. So a row's `at` is 00:00:00 UTC on day 1 of a month, steps are ±1 s |
| Fractional seconds inside a leap second | TF.460-6 Annex 3, Figures 3–4 ("30 June, 23h 59m 60.6s UTC") |
| TAI − UTC during an inserted second is the old value | Bulletin C 72 ("from 2017 January 1, 0h UTC"); TF.460-6 §2.2 |
| No integer offset before 1972-01-01 | BIPM Annual Report on Time Activities vol. 15, Table 2, p. 15: "1968 Feb. 1 - 1972 Jan. 1 4.213 1700 + (MJD - 39126) × 0.002 592", "1972 Jan. 1 - 1972 Jul. 1 10 (integral number of seconds)" (R§10) |
| Max \|UT1 − UTC\| increased in or before 2035 (not "discontinue") | CGPM 2022 Resolution 4 (R§7.2) |
| GPS time: zero at "midnight on the night of January 5, 1980/morning of January 6, 1980"; "a continuous time scale"; week = 604,800 s | IS-GPS-200N §3.3.4, p. 37 (R§1.1) |
| GPS week never resets; broadcast values may be truncated | IS-GPS-200N §6.2.4, p. 47 |
| GPS LNAV week 10 bits modulo 1024; CNAV 13 bits modulo 8192 | IS-GPS-200N §20.3.3.3.1.1, p. 93; §30.3.3.1.1.1, p. 159 |
| GPS time of week, 0 to just under 604,800 s | IS-GPS-200N §3.3.4(a): "0 to 403,199 X1 epochs (equaling one week)", X1 = 1.5 s (**derived**, R§1.2) |
| TAI − GPS time = 19 s (+ C0, tens of ns) | BIPM Annual Report vol. 15, p. 48: "[TAI - GPS time] = 19 s + C0" (R§1.6). IS-GPS-200N never mentions TAI |
| Integer UTC − GPS = 19 − (TAI − UTC); UTC − GAL = 19 − (TAI − UTC); UTC − BDT = 33 − (TAI − UTC); UTC − GLONASS = 0 | BIPM `utc-gnss` file header (2024), with xx = TAI − UTC from `Leap_Second.dat` (R§1.6) |
| GST start epoch 13 s before 1999-08-22T00:00:00 UTC | Galileo OS SIS ICD Issue 2.2 §5.1.2, p. 58, Table 69: "GST was equal to 13 seconds on August 22nd, 1999 at 00:00:00 UTC" (R§2.1) |
| TAI − GST = **+19 s** | BIPM `utc-gnss` "[UTC-GALILEO time]: (19-xx) s" (R§2.5); cross-check 32 − 13 = 19. MAR-16's "−19 s" is a sign error (§8.1) |
| Galileo week 12 bits, 4096 weeks; TOW 0–604799; continuous | Galileo OS SIS ICD Issue 2.2 §5.1.2, Table 69 (R§2.2–2.4) |
| Galileo's week 0 = GPS week 1024 | RINEX 4.02 §4.1.3 |
| BDT epoch 00:00:00 UTC 1 January 2006; "accumulates continuously without leap seconds" | BDS-SIS-ICD-B1I-3.0 §3.3, p. 3 (R§3.1) |
| TAI − BDT = 33 s | BIPM `utc-gnss` "[UTC-BEIDOU time]: (33-xx) s" (R§3.4); cross-check TAI − UTC = 33 s from 2006-01-01 |
| BDT week 13 bits, 0–8191; SOW since last Sunday 00:00:00 BDT | BDS-SIS-ICD-B1I-3.0 §5.2.4.4, §5.2.4.3, p. 25 |
| QZSST 19 s behind TAI, the same whole seconds as GPS time | RINEX 4.02 §4.1.7 Table 1: "GPS = QZS = UTC + ΔtLS"; IS-QZSS-PNT-006 §5.1, p. 120: "delayed from TAI by 19 seconds" (R§5, R§9.3) |
| QZSS week counted from 1980-01-06 | IS-QZSS-PNT-006 §5.1 (R§5) |
| QZSS LNAV week modulo 1024; CNAV modulo 8192 | IS-QZSS-PNT-006 §4.1.2.3(1) p. 46; §4.2.2 p. 74 |
| `GLO` = GLONASS time in UTC hours, with UTC's leap seconds | RINEX 4.02 §4.1.2, §5.2.8; BIPM Annual Report vol. 15 p. 49 (R§4.5) |
| GMT does not implement GLONASS system time (UTC + 3 h) | Owner decision (D10). The scale is defined in GLONASS ICD Ed. 5.1 §3.3.3 (R§4.1), cited only to say why it is not used |
| `GLO` boundary 1972-01-01T00:00:00Z | Owner decision (D10, §9.1): RINEX and BIPM state no GLONASS epoch; UTC has whole-second leap seconds from the table's first row |
| No GLONASS week counter | GLONASS has no week number (R§4.3–4.4); no-catch-all rule (D6) |
| NavIC (IRNSST) epoch: 00:00:00 IRNSST 1999-08-22 = 1999-08-21T23:59:47Z, NavIC 13 s ahead of UTC | ISRO-IRNSS-ICD-SPS-1.1 §5.7, p. 15; ISRO-NAVIC-ICD-SPS-L1-1.0 §5.6, p. 34; RINEX 4.02 §4.1.6, p. 16 (R§5a.1) |
| TAI − IRNSST = 19 s | **DERIVED** (R§5a.4): 32 s TAI − UTC at the epoch (IERS row 1999-01-01) − 13 s. RINEX 4.02 Table 1 "GPS = IRN = UTC + ΔtLS" agrees. No ICD mentions TAI; BIPM publishes no NavIC row (R§5a.5) |
| NavIC applies no leap seconds | **DERIVED** (R§5a.3): epoch stated as a lead of "13 leap seconds"; ΔtLS / ΔtLSF and the GPS-style UTC algorithm (ICD 1.1 Table 16 p. 24, App. F.1 p. 54); RINEX Table 1 |
| NavIC L5/S week: 10 bits, 1024 weeks; TOWC 1–50400 × 12 s | ISRO-IRNSS-ICD-SPS-1.1 §5.7 p. 15; §6.2.1.1 p. 29 |
| NavIC L1 week: 13 bits, 8192 weeks; ITOW 0–83 two-hour epochs, TOI 1–400 × 18 s | ISRO-NAVIC-ICD-SPS-L1-1.0 §5.6 p. 34; §6.2.1.1–6.2.1.3 p. 45 |
| NavIC time of week in whole seconds, 0–604 799 | **DERIVED** (R§5a.2) from the broadcast counts above; GMT takes seconds of week |
| NavIC week 0 = GPS week 1024; rollovers 2019-04-06T23:59:42Z, 2038-11-20T23:59:42Z (10-bit), 2156-08-21T23:59:42Z (13-bit) | RINEX 4.02 §4.1.6 ("will roll over after week 1023 (at the same time as GPS and QZSS roll over)"); computed (R§5a.7; verified here) |
| RINEX navigation-file NavIC week: continuous from 1980, not mod 1024 | RINEX 4.02 Table A30, p. 109: "Continuous number, not mod (1024), counted from 1980 (same as GPS)" |
| RINEX GPS/QZS/IRN/GAL weeks run on continuously from 1980 | RINEX 4.02 §4.1.8 Table 3, p. 18 (R§5a.6) |
| RINEX BeiDou navigation-record week: BDT weeks from 2006-01-01T00:00:00 BDT | RINEX 4.02 §5.4.6 p. 41; Table A23 p. 99; worked example Table A27 (researcher §9.3.1, §12) |
| RINEX GPS, QZS, GAL, IRN weeks from 1980-01-06 on each system's scale | RINEX 4.02 Tables A9, A19, A13 footnote 5*, A30 |
| Navigation-message names `LNAV`, `CNAV`, `L1NV` | RINEX 4.02 Tables A-series (A30 NavIC LNAV, A31 NavIC L1NV); IS-GPS-200N; IS-QZSS-PNT-006 |
| RINEX weeks and broadcast weeks are separate functions | **GMT rule** (D12), from the no-catch-all rule |
| `timescale/` and `gnss/` namespaces; `space/` not reserved | Owner decision (D13) |
| Nominal offsets only (C0, C1, A0/A1, GGTO, A0UTC not applied) | **GMT rule.** Broadcast corrections are not inputs (DoD "No invented quantities"); BIPM puts them at tens of nanoseconds |
| Time-scale tokens | D5: FITS 4.0 Table 30; RINEX 4.02 / 3.05 §5.2.8. Arrangement: **GMT rule** |
| `GnssSystem` names | RINEX 4.02 §5.2.8, all six identifiers |
| The six as peers | IMO Resolution A.1046(27) (World-Wide Radionavigation System) and the recognitions under it (BeiDou: SN.1/Circ.329, 2014); IEC 61108 series. Other recognition texts and the IEC part list: not reached — marked, not asserted |
| No system-specific functions | Owner decision; tracker "International authority first" |
| Named week counters | Message names from IS-GPS-200N and IS-QZSS-PNT-006; joined token **GMT rule** |
| `"rolling"` era window | **GMT rule**, after coding-standards § EDI's `yearWindow: "rolling"` |
| Time of week rounded to the nearest nanosecond | **GMT rule.** TC39 Temporal resolution is 1 ns |
| UTC instant grammar | `parseInstantNanoseconds` (RFC 9557 / ISO 8601-1 as `Temporal.Instant.from` parses it, narrowed by GMT), plus the second-60 form of D4 |
| A second-60 instant string is read through Temporal's clamp | proposal-temporal `ParseISODateTime` sets second 60 to 59. Verified: `Temporal.Instant.from("2016-12-31T23:59:60.5Z")` → `2016-12-31T23:59:59.5Z`; `"2017-01-01T08:59:60+09:00"` → `2016-12-31T23:59:59Z` |
| The written offset fixes a second-60 instant | Verified: none of 418 IANA zones (polyfill 0.5.1) has a sub-minute offset at any of the 27 inserted seconds, so coding-standards rule 9 never applies |
| Fraction: 1–9 digits after `.`; output shortest | RFC 3339 §5.6 `time-secfrac = "." 1*DIGIT`; TC39 Temporal nanosecond resolution; `Temporal.PlainDateTime.prototype.toString()` automatic digits |
| Four-digit years in scale strings | **GMT rule.** Every scale starts in 1972 or later; a result after 9999-12-31 returns `""` |
| `nextLeapSecond` writes a deleted second as `…T23:59:59Z` | TF.460-6 §2.2 (23:59:59 is the omitted second). Writing its label: **GMT rule**. Reachable only by internal tests: the closed table has no deleted second |
| `leapSecondsBetween` is signed and half-open | **GMT rule.** `[start, end)` per `interval/`'s half-open standard (EWD831) |
| Nonexistent labels are rejected | [LOCAL_TIME_RESOLUTION.md](../../reference/LOCAL_TIME_RESOLUTION.md) `"reject"`: a label inside a deleted second has no instant; an inserted second has its own label, so nothing is ambiguous |
| `hasSecond60` rename | D3; TF.460-6 §2.1–2.2 |
| Sentinels | [coding-standards § API Contract](../../coding-standards.md#api-contract) |
| Dropped SPA-48 functions | D2; no-catch-all rule |

---

## 1. Files and signatures

### 1.1 Public

| File | Export |
| --- | --- |
| `packages/gmt/src/timescale/calculate/taiMinusUtc.ts` | `export function taiMinusUtc(isoString: string): number \| null` |
| `packages/gmt/src/timescale/calculate/leapSecondsBetween.ts` | `export function leapSecondsBetween(start: string, end: string): number \| null` |
| `packages/gmt/src/timescale/calculate/nextLeapSecond.ts` | `export function nextLeapSecond(isoString: string): string` |
| `packages/gmt/src/timescale/convert/toTAI.ts` | `export function toTAI(isoString: string): string` |
| `packages/gmt/src/timescale/convert/fromTAI.ts` | `export function fromTAI(taiString: string): string` |
| `packages/gmt/src/timescale/validate/isLeapSecond.ts` | `export function isLeapSecond(isoString: string): boolean` |
| `packages/gmt/src/gnss/convert/gnssToUtc.ts` | `export function gnssToUtc(system: GnssSystem, value: string): string` |
| `packages/gmt/src/gnss/convert/utcToGnss.ts` | `export function utcToGnss(system: GnssSystem, utcString: string): string` |
| `packages/gmt/src/gnss/convert/gnssWeekToUtc.ts` | `export function gnssWeekToUtc(counter: GnssWeekCounter, week: number, timeOfWeekSeconds: number, rolloverEra: RolloverEra): string` |
| `packages/gmt/src/gnss/convert/utcToGnssWeek.ts` | `export function utcToGnssWeek(counter: GnssWeekCounter, utcString: string): GnssWeek \| null` |
| `packages/gmt/src/gnss/convert/rinexWeekToUtc.ts` | `export function rinexWeekToUtc(system: RinexWeekSystem, week: number, timeOfWeekSeconds: number): string` |
| `packages/gmt/src/gnss/convert/utcToRinexWeek.ts` | `export function utcToRinexWeek(system: RinexWeekSystem, utcString: string): RinexWeek \| null` |
| `packages/gmt/src/plain/validate/hasSecond60.ts` (renamed from `isLeapSecond.ts`) | `export function hasSecond60(value: string): boolean` |

One exported function per file, each with a colocated `*.test.ts`. `plain/validate/isLeapSecond.test.ts`
becomes `hasSecond60.test.ts`, rows unchanged.

`nextLeapSecond` returns `string`, not SPA-48's `string | null`: the sentinel table gives a string
`""`, and the min/max `string | null` shape is a one-off not to copy (coding-standards line 18).
`""` means "none after this instant" and also invalid input; the JSDoc names `isValidInstant` to
tell them apart, as CORE-6 does for `[]`.

**Name collisions:** none except `isLeapSecond`, handled by D3.

### 1.2 Public types — `packages/gmt/src/types/gnss.ts` (new)

```ts
export type GnssSystem = "GPS" | "GAL" | "BDT" | "QZS" | "GLO" | "IRN";
export type GnssWeekCounter =
  | "GPS-LNAV" | "GPS-CNAV" | "GAL" | "BDT" | "QZS-LNAV" | "QZS-CNAV" | "IRN-LNAV" | "IRN-L1NV";
export type RolloverEra = number | "rolling" | { notBefore: string };
export interface GnssWeek { week: number; timeOfWeekSeconds: number; era: number }
export type RinexWeekSystem = "GPS" | "GAL" | "BDT" | "QZS" | "IRN";
export interface RinexWeek { week: number; timeOfWeekSeconds: number }
```

`types/index.ts`: `export * from "./gnss";` in alphabetical position. JSDoc in §4.1.

### 1.3 Internal helpers (new)

All under `packages/gmt/src/internal/`, each with a colocated test, exported from
`internal/index.ts`.

**`leapSeconds.ts`** — the closed table and the queries over it.

```ts
/** TAI − UTC by date: `at[i]` (epoch ns, 00:00:00 UTC on a month's first day) starts `taiMinusUtc[i]`. */
export interface LeapSecondSteps {
  readonly at: readonly bigint[];
  readonly taiMinusUtc: readonly bigint[]; // seconds
}

/**
 * IERS Earth Orientation Center, Leap_Second.dat (https://hpiers.obspm.fr/iers/bul/bulc/Leap_Second.dat),
 * updated through IERS Bulletin C 72, 6 July 2026. Closed: CGPM 2026 Resolution 5 makes UTC
 * continuous from 20 May 2027, and Bulletin C 72 rules out the end of December 2026. After the last
 * row TAI − UTC stays 37 s. Checked weekly against IERS by scripts/leap-seconds.mjs.
 */
export const LEAP_SECOND_STEPS: LeapSecondSteps;

export function taiOfUtc(steps: LeapSecondSteps, reading: UtcReading): bigint | null;
export function utcOfTai(steps: LeapSecondSteps, tai: bigint): UtcReading | null;
export function nextStepIndex(steps: LeapSecondSteps, reading: UtcReading): number;
```

The literal, exactly (each bigint produced by `Temporal.Instant.from(<date>).epochNanoseconds`; a
test asserts each one against its comment):

```ts
const ROWS: readonly (readonly [bigint, bigint])[] = [
  [63072000000000000n, 10n], // 1972-01-01T00:00:00Z
  [78796800000000000n, 11n], // 1972-07-01T00:00:00Z
  [94694400000000000n, 12n], // 1973-01-01T00:00:00Z
  [126230400000000000n, 13n], // 1974-01-01T00:00:00Z
  [157766400000000000n, 14n], // 1975-01-01T00:00:00Z
  [189302400000000000n, 15n], // 1976-01-01T00:00:00Z
  [220924800000000000n, 16n], // 1977-01-01T00:00:00Z
  [252460800000000000n, 17n], // 1978-01-01T00:00:00Z
  [283996800000000000n, 18n], // 1979-01-01T00:00:00Z
  [315532800000000000n, 19n], // 1980-01-01T00:00:00Z
  [362793600000000000n, 20n], // 1981-07-01T00:00:00Z
  [394329600000000000n, 21n], // 1982-07-01T00:00:00Z
  [425865600000000000n, 22n], // 1983-07-01T00:00:00Z
  [489024000000000000n, 23n], // 1985-07-01T00:00:00Z
  [567993600000000000n, 24n], // 1988-01-01T00:00:00Z
  [631152000000000000n, 25n], // 1990-01-01T00:00:00Z
  [662688000000000000n, 26n], // 1991-01-01T00:00:00Z
  [709948800000000000n, 27n], // 1992-07-01T00:00:00Z
  [741484800000000000n, 28n], // 1993-07-01T00:00:00Z
  [773020800000000000n, 29n], // 1994-07-01T00:00:00Z
  [820454400000000000n, 30n], // 1996-01-01T00:00:00Z
  [867715200000000000n, 31n], // 1997-07-01T00:00:00Z
  [915148800000000000n, 32n], // 1999-01-01T00:00:00Z
  [1136073600000000000n, 33n], // 2006-01-01T00:00:00Z
  [1230768000000000000n, 34n], // 2009-01-01T00:00:00Z
  [1341100800000000000n, 35n], // 2012-07-01T00:00:00Z
  [1435708800000000000n, 36n], // 2015-07-01T00:00:00Z
  [1483228800000000000n, 37n], // 2017-01-01T00:00:00Z
];
```

No Temporal call runs at module load. The 27 rows after the first are the 27 leap seconds; the
first is where whole-second TAI − UTC begins.

The query helpers take `steps` explicitly, and the public functions pass `LEAP_SECOND_STEPS`. That
keeps the deleted-second branches of §3 testable with a synthetic `steps` in the internal tests
(TF.460-6 allows a negative leap second; the closed table has none). Invariant tests on the
constant (§6.1) make a canary-driven edit that breaks a rule fail loudly.

**`utcReading.ts`** — a UTC label that may be a leap second.

```ts
export interface UtcReading {
  /** For a leap reading, the instant of `…T23:59:59.f` (Temporal's clamp of `…:60.f`). */
  readonly epochNanoseconds: bigint;
  readonly secondSixty: boolean;
}
export function parseUtcReading(value: unknown): UtcReading | null;
export function formatUtcReading(reading: UtcReading): string; // "" if Temporal throws
export function subsecondFraction(nanoseconds: bigint): string;
```

`parseUtcReading` checks shape only; whether a `:60` is real is `taiOfUtc`'s call:

1. Non-string → `null`.
2. `parseInstantNanoseconds(value)` non-null → `{ epochNanoseconds, secondSixty: false }`.
3. Else, `instantLeapSecond.test(value)` (`regex/leap-second.ts`) **and**
   `secondSixtyInstantBody.test(isoStringBody(value))` → inside `try`,
   `Temporal.Instant.from(value).epochNanoseconds` → `{ …, secondSixty: true }`; a throw → `null`.
4. Else `null`.

`secondSixtyInstantBody` is built from existing fragments, never hand-sliced:
`` new RegExp(`^${DATE}T(?:[01]\\d|2[0-3]):[0-5]\\d:60(?:[.,]\\d{1,9})?(?:Z|${EXTENDED_UTC_OFFSET})$`) ``,
with `DATE` the date part of `regex/date.ts`'s `plainDate` source and `EXTENDED_UTC_OFFSET` from
`isoStringBody.ts`. Basic format, lower-case `t`/`z` and a space separator stay refused.

`formatUtcReading`: not second-60 → `Temporal.Instant.fromEpochNanoseconds(ns).toString()`.
Second-60 → `pdt = …toZonedDateTimeISO("UTC").toPlainDateTime()`, then
`` `${pdt.toPlainDate()}T${pdt.toPlainTime().toString({ smallestUnit: "minute" })}:60${subsecondFraction(ns)}Z` ``.

`subsecondFraction(ns)`: `Temporal.PlainTime.from({ hour: 0, millisecond, microsecond,
nanosecond }, { overflow: "reject" }).toString().slice("00:00:00".length)` → `""`, `".5"`,
`".123456789"`. The sub-second count must be split into the three fields: 500 000 000 as
`nanosecond` alone is clamped to 999 by the default `overflow: "constrain"` (verified: it wrote
`.000000999`).

**`timeScaleString.ts`** — the D5 grammar.

```ts
export type TimeScaleToken = "TAI" | GnssSystem;
export const timeScaleString: RegExp =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))? (TAI|GPS|GAL|BDT|QZS|GLO|IRN)$/;
export interface TimeScaleLabel { readonly labelNanoseconds: bigint; readonly secondSixty: boolean }
export function parseTimeScaleString(value: unknown, token: TimeScaleToken): TimeScaleLabel | null;
export function formatTimeScaleString(label: TimeScaleLabel, token: TimeScaleToken): string;
```

A "label nanoseconds" value is a scale's wall clock read as if UTC
(`PlainDateTime#toZonedDateTime("UTC").epochNanoseconds`).

`parseTimeScaleString`:

1. Non-string, or no match → `null`. Group 8 `!== token` → `null`.
2. `second = Number(group 6)`; `second > 60` → `null`; `second === 60 && token !== "GLO"` → `null`.
3. `fraction = group 7 ? Number(group 7) * 10 ** (9 - group7.length) : 0` (exact: < 10⁹).
4. Inside `try`: `Temporal.PlainDateTime.from({ year, month, day, hour, minute, second: second ===
   60 ? 59 : second, millisecond: Math.floor(fraction / 1e6), microsecond: Math.floor(fraction /
   1e3) % 1000, nanosecond: fraction % 1000 }, { overflow: "reject" })`, then
   `.toZonedDateTime("UTC").epochNanoseconds`. A throw → `null`.
5. Return `{ labelNanoseconds, secondSixty: second === 60 }`.

`formatTimeScaleString`: inside `try`, `pdt` as above; year outside 0–9999 → `""`. Not second-60 →
`` `${pdt.toString()} ${token}` `` (verified `2026-01-01T00:00:37`, `2026-01-01T00:00:37.5`).
Second-60 → `` `${pdt.toPlainDate()}T${pdt.toPlainTime().toString({ smallestUnit: "minute" })}:60${subsecondFraction(ns)} ${token}` ``.

**`gnssTimeScales.ts`** — per-system constants and label conversions.

```ts
export interface GnssTimeScale {
  /** TAI minus the scale, in seconds; null for GLO, which is UTC's own wall clock. */
  readonly taiMinusScale: bigint | null;
  /** First defined label, label nanoseconds. */
  readonly epochLabel: bigint;
}
export const GNSS_TIME_SCALES: Readonly<Record<GnssSystem, GnssTimeScale>>;
export function isGnssSystem(value: unknown): value is GnssSystem;
export function scaleLabelOfUtc(system: GnssSystem, reading: UtcReading): TimeScaleLabel | null;
export function utcOfScaleLabel(system: GnssSystem, label: TimeScaleLabel): UtcReading | null;
```

| System | `taiMinusScale` | Epoch label | `epochLabel` |
| --- | --- | --- | --- |
| `GPS` | `19n` | `1980-01-06T00:00:00` | `315964800000000000n` |
| `GAL` | `19n` | `1999-08-22T00:00:00` | `935280000000000000n` |
| `BDT` | `33n` | `2006-01-01T00:00:00` | `1136073600000000000n` |
| `QZS` | `19n` | `1980-01-06T00:00:00` | `315964800000000000n` |
| `GLO` | `null` | `1972-01-01T00:00:00` | `63072000000000000n` |
| `IRN` | `19n` (derived, D11) | `1999-08-22T00:00:00` | `935280000000000000n` |

Each `epochLabel` equals `Temporal.PlainDateTime.from(<label>).toZonedDateTime("UTC").epochNanoseconds`
(a test asserts it). Each literal carries a comment naming its clause (§0).
`NANOSECONDS_PER_SECOND` comes from `foreignEpochs.ts`; add
`NANOSECONDS_PER_WEEK = 604_800_000_000_000n` beside it.

**`gnssWeek.ts`** — counters, week arithmetic, the era.

```ts
export const GNSS_WEEK_COUNTERS: Readonly<Record<GnssWeekCounter, { system: GnssSystem; modulus: bigint }>>;
// GPS-LNAV 1024n, GPS-CNAV 8192n, GAL 4096n, BDT 8192n, QZS-LNAV 1024n, QZS-CNAV 8192n,
// IRN-LNAV 1024n, IRN-L1NV 8192n
export function isGnssWeekCounter(value: unknown): value is GnssWeekCounter;
export function timeOfWeekNanoseconds(timeOfWeekSeconds: unknown): bigint | null;
export function resolveRolloverEra(counter: GnssWeekCounter, week: bigint, rolloverEra: unknown): bigint | null;
export function labelOfWeek(counter: GnssWeekCounter, week: bigint, timeOfWeekNanoseconds: bigint, era: bigint): bigint;
export function weekOfLabel(counter: GnssWeekCounter, labelNanoseconds: bigint): GnssWeek | null;
```

**`rinexWeek.ts`** — RINEX navigation-file weeks (D12).

```ts
/** Epoch label of each RINEX navigation record's continuous week count. */
export const RINEX_WEEK_EPOCHS: Readonly<Record<RinexWeekSystem, { system: GnssSystem; epochLabel: bigint }>>;
// GPS, GAL, QZS, IRN: 315964800000000000n (1980-01-06T00:00:00, the GPS epoch), each in its own scale;
// BDT: 1136073600000000000n (2006-01-01T00:00:00 BDT; RINEX 4.02 §5.4.6, Table A23)
export function isRinexWeekSystem(value: unknown): value is RinexWeekSystem;
```

A RINEX week has no modulus and no era: `label = epochLabel + week × WEEK + towNs` in the named
system's scale, with `week` any safe integer ≥ 0. Converting uses the same `utcOfScaleLabel` /
`scaleLabelOfUtc` as every other scale. (For GAL, QZS and IRN the label is read in that system's
scale; all three share whole seconds with GPS, so the result equals the GPS reading.)

---

## 2. Validation order and sentinels

Every public function validates before any work and wraps its body in
`try { … } catch { return <sentinel>; }`.

| Function | Order | Sentinel |
| --- | --- | --- |
| `taiMinusUtc(isoString)` | `parseUtcReading`; `taiOfUtc` non-null | `null` |
| `leapSecondsBetween(start, end)` | reading `start`; reading `end`; both `taiOfUtc` non-null | `null` |
| `nextLeapSecond(isoString)` | reading; `taiOfUtc` non-null | `""` |
| `isLeapSecond(isoString)` | reading; `secondSixty`; `taiOfUtc` non-null | `false` |
| `toTAI(isoString)` | reading; `taiOfUtc` | `""` |
| `fromTAI(taiString)` | `parseTimeScaleString(…, "TAI")`; not `secondSixty`; `utcOfTai` | `""` |
| `utcToGnss(system, utcString)` | `isGnssSystem`; reading; `scaleLabelOfUtc` | `""` |
| `gnssToUtc(system, value)` | `isGnssSystem`; `parseTimeScaleString(…, system)`; `utcOfScaleLabel` | `""` |
| `gnssWeekToUtc(counter, week, tow, rolloverEra)` | `isGnssWeekCounter`; `week` safe integer in `[0, modulus)`; `timeOfWeekNanoseconds`; `resolveRolloverEra`; label; `utcOfScaleLabel` | `""` |
| `utcToGnssWeek(counter, utcString)` | `isGnssWeekCounter`; reading; `scaleLabelOfUtc`; `weekOfLabel` | `null` |
| `rinexWeekToUtc(system, week, tow)` | `isRinexWeekSystem`; `week` safe integer ≥ 0; `timeOfWeekNanoseconds`; label; `utcOfScaleLabel` | `""` |
| `utcToRinexWeek(system, utcString)` | `isRinexWeekSystem`; reading; `scaleLabelOfUtc`; `d ≥ 0` | `null` |
| `hasSecond60(value)` | unchanged | `false` |

**Invalid** covers: a non-string or malformed date; a zoneless or date-only string (SPA-48's
`'2020-01-01Z'` is not an instant; its verification uses full instants, §8.1); a second-60 string
the table does not list; a date before 1972-01-01 or before the system's epoch; a scale string with
the wrong token, a second 60 on a continuous scale, a year past 9999, or any other grammar break; an
unknown system, counter or message; a week, time of week or era out of range.

**Collisions.** `nextLeapSecond`'s `""` also means "none after this instant", the answer for every
date from 2016-12-31T23:59:60Z on. `isLeapSecond`'s `false` is also the answer for an ordinary
second. Each JSDoc says so.

**Fresh objects.** `utcToGnssWeek` returns a new literal on every call (`toEqual` plus one
`not.toBe` row).

---

## 3. Algorithms (bigint nanoseconds throughout)

Notation: `A[i]` = `steps.at[i]`, `O[i]` = `steps.taiMinusUtc[i]` × 10⁹, `S` = 10⁹ ns, `n` = rows.

### 3.1 `taiOfUtc(steps, reading)`

1. `u = reading.epochNanoseconds`. If `u < A[0]` → `null`. No upper bound.
2. **Second 60.** Find `j ≥ 1` with `A[j] − S ≤ u < A[j]` and `O[j] − O[j−1] === +S`. None →
   `null`. Return `u + O[j−1] + S`.
3. **Ordinary.** `i` = last index with `A[i] ≤ u`. If `i + 1 < n`, `O[i+1] − O[i] === −S` and
   `u ≥ A[i+1] − S` → `null` (inside a deleted second). Return `u + O[i]`.

### 3.2 `utcOfTai(steps, tai)`

1. If `tai < A[0] + O[0]` → `null` (before 1972-01-01T00:00:10 TAI).
2. `i` = last index with `A[i] + O[i] ≤ tai`.
3. `u = tai − O[i]`. If `i + 1 < n` and `u ≥ A[i+1]` (only before a positive step) →
   `{ epochNanoseconds: tai − O[i] − S, secondSixty: true }`; else `{ epochNanoseconds: u,
   secondSixty: false }`.

A negative step needs no special case here (verified with a synthetic −1 row at 2030-01-01: TAI
`2030-01-01T00:00:35.5` → `2029-12-31T23:59:58.5Z`, `…00:00:36` → `2030-01-01T00:00:00Z`).

### 3.3 `nextStepIndex(steps, reading)`

`u = reading.secondSixty ? reading.epochNanoseconds + S : reading.epochNanoseconds`. Return the
first `j ≥ 1` with `A[j] > u`, or −1.

### 3.4 Timescale functions (all pass `LEAP_SECOND_STEPS`)

- `taiMinusUtc`: `Number((t − u) / S) − (secondSixty ? 1 : 0)` with `t = taiOfUtc(...)`. During an
  inserted second this is the old value (36 at `2016-12-31T23:59:60Z`).
- `leapSecondsBetween`: `taiMinusUtc(end) − taiMinusUtc(start)`: the signed count of steps whose
  second starts in `[start, end)` (`23:59:60 → 00:00:00` is 1; `23:59:59 → 23:59:60` is 0; a deleted
  second counts −1).
- `nextLeapSecond`: `j = nextStepIndex`; −1 → `""`. Else the UTC date of `A[j] − S`, as `…T23:59:60Z`
  for a positive step (`formatUtcReading` with `secondSixty: true`) and `…T23:59:59Z` for a deleted
  second (`Instant#toString`).
- `isLeapSecond`: `reading.secondSixty && taiOfUtc(...) !== null`.
- `toTAI`: `formatTimeScaleString({ labelNanoseconds: taiOfUtc(...), secondSixty: false }, "TAI")`.
- `fromTAI`: label (not second-60) → `utcOfTai` → `formatUtcReading`.

### 3.5 `scaleLabelOfUtc(system, reading)` / `utcOfScaleLabel(system, label)`

- **TAI-based** (`taiMinusScale !== null`): to the scale, `t = taiOfUtc`; `label = t −
  taiMinusScale × S`; `label < epochLabel` → null; `secondSixty: false`. From the scale:
  `label.secondSixty` → null; `label < epochLabel` → null; `utcOfTai(label + taiMinusScale × S)`.
- **`GLO`**: to the scale, `taiOfUtc(...) === null` → null (validates a `:60` and the lower bound);
  the label is the reading itself, `secondSixty` kept. From the scale, the reading is the label
  itself; `taiOfUtc(reading) === null` → null.

### 3.6 GNSS string functions

`utcToGnss` = `formatTimeScaleString(scaleLabelOfUtc(...), system)`.
`gnssToUtc` = `formatUtcReading(utcOfScaleLabel(system, parseTimeScaleString(value, system)))`.

### 3.7 Why the same arithmetic gives every story constant

GPS − UTC is never stored: 2024 is `37 − 19 = 18`; the GPS epoch `19 − 19 = 0`; 2016 `36 − 19 = 17`.
BDT − UTC in 2024 is `37 − 33 = 4`; GAL − UTC at 1999-08-22 is `32 − 19 = 13`. Each is BIPM's
`(19-xx)` / `(33-xx)` with xx read from the table.

### 3.8 Week arithmetic

- `timeOfWeekNanoseconds(tow)`: finite number, `0 ≤ tow < 604800`, else null. `ns =
  BigInt(Math.round(tow * 1e9))`; `ns >= NANOSECONDS_PER_WEEK` → null (verified:
  `Math.round(604799.9999999999 * 1e9) === 604800000000000`).
- `labelOfWeek = epochLabel + (era × modulus + week) × WEEK + towNs`.
- `weekOfLabel`: `d = label − epochLabel`; `d < 0` → null; `F = d / WEEK`, `towNs = d % WEEK`;
  `{ week: Number(F % modulus), timeOfWeekSeconds: Number(towNs) / 1e9, era: Number(F / modulus) }`.
- `gnssWeekToUtc`: label from the resolved era → `utcOfScaleLabel` → `formatUtcReading`. A week time
  inside an inserted second returns `…T23:59:60Z`.
- `utcToGnssWeek`: reading → `scaleLabelOfUtc` → `weekOfLabel`.

### 3.9 `resolveRolloverEra(counter, week, rolloverEra)`

- A number: `Number.isSafeInteger(rolloverEra) && rolloverEra >= 0` → `BigInt(rolloverEra)`; else
  null.
- `"rolling"` (exact): inside the caller's `try`, read `Temporal.Now.instant()` **once**; place it
  with `scaleLabelOfUtc`; `Fnow = (label − epochLabel) / WEEK`; `M = modulus`;
  `era = max(floor((Fnow − week + M/2) / M), 0)`. Floor explicitly: the numerator can be negative.
- `{ notBefore }` (`isObject`, read `notBefore` **once**; other keys ignored, as CORE-6 reads
  records):
  1. `notBefore` must be a string that `parseUtcReading` accepts and `taiOfUtc` places (a listed
     `:60` is accepted); otherwise null.
  2. `Lp = scaleLabelOfUtc(system, reading).labelNanoseconds`. If `Lp < epochLabel` (the pivot is
     before the counter's epoch) → null.
  3. `period = M × WEEK` (1024, 4096 or 8192 weeks, by counter); `base = epochLabel + week × WEEK +
     towNs`.
  4. `era = Lp ≤ base ? 0 : ceil((Lp − base) / period)` (bigint ceiling). The result label is
     `base + era × period`: the earliest occurrence of that week and time of week whose label is
     `≥ Lp`. **Equal counts**: a decoded instant exactly at `notBefore` is returned.
  5. The result then goes through `utcOfScaleLabel` and `formatUtcReading` like any other era; a
     label outside Temporal's instant range throws inside the `try` and returns `""`.
  Labels are compared, not UTC instants: every scale with a week counter is continuous, so label
  order is instant order, and an inserted leap second keeps its place.
- Anything else → null (including `null`, an array with no `notBefore`, and a non-string
  `notBefore`).

The decoded full week satisfies `Fnow − M/2 < F ≤ Fnow + M/2` under `"rolling"`, unless clamped at
era 0; under a pivot it satisfies `Lp ≤ L < Lp + period`.

### 3.10 RINEX weeks

- `rinexWeekToUtc(system, week, tow)`: `label = RINEX_WEEK_EPOCHS[system].epochLabel + week × WEEK +
  towNs`; then `utcOfScaleLabel(RINEX_WEEK_EPOCHS[system].system, …)` → `formatUtcReading`.
- `utcToRinexWeek(system, utc)`: `scaleLabelOfUtc` → `d = label − epochLabel`; `d < 0` → null;
  `{ week: Number(d / WEEK), timeOfWeekSeconds: Number(d % WEEK) / 1e9 }`.

---

## 4. JSDoc drafts

Follow [jsdoc-standards](../../jsdoc-standards.md). Every `@example` value is verified (§6). No peer
library is named.

### 4.1 Types

```ts
/**
 * A satellite navigation system's time scale, by its RINEX 4.02 time-system identifier: GPS time,
 * Galileo time, BeiDou time, QZSS time, GLONASS time (in UTC hours, as RINEX and BIPM report it),
 * NavIC time.
 */
export type GnssSystem = "GPS" | "GAL" | "BDT" | "QZS" | "GLO" | "IRN";

/**
 * A satellite week counter, named by system and, where a system broadcasts two, by navigation
 * message: GPS and QZSS LNAV count modulo 1024, their CNAV modulo 8192, Galileo modulo 4096,
 * BeiDou modulo 8192, NavIC LNAV (L5/S) modulo 1024 and L1NV modulo 8192. GLONASS has no week
 * counter. A RINEX navigation-file week is not one of these: see `RinexWeekSystem`.
 */
export type GnssWeekCounter =
  | "GPS-LNAV" | "GPS-CNAV" | "GAL" | "BDT" | "QZS-LNAV" | "QZS-CNAV" | "IRN-LNAV" | "IRN-L1NV";

/**
 * Which pass of a wrapping week counter a week number belongs to, in one of three forms.
 *
 * An integer from 0 is the era itself (era 0 starts at the system's epoch). `"rolling"` picks the
 * era that puts the week within half a counter period of today, for live receiver output; it reads
 * the clock, so the same stored value can give a different answer in a later year. `{ notBefore }`
 * picks the earliest occurrence at or after an instant you state — a receiver's firmware build
 * date, or the start of a recorded log — and gives the same answer in any year.
 */
export type RolloverEra = number | "rolling" | {
  /**
   * An ISO 8601 UTC instant. The week resolves to the earliest instant at or after it; an instant
   * exactly equal to it counts. Before the counter's epoch, or not an instant, returns the sentinel.
   */
  notBefore: string;
};

/** A week and time of week on one satellite week counter. */
export interface GnssWeek {
  /** The week number as the counter shows it, from 0 to the counter's modulus − 1. */
  week: number;
  /** Seconds since the start of the week, from 0 up to but not including 604 800. */
  timeOfWeekSeconds: number;
  /** How many times the counter has wrapped since the system's epoch. */
  era: number;
}

/** The systems whose RINEX navigation records carry a week number. GLONASS records do not. */
export type RinexWeekSystem = "GPS" | "GAL" | "BDT" | "QZS" | "IRN";

/** A week and time of week as a RINEX navigation record counts them: continuous, so no era. */
export interface RinexWeek {
  /** The continuous week number, counted from the record's epoch without wrapping. */
  week: number;
  /** Seconds since the start of the week, from 0 up to but not including 604 800. */
  timeOfWeekSeconds: number;
}
```

### 4.2 Timescale (`timescale/`)

A shared paragraph for the `timescale` functions (adapt per function): "TAI − UTC comes from the IERS
leap-second table built into GMT (Leap_Second.dat through Bulletin C 72, 6 July 2026). The table is
closed: the CGPM decided in 2026 that UTC becomes continuous on 20 May 2027, so after the last
insertion (2016-12-31) TAI − UTC stays 37 s."

```ts
/**
 * Return TAI − UTC, in whole seconds, at a UTC instant.
 *
 * - From the built-in IERS table: 10 s from 1972-01-01, 37 s from 2017-01-01 on. The table is
 *   closed (continuous UTC from 20 May 2027, CGPM 2026), so 37 holds for every later date.
 * - At an inserted leap second (`…T23:59:60Z`, accepted only on the 27 listed days) the value is
 *   the one before the insertion: TAI − UTC changes at 00:00:00 UTC.
 * - `null` before 1972-01-01 (TAI − UTC was then fractional with a daily rate term), for a
 *   second-60 string on a day with no insertion, and on invalid input.
 *
 * @param isoString ISO 8601 instant string; a listed leap second (`…T23:59:60Z`) is accepted
 * @returns TAI − UTC in seconds, or null on invalid input or a date before 1972
 *
 * @example taiMinusUtc("2024-01-01T00:00:00Z") // 37
 * @example taiMinusUtc("2016-01-01T00:00:00Z") // 36
 * @example taiMinusUtc("2016-12-31T23:59:60Z") // 36 — the inserted second
 * @example taiMinusUtc("2100-01-01T00:00:00Z") // 37
 * @example taiMinusUtc("1971-01-01T00:00:00Z") // null — before 1972
 */

/**
 * Return how many leap seconds fall between two UTC instants: the change in TAI − UTC.
 *
 * - Counts each leap second whose second starts in `[start, end)`: from `…T23:59:60Z` to the next
 *   `…T00:00:00Z` is 1; from `…T23:59:59Z` to `…T23:59:60Z` is 0.
 * - Signed: negative when `end` is before `start`.
 * - `null` when either instant is before 1972-01-01 or invalid.
 *
 * @param start ISO 8601 instant string
 * @param end ISO 8601 instant string
 * @returns the signed count, or null on invalid input or a date before 1972
 *
 * @example leapSecondsBetween("2020-01-01T00:00:00Z", "2024-01-01T00:00:00Z") // 0
 * @example leapSecondsBetween("2000-01-01T00:00:00Z", "2024-01-01T00:00:00Z") // 5
 * @example leapSecondsBetween("2024-01-01T00:00:00Z", "2000-01-01T00:00:00Z") // -5
 * @example leapSecondsBetween("2016-12-31T23:59:60Z", "2017-01-01T00:00:00Z") // 1
 * @example leapSecondsBetween("1971-01-01T00:00:00Z", "2024-01-01T00:00:00Z") // null
 */

/**
 * Return the first leap second after a UTC instant, as its UTC label `…T23:59:60Z`.
 *
 * - `""` for every instant from 2016-12-31T23:59:60Z on: there are no more. The table is closed
 *   (continuous UTC from 20 May 2027, CGPM 2026).
 * - `""` also on invalid input or a date before 1972; check with `isValidInstant` to tell them apart.
 *
 * @param isoString ISO 8601 instant string
 * @returns the next leap second's UTC label, or "" when there is none or on invalid input
 *
 * @example nextLeapSecond("2016-01-01T00:00:00Z") // "2016-12-31T23:59:60Z"
 * @example nextLeapSecond("1999-08-22T00:00:00Z") // "2005-12-31T23:59:60Z"
 * @example nextLeapSecond("2016-12-31T23:59:60Z") // ""
 * @example nextLeapSecond("2024-01-01T00:00:00Z") // ""
 */

/**
 * Convert a UTC instant to a TAI time-scale string, `YYYY-MM-DDTHH:MM:SS[.fraction] TAI`.
 *
 * - TAI = UTC + (TAI − UTC), from the built-in IERS table.
 * - An inserted leap second maps to its own TAI second: `2016-12-31T23:59:60Z` is
 *   `2017-01-01T00:00:36 TAI`. A second 60 on any other day returns "".
 * - Accepts any offset or bracketed zone `toNanoseconds` accepts; TAI has no zone.
 * - "" before 1972-01-01, for a result past year 9999, and on invalid input.
 *
 * @param isoString ISO 8601 instant string
 * @returns the TAI time-scale string, or "" on invalid input or a date before 1972
 *
 * @example toTAI("2026-01-01T00:00:00Z") // "2026-01-01T00:00:37 TAI"
 * @example toTAI("2013-06-01T00:00:00Z") // "2013-06-01T00:00:35 TAI"
 * @example toTAI("2016-12-31T23:59:60.5Z") // "2017-01-01T00:00:36.5 TAI"
 * @example toTAI("2017-12-31T23:59:60Z") // "" — no leap second that day
 * @example toTAI("1971-12-31T00:00:00Z") // ""
 */

/**
 * Convert a TAI time-scale string to a UTC instant string.
 *
 * - Reads `YYYY-MM-DDTHH:MM:SS[.fraction] TAI`: four-digit year, `T`, seconds required, 1 to 9
 *   fraction digits after `.`, one space, `TAI` (the FITS time-scale token). TAI has no second 60.
 * - During an inserted leap second the result is `…T23:59:60Z` (ITU-R TF.460-6 Annex 3). Only this
 *   realm's functions read that string back; other GMT functions reject a second of 60.
 * - "" before 1972-01-01T00:00:10 TAI and on invalid input.
 *
 * @param taiString TAI time-scale string
 * @returns ISO 8601 UTC instant string (`Z`), or "" on invalid input or a date before 1972
 *
 * @example fromTAI("2026-01-01T00:00:37 TAI") // "2026-01-01T00:00:00Z"
 * @example fromTAI("2017-01-01T00:00:36 TAI") // "2016-12-31T23:59:60Z"
 * @example fromTAI("2017-01-01T00:00:36.5 TAI") // "2016-12-31T23:59:60.5Z"
 * @example fromTAI("2024-01-01T00:00:37 GPS") // "" — wrong token
 * @example fromTAI("2016-12-31T23:59:60 TAI") // "" — TAI has no leap seconds
 */

/**
 * Return true when a UTC instant string is one of the 27 inserted leap seconds.
 *
 * - A table lookup, not a pattern match: `23:59:60` is well-formed on any day and real on 27 of
 *   them. For the syntax test alone, use `hasSecond60`.
 * - Accepts the inserted second in any offset spelling (`2017-01-01T08:59:60+09:00`).
 * - Leap smearing is not a leap second: a smeared clock never reads `23:59:60` and is up to a second
 *   off true UTC around an insertion. GMT cannot detect smearing.
 *
 * @param isoString ISO 8601 instant string
 * @returns true for an inserted leap second, or false otherwise and on invalid input
 *
 * @example isLeapSecond("2016-12-31T23:59:60Z") // true
 * @example isLeapSecond("2009-01-01T08:59:60+09:00") // true
 * @example isLeapSecond("2017-12-31T23:59:60Z") // false — well-formed, no insertion that day
 * @example isLeapSecond("2016-12-31T23:59:59Z") // false
 */
```

### 4.3 GNSS (`gnss/`)

```ts
/**
 * Convert a UTC instant to a satellite system's own time, as a time-scale string.
 *
 * - `GPS`, `GAL`, `BDT`, `QZS`: continuous scales a fixed number of seconds behind TAI (19, 19, 33,
 *   19), so their lead over UTC grows with every leap second and is read from the built-in table,
 *   never fixed. GPS was 0 s ahead at its 1980 epoch and is 18 s ahead since 2017.
 * - `IRN`: NavIC time (IRNSST), also 19 s behind TAI. Unlike the other four, no international body
 *   states that offset: it is derived from the NavIC ICD's epoch ("ahead of UTC by 13 leap seconds"
 *   when TAI − UTC was 32 s) and agrees with RINEX's "GPS = IRN = UTC + ΔtLS".
 * - `GLO`: GLONASS time as RINEX and BIPM report it, "the same hours as UTC and not UTC+3 h" (RINEX
 *   4.02 §4.1.2), with UTC's leap seconds: the label is UTC's own wall clock. A raw broadcast
 *   GLONASS system time, which runs three hours ahead, must have the three hours removed first.
 * - The token after the space is the system's RINEX time-system identifier.
 * - Nominal scale relations only: the nanosecond corrections a satellite broadcasts are not applied.
 * - Galileo's count starts 13 s before 1999-08-22T00:00:00 UTC (Galileo OS SIS ICD Issue 2.2 §5.1.2).
 * - "" before the system's epoch (GPS and QZSS 1980-01-06, Galileo 1999-08-21T23:59:47Z, BeiDou
 *   2006-01-01, GLONASS 1972-01-01, NavIC 1999-08-21T23:59:47Z), for a result past year 9999, and on invalid
 *   input.
 *
 * @param system satellite time scale: "GPS", "GAL", "BDT", "QZS", "GLO" or "IRN"
 * @param utcString ISO 8601 instant string; a listed leap second is accepted
 * @returns the system's time-scale string, or "" on invalid input or before the system's epoch
 *
 * @example utcToGnss("GPS", "1980-01-06T00:00:00Z") // "1980-01-06T00:00:00 GPS" — 0 s at the GPS epoch
 * @example utcToGnss("GPS", "2016-06-01T00:00:00Z") // "2016-06-01T00:00:17 GPS"
 * @example utcToGnss("GPS", "2024-01-01T00:00:00Z") // "2024-01-01T00:00:18 GPS"
 * @example utcToGnss("GPS", "2016-12-31T23:59:60Z") // "2017-01-01T00:00:17 GPS"
 * @example utcToGnss("GAL", "1999-08-22T00:00:00Z") // "1999-08-22T00:00:13 GAL"
 * @example utcToGnss("BDT", "2006-01-01T00:00:00Z") // "2006-01-01T00:00:00 BDT"
 * @example utcToGnss("BDT", "2024-01-01T00:00:00Z") // "2024-01-01T00:00:04 BDT"
 * @example utcToGnss("QZS", "2024-01-01T00:00:00Z") // "2024-01-01T00:00:18 QZS"
 * @example utcToGnss("GLO", "2024-01-01T00:00:00Z") // "2024-01-01T00:00:00 GLO"
 * @example utcToGnss("GLO", "2016-12-31T23:59:60Z") // "2016-12-31T23:59:60 GLO"
 * @example utcToGnss("IRN", "2024-01-01T00:00:00Z") // "2024-01-01T00:00:18 IRN"
 * @example utcToGnss("BDT", "2005-12-31T23:59:59Z") // "" — before BeiDou's epoch
 */

/**
 * Convert a satellite system's time-scale string to a UTC instant string.
 *
 * - Reads `YYYY-MM-DDTHH:MM:SS[.fraction] <token>` with the system's RINEX token. Any other token
 *   returns "".
 * - A continuous scale has no second 60; `GLO` has one exactly when UTC does.
 * - During an inserted leap second the result is `…T23:59:60Z`.
 * - "" before the system's epoch and on invalid input.
 *
 * @param system satellite time scale: "GPS", "GAL", "BDT", "QZS", "GLO" or "IRN"
 * @param value the system's time-scale string
 * @returns ISO 8601 UTC instant string (`Z`), or "" on invalid input or before the system's epoch
 *
 * @example gnssToUtc("GPS", "2017-01-01T00:00:17 GPS") // "2016-12-31T23:59:60Z"
 * @example gnssToUtc("GPS", "2038-11-21T00:00:00 GPS") // "2038-11-20T23:59:42Z"
 * @example gnssToUtc("BDT", "2024-01-01T00:00:04 BDT") // "2024-01-01T00:00:00Z"
 * @example gnssToUtc("GAL", "1999-08-22T00:00:00 GAL") // "1999-08-21T23:59:47Z"
 * @example gnssToUtc("GLO", "2016-12-31T23:59:60 GLO") // "2016-12-31T23:59:60Z"
 * @example gnssToUtc("GLO", "2017-12-31T23:59:60 GLO") // "" — no leap second that day
 * @example gnssToUtc("GPS", "2024-01-01T00:00:18 GAL") // "" — wrong token
 */

/**
 * Convert a week number and time of week, as a receiver reports them, to a UTC instant string.
 *
 * - Name the counter the week came from: GPS and QZSS LNAV wrap every 1024 weeks (about 19.6
 *   years), their CNAV every 8192, Galileo every 4096, BeiDou every 8192, NavIC LNAV every 1024
 *   and L1NV every 8192.
 * - A week number alone cannot say which pass it is, so `rolloverEra` is required: an integer (era
 *   0 starts at the system's epoch); `"rolling"` for the pass within half a counter period of today;
 *   or `{ notBefore }` for the earliest pass at or after an instant you state, as a receiver that
 *   resolves weeks against its firmware build date does. Receivers that report a stale week need an
 *   integer or a pivot.
 * - `timeOfWeekSeconds` is seconds of week and may have a fraction; it is rounded to the nearest
 *   nanosecond. Convert a coarser broadcast count first (NavIC L5/S: TOWC × 12; NavIC L1: ITOW × 7200
 *   + TOI × 18, per the NavIC ICDs).
 * - A week time inside an inserted leap second returns `…T23:59:60Z`.
 * - GLONASS has no week counter, so it is not a counter here.
 * - A RINEX navigation-file week is a continuous count, not a broadcast week: read it with
 *   `rinexWeekToUtc`. A RINEX NavIC week given to `"IRN-L1NV"` would be 1024 weeks off.
 * - "" when `week`, `timeOfWeekSeconds` or `rolloverEra` is out of range, for a result past year
 *   9999, and on invalid input.
 *
 * @param counter the week counter: "GPS-LNAV", "GPS-CNAV", "GAL", "BDT", "QZS-LNAV", "QZS-CNAV", "IRN-LNAV" or "IRN-L1NV"
 * @param week week number as the counter shows it, 0 to the counter's modulus − 1
 * @param timeOfWeekSeconds seconds since the start of the week, 0 up to but not including 604 800
 * @param rolloverEra the counter's pass: an integer from 0, or "rolling"
 * @returns ISO 8601 UTC instant string (`Z`), or "" on invalid input
 *
 * @example gnssWeekToUtc("GPS-LNAV", 100, 0, 0) // "1981-12-05T23:59:59Z"
 * @example gnssWeekToUtc("GPS-LNAV", 100, 0, 1) // "2001-07-21T23:59:47Z"
 * @example gnssWeekToUtc("GPS-LNAV", 0, 0, 3) // "2038-11-20T23:59:42Z" — the third LNAV rollover
 * @example gnssWeekToUtc("GPS-CNAV", 2295, 86418, 0) // "2024-01-01T00:00:00Z"
 * @example gnssWeekToUtc("BDT", 939, 86404, 0) // "2024-01-01T00:00:00Z"
 * @example gnssWeekToUtc("GPS-LNAV", 906, 17, 1) // "2016-12-31T23:59:60Z"
 * @example gnssWeekToUtc("GPS-LNAV", 0, 0, 2) // "2019-04-06T23:59:42Z" — the second LNAV rollover
 * @example gnssWeekToUtc("GPS-LNAV", 1020, 0, { notBefore: "2019-01-01T00:00:00Z" }) // "2019-03-09T23:59:42Z"
 * @example gnssWeekToUtc("GPS-LNAV", 1020, 0, { notBefore: "2019-04-07T00:00:00Z" }) // "2038-10-23T23:59:42Z" — after the 2019 rollover
 * @example gnssWeekToUtc("GPS-LNAV", 0, 0, { notBefore: "2019-04-06T23:59:42Z" }) // "2019-04-06T23:59:42Z" — equal counts
 * @example gnssWeekToUtc("GAL", 100, 0, { notBefore: "1999-01-01T00:00:00Z" }) // "" — before Galileo's epoch
 * @example gnssWeekToUtc("GPS-LNAV", 1024, 0, 2) // "" — an LNAV week stops at 1023
 */

/**
 * Return the week, time of week and era of a UTC instant on a satellite week counter.
 *
 * - The inverse of `gnssWeekToUtc`: `week` is what the counter shows, `era` how often it has
 *   wrapped.
 * - Time of week is a `number` of seconds; a fraction is the nearest double to the exact value.
 * - `null` before the system's epoch and on invalid input.
 *
 * @param counter the week counter: "GPS-LNAV", "GPS-CNAV", "GAL", "BDT", "QZS-LNAV", "QZS-CNAV", "IRN-LNAV" or "IRN-L1NV"
 * @param utcString ISO 8601 instant string; a listed leap second is accepted
 * @returns `{ week, timeOfWeekSeconds, era }`, or null on invalid input or before the system's epoch
 *
 * @example utcToGnssWeek("GPS-LNAV", "2019-04-07T00:00:00Z") // { week: 0, timeOfWeekSeconds: 18, era: 2 }
 * @example utcToGnssWeek("GPS-CNAV", "2019-04-07T00:00:00Z") // { week: 2048, timeOfWeekSeconds: 18, era: 0 }
 * @example utcToGnssWeek("GAL", "2019-04-07T00:00:00Z") // { week: 1024, timeOfWeekSeconds: 18, era: 0 }
 * @example utcToGnssWeek("BDT", "2024-01-01T00:00:00Z") // { week: 939, timeOfWeekSeconds: 86404, era: 0 }
 * @example utcToGnssWeek("GPS-LNAV", "2016-12-31T23:59:60Z") // { week: 906, timeOfWeekSeconds: 17, era: 1 }
 * @example utcToGnssWeek("GAL", "1999-08-21T23:59:46Z") // null — before Galileo's epoch
 */

/**
 * Convert a week number from a RINEX navigation file, and the seconds of that week, to a UTC
 * instant string.
 *
 * - A RINEX navigation record's week is a continuous count that never wraps. For GPS, QZSS, NavIC
 *   and Galileo records it counts from the GPS epoch, 1980-01-06 (RINEX 4.02 Table A30: "Continuous
 *   number, not mod (1024), counted from 1980 (same as GPS)"; Tables A9, A13, A19). A BeiDou record counts BDT weeks from
 *   2006-01-01 (RINEX 4.02 §5.4.6, Table A23).
 * - CNAV/CNAV-2, BDS CNAV-1/2/3 and NavIC L1NV records have no week column: take the week from the
 *   record's epoch line.
 * - It is not the week a satellite broadcasts: a NavIC broadcast week counts from 1999 and wraps.
 *   Use `gnssWeekToUtc` for those.
 * - A full GPS week number from any other source is the same count, so `"GPS"` reads it too.
 * - GLONASS records carry no week number.
 * - "" for a negative or non-integer week, a time of week outside 0 up to 604 800, a result past year
 *   9999, and on invalid input.
 *
 * @param system the RINEX record's system: "GPS", "GAL", "BDT", "QZS" or "IRN"
 * @param week the record's week number
 * @param timeOfWeekSeconds seconds since the start of the week, 0 up to but not including 604 800
 * @returns ISO 8601 UTC instant string (`Z`), or "" on invalid input
 *
 * @example rinexWeekToUtc("IRN", 2295, 86418) // "2024-01-01T00:00:00Z"
 * @example rinexWeekToUtc("GPS", 1930, 17) // "2016-12-31T23:59:60Z"
 * @example rinexWeekToUtc("GPS", 3072, 0) // "2038-11-20T23:59:42Z"
 * @example rinexWeekToUtc("BDT", 809, 165600) // "2021-07-05T21:59:56Z" — RINEX Table A27's C05 record
 * @example rinexWeekToUtc("GPS", -1, 0) // ""
 */

/**
 * Return the RINEX navigation-file week and seconds of week of a UTC instant.
 *
 * - The inverse of `rinexWeekToUtc`; the week is continuous, so there is no era.
 * - `null` before the record's epoch and on invalid input.
 *
 * @param system the RINEX record's system: "GPS", "GAL", "BDT", "QZS" or "IRN"
 * @param utcString ISO 8601 instant string; a listed leap second is accepted
 * @returns `{ week, timeOfWeekSeconds }`, or null on invalid input
 *
 * @example utcToRinexWeek("IRN", "2024-01-01T00:00:00Z") // { week: 2295, timeOfWeekSeconds: 86418 }
 * @example utcToRinexWeek("GPS", "1980-01-05T23:59:59Z") // null
 */
```

`"rolling"` gets no `@example`: its result depends on the day the check runs.

### 4.4 `hasSecond60`

Keep the current JSDoc with the name changed throughout, and end its first bullet with: "It does not
check that one was inserted on that day; for that, use `isLeapSecond` from `timescale/`." Keep every
`@example`, renamed.

---

## 5. Namespace wiring, file by file

Following `precision/` (a Core namespace, not an industry layer) and `duty/` (the namespace barrel
re-exports the polyfill first).

### 5.1 Library source

1. `timescale/calculate/index.ts`: `leapSecondsBetween`, `nextLeapSecond`, `taiMinusUtc`.
   `timescale/convert/index.ts`: `fromTAI`, `toTAI`. `timescale/validate/index.ts`: `isLeapSecond`.
2. `timescale/index.ts`: polyfill re-export first (with `duty/index.ts`'s comment), then
   `./calculate`, `./convert`, `./validate`.
3. `gnss/convert/index.ts`: the six `gnss` functions of §1.1, alphabetical. `gnss/index.ts`:
   polyfill, then `./convert`.
4. `plain/validate/index.ts`: `./isLeapSecond` → `./hasSecond60`. Update the imports in
   `isValidTime.ts`, `isValidIsoDateLike.ts`, `isValidDate.ts`, `isValidDateTime.ts`,
   `internal/calendarZonedString.ts` (code and JSDoc line 34), `zoned/validate/isValidZonedRange.ts`,
   `zoned/validate/isValidZonedDateTime.ts`, `zoned/parse/parseDateTimeFromZoned.ts`,
   `utc/validate/isValidUtc.ts`, and the JSDoc "Used by `isLeapSecond`" in `regex/leap-second.ts`.
5. `types/index.ts`: `./gnss`.
6. `internal/index.ts`: the helpers of §1.3.
7. `src/index.ts`: `export * from "./gnss";` after `./duty`; `export * from "./timescale";` after
   `./span` (alphabetical).

No `space/` and no `maritime/` directory is created (D13).

### 5.2 `packages/gmt/package.json`

`exports`, explicit entries in alphabetical position, no wildcards:

```json
"./gnss": { "types": "./dist/gnss/index.d.ts", "default": "./dist/gnss/index.js" },
"./gnss/convert": { "types": "./dist/gnss/convert/index.d.ts", "default": "./dist/gnss/convert/index.js" },
"./timescale": { "types": "./dist/timescale/index.d.ts", "default": "./dist/timescale/index.js" },
"./timescale/calculate": { "types": "./dist/timescale/calculate/index.d.ts", "default": "./dist/timescale/calculate/index.js" },
"./timescale/convert": { "types": "./dist/timescale/convert/index.d.ts", "default": "./dist/timescale/convert/index.js" },
"./timescale/validate": { "types": "./dist/timescale/validate/index.d.ts", "default": "./dist/timescale/validate/index.js" },
```

`typesVersions["*"]`: the matching six keys, each `["./dist/<path>/index.d.ts"]`.

### 5.3 READMEs

- `src/gnss/README.md`, `src/timescale/README.md`: one-line stubs (`# GNSS API`, `# Timescale API`
  plus the reference link), as `precision/README.md`.
- `README.md` and `packages/gmt/README.md` (identical): `[gnss]` and `[timescale]` in the list of
  namespaces — **not** on the "By industry:" line (`stats.mjs check` enforces both); then
  `pnpm stats:sync`. The `/update-readme` skill owns the rest.

### 5.4 `apps/dox/src/lib/gmt-modules.ts`

```ts
// --- timescale ---
"timescale/calculate": () => import("@northguild/gmt/timescale/calculate"),
"timescale/convert": () => import("@northguild/gmt/timescale/convert"),
"timescale/validate": () => import("@northguild/gmt/timescale/validate"),

// --- gnss ---
"gnss/convert": () => import("@northguild/gmt/gnss/convert"),
```

### 5.5 Docs-site placement: building blocks, and a Maritime industry layer

`timescale` and `gnss` are building blocks, so their reference pages sit among the general
namespaces. The **Maritime** industry layer carries the guide, the scenarios and the decoder tool,
showing how ships use GNSS time on the international footing: the six systems recognised under IMO
Resolution A.1046(27), shipborne receivers to the IEC 61108 series, and their output carried over
IEC 61162-1 interfaces (the IEC parts and the recognition texts other than BeiDou's are not reached —
the guide marks them, it does not assert them).

**Why the tooling must change.** Today an industry layer is a namespace:

- `scripts/stats.mjs` `industryLayers()` takes the prefix of each
  `guides/industries/<prefix>-….mdx` file and throws "an industry guide is named for its namespace,
  and \`maritime\` exports no function" when no such namespace exports a function;
- `apps/dox/src/lib/industry-tags.ts` builds its tag ids from `gmtStats.industries` (that list);
- `industry-overview.ts`, the API Reference's "By industry" sidebar group and the README's "By
  industry:" line all key on the same ids, and the overview page is the namespace's
  `/reference/<namespace>/` index.

So a Maritime layer cannot exist without a `maritime/` namespace, and the owner has ruled out an
empty one. **Owner decision: industry layers are separated from namespaces.** Each industry is declared in
`industry-tags.ts` with the namespaces it draws on (`maritime: { namespaces: ["gnss", "timescale"] }`)
and has its own overview page. **dox-architect owns this tooling change** (`stats.mjs`,
`industry-tags.ts`, `industry-overview.ts`, the "By industry" sidebar and the README's industry line)
and the decoder tool; see the dox-architect spec. This spec supplies only the content:

- the Maritime guide, scenarios and mistakes page (§8.4) belong to the Maritime layer;
- `apps/dox/src/lib/chat-constants.ts` gains the decoder tool's `EXAMPLE_AREAS` entry and
  `CHAT_STARTERS` pill with the tool (§5.10).

The timescale guide is a Core guide either way:
`apps/dox/src/content/docs/guides/core-date-operations/leap-seconds-and-tai.mdx`, beside
`nanosecond-precision.mdx`, tagged `industries: [core]`.

### 5.6 TanStack Intent skills (`/tanstack-intent`)

- `skills/gmt-integration/SKILL.md`: a section on `timescale` (TAI, leap seconds, the closed
  built-in table) and `gnss` (system times, named week counters, `"rolling"`, RINEX weeks);
  `sources:` gains the guides and barrels.
- `skills/gmt-basics/SKILL.md` line 150: "`isLeapSecond` tells you one is there" → "`hasSecond60`
  tells you one is there; `isLeapSecond` (from `timescale`) tells you it was a real leap second."
- `_artifacts/domain_map.yaml` `covers:` and `_artifacts/skill_tree.yaml`: the new names.

### 5.7 Changeset

`.changeset/gnss-time-scales-and-leap-seconds.md`, `"@northguild/gmt": minor`, written with
`/changelog` and `/plain-english`. It names both namespaces and has a **Breaking changes** section:

| Before | After |
| --- | --- |
| `isLeapSecond(value)` from `@northguild/gmt/plain`: true for any seconds field of 60 | `hasSecond60(value)` from `@northguild/gmt/plain` |
| — | `isLeapSecond(value)` from `@northguild/gmt/timescale`: true only for the 27 inserted leap seconds; `isLeapSecond("2024-06-15T12:34:60Z")` is now `false` |

### 5.8 Leap-second canary

- `scripts/leap-seconds.mjs check`: fetch `Leap_Second.dat`, parse its rows, and compare them with
  `LEAP_SECOND_STEPS` (re-parsed from the source literal). Exit 1 with the IERS header line when any
  row differs or a row is added.
- `.github/workflows/leap-seconds.yml`: weekly `schedule` and `workflow_dispatch`, running only that
  script. **Not** in `pnpm run validate`: no network there.
- Its job until 20 May 2027 is to catch a Bulletin C 73 announcing an insertion the closed-table
  reading did not expect (TF.460-6 still allows a March month end). A new row is a data edit plus a
  `patch` changeset; the invariant tests (§6.1) check the edit.
- After that date it catches any other change IERS makes to the file's rows. It is retired, script
  and workflow together, once IERS publishes its file format for continuous UTC (owner decision,
  §9.1). The workflow's header comment says so.

### 5.9 Example checkers and the playground

No change. Every `@example` calls only root exports with literal arguments, so
`scripts/api-surface.mjs`, `test/noThrow.ts` and the Dox playground need nothing new.

### 5.10 Dox decoder tool and industry tooling — see the dox-architect spec

In scope for MAR-16 (owner decision): a GNSS week and era decoder, with its `CHAT_STARTERS` pill,
`EXAMPLE_AREAS` entry and chat-widget registration. **Designed by dox-architect**, not here. This
spec's only constraints:

- it calls the public functions of §1.1 through `GMT_MODULES["gnss/convert"]` (and
  `"timescale/…"` if it shows TAI);
- it offers the RINEX week alongside the broadcast counters, so the D12 trap is visible;
- every preset shows the functions' real output, asserted in its mount test;
- its page belongs to the Maritime industry layer (§5.5, owner decision).

---

## 6. Edge-case test matrix

**Conventions.** `it.each` template tables, one category per table. Internal tests of
`leapSeconds.ts` use a synthetic `negativeStepSteps`: `LEAP_SECOND_STEPS` plus a row at
2030-01-01T00:00:00Z with 36 s (a deleted second; built in the test with
`Temporal.Instant.from(…).epochNanoseconds`). Every value below came from the reference run.

### 6.1 `LEAP_SECOND_STEPS` invariants (`leapSeconds.test.ts`)

- 28 rows; `at[0]` = `Temporal.Instant.from("1972-01-01T00:00:00Z").epochNanoseconds`, offset 10;
  last row 2017-01-01, offset 37 (SPA-48: "The table's final entry matches TAI − UTC = 37").
- Each bigint equals the epoch ns of the date in its comment.
- Each `at` is 00:00:00 UTC on a month's first day (TF.460-6 §2.1–2.2).
- `at` strictly increasing; every step exactly +1 s (the closed table has no deleted second).
- 27 rows after the first = 27 leap seconds.

Internal queries on `negativeStepSteps`: `taiOfUtc` of `2029-12-31T23:59:58Z` → TAI
`2030-01-01T00:00:35`; of `2029-12-31T23:59:59Z` and `…59.5Z` → `null`; of `2030-01-01T00:00:00Z` →
`2030-01-01T00:00:36`; `utcOfTai` of TAI `2030-01-01T00:00:35.5` → `2029-12-31T23:59:58.5Z`, of
`…00:00:36` → `2030-01-01T00:00:00Z`; a second-60 on 2029-12-31 → `null`; `nextStepIndex` from
2024-01-01 → that row (written `2029-12-31T23:59:59Z` by `nextLeapSecond`'s formatting rule).

### 6.2 `taiMinusUtc`

| isoString | Expected |
| --- | --- |
| `"2024-01-01T00:00:00Z"` | `37` |
| `"2016-01-01T00:00:00Z"` | `36` |
| `"2016-12-31T23:59:60Z"` | `36` |
| `"2017-01-01T00:00:00Z"` | `37` |
| `"2013-06-01T00:00:00Z"` | `35` |
| `"1972-01-01T00:00:00Z"` | `10` |
| `"1980-01-06T00:00:00Z"` | `19` |
| `"1999-08-22T00:00:00Z"` | `32` |
| `"2006-01-01T00:00:00Z"` | `33` |
| `"2027-06-28T00:00:00Z"` | `37` |
| `"2100-01-01T00:00:00Z"` | `37` (closed table) |
| `"1971-12-31T23:59:59.999999999Z"`, `"1971-01-01T00:00:00Z"` | `null` |
| `"2017-12-31T23:59:60Z"` | `null` |

Plus §6.11. **Battle matrix:** for each `c` of `sameInstantBattleCases`, `taiMinusUtc(c.value) === 37`.

### 6.3 `leapSecondsBetween`

| start | end | Expected |
| --- | --- | --- |
| `"2020-01-01T00:00:00Z"` | `"2024-01-01T00:00:00Z"` | `0` |
| `"2000-01-01T00:00:00Z"` | `"2024-01-01T00:00:00Z"` | `5` (2005, 2008, 2012, 2015, 2016) |
| `"1972-01-01T00:00:00Z"` | `"2024-01-01T00:00:00Z"` | `27` |
| `"1980-01-06T00:00:00Z"` | `"2024-01-01T00:00:00Z"` | `18` |
| `"2024-01-01T00:00:00Z"` | `"2000-01-01T00:00:00Z"` | `-5` |
| `"2016-12-31T23:59:60Z"` | `"2017-01-01T00:00:00Z"` | `1` |
| `"2016-12-31T23:59:59Z"` | `"2016-12-31T23:59:60Z"` | `0` |
| `"1971-01-01T00:00:00Z"` | `"2024-01-01T00:00:00Z"` | `null` |

### 6.4 `nextLeapSecond`

| isoString | Expected |
| --- | --- |
| `"2016-01-01T00:00:00Z"` | `"2016-12-31T23:59:60Z"` |
| `"2016-12-31T23:59:59.5Z"` | `"2016-12-31T23:59:60Z"` |
| `"2016-12-31T23:59:60Z"` | `""` |
| `"2015-06-30T23:59:60Z"` | `"2016-12-31T23:59:60Z"` |
| `"1972-01-01T00:00:00Z"` | `"1972-06-30T23:59:60Z"` |
| `"1999-08-22T00:00:00Z"` | `"2005-12-31T23:59:60Z"` |
| `"2024-01-01T00:00:00Z"` | `""` (SPA-48: none scheduled) |
| `"2027-05-20T00:00:00Z"` | `""` |
| `"1971-06-01T00:00:00Z"` | `""` |

**Property:** for each of the 27 insertion days derived from `LEAP_SECOND_STEPS`,
`nextLeapSecond(<day>T00:00:00Z)` is `<day>T23:59:60Z` and `isLeapSecond` of it is `true`.

### 6.5 `isLeapSecond`, `hasSecond60`

| isoString | `isLeapSecond` |
| --- | --- |
| `"2016-12-31T23:59:60Z"`, `"1972-06-30T23:59:60Z"`, `"2008-12-31T23:59:60.999999999Z"` | `true` |
| `"2009-01-01T08:59:60+09:00"`, `"2016-12-31T18:59:60-05:00[America/New_York]"` | `true` |
| `"2017-12-31T23:59:60Z"` (SPA-48), `"2016-06-30T23:59:60Z"`, `"2016-12-31T12:34:60Z"`, `"1971-12-31T23:59:60Z"` | `false` |
| `"2016-12-31T23:59:59Z"` (SPA-48) | `false` |
| `"20161231T235960Z"`, `"2016-12-31t23:59:60Z"`, `"2016-12-31 23:59:60Z"`, `"2016-12-31T23:59:60"`, `"2016-12-31T23:59:61Z"` | `false` |

**All listed:** for each of the 27 days, `<day>T23:59:60Z` → `true`, `<day>T23:59:59Z` → `false`.
`hasSecond60`: the existing rows, renamed, unchanged.

### 6.6 `toTAI` / `fromTAI`

| Call | Expected |
| --- | --- |
| `toTAI("2026-01-01T00:00:00Z")` | `"2026-01-01T00:00:37 TAI"` (SPA-46) |
| `toTAI("2013-06-01T00:00:00Z")` | `"2013-06-01T00:00:35 TAI"` (SPA-46: 35, not 37) |
| `toTAI("1972-01-01T00:00:00Z")` | `"1972-01-01T00:00:10 TAI"` |
| `toTAI("2016-12-31T23:59:59Z")` | `"2017-01-01T00:00:35 TAI"` |
| `toTAI("2016-12-31T23:59:60Z")` | `"2017-01-01T00:00:36 TAI"` |
| `toTAI("2016-12-31T23:59:60.5Z")` | `"2017-01-01T00:00:36.5 TAI"` |
| `toTAI("2016-12-31T23:59:60.123456789Z")` | `"2017-01-01T00:00:36.123456789 TAI"` |
| `toTAI("2016-12-31T23:59:60.999999999Z")` | `"2017-01-01T00:00:36.999999999 TAI"` |
| `toTAI("2017-01-01T08:59:60+09:00")` | `"2017-01-01T00:00:36 TAI"` |
| `toTAI("2016-12-31T18:59:60-05:00[America/New_York]")` | `"2017-01-01T00:00:36 TAI"` |
| `toTAI("2017-01-01T00:00:00Z")` | `"2017-01-01T00:00:37 TAI"` |
| `toTAI("2015-06-30T23:59:60Z")` | `"2015-07-01T00:00:35 TAI"` |
| `toTAI("1972-06-30T23:59:60Z")` | `"1972-07-01T00:00:10 TAI"` |
| `toTAI("2100-01-01T00:00:00Z")` | `"2100-01-01T00:00:37 TAI"` |
| `toTAI("9999-12-31T23:59:22.999999999Z")` | `"9999-12-31T23:59:59.999999999 TAI"` |
| `toTAI("9999-12-31T23:59:23Z")` | `""` (year 10000) |
| `toTAI("2017-12-31T23:59:60Z")`, `toTAI("2016-12-31T12:34:60Z")`, `toTAI("1971-12-31T23:59:60Z")` | `""` |
| `fromTAI("2026-01-01T00:00:37 TAI")` | `"2026-01-01T00:00:00Z"` |
| `fromTAI("2017-01-01T00:00:35 TAI")` | `"2016-12-31T23:59:59Z"` |
| `fromTAI("2017-01-01T00:00:36 TAI")` | `"2016-12-31T23:59:60Z"` |
| `fromTAI("2017-01-01T00:00:36.5 TAI")` | `"2016-12-31T23:59:60.5Z"` |
| `fromTAI("2017-01-01T00:00:36.123456789 TAI")` | `"2016-12-31T23:59:60.123456789Z"` |
| `fromTAI("2017-01-01T00:00:37 TAI")` | `"2017-01-01T00:00:00Z"` |
| `fromTAI("1972-01-01T00:00:10 TAI")` | `"1972-01-01T00:00:00Z"` |
| `fromTAI("1972-01-01T00:00:09.999999999 TAI")` | `""` (SPA-46: pre-1972) |
| `fromTAI("2027-06-28T00:00:37 TAI")` | `"2027-06-28T00:00:00Z"` |
| `fromTAI("9999-12-31T23:59:59.999999999 TAI")` | `"9999-12-31T23:59:22.999999999Z"` |
| `fromTAI("2016-12-31T23:59:60 TAI")` | `""` |

**Battle matrix:** for each `c`, `toTAI(c.value) === "2024-02-29T00:00:37 TAI"`.

### 6.7 Scale-string grammar

Run against `fromTAI`, `gnssToUtc("GPS", …)` and `gnssToUtc("GAL", …)`, each with its own token. All `""`:
`"2026-01-01t00:00:37 TAI"`; `"2026-01-01 00:00:37 TAI"`; `"2026-01-01T00:00 TAI"`;
`"2026-01-01T00:00:37,5 TAI"`; `"2026-01-01T00:00:37.1234567890 TAI"`; `"2026-01-01T00:00:37. TAI"`;
`"2026-01-01T00:00:37  TAI"`; `"2026-01-01T00:00:37TAI"`; `" 2026-01-01T00:00:37 TAI"`;
`"2026-01-01T00:00:37 TAI "`; `"2026-01-01T00:00:37 tai"`; `"2026-01-01T00:00:37Z TAI"`;
`"2026-01-01T00:00:37+00:00 TAI"`; `"+002026-01-01T00:00:37 TAI"`; `"2026-02-30T00:00:37 TAI"`;
`"2026-01-01T24:00:00 TAI"`; `"2026-01-01T00:60:00 TAI"`; `"2026-01-01T00:00:61 TAI"`;
`"2026-01-01T00:00:37 UTC"`; `"2026-01-01T00:00:37 GST"`; `"2026-01-01T00:00:37 QZSST"`;
`"2026-01-01T00:00:37 GLONASST"`; `123`; `null`.

Accepted: `fromTAI("2026-01-01T00:00:37.5 TAI")` → `"2026-01-01T00:00:00.5Z"`;
`"…00:00:37.000000001 TAI"` → `"2026-01-01T00:00:00.000000001Z"`; `"…00:00:37.100 TAI"` →
`"2026-01-01T00:00:00.1Z"`.

### 6.8 GNSS strings

| Call | Expected |
| --- | --- |
| `utcToGnss("GPS", "1980-01-06T00:00:00Z")` | `"1980-01-06T00:00:00 GPS"` (MAR-16: zero offset) |
| `utcToGnss("GPS", "1980-01-05T23:59:59Z")` | `""` |
| `utcToGnss("GPS", "2016-06-01T00:00:00Z")` | `"2016-06-01T00:00:17 GPS"` (MAR-16: 17 before the 2016 leap second) |
| `utcToGnss("GPS", "2024-01-01T00:00:00Z")` | `"2024-01-01T00:00:18 GPS"` (MAR-16: 18 ahead) |
| `utcToGnss("GPS", "2027-06-28T00:00:00Z")` | `"2027-06-28T00:00:18 GPS"` |
| `utcToGnss("GPS", "2016-12-31T23:59:60Z")` | `"2017-01-01T00:00:17 GPS"` |
| `utcToGnss("GPS", "2016-12-31T23:59:60.25Z")` | `"2017-01-01T00:00:17.25 GPS"` |
| `utcToGnss("GPS", "1999-08-21T23:59:47Z")` | `"1999-08-22T00:00:00 GPS"` |
| `gnssToUtc("GPS", "2024-01-01T00:00:18 GPS")` | `"2024-01-01T00:00:00Z"` |
| `gnssToUtc("GPS", "2017-01-01T00:00:17 GPS")` | `"2016-12-31T23:59:60Z"` |
| `gnssToUtc("GPS", "2017-01-01T00:00:17.25 GPS")` | `"2016-12-31T23:59:60.25Z"` |
| `gnssToUtc("GPS", "1980-01-06T00:00:00 GPS")` | `"1980-01-06T00:00:00Z"` |
| `gnssToUtc("GPS", "1980-01-05T23:59:59.999999999 GPS")` | `""` |
| `gnssToUtc("GPS", "2027-06-28T00:00:18 GPS")` | `"2027-06-28T00:00:00Z"` |
| `gnssToUtc("GPS", "2038-11-21T00:00:00 GPS")` | `"2038-11-20T23:59:42Z"` |
| `gnssToUtc("GPS", "2024-01-01T00:00:18 TAI")` | `""` |
| `utcToGnss("GAL", "1999-08-22T00:00:00Z")` | `"1999-08-22T00:00:13 GAL"` (MAR-16: the ICD's 13 s) |
| `utcToGnss("GAL", "1999-08-21T23:59:47Z")` | `"1999-08-22T00:00:00 GAL"` |
| `utcToGnss("GAL", "1999-08-21T23:59:46Z")` | `""` |
| `gnssToUtc("GAL", "1999-08-22T00:00:00 GAL")` | `"1999-08-21T23:59:47Z"` |
| `utcToGnss("GAL", "2024-01-01T00:00:00Z")` | `"2024-01-01T00:00:18 GAL"` |
| `utcToGnss("BDT", "2006-01-01T00:00:00Z")` | `"2006-01-01T00:00:00 BDT"` (MAR-16: equals UTC) |
| `utcToGnss("BDT", "2005-12-31T23:59:59Z")`, `utcToGnss("BDT", "2005-12-31T23:59:60Z")` | `""` |
| `utcToGnss("BDT", "2024-01-01T00:00:00Z")` | `"2024-01-01T00:00:04 BDT"` (MAR-16: 4 s) |
| `gnssToUtc("BDT", "2024-01-01T00:00:04 BDT")` | `"2024-01-01T00:00:00Z"` |
| `utcToGnss("QZS", "1980-01-06T00:00:00Z")` | `"1980-01-06T00:00:00 QZS"` |
| `utcToGnss("QZS", "2024-01-01T00:00:00Z")` | `"2024-01-01T00:00:18 QZS"` |
| `utcToGnss("GLO", "2024-01-01T00:00:00Z")` | `"2024-01-01T00:00:00 GLO"` (MAR-16, rewritten: UTC's own wall clock) |
| `utcToGnss("GLO", "2016-12-31T23:59:60Z")` | `"2016-12-31T23:59:60 GLO"` |
| `utcToGnss("GLO", "2016-12-31T23:59:60.25Z")` | `"2016-12-31T23:59:60.25 GLO"` |
| `utcToGnss("GLO", "2017-12-31T23:59:60Z")` | `""` |
| `utcToGnss("GLO", "1972-01-01T00:00:00Z")` | `"1972-01-01T00:00:00 GLO"` |
| `utcToGnss("GLO", "1971-12-31T23:59:59Z")` | `""` |
| `gnssToUtc("GLO", "2016-12-31T23:59:60 GLO")` | `"2016-12-31T23:59:60Z"` |
| `gnssToUtc("GLO", "2016-12-31T23:59:60.25 GLO")` | `"2016-12-31T23:59:60.25Z"` |
| `gnssToUtc("GLO", "2017-12-31T23:59:60 GLO")` | `""` |
| `gnssToUtc("GLO", "2024-01-01T00:00:00 GLO")` | `"2024-01-01T00:00:00Z"` |
| `gnssToUtc("GLO", "2024-01-01T03:00:00 GLONASST")` | `""` (not a RINEX token) |
| `utcToGnss("IRN", "1999-08-21T23:59:47Z")` | `"1999-08-22T00:00:00 IRN"` (NavIC epoch, ICD SPS 1.1 §5.7) |
| `utcToGnss("IRN", "1999-08-21T23:59:46Z")`, `utcToGnss("IRN", "1999-08-21T23:59:46.999999999Z")` | `""` |
| `utcToGnss("IRN", "2024-01-01T00:00:00Z")` | `"2024-01-01T00:00:18 IRN"` |
| `utcToGnss("IRN", "2016-12-31T23:59:60Z")` | `"2017-01-01T00:00:17 IRN"` |
| `gnssToUtc("IRN", "1999-08-22T00:00:00 IRN")` | `"1999-08-21T23:59:47Z"` |
| `gnssToUtc("IRN", "1999-08-21T23:59:59.999999999 IRN")` | `""` |
| `gnssToUtc("IRN", "2024-01-01T00:00:18 IRN")` | `"2024-01-01T00:00:00Z"` |
| `gnssToUtc("IRN", "2017-01-01T00:00:17 IRN")` | `"2016-12-31T23:59:60Z"` |
| `gnssToUtc("IRN", "2016-12-31T23:59:60 IRN")` | `""` (continuous scale) |
| `gnssToUtc("IRN", "2024-01-01T00:00:18 GPS")` | `""` (wrong token) |
| `utcToGnss("BDS" as never, "2024-01-01T00:00:00Z")` | `""` (not a RINEX time token) |

**Epoch sentinel per system** (MAR-16 verification) at `"1999-01-01T00:00:00Z"`: `"GPS"` →
`"1999-01-01T00:00:13 GPS"`, `"QZS"` → `"1999-01-01T00:00:13 QZS"`, `"GLO"` →
`"1999-01-01T00:00:00 GLO"`, `"GAL"` → `""`, `"BDT"` → `""`, `"IRN"` → `""` (verified).

**Properties (deterministic loops; values from the reference run):**

1. **Round trip:** for every insertion row, each TAI-based system and TAI, each `d` in `[-2 s, -1 s,
   -1 ns, 0, +1 ns, +1 s]` around `at`, plus `…T23:59:60.5Z`: when `utcToGnss(sys, iso)` is not `""`,
   `gnssToUtc(sys, it) === iso`. Reference run: 563 conversions, 0 failures. Add `GLO` and `IRN` to
   the loop.
2. **TAI − GPS = 19 s:** for each year 1980–2026 at `<year>-03-15T12:00:00Z`, the TAI and GPS labels
   differ by exactly 19 s. 0 exceptions.
3. **GAL agrees with GPS** (MAR-16): for each year 2000–2026 at `<year>-07-01T00:00:00Z`, the
   date-time parts of `utcToGnss("GAL", …)` and `utcToGnss("GPS", …)` are equal. 0 exceptions.
4. **GLO is UTC:** for the same sweep, `utcToGnss("GLO", iso)` is UTC's label followed by a space and `GLO`.

**Battle matrix:** for each `c`, `utcToGnss("GPS", c.value) === "2024-02-29T00:00:18 GPS"`.

### 6.9 Week functions

`gnssWeekToUtc`:

| Call | Expected |
| --- | --- |
| `("GPS-LNAV", 100, 0, 0)` | `"1981-12-05T23:59:59Z"` |
| `("GPS-LNAV", 100, 0, 1)` | `"2001-07-21T23:59:47Z"` |
| `("GPS-LNAV", 100, 0, 2)` | `"2021-03-06T23:59:42Z"` |
| `("GPS-LNAV", 100, 0, 3)` | `"2040-10-20T23:59:42Z"` |
| `("GAL", 100, 0, 0)` | `"2001-07-21T23:59:47Z"` |
| `("GAL", 100, 0, 1)` | `"2080-01-20T23:59:42Z"` |
| `("BDT", 100, 0, 0)` | `"2007-12-02T00:00:00Z"` |
| `("BDT", 100, 0, 1)` | `"2164-12-01T23:59:56Z"` |
| `("QZS-LNAV", 100, 0, 0)` | `"1981-12-05T23:59:59Z"` |
| `("GPS-CNAV", 100, 0, 0)` | `"1981-12-05T23:59:59Z"` |
| `("GPS-CNAV", 100, 0, 1)` | `"2138-12-06T23:59:42Z"` |
| `("GPS-LNAV", 0, 0, 0)` | `"1980-01-06T00:00:00Z"` |
| `("GPS-LNAV", 0, 0, 1)` | `"1999-08-21T23:59:47Z"` (first rollover, R§8) |
| `("GPS-LNAV", 0, 0, 2)` | `"2019-04-06T23:59:42Z"` (second, R§8) |
| `("GPS-LNAV", 0, 0, 3)` | `"2038-11-20T23:59:42Z"` (third, R§8) |
| `("GPS-CNAV", 0, 0, 1)` | `"2137-01-05T23:59:42Z"` (first CNAV wrap, R§8) |
| `("GAL", 0, 0, 1)` | `"2078-02-19T23:59:42Z"` (R§8) |
| `("BDT", 0, 0, 1)` | `"2163-01-01T23:59:56Z"` (R§8) |
| `("GAL", 0, 0, 0)` | `"1999-08-21T23:59:47Z"` |
| `("BDT", 0, 0, 0)` | `"2006-01-01T00:00:00Z"` |
| `("GPS-LNAV", 247, 86418, 2)`, `("QZS-LNAV", 247, 86418, 2)` | `"2024-01-01T00:00:00Z"` |
| `("GPS-CNAV", 2295, 86418, 0)`, `("QZS-CNAV", 2295, 86418, 0)` | `"2024-01-01T00:00:00Z"` |
| `("GAL", 1271, 86418, 0)` | `"2024-01-01T00:00:00Z"` |
| `("BDT", 939, 86404, 0)` | `"2024-01-01T00:00:00Z"` |
| `("GPS-LNAV", 906, 16, 1)` | `"2016-12-31T23:59:59Z"` |
| `("GPS-LNAV", 906, 17, 1)`, `("GPS-CNAV", 1930, 17, 0)` | `"2016-12-31T23:59:60Z"` |
| `("GPS-LNAV", 906, 17.5, 1)` | `"2016-12-31T23:59:60.5Z"` |
| `("GPS-LNAV", 906, 18, 1)` | `"2017-01-01T00:00:00Z"` |
| `("GPS-LNAV", 0, 0.1, 2)` | `"2019-04-06T23:59:42.1Z"` |
| `("GPS-LNAV", 392, 345618, 2)` | `"2026-10-15T00:00:00Z"` |
| `("GPS-LNAV", 1023, 604799, 2)` | `"2038-11-20T23:59:41Z"` |
| `("GPS-CNAV", 8191, 0, 0)` | `"2136-12-29T23:59:42Z"` |
| `("IRN-LNAV", 0, 0, 0)` | `"1999-08-21T23:59:47Z"` (NavIC epoch) |
| `("IRN-LNAV", 0, 0, 1)` | `"2019-04-06T23:59:42Z"` (first NavIC 10-bit wrap, R§5a.7) |
| `("IRN-LNAV", 0, 0, 2)` | `"2038-11-20T23:59:42Z"` (R§5a.7) |
| `("IRN-L1NV", 0, 0, 1)` | `"2156-08-21T23:59:42Z"` (first 13-bit wrap, R§5a.7) |
| `("IRN-LNAV", 247, 86418, 1)`, `("IRN-L1NV", 1271, 86418, 0)` | `"2024-01-01T00:00:00Z"` |
| `("IRN-L1NV", 2295, 86418, 0)` | `"2043-08-17T00:00:00Z"` — the D12 trap: a RINEX week fed to a broadcast counter. The test pins it beside the `rinexWeekToUtc` row that reads the same number correctly |
| `("IRN-LNAV", 2295, 86418, 1)` | `""` (out of range: the 10-bit counters reject a RINEX week) |
| week `1024` (LNAV), `4096` (GAL), `8192` (CNAV, BDT), `-1`, `1.5`, `NaN`, `"1"` | `""` |
| TOW `604800`, `-0.5`, `NaN`, `Infinity`, `"0"`, `604799.9999999999` (rounds to a full week) | `""` |
| TOW `604799.999999999`, GPS-LNAV week 0 era 1 | not `""` |
| era `-1`, `1.5`, `"1"`, `"current"`, `null` | `""` |
| counter `"GPS"`, `"BDS"`, `"QZS"`, `"IRN"`, `"LNAV"`, `"CNAV"` | `""` |
| `("GLO" as never, 100, 0, 0)` with `// @ts-expect-error` | `""` (MAR-16) |

**Era spacing (MAR-16 verification, restated exactly):** for week 100, eras 0 and 1 give labels
exactly 1024 weeks apart (`GPS-LNAV`), 4096 (`GAL`) and 8192 (`BDT`); assert via
`utcToGnss(system, result)`: GPS `"1981-12-06T00:00:00 GPS"` and `"2001-07-22T00:00:00 GPS"`; GAL
`"2001-07-22T00:00:00 GAL"` and `"2080-01-21T00:00:00 GAL"`; BDT `"2007-12-02T00:00:00 BDT"` and
`"2164-12-02T00:00:00 BDT"`. The UTC strings differ by that many weeks **less** the leap seconds
between them (12 s for GPS).

`utcToGnssWeek`:

| Call | Expected |
| --- | --- |
| `("GPS-LNAV", "2019-04-07T00:00:00Z")` | `{ week: 0, timeOfWeekSeconds: 18, era: 2 }` (MAR-16: era 2) |
| `("GPS-CNAV", "2019-04-07T00:00:00Z")` | `{ week: 2048, timeOfWeekSeconds: 18, era: 0 }` |
| `("GAL", "2019-04-07T00:00:00Z")` | `{ week: 1024, timeOfWeekSeconds: 18, era: 0 }` (MAR-16: era 0) |
| `("BDT", "2019-04-07T00:00:00Z")` | `{ week: 692, timeOfWeekSeconds: 4, era: 0 }` |
| `("QZS-LNAV", "2019-04-07T00:00:00Z")` | `{ week: 0, timeOfWeekSeconds: 18, era: 2 }` |
| `("GPS-LNAV", "2024-01-01T00:00:00Z")` | `{ week: 247, timeOfWeekSeconds: 86418, era: 2 }` |
| `("GPS-CNAV", "2024-01-01T00:00:00Z")`, `("QZS-CNAV", …)` | `{ week: 2295, timeOfWeekSeconds: 86418, era: 0 }` |
| `("GAL", "2024-01-01T00:00:00Z")` | `{ week: 1271, timeOfWeekSeconds: 86418, era: 0 }` |
| `("BDT", "2024-01-01T00:00:00Z")` | `{ week: 939, timeOfWeekSeconds: 86404, era: 0 }` |
| `("GPS-LNAV", "1980-01-06T00:00:00Z")` | `{ week: 0, timeOfWeekSeconds: 0, era: 0 }` |
| `("GPS-LNAV", "2016-12-31T23:59:60Z")` | `{ week: 906, timeOfWeekSeconds: 17, era: 1 }` |
| `("GPS-LNAV", "2024-01-01T00:00:00.5Z")` | `{ week: 247, timeOfWeekSeconds: 86418.5, era: 2 }` |
| `("GPS-LNAV", "2024-01-01T00:00:00.123456789Z")` | `{ week: 247, timeOfWeekSeconds: 86418.123456789, era: 2 }` |
| `("GPS-LNAV", "2019-04-06T23:59:41.999999999Z")` | `{ week: 1023, timeOfWeekSeconds: 604799.999999999, era: 1 }` |
| `("GPS-LNAV", "2019-04-06T23:59:42Z")` | `{ week: 0, timeOfWeekSeconds: 0, era: 2 }` |
| `("GPS-LNAV", "1999-08-21T23:59:47Z")` | `{ week: 0, timeOfWeekSeconds: 0, era: 1 }` |
| `("GAL", "1999-08-21T23:59:47Z")` | `{ week: 0, timeOfWeekSeconds: 0, era: 0 }` |
| `("BDT", "2006-01-01T00:00:00Z")` | `{ week: 0, timeOfWeekSeconds: 0, era: 0 }` |
| `("GPS-LNAV", "2027-06-28T00:00:00Z")` | `{ week: 429, timeOfWeekSeconds: 86418, era: 2 }` |
| `("GPS-LNAV", "2100-01-01T00:00:00Z")` | `{ week: 116, timeOfWeekSeconds: 432018, era: 6 }` |
| `("IRN-LNAV", "2024-01-01T00:00:00Z")` | `{ week: 247, timeOfWeekSeconds: 86418, era: 1 }` |
| `("IRN-L1NV", "2024-01-01T00:00:00Z")` | `{ week: 1271, timeOfWeekSeconds: 86418, era: 0 }` |
| `("IRN-LNAV", "2019-04-07T00:00:00Z")` | `{ week: 0, timeOfWeekSeconds: 18, era: 1 }` |
| `("IRN-LNAV", "1999-08-21T23:59:46Z")` | `null` |
| `("GPS-LNAV", "1980-01-05T23:59:59Z")`, `("GAL", "1999-08-21T23:59:46Z")`, `("BDT", "2005-12-31T23:59:59Z")` | `null` |
| `("GLO" as never, …)` | `null` |

**Round trip:** for every non-null row, `gnssWeekToUtc(counter, r.week, r.timeOfWeekSeconds, r.era)`
returns the input.

**`"rolling"`** — `vi.spyOn(Temporal.Now, "instant").mockReturnValue(Temporal.Instant.from("2026-10-15T00:00:00Z"))`
(the `yearWindowStart.test.ts` pattern). At that instant GPS is LNAV week 392, era 2 (full week
2440), TOW 345618:

| Call | Expected |
| --- | --- |
| `gnssWeekToUtc("GPS-LNAV", 100, 0, "rolling")` | `"2021-03-06T23:59:42Z"` (era 2) |
| `gnssWeekToUtc("GPS-LNAV", 1023, 0, "rolling")` | `"2019-03-30T23:59:42Z"` (era 1) |
| `gnssWeekToUtc("GPS-LNAV", 904, 0, "rolling")` | `"2036-08-02T23:59:42Z"` (era 2, full week 2952) |
| `gnssWeekToUtc("QZS-LNAV", 100, 0, "rolling")` | `"2021-03-06T23:59:42Z"` |
| `gnssWeekToUtc("GPS-CNAV", 100, 0, "rolling")` | `"1981-12-05T23:59:59Z"` (era 0) |
| `gnssWeekToUtc("GAL", 100, 0, "rolling")` | `"2001-07-21T23:59:47Z"` (era 0) |
| `gnssWeekToUtc("BDT", 100, 0, "rolling")` | `"2007-12-02T00:00:00Z"` (era 0) |
| `gnssWeekToUtc("IRN-LNAV", 100, 0, "rolling")` | `"2021-03-06T23:59:42Z"` (NavIC full week 1416 now; era 1) |
| `mockTemporalNowInstantThrow()` | `""` |

The spy also proves the clock is read once per call and never for a numeric era or a pivot.

**`{ notBefore }` pivot** (§3.9; values from the reference run):

| Call | Expected |
| --- | --- |
| `gnssWeekToUtc("GPS-LNAV", 1020, 0, { notBefore: "2019-01-01T00:00:00Z" })` | `"2019-03-09T23:59:42Z"` (era 1: pivot before the 2019 rollover) |
| `gnssWeekToUtc("GPS-LNAV", 1020, 0, { notBefore: "2019-04-07T00:00:00Z" })` | `"2038-10-23T23:59:42Z"` (era 2: pivot after it) |
| `gnssWeekToUtc("GPS-LNAV", 100, 0, { notBefore: "2010-01-01T00:00:00Z" })` | `"2021-03-06T23:59:42Z"` (era 2) |
| `gnssWeekToUtc("GPS-LNAV", 0, 0, { notBefore: "2019-04-06T23:59:42Z" })` | `"2019-04-06T23:59:42Z"` (exactly equal: counts) |
| `gnssWeekToUtc("GPS-LNAV", 0, 0, { notBefore: "2019-04-06T23:59:42.000000001Z" })` | `"2038-11-20T23:59:42Z"` (1 ns after: next era) |
| `gnssWeekToUtc("GPS-LNAV", 0, 0, { notBefore: "2019-04-06T23:59:41.999999999Z" })` | `"2019-04-06T23:59:42Z"` |
| `gnssWeekToUtc("GPS-CNAV", 100, 0, { notBefore: "2000-01-01T00:00:00Z" })` | `"2138-12-06T23:59:42Z"` (13-bit: era 1) |
| `gnssWeekToUtc("GPS-CNAV", 2295, 86418, { notBefore: "2020-01-01T00:00:00Z" })` | `"2024-01-01T00:00:00Z"` (era 0) |
| `gnssWeekToUtc("GPS-CNAV", 8191, 0, { notBefore: "2026-10-15T00:00:00Z" })` | `"2136-12-29T23:59:42Z"` |
| `gnssWeekToUtc("BDT", 939, 86404, { notBefore: "2020-01-01T00:00:00Z" })` | `"2024-01-01T00:00:00Z"` |
| `gnssWeekToUtc("GAL", 1271, 86418, { notBefore: "2020-01-01T00:00:00Z" })` | `"2024-01-01T00:00:00Z"` |
| `gnssWeekToUtc("IRN-LNAV", 247, 86418, { notBefore: "2020-01-01T00:00:00Z" })` | `"2024-01-01T00:00:00Z"` (era 1) |
| `gnssWeekToUtc("GPS-LNAV", 906, 17, { notBefore: "2016-01-01T00:00:00Z" })` | `"2016-12-31T23:59:60Z"` (an inserted second) |
| `gnssWeekToUtc("GPS-LNAV", 100, 0, { notBefore: "1980-01-06T00:00:00Z" })` | `"1981-12-05T23:59:59Z"` (pivot at the epoch: era 0) |
| `gnssWeekToUtc("GPS-LNAV", 0, 0, { notBefore: "1980-01-06T00:00:00Z" })` | `"1980-01-06T00:00:00Z"` |
| `gnssWeekToUtc("GAL", 100, 0, { notBefore: "1999-01-01T00:00:00Z" })` | `""` (pivot before Galileo's epoch) |
| `gnssWeekToUtc("GPS-LNAV", 100, 0, { notBefore: "1979-12-31T00:00:00Z" })` | `""` (pivot before the GPS epoch) |
| `gnssWeekToUtc("GPS-LNAV", 0, 0, { notBefore: "+275760-09-01T00:00:00Z" })` | `""` (result beyond Temporal's instant range) |
| `notBefore`: `"2019-04-07"` (date only), `"2019-04-07T00:00:00"` (no offset), `"2017-12-31T23:59:60Z"` (unlisted second 60), `123`, missing (`{}`), `null` | `""` |
| `{ notBefore: "2019-01-01T00:00:00Z", extra: 1 }` | same as without `extra` |
| a getter on `notBefore` | read once (spy count 1) |

**Property:** for each counter and each pivot row above that returns a value, the result `r`
satisfies `r ≥ notBefore` and `r − period < notBefore` (compared as labels with `utcToGnss`), and
`utcToGnssWeek(counter, r)` returns the same `week`.

### 6.9a RINEX weeks (`rinexWeekToUtc`, `utcToRinexWeek`)

| Call | Expected |
| --- | --- |
| `rinexWeekToUtc("GPS", 0, 0)` | `"1980-01-06T00:00:00Z"` |
| `rinexWeekToUtc("GPS", 2295, 86418)`, `("QZS", 2295, 86418)`, `("IRN", 2295, 86418)`, `("GAL", 2295, 86418)` | `"2024-01-01T00:00:00Z"` (RINEX Table A30, Table 3) |
| `rinexWeekToUtc("GPS", 1930, 17)` | `"2016-12-31T23:59:60Z"` |
| `rinexWeekToUtc("GPS", 3072, 0)` | `"2038-11-20T23:59:42Z"` |
| `rinexWeekToUtc("BDT", 809, 165600)` | `"2021-07-05T21:59:56Z"` (RINEX 4.02 Table A27: C05, 2021-07-05 22:00 BDT; `utcToGnss("BDT", it)` is `"2021-07-05T22:00:00 BDT"`) |
| `rinexWeekToUtc("BDT", 939, 86404)` | `"2024-01-01T00:00:00Z"` |
| `utcToRinexWeek("BDT", "2021-07-05T21:59:56Z")` | `{ week: 809, timeOfWeekSeconds: 165600 }` |
| `utcToRinexWeek("BDT", "2024-01-01T00:00:00Z")` | `{ week: 939, timeOfWeekSeconds: 86404 }` |
| `utcToRinexWeek("BDT", "2005-12-31T23:59:59Z")` | `null` |
| week `-1`, `1.5`, `NaN`; TOW `604800`, `-1` | `""` |
| `("GLO" as never, 2295, 0)` with `// @ts-expect-error` | `""` |
| `utcToRinexWeek("IRN", "2024-01-01T00:00:00Z")`, `("GPS", …)` | `{ week: 2295, timeOfWeekSeconds: 86418 }` |
| `utcToRinexWeek("GPS", "2016-12-31T23:59:60Z")` | `{ week: 1930, timeOfWeekSeconds: 17 }` |
| `utcToRinexWeek("GPS", "1980-01-05T23:59:59Z")` | `null` |

**The trap, pinned (D12):** the same number 2295 gives `"2024-01-01T00:00:00Z"` through
`rinexWeekToUtc("IRN", 2295, 86418)` and `"2043-08-17T00:00:00Z"` through
`gnssWeekToUtc("IRN-L1NV", 2295, 86418, 0)`. Both rows sit in one test named for the trap.

**Round trip:** for every non-null `utcToRinexWeek` row, `rinexWeekToUtc` returns the input.

### 6.10 Constants against their sources (`gnssTimeScales.test.ts`, `gnssWeek.test.ts`)

Each row names its clause from §0:

- each `epochLabel` equals `Temporal.PlainDateTime.from(<label>).toZonedDateTime("UTC").epochNanoseconds`;
- `taiMinusUtc("1980-01-06T00:00:00Z") === 19` = GPS `taiMinusScale` (BIPM vol. 15 p. 48;
  IS-GPS-200N §3.3.4);
- `taiMinusUtc("1999-08-22T00:00:00Z") - 13 === 19` = GAL `taiMinusScale` (BIPM `utc-gnss`;
  Galileo Issue 2.2 §5.1.2);
- `taiMinusUtc("2006-01-01T00:00:00Z") === 33` = BDT `taiMinusScale` (BIPM `utc-gnss`; B1I 3.0 §3.3);
- QZS `taiMinusScale === 19n` (IS-QZSS-PNT-006 §5.1);
- `GLO` `taiMinusScale === null` and its epoch label is the table's first row (RINEX 4.02 §4.1.2;
  BIPM vol. 15 p. 49; D10);
- `IRN` `taiMinusScale === 19n` and `taiMinusUtc("1999-08-21T23:59:47Z") - 13 === 19` (derived:
  ISRO-IRNSS-ICD-SPS-1.1 §5.7 + IERS; RINEX 4.02 Table 1) — the row name says "derived";
- each counter's modulus (IS-GPS-200N §20.3.3.3.1.1 / §30.3.3.1.1.1, Galileo Issue 2.2 Table 69,
  B1I 3.0 §5.2.4.4, IS-QZSS-PNT-006 §4.1.2.3(1) / §4.2.2, ISRO-IRNSS-ICD-SPS-1.1 §5.7,
  ISRO-NAVIC-ICD-SPS-L1-1.0 §5.6);
- `RINEX_WEEK_EPOCHS` (RINEX 4.02 Tables A9, A13, A19, A30; BDT §5.4.6, Table A23);
- `NANOSECONDS_PER_WEEK === 7n * NANOSECONDS_PER_DAY`.

### 6.11 Shared invalid-input rows

Instant argument: `null`, `undefined`, `123`, `""`, `"x"`, `"2024-01-01"`, `"2024-01-01T00:00:00"`,
`"2024-01-01T00:00:00[UTC]"`, `"20240101T000000Z"`. `system`: `"gps"`, `"BDS"`, `"GLONASS"`,
`"NAVIC"`, `""`, `null`. Collapse value lists into one row per category.

**Error paths:** `mockTemporalInstantFromThrow` (second-60 path), `mockTemporalPlainDateTimeFromThrow`
(scale-string parse), `mockTemporalInstantFromEpochNanosecondsThrow` (formatting): the sentinel for
one representative function per path.

### 6.12 Cross-cutting suites

- `test/noThrow.test.ts` covers the new functions through the corpus; assert `gnss` and `timescale`
  appear in `corpusNamespaces()`.
- No locale matrix: nothing here formats text for a locale.
- The battle-matrix rows are the zone coverage; no function takes a time-zone argument.

---

## 7. TDD slice order

Barrels are created in the slice that adds their first file. Each slice is red → green → refactor.

0. **Rename `isLeapSecond` → `hasSecond60`** in `plain/validate/` with every import of §5.1 item 4.
1. **Leap table.** `internal/leapSeconds.ts` (constant, `taiOfUtc`, `utcOfTai`, `nextStepIndex`);
   `internal/utcReading.ts`. Rows §6.1.
2. **Queries** (`timescale/calculate`, `timescale/validate`). `taiMinusUtc`, `leapSecondsBetween`,
   `nextLeapSecond`, `isLeapSecond`. Rows §6.2–6.5.
3. **`toTAI` / `fromTAI`** (`timescale/convert`). `internal/timeScaleString.ts`;
   `formatUtcReading`'s second-60 branch. Rows §6.6–6.7.
4. **GPS** (`gnss/convert`). `types/gnss.ts`; `internal/gnssTimeScales.ts` (GPS row); `utcToGnss`,
   `gnssToUtc` for `"GPS"`. Rows §6.8 GPS, §6.10 GPS.
5. **GAL / QZS / BDT / IRN.** Their constants, tokens and rows; properties 2–3 of §6.8; the derived
   NavIC offset row of §6.10.
6. **GLO.** Its row, branch and rows; properties 1 and 4 of §6.8 across all six systems.
7. **Week functions.** `internal/gnssWeek.ts`; `gnssWeekToUtc`, `utcToGnssWeek`; `"rolling"`. Rows §6.9.
7a. **Pivot era.** The `{ notBefore }` form of `RolloverEra` in `resolveRolloverEra` (§3.9), the type
    and its JSDoc. The pivot rows and property of §6.9.
8. **RINEX weeks.** `internal/rinexWeek.ts`; `rinexWeekToUtc`, `utcToRinexWeek`. Rows §6.9a. The
   `BDT` row pins RINEX Table A27's example.
9. **Wiring and docs.** §5.1–5.9, §8. Then `pnpm run validate`.
10. **Dox: the decoder tool and the industry-layer tooling change — see the dox-architect spec**
    (§5.5, §5.10), with the tool's `chat-constants.ts` area and pill. One build, last.

---

## 8. Doc slice

### 8.1 Issue files

Edit with the plain-english rules. The research corrections (R§11) are folded in.

**`issues/MAR-16.md`**

- Title and `**Scope:**`: "GNSS time scales — the RINEX world-standard set of six (GPS, Galileo,
  BeiDou, QZSS, GLONASS, NavIC) — and week rollover".
- `## Gap` table: one row per RINEX token, in RINEX's order, with corrected sources:
  - GPS: IS-GPS-200N §3.3.4, §20.3.3.3.1.1, §30.3.3.1.1.1; week "LNAV 10 bits, modulo 1024; CNAV 13
    bits, modulo 8192".
  - GLO: "GLONASS time as RINEX and BIPM report it: UTC hours, with UTC's leap seconds" (RINEX 4.02
    §4.1.2, §5.2.8; BIPM Annual Report vol. 15 p. 49); week "none". No ICD quotation.
  - GAL: Galileo OS SIS ICD Issue 2.2 §5.1.2, Table 69, its sentence as Issue 2.2 prints it.
  - QZS: IS-QZSS-PNT-006 §5.1, §4.1.2.3(1), §4.2.2; week "LNAV 10 bits, modulo 1024; CNAV 13 bits,
    modulo 8192".
  - BDT: BDS-SIS-ICD-B1I-3.0 §3.3 (epoch, "accumulates continuously without leap seconds"),
    §5.2.4.3–5.2.4.4.
  - IRN: epoch 00:00:00 IRNSST 1999-08-22 = 1999-08-21T23:59:47Z, "ahead of UTC by 13 leap
    seconds" (ISRO-IRNSS-ICD-SPS-1.1 §5.7; ISRO-NAVIC-ICD-SPS-L1-1.0 §5.6; RINEX 4.02 §4.1.6); TAI −
    IRNSST 19 s, **derived** (no ICD or BIPM statement); week "L5/S 10 bits, modulo 1024; L1 13 bits,
    modulo 8192"; no leap seconds (derived, R§5a.3). (R§11 correction 13.)
- The paragraph under the table: "TAI − GPS = 19 s, TAI − GST = **+19 s** and TAI − BDT = 33 s are
  stated by BIPM (Annual Report on Time Activities vol. 15, p. 48; `utc-gnss` file header), not by
  the ICDs, none of which mentions TAI except QZSS's. The ICD epochs and the leap-second table give
  the same values as a cross-check." (Fixes the sign error and the "by definition" claim.)
- Sources line: add BIPM Annual Report vol. 15, the `utc-gnss` file, RINEX 4.02, FITS 4.0, and the
  two NavIC ICDs; replace the Galileo, BeiDou and QZSS links with Issue 2.2, B1I 3.0 and PNT-006;
  drop the GLONASS ICD link.
- Framing (top of the file): "GMT supports the RINEX world-standard set of six satellite time
  scales: GPS, Galileo, BeiDou, QZSS, GLONASS and NavIC."
- `## Scope`: the six files under `packages/gmt/src/gnss/convert/` of §1.1 with their signatures (no
  table argument; system or counter first; `GnssSystem` as the six RINEX tokens; `GnssWeekCounter`
  with `IRN-LNAV` and `IRN-L1NV`; required `rolloverEra`; `rinexWeekToUtc` /
  `utcToRinexWeek` for RINEX navigation weeks). Add: "`toTAI` / `fromTAI`
  (`packages/gmt/src/timescale/convert/`) and the time-scale string grammar are built here; the
  TAI64 labels stay in their own story." Replace "the RINEX system letters spelled out" with "the six
  RINEX 4.02 §5.2.8 time-system identifiers". Add a `## String format` section with the D5 token
  table. Add a line: "The code lives in the `gnss/` and `timescale/` building-block namespaces; this
  story creates no `maritime/` namespace (D13)."
- `## Key constants`: "TAI − GPS = +19 seconds (BIPM: '19 s + C0', C0 tens of nanoseconds)"; the
  QZSS CNAV counter; NavIC's constants; rollovers "GPS LNAV at 1999-08-21T23:59:47Z and
  2019-04-06T23:59:42Z UTC; the next at 2038-11-20T23:59:42Z (TAI − UTC stays 37 s: continuous UTC
  from 20 May 2027, CGPM 2026 Resolution 5). Galileo's first 4096-week rollover is
  2078-02-19T23:59:42Z UTC." Replace the BIPM presentation link with the Annual Report and the
  `utc-gnss` file. Add NavIC's rollovers: 10-bit 2019-04-06T23:59:42Z and 2038-11-20T23:59:42Z,
  13-bit 2156-08-21T23:59:42Z.
- `## Design notes`: add D12 (RINEX navigation weeks are continuous from 1980 for GPS, QZSS, NavIC
  and Galileo, so they have their own functions; a RINEX NavIC week read as a NavIC broadcast week is
  1024 weeks off). Replace the GLONASS bullet with D10 ("`GLO` is GLONASS time in UTC hours, as
  RINEX and BIPM report it; GMT does not implement the three-hour system time"); replace "Default to
  the current era…" with D7; add D6 (named counters) and that offsets are nominal; drop "The
  leap-second table from SPA-48 — shared" wording that implies a table argument.
- `## What gmt provides (do not re-implement)` — must not name SPA-46 (a mutual reference would be
  flagged `⚠` by `deps check`):

  ```markdown
  - `parseInstantNanoseconds` / `toNanoseconds` from CORE-1 — instant parsing and precision
  - The leap-second table and its queries from SPA-48 — built in this story, consumed here
  ```

- `## Verification`: drop any table argument; `'BDS'` → `'BDT'`; the GAL scale string ends `GAL`;
  `utcToGnssWeek` takes the counter first (`'GPS-LNAV'`). Rewrite:
  - the era line: "`gnssWeekToUtc('GPS-LNAV', 100, 0, 0)` and era 1 give GPS labels exactly 1024
    weeks apart; `'GAL'` 4096 and `'BDT'` 8192; the UTC strings differ by that many weeks less the
    leap seconds between them";
  - the GLO week line: "`'GLO'` is not a week counter: the types do not accept it, and an untyped
    call returns the sentinel";
  - the line "`utcToGnss('GLO', iso)` is exactly three hours ahead of UTC and carries no leap-second
    offset" becomes "`utcToGnss('GLO', iso)` shows UTC's own wall clock with the token `GLO` (RINEX
    4.02 §4.1.2; BIPM), carries no leap-second offset, and writes a listed leap second as
    `…T23:59:60 GLO`";
  - add NavIC lines: "`utcToGnss('IRN', '1999-08-21T23:59:46Z')` returns the sentinel and
    `'1999-08-21T23:59:47Z'` returns `'1999-08-22T00:00:00 IRN'`"; "`utcToGnss('IRN',
    '2024-01-01T00:00:00Z')` is 18 seconds ahead of UTC (TAI − IRNSST 19 s, derived)";
    "`gnssWeekToUtc('IRN-LNAV', 0, 0, 1)` is `2019-04-06T23:59:42Z`";
  - add the RINEX line: "`rinexWeekToUtc('IRN', 2295, 86418)` is `2024-01-01T00:00:00Z`, and the
    same number through `gnssWeekToUtc('IRN-L1NV', 2295, 86418, 0)` is 1024 weeks later".

**`issues/SPA-48.md`**

- `## Scope`: `packages/gmt/src/timescale/calculate/` `taiMinusUtc(isoString)`,
  `leapSecondsBetween(start, end)`, `nextLeapSecond(isoString): string`;
  `packages/gmt/src/timescale/validate/` `isLeapSecond(isoString)`. The table is an
  internal constant (`internal/leapSeconds.ts`). Record the dropped functions in one bullet each,
  with D2's reason: `leapSecondTable` and `tableProvenance` (zero-argument constants: one value for
  every call; source and revision are cited in code and the guide), `isTableStale` (the table is
  closed, so it could never return `true`).
- `## Leap second facts`:
  - replace "A resolution has been adopted to **discontinue leap seconds by 2035**" with: "CGPM 2022
    Resolution 4 decided that the maximum value of UT1 − UTC 'will be increased in, or before, 2035'.
    CGPM 2026 Resolution 5 decided that 'continuous UTC will become effective on 20 May 2027', with
    a maximum |UT1 − UTC| of 3600 s. The table is therefore closed: TAI − UTC stays 37 s after
    2017-01-01."
  - "Insertions occur preferentially at the end of June or December" → add "(first preference; end
    of March and September are second preference, ITU-R TF.460-6 Annex 1 §2.1)".
  - Cite BIPM Annual Report vol. 15 Table 2 for pre-1972 "rubber seconds".
- `## Design notes`:
  - Replace the `isTableStale` bullet with: "The table is closed and built in (tracker DoD exemption
    for closed tables). A weekly canary compares it with the IERS file until IERS publishes its
    file format for continuous UTC; ITU-R TF.460-6 §2.3 requires at least eight weeks' notice of
    any insertion."
  - Replace "bundled with recorded provenance and a review cadence" with the canary and the cited
    source and revision.
  - Add "The syntax-only check in `plain/validate/` is `hasSecond60`."
- `## What gmt provides`: `parseInstantNanoseconds` / `toNanoseconds` from CORE-1 (drop
  `isValidZonedDateTime`).
- `## Verification`: full instants (`'2020-01-01T00:00:00Z'`, not `'2020-01-01Z'`); `nextLeapSecond`
  returns `""` for a current date; drop the `isTableStale` line; "The table's final entry matches TAI
  − UTC = 37" becomes "`taiMinusUtc('2017-01-01T00:00:00Z')` and `taiMinusUtc('2100-01-01T00:00:00Z')`
  return 37".

**`issues/SPA-46.md`**

- Title `# SPA-46 — Space: TAI64 labels`; `**Scope:**` "The TAI64, TAI64N and TAI64NA label formats
  built on TAI."
- `## Gap`: drop the GPS sentence.
- `## Scope`: remove the `tai.ts` and `gps.ts` bullets; add "`toTAI` / `fromTAI` and the GPS
  conversions (`gnssToUtc` / `utcToGnss` with `"GPS"`) are in MAR-16." The TAI64 functions move to
  `packages/gmt/src/timescale/convert/`, one file each (`toTai64n.ts`, `fromTai64n.ts`,
  `toTai64Bytes.ts`, `fromTai64Bytes.ts`); their signatures are unchanged (no table argument: the
  table is built in).
- `## Key constants`: keep TAI − UTC and the TAI64 line; drop the GPS lines (including "exactly and
  permanently, by definition", which BIPM's "19 s + C0" contradicts); replace the TimeTools link (a
  vendor page) and the BIPM presentation with BIPM Annual Report vol. 15.
- Remove `## String format` (it moves to MAR-16, without "SPICE-style").
- `## Design notes`: drop the GPS-epoch bullet.
- `## Corrections`: remove the `toGPS` paragraph (MAR-16's Corrections records the same sign error).
- `## What gmt provides`:

  ```markdown
  - `toNanoseconds` / `fromNanoseconds` from CORE-1 — precision conversion
  - The leap-second table from SPA-48 — TAI − UTC by date
  - `toTAI` / `fromTAI` and the time-scale string grammar from MAR-16 — the TAI hinge the labels are built on
  ```

- `## Verification`: keep only the TAI64 lines; note that TAI − UTC on 1992-06-02 is 26 s (the
  1991-01-01 row), matching Bernstein's example.

**`issues/CORE-1.md` line 93:** `isLeapSecond` → `hasSecond60`.

GitHub issues #197, #229 and #227: the finalizer drafts their text from these edits for the owner's
approval.

### 8.2 Tracker and overview

- **Already done in this revision (unstaged):** the reference-data rule's closed-table exemption in
  `tracker.md` (DoD), and its restatements in `overview.md` (Key Decisions "Bundled reference data"
  and "Leap seconds", "Why there are no bundled registries") and `index.md`.
- `overview.md`, architecture tree — the current plan, no dated narrative:
  - under the new core modules, add `timescale/  (SPA-48, MAR-16 — TAI, leap seconds; SPA-46 TAI64)`
    and `gnss/  (MAR-16 — satellite system times, weeks, rollovers)`;
  - `maritime/` → `(MAR-17 … MAR-19, MAR-59)`;
  - the `space/` line and its `data/ (Bulletin A)` child → one line, "Space realm — namespace name
    decided when the SPA stories start (SPA-47, SPA-49 … SPA-53, SPA-74, SPA-75)", with a note that
    "space" would collide with a planned spatial/geo expansion (GeoJSON, coordinates), so it is not
    reserved.
- `overview.md`, "What's in Core After This Epic" table: add `timescale/` (SPA-48, MAR-16, SPA-46:
  TAI − UTC, leap seconds, TAI and TAI64) and `gnss/` (MAR-16: the six RINEX system times, week
  counters, rollovers, RINEX weeks).
- `overview.md` Key Decisions: "Realm architecture" example `@northguild/gmt/space` →
  `@northguild/gmt/finance`, `@northguild/gmt/maritime`; "Space scales" `toTAI()`, `toGPS()` →
  `toTAI()`, `gnssToUtc()` and drop "(SPICE, SOFA, astropy pattern)"; "Leap seconds" names
  `timescale/` as the table's home.
- `tracker.md` realm notes name no code paths today; Phase 6's SPA-48 note changes as below. Nothing
  else names `space/` or `maritime/` paths.
- Finalizer: move the SPA-48 row to **#21**, directly above MAR-16 (now #22), Status `Done` for both,
  Release `—`. Renumber rows old #21–#60 by +1; #62–#68 keep their numbers. SPA-46's Deliverable:
  "TAI64 / TAI64N / TAI64NA labels". MAR-16's: "GNSS time scales (the six RINEX systems), week
  rollover, RINEX weeks, TAI, decoder tool".
- Cut table: `MAR-59 (#26) | MAR-16, SPA-48, MAR-17 … MAR-19, MAR-59`; `SPA-74 (#63) | SPA-46,
  SPA-47, SPA-49, SPA-74`; every cut between old #21 and #60 +1 (AV-64 #32, RAI-24 #35, IOT-66 #41,
  HLTH-39 #48, HLTH-68 #50, FIN-45 #56, FIN-73 #59).
- Phase 6 note: replace "**`SPA-48` comes first in this realm, not third.** … Build it when the first
  of those stories is picked up" with "**`SPA-48` shipped with `MAR-16`**, in the `timescale/` Core
  namespace. Its built-in table and queries are what `SPA-46`, `IOT-31` and `FIN-73` consume."
- Then `pnpm deps:sync`; confirm `pnpm deps -- check` passes.

### 8.3 Standards text

**`coding-standards.md`, after the INT-15 scoped exception:**

> ### Scoped exception: time-scale strings in the `timescale/` and `gnss/` converters (MAR-16)
>
> The same three rules extend to `fromTAI` (`packages/gmt/src/timescale/convert/`) and `gnssToUtc`
> (`packages/gmt/src/gnss/convert/`). A time-scale string
> (`"2026-01-01T00:00:37 TAI"`) is an ISO 8601 extended local date-time, one space, and a token
> naming the scale: `TAI` (FITS 4.0 Table 30) or one of the six RINEX 4.02 §5.2.8 time-system
> identifiers (`GPS`, `GAL`, `BDT`, `QZS`, `GLO`, `IRN`). ISO 8601 has no designator for TAI or a
> satellite system's time, and no `Temporal.*.from` reads one at any layer. The grammar is fixed,
> never caller-supplied:
>
> 1. One regex, `timeScaleString` in `internal/timeScaleString.ts`: a four-digit year, `T`, seconds
>    required, one to nine fraction digits after `.`, one space, the token. Not in `regex/`: no
>    standards body publishes the joined form.
> 2. The extracted fields are always handed to `Temporal.PlainDateTime.from(fields, { overflow:
>    "reject" })`. A second of 60 never reaches Temporal: it is refused for every token but `GLO`,
>    and for `GLO` it is passed as 59 with a flag, and kept only for one of the 27 inserted leap
>    seconds.
> 3. The try-catch and sentinel-return rules above are unchanged.
>
> The UTC side reads a second-60 instant (`"2016-12-31T23:59:60Z"`) without manual parsing: GMT's
> instant grammar with second 60 (`internal/utcReading.ts`) checks the shape, and
> `Temporal.Instant.from` reads it with the specification's clamp to 59. Only the `timescale/` and
> `gnss/` converters do this, and only for one of the 27 inserted leap seconds. Every other
> function still rejects a second of 60.
>
> This prohibition stands for every other function in the library.

**`code-review-checklist.md`, Architecture:** add `gnss/` and `timescale/` to the directory list.

### 8.4 Docs site pages (every result run against `packages/gmt/dist`)

Per [docs-site.md](../docs-site.md). The Maritime pages sit in the Maritime industry layer declared by dox-architect's tooling change (§5.5).

- **Maritime guide** `maritime-gnss-time-and-week-rollover.mdx`: how ships use satellite time,
  framed by IMO A.1046(27), IEC 61108 and IEC 61162-1 (§5.5) — one `##` per rule: why every
  satellite scale but `GLO` runs ahead of UTC by an amount that changed with each leap second, with
  all six side by side and no system as the lead example; the six RINEX scales and their
  epochs (Galileo's 13 s; NavIC's derived offset); `GLO` is UTC hours, and raw broadcast GLONASS
  system time needs three hours removed; week counters (LNAV, CNAV, L1NV), the rollover instants,
  `"rolling"` vs an integer era; RINEX navigation weeks vs broadcast weeks; a link to the decoder
  tool; `## See it break, then work`.
- **Core guide** `guides/core-date-operations/leap-seconds-and-tai.mdx`: the 27 insertions in a
  table with the IERS source and Bulletin C 72; TAI − UTC by date; `23:59:60` is real only on listed
  days; counting; CGPM 2022 and 2026 and why the table is closed; the weekly canary.
- Scenarios (`scenarios/<slug>.mdx`, `<Scenario>` with `fixedSpecId` = the function's playground):
  `gnss-offset-hardcoded.mdx`, `gnss-week-that-wrapped.mdx`, `cnav-week-read-as-lnav.mdx`,
  `rinex-navic-week-read-as-broadcast.mdx`, `a-leap-second-that-never-happened.mdx`.
- Mistakes, Wrong/Correct pairs: for GNSS — the sign of a satellite scale's lead over UTC (GPS
  and Galileo alike); a fixed offset such as 18 s or 4 s; the present-day offset at a system's epoch; GLONASS time read with three hours added; a week without
  its counter or era; a RINEX week fed to a broadcast counter. For timescale — `hasSecond60` used as
  a leap-second check; integer TAI − UTC before 1972. The GNSS pairs go on the Maritime mistakes
  page; the timescale pairs on a core mistakes page (`mistakes/leap-seconds.mdx`).
- Indexes: `guides/index.mdx`, `guides/core-date-operations/index.mdx`, `mistakes/index.mdx`, and
  `guides/industries/index.mdx`.
- The decoder tool's page is in the dox-architect spec.
- No page names SPA-46's TAI64 functions (not merged).

---

## 9. Open questions

### 9.1 Owner decisions (closed)

1. **The `GLO` lower bound is 1972-01-01T00:00:00Z** (owner decision; D10). RINEX and BIPM give
   GLONASS time no epoch, so a `GLO` label exists wherever UTC has whole-second leap seconds. The
   bound accepts dates before the constellation existed (first launch 1982), as `utcToGnss("GPS", …)` accepts
   dates before GPS's first satellite. The only document that dates GLONASS time later is the ICD
   that GMT does not follow.
2. **The weekly IERS canary stays until IERS publishes its file format for continuous UTC, and is
   retired then** (owner decision; D1, §5.8). Once continuous UTC is in effect on 20 May 2027 the
   file should gain no row, but until IERS says what the file looks like under continuous UTC, the
   canary is what would catch an unexpected change to it.

### 9.2 For the researcher

None open: the RINEX BeiDou and Galileo week rows are resolved (researcher §9.3.1, §12).

### 9.3 Decisions taken here that change story text (no question; listed so nothing surprises)

- D1–D2: the table is built in; no table argument; `leapSecondTable`, `tableProvenance`,
  `isTableStale` and `isValidLeapSecondTable` are dropped; no `…/data` subpath; TAI − UTC is 37 s
  after the last row.
- D3: `isLeapSecond` (plain) renamed `hasSecond60`: breaking, in a `minor`.
- D5–D6: RINEX and FITS tokens; `GnssSystem` is the six RINEX identifiers (`BDT`, not `BDS`); week
  functions take a named counter, including `IRN-LNAV` and `IRN-L1NV`; the GPS forms take `"LNAV"` /
  `"CNAV"`.
- D7–D8: required `rolloverEra`; system or counter first.
- D10: `GLO` is UTC hours only; GLONASS's three-hour system time is not implemented; MAR-16's "three
  hours ahead" line is rewritten.
- D11: TAI − IRNSST = 19 s is derived, and its JSDoc says so.
- D12: RINEX navigation weeks get `rinexWeekToUtc` / `utcToRinexWeek`, so a RINEX week cannot reach
  a broadcast counter by type.
- D13: `timescale/` and `gnss/`; no `space/` or `maritime/` in this story; the Space realm's
  namespace name is decided when the SPA stories start.
- Industry layers are separated from namespaces (owner decision); dox-architect owns the change.

### 9.4 Not reached (from R§13; marked, not asserted)

- How IERS will word Bulletin C and `leap-seconds.list` once continuous UTC takes effect. It does not
  matter to the built-in table: the canary compares rows only.
- The French official texts of the two CGPM resolutions (the English pages were used).
