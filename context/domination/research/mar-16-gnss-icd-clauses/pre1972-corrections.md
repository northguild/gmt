# MAR-16 ICD clauses: pre-1972 UTC and corrections to the issue files

Part of the [MAR-16 GNSS ICD clauses index](../mar-16-gnss-icd-clauses.md).

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

