## 6. Edge-case test matrix (continued)

### 6.9 Week functions

`gnssWeekToUtc`:

| Call | Expected |
| --- | --- |
| `("GPS-LNAV", 100, 0, 0)` | `"1981-12-05T23:59:59Z"` |
| `("GPS-LNAV", 100, 0, 1)` | `"2001-07-21T23:59:47Z"` |
| `("GPS-LNAV", 100, 0, 2)` | `"2021-03-06T23:59:42Z"` |
| `("GPS-LNAV", 100, 0, 3)` | `"2040-10-20T23:59:42Z"` |
| `("GAL", 100, 0, 0)` | `"2001-07-21T23:59:47Z"` |
| `("GAL", 100, 0, 1)` | `"2080-01-20T23:59:42Z"` |
| `("BDT", 100, 0, 0)` | `"2007-12-02T00:00:00Z"` |
| `("BDT", 100, 0, 1)` | `"2164-12-01T23:59:56Z"` |
| `("QZS-LNAV", 100, 0, 0)` | `"1981-12-05T23:59:59Z"` |
| `("GPS-CNAV", 100, 0, 0)` | `"1981-12-05T23:59:59Z"` |
| `("GPS-CNAV", 100, 0, 1)` | `"2138-12-06T23:59:42Z"` |
| `("GPS-LNAV", 0, 0, 0)` | `"1980-01-06T00:00:00Z"` |
| `("GPS-LNAV", 0, 0, 1)` | `"1999-08-21T23:59:47Z"` (first rollover, R§8) |
| `("GPS-LNAV", 0, 0, 2)` | `"2019-04-06T23:59:42Z"` (second, R§8) |
| `("GPS-LNAV", 0, 0, 3)` | `"2038-11-20T23:59:42Z"` (third, R§8) |
| `("GPS-CNAV", 0, 0, 1)` | `"2137-01-05T23:59:42Z"` (first CNAV wrap, R§8) |
| `("GAL", 0, 0, 1)` | `"2078-02-19T23:59:42Z"` (R§8) |
| `("BDT", 0, 0, 1)` | `"2163-01-01T23:59:56Z"` (R§8) |
| `("GAL", 0, 0, 0)` | `"1999-08-21T23:59:47Z"` |
| `("BDT", 0, 0, 0)` | `"2006-01-01T00:00:00Z"` |
| `("GPS-LNAV", 247, 86418, 2)`, `("QZS-LNAV", 247, 86418, 2)` | `"2024-01-01T00:00:00Z"` |
| `("GPS-CNAV", 2295, 86418, 0)`, `("QZS-CNAV", 2295, 86418, 0)` | `"2024-01-01T00:00:00Z"` |
| `("GAL", 1271, 86418, 0)` | `"2024-01-01T00:00:00Z"` |
| `("BDT", 939, 86404, 0)` | `"2024-01-01T00:00:00Z"` |
| `("GPS-LNAV", 906, 16, 1)` | `"2016-12-31T23:59:59Z"` |
| `("GPS-LNAV", 906, 17, 1)`, `("GPS-CNAV", 1930, 17, 0)` | `"2016-12-31T23:59:60Z"` |
| `("GPS-LNAV", 906, 17.5, 1)` | `"2016-12-31T23:59:60.5Z"` |
| `("GPS-LNAV", 906, 18, 1)` | `"2017-01-01T00:00:00Z"` |
| `("GPS-LNAV", 0, 0.1, 2)` | `"2019-04-06T23:59:42.1Z"` |
| `("GPS-LNAV", 392, 345618, 2)` | `"2026-10-15T00:00:00Z"` |
| `("GPS-LNAV", 1023, 604799, 2)` | `"2038-11-20T23:59:41Z"` |
| `("GPS-CNAV", 8191, 0, 0)` | `"2136-12-29T23:59:42Z"` |
| `("IRN-LNAV", 0, 0, 0)` | `"1999-08-21T23:59:47Z"` (NavIC epoch) |
| `("IRN-LNAV", 0, 0, 1)` | `"2019-04-06T23:59:42Z"` (first NavIC 10-bit wrap, R§5a.7) |
| `("IRN-LNAV", 0, 0, 2)` | `"2038-11-20T23:59:42Z"` (R§5a.7) |
| `("IRN-L1NV", 0, 0, 1)` | `"2156-08-21T23:59:42Z"` (first 13-bit wrap, R§5a.7) |
| `("IRN-LNAV", 247, 86418, 1)`, `("IRN-L1NV", 1271, 86418, 0)` | `"2024-01-01T00:00:00Z"` |
| `("IRN-L1NV", 2295, 86418, 0)` | `"2043-08-17T00:00:00Z"` — the D12 trap: a RINEX week fed to a broadcast counter. The test pins it beside the `rinexWeekToUtc` row that reads the same number correctly |
| `("IRN-LNAV", 2295, 86418, 1)` | `""` (out of range: the 10-bit counters reject a RINEX week) |
| week `1024` (LNAV), `4096` (GAL), `8192` (CNAV, BDT), `-1`, `1.5`, `NaN`, `"1"` | `""` |
| TOW `604800`, `-0.5`, `NaN`, `Infinity`, `"0"`, `604799.9999999999` (rounds to a full week) | `""` |
| TOW `604799.999999999`, GPS-LNAV week 0 era 1 | not `""` |
| era `-1`, `1.5`, `"1"`, `"current"`, `null` | `""` |
| counter `"GPS"`, `"BDS"`, `"QZS"`, `"IRN"`, `"LNAV"`, `"CNAV"` | `""` |
| `("GLO" as never, 100, 0, 0)` with `// @ts-expect-error` | `""` (MAR-16) |

