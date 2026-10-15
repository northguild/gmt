# MAR-16 — Maritime: GNSS time scales — the RINEX world-standard set of six (GPS, Galileo, BeiDou, QZSS, GLONASS, NavIC) — and week rollover

**Scope:** GNSS time scales — the RINEX world-standard set of six (GPS, Galileo, BeiDou, QZSS, GLONASS, NavIC) — and week rollover: converting each system's time to UTC and back, and decoding the week and time-of-week pairs receivers emit.

GMT supports the world-standard set of six satellite time scales as peers: GPS, Galileo, BeiDou, QZSS, GLONASS and NavIC, by their RINEX 4.02 §5.2.8 identifiers. They are the systems the IMO recognises in the World-Wide Radionavigation System under Resolution A.1046(27) (BeiDou by SN.1/Circ.329, 2014), each with a shipborne receiver standard in the IEC 61108 series; the other recognition texts and the IEC part list were not reached — marked, not asserted. No system is a default and none has functions of its own.

## Gap

Maritime AIS, GNSS receivers and navigation systems report satellite system time, which for most constellations has no leap seconds. Port and commercial operations run on UTC. The offset between them is not constant — it grows by one second with every leap second — and raw receiver output carries a week number that has already wrapped.

The first draft covered GPS alone. A multi-constellation receiver (RINEX 3/4 observation files, NMEA `$GN…` sentences) tags observations with the system they came from, and each system has its own epoch, week counters and relationship to TAI. One row per RINEX 4.02 §5.2.8 time-system identifier, in RINEX's order:

