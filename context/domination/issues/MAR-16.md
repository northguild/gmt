# MAR-16 — Maritime: GNSS time scales — GPS, Galileo, BeiDou, GLONASS, QZSS — and week rollover

**Scope:** Converting each satellite navigation system's time to UTC and back, and decoding the raw week and time-of-week pairs receivers actually emit.

## Gap

Maritime AIS, GNSS receivers and navigation systems report satellite system time, which for most constellations has no leap seconds. Port and commercial operations run on UTC. The offset between them is not constant — it grows by one second with every leap second — and raw receiver output carries a week number that has already wrapped.

The first draft covered GPS alone. A multi-constellation receiver (RINEX 3/4 observation files, NMEA `$GN…` sentences) tags observations with the system they came from, and each system has its own epoch, week-counter width and relationship to TAI, each stated in its interface control document:

| System | Epoch and offset at the epoch | Week counter | Leap seconds | Source |
| --- | --- | --- | --- | --- |
| GPS | zero at "midnight on the night of January 5, 1980/morning of January 6, 1980"; GPS − UTC was 0 | LNAV: 10 bits, "modulo 1024"; CNAV: 13 bits, "modulo-8192" | No — "a continuous time scale, while UTC is corrected periodically" | IS-GPS-200N §3.3.4, §20.3.3.3.1.1, §30.3.3.1.1.1 |
| Galileo (GST) | "GST was equal to 13 seconds at 22nd August 1999 00:00:00 UTC" — the count started 13 s earlier, so GST is aligned with GPS time | 12 bits, "covers 4096 weeks (about 78 years)"; TOW 0–604799 | No — "a continuous time scale" | Galileo OS SIS ICD 2.0 §5.1.2, Table 62 |
| BeiDou (BDT) | "00:00:00 on January 1, 2006 of Coordinated Universal Time (UTC)"; BDT − UTC was 0 | 13 bits, "0 through 8191"; SOW 20 bits | No — "SI seconds, rather than leap seconds" | BDS-SIS-ICD-2.0 §5.2.4.3–5.2.4.4 |
| GLONASS | UTC(SU) + 3 h ("UTC(SU) + 03 hours 00 min") | none — day number within a four-year interval from 1996 | **Yes** — "corrected to integer number of seconds simultaneously with UTC corrections" | GLONASS ICD 5.1 §3.3.3, §4.4, §4.5 |
| QZSS | "delayed from TAI by 19 seconds"; "counted from January 6th, 1980" | 10 bits, "modulo 1024" (as GPS) | No | IS-QZSS-PNT-003 §5.1, §4.1.2.3 |

TAI − GPS = 19 s is by definition; the ICDs do not restate TAI − GST (−19 s) or TAI − BDT (33 s) — both follow from the epoch statements above and the leap-second count at each epoch (32 s in 1999, 33 s in 2006), and the JSDoc says they are derived.

