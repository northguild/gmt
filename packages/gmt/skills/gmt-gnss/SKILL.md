---
name: gmt-gnss
description: >
  GNSS time in @northguild/gmt/gnss — the six RINEX GNSS time scales as peers
  (GPS, GAL, BDT, QZS, GLO, IRN: utcToGnss, gnssToUtc), broadcast weeks by
  named counter (GnssWeekCounter) with a required rolloverEra (integer,
  "rolling" or { notBefore }) for gnssWeekToUtc/utcToGnssWeek, and continuous
  RINEX navigation weeks (rinexWeekToUtc, utcToRinexWeek). Reads the docs site
  (llms.txt) and the installed package's JSDoc; a routing pointer, not an API
  dump.
sources:
  - 'northguild/gmt:apps/dox/src/content/docs/guides/industries/gnss-system-time-and-week-rollover.mdx'
  - 'northguild/gmt:apps/dox/src/content/docs/guides/industries/maritime-gnss-time-and-week-rollover.mdx'
  - 'northguild/gmt:packages/gmt/src/gnss/index.ts'
  - 'northguild/gmt:packages/gmt/src/types/gnss.ts'
metadata:
  type: core
  library: '@northguild/gmt'
  library_version: '1.20.0'
---

# GMT GNSS

Use this skill when the task is reading satellite receiver output: a GNSS
time-scale string, a broadcast week and time of week, or a RINEX navigation
file week. TAI and the leap-second table are in the `gmt-integration` skill.

## When to load

- The user is reading satellite receiver output: a GNSS time-scale string, a
  broadcast week and time of week, or a RINEX navigation-file week.

## Core rules

1. **The six GNSS time scales are peers, named by their RINEX 4.02 tokens.**
   `GPS`, `GAL` (Galileo), `BDT` (BeiDou), `QZS` (QZSS), `GLO` (GLONASS) and
   `IRN` (NavIC). No system is a default; each goes through the same functions,
   with the system first.
   ```typescript
   utcToGnss("GAL", "2024-01-01T00:00:00Z"); // "2024-01-01T00:00:18 GAL"
   utcToGnss("BDT", "2024-01-01T00:00:00Z"); // "2024-01-01T00:00:04 BDT"
   utcToGnss("GPS", "1980-01-06T00:00:00Z"); // "1980-01-06T00:00:00 GPS" (0 s at the epoch)
   gnssToUtc("IRN", "2024-01-01T00:00:18 IRN"); // "2024-01-01T00:00:00Z"
   ```
   - `GLO` is GLONASS time as RINEX reports it: UTC's own hours, leap seconds
     included, not UTC + 3 h. Remove the three hours from raw system time first.
   - Each system returns the sentinel before its own epoch. Offsets are nominal:
     broadcast nanosecond corrections are not applied.
2. **A broadcast week needs its counter and its era.** `GnssWeekCounter` names
   one counter with one modulus: `"GPS-LNAV"`, `"QZS-LNAV"`, `"IRN-LNAV"` 1024
   weeks; `"GAL"` 4096; `"GPS-CNAV"`, `"QZS-CNAV"`, `"BDT"`, `"IRN-L1NV"` 8192.
   GLONASS has no week counter. `rolloverEra` is required: an integer era for
   stored data, `"rolling"` for live output (the era within half a counter
   period of today, so it reads the clock), or `{ notBefore }`, the earliest
   match at or after an instant you state, such as a firmware build date.
   ```typescript
   gnssWeekToUtc("GPS-LNAV", 100, 0, 0); // "1981-12-05T23:59:59Z"
   gnssWeekToUtc("GPS-LNAV", 100, 0, 1); // "2001-07-21T23:59:47Z"
   gnssWeekToUtc("GPS-LNAV", 1020, 0, { notBefore: "2019-04-07T00:00:00Z" }); // "2038-10-23T23:59:42Z"
   utcToGnssWeek("GAL", "2019-04-07T00:00:00Z"); // { week: 1024, timeOfWeekSeconds: 18, era: 0 }
   ```
   A RINEX navigation record's week is continuous and never wraps: read it with
   `rinexWeekToUtc` / `utcToRinexWeek`, not the broadcast functions. A RINEX
   NavIC week read as a broadcast week is 1024 weeks off.
   ```typescript
   rinexWeekToUtc("IRN", 2295, 86418); // "2024-01-01T00:00:00Z"
   gnssWeekToUtc("IRN-L1NV", 2295, 86418, 0); // "2043-08-17T00:00:00Z" (not the same week)
   ```
3. **Second 60 is accepted only on a listed insertion day.** `gnss/` and
   `timescale/` accept `:60` only on a listed insertion day, and may return
   `…T23:59:60Z`. Every other GMT function rejects `:60`, so do not pass that
   result on.
4. **Convert at the boundary and store the era rule.** Convert a GNSS label to
   a UTC instant on the way in (`gnssToUtc`, `gnssWeekToUtc`, `rinexWeekToUtc`),
   and back on the way out. Store the era rule you used with any week you
   decode.
5. **Read the docs site.** This skill is a routing pointer. The map of the
   docs is `https://gmt-dox.northguild.workers.dev/llms.txt`, and each page
   has a `.md` twin that holds its text. The JSDoc ships in the installed
   package: `node_modules/@northguild/gmt/dist/**/*.d.ts`.

## Key functions

- **GNSS time scales** (`@northguild/gmt/gnss`): `utcToGnss`, `gnssToUtc`,
  `gnssWeekToUtc`, `utcToGnssWeek`, `rinexWeekToUtc`, `utcToRinexWeek`, types
  `GnssSystem`, `GnssWeekCounter`, `RolloverEra`, `GnssWeek`,
  `RinexWeekSystem`, `RinexWeek`

## References

- [gnss reference](https://gmt-dox.northguild.workers.dev/reference/gnss/)
- [Docs map for agents (llms.txt)](https://gmt-dox.northguild.workers.dev/llms.txt)
- [GMT Integration skill](../gmt-integration/SKILL.md)
