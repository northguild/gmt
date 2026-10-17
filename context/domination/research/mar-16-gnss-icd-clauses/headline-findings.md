# MAR-16 ICD clauses: headline findings

Part of the [MAR-16 GNSS ICD clauses index](../mar-16-gnss-icd-clauses.md).

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
10. **All six systems are IMO-recognized WWRNS components, but IEC 61108 covers only five.** GPS and
    GLONASS: A.860(20) (1997). BeiDou: SN.1/Circ.329 (2014). Galileo: SN.1/Circ.334 (2016). IRNSS:
    SN.1/Circ.340 (2020). QZSS: SN.1/Circ.341 (2021). The policy is A.1046(27), whose annex was
    replaced by MSC.599(111) (22 May 2026); its §1.2 now says the WWRNS "includes global and regional"
    systems. IEC 61108 parts 1–7 have no QZSS part. See §9a.

---

