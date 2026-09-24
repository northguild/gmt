# Realm gap spike — September 2026

**Date:** 2026-09-23, after 1.16.0 closed Phase 1 (CORE-1 … CORE-8).
**Question:** before building 46 realm stories on Core, is any existing spec wrong or thin
against its primary source, and is any calculation an industry runs on missing from the roadmap?
**Outcome:** 24 existing specs refined, 22 stories added, one absorbed, one mutual dependency
resolved. The roadmap is 75 stories.

The evidence behind every change is in four verification files, one per realm group, each
listing claim, quote (≤ 125 characters), source and clause, and ending with what could not be
verified:

- [spike-2026-09/transport-maritime.md](spike-2026-09/transport-maritime.md)
- [spike-2026-09/road-rail-aviation.md](spike-2026-09/road-rail-aviation.md)
- [spike-2026-09/iot-healthcare.md](spike-2026-09/iot-healthcare.md)
- [spike-2026-09/finance-space.md](spike-2026-09/finance-space.md)

Method: every remaining `issues/*.md` was read; each numeric rule or named standard in it was
checked against the issuing body's own text where reachable, or the nearest official reproduction
where not, with the rank recorded (primary / mirror / reproduction / not found). New candidates
were admitted only with a painpoint and a primary source, per the rule in
[../painpoints.md](../painpoints.md).

---

## 1. Corrections to existing specs

Things the previous specs said that the primary text does not.

| Story | Was | Is | Source |
| --- | --- | --- | --- |
| FIN-42 | `'30/360 US'`, `'30/360 ISDA'`, `'30E+/360'` | FpML codes; `30E/360.ISDA` owns the February rule; `ACT/365L` keys on the period end date, not on 29 February being inside | FpML 2-3; ISDA 2006 §4.16(f)–(i) |
| ROAD-20 | day = local calendar day | "beginning at the time designated by the motor carrier for the terminal from which the driver is normally dispatched"; §395.5 has no 34-hour restart | 49 CFR 395.2, 395.5 |
| ROAD-21 | fortnight "rolling window" | fixed Monday–Sunday weeks (Art 4(i)); adjacent fixed weeks; no Art 8(8b); "three weeks" is derived, not stated | 561/2006 consolidated |
| ROAD-61 (was ROAD-20 note) | 16-hour exception "once per 7 days"; sleeper "7/3, 8/2" | "not … within the previous 6 consecutive days", reset by 34 h; pairs defined by three constraints | 49 CFR 395.1(o)(3), (g)(1)(ii) |
| ROAD-62 (brief) | north-of-60 sections ss. 36–37; cycle 2 precondition 70 h | ss. 39, 51–53; precondition 80 h; ss. 38 and 40 repealed | SOR/2005-313 |
| MAR-19 | Gencon NOR after noon → 08:00 next working day | **06:00**; "Time used before commencement of laytime shall count" | Gencon 94 cl. 6(c) |
| MAR-16 | GPS only | GST = 13 s at its 1999 epoch statement; BDT 13-bit week; GLONASS applies leap seconds | Galileo, BeiDou, GLONASS, QZSS ICDs; IS-GPS-200N |
| RAI-22 | second Sunday in December, uncited | "at midnight on the second Saturday in December"; June adjustment; full deadline calendar | Decision 2017/2075 Annex VII |
| RAI-23 | UIC 406 blocking-time components listed | leaflet paywalled; components become the caller's input; list removed | UIC shop metadata only |
| RAI-63 (brief) | limbo cap in §21103(c)(4) | §21103(c)(1)(A)–(B); (c)(4) is the make-up rule | 49 U.S.C. §21103 |
| AV-64 (brief) | anchor date needs a data record; 42 days a Standard | Annex 15 §6.2.1 names 8 November 2018; 28 days is the Standard, 42 a Note, 56 a Recommendation; `YYNN` is not ICAO's | Annex 15 16th ed. ch. 6 |
| AV-27 | folk definitions | 117.3 and ORO.FTL.105 wording; early start / late finish bands differ by schedule type | 14 CFR 117.3; Reg. 83/2014 |
| AV-28 | item D) informal | OPADD grammar: days or dates, first = B), last = C), gaps ≤ 7 days, no oblique; TAF `DD24`, PROB 30/40 only | OPADD 4.1; WMO 306 FM 51 |
| IOT-30 (draft) | bound `[θ − δ/2, θ + δ/2]` | `[θ − λ, θ + λ]`, λ = ε + δ/2 | RFC 5905 §11.2.1 |
| IOT-66 (draft) | HLC "Algorithm 2" | Figure 5 of the tech report; Corollaries 1 and 3 | Kulkarni et al. 2014 |
| IOT-32 | Dataflow §2.2 / §2.3 | §1.2 windows, §1.3 watermarks | Akidau et al. 2015 |
| HLTH-33 | one type | `TS` (2.A.77) may lower, never raise, precision; `TM` offset restricted; `0000` = preceding midnight | HL7 v2.5.1 ch. 2A |
| HLTH-35 | `@2012-01 = @2012-02 → false` as printed | derived; printed example is `@2012 = @2013`; current FHIRPath is v3.0.0 | FHIRPath N1, v3.0.0 |
| HLTH-36 | hours-or-finer rule "US CQL IG" | CQL Appendix B (Same As); IVF EDD 261/263 days | CQL v2.0.0; ACOG CO 700 |
| HLTH-67 (draft) | "grace period must not be used for scheduling" | not on the CDC page; CDSi separates absolute-minimum (evaluate) from minimum (forecast) dates | CDC ACIP page; CDSi 4.6 |
| HLTH-69 (draft) | "midnight census" | "midnight-to-midnight method"; leave-of-absence rules | MBPM ch. 3 §20.1–20.1.2 |
| HLTH-70 (draft) | VI.F numbering; 8 h off a "must" | 2025 renumbering 6.20–6.28; 8 h off is a "should" (Detail) | ACGME CPR 2023v3, 2025 |
| FIN-44 (brief) | CDS roll change 21 Dec 2015 | 20 December 2015; coupons stay quarterly; on-the-run maturities 20 Jun / 20 Dec | ISDA release and FAQ |
| SPA-46 (draft) | 1970 TAI64 label = 10 s | unverified; Bernstein's own 1992 example used instead; `@` form is daemontools' | cr.yp.to/libtai |
| SPA-47 | B1.9 as a JD formula | B1.9 fixes only the rate; the JD formula is IERS Conventions eq. (10.1) | SYRTE; IERS TN 36 |
| SPA-75 (draft) | Meeus 0.01° accuracy | not verified; NOAA's "within a minute … +/- 72°" used | NOAA; USNO |
| INT-15 (draft) | `DTM` a 1250 code; named zone codes carry offsets | `DTM` is a segment; X12 states no offset for `ED`/`ES`; ISO codes 13–24 descend | X12 DE 623, 1250 |
| INT-13 | three regimes | eight regimes with anchors read from their own texts; China's official text not reached | 19 CFR, DA 2015/2446, SOR/86-873, 33 CFR 160.212 |

