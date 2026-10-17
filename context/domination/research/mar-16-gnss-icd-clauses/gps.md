# MAR-16 ICD clauses: GPS (IS-GPS-200)

Part of the [MAR-16 GNSS ICD clauses index](../mar-16-gnss-icd-clauses.md).

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

