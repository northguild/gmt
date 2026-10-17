# MAR-16 ICD clauses: Galileo and BeiDou

Part of the [MAR-16 GNSS ICD clauses index](../mar-16-gnss-icd-clauses.md).

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

