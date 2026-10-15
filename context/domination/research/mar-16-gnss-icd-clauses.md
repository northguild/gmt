# MAR-16 / SPA-48 / SPA-46 — GNSS time-scale clauses, the leap-second table and scale designators

Date: 2026-10-15. Tools: curl, pypdf text extraction, Node 24 with `@js-temporal/polyfill` 0.5.1 (the
version `packages/gmt` pins). Every quote below was read from the issuing body's own file on the date
above. Quotes are verbatim from the extracted text; where PDF extraction mangled a symbol (Δ, Greek,
Cyrillic) that is said. Page numbers are the printed page, then the PDF page where they differ.
Nothing under the repository tree was touched except this file.

Legend: **PRIMARY** = the issuing body's own text. **DERIVED** = computed here from primary
statements, with the computation shown. **NOT REACHED** = marked, not asserted.

---

## 0. Headline findings (read these first)

1. **The 28th CGPM adopted continuous UTC this week.** CGPM 2026 Resolution 5 "decides that
   continuous UTC will become effective on 20 May 2027" and that "the maximum value for the
   difference |UT1-UTC| will be 3 600 seconds (1 hour)". SPA-48's "discontinue leap seconds by 2035"
   is wrong twice over: 2022 Resolution 4 never said "discontinue", and 2026 Resolution 5 sets
   **20 May 2027**. See §7.
2. **IERS Bulletin C 72 (Paris, 06 July 2026): "NO leap second will be introduced at the end of
   December 2026."** TAI − UTC = 37 s "until further notice". `Leap_Second.dat` and
   `leap-seconds.list` both say "File expires on 28 June 2027". No Bulletin C after No. 52 (July 2016)
   has announced an insertion. See §6.
3. **TAI − GPS = 19 s is stated by BIPM, not by IS-GPS-200.** IS-GPS-200N contains the string "TAI"
   zero times. BIPM states "[TAI - GPS time] = 19 s + C0" (Annual Report on Time Activities vol. 15,
   p. 48) and gives integer offsets for GPS, Galileo, BeiDou and GLONASS in its `utc-gnss` file. See §1.7.
4. **MAR-16 has a sign error: "TAI − GST (−19 s)".** TAI − GST is **+19 s**, the same as GPS. See §2.4.
5. **TAI − BDT = 33 s is stated by BIPM** ("[UTC-BEIDOU time]: (33-xx) s"), and also follows from the
   BDS ICD epoch plus TAI − UTC = 33 s on 2006-01-01. No BDS ICD mentions TAI. See §3.4.
6. **SPICE time strings do not accept `TAI` or `GPS` as labels.** `str2et_c` accepts "TDB, TDT, UTC"
   (and "TT" per the Time Required Reading). `TAI` and `GPS` exist only as `unitim_c` uniform-scale
   names for numeric seconds past J2000. SPA-46's "SPICE-style scale designators '… TAI', '… GPS'" is
   therefore not SPICE syntax. FITS 4.0 Table 30 (IAU FITS Working Group) does recognise `'TAI'`,
   `'GPS'`, `'TT'`, `'TDB'`, `'UTC'`. See §9.
7. **"GLONASST" appears in no authoritative source I found.** The GLONASS ICD uses "GLONASS time" and
   the symbol TГЛ (T_GL). RINEX uses `GLO`, but defines it as "the GLONASS UTC time" with "the same
   hours as UTC and not UTC+3 h". BIPM also gives "[UTC - GLONASS time] = 0 s + C1". This conflicts
   with MAR-16's "exactly three hours ahead" test. **Escalated, not decided.** See §4.5 and §9.
8. **Newer editions exist for three of the five ICDs MAR-16 cites:** Galileo OS SIS ICD Issue 2.2
   (Nov 2025), BDS-SIS-ICD-B1I 3.0 (Feb 2019) and IS-QZSS-PNT-006 (11 Jul 2024). IS-GPS-200N is still
   the latest on navcen.uscg.gov. The wording MAR-16 quotes is verbatim from the older editions; two
   quotes changed in the newer ones. See §2, §3, §5.
9. **NavIC (IRN): TAI − IRNSST = 19 s is DERIVED, not stated.** The ISRO ICDs give the epoch
   (1999-08-21T23:59:47 UTC = 1999-08-22T00:00:00 NavIC, "ahead of UTC by 13 leap seconds") but never
   mention TAI. BIPM publishes no NavIC row anywhere. RINEX 4.02 Table 1 gives "GPS = IRN = UTC + ΔtLS".
   There are two week counters: 10 bits on L5/S (first wrap already happened, 2019-04-06T23:59:42Z) and
   13 bits on L1 (first wrap 2156-08-21T23:59:42Z). See §5a.

---

## 1. IS-GPS-200 — revision N (01-AUG-2022), latest