**Era spacing (MAR-16 verification, restated exactly):** for week 100, eras 0 and 1 give labels
exactly 1024 weeks apart (`GPS-LNAV`), 4096 (`GAL`) and 8192 (`BDT`); assert via
`utcToGnss(system, result)`: GPS `"1981-12-06T00:00:00 GPS"` and `"2001-07-22T00:00:00 GPS"`; GAL
`"2001-07-22T00:00:00 GAL"` and `"2080-01-21T00:00:00 GAL"`; BDT `"2007-12-02T00:00:00 BDT"` and
`"2164-12-02T00:00:00 BDT"`. The UTC strings differ by that many weeks **less** the leap seconds
between them (12 s for GPS).

`utcToGnssWeek`:

| Call | Expected |
| --- | --- |
| `("GPS-LNAV", "2019-04-07T00:00:00Z")` | `{ week: 0, timeOfWeekSeconds: 18, era: 2 }` (MAR-16: era 2) |
| `("GPS-CNAV", "2019-04-07T00:00:00Z")` | `{ week: 2048, timeOfWeekSeconds: 18, era: 0 }` |
| `("GAL", "2019-04-07T00:00:00Z")` | `{ week: 1024, timeOfWeekSeconds: 18, era: 0 }` (MAR-16: era 0) |
| `("BDT", "2019-04-07T00:00:00Z")` | `{ week: 692, timeOfWeekSeconds: 4, era: 0 }` |
| `("QZS-LNAV", "2019-04-07T00:00:00Z")` | `{ week: 0, timeOfWeekSeconds: 18, era: 2 }` |
| `("GPS-LNAV", "2024-01-01T00:00:00Z")` | `{ week: 247, timeOfWeekSeconds: 86418, era: 2 }` |
| `("GPS-CNAV", "2024-01-01T00:00:00Z")`, `("QZS-CNAV", …)` | `{ week: 2295, timeOfWeekSeconds: 86418, era: 0 }` |
| `("GAL", "2024-01-01T00:00:00Z")` | `{ week: 1271, timeOfWeekSeconds: 86418, era: 0 }` |
| `("BDT", "2024-01-01T00:00:00Z")` | `{ week: 939, timeOfWeekSeconds: 86404, era: 0 }` |
| `("GPS-LNAV", "1980-01-06T00:00:00Z")` | `{ week: 0, timeOfWeekSeconds: 0, era: 0 }` |
| `("GPS-LNAV", "2016-12-31T23:59:60Z")` | `{ week: 906, timeOfWeekSeconds: 17, era: 1 }` |
| `("GPS-LNAV", "2024-01-01T00:00:00.5Z")` | `{ week: 247, timeOfWeekSeconds: 86418.5, era: 2 }` |
| `("GPS-LNAV", "2024-01-01T00:00:00.123456789Z")` | `{ week: 247, timeOfWeekSeconds: 86418.123456789, era: 2 }` |
| `("GPS-LNAV", "2019-04-06T23:59:41.999999999Z")` | `{ week: 1023, timeOfWeekSeconds: 604799.999999999, era: 1 }` |
| `("GPS-LNAV", "2019-04-06T23:59:42Z")` | `{ week: 0, timeOfWeekSeconds: 0, era: 2 }` |
| `("GPS-LNAV", "1999-08-21T23:59:47Z")` | `{ week: 0, timeOfWeekSeconds: 0, era: 1 }` |
| `("GAL", "1999-08-21T23:59:47Z")` | `{ week: 0, timeOfWeekSeconds: 0, era: 0 }` |
| `("BDT", "2006-01-01T00:00:00Z")` | `{ week: 0, timeOfWeekSeconds: 0, era: 0 }` |
| `("GPS-LNAV", "2027-06-28T00:00:00Z")` | `{ week: 429, timeOfWeekSeconds: 86418, era: 2 }` |
| `("GPS-LNAV", "2100-01-01T00:00:00Z")` | `{ week: 116, timeOfWeekSeconds: 432018, era: 6 }` |
| `("IRN-LNAV", "2024-01-01T00:00:00Z")` | `{ week: 247, timeOfWeekSeconds: 86418, era: 1 }` |
| `("IRN-L1NV", "2024-01-01T00:00:00Z")` | `{ week: 1271, timeOfWeekSeconds: 86418, era: 0 }` |
| `("IRN-LNAV", "2019-04-07T00:00:00Z")` | `{ week: 0, timeOfWeekSeconds: 18, era: 1 }` |
| `("IRN-LNAV", "1999-08-21T23:59:46Z")` | `null` |
| `("GPS-LNAV", "1980-01-05T23:59:59Z")`, `("GAL", "1999-08-21T23:59:46Z")`, `("BDT", "2005-12-31T23:59:59Z")` | `null` |
| `("GLO" as never, …)` | `null` |

