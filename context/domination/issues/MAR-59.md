# MAR-59 — Maritime: NMEA 0183 time and date fields

**Scope:** The time and date fields of the NMEA 0183 sentences every GNSS receiver on a bridge emits — RMC, ZDA, GGA and GLL — and the offsets ZDA carries.

## Gap

AIS (MAR-17) is what a ship transmits; NMEA 0183 is what its own receiver says. RMC carries the fix time as `hhmmss.ss` and the date as `ddmmyy`; GGA and GLL carry time only; ZDA carries the full UTC date and time plus a local zone description in hours and minutes. Three defects recur in code that reads them: the two-digit year needs a century rule, the time-only sentences need a date from somewhere else, and the ZDA zone fields have a sign convention that has to come from the standard, not from intuition.

([gpsd, *NMEA Revealed*](https://gpsd.gitlab.io/gpsd/NMEA.html) — the public reference for the sentence formats; the NMEA 0183 standard itself is paywalled and is cited by sentence)

## Scope

- `packages/gmt/src/maritime/parse/nmeaFields.ts`:
  - `parseNmeaTime(value: string): { time: string, precision: 'second' | 'fraction' } | null` — `hhmmss` or `hhmmss.ss` to an ISO time; fractional digits preserved as given.
  - `parseNmeaDate(value: string, options: { centuryPivot: number }): string | null` — `ddmmyy` to an ISO date. The pivot is required: receivers have been in service since the 1990s and the field cannot say which century it means.
- `packages/gmt/src/maritime/parse/nmeaSentences.ts`:
  - `parseRmcDateTime(sentence: string, options: { centuryPivot: number }): { instant: string, valid: boolean } | null` — Combines the RMC time and date fields; `valid` mirrors the sentence's `A`/`V` status flag, because a `V` fix carries a time the receiver does not vouch for.
  - `parseZdaDateTime(sentence: string): { instant: string, localOffset: string | null } | null` — ZDA's four-digit year needs no pivot; the zone hours and minutes become an ISO offset when present, `null` when the receiver leaves them `00,00` with no knowledge of local time.
  - `parseGgaTime(sentence: string, referenceDate: string): string` and `parseGllTime(sentence: string, referenceDate: string): string` — Time-only sentences resolved against a caller-supplied UTC date, choosing the nearest candidate day so a fix at 23:59:59 received at 00:00:01 lands on the right side of midnight.
  - `nmeaChecksumValid(sentence: string): boolean` — The XOR checksum; a corrupted sentence must not yield a plausible time.

## Design notes

- **No century pivot is inferred.** Unlike TLE epochs (SPA-51), which have a documented Sputnik pivot, NMEA has none; the caller states one and the JSDoc explains the GPS week-rollover failure that produces 1999- and 2019-dated fixes from old receivers, which MAR-16 handles at the week level.
- **The ZDA sign convention is quoted from the standard, not assumed.** The zone fields are a "local zone description"; whether local time is UTC plus or minus the field is a fact to cite in the JSDoc verbatim at implementation, because receivers in the field have been wired both ways and the parser has to say which reading it applies.
- **Time-only sentences need a reference date and can still be wrong**, exactly as METAR times need a reference month (AV-28). The nearest-candidate rule is the same and is shared.
- **NMEA is UTC.** Ship's time (MAR-18) and port-local time are separate concerns; nothing here consults a zone except ZDA's own offset field.
- Talker IDs (`$GP`, `$GN`, `$GL`, …) identify the constellation of the fix; they are passed through so MAR-16's system parameter can be set from them, not interpreted here.

## What gmt provides (do not re-implement)

- `toOffsetInstant` / `fromOffsetInstant` from CORE-4 — the ZDA instant-plus-offset pair
- `spanMs` from CORE-2 — nearest-candidate selection for time-only sentences
- `regex/` — pattern matchers
- `gnssWeekToUtc` from MAR-16 — where a caller reconstructs a date from week and time-of-week instead

## Verification

- `parseNmeaTime('172809.456')` returns `'17:28:09.456'` with `precision: 'fraction'`
- `parseNmeaDate('120796', { centuryPivot: 80 })` returns `'1996-07-12'`; with `centuryPivot: 50` the same field returns `'2096-07-12'`, asserted to show the pivot matters
- `parseRmcDateTime` on gpsd's RMC example returns the documented instant and `valid: true`; a `V` status returns `valid: false` with the instant still parsed
- `parseZdaDateTime('$GPZDA,172809.456,12,07,1996,00,00*45')` returns the instant with `localOffset: null`; a sentence with a non-zero zone returns the offset with the sign the JSDoc cites
- `parseGgaTime` for a 23:59:59 fix against a reference date at 00:00:01 the next day resolves to the previous date
- A sentence with a wrong checksum returns the sentinel from every parser
- Malformed fields (`hh` > 23, `dd` > 31, missing commas) return the sentinel
- `pnpm run validate` stays green
