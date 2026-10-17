# MAR-16 ICD clauses: scale designators

Part of the [MAR-16 GNSS ICD clauses index](../mar-16-gnss-icd-clauses.md).

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