Source (PRIMARY): <https://www.navcen.uscg.gov/sites/default/files/pdf/gps/IS-GPS-200N.pdf>
Latest-revision check: navcen's "GPS Technical References" page lists `IS-GPS-200N.pdf` and older
revisions only; `IS-GPS-200O.pdf` and `IS-GPS-200P.pdf` return 404.
(<https://navcen.uscg.gov/gps-technical-references>, retrieved 2026-10-15)

### 1.1 Epoch and "continuous time scale" — §3.3.4, p. 37 (PDF 56)

> "GPS time is established by the Control Segment and is referenced to Coordinated Universal Time
> (UTC) as maintained by the U.S. Naval Observatory (UTC (USNO)) zero time-point defined as midnight
> on the night of January 5, 1980/morning of January 6, 1980. The largest unit used in stating GPS
> time is one week defined as 604,800 seconds. GPS time may differ from UTC because GPS time shall be
> a continuous time scale, while UTC is corrected periodically with an integer number of leap
> seconds."

The same section continues:

> "The OCS shall control the GPS time scale to be within one microsecond of UTC (modulo one second)."

§6.2.4 GPS Week Number, p. 47 (PDF 66):

> "The GPS week numbering system is established with week number zero (0) being defined as that week
> which started with the X1 epoch occurring at midnight UTC (USNO) on the night of January 5, 1980/
> morning of January 6, 1980. The GPS week number continuously increments by one (1) at each
> end/start of week epoch without ever resetting to zero. Users must recognize that the week number
> information contained in the LNAV/CNAV message may not necessarily reflect the current full GPS
> week number"

### 1.2 TOW range — §3.3.4(a), p. 38 (PDF 57)

> "The count is short-cycled such that the range of the TOW-count is from 0 to 403,199 X1 epochs
> (equaling one week) and is reset to zero at the end of each week."

An X1 epoch is 1.5 s, so 403,200 × 1.5 s = 604,800 s. **IS-GPS-200N never writes "604,799"**; a
whole-second TOW of 0–604,799 is DERIVED from "one week defined as 604,800 seconds" plus the reset at
end of week. (Galileo's ICD states 0–604799 outright; §2.3.)

§3.3.4(a) also says the zero state "may differ by a few seconds from 0000 hours on the UTC scale since
UTC is periodically corrected with leap seconds while the TOW-count is continuous".

### 1.3 LNAV week — 10 bits, modulo 1024 — §20.3.3.3.1.1, p. 93 (PDF 112)

> "The ten MSBs of word three shall contain the ten LSBs of the Week Number as defined in 3.3.4.
> These ten bits shall be a modulo 1024 binary representation of the current GPS week number at the
> start of the CEI data set transmission interval (see paragraph 3.3.4(b))."

### 1.4 CNAV week — 13 bits, modulo 8192 — §30.3.3.1.1.1, p. 159 (PDF 178)

> "Bits 39 through 51 of Message Type 10 shall contain 13 bits which are a modulo-8192 binary
> representation of the current GPS week number at the start of the CEI data set transmission
> interval (see paragraph 6.2.4)."

### 1.5 GPS/UTC relationship — §20.3.3.5.2.4, pp. 126–128 (PDF 145–147)

(Δ glyphs are dropped by text extraction; restored here in brackets.)

> "Page 18 of subframe 4 includes: (1) the parameters needed to relate GPS time to UTC, and (2) notice
> to the user regarding the scheduled future or recent past (relative to LNAV message upload) value of
> the delta time due to leap seconds ([Δ]tLSF), together with the GPS week number (WNLSF) and the GPS
> day number (DN) near the end of which the leap second becomes effective."

Case a: "tUTC = (tE - [Δ]tUTC) [modulo 86400 seconds]" where
"[Δ]tUTC = [Δ]tLS + A0 + A1 (tE - tot + 604800 (WN - WNt)), seconds;" and
"[Δ]tLS = delta time due to leap seconds;".

Case b (within six hours of the event): "tUTC = W[modulo (86400 + [Δ]tLSF - [Δ]tLS)], seconds" …
"Note that when a leap second is added, unconventional time values of the form 23:59:60.xxx are
encountered."

WNLSF and WNt are 8 bits, "a modulo 256 binary representation of the GPS week number". CNAV
equivalent: §30.3.3.6.2, p. 184 (PDF 203), adds an A2 term.

So the ICD's own name for GPS − UTC (integer part) is **ΔtLS**, broadcast, not a constant.

### 1.6 Where TAI − GPS = 19 s is stated

- **IS-GPS-200N: not stated.** A whole-text search for the word "TAI" or "International Atomic" finds
  0 occurrences.
- **BIPM, PRIMARY.** *BIPM Annual Report on Time Activities*, vol. 15 (2020), "Relations of UTC and
  TAI with GPS time, GLONASS time, …", p. 48:
  > "The GPS satellites disseminate a common time scale designated 'GPS time'. The relation between
  > GPS time and TAI is: [TAI - GPS time] = 19 s + C0, where the time difference of 19 seconds is kept
  > constant and C0 is a quantity of the order of tens of nanoseconds, varying with time."
  > "From 1 January 2017, 0 h UTC, until further notice, [UTC - GPS time] = -18 s + C0"
  <https://webtai.bipm.org/ftp/pub/tai/annual-reports/bipm-annual-report/annual_report_2020.pdf>
  (2020 is the last volume on the server.)
- **BIPM `utc-gnss` file header, PRIMARY** (created 22/05/2024, current):
  > "Difference in the entire number of seconds between UTC and the GNSS time scales:
  > [UTC-GPS time] : (19-xx) s / [UTC-GLONASS time] : 0 s / [UTC-GALILEO time]: (19-xx) s /
  > [UTC-BEIDOU time]: (33-xx) s / where xx is the integer number of leap seconds applied since 1972,
  > available in <https://hpiers.obspm.fr/eoppc/bul/bulc/Leap_Second.dat> ."
  <https://webtai.bipm.org/ftp/pub/tai/other-products/utcgnss/utc-gps> (also `utc-gal`, `utc-bds`,
  `utc-glo`)

  **Trap in the BIPM wording:** read literally, "integer number of leap seconds applied since 1972"
  is 27, giving UTC − GPS = −8 s, which is wrong. The formula only works with xx = TAI − UTC (37),
  the value the file links to: 19 − 37 = −18 s, matching the annual report. Cite it as
  "xx = TAI − UTC from Leap_Second.dat", not as a leap-second count.
- **IS-QZSS-PNT** states the same 19 s for QZSST (§5.1).
- **FITS 4.0 Table 30**: "'GPS' … runs (approximately) synchronously with TAI; GPS ≈ TAI − 19 s".

**Verdict:** TAI − GPS = 19 s (integer part, constant) — BIPM, PRIMARY. GPS − UTC is 0 at the epoch
because TAI − UTC was 19 s on 1980-01-06 (`Leap_Second.dat`: "44239.0 1 1 1980 19"). Both facts
agree.

---

## 2. Galileo OS SIS ICD

- Issue 2.0, January 2021 (cited by MAR-16), PRIMARY:
  <https://www.gsc-europa.eu/sites/default/files/sites/all/files/Galileo_OS_SIS_ICD_v2.0.pdf>
- **Issue 2.2, November 2025 (latest)**, PRIMARY:
  <https://www.gsc-europa.eu/sites/default/files/sites/all/files/Galileo_OS_SIS_ICD_v2.2.pdf>
  (`_v2.3.pdf` and `_v3.0.pdf` return 404.)

### 2.1 The epoch sentence

Issue 2.0, §5.1.2 Galileo System Time (GST), p. 45 (PDF 57), Table 62:

> "The GST start epoch is defined as 13 seconds before midnight between 21 st August and 22nd August
> 1999, i.e. GST was equal to 13 seconds at 22nd August 1999 00:00:00 UTC."

**MAR-16's quote is verbatim from Issue 2.0.** Issue 2.2, §5.1.2, p. 58 (PDF 72), Table 69, reworded
it:

> "The GST start epoch is defined as 13 seconds before midnight between August 21st and August
> 22nd,1999, i.e.: GST was equal to 13 seconds on August 22nd, 1999 at 00:00:00 UTC."

Same meaning; different words. If the JSDoc quotes the sentence, it must name the issue.

### 2.2 Week number — 12 bits, 4096 weeks

Issue 2.0 §5.1.2 (and identical in 2.2):

> "The Week Number is an integer counter that gives the sequential week number from the GST start
> epoch. This parameter is represented with 12 bits, which covers 4096 weeks (about 78 years). Then
> the counter is reset to zero to cover an additional period modulo 4096."

### 2.3 TOW 0–604799

> "The Time of Week is defined as the number of seconds that have occurred since the transition from
> the previous week. The TOW covers an entire week from 0 to 604799 seconds and is reset to zero at
> the end of each week."

Table 62 (2.0) / Table 69 (2.2): "WN Week Number 12 1 week", "TOW Time of Week 20 1 s".

### 2.4 "Continuous time scale"

> "As GST is a continuous time scale, and UTC is corrected periodically with an integer number of leap
> seconds, the Galileo navigation message contains all necessary parameters to convert between GST
> and UTC."

### 2.5 GST − GPS and TAI − GST

- **The ICD never mentions TAI.** Word search for "TAI" in Issues 2.0 and 2.2: 0 occurrences.
- **The ICD does not state an integer GST − GPS offset.** It states only the broadcast GGTO
  polynomial, Issue 2.2 "GPS to Galileo System Time Conversion and Parameters" (§5.1.8 in 2.0),
  p. 64 (PDF 78):
  > "∆tSystems = tGalileo − tGPS = A0G + A1G [ TOW − t0G + 604800(WN − WN0G) ]"
  Table 76 (2.2): "A0G Constant term of the polynomial describing the offset ∆tSystems 16* 2−35 s".
  A 16-bit two's-complement A0G at 2⁻³⁵ s spans at most ±2⁻²⁰ s ≈ ±0.95 µs. So the ICD's own
  broadcast format cannot carry a whole-second GST − GPS difference: DERIVED, the two scales share
  whole seconds.
- **The epoch statement fixes the integer alignment (DERIVED).** At 1999-08-22T00:00:00 UTC,
  TAI − UTC was 32 s (`Leap_Second.dat`: "51179.0 1 1 1999 32"), so GPS − UTC = 32 − 19 = 13 s. The
  ICD says GST was 13 s at that instant. So GST = GPS in whole seconds, and the GST start epoch
  (WN 0, TOW 0) is GPS week 1024, TOW 0 = 1999-08-21T23:59:47Z (computation in §8).
- **BIPM states it, PRIMARY:** "[UTC-GALILEO time]: (19-xx) s" (the `utc-gnss` header in §1.6), so
  **TAI − GST = +19 s**.
- RINEX 4.02 §4.1.3 agrees: "The GST week started at zero at the first roll-over of the broadcast GPS
  week after 1023, i.e. at Sun, 22-Aug-1999 00:00:00 GPS time".

**Correction to MAR-16:** "the ICDs do not restate TAI − GST (−19 s)" — the sign is wrong. TAI − GST
= **+19 s** (GST is 19 s behind TAI, exactly like GPS). Also, "derived" can be upgraded: BIPM states
it.

### 2.6 GST − UTC

Issue 2.2 "GST-UTC Conversion Algorithm and Parameters" (§5.1.7 in 2.0), pp. 62–63: the same three
cases as GPS. "𝛥𝑡𝐿𝑆 Leap Second count before leap second adjustment 8* 1 s" and "∆𝑡𝑈𝑇𝐶 = ∆𝑡𝐿𝑆 + 𝐴0 +
𝐴1(𝑡𝐸 − 𝑡0𝑡 + 604800(𝑊𝑁 − 𝑊𝑁0𝑡))".

---

## 3. BeiDou (BDS) SIS ICDs

- BDS-SIS-ICD-2.0, "Open Service Signal (Version 2.0)", December 2013 (cited by MAR-16), via a
  university mirror: <https://gge.ext.unb.ca/Resources/beidou_icd_english_ver2.0.pdf> (MIRROR of a
  CSNO text; the official site now carries only the later editions).
- **BDS-SIS-ICD-B1I-3.0, February 2019 (latest B1I)**, PRIMARY:
  <http://en.beidou.gov.cn/SYSTEMS/ICD/201902/P020190227702348791891.pdf>
- BDS-SIS-ICD-B1C-1.0, December 2017, PRIMARY:
  <http://en.beidou.gov.cn/SYSTEMS/ICD/201806/P020180608519640359959.pdf>
  (index: <http://en.beidou.gov.cn/SYSTEMS/ICD/>)

### 3.1 Epoch and "SI seconds, rather than leap seconds"

BDS-SIS-ICD-2.0 **§3.3 Time System**, pp. 2–3 (PDF 6–7):

> "The time reference for the BDS uses the BeiDou navigation satellite system Time (BDT). BDT adopts
> international system of units (SI) seconds, rather than leap seconds, as the basic unit for
> continuous accumulation. The start epoch of BDT was 00:00:00 on January 1, 2006 of Coordinated
> Universal Time (UTC). BDT is counted with week and seconds of week (SOW). BDT is related to the UTC
> through UTC(NTSC). BDT offset with respect to UTC is controlled within 100 nanoseconds (modulo 1
> second). The leap seconds are broadcast in navigation (NAV) message."

**Changed in B1I 3.0**, §3.3, p. 3 (PDF 7) (and identically in B1C 1.0 §3.3, p. 3):

> "The BeiDou navigation satellite system Time (BDT) is adopted by the BDS as time reference. BDT
> adopts the international system of units (SI) second as the base unit, and accumulates continuously
> without leap seconds. The start epoch of BDT is 00:00:00 on January 1, 2006 of Coordinated
> Universal Time (UTC). BDT connects with UTC via UTC (NTSC), and the deviation of BDT to UTC is
> maintained within 50 nanoseconds (modulo 1 second)."

**Correction to MAR-16:** the epoch and "SI seconds, rather than leap seconds" sentences are in **§3.3**,
not §5.2.4.3–5.2.4.4. The "rather than leap seconds" wording exists only in 2.0; the latest edition
(B1I 3.0) says "accumulates continuously without leap seconds".

### 3.2 Week number — 13 bits, 0–8191

B1I 3.0 §5.2.4.4, p. 25 (PDF 29); identical in 2.0 §5.2.4.4, p. 23 (PDF 27):

> "There are altogether 13 bits for week number (WN) which is the integral week count of BDT with the
> range of 0 through 8191. Week number count started from zero at 00:00:00 on Jan. 1, 2006 of BDT."

B1C 1.0 §7.3, Table 7-2, p. 33: "WN Week number 13 1 0~8191 week", and p. 34: "WN counts from zero at
the origin of BDT (i.e., 00:00:00, January 1, 2006 UTC)." (B1C carries Hours Of Week 0~167 and Seconds
Of Hour 0~3582 in 18 s steps instead of SOW.)

### 3.3 SOW width

B1I 3.0 §5.2.4.3 (2.0 same):

> "Bits 19~26 and bits 31~42, altogether 20 bits of the each subframe are for seconds of week (SOW)
> which is defined as the number of seconds that have occurred since the last Sunday, 00:00:00 of
> BDT."

20 bits confirmed. **No explicit 0–604799 range is printed** for SOW in the B1I ICDs; the range is
DERIVED from "since the last Sunday".

### 3.4 TAI − BDT = 33 s

- **No BDS ICD mentions TAI** (0 occurrences in 2.0, B1I 3.0 and B1C 1.0).
- **BIPM states it, PRIMARY:** "[UTC-BEIDOU time]: (33-xx) s" (`utc-gnss` header, §1.6). With xx =
  TAI − UTC = 37 s, UTC − BDT = −4 s, i.e. BDT is 4 s ahead of UTC and 33 s behind TAI.
- **Derivation (DERIVED):** the ICD sets BDT − UTC = 0 at 2006-01-01T00:00:00 UTC. `Leap_Second.dat`:
  "53736.0 1 1 2006 33", so TAI − UTC = 33 s from that instant. TAI − BDT = (TAI − UTC) − (BDT − UTC)
  = 33 − 0 = **33 s**. GPS − BDT = 33 − 19 = **14 s**.
- RINEX 4.02 §4.1.4 agrees: "BDT zero time started at 00:00:00 UTC on January 1st, 2006 (GPS week
  1356) therefore BDT is 14 seconds behind GPS time." Table 2: "ΔtLSBDS = ΔtLS -14 seconds",
  "2017-01-01 - ????-??-??: ΔtLSBDS = 4 seconds".