**Round trip:** for every non-null row, `gnssWeekToUtc(counter, r.week, r.timeOfWeekSeconds, r.era)`
returns the input.

**`"rolling"`** — `vi.spyOn(Temporal.Now, "instant").mockReturnValue(Temporal.Instant.from("2026-10-15T00:00:00Z"))`
(the `yearWindowStart.test.ts` pattern). At that instant GPS is LNAV week 392, era 2 (full week
2440), TOW 345618:

| Call | Expected |
| --- | --- |
| `gnssWeekToUtc("GPS-LNAV", 100, 0, "rolling")` | `"2021-03-06T23:59:42Z"` (era 2) |
| `gnssWeekToUtc("GPS-LNAV", 1023, 0, "rolling")` | `"2019-03-30T23:59:42Z"` (era 1) |
| `gnssWeekToUtc("GPS-LNAV", 904, 0, "rolling")` | `"2036-08-02T23:59:42Z"` (era 2, full week 2952) |
| `gnssWeekToUtc("QZS-LNAV", 100, 0, "rolling")` | `"2021-03-06T23:59:42Z"` |
| `gnssWeekToUtc("GPS-CNAV", 100, 0, "rolling")` | `"1981-12-05T23:59:59Z"` (era 0) |
| `gnssWeekToUtc("GAL", 100, 0, "rolling")` | `"2001-07-21T23:59:47Z"` (era 0) |
| `gnssWeekToUtc("BDT", 100, 0, "rolling")` | `"2007-12-02T00:00:00Z"` (era 0) |
| `gnssWeekToUtc("IRN-LNAV", 100, 0, "rolling")` | `"2021-03-06T23:59:42Z"` (NavIC full week 1416 now; era 1) |
| `mockTemporalNowInstantThrow()` | `""` |

