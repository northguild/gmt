## Decisions this spec makes (continued)

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

### D13. Namespaces: `timescale/` (Core) and `gnss/` (a cross-industry layer); the Space realm's name is unsettled

**Owner decision.** `timescale/` is a Core namespace (like `precision/`): TAI − UTC, leap seconds,
`toTAI` / `fromTAI`, general time primitives anyone uses. `gnss/` is an industry layer for the GNSS
industry (EUSPA publishes a GNSS market report), and a cross-industry one: satellite system times
and weeks that Maritime draws on now, and Aviation and IoT later. The name does not change. `maritime/` is created by the first story that ships something maritime-only
(MAR-17, MAR-18, MAR-19 or MAR-59).

**The Space realm's own namespace name is deliberately unsettled.** "space" will collide with a
planned spatial/geo expansion (GeoJSON, coordinates). The name is decided when the SPA stories
start; `space/` is not reserved, and nothing in this story creates it.

---