---

## 4. GLONASS ICD, Edition 5.1 (2008)

Source: <https://www.unavco.org/help/glossary/docs/ICD_GLONASS_5.1_(2008)_en.pdf> — Russian Institute of
Space Device Engineering, Moscow, "ICD L1, L2 GLONASS (Edition 5.1) 2008". This is an English edition
hosted by UNAVCO (MIRROR); the issuing body's own site was not tried. PDF page = printed page.

The later CDMA ICDs (2016) are Russian-only and were **NOT REACHED**; nothing here depends on them.

### 4.1 UTC(SU) + 3 h — §3.3.3 GLONASS time, p. 22 (not used — MAR-16 D10)

> "Due to the leap second correction there is no integer-second difference between GLONASS time and
> UTC (SU). However, there is constant three-hour difference between these time scales due to
> GLONASS control segment specific features:
> TГЛ = TUTC (SU) + 03 hour 00 mines"

("mines" is in the extracted text; the formula symbol is Cyrillic TГЛ, "T_GL".)
**Correction to MAR-16:** its quote "UTC(SU) + 03 hours 00 min" is not verbatim. Quote the sentence
"there is constant three-hour difference between these time scales" plus the formula as printed.

### 4.2 Leap-second correction wording — §3.3.3, p. 22

> "The GLONASS time scale is periodically corrected to integer number of seconds simultaneously with
> UTC corrections that are performed according to the Bureau International de l Heure (BIH)
> notification (leap second correction)."

MAR-16's fragment "corrected to integer number of seconds simultaneously with UTC corrections" is
verbatim. The section also says GLONASS-M almanac word KP gives advance notice (§4.5) and points to
Appendix 2 ("Recommendations … during UTC leap second correction", p. 48).

### 4.3 N_T — §4.4, p. 32 (not used — MAR-16 D10)

> "Word NT is current date, calendar number of day within four-year interval starting from the 1-st
> of January in a leap year (1)."

Table: "NT (1) 11 1 0…1461 days". The "(1)" footnote marks GLONASS-M-only words.

### 4.4 N_4 — §4.5, p. 36 (not used — MAR-16 D10)

> "Word N4 is four-year interval number starting from 1996 (1) ;"

Table: "N4 (1) 5 1 1…31 4-year interval". Appendix A.3.1.3, pp. 57–58:
"Y = 1996 + 4*(N4 –1) + (J – 1)", with J = 1 for 1 ≤ NT ≤ 366, 2 for 367–731, 3 for 732–1096,
4 for 1097–1461. DERIVED: 5 bits, N4 = 31 reaches 2116–2119; the field wraps after 2119.

The same section defines the GPS link: "TGPS – TGL = ΔΤ + τGPS , where ΔΤ is integer part, and τGPS
is fractional part of the difference between the system time scales expressed in seconds. Note. The
integer part ΔΤ is determined from GPS navigation message in user receiver".

### 4.5 Designator — is "GLONASST" used anywhere authoritative?

**Not found.** What the sources actually use:

| Source | Name for the scale | Meaning |
| --- | --- | --- |
| GLONASS ICD 5.1 §3.3.3 | "GLONASS time", symbol TГЛ / "TGL" | UTC(SU) + 3 h |
| BIPM Annual Report vol. 15 p. 49 | "'GLONASS time'"; "[UTC - GLONASS time] = 0 s + C1"; "[TAI - GLONASS time] = 37 s + C1" | UTC hours (3 h ignored) |
| BIPM Circular T 465 §4 | column "GLO" in "UTC-bUTC_GNSS" | broadcast UTC prediction |
| RINEX 4.02 §4.1.2, §5.2.8 | `GLO` "to identify the GLONASS UTC time" | **UTC hours, not +3 h** |

RINEX 4.02 §4.1.2, p. 15–16: "GLONASS time is basically running on UTC(SU) … i.e. the time tags are
given in UTC and not GPS time. It is not a continuous time, i.e. it introduces the same leap seconds
as UTC. The reported GLONASS time has the same hours as UTC and not UTC+3 h as the original GLONASS
System Time. RINEX uses GLO as system time identifier for the reported GLONASS time."

**Conflict to escalate (not decided here).** The ICD defines GLONASS system time as UTC(SU) + 3 h.
The two interchange authorities a GMT caller is most likely to be holding data from — RINEX and
BIPM — treat "GLONASS time" as UTC hours with leap seconds. MAR-16's verification line
"`utcToGnss('GLO', iso)` is exactly three hours ahead of UTC" follows the ICD; a caller who feeds it a
RINEX `GLO` time tag gets a 3-hour error. And `GLONASST` has no source at all. Options for the owner:
(a) keep the ICD meaning and pick a designator that is not `GLO` (no authoritative alphabetic one
exists; the ICD's only token is the symbol T_GL); (b) adopt the RINEX meaning under `GLO` and drop
the 3 h; (c) offer both as two distinct kinds. Rung that would decide it under the reviewer's
precedence: the ICD is the system's own definition; RINEX is the IGS/RTCM interchange standard. Both
are standards, so this is the "genuinely conflict" case.

> **Decided — not used (MAR-16 spec, D10).** GMT's `GLO` follows RINEX 4.02 and BIPM (UTC hours,
> with UTC's leap seconds). The ICD's UTC(SU) + 3 h scale and its N_T / N_4 counters (§4.1, §4.3,
> §4.4) are not implemented and are not cited as an authority; they stay here as evidence only.

---

## 5. IS-QZSS-PNT

- IS-QZSS-PNT-003 (November 5, 2018), cited by MAR-16:
  <https://qzss.go.jp/en/technical/download/pdf/ps-is-qzss/is-qzss-pnt-003.pdf>
- **IS-QZSS-PNT-006 (July 11, 2024), latest**, PRIMARY:
  <https://qzss.go.jp/en/technical/download/pdf/ps-is-qzss/is-qzss-pnt-006.pdf>
  (listed on <https://qzss.go.jp/en/technical/ps-is-qzss/ps-is-qzss.html>)

The time-system wording is identical in 003 (§5.1, p. 112, PDF 120) and 006 (§5.1, p. 120, PDF 130):

> "(a) Length of 1 second — The length of 1 second in QZSST shall be identical to the International
> Atomic Time (TAI).
> (b) Offset between QZSST and TAI — QZSST shall be delayed from TAI by 19 seconds.
> (c) Starting point of week number for QZSST — The starting point of the week number for QZSST
> shall be the same as the GPS time system (GPST), which is 0:00 am (UTC) on January 6, 1980."

Week number, LNAV — 006 §4.1.2.3(1), p. 46 (PDF 56); 003 same clause p. 42 (PDF 50):

> "In GPS, time is expressed in the format of week number and week time. Week number is counted from
> January 6th, 1980. This is 10-bit binary data (0-1024) that shall be modulo 1024 of each QZSS week
> number. QZSS week number increases at the start of every week epoch."

("(0-1024)" is in the ICD; a 10-bit field holds 0–1023.)

Week number, CNAV — 006 §4.2.2, p. 74 (PDF 84): "This is 13-bit binary data (0-8191) that shall be
modulo 8192 of each QZSS week number." **MAR-16's table gives QZSS only the 10-bit counter; QZSS
also broadcasts the 13-bit CNAV/CNAV-2 week, exactly as GPS does.**

QZSS is the only one of the five ICDs that states its TAI offset itself.

---

## 5a. NavIC (IRN)

Retrieved 2026-10-15. Both ICDs are linked from ISRO's "Satellite Navigation Services" page
(<https://www.isro.gov.in/SatelliteNavigationServices.html>), which lists no other SPS ICD editions.

- **ISRO-IRNSS-ICD-SPS-1.1**, "IRNSS Signal-in-Space ICD for SPS, Version 1.1, August 2017"
  (L5 and S bands), PRIMARY:
  <https://www.isro.gov.in/media_isro/pdf/SateliteNavigation/irnss_sps_icd_version1.1-2017.pdf>
- **ISRO-NAVIC-ICD-SPS-L1-1.0**, "NavIC Signal-in-Space ICD for SPS in L1 Frequency, Version 1.0,
  August 2023", PRIMARY:
  <https://www.isro.gov.in/media_isro/pdf/SateliteNavigation/NavIC_SPS_ICD_L1_final.pdf>

### 5a.1 Epoch

IRNSS SPS ICD 1.1 §5.7 IRNSS System Time, p. 15 (PDF 25):

> "The IRNSS System Time start epoch shall be 00:00 UT on Sunday August 22 nd 1999 (midnight
> between August 21 st and 22 nd). At the start epoch, IRNSS System Time shall be ahead of UTC by
> 13 leap seconds. (i.e. IRNSS time, August 22 nd 1999, 00:00:00 corresponds to UTC time August
> 21st 1999, 23:59:47)"

NavIC L1 ICD 1.0 §5.6 NavIC System Time, p. 34 (PDF 45), has the same sentence with "NavIC" for
"IRNSS":

> "The NavIC System Time start epoch shall be 00:00 UT on Sunday August 22nd 1999 (midnight between
> August 21st and 22nd). At the start epoch, NavIC System Time shall be ahead of UTC by 13 leap
> seconds. (i.e. NavIC time, August 22 nd 1999, 00:00:00 corresponds to UTC time August 21st 1999,
> 23:59:47)"

The first sentence says "00:00 UT" on the 22nd, but the worked example puts the epoch at
1999-08-21T23:59:47 UTC. The example is the one consistent with "ahead of UTC by 13 leap seconds",
with RINEX (§5a.6) and with GPS week 1024. Read "00:00 UT" as the label on the NavIC scale.

**Name of the scale:** the ICDs call it "IRNSS System Time" (1.1) and "NavIC System Time" (L1 1.0).
RINEX calls it "IRNSST". **IRNWT is not a time scale.** It is the "IRNSS Network Timing (IRNWT)
Facility" (L1 ICD §2.3, p. 3). ICD 1.1 §6.2.1.1, p. 29, says: "IRNSS Time is the reference time
generated by IRNWT located at INC." So "TAI − IRNWT" in the brief should read TAI − IRNSST.

### 5a.2 Week number, rollover and time of week

**L5/S (ICD 1.1)** — §5.7, p. 15:

> "The IRNSS system time is given as 27-bit binary number composed of two parameters as follows: The
> Week Number is an integer counter that gives the sequential week number from the origin of the
> IRNSS time. This parameter is coded on 10 bits appearing in the first subframe, which covers 1024
> weeks (about 19 years)."

> "The Time of Week Count (TOWC) indicates the number of 12 second counts at which the next subframe
> will begin. It is represented in 17 bits. The TOW count value ranges from 1 to 50400 to cover one
> entire week. The Time Of Week (TOW) in seconds is obtained by multiplying TOWC with 12. The TOWC
> will have a value of 1 at 00:00:00 Sunday (Changeover from Saturday to Sunday)."

§6.2.1.1 Week Number (WN), p. 29: "This parameter is coded in 10 bits which covers 1024 weeks (about
19 years)." Table on p. 19: "Week Number WN 1 10 week". §5.9.1.2, p. 16: TOWC "is multiplied with 12
to obtain the time in seconds corresponding to the start of the next subframe."