## 2. Stories added

| ID | Realm | Why it earned a place |
| --- | --- | --- |
| CORE-54 | Core | Holiday rules (nth weekday, Easter, observance) re-derived by five stories |
| CORE-55 | Core | Operating hours and recurring windows re-derived by seven stories |
| CORE-56 | Core | Time-ordered identifiers and data-platform epochs — CORE-3's family, second generation |
| TRAN-57 | Transport | Schedule deviation, punctuality and the DCSA classifier vocabulary — every mode's question |
| INT-58 | Intermodal | 46 CFR 541 billing timelines — new law, pure dates, money |
| MAR-59 | Maritime | NMEA 0183 time fields — what every bridge receiver emits |
| MAR-60 | Maritime | STCW/MLC rest hours — port-state enforced, spreadsheet-run |
| ROAD-61 | Road | FMCSA exceptions — how drivers actually operate |
| ROAD-62 | Road | Canadian HOS — the other half of the largest road trade |
| RAI-63 | Rail | FRA train-crew hours — statute with monthly and consecutive-day caps |
| AV-64 | Aviation | AIRAC cycles — one anchor in the Standard, 28-day stride |
| AV-65 | Aviation | Cumulative crew limits — deterministic sums AV-27 had left "out of scope" |
| IOT-66 | IoT | HLC and uncertainty ordering — the rules on top of IOT-30's intervals |
| HLTH-67 | Healthcare | Immunization dose validity — the four-day rule, mis-coded everywhere |
| HLTH-68 | Healthcare | PDC adherence — interval union with PQA's shift rule |
| HLTH-69 | Healthcare | Length of stay — `dwellTime.calendarDays` in a hospital |
| HLTH-70 | Healthcare | ACGME work hours — the fifth duty-log regulator |
| FIN-71 | Finance | Calculation period schedules — FpML's model |
| FIN-72 | Finance | RFR compounding conventions as date structures |
| FIN-73 | Finance | FIX and SWIFT timestamps; RTS 25 granularity |
| SPA-74 | Space | TDB and TCB — split from SPA-47 to break the SPA-47 ⇄ SPA-49 cycle |
| SPA-75 | Space | Solar events — sunrise, sunset, twilight, the input to aviation night and NOTAM `SR`/`SS` |