The spy also proves the clock is read once per call and never for a numeric era or a pivot.

**`{ notBefore }` pivot** (§3.9; values from the reference run):

| Call | Expected |
| --- | --- |
| `gnssWeekToUtc("GPS-LNAV", 1020, 0, { notBefore: "2019-01-01T00:00:00Z" })` | `"2019-03-09T23:59:42Z"` (era 1: pivot before the 2019 rollover) |
| `gnssWeekToUtc("GPS-LNAV", 1020, 0, { notBefore: "2019-04-07T00:00:00Z" })` | `"2038-10-23T23:59:42Z"` (era 2: pivot after it) |
| `gnssWeekToUtc("GPS-LNAV", 100, 0, { notBefore: "2010-01-01T00:00:00Z" })` | `"2021-03-06T23:59:42Z"` (era 2) |
| `gnssWeekToUtc("GPS-LNAV", 0, 0, { notBefore: "2019-04-06T23:59:42Z" })` | `"2019-04-06T23:59:42Z"` (exactly equal: counts) |
| `gnssWeekToUtc("GPS-LNAV", 0, 0, { notBefore: "2019-04-06T23:59:42.000000001Z" })` | `"2038-11-20T23:59:42Z"` (1 ns after: next era) |
| `gnssWeekToUtc("GPS-LNAV", 0, 0, { notBefore: "2019-04-06T23:59:41.999999999Z" })` | `"2019-04-06T23:59:42Z"` |
| `gnssWeekToUtc("GPS-CNAV", 100, 0, { notBefore: "2000-01-01T00:00:00Z" })` | `"2138-12-06T23:59:42Z"` (13-bit: era 1) |
| `gnssWeekToUtc("GPS-CNAV", 2295, 86418, { notBefore: "2020-01-01T00:00:00Z" })` | `"2024-01-01T00:00:00Z"` (era 0) |
| `gnssWeekToUtc("GPS-CNAV", 8191, 0, { notBefore: "2026-10-15T00:00:00Z" })` | `"2136-12-29T23:59:42Z"` |
| `gnssWeekToUtc("BDT", 939, 86404, { notBefore: "2020-01-01T00:00:00Z" })` | `"2024-01-01T00:00:00Z"` |
| `gnssWeekToUtc("GAL", 1271, 86418, { notBefore: "2020-01-01T00:00:00Z" })` | `"2024-01-01T00:00:00Z"` |
| `gnssWeekToUtc("IRN-LNAV", 247, 86418, { notBefore: "2020-01-01T00:00:00Z" })` | `"2024-01-01T00:00:00Z"` (era 1) |
| `gnssWeekToUtc("GPS-LNAV", 906, 17, { notBefore: "2016-01-01T00:00:00Z" })` | `"2016-12-31T23:59:60Z"` (an inserted second) |
| `gnssWeekToUtc("GPS-LNAV", 100, 0, { notBefore: "1980-01-06T00:00:00Z" })` | `"1981-12-05T23:59:59Z"` (pivot at the epoch: era 0) |
| `gnssWeekToUtc("GPS-LNAV", 0, 0, { notBefore: "1980-01-06T00:00:00Z" })` | `"1980-01-06T00:00:00Z"` |
| `gnssWeekToUtc("GAL", 100, 0, { notBefore: "1999-01-01T00:00:00Z" })` | `"2001-07-21T23:59:47Z"` (pivot before Galileo's epoch: era 0) |
| `gnssWeekToUtc("GPS-LNAV", 100, 0, { notBefore: "1979-12-31T00:00:00Z" })` | `"1981-12-05T23:59:59Z"` (pivot before the GPS epoch: era 0) |
| `gnssWeekToUtc("GPS-LNAV", 0, 0, { notBefore: "+275760-09-01T00:00:00Z" })` | `""` (result beyond Temporal's instant range) |
| `notBefore`: `"2019-04-07"` (date only), `"2019-04-07T00:00:00"` (no offset), `"2017-12-31T23:59:60Z"` (unlisted second 60), `123`, missing (`{}`), `null` | `""` |
| `{ notBefore: "2019-01-01T00:00:00Z", extra: 1 }` | same as without `extra` |
| a getter on `notBefore` | read once (spy count 1) |

**Property:** for each counter and each pivot row above that returns a value, the result `r`
satisfies `r ≥ notBefore` and `r − period < notBefore` (compared as labels with `utcToGnss`), and
`utcToGnssWeek(counter, r)` returns the same `week`.

### 6.9a RINEX weeks (`rinexWeekToUtc`, `utcToRinexWeek`)

| Call | Expected |
| --- | --- |
| `rinexWeekToUtc("GPS", 0, 0)` | `"1980-01-06T00:00:00Z"` |
| `rinexWeekToUtc("GPS", 2295, 86418)`, `("QZS", 2295, 86418)`, `("IRN", 2295, 86418)`, `("GAL", 2295, 86418)` | `"2024-01-01T00:00:00Z"` (RINEX Table A30, Table 3) |
| `rinexWeekToUtc("GPS", 1930, 17)` | `"2016-12-31T23:59:60Z"` |
| `rinexWeekToUtc("GPS", 3072, 0)` | `"2038-11-20T23:59:42Z"` |
| `rinexWeekToUtc("BDT", 809, 165600)` | `"2021-07-05T21:59:56Z"` (RINEX 4.02 Table A27: C05, 2021-07-05 22:00 BDT; `utcToGnss("BDT", it)` is `"2021-07-05T22:00:00 BDT"`) |
| `rinexWeekToUtc("BDT", 939, 86404)` | `"2024-01-01T00:00:00Z"` |
| `utcToRinexWeek("BDT", "2021-07-05T21:59:56Z")` | `{ week: 809, timeOfWeekSeconds: 165600 }` |
| `utcToRinexWeek("BDT", "2024-01-01T00:00:00Z")` | `{ week: 939, timeOfWeekSeconds: 86404 }` |
| `utcToRinexWeek("BDT", "2005-12-31T23:59:59Z")` | `null` |
| week `-1`, `1.5`, `NaN`; TOW `604800`, `-1` | `""` |
| `("GLO" as never, 2295, 0)` with `// @ts-expect-error` | `""` |
| `utcToRinexWeek("IRN", "2024-01-01T00:00:00Z")`, `("GPS", …)` | `{ week: 2295, timeOfWeekSeconds: 86418 }` |
| `utcToRinexWeek("GPS", "2016-12-31T23:59:60Z")` | `{ week: 1930, timeOfWeekSeconds: 17 }` |
| `utcToRinexWeek("GPS", "1980-01-05T23:59:59Z")` | `null` |

**The trap, pinned (D12):** the same number 2295 gives `"2024-01-01T00:00:00Z"` through
`rinexWeekToUtc("IRN", 2295, 86418)` and `"2043-08-17T00:00:00Z"` through
`gnssWeekToUtc("IRN-L1NV", 2295, 86418, 0)`. Both rows sit in one test named for the trap.

**Round trip:** for every non-null `utcToRinexWeek` row, `rinexWeekToUtc` returns the input.