So the broadcast TOW is in 12 s steps. 50400 × 12 = 604,800 s, and TOWC marks the start of the
*next* subframe. A whole-second TOW of 0–604,799 is DERIVED; the ICD does not print it.

**L1 (ICD L1 1.0)** — §5.6, p. 34:

> "The NavIC system time is given as 30-bit binary number composed of three parameters as follows:
> The Week Number is an integer counter that gives the sequential week number from the origin of the
> NavIC time. This parameter is coded on 13 bits appearing in the second subframe, which covers 8192
> weeks."

> "The Interval Time of Week (ITOW), represented in 8 bits, identifies the start time of the 2 hour
> interval since the beginning of the NavIC week.. This parameter appears in Subframe 2. Time of
> Interval (TOI) is the count of the number of 18 sec message intervals in each 2 hour ITOW. The TOI
> is represented in 9 bits."

§6.2.1.1–6.2.1.3, p. 45 (PDF 56): "The TOI count range is from 1 (000000001) to 400 (110010000)";
"This parameter is coded in 13 bits which covers 8192 weeks (about 157.53 years)"; "the range of the
ITOW-count is from 0 to 83 2-hour epochs (equaling one week)". DERIVED: 84 × 7200 s = 604,800 s and
400 × 18 s = 7200 s. (The ICD's "about 157.53 years" is its own arithmetic; 8192 weeks is 157.0
Gregorian years.)

### 5a.3 Continuous — no leap seconds

**Neither ICD uses the word "continuous"** (0 occurrences in either text). That NavIC time does not
apply leap seconds is DERIVED from three primary statements:

1. The epoch is stated as "ahead of UTC by 13 leap seconds" — an offset counted in leap seconds only
   makes sense for a scale that does not apply them.
2. Both ICDs broadcast a leap-second count and convert to UTC with it. ICD 1.1 Message Type 9,
   §6.1.3.3, Table 16, p. 24: "Current or past leap second count ∆tLS 1 8* sec" and "Current or
   future leap second count ∆tLSF 1 8* sec". Appendix F.1, p. 54: "tUTC = (tE - ∆tUTC) [modulo 86400
   seconds]", "∆tUTC = ∆tLS + A0utc + A1utc (tE - toutc + 604800(WN - WNoutc)) + A2utc(...)²". The L1
   ICD has the same algorithm in Appendix F.1, p. 71, with "Whenever a leap second event is
   encountered, the user equipment must consistently implement carries or borrows into any
   year/week/day counts."
3. RINEX 4.02 Table 1 puts IRN equal to GPS: "GPS = IRN = UTC + ΔtLS" (§5a.6).

### 5a.4 Relation to TAI, UTC and GPS

- **TAI − IRNSST is not stated in any primary source I reached.** Neither ICD mentions TAI
  (0 occurrences). BIPM publishes no NavIC row (§5a.5).
- **DERIVED:** the ICD puts the epoch at 1999-08-21T23:59:47 UTC, with NavIC time 13 s ahead of UTC.
  TAI − UTC was 32 s then (`Leap_Second.dat`: "51179.0 1 1 1999 32"). TAI − IRNSST = 32 − 13 =
  **19 s**, the same as GPS. Temporal check: `taiMinusUtc(Instant.from('1999-08-21T23:59:47Z')) − 13`
  = 19.
- **NavIC week 0 = GPS week 1024** (Temporal:
  `Instant.from('1999-08-22T00:00:00Z').since(gpsEpoch).total('seconds') / 604800` = 1024).
- **The GPS offset the ICD broadcasts is sub-microsecond** (DERIVED, as for Galileo). ICD 1.1 Table
  16: "Bias coefficient of IRNSS time scale relative to GPS time scale A0 2-35 16* sec". 16 bits ×
  2⁻³⁵ s gives at most ±2⁻²⁰ s ≈ ±0.95 µs, so NavIC and GPS share whole seconds. The L1 ICD Message
  Type 17 (§6.1.3.5, Table 19, p. 44) carries "A0gnss 2-35 16*" for GPS, Galileo and GLONASS, and
  Appendix F.2 gives "tGNSS = tE – (A0gnss + A1gnss(tE – tug + 604800 (WN – WNug)))".
- **UTC reference:** RINEX 4.02 §4.1.6: IRNSST "is steered to UTC(NPLI)". RINEX Table 27: "NavIC IRUT
  UTCIRN / UTC(NPLI)". ICD 1.1 Message Type 9 note: Message Type 26 "shall transmit IRNSS time offset
  with respect to UTC (NPLI) and other GNSS".

### 5a.5 BIPM — no NavIC row

- **Circular T 465** (2026-10-12), §4 "Relations of UTC with predictions of UTC broadcast by GNSS":
  columns "GPS GLO GAL BDS" only. "NavIC", "IRNSS" and "IRN" occur 0 times.
- **Explanatory supplement v0.8**, Section 4: "bUTCGNSS represents the prediction of UTC broadcast by
  an individual GNSS, named GPS/GLO/GAL/BDS". No NavIC.
- **`utc-gnss` directory** (<https://webtai.bipm.org/ftp/pub/tai/other-products/utcgnss/>): files
  `utc-bds`, `utc-gal`, `utc-glo`, `utc-gnss`, `utc-gps`. No NavIC file. The integer-second header
  lists GPS, GLONASS, Galileo and BeiDou only.
- **Annual Report on Time Activities vol. 15 (2020):** "NavIC" and "IRNSS" occur 0 times.

**BIPM publishes no UTC − NavIC relation.** Unlike TAI − GPS, TAI − GST and TAI − BDT, the 19 s for
NavIC rests on the ICD epoch plus the IERS table, plus RINEX Table 1.

### 5a.6 RINEX 4.02

§4.1.6 NavIC System Time, p. 16 (PDF 17):

> "NavIC runs on Indian Regional Navigation Satellite System Time (IRNSST) which is steered to
> UTC(NPLI). The IRNSST start epoch is 00:00:00 on Sunday August 22nd, 1999, which corresponds to
> August 21st, 1999, 23:59:47 UTC (same time as the first GPS week roll over). Seconds of week are
> counted from 00:00:00 IRNSST hours Saturday/Sunday midnight which also corresponds to the start of
> the GPS week. Week numbers are consecutive from the start time and will roll over after week 1023
> (at the same time as GPS and QZSS roll over). RINEX uses IRN as the system time identifier for the
> reported NavIC time."

§4.1.7, Table 1 "Constellation Time Relationships", p. 17 (the extracted text puts the table body
after Table 2):

> "GLO = UTC = GPS - ΔtLS / GPS = GAL = UTC + ΔtLS / GPS = QZS = UTC + ΔtLS / GPS = IRN = UTC + ΔtLS /
> BDT = UTC + ΔtLSBDS"

§4.1.7 text: "Apart from the small, sub-microsecond differences, in the realizations of the different
system times, the GNSS time scales differ from UTC and each other by integer seconds."

§4.1.8 Table 3, p. 18: the "NavIC Broadcast" row restarts at 0 in GPS period #2 (GPS weeks
1024–2047), and the RINEX row "GPS/QZS/IRN/GAL RINEX" runs on from 1024. Table A30 (NavIC LNAV
record), p. 109: "IRN Week # (to go with TOE) Continuous number, not mod (1024), counted from 1980
(same as GPS)." **So a RINEX file's IRN week is a GPS week number, not the NavIC broadcast count.**

§5.2.8, p. 25: "IRN to identify NavIC time". Navigation header TIME SYSTEM CORR codes: "NavIC IR IRUT
IRGP IRGL IRGA IRBD IRQZ".

RINEX 4.02 §4.1.6 mentions only the 10-bit rollover. The 13-bit L1 week is not discussed there,
though RINEX 4.02 adds the L1NV message (Table A31).

### 5a.7 Rollover dates — Temporal

Same method as §8, with TAI − IRNSST = 19 (DERIVED, §5a.4) and the NavIC epoch label
1999-08-22T00:00:00:

| Counter | Week | NavIC-time label | UTC instant | IRN − UTC |
| --- | --- | --- | --- | --- |
| — | 0 (epoch) | 1999-08-22T00:00:00 | 1999-08-21T23:59:47Z (ICD example) | 13 s |
| L5/S, 10 bits | 1024 (1st wrap) | **2019-04-07T00:00:00** | **2019-04-06T23:59:42Z** | 18 s |
| L5/S, 10 bits | 2048 (2nd wrap) | 2038-11-21T00:00:00 | 2038-11-20T23:59:42Z | 18 s (if TAI − UTC stays 37) |
| L1, 13 bits | 8192 (1st wrap) | **2156-08-22T00:00:00** | **2156-08-21T23:59:42Z** | 18 s (same proviso) |

All are Sundays in NavIC time (`dayOfWeek` = 7). The 10-bit wraps coincide with GPS weeks 2048 and
3072. That matches RINEX: "will roll over after week 1023 (at the same time as GPS and QZSS roll
over)". The first NavIC wrap has already happened, on the same instant as the second GPS LNAV wrap.

---

## 6. IERS Bulletin C and the leap-second files

All retrieved 2026-10-15.

### 6.1 The table (IERS `Leap_Second.dat`, PRIMARY)

<https://hpiers.obspm.fr/iers/bul/bulc/Leap_Second.dat> — header: "Updated through IERS Bulletin 72
issued in July 2026", "File expires on 28 June 2027".

The IANA tzdb copy <https://data.iana.org/time-zones/tzdb/leap-seconds.list> is byte-identical in its
data and validity lines to the IERS copy <https://hpiers.obspm.fr/iers/bul/bulc/ntp/leap-seconds.list>
(same `#h a9bad145 84c31c70 758402aa b37bfd54 5923836a`).

TAI − UTC on 1972-01-01 is 10 s (the initial integer offset, not an insertion). Then 27 insertions,
each at 23:59:60 on the last day before the date the new value takes effect (insertion instant
DERIVED with Temporal: `PlainDate.from(effective).subtract({ days: 1 })`):