| Token | Epoch and offset at the epoch | Week counter | Leap seconds | Source |
| --- | --- | --- | --- | --- |
| `GPS` | zero at "midnight on the night of January 5, 1980/morning of January 6, 1980"; GPS − UTC was 0 | LNAV 10 bits, modulo 1024; CNAV 13 bits, modulo 8192 | No — "a continuous time scale, while UTC is corrected periodically" | IS-GPS-200N §3.3.4, §20.3.3.3.1.1, §30.3.3.1.1.1 |
| `GLO` | GLONASS time as RINEX and BIPM report it: UTC hours, with UTC's leap seconds. No epoch is stated; GMT's lower bound is 1972-01-01T00:00:00Z, the first whole-second row of the leap-second table | none | **Yes** — "it introduces the same leap seconds as UTC" | RINEX 4.02 §4.1.2, §5.2.8; BIPM Annual Report on Time Activities vol. 15, p. 49 |
| `GAL` | "The GST start epoch is defined as 13 seconds before midnight between August 21st and August 22nd,1999, i.e.: GST was equal to 13 seconds on August 22nd, 1999 at 00:00:00 UTC." So GST is aligned with GPS time | 12 bits, "covers 4096 weeks (about 78 years)"; TOW 0–604799 | No — "a continuous time scale" | Galileo OS SIS ICD Issue 2.2 §5.1.2, Table 69 |
| `QZS` | "delayed from TAI by 19 seconds"; week counted from the GPS epoch, 1980-01-06; the same whole seconds as GPS time ("GPS = QZS = UTC + ΔtLS") | LNAV 10 bits, modulo 1024; CNAV 13 bits, modulo 8192 | No | RINEX 4.02 §4.1.7 Table 1; IS-QZSS-PNT-006 §5.1, §4.1.2.3(1), §4.2.2 |
| `BDT` | "The start epoch of BDT is 00:00:00 on January 1, 2006 of Coordinated Universal Time (UTC)"; BDT − UTC was 0 | 13 bits, "0 through 8191"; SOW 20 bits | No — "accumulates continuously without leap seconds" | BDS-SIS-ICD-B1I-3.0 §3.3 (epoch, continuity), §5.2.4.3–5.2.4.4 (SOW, week) |
| `IRN` | 00:00:00 IRNSST on 1999-08-22 = 1999-08-21T23:59:47Z, "ahead of UTC by 13 leap seconds". TAI − IRNSST = 19 s is **derived**: no ICD or BIPM statement gives it | L5/S 10 bits, modulo 1024; L1 13 bits, modulo 8192 | No (derived from the ICDs' leap-second broadcast and RINEX Table 1) | ISRO-IRNSS-ICD-SPS-1.1 §5.7; ISRO-NAVIC-ICD-SPS-L1-1.0 §5.6; RINEX 4.02 §4.1.6 |

TAI − GPS = 19 s, TAI − GST = **+19 s** and TAI − BDT = 33 s are stated by BIPM (Annual Report on Time Activities vol. 15, p. 48; `utc-gnss` file header), not by the ICDs, none of which mentions TAI except QZSS's. The ICD epochs and the leap-second table give the same values as a cross-check.

([IS-GPS-200N](https://www.navcen.uscg.gov/sites/default/files/pdf/gps/IS-GPS-200N.pdf), [Galileo OS SIS ICD Issue 2.2](https://www.gsc-europa.eu/sites/default/files/sites/all/files/Galileo_OS_SIS_ICD_v2.2.pdf), [BDS-SIS-ICD-B1I-3.0](http://en.beidou.gov.cn/SYSTEMS/ICD/201902/P020190227702348791891.pdf), [IS-QZSS-PNT-006](https://qzss.go.jp/en/technical/download/pdf/ps-is-qzss/is-qzss-pnt-006.pdf), [ISRO-IRNSS-ICD-SPS-1.1](https://www.isro.gov.in/media_isro/pdf/SateliteNavigation/irnss_sps_icd_version1.1-2017.pdf), [ISRO-NAVIC-ICD-SPS-L1-1.0](https://www.isro.gov.in/media_isro/pdf/SateliteNavigation/NavIC_SPS_ICD_L1_final.pdf), [RINEX 4.02](https://files.igs.org/pub/data/format/rinex_4.02.pdf), [FITS 4.0](https://fits.gsfc.nasa.gov/standard40/fits_standard40aa-le.pdf), [BIPM Annual Report on Time Activities vol. 15](https://webtai.bipm.org/ftp/pub/tai/annual-reports/bipm-annual-report/annual_report_2020.pdf), [BIPM `utc-gnss`](https://webtai.bipm.org/ftp/pub/tai/other-products/utcgnss/utc-gps))

## Scope

Six functions in `packages/gmt/src/gnss/convert/`, one per file, the same for every system. No function takes a table argument, and the system or counter is always the first argument.

- `gnssToUtc(system: GnssSystem, value: string): string` and `utcToGnss(system: GnssSystem, utcString: string): string` — a time-scale string of any of the six systems to a UTC instant string, and back.
- `gnssWeekToUtc(counter: GnssWeekCounter, week: number, timeOfWeekSeconds: number, rolloverEra: RolloverEra): string` and `utcToGnssWeek(counter: GnssWeekCounter, utcString: string): GnssWeek | null` — a broadcast week and time of week to UTC, and back.
- `rinexWeekToUtc(system: RinexWeekSystem, week: number, timeOfWeekSeconds: number): string` and `utcToRinexWeek(system: RinexWeekSystem, utcString: string): RinexWeek | null` — the continuous week a RINEX navigation record carries, to UTC and back.

The types live in `packages/gmt/src/types/gnss.ts`:

- `GnssSystem` is `'GPS' | 'GAL' | 'BDT' | 'QZS' | 'GLO' | 'IRN'`, the six RINEX 4.02 §5.2.8 time-system identifiers.
- `GnssWeekCounter` is `'GPS-LNAV' | 'GPS-CNAV' | 'GAL' | 'BDT' | 'QZS-LNAV' | 'QZS-CNAV' | 'IRN-LNAV' | 'IRN-L1NV'`: each member has exactly one modulus.
- `RolloverEra` is `number | 'rolling' | { notBefore: string }`, and `rolloverEra` is required.
- `GnssWeek` is `{ week, timeOfWeekSeconds, era }`; `RinexWeekSystem` is `'GPS' | 'GAL' | 'BDT' | 'QZS' | 'IRN'`; `RinexWeek` is `{ week, timeOfWeekSeconds }`.

`toTAI` / `fromTAI` (`packages/gmt/src/timescale/convert/`) and the time-scale string grammar are built here; the TAI64 labels stay in their own story.

The code lives in the `gnss/` and `timescale/` building-block namespaces; this story creates no `maritime/` namespace ([MAR-16 spec](../specs/MAR-16-spec.md), D13).

## String format

A time-scale string is an ISO 8601 extended local date-time, one space, and a token naming the scale: `'2026-01-01T00:00:37 TAI'`, `'2024-01-01T00:00:18 GPS'`. The tokens come from the standards that define them:

| Scale | Token | Authority |
| --- | --- | --- |
| TAI | `TAI` | FITS 4.0 §9.2.1 Table 30, p. 38 (IAU FITS Working Group) |
| GPS time | `GPS` | RINEX 4.02 / 3.05 §5.2.8 ("GPS to identify GPS time"); FITS 4.0 Table 30 |
| Galileo time | `GAL` | RINEX §5.2.8 ("GAL to identify Galileo time") |
| BeiDou time | `BDT` | RINEX §5.2.8 ("BDT to identify BDS time") |
| QZSS time | `QZS` | RINEX §5.2.8 ("QZS to identify QZSS time") |
| GLONASS time | `GLO` | RINEX §5.2.8 ("GLO to identify the GLONASS UTC time") |
| NavIC time | `IRN` | RINEX §5.2.8 ("IRN to identify NavIC time") |

The "date-time, space, token" arrangement is a GMT rule; no standard joins the two. The token is the same string as the `GnssSystem` member, so `gnssToUtc('GAL', '2024-01-01T00:00:18 GAL')`.

## Key constants

- **GPS − UTC = +18 seconds** since 2017-01-01 — GPS runs **ahead** of UTC; the offset was **0** at the GPS epoch.
- TAI − GPS = +19 seconds (BIPM: "19 s + C0", C0 tens of nanoseconds). GST and QZSST are 19 s behind TAI too.
- TAI − BDT = +33 seconds (BIPM); BDT − UTC was 0 at its 2006 epoch.
- TAI − IRNSST = +19 seconds, derived; NavIC time was 13 s ahead of UTC at its 1999 epoch.
- TAI − UTC = +37 seconds (27 leap seconds since 1972; none since 2016-12-31). The table is closed: continuous UTC from 20 May 2027 (CGPM 2026 Resolution 5).
- Week counters: GPS and QZSS LNAV modulo 1024 and CNAV modulo 8192; Galileo modulo 4096; BeiDou modulo 8192; NavIC L5/S modulo 1024 and L1 modulo 8192.
- GPS LNAV rollovers at 1999-08-21T23:59:47Z and 2019-04-06T23:59:42Z UTC; the next at 2038-11-20T23:59:42Z (TAI − UTC stays 37 s: continuous UTC from 20 May 2027, CGPM 2026 Resolution 5). Galileo's first 4096-week rollover is 2078-02-19T23:59:42Z UTC. BeiDou's 8192-week counter first wraps at 2163-01-01T23:59:56Z UTC.
- NavIC rollovers: 10-bit at 2019-04-06T23:59:42Z and 2038-11-20T23:59:42Z, 13-bit at 2156-08-21T23:59:42Z.

([BIPM Annual Report on Time Activities vol. 15](https://webtai.bipm.org/ftp/pub/tai/annual-reports/bipm-annual-report/annual_report_2020.pdf), [BIPM `utc-gnss`](https://webtai.bipm.org/ftp/pub/tai/other-products/utcgnss/utc-gps), [CGPM 2026 Resolution 5](https://www.bipm.org/en/cgpm-2026/resolution-5), [Meinberg on GPS week rollover](https://kb.meinbergglobal.com/kb/time_sync/gnss_systems/gps_week_number_rollover))

## Corrections

The original MAR-1 and the first draft of this story contained these errors, all corrected above.

- **The sign was backwards.** It stated `GPS − UTC = -18 seconds`. GPS is ahead of UTC, so the offset is `+18`. Implemented as written, every converted timestamp would have been 36 seconds wrong.
- **The epoch example was wrong.** It asserted that UTC `1980-01-06T00:00:00Z` is GPS time `1980-01-06T00:00:18`. The GPS−UTC offset was **zero** at the GPS epoch — the 18 seconds accumulated from leap seconds inserted afterwards. Using the present-day offset at the epoch is exactly the bug this story exists to prevent, and it was encoded in the acceptance criteria.
- **TAI − GST had the wrong sign.** The draft gave −19 s. GST is 19 s behind TAI, exactly like GPS, so TAI − GST = +19 s (BIPM).
- **GLONASS was read as UTC + 3 h.** A RINEX `GLO` time tag is in UTC hours, so a three-hour shift would have put every converted tag three hours out. `GLO` now follows RINEX and BIPM.
- **`'BDS'` and `'… GLONASST'` are not time tokens.** `BDS` names the constellation; RINEX's time token is `BDT`. No standard defines `GLONASST`.

## Design notes

- Every offset except the TAI constants is a function of the date, resolved through the leap-second table. Any implementation that hardcodes 18 is correct only between 2017 and the next leap second.
- **`GLO` is GLONASS time in UTC hours, as RINEX and BIPM report it; GMT does not implement the three-hour system time.** RINEX 4.02 §4.1.2: "The reported GLONASS time has the same hours as UTC and not UTC+3 h". A `GLO` label is UTC's own wall clock, leap seconds included. A reader of raw broadcast GLONASS system time removes the three hours first; the JSDoc says so.
- **Galileo's epoch statement is about the count, not a midnight.** The ICD fixes GST at 13 s on 1999-08-22T00:00:00 UTC; the week counter's zero is therefore 13 s before that midnight, and the JSDoc quotes the sentence so nobody "corrects" it to zero.
- **No system has functions of its own.** Every system goes through `utcToGnss` / `gnssToUtc`, `gnssWeekToUtc` / `utcToGnssWeek` and `rinexWeekToUtc` / `utcToRinexWeek`; a national system never gets its own named function (tracker, "International authority first").
- **Week functions take the counter by name.** GPS, QZSS and NavIC each broadcast two week counters of different widths, and a week number means nothing without its counter's width. So each `GnssWeekCounter` member has exactly one modulus. GLONASS has no week counter, so `'GLO'` is not a member.
- **`rolloverEra` is required: an integer, `'rolling'` by name, or a caller-stated pivot `{ notBefore }`.** A week number alone cannot say which pass of the counter it belongs to; a GPS receiver reporting LNAV week 100 is ambiguous across four decades. An integer from 0 is the era, for stored data. `'rolling'` picks the era that puts the full week within half a counter period of the current week, for live receiver output. `{ notBefore }` resolves to the earliest instant at or after a caller-stated UTC instant, as a receiver that resolves weeks against its firmware build date does; an instant exactly equal to it counts. GMT never picks the era itself.
- **RINEX navigation weeks have their own functions.** A RINEX navigation record's week is continuous from 1980 for GPS, QZSS, NavIC and Galileo (RINEX 4.02 Table A30: "Continuous number, not mod (1024), counted from 1980 (same as GPS)"), and BeiDou records count BDT weeks from 2006. It never wraps and has no era, so `rinexWeekToUtc` / `utcToRinexWeek` read it. A RINEX NavIC week read as a NavIC broadcast week is 1024 weeks off.
- **Offsets are nominal.** The nanosecond corrections a satellite broadcasts (C0, C1, A0/A1, GGTO) are not inputs and are not applied.
- Before each system's epoch its time is undefined. Return the sentinel rather than extrapolating.
- NMEA sentence parsing (RMC, ZDA) is MAR-59; this story is the scale arithmetic those parsers feed.

## What gmt provides (do not re-implement)

- `parseInstantNanoseconds` / `toNanoseconds` from CORE-1 — instant parsing and precision
- The leap-second table and its queries from SPA-48 — built in this story, consumed here

## Verification

- `utcToGnss('GPS', '1980-01-06T00:00:00Z')` returns `'1980-01-06T00:00:00 GPS'`: a **zero** offset at the GPS epoch
- `utcToGnss('GPS', '2024-01-01T00:00:00Z')` returns `'2024-01-01T00:00:18 GPS'`, **18 seconds ahead** of UTC
- Round-trip: for each of the six systems, `gnssToUtc(system, utcToGnss(system, iso))` returns an equivalent UTC string
- A date before the 2016 leap second uses a 17-second offset, not 18
- `gnssWeekToUtc('GPS-LNAV', 100, 0, 0)` and era 1 give GPS labels exactly 1024 weeks apart; `'GAL'` 4096 and `'BDT'` 8192; the UTC strings differ by that many weeks less the leap seconds between them
- `gnssWeekToUtc('GPS-LNAV', 1020, 0, { notBefore: '2019-01-01T00:00:00Z' })` is `2019-03-09T23:59:42Z`; with `notBefore: '2019-04-07T00:00:00Z'` it is `2038-10-23T23:59:42Z`; a decoded instant exactly at `notBefore` is returned
- `'GLO'` is not a week counter: the types do not accept it, and an untyped call returns the sentinel
- `utcToGnssWeek('GPS-LNAV', '2019-04-07T00:00:00Z')` returns era 2; the same instant for `'GAL'` returns era 0
- `utcToGnss('GAL', '1999-08-22T00:00:00Z')` returns `'1999-08-22T00:00:13 GAL'`, 13 seconds ahead of UTC, matching the ICD sentence; for any later date `utcToGnss('GAL', iso)` and `utcToGnss('GPS', iso)` show the same date-time
- `utcToGnss('BDT', '2006-01-01T00:00:00Z')` equals UTC; `utcToGnss('BDT', '2024-01-01T00:00:00Z')` is 4 seconds ahead of UTC — `(TAI − UTC) − 33`, computed from the table, never a literal
- `utcToGnss('GLO', iso)` shows UTC's own wall clock with the token `GLO` (RINEX 4.02 §4.1.2; BIPM), carries no leap-second offset, and writes a listed leap second as `…T23:59:60 GLO`
- `utcToGnss('IRN', '1999-08-21T23:59:46Z')` returns the sentinel and `'1999-08-21T23:59:47Z'` returns `'1999-08-22T00:00:00 IRN'`
- `utcToGnss('IRN', '2024-01-01T00:00:00Z')` is 18 seconds ahead of UTC (TAI − IRNSST 19 s, derived)
- `gnssWeekToUtc('IRN-LNAV', 0, 0, 1)` is `2019-04-06T23:59:42Z`
- `rinexWeekToUtc('IRN', 2295, 86418)` is `2024-01-01T00:00:00Z`, and the same number through `gnssWeekToUtc('IRN-L1NV', 2295, 86418, 0)` is 1024 weeks later
- A date before a system's epoch returns the sentinel for that system and not for the others
- `pnpm run validate` stays green
