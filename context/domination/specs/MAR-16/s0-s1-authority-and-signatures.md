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
| The six as peers = IMO-recognised WWRNS components | Policy: IMO A.1046(27) (2011), annex revised by MSC.599(111) (2026; §1.2 "includes global and regional radionavigation systems") — names no system. Recognition: GPS and GLONASS, A.860(20) annex §2.1.1.3, §2.1.2.2 (1997); BeiDou, SN.1/Circ.329 (2014); Galileo, SN.1/Circ.334 (2016); IRNSS, SN.1/Circ.340 (2020; ocean waters, 55°E–110°E, 5°S–50°N); QZSS, SN.1/Circ.341 (2021; body not reached, decision recorded in IMO's MSC 104 summary, the one primary page naming all six) (research §9a) |
| Receiver equipment, per system | IEC 61108-1 (GPS), -2 (GLONASS), -3 (Galileo), -5 (BDS), -6 (NavIC); no QZSS part found. Cited per system, not as the authority for the six (research §9a.3) |
| Receiver sentence format | IEC 61162-1:2024, Edition 6.0 (research §9a.4) |
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
| `leapSecondsBetween` is signed and half-open | **GMT rule.** `[start, end)` per `interval/`'s half-open standard (EWD831). A leap second is in the interval when its start is: an inserted second starts at 23:59:60.000 (TF.460-6 Annex 1 §2.2), not at the 00:00:00 where TAI − UTC steps |
| Nonexistent labels are rejected | [LOCAL_TIME_RESOLUTION.md](../../../reference/LOCAL_TIME_RESOLUTION.md) `"reject"`: a label inside a deleted second has no instant; an inserted second has its own label, so nothing is ambiguous |
| `hasSecond60` rename | D3; TF.460-6 §2.1–2.2 |
| Sentinels | [coding-standards § API Contract](../../../coding-standards.md#api-contract) |
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