| # | Inserted second (UTC) | New value effective | TAI − UTC (s) |
| --- | --- | --- | --- |
| — | — | 1972-01-01 | 10 |
| 1 | 1972-06-30T23:59:60Z | 1972-07-01 | 11 |
| 2 | 1972-12-31T23:59:60Z | 1973-01-01 | 12 |
| 3 | 1973-12-31T23:59:60Z | 1974-01-01 | 13 |
| 4 | 1974-12-31T23:59:60Z | 1975-01-01 | 14 |
| 5 | 1975-12-31T23:59:60Z | 1976-01-01 | 15 |
| 6 | 1976-12-31T23:59:60Z | 1977-01-01 | 16 |
| 7 | 1977-12-31T23:59:60Z | 1978-01-01 | 17 |
| 8 | 1978-12-31T23:59:60Z | 1979-01-01 | 18 |
| 9 | 1979-12-31T23:59:60Z | 1980-01-01 | 19 |
| 10 | 1981-06-30T23:59:60Z | 1981-07-01 | 20 |
| 11 | 1982-06-30T23:59:60Z | 1982-07-01 | 21 |
| 12 | 1983-06-30T23:59:60Z | 1983-07-01 | 22 |
| 13 | 1985-06-30T23:59:60Z | 1985-07-01 | 23 |
| 14 | 1987-12-31T23:59:60Z | 1988-01-01 | 24 |
| 15 | 1989-12-31T23:59:60Z | 1990-01-01 | 25 |
| 16 | 1990-12-31T23:59:60Z | 1991-01-01 | 26 |
| 17 | 1992-06-30T23:59:60Z | 1992-07-01 | 27 |
| 18 | 1993-06-30T23:59:60Z | 1993-07-01 | 28 |
| 19 | 1994-06-30T23:59:60Z | 1994-07-01 | 29 |
| 20 | 1995-12-31T23:59:60Z | 1996-01-01 | 30 |
| 21 | 1997-06-30T23:59:60Z | 1997-07-01 | 31 |
| 22 | 1998-12-31T23:59:60Z | 1999-01-01 | 32 |
| 23 | 2005-12-31T23:59:60Z | 2006-01-01 | 33 |
| 24 | 2008-12-31T23:59:60Z | 2009-01-01 | 34 |
| 25 | 2012-06-30T23:59:60Z | 2012-07-01 | 35 |
| 26 | 2015-06-30T23:59:60Z | 2015-07-01 | 36 |
| 27 | 2016-12-31T23:59:60Z | 2017-01-01 | 37 |

NTP-second column (from `leap-seconds.list`, seconds since 1900-01-01): 2272060800 … 3692217600;
Temporal check: `Instant.from('1900-01-01T00:00:00Z').add({ seconds: 2272060800 })` →
`1972-01-01T00:00:00Z`.

Confirms SPA-48: 27 insertions; final value 37; last 2016-12-31. Counting insertions in
(2000-01-01, 2024-01-01] gives **5** and in (2020-01-01, 2024-01-01] gives **0** (Temporal script) —
SPA-48's corrected Verification values are right.

### 6.2 Latest Bulletin C (PRIMARY)

<https://hpiers.obspm.fr/iers/bul/bulc/bulletinc.dat> — **Bulletin C 72, "Paris, 06 July 2026"**:

> "NO leap second will be introduced at the end of December 2026. The difference between Coordinated
> Universal Time UTC and the International Atomic Time TAI is : from 2017 January 1, 0h UTC, until
> further notice : UTC-TAI = -37 s"
> "Bulletin C is mailed every six months, either to announce a time step in UTC, or to confirm that
> there will be no time step at the next possible date."

BIPM Circular T 465 (2026 October 12) agrees: "From 2017 January 1, 0h UTC, TAI-UTC = 37 s."
<https://webtai.bipm.org/ftp/pub/tai/Circular-T/cirt/cirt.465>

### 6.3 Expiry fields (drive `isTableStale`)

`leap-seconds.list` (IERS and IANA copies), PRIMARY:

- `#$ 3992312697` — last update, NTP seconds → **2026-07-06T07:44:57Z** (Temporal).
- `#@ 4023129600` — expiry, NTP seconds → **2027-06-28T00:00:00Z** (Temporal); text: "File expires on
  28 June 2027".
- The file says the expiry is given "on a semi-annual basis: last June or last December".

`Leap_Second.dat`: "File expires on 28 June 2027". Both agree.

Recommended `tableProvenance()` values from the bundled data as of today: `source` = IERS
`Leap_Second.dat` / `leap-seconds.list`; `bulletin` = "IERS Bulletin C 72 (Paris, 2026-07-06)";
`validUntil` = **2027-06-28** (the file's own expiry, not a date computed by GMT). The next Bulletin C
(73) is due in early January 2027.

### 6.4 Every Bulletin C since the last insertion (PRIMARY)

Fetched `https://datacenter.iers.org/data/16/bulletinc-NNN.txt` for NNN = 052–073:

| No. | Dated | Announcement |
| --- | --- | --- |
| 52 | Paris, 6 July 2016 | "A positive leap second will be introduced at the end of December 2016." |
| 53–72 | 9 Jan 2017 … 06 Jul 2026, every six months | "NO leap second will be introduced at the end of [June/December] …" |
| 73 | — | 404 (not yet issued) |

**No Bulletin C after 2016 announces an insertion.** In 2026: No. 71 (06 January 2026, none at end of
June 2026) and No. 72 (06 July 2026, none at end of December 2026). The 2026 change is the CGPM
decision in §7.3, not a leap second.

---

## 7. ITU-R TF.460-6 and the CGPM resolutions

### 7.1 ITU-R TF.460-6 (02/2002), in force — PRIMARY

<https://www.itu.int/dms_pubrec/itu-r/rec/tf/R-REC-TF.460-6-200202-I!!PDF-E.pdf> ("TF.460-6 (02/2002)
In force", <https://www.itu.int/rec/R-REC-TF.460/en>)

Annex 1, C, p. 2: "UTC … corresponds exactly in rate with TAI but differs from it by an integer number
of seconds. The UTC scale is adjusted by the insertion or deletion of seconds (positive or negative
leap-seconds) to ensure approximate agreement with UT1."

Annex 1, §2 Leap-seconds, p. 3:

> "2.1 A positive or negative leap-second should be the last second of a UTC month, but first
> preference should be given to the end of December and June, and second preference to the end of
> March and September.
> 2.2 A positive leap-second begins at 23h 59m 60s and ends at 0h 0m 0s of the first day of the
> following month. In the case of a negative leap-second, 23h 59m 58s will be followed one second
> later by 0h 0m 0s of the first day of the following month (see Annex 3).
> 2.3 The IERS should decide upon and announce the introduction of a leap-second, such an
> announcement to be made at least eight weeks in advance."

Annex 3, p. 5, Figures 3 and 4 date events as "30 June, 23h 59m 60.6s UTC" (positive) and "30 June,
23h 59m 58.9s UTC" (negative).

Note for SPA-48: TF.460-6 allows end of March and September as second preference, so "end of June or
December" is the preference, not the only legal date. IS-GPS-200N §20.3.3.5.2.4b says the same thing
from the receiver side ("unconventional time values of the form 23:59:60.xxx").

### 7.2 CGPM 2022 Resolution 4 — PRIMARY

<https://www.bipm.org/en/cgpm-2022/resolution-4> (DOI 10.59161/CGPM2022RES4E; official text is French)

> "decides that the maximum value for the difference (UT1-UTC) will be increased in, or before, 2035,"

It requested the CIPM to "propose a new maximum value for the difference (UT1-UTC) that will ensure
the continuity of UTC for at least a century" and to "draft a resolution including these proposals
for agreement at the 28th meeting of the CGPM (2026)". **It does not say "discontinue leap seconds".**

### 7.3 CGPM 2026 Resolution 5 — PRIMARY, adopted at the 28th CGPM (Versailles, 13–15 October 2026)

<https://www.bipm.org/en/cgpm-2026/resolution-5> (DOI 10.59161/CGPM2026RES5E; official text is
French). Title: "On the technical actions needed to ensure the continuity of UTC".

> "decides that
> continuous UTC will become effective on 20 May 2027,
> the maximum value for the difference |UT1-UTC| will be 3 600 seconds (1 hour), ensuring the long
> term continuity for UTC for several centuries,"

It also notes "the support and engagement of the IERS to take all necessary measures to change its
operational provision for, and its announcement of, leap seconds according to the CGPM resolutions".
The text matches Draft Resolution C (version 5, 13 July 2026),
<https://www.bipm.org/documents/20126/284836054/CGPM-2026-Draft-Resolutions.pdf>, and the CCTF report
on it, <https://www.bipm.org/documents/20126/284836054/CCTF-report-on-Draft-Resolution-C.pdf> ("to avoid
any risk, UTC should be made continuous by 2027").

**What this means for SPA-48 and MAR-16 (DERIVED, for the architect to weigh):**

- The IERS file itself already covers the gap: `leap-seconds.list` is declared valid to 2027-06-28,
  which is after 2027-05-20, and Bulletin C 72 rules out end of December 2026. On current primary
  text, TAI − UTC stays 37 s through the start of continuous UTC.
- After 20 May 2027 there are no more leap seconds of the kind the table records; the resolution
  allows |UT1 − UTC| to grow to 3600 s instead. How IERS will express that in Bulletin C and in the
  `#@` expiry field is **not yet published** — NOT REACHED, marked, not asserted.
- `nextLeapSecond` returning `null` is now right in principle, not just in practice.
- `isTableStale` should still key on the file's own expiry (2027-06-28), because GMT must not
  extrapolate the CGPM decision into a data file the IERS has not yet issued.
- GPS week rollover 2038-11-21 00:00:00 GPS = 2038-11-20T23:59:42Z UTC (§8) now rests on a CGPM
  decision rather than on "no leap second announced".

The SPA-48 bullet "A resolution has been adopted to discontinue leap seconds by 2035" should be
replaced by both resolutions as quoted above.

---

## 8. Week rollover dates — computed with Temporal

Script (scratchpad, not in the repo) imports `@js-temporal/polyfill` 0.5.1 from the workspace's pnpm
store and does:

```js
// System label for week W: epochLabel + W × 604800 s on the system's own continuous scale.
const label = Temporal.Instant.from(epoch).add({ seconds: week * 604800 });
// UTC instant: label − (TAI−UTC − TAI−SYS), iterating because TAI−UTC depends on the UTC date.
let u = label; for (let i = 0; i < 3; i++) u = label.subtract({ seconds: taiMinusUtc(u) - taiMinusSys });
```