## 3. Structural decisions

- **The intermodal container-leg and terminal-dwell story was absorbed.** Its `terminalDwell` was
  `dwellTime` with a required zone; its `containerLeg` was `transitTime` + `etaAtZone` with opaque
  tags. TRAN-8 took the zone rule and the `portDwell` correction; TRAN-9's `Leg` took the tags. Per
  the epic's rule for absorbed stories, no reference to its ID remains anywhere in the repo.
- **SPA-47 split.** TT and TCG stay; TDB and TCB moved to SPA-74. SPA-49 now depends on SPA-47
  alone, and the tracker's one unbuildable row is gone.
- **Build order interleaves realms where a dependency demands it.** Road precedes Maritime
  (MAR-60 uses ROAD-20's `DutyEntry`); Aviation precedes Rail (RAI-22 uses AV-26's
  `operatingDatesBetween`). CORE-54 … CORE-56 are each built just before their first consumer.
- **`scripts/deps.mjs` now takes build order from the tracker row**, not from the number in the
  ID. Inserting the Core primitives ahead of realm rows would otherwise have rendered them as
  "build it yourself" markers instead of blockers.
- **Shared shapes named in specs:** `DutyEntry` (ROAD-20) for every hours-of-work regulator;
  `dwellTime.calendarDays` (TRAN-8) for every "local days crossed" count; `OperatingSchedule`
  (CORE-55) under sessions, curfews, WOCL and gate hours; `nthWeekdayOfMonth` (CORE-54) under IMM,
  expiries and the IATA season.

## 4. Not verified — carried into the specs as such

Each of these is marked in the spec that depends on it, and none is asserted as fact.

- UIC 406 (2013) text — paywalled; RAI-23 takes components from the caller.
- SIFMA *Standard Securities Calculation Methods* — printed book; the 30/360 US February variant
  stays out of FIN-42.
- IMO's Manila text of STCW A-VIII/1 — 403 on every host; MAR-60 cites the MLC (ILO text) and the
  UK MCA's reproduction, and flags the paragraph numbers as reproduced.
- GACC Announcement [2017] No. 56 — reproductions only; INT-13's data row carries
  `primaryTextVerified: false`.
- NMEA 0183 ZDA zone-sign direction and RMC century — not in the public reference; MAR-59 makes
  the century a required parameter and cites the sign at implementation.
- IATA SSIM Chapter 7 column layout — from two agreeing public parsers; AV-26 takes fields, not
  columns.
- CME Rulebook "Trade Date" — cmegroup.com blocked; FIN-40 cites a CME Globex notice.
- ISDA 2021 §4.6.1 paragraph numbers — paywalled; inferred from the ISDA-authored CDM, and FpML's
  own "(v)" for BUS/252 is a scheme error.
- Meeus's 0.01° solar-position accuracy and the `cos H₀ ∉ [−1, 1]` polar rule — book not online;
  SPA-75 cites NOAA and USNO and treats the polar rule as algorithmic.
- Decision 2017/2075 kept both timetable dates — verified; the earlier Directive text and the
  replacement agree.
- 49 U.S.C. §21103(c)(1) transition wording between the 40- and 30-hour limbo caps — reported
  inconsistently; RAI-63 makes the cap the caller's selection.
- Regulation 83/2014 point numbers within ORO.FTL.105 — text extracted without numbering;
  AV-27 cites the rule name.

## 5. What this spike did not do

It did not implement anything, did not touch `packages/gmt/src`, and did not decide
implementation detail beyond signatures. Each new spec is an input to `architect`, not a
replacement for it. It also did not re-open the parked list except to add entries
(see [../painpoints.md § Parked](../painpoints.md#parked)).