([IS-GPS-200N](https://www.navcen.uscg.gov/sites/default/files/pdf/gps/IS-GPS-200N.pdf), [Galileo OS SIS ICD Issue 2.0](https://www.gsc-europa.eu/sites/default/files/sites/all/files/Galileo_OS_SIS_ICD_v2.0.pdf), [BDS-SIS-ICD-2.0](https://gge.ext.unb.ca/Resources/beidou_icd_english_ver2.0.pdf), [GLONASS ICD Edition 5.1](https://www.unavco.org/help/glossary/docs/ICD_GLONASS_5.1_(2008)_en.pdf), [IS-QZSS-PNT-003](https://qzss.go.jp/en/technical/download/pdf/ps-is-qzss/is-qzss-pnt-003.pdf))

## Scope

- `packages/gmt/src/maritime/convert/gpsToUtc.ts`:
  - `gpsToUtc(gpsString: string): string` — GPS timestamp to UTC ISO string.
  - `utcToGps(utcString: string): string` — UTC to GPS timestamp.
- `packages/gmt/src/maritime/convert/gnssWeek.ts`:
  - `gnssWeekToUtc(system: GnssSystem, week: number, timeOfWeekSeconds: number, options?: { rolloverEra?: number }): string` — Raw week and time-of-week to UTC. `rolloverEra` disambiguates the wrap for the system's counter width; `'GLO'` has no week and returns the sentinel here.
  - `utcToGnssWeek(utcString: string, system: GnssSystem): { week: number, timeOfWeekSeconds: number, era: number } | null`
  - `gpsWeekToUtc` / `utcToGpsWeek` remain as the GPS-bound forms of the same two functions.
- `packages/gmt/src/maritime/convert/gnssToUtc.ts`:
  - `gnssToUtc(system: GnssSystem, value: string): string` and `utcToGnss(system: GnssSystem, utcString: string): string` — Scale-string conversion in the SPICE-style designator form SPA-46 uses (`'… GST'`, `'… BDT'`, `'… GLONASST'`).
- `GnssSystem` is `'GPS' | 'GAL' | 'BDS' | 'GLO' | 'QZS'`, the RINEX system letters spelled out.

## Key constants

- **GPS − UTC = +18 seconds** as of January 2017 — GPS runs **ahead** of UTC; the offset was **0** at the GPS epoch.
- TAI − GPS = +19 seconds (constant, by definition); GST and QZSST are steered to the same offset.
- TAI − BDT = +33 seconds (constant); BDT − UTC was 0 at its 2006 epoch.
- TAI − UTC = +37 seconds (27 leap seconds since 1972; none since 2016-12-31).
- GPS week rollovers: **1999-08-21** and **2019-04-06**; the next is **2038-11-20**. Galileo's first 4096-week rollover is in 2078; BeiDou's 8192-week counter does not wrap this century.

([BIPM](https://www.bipm.org/documents/20126/52354616/CCTF_UTC_presentation.pdf/0a8f0954-7c00-9142-8da2-f4221c7e0269), [Meinberg on GPS week rollover](https://kb.meinbergglobal.com/kb/time_sync/gnss_systems/gps_week_number_rollover))

## Corrections

The original MAR-1 contained two factual errors, both now corrected above.

- **The sign was backwards.** It stated `GPS − UTC = -18 seconds`. GPS is ahead of UTC, so the offset is `+18`. Implemented as written, every converted timestamp would have been 36 seconds wrong.
- **The epoch example was wrong.** It asserted `utcToGps('1980-01-06T00:00:00Z')` → `'1980-01-06T00:00:18Z'`. The GPS−UTC offset was **zero** at the GPS epoch — the 18 seconds accumulated from leap seconds inserted afterwards. Using the present-day offset at the epoch is exactly the bug this story exists to prevent, and it was encoded in the acceptance criteria.

## Design notes

- Every offset except the TAI constants is a function of the date, resolved through the leap-second table. Any implementation that hardcodes 18 is correct only between 2017 and the next leap second.
- **GLONASS is the odd one out.** It follows UTC(SU) plus three hours and inserts leap seconds, so a GLONASS-to-UTC conversion is a three-hour shift, not a leap-second table lookup; mixing the two rules produces an error of 37 seconds or 3 hours. The system parameter exists to make that branch explicit.
- **Galileo's epoch statement is about the count, not a midnight.** The ICD fixes GST at 13 s on 1999-08-22T00:00:00 UTC; the week counter's zero is therefore 13 s before that midnight, and the JSDoc quotes the sentence so nobody "corrects" it to zero.
- `rolloverEra` cannot be inferred from a week number alone; a GPS receiver reporting week 100 is genuinely ambiguous across four decades. Default to the current era for the given system and document that older receivers need an explicit value.
- Before each system's epoch its time is undefined. Return the sentinel rather than extrapolating.
- NMEA sentence parsing (RMC, ZDA) is MAR-59; this story is the scale arithmetic those parsers feed.

## What gmt provides (do not re-implement)

- `toNanoseconds` / `fromNanoseconds` from CORE-1 — precision conversion
- The leap-second table from SPA-48 — shared, not duplicated
- `toTAI` / `fromTAI` from SPA-46 — the scale-string form and the TAI hinge every constellation offset is defined against

## Verification

- `utcToGps('1980-01-06T00:00:00Z')` returns the GPS epoch with a **zero** offset
- `utcToGps('2024-01-01T00:00:00Z')` returns a GPS time **18 seconds ahead** of UTC
- Round-trip: `gpsToUtc(utcToGps(iso))` returns an equivalent UTC string
- A date before the 2016 leap second uses a 17-second offset, not 18
- `gnssWeekToUtc('GPS', 100, 0, { rolloverEra: 0 })` and era 1 differ by exactly 1024 weeks; for `'GAL'` the eras differ by 4096 weeks; for `'BDS'` by 8192; for `'GLO'` the function returns the sentinel
- `utcToGnssWeek('2019-04-07T00:00:00Z', 'GPS')` returns era 2; the same instant for `'GAL'` returns era 0
- `utcToGnss('GAL', '1999-08-22T00:00:00Z')` is 13 seconds ahead of UTC, matching the ICD sentence; for any later date `utcToGnss('GAL', iso)` and `utcToGps(iso)` agree to the second
- `utcToGnss('BDS', '2006-01-01T00:00:00Z')` equals UTC; `utcToGnss('BDS', '2024-01-01T00:00:00Z')` is 4 seconds ahead of UTC — `(TAI − UTC) − 33`, computed from the table, never a literal
- `utcToGnss('GLO', iso)` is exactly three hours ahead of UTC and carries no leap-second offset
- A date before a system's epoch returns the sentinel for that system and not for the others
- `pnpm run validate` stays green
