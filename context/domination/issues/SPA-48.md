# SPA-48 — Space: Leap seconds

**Scope:** The leap-second table, and the queries every other scale conversion depends on.

## Gap

UTC has leap seconds; TAI and GPS do not. Every conversion in the Space realm, plus PTP device time and GPS in Maritime (MAR-16), needs to know the TAI − UTC offset for a given date. That requires the IERS table, and it requires being honest about the several ways the concept breaks down.

## Scope

- `packages/gmt/src/timescale/calculate/`, one function per file:
  - `taiMinusUtc(isoString: string): number | null` — The offset in force at an instant. The sentinel before 1972.
  - `leapSecondsBetween(start: string, end: string): number | null` — The signed count of leap seconds between two UTC instants.
  - `nextLeapSecond(isoString: string): string` — The next leap second's UTC label, or `""` when there is none, which is the answer for every instant from 2016-12-31T23:59:60Z on.
- `packages/gmt/src/timescale/validate/`:
  - `isLeapSecond(isoString: string): boolean` — Whether a timestamp is one of the 27 inserted leap seconds (`23:59:60`) the table lists.
- The table is an internal constant, `internal/leapSeconds.ts`. No function takes a table argument.
- `leapSecondTable()` is dropped: it takes no argument and returns a constant, one value for every call. The rows are reachable through `taiMinusUtc` and `nextLeapSecond`, and the source and revision are cited in the code and the guide.
- `tableProvenance()` is dropped for the same reason: a zero-argument constant. The source and revision are cited in the constant's comment, the JSDoc and the guide.
- `isTableStale(at)` is dropped: the table is closed, so it could never return `true`.

## Leap second facts

- **27 leap seconds since 1972**, giving **TAI − UTC = +37 seconds**.
- **The most recent was 2016-12-31 23:59:60 UTC.** None has been inserted since; Earth's rotation has not required one.
- Insertions occur preferentially at the end of June or December (first preference; end of March and September are second preference, ITU-R TF.460-6 Annex 1 §2.1).
- **Before 1972-01-01**, UTC used rate-adjusted "rubber seconds" with fractional, drifting offsets from TAI (BIPM Annual Report on Time Activities vol. 15, Table 2, p. 15). Integer leap-second logic does not apply.
- CGPM 2022 Resolution 4 decided that the maximum value of UT1 − UTC "will be increased in, or before, 2035". CGPM 2026 Resolution 5 decided that "continuous UTC will become effective on 20 May 2027", with a maximum |UT1 − UTC| of 3600 s. The table is therefore closed: TAI − UTC stays 37 s after 2017-01-01.

([IERS `Leap_Second.dat`](https://hpiers.obspm.fr/iers/bul/bulc/Leap_Second.dat), [IERS Bulletin C](https://hpiers.obspm.fr/iers/bul/bulc/bulletinc.dat), [ITU-R TF.460-6](https://www.itu.int/rec/R-REC-TF.460/en), [CGPM 2022 Resolution 4](https://www.bipm.org/en/cgpm-2022/resolution-4), [CGPM 2026 Resolution 5](https://www.bipm.org/en/cgpm-2026/resolution-5), [BIPM Annual Report on Time Activities vol. 15](https://webtai.bipm.org/ftp/pub/tai/annual-reports/bipm-annual-report/annual_report_2020.pdf))

## Corrections

The original SPA-3 gave two numerically wrong acceptance criteria:

- `leapSecondsBetween('2020-01-01Z', '2024-01-01Z')` → `1`, annotated "one leap second in 2022". **There was no leap second in 2022.** The correct answer is `0`.
- `leapSecondsBetween('2000-01-01Z', '2024-01-01Z')` → `10`, annotated "approximate". The correct answer is **5** — insertions in 2005, 2008, 2012, 2015 and 2016.

Encoding wrong numbers as acceptance criteria would have produced an implementation that passed its tests and corrupted every TAI conversion in the library. Both are corrected in Verification below.

## Design notes

- **`isLeapSecond` is a table lookup, not a pattern match.** `23:59:60` is syntactically well-formed on any date and valid on only 27 of them. Validating the format alone accepts fabricated leap seconds.
- **Leap smearing is not a leap second.** Google, AWS and Meta spread the extra second across a window, so a smeared clock never reads `23:59:60` and is offset from true UTC by up to a second during the smear. GMT cannot detect smearing; the JSDoc must warn that timestamps from smeared infrastructure are not exactly UTC near an insertion.
- **The table is closed and built in** (tracker DoD exemption for closed tables). A weekly canary, `scripts/leap-seconds.mjs`, compares it with the IERS file until IERS publishes its file format for continuous UTC. ITU-R TF.460-6 §2.3 requires at least eight weeks' notice of any insertion, so the canary would catch one in time.
- The constant cites its source and final revision beside it: IERS `Leap_Second.dat`, updated through Bulletin C 72 (6 July 2026). It is shared with MAR-16 and must not be duplicated.
- The syntax-only check in `plain/validate/` is `hasSecond60`.

## What gmt provides (do not re-implement)

- `parseInstantNanoseconds` / `toNanoseconds` from CORE-1 — instant parsing and precision

## Verification

- `taiMinusUtc('2024-01-01T00:00:00Z')` returns `37`
- `taiMinusUtc('2016-01-01T00:00:00Z')` returns `36`
- `taiMinusUtc('1971-01-01T00:00:00Z')` returns the sentinel
- `leapSecondsBetween('2020-01-01T00:00:00Z', '2024-01-01T00:00:00Z')` returns **`0`**
- `leapSecondsBetween('2000-01-01T00:00:00Z', '2024-01-01T00:00:00Z')` returns **`5`**
- `isLeapSecond('2016-12-31T23:59:60Z')` returns `true`
- `isLeapSecond('2017-12-31T23:59:60Z')` returns `false` — well-formed, not in the table
- `isLeapSecond('2016-12-31T23:59:59Z')` returns `false`
- `nextLeapSecond` returns `""` for a current date
- `taiMinusUtc('2017-01-01T00:00:00Z')` and `taiMinusUtc('2100-01-01T00:00:00Z')` return `37`
- `pnpm run validate` stays green
