# MAR-16 ICD clauses: GLONASS and QZSS

Part of the [MAR-16 GNSS ICD clauses index](../mar-16-gnss-icd-clauses.md).

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

