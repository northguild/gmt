# MAR-16 ICD clauses: authority table rows and items not reached

Part of the [MAR-16 GNSS ICD clauses index](../mar-16-gnss-icd-clauses.md).

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
| IMO policy for recognising radionavigation systems; MSC recognises systems meeting the annex | IMO res. A.1046(27), 30 Nov 2011, operative paras 1 and 4; annex §2.1 |
| WWRNS "includes global and regional radionavigation systems"; annex replaced in its entirety | IMO res. MSC.599(111), 22 May 2026, para. 1; annex §1.2 |
| GPS and GLONASS "offered and recognized" as WWRNS components | IMO res. A.860(20), 27 Nov 1997, annex §2.1.1.3, §2.1.2.2 (also A.915(22) annex §2.1) |
| BeiDou recognised as a WWRNS component (MSC 94) | IMO SN.1/Circ.329, 21 Nov 2014, para. 1 (text via imorules.com mirror) |
| Galileo recognised as a WWRNS component (MSC 96) | IMO SN.1/Circ.334, 20 May 2016, para. 1 (mirror) |
| IRNSS recognised as a WWRNS component (MSC 102), ocean waters 55°E–110°E, 50°N–5°S | IMO SN.1/Circ.340, 11 Nov 2020, paras 1–2 (mirror) |
| QZSS recognised as a WWRNS component (MSC 104) | IMO SN.1/Circ.341, 18 Oct 2021 (number/title/date via mirror; body not reached); IMO MSC 104 meeting summary (primary) |
| All six listed as recognised in one IMO text | IMO MSC 104 meeting summary, 4–8 Oct 2021 |
| Shipborne receiver standards per system: GPS 61108-1:2003, GLONASS 61108-2:1998, Galileo 61108-3:2010, DGPS/DGLONASS 61108-4:2004, BDS 61108-5:2020, NavIC/IRNSS 61108-6:2023, SBAS L1 61108-7:2024; none for QZSS | IEC webstore catalogue pages 4515, 4516, 4517, 4518, 61159, 67527, 68696 |
| Serial sentence interface, single talker / multiple listeners, printable ASCII, ≤ 79 characters | IEC 61162-1:2024 Ed. 6.0 (2024-04-04), webstore abstract |
| IEC 61162-1 ↔ NMEA 0183 alignment | **Not reached in a primary text** |
| GLONASS designator for the ICD's UTC(SU)+3 h scale | **No source — not used (MAR-16 D10: GMT implements only RINEX `GLO`)** |

---

## 13. Not reached / not asserted

- IMO's original 1990s circulars recognising GPS and GLONASS. The earliest primary statement reached
  is A.860(20) (1997).
- The body of SN.1/Circ.341 (QZSS). The mirror's body page returns 404. The recognition decision is
  confirmed by IMO's MSC 104 summary.
- IMO's own copies of SN.1/Circ.329, .334 and .340. Their text was read on the imorules.com licensed
  mirror.
- The text of IEC 61108-x and IEC 61162-1 (paywalled). Only catalogue pages and abstracts were read.
- A primary statement of the IEC 61162-1 ↔ NMEA 0183 relationship. The IEC previews were
  unobtainable, and NMEA's page does not mention IEC.
- Any IEC 61108 part for QZSS. None was found.
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