with `taiMinusSys` = 19 (GPS, GAL, QZS) or 33 (BDS), and `taiMinusUtc` the §6.1 table. Output:

| System | Week | System-time label | UTC instant | System − UTC |
| --- | --- | --- | --- | --- |
| GPS | 0 | 1980-01-06T00:00:00 | 1980-01-06T00:00:00Z | 0 s |
| GPS | 1024 (1st LNAV wrap) | 1999-08-22T00:00:00 | **1999-08-21T23:59:47Z** | 13 s |
| GPS | 2048 (2nd LNAV wrap) | 2019-04-07T00:00:00 | **2019-04-06T23:59:42Z** | 18 s |
| GPS | 3072 (3rd LNAV wrap) | 2038-11-21T00:00:00 | **2038-11-20T23:59:42Z** | 18 s (if TAI − UTC stays 37) |
| GPS | 8192 (1st CNAV wrap) | 2137-01-06T00:00:00 | 2137-01-05T23:59:42Z | 18 s (same proviso) |
| GAL | 0 (GST start epoch) | 1999-08-22T00:00:00 | 1999-08-21T23:59:47Z | 13 s |
| GAL | 4096 (1st wrap) | **2078-02-20T00:00:00** | **2078-02-19T23:59:42Z** | 18 s (same proviso) |
| BDS | 0 | 2006-01-01T00:00:00 | 2006-01-01T00:00:00Z | 0 s |
| BDS | 8192 (1st wrap) | 2163-01-02T00:00:00 | 2163-01-01T23:59:56Z | 4 s (same proviso) |

Checks: GST week 0 = GPS week 1024 exactly (`(1999-08-22 − 1980-01-06) / 604800 = 1024`). BDT week 0
= GPS week 1356 (RINEX 4.02 §4.1.4 says the same). All wrap dates are Sundays in system time
(`PlainDate.dayOfWeek` = 7).

**Answer to "which UTC date is the rollover":** each GPS wrap happens at 00:00:00 GPS on a Sunday,
which is a few seconds **before** UTC midnight, on the **Saturday** UTC date: 1999-08-21 at
23:59:47 UTC, 2019-04-06 at 23:59:42 UTC, and 2038-11-20 at 23:59:42 UTC. MAR-16's UTC dates
(1999-08-21, 2019-04-06, 2038-11-20) are right. Primary confirmation for 1999: RINEX 4.02 §4.1.6:
"August 21st, 1999, 23:59:47 UTC (same time as the first GPS week roll over)"; RINEX §4.1.1: "The
first roll-over happened on August 22, 1999, 00:00:00 GPS time."

MAR-16 "Galileo's first 4096-week rollover is in 2078" — right; the exact date is
2078-02-20 00:00:00 GST. "BeiDou's 8192-week counter does not wrap this century" — right (2163).

MAR-16 Verification spot checks, recomputed: `utcToGnssWeek('2019-04-07T00:00:00Z', 'GPS')` → GPS
week 2048 → era 2 ✓. Same instant, GAL → GST week 1024 → era 0 ✓. BDS on 2024-01-01 → 37 − 33 = 4 s
ahead ✓. GPS before 2017-01-01 and on/after 2015-07-01 → 36 − 19 = 17 s ✓.

---

## 9. Scale designators

### 9.1 NAIF SPICE (PRIMARY)

- `str2et_c` (<https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/str2et_c.html>), Detailed_Input:
  "You may specify a time string belonging to any of the systems TDB, TDT, UTC." Examples: "1988 June
  13, 12:29:48 TDB", "… TDT", "… UTC".
- Time Required Reading (<https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/req/time.html>, "Last
  revised on 2021 DEC 23"), "Labels ( TDB, TT, and UTC )": "TT times are written as: 1988 June 13,
  12:29:48 TT"; "the system label may be placed anywhere in the time string".
- `timout_c`: output meta-markers "::TDB", "::TDT", "::TT", "::UTC", "::UTC±h:m".
- `unitim_c` (numeric conversion, not strings): "The uniform time scales are TAI, GPS, TT, TDT, TDB,
  ET, JED, JDTDB, JDTDT."

**So in SPICE time strings: `UTC`, `TDB`, `TT` (and deprecated `TDT`). `TAI` and `GPS` are not
string labels in SPICE.** SPICE has no GST, BDT, QZSST or GLONASS scale at all.

### 9.2 FITS 4.0 (IAU FITS Working Group, 2016; language-edited 2018) — PRIMARY

<https://fits.gsfc.nasa.gov/standard40/fits_standard40aa-le.pdf>, §9.2.1, Table 30 "Recognized Time
Scale Values", p. 38 (PDF 44): `'TAI'`, `'TT'`, `'TDT'` (deprecated), `'ET'`, `'IAT'` (deprecated),
`'UT1'`, `'UTC'`, `'GMT'`, `'GPS'` ("runs (approximately) synchronously with TAI; GPS ≈ TAI − 19 s"),
`'TCG'`, `'TCB'`, `'TDB'`, `'LOCAL'`. No GNSS scale other than GPS.

### 9.3 RINEX 3.05 (1 December 2020) and 4.02 (1 September 2025) — PRIMARY

<https://files.igs.org/pub/data/format/rinex305.pdf>, <https://files.igs.org/pub/data/format/rinex_4.02.pdf>
(IGS/RTCM RINEX Committee). §5.2.8 TIME OF FIRST OBS, RINEX 4.02 p. 25 (3.05 p. 25):

> "• GPS to identify GPS time • GLO to identify the GLONASS UTC time • GAL to identify Galileo time
> • QZS to identify QZSS time • BDT to identify BDS time • IRN to identify NavIC time"

RINEX has **no `TAI` or `UTC`** time-system identifier for observation time tags. The navigation
header's TIME SYSTEM CORR codes use `UT` for UTC (`GPUT`, `GLUT`, `GAUT`, `BDUT`, `QZUT`) and pairs
like `GAGP`, `BDGP`.

RINEX 4.02 §4.1.7 Table 1, p. 17: "GLO = UTC = GPS - ΔtLS", "GPS = GAL = UTC + ΔtLS",
"GPS = QZS = UTC + ΔtLS", "BDT = UTC + ΔtLSBDS".

#### 9.3.1 Which week each RINEX navigation record carries

Retrieved 2026-10-15 from the RINEX 4.02 and 3.05 PDFs above. Page numbers are the printed page;
the PDF page is one higher in both files.

**Summary.** Only BeiDou counts from its own epoch. GPS, QZSS, Galileo and NavIC records all carry
the continuous GPS week counted from 1980-01-06. BeiDou records carry the continuous BDT week
counted from 2006-01-01. That holds in both 4.02 and 3.05.

| System | Record (4.02) | Week field and the clause that defines it | Epoch of the week count |
| --- | --- | --- | --- |
| GPS | Table A9 GPS LNAV, BROADCAST ORBIT 5, p. 77 | "GPS Week # (to go with T_oe) Continuous number, not mod(1024)!" | 1980-01-06 |
| QZSS | Table A19 QZSS LNAV, BROADCAST ORBIT 5, p. 92 | "GPS Week # (to go with TOE) Continuous number, not mod(1024)!" — the field is named *GPS* week | 1980-01-06 |
| Galileo | Table A13 GALILEO INAV/FNAV, BROADCAST ORBIT 5, p. 84 | "GAL Week # (to go with TOE)", footnote 5*): see below | 1980-01-06 (GPS-aligned) |
| BeiDou | Table A23 BEIDOU D1/D2, BROADCAST ORBIT 5, p. 99 | "BDT Week #"; defined in §5.4.6, p. 41: see below | **2006-01-01** |
| NavIC | Table A30 NavIC LNAV, BROADCAST ORBIT 5, p. 109 | "IRN Week # (to go with TOE) Continuous number, not mod (1024), counted from 1980 (same as GPS)." | 1980-01-06 |

**Galileo agrees with Table 3.** Table A13, footnote 5*), p. 84:

> "The GAL week number is a continuous number, aligned to (and hence identical to) the continuous GPS
> week number used in the RINEX navigation message files. The broadcast 12-bit Galileo System Time
> (GST) week has a roll-over after 4095. It started at zero at the first GPS roll-over (continuous GPS
> week 1024). Hence GAL week = GST week + 1024 + n*4096 (n: number of GST roll-overs)."

§5.4.3, p. 41 says the same: "the GAL week in the RINEX navigation message files is a continuous
number; it has been aligned to the GPS week by the program creating the RINEX file." This matches
Table 3's "GPS/QZS/IRN/GAL RINEX" row (0–1023, 1024–2047, … continuing).

**BeiDou counts from 2006.** §5.4.6 "EPH Navigation messages for BDS (D1/D2, CNV1, CNV2, CNV3)",
p. 41:

> "The BDT week number is a continuous number. The broadcast 13-bit BDS System Time week has a
> roll-over after 8191. It starts at zero on: 1-Jan-2006, hence; BDT week = BDT week_BRD + (n*8192)
> (Where n: number of BDT roll-overs)."

Table 3 agrees. Its row is headed "BDS Broadcast and RINEX", meaning the broadcast and RINEX numbers
are the same, and starts "0(RINEX Week 1356)": BDT week 0 falls in GPS week 1356. Table A23 itself
has no footnote on the week; the definition sits in §5.4.6.

**Check against the standard's own examples (Temporal).**
- Table A27 BEIDOU example, p. 106: record `C05 2021 07 05 22 00 00` (D2) carries week
  `8.090000000000e+02` and Toe `1.656000000000e+05`.
  - Counted from 2006-01-01: `Instant.from('2021-07-05T22:00:00Z').since(Instant.from('2006-01-01T00:00:00Z'))`
    gives week **809** at 165600 s. This matches the record.
  - Counted from 1980-01-06 it would be week 2165.
- Table A14 GALILEO example, p. 85: record `E12 2020 09 15 00 40 00` (INAV) carries week
  `2.123000000000e+03` and Toe `1.752000000000e+05`.
  - Counted from 1980-01-06: week **2123** at 175200 s. This matches the record.
  - The GST broadcast count from 1999-08-22 would be 1099.

**Records with no week field.** None of these records has a week column:
- GPS CNAV and CNAV-2 (Tables A10, A11)
- QZSS CNAV and CNAV-2 (Tables A20, A21)
- BeiDou CNAV-1/2/3 (Tables A24–A26)
- NavIC L1NV (Table A31)

