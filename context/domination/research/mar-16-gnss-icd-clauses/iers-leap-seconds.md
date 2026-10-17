# MAR-16 ICD clauses: IERS Bulletin C and the leap-second files

Part of the [MAR-16 GNSS ICD clauses index](../mar-16-gnss-icd-clauses.md).

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

