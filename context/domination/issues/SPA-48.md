# SPA-48 — Space: Leap seconds

**Scope:** The leap-second table, and the queries every other scale conversion depends on.

## Gap

UTC has leap seconds; TAI and GPS do not. Every conversion in the Space realm, plus PTP in IoT (IOT-31) and GPS in Maritime (MAR-16), needs to know the TAI − UTC offset for a given date. That requires the IERS table, and it requires being honest about the several ways the concept breaks down.

## Scope

- `packages/gmt/src/space/get/leapSeconds.ts`:
  - `taiMinusUtc(isoString: string): number | null` — The offset in force on a date. The sentinel before 1972.
  - `leapSecondsBetween(start: string, end: string): number | null` — Count inserted between two UTC dates.
  - `isLeapSecond(isoString: string): boolean` — Whether a timestamp is a valid inserted leap second (`23:59:60`) present in the table.
  - `nextLeapSecond(isoString: string): string | null` — `null` when none is scheduled, which is the current state.
- `packages/gmt/src/space/get/leapSecondTable.ts`:
  - `leapSecondTable(): { at: string, taiMinusUtc: number }[]`
  - `tableProvenance(): { source: string, bulletin: string, validUntil: string }`
  - `isTableStale(at: string): boolean` — Whether a date falls beyond the bundled bulletin's validity.

## Leap second facts

- **27 leap seconds since 1972**, giving **TAI − UTC = +37 seconds**.
- **The most recent was 2016-12-31 23:59:60 UTC.** None has been inserted since; Earth's rotation has not required one.
- Insertions occur preferentially at the end of June or December.
- **Before 1972-01-01**, UTC used rate-adjusted "rubber seconds" with fractional, drifting offsets from TAI. Integer leap-second logic does not apply.
- A resolution has been adopted to **discontinue leap seconds by 2035**.

([BIPM CCTF](https://www.bipm.org/documents/20126/52354616/CCTF_UTC_presentation.pdf/0a8f0954-7c00-9142-8da2-f4221c7e0269))

## Corrections

The original SPA-3 gave two numerically wrong acceptance criteria:

- `leapSecondsBetween('2020-01-01Z', '2024-01-01Z')` → `1`, annotated "one leap second in 2022". **There was no leap second in 2022.** The correct answer is `0`.
- `leapSecondsBetween('2000-01-01Z', '2024-01-01Z')` → `10`, annotated "approximate". The correct answer is **5** — insertions in 2005, 2008, 2012, 2015 and 2016.

Encoding wrong numbers as acceptance criteria would have produced an implementation that passed its tests and corrupted every TAI conversion in the library. Both are corrected in Verification below.

## Design notes

- **`isLeapSecond` is a table lookup, not a pattern match.** `23:59:60` is syntactically well-formed on any date and valid on only 27 of them. Validating the format alone accepts fabricated leap seconds.
- **Leap smearing is not a leap second.** Google, AWS and Meta spread the extra second across a window, so a smeared clock never reads `23:59:60` and is offset from true UTC by up to a second during the smear. GMT cannot detect smearing; the JSDoc must warn that timestamps from smeared infrastructure are not exactly UTC near an insertion.
- **`isTableStale` exists because the table expires.** IERS announces insertions roughly six months ahead via Bulletin C, and a bundled table cannot know about later announcements. Silently returning 37 for a date past the bulletin's validity is a plausible-looking wrong answer.
- The table is bundled with recorded provenance and a review cadence, per the tracker's rule on reference data. It is shared with MAR-16 and IOT-31 and must not be duplicated.

## What gmt provides (do not re-implement)

- `isValidZonedDateTime` — base validation
- `toNanoseconds` from CORE-1 — precision conversion

## Verification

- `taiMinusUtc('2024-01-01T00:00:00Z')` returns `37`
- `taiMinusUtc('2016-01-01T00:00:00Z')` returns `36`
- `taiMinusUtc('1971-01-01T00:00:00Z')` returns the sentinel
- `leapSecondsBetween('2020-01-01Z', '2024-01-01Z')` returns **`0`**
- `leapSecondsBetween('2000-01-01Z', '2024-01-01Z')` returns **`5`**
- `isLeapSecond('2016-12-31T23:59:60Z')` returns `true`
- `isLeapSecond('2017-12-31T23:59:60Z')` returns `false` — well-formed, not in the table
- `isLeapSecond('2016-12-31T23:59:59Z')` returns `false`
- `nextLeapSecond` returns `null` for a current date
- `isTableStale` returns `true` beyond the bundled bulletin's validity
- The table's final entry matches TAI − UTC = 37
- `pnpm run validate` stays green