The week is implicit in the record's "SV / EPOCH / SV CLK" line. That line is a calendar date in the
system's own time: "Toc - Time of Clock (GPS) : - year (4 digits) - month, day, hour, minute, second"
(A10); "Toc - Time of Clock (BDT)" (A24); "Toc - Time of Clock (NavIC)" (A31). Footnote 3*) of A10,
p. 80, says to "refer to the week in the 'SV / EPOCH / SV CLK' line". The GPS CNAV `wn_op` field is
"GPS continuous week number" (A10, A11).

Defect in the standard: Table A31's footnote 3*), p. 112, says "refer to the reported week in
BROADCAST ORBIT 5", but A31's BROADCAST ORBIT 5 holds IDOT, Delta n0 dot, a spare and RSF — no week.
It looks like a copy of the A30 footnote. GLONASS records (Tables A15–A17) carry calendar-time
epochs in UTC(SU) and no week.

**RINEX 3.05 is the same.** Week fields, all PRIMARY:

| System | Table | Page | Week field |
| --- | --- | --- | --- |
| GPS | Table A6 GPS | p. 68 | "GPS Week # (to go with TOE) Continuous number, not mod(1024)!" |
| Galileo | Table A8 GALILEO | p. 70 | "GAL Week # (to go with TOE)" |
| QZSS | Table A12 QZSS | p. 76 | "GPS Week # (to go with TOE) Continuous number, not mod(1024)!" |
| BeiDou | Table A14 BDS | p. 78 | "BDT Week #" |
| NavIC | Table A18 NavIC/IRNSS | p. 82 | "IRN Week # (to go with TOE) Continuous number, not mod (1024), counted from 1980 (same as GPS)." |

Two 3.05 footnotes:
- Galileo, Table A8 footnote *****), p. 71, has the same "GAL week = GST week + 1024 + n*4096"
  wording as 4.02.
- BeiDou, Table A14 footnote ***), p. 79: "The BDT week number is a continuous number. The broadcast
  13-bit BDS System Time week has a roll-over after 8191. It started at zero at 1-Jan-2006, Hence BDT
  week = BDT week_BRD + (n*8192)". §5.4.5, p. 40, repeats it.

3.05 states the BeiDou rule inside the table; 4.02 moved it to §5.4.6.

**For `rinexWeekToUtc(system, week, tow)` (DERIVED):**
- For GPS, QZS, GAL and IRN, the week is counted from the GPS epoch, so 1980-01-06 is the epoch label
  on each system's own continuous scale. All four share the GPS integer second (TAI − scale = 19 s).
- For BDS (record time token `BDT`), the week is counted from the 2006-01-01 epoch label on BDT
  (TAI − BDT = 33 s).
- None of the five needs a rollover era, because RINEX has already unwrapped the count. The BDS rule
  "BDT week_BRD + (n*8192)" only bites in 2163.

### 9.4 Recommendation per scale (most authoritative source that defines a token)

| Scale | Token | Authority | Note |
| --- | --- | --- | --- |
| TAI | `TAI` | FITS 4.0 Table 30; SPICE `unitim_c`; BIPM usage | Not a SPICE string label — cite FITS, not "SPICE-style" |
| UTC | `UTC` | SPICE `str2et_c`; FITS 4.0 | |
| TT | `TT` | SPICE Time Required Reading; FITS 4.0 | `TDT` is deprecated in both |
| TDB | `TDB` | SPICE `str2et_c`; FITS 4.0 | |
| GPS time | `GPS` | RINEX §5.2.8; FITS 4.0; SPICE `unitim_c` | All agree |
| Galileo GST | `GST` (ICD) or `GAL` (RINEX) | ICD §5.1.2 names the scale "GST"; RINEX token is `GAL` | MAR-16 picks `GST`; that is the ICD's own acronym |
| BeiDou BDT | `BDT` | ICD §3.3; RINEX §5.2.8 | Both agree. Note MAR-16's `GnssSystem` uses `'BDS'`, which is the constellation name (BIPM Circular T column), not the RINEX time token |
| QZSS | `QZSST` (ICD) or `QZS` (RINEX) | IS-QZSS-PNT §5.1; RINEX §5.2.8 | |
| NavIC | `IRN` | RINEX 4.02 §4.1.6, §5.2.8 | ICDs name the scale "IRNSS System Time" / "NavIC System Time"; RINEX names it IRNSST. `IRNWT` is a timing facility, not a scale |
| GLONASS | `GLO` (decided, MAR-16 D10) | RINEX `GLO` = UTC hours; the ICD's T_GL = UTC(SU)+3 h is not used | `GLONASST` has no source; see §4.5 |

MAR-16 calls `GnssSystem` "the RINEX system letters spelled out". RINEX's system letters are single
characters (G, R, E, C, J, I, S); its three-letter time tokens are `GPS GLO GAL QZS BDT IRN`. Only
`'BDS'` in the proposed union departs from RINEX.

---

## 10. Pre-1972 UTC

BIPM *Annual Report on Time Activities* vol. 15 (2020), Table 2 "Relationship between TAI and UTC",
p. 15, PRIMARY:

> "1961 Jan. 1 - 1961 Aug. 1  1.422 8180 + (MJD - 37300) × 0.001 296"
> …
> "1968 Feb. 1 - 1972 Jan. 1  4.213 1700 + (MJD - 39126) × 0.002 592"
> "1972 Jan. 1 - 1972 Jul. 1  10 (integral number of seconds)"

