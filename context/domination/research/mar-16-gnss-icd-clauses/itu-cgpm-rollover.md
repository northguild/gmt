# MAR-16 ICD clauses: ITU-R TF.460, CGPM resolutions and rollover dates

Part of the [MAR-16 GNSS ICD clauses index](../mar-16-gnss-icd-clauses.md).

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