IERS `UTC-TAI.history` (<https://hpiers.obspm.fr/iers/bul/bulc/UTC-TAI.history>) carries the same
rows. Before 1972-01-01 TAI − UTC was a fractional value with a per-day rate term, so **integer
leap-second offsets do not apply**. SPA-46 and SPA-48 returning the sentinel before 1972 is consistent
with BIPM. (ITU-R TF.460-6 does not define pre-1972 UTC.)

---

## 11. Corrections to the issue files

### MAR-16

1. **Sign error:** "TAI − GST (−19 s)" → TAI − GST = **+19 s**. (§2.5)
2. "the ICDs do not restate TAI − GST or TAI − BDT … the JSDoc says they are derived" — true of the
   ICDs, but **BIPM states both** (`utc-gnss` header: "(19-xx) s", "(33-xx) s"). Cite BIPM; keep the
   epoch derivation as a cross-check. (§1.6, §3.4)
3. "TAI − GPS = 19 s is by definition" — not stated in IS-GPS-200N. Source: BIPM Annual Report vol. 15
   p. 48. (§1.6)
4. BDS citation: epoch and "SI seconds, rather than leap seconds" are **§3.3**, not §5.2.4.3–5.2.4.4.
   Latest edition is **BDS-SIS-ICD-B1I-3.0 (Feb 2019)**, whose wording is "accumulates continuously
   without leap seconds"; its BDT–UTC tolerance is 50 ns, not 100 ns. (§3.1)
5. Galileo: latest is **Issue 2.2 (Nov 2025)**; the quoted sentence is verbatim only in Issue 2.0, and
   the table is 62 in 2.0 but 69 in 2.2. (§2.1)
6. GLONASS: "UTC(SU) + 03 hours 00 min" is not verbatim; the ICD prints "TГЛ = TUTC (SU) + 03 hour 00
   mines". (§4.1)
7. GLONASS: the +3 h conversion conflicts with RINEX `GLO` and BIPM "GLONASS time" (both UTC hours).
   **Escalate.** `'… GLONASST'` has no authoritative source. (§4.5)
8. QZSS: latest is **IS-QZSS-PNT-006 (11 Jul 2024)**, same wording. QZSS also has a **13-bit,
   modulo-8192** CNAV week; the table lists only 10 bits. (§5)
9. "SPICE-style designator form SPA-46 uses (`'… GST'`, `'… BDT'`, `'… GLONASST'`)" — SPICE has none
   of these. (§9.1)
10. `GnssSystem` `'BDS'` is not a RINEX time token (`BDT` is). Minor. (§9.4)
11. Rollover instants are 13 s / 18 s **before** UTC midnight; the UTC dates in Key constants are
    right. Galileo's first wrap is 2078-02-20 00:00:00 GST. (§8)
12. The BIPM link cited for Key constants (`CCTF_UTC_presentation.pdf`) was not opened here; the
    Annual Report and `utc-gnss` file are the stronger citations.

13. **NavIC (IRN), added by the owner:** MAR-16's system table, `GnssSystem` union and Verification
    have no IRN row yet. Primary facts for it are in §5a. Points the spec must carry:
    - TAI − IRNSST = 19 s is **derived** (ICD epoch + IERS table; RINEX Table 1 agrees). Unlike GPS,
      Galileo and BeiDou, no BIPM statement backs it. The JSDoc must say so.
    - IRN has **two week widths**: 10 bits (L5/S, ICD 1.1) and 13 bits (L1, ICD L1 1.0). A single
      "the system's counter width" per system is not enough for IRN, nor for GPS and QZSS (§1.3–1.4, §5).
    - RINEX IRN week numbers are GPS weeks counted from 1980 (Table A30), **not** NavIC weeks from 1999.
      A caller passing a RINEX IRN week to a NavIC-epoch decoder is 1024 weeks off.
    - NavIC broadcast TOW is coarse: TOWC × 12 s (L5/S), or ITOW × 2 h + TOI × 18 s (L1). A
      whole-second time of week is derived, not broadcast.
    - The brief's "TAI − IRNWT" names the timing facility. The scale is IRNSST.

### SPA-48

1. "A resolution has been adopted to **discontinue leap seconds by 2035**" — wrong. 2022 Res. 4
   decided the maximum |UT1 − UTC| "will be increased in, or before, 2035". **2026 Res. 5 (adopted
   13–15 Oct 2026) decides "continuous UTC will become effective on 20 May 2027"** with a 3600 s
   maximum. (§7)
2. "IERS announces insertions roughly six months ahead via Bulletin C" — Bulletin C is issued every six
   months; ITU-R TF.460-6 §2.3 requires "at least eight weeks in advance". Cite TF.460-6 for the rule.
3. "Insertions occur preferentially at the end of June or December" — right, but TF.460-6 §2.1 also
   allows end of March and September as second preference, and any month-end. The table lookup in
   `isLeapSecond` already covers this.
4. Provenance values today: Bulletin C 72 (Paris, 06 July 2026); `validUntil` 2027-06-28. (§6.3)
5. Everything else checks: 27 insertions, last 2016-12-31, TAI − UTC 37, 0 between 2020 and 2024, 5
   between 2000 and 2024, sentinel before 1972.

### SPA-46

1. "SPICE-style scale designators `'… TAI'`, `'… GPS'`" — SPICE strings accept only UTC, TDB, TT/TDT.
   Re-cite the tokens to **FITS 4.0 Table 30** (and SPICE `unitim_c` for the scale names). (§9)
2. "TAI − GPS = +19 seconds, exactly and permanently, by definition" — BIPM: "19 s + C0", C0 "of the
   order of tens of nanoseconds". Exact in the integer part only.
3. The BIPM presentation and timetoolsltd.com links in Key constants: the second is a vendor page and
   cannot be an authority; replace with BIPM Annual Report vol. 15 and the `utc-gnss` file.
4. TAI64 example consistency: TAI − UTC on 1992-06-02 is 26 s (1991-01-01 row), which matches
   Bernstein's "08:07:09 TAI, also known as 1992-06-02 08:06:43 UTC". Bernstein's page was not
   re-fetched here.

---

## 12. Authority table rows (for the architect)

| Rule | Source clause |
| --- | --- |
| GPS time zero is midnight 5/6 Jan 1980 UTC(USNO); GPS time is continuous (no leap seconds) | IS-GPS-200N §3.3.4, p. 37 |
| GPS week number never resets; broadcast values may be truncated | IS-GPS-200N §6.2.4, p. 47 |
| LNAV week is 10 bits, modulo 1024 | IS-GPS-200N §20.3.3.3.1.1, p. 93 |
| CNAV week is 13 bits, modulo 8192 | IS-GPS-200N §30.3.3.1.1.1, p. 159 |
| GPS TOW counts 0–403,199 X1 epochs (1.5 s), week = 604,800 s | IS-GPS-200N §3.3.4(a), pp. 37–38 |
| tUTC = tE − ΔtUTC (mod 86400); ΔtUTC = ΔtLS + A0 + A1(…); 23:59:60.xxx occurs at insertion | IS-GPS-200N §20.3.3.5.2.4, pp. 126–128 |
| TAI − GPS time = 19 s + C0 (C0 ~ tens of ns) | BIPM Annual Report on Time Activities vol. 15 (2020), p. 48 |
| Integer UTC − GPS = 19 − (TAI−UTC); UTC − GAL = 19 − (TAI−UTC); UTC − BDT = 33 − (TAI−UTC); UTC − GLONASS = 0 | BIPM `utc-gnss` file header (2024) |
| GST start epoch 13 s before 1999-08-22T00:00:00 UTC; GST = 13 s at that midnight | Galileo OS SIS ICD Issue 2.0 §5.1.2 p. 45 (Issue 2.2 §5.1.2 p. 58, reworded) |
| GST week 12 bits, 4096 weeks, modulo 4096; TOW 0–604799 | Galileo OS SIS ICD Issue 2.0 §5.1.2, Table 62 (2.2: Table 69) |
| GST is a continuous time scale | Galileo OS SIS ICD Issue 2.0 §5.1.2 |
| GST − GPS broadcast offset is sub-microsecond (A0G 16 bits × 2⁻³⁵ s) | Galileo OS SIS ICD Issue 2.2 §5.1.8, Table 76, p. 64 |
| BDT epoch 2006-01-01T00:00:00 UTC; SI seconds, no leap seconds | BDS-SIS-ICD-B1I-3.0 §3.3, p. 3 (2.0 §3.3, pp. 2–3) |
| BDT week 13 bits, 0–8191, from 2006-01-01 00:00:00 BDT | BDS-SIS-ICD-B1I-3.0 §5.2.4.4, p. 25 |
| BDT SOW 20 bits, seconds since last Sunday 00:00:00 BDT | BDS-SIS-ICD-B1I-3.0 §5.2.4.3, p. 25 |
| GLONASS time = UTC(SU) + 3 h; corrected with UTC leap seconds — **not used (MAR-16 D10)** | GLONASS ICD Ed. 5.1 §3.3.3, p. 22 |
| N_T = day within four-year interval (0…1461), from 1 Jan of a leap year — **not used (MAR-16 D10)** | GLONASS ICD Ed. 5.1 §4.4, p. 32 |
| N_4 = four-year interval number from 1996 (1…31, 5 bits); Y = 1996 + 4(N4−1) + (J−1) — **not used (MAR-16 D10)** | GLONASS ICD Ed. 5.1 §4.5 p. 36; App. A.3.1.3 pp. 57–58 |
| QZSST is delayed from TAI by 19 s; week starts with GPST 1980-01-06 | IS-QZSS-PNT-006 §5.1, p. 120 |
| QZSS LNAV week 10 bits modulo 1024; CNAV 13 bits modulo 8192 | IS-QZSS-PNT-006 §4.1.2.3(1) p. 46; §4.2.2 p. 74 |
| NavIC epoch: NavIC 1999-08-22T00:00:00 = UTC 1999-08-21T23:59:47, NavIC ahead of UTC by 13 s | ISRO-IRNSS-ICD-SPS-1.1 §5.7, p. 15; ISRO-NAVIC-ICD-SPS-L1-1.0 §5.6, p. 34 |
| NavIC L5/S week: 10 bits, 1024 weeks; TOWC 17 bits, 1–50400, × 12 s | ISRO-IRNSS-ICD-SPS-1.1 §5.7 p. 15; §6.2.1.1 p. 29 |
| NavIC L1 week: 13 bits, 8192 weeks; ITOW 0–83 two-hour epochs; TOI 1–400 × 18 s | ISRO-NAVIC-ICD-SPS-L1-1.0 §5.6 p. 34; §6.2.1.1–6.2.1.3 p. 45 |
| NavIC → UTC via ΔtLS, A0utc, A1utc, A2utc (same three cases as GPS) | ISRO-IRNSS-ICD-SPS-1.1 Table 16 p. 24, App. F.1 p. 54; L1-1.0 App. F.1 p. 71 |
| NavIC − GPS broadcast offset is sub-microsecond (A0 16 bits × 2⁻³⁵ s) | ISRO-IRNSS-ICD-SPS-1.1 §6.1.3.3 Table 16, p. 24 |
| TAI − IRNSST = 19 s | **DERIVED**: ICD epoch (13 s) + IERS `Leap_Second.dat` (32 s on 1999-01-01); consistent with RINEX 4.02 Table 1 "GPS = IRN = UTC + ΔtLS". No BIPM statement |
| IRNSST steered to UTC(NPLI); RINEX token `IRN`; RINEX IRN week is the GPS week from 1980 | RINEX 4.02 §4.1.6 p. 16; §5.2.8 p. 25; Table A30 p. 109 |
| RINEX nav record week, GPS/QZSS: continuous GPS week from 1980, "not mod(1024)" | RINEX 4.02 Table A9 p. 77, Table A19 p. 92; RINEX 3.05 Tables A6 p. 68, A12 p. 76 |
| RINEX nav record week, Galileo: "GAL week = GST week + 1024 + n*4096", identical to the GPS week | RINEX 4.02 Table A13 fn 5*) p. 84, §5.4.3 p. 41; RINEX 3.05 Table A8 fn p. 71 |
| RINEX nav record week, BeiDou: BDT week from 1-Jan-2006, "BDT week = BDT week_BRD + (n*8192)" | RINEX 4.02 §5.4.6 p. 41, Table A23 p. 99, example Table A27 p. 106 (week 809 on 2021-07-05); RINEX 3.05 Table A14 fn p. 79 |
| RINEX nav record week, NavIC: "counted from 1980 (same as GPS)" | RINEX 4.02 Table A30 p. 109; RINEX 3.05 Table A18 p. 82 |
| CNAV/CNAV-2/BDS CNAV/NavIC L1NV records have no week field; week comes from the Toc calendar epoch | RINEX 4.02 Tables A10, A11, A20, A21, A24–A26, A31; A10 fn 3*) p. 80 |
| TAI − UTC table, 1972-01-01 = 10 s … 2017-01-01 = 37 s | IERS `Leap_Second.dat` (through Bulletin C 72) |
| Table validity ends 2027-06-28 | IERS/IANA `leap-seconds.list` `#@ 4023129600`; `Leap_Second.dat` header |
| No leap second at end of December 2026; TAI − UTC = 37 s until further notice | IERS Bulletin C 72, Paris, 06 July 2026 |
| Positive leap second is 23:59:60; negative: 23:59:58 followed by 00:00:00 | ITU-R TF.460-6 Annex 1 §2.2 |
| Leap seconds at month-end; first preference Dec/Jun, second Mar/Sep; ≥ 8 weeks' notice | ITU-R TF.460-6 Annex 1 §2.1, §2.3 |
| Max \|UT1 − UTC\| to be increased in or before 2035 | CGPM 2022 Resolution 4 |
| Continuous UTC effective 20 May 2027; max \|UT1 − UTC\| = 3600 s | CGPM 2026 Resolution 5 |
| Before 1972-01-01, TAI − UTC is fractional with a rate term (no integer offset) | BIPM Annual Report vol. 15, Table 2, p. 15 |
| Time-string labels: UTC, TDB, TT (TDT deprecated) | NAIF `str2et_c`; Time Required Reading |
| Time-scale tokens TAI, TT, TDB, UTC, GPS | FITS 4.0 §9.2.1 Table 30, p. 38 |
| GNSS time tokens GPS, GLO (= GLONASS UTC time), GAL, QZS, BDT, IRN | RINEX 4.02 §5.2.8, p. 25; RINEX 3.05 §5.2.8 |
| GLONASS designator for the ICD's UTC(SU)+3 h scale | **No source — not used (MAR-16 D10: GMT implements only RINEX `GLO`)** |

---

## 13. Not reached / not asserted

- GLONASS CDMA ICDs (2016, Russian) — not fetched; not needed for the FDMA L1/L2 clauses above.
- The issuing body's own copy of GLONASS ICD 5.1 — the UNAVCO mirror was used.
- The issuing body's own copy of BDS-SIS-ICD-2.0 — a university mirror was used; the official
  B1I 3.0 and B1C 1.0 were fetched from beidou.gov.cn.
- How IERS will word Bulletin C and the `#@` expiry once continuous UTC takes effect on 2027-05-20 —
  not yet published.
- The French official text of CGPM 2022 Res. 4 and 2026 Res. 5 — the English pages were used; both say
  the French is official.
- The BIPM `CCTF_UTC_presentation.pdf` cited in MAR-16/SPA-46/SPA-48 — not opened.
- NavIC: a primary statement of TAI − IRNSST. Not found in either ISRO ICD or any BIPM product
  (Circular T 465, its explanatory supplement, the `utcgnss` files, Annual Report vol. 15). The 19 s is
  derived, and marked so.
- NavIC: any ISRO SPS ICD for L5/S newer than version 1.1 (August 2017). ISRO's navigation page lists
  none.
- D. J. Bernstein's TAI64 page — not re-fetched (SPA-46 scope, outside this brief).
