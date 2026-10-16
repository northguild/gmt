---
"@northguild/gmt": minor
---

Add the `timescale/` namespace for leap seconds and TAI, and the `gnss/` namespace for the time scales of six satellite navigation systems (Stories MAR-16 and SPA-48). `getFiscalPeriod` and `getQuarter` now take the 53rd-week placement and the fiscal year label from the caller. Three changes break existing code, and **Breaking changes** covers each: `isLeapSecond` in `plain/` is renamed `hasSecond60`, a fiscal calendar needs two new fields, and the hours-of-work functions move from `@northguild/gmt/duty` to `@northguild/gmt/workforce`.

UTC has leap seconds. TAI and most satellite time scales do not. So the offset between UTC and a satellite clock is not a constant: it grew by one second with each of the 27 leap seconds inserted since 1972. A receiver's week number also wraps, so one week number names several dates decades apart. The new functions take every offset from the IERS leap-second table built into GMT, never from a literal.

```typescript
import {
  fromTAI,
  gnssToUtc,
  gnssWeekToUtc,
  isLeapSecond,
  leapSecondsBetween,
  nextLeapSecond,
  rinexWeekToUtc,
  taiMinusUtc,
  toTAI,
  utcToGnss,
  utcToGnssWeek,
  utcToRinexWeek,
} from "@northguild/gmt";

// The leap-second table.
taiMinusUtc("2024-01-01T00:00:00Z"); // 37
taiMinusUtc("2016-01-01T00:00:00Z"); // 36
taiMinusUtc("1971-01-01T00:00:00Z"); // null (before 1972)
leapSecondsBetween("2000-01-01T00:00:00Z", "2024-01-01T00:00:00Z"); // 5
nextLeapSecond("2016-01-01T00:00:00Z"); // "2016-12-31T23:59:60Z"
nextLeapSecond("2024-01-01T00:00:00Z"); // "" (there are no more)
isLeapSecond("2016-12-31T23:59:60Z"); // true
isLeapSecond("2024-12-31T23:59:60Z"); // false (well-formed, but no leap second that day)

// TAI.
toTAI("2026-01-01T00:00:00Z"); // "2026-01-01T00:00:37 TAI"
toTAI("2016-12-31T23:59:60.5Z"); // "2017-01-01T00:00:36.5 TAI"
fromTAI("2017-01-01T00:00:36 TAI"); // "2016-12-31T23:59:60Z"

// Six satellite time scales, one pair of functions for all of them.
utcToGnss("GPS", "1980-01-06T00:00:00Z"); // "1980-01-06T00:00:00 GPS" (0 s at the GPS epoch)
utcToGnss("GPS", "2024-01-01T00:00:00Z"); // "2024-01-01T00:00:18 GPS"
utcToGnss("BDT", "2024-01-01T00:00:00Z"); // "2024-01-01T00:00:04 BDT"
utcToGnss("GAL", "1999-08-22T00:00:00Z"); // "1999-08-22T00:00:13 GAL"
utcToGnss("GLO", "2016-12-31T23:59:60Z"); // "2016-12-31T23:59:60 GLO" (UTC's own clock)
gnssToUtc("GPS", "2017-01-01T00:00:17 GPS"); // "2016-12-31T23:59:60Z"

// A broadcast week: name the counter and the era.
gnssWeekToUtc("GPS-LNAV", 100, 0, 0); // "1981-12-05T23:59:59Z"
gnssWeekToUtc("GPS-LNAV", 100, 0, 1); // "2001-07-21T23:59:47Z" (era 1: 1024 GPS weeks later)
gnssWeekToUtc("GPS-LNAV", 1020, 0, { notBefore: "2019-04-07T00:00:00Z" }); // "2038-10-23T23:59:42Z"
utcToGnssWeek("GPS-LNAV", "2019-04-07T00:00:00Z"); // { week: 0, timeOfWeekSeconds: 18, era: 2 }
utcToGnssWeek("GAL", "2019-04-07T00:00:00Z"); // { week: 1024, timeOfWeekSeconds: 18, era: 0 }

// A RINEX navigation-file week never wraps.
rinexWeekToUtc("IRN", 2295, 86418); // "2024-01-01T00:00:00Z"
utcToRinexWeek("BDT", "2021-07-05T21:59:56Z"); // { week: 809, timeOfWeekSeconds: 165600 }
```

- **`timescale/` holds the IERS leap-second table as a closed record.** The table runs to the last insertion, 2016-12-31, and is current through IERS Bulletin C 72 (6 July 2026). The CGPM decided in 2026 that UTC becomes continuous on 20 May 2027, so TAI − UTC stays 37 s for every later date. No function takes a table argument. A weekly check in this repository compares the table with the IERS file.
- **`taiMinusUtc`, `leapSecondsBetween` and `nextLeapSecond` read the table.** Before 1972-01-01, TAI − UTC was fractional, so each returns the sentinel there instead of a whole number. `leapSecondsBetween` is signed, and counts a leap second when its second starts, at `23:59:60.000`, inside `[start, end)`.
- **`isLeapSecond` is a table lookup.** It is true for the 27 inserted seconds only, in any offset spelling. A smeared clock never reads `23:59:60`, so GMT cannot detect smearing. For the syntax test alone, use `hasSecond60`.
- **The `timescale/` and `gnss/` functions accept a listed second 60.** `"2016-12-31T23:59:60Z"` is a real instant to them, and a second 60 on any other day returns the sentinel. Every other GMT function still rejects a second of 60.
- **`toTAI` and `fromTAI` convert between UTC and a TAI string**, `YYYY-MM-DDTHH:MM:SS[.fraction] TAI`. The token is the FITS 4.0 time-scale name.
- **`gnss/` treats six systems as peers:** GPS, Galileo, BeiDou, QZSS, GLONASS and NavIC, named by their RINEX 4.02 time-system tokens `GPS`, `GAL`, `BDT`, `QZS`, `GLO` and `IRN`. No system is a default, and none has functions of its own.
- **`utcToGnss` and `gnssToUtc` convert between UTC and a system's time-scale string**, such as `"2024-01-01T00:00:18 GPS"`. GPS, Galileo, QZSS and NavIC time run 19 s behind TAI, and BeiDou time 33 s. `GLO` is GLONASS time as RINEX reports it: UTC's own hours, leap seconds included, not UTC + 3 h. Each system returns the sentinel before its own epoch. The offsets are nominal: the nanosecond corrections a satellite broadcasts are not applied.
- **`gnssWeekToUtc` and `utcToGnssWeek` read a broadcast week by its counter.** Each `GnssWeekCounter` has one modulus. `"GPS-LNAV"`, `"QZS-LNAV"` and `"IRN-LNAV"` wrap every 1024 weeks, `"GAL"` every 4096, and `"GPS-CNAV"`, `"QZS-CNAV"`, `"BDT"` and `"IRN-L1NV"` every 8192. GLONASS has no week counter.
- **`rolloverEra` is required**, because a week number alone cannot say which pass of the counter it belongs to. Pass an integer era for stored data. Pass `"rolling"` for live receiver output: it picks the era within half a counter period of today, so it reads the clock. Pass `{ notBefore }` to take the earliest match at or after an instant you state, such as a receiver's firmware build date. It gives the same answer in any year.
- **`rinexWeekToUtc` and `utcToRinexWeek` read the week of a RINEX navigation record.** That week is a continuous count that never wraps, from 1980 for GPS, Galileo, QZSS and NavIC, and from 2006 for BeiDou, so it has no era. A RINEX NavIC week read as a broadcast NavIC week is 1024 weeks off, which is why the two kinds of week have separate functions.
- Also exported: the `GnssSystem`, `GnssWeekCounter`, `RolloverEra`, `GnssWeek`, `RinexWeekSystem` and `RinexWeek` types, and the `@northguild/gmt/timescale`, `/timescale/calculate`, `/timescale/convert`, `/timescale/validate`, `@northguild/gmt/gnss` and `/gnss/convert` subpaths.

**Fiscal calendars.** IFRS 18 ¶29 (formerly IAS 1 ¶37) does not preclude a reporting period of 52 weeks, and no international standard says where a 53rd week goes or which calendar year names the fiscal year. Published calendars disagree on both. The NRF 4-5-4 calendar (US) adds the week to the last period and names the year by the year it starts in. The ONS retail trading periods (UK) add it to the first period and name the year by the calendar year that holds most of it. IFRS 18 ¶27(c) (formerly IAS 1 ¶51(c)) identifies a reporting period by the date it ends. IFRS 18 replaces IAS 1 for reporting periods beginning on or after 2027-01-01. So the caller now states both choices, and there is no default.

```typescript
import { getFiscalPeriod, getQuarter, isValidFiscalCalendar } from "@northguild/gmt";

const ons = { pattern: "4-4-5", yearEndsOn: "2022-12-31", extraWeek: "firstPeriod", yearLabel: "majorityYear" } as const;
getFiscalPeriod("2024-12-29", ons); // { year: 2025, period: 1, week: 1 } (ONS 2025 opens in December 2024)
getFiscalPeriod("2025-02-01", ons); // { year: 2025, period: 1, week: 5 } (a five-week January)

const nrf = { pattern: "4-5-4", yearEndsOn: "2026-01-31", extraWeek: "lastPeriod", yearLabel: "endYear" } as const;
getFiscalPeriod("2024-01-28", nrf); // { year: 2024, period: 12, week: 53 } (week 53, named by the year it ends in)

getQuarter("2023-10-15", { fiscalYearStartMonth: 7, yearLabel: "majorityYear" }); // { year: 2023, quarter: 2 }
isValidFiscalCalendar({ pattern: "4-5-4", yearEndsOn: "2026-01-31" }); // false (no extraWeek or yearLabel)
```

- **`extraWeek` is the period a 53rd week is added to:** `"firstPeriod"` or `"lastPeriod"`. It has no effect in a 52-week year.
- **`yearLabel` names the fiscal year:** `"startYear"`, `"endYear"` or `"majorityYear"`, the calendar year holding the most of its days. It is a field of `FiscalCalendar` and an option of `getQuarter`. When two calendar years hold 182 days each, `"majorityYear"` gives the end year, because IFRS 18 ¶27(c) (formerly IAS 1 ¶51(c)) identifies a period by its end date. For `getQuarter`, start months 1 to 7 put the most days in the start year and 8 to 12 in the end year, so a month-based fiscal year never ties.
- **`year` is still not a unique key for every year end.** A 364- or 371-day year drifts against the calendar, so each label rule has a few year ends where two fiscal years share a label. The JSDoc lists them. If your year end is one of them, key on the fiscal year's start date.
- **New validators.** `isValidFiscalCalendar` checks a whole calendar, so you can tell a bad calendar from a date `getFiscalPeriod` cannot place. `isValidFiscalExtraWeek` and `isValidFiscalYearLabel` narrow a string read from configuration.
- **Fix: `getFiscalPeriod` returns a value for every date Temporal accepts.** 1.19 returned `null` near Temporal's first and last dates when the fiscal year ran past that limit. `getFiscalPeriod("-271821-04-19", { pattern: "4-5-4", yearEndsOn: "2026-01-31", extraWeek: "lastPeriod", yearLabel: "startYear" })` now returns `{ year: -271821, period: 3, week: 12 }`.
- **Fix: an array is not a fiscal calendar.** 1.19 read an array with `pattern` and `yearEndsOn` set as properties as a calendar. `getFiscalPeriod` now returns `null` for any array, and `isValidFiscalCalendar` returns `false`, as `isValidBusinessCalendar` does.
- Also exported: the `FiscalExtraWeek` and `FiscalYearLabel` types.

**Other changes.**

- **The pattern parsers read names in `"en"` when no locale is given**, not `"en-US"`. This covers `parseDateWithPattern`, `parseDateTimeWithPattern` and `parseTimeWithPattern`. CLDR gives `"en"` the same month, weekday, era and AM/PM names as `"en-US"`, so every result is unchanged.
- **The NRF 4-5-4 calendar is described as one published example (US), not the retail standard.** The JSDoc quotes NRF's current wording: a 53rd week is added when "there are four or more days left in January".
- **`isBusinessDay`'s fixed Monday-to-Friday week is described correctly.** ISO 8601 defines no weekend. Saturday and Sunday off is CLDR's world default.
- **The JSDoc examples use zones and locales from several countries**, such as London, Tokyo, Sydney, São Paulo, Johannesburg and Kolkata. Only the zone and its offset changed in each example, and every changed result was run again.
- **The notes for readers moving from date-fns are corrected.** date-fns numbers Sunday 0, so `nextDay(value, 0)` becomes `nextWeekday(value, 7)`, and `previousDay` maps the same way. date-fns starts a week on Sunday by default, so `isSameWeek(a, b)` becomes `areDatesEqualBy(a, b, "week", { weekStartsOn: "sunday" })`. Rules that cited another library now cite ECMA-402, UTS #35 or Temporal.

### Breaking changes

**1. `isLeapSecond` in `plain/` is renamed `hasSecond60`.** The name `isLeapSecond` now belongs to the table lookup in `timescale/`. An import from `@northguild/gmt/plain` or `@northguild/gmt/plain/validate` fails to compile. An import from `@northguild/gmt` still compiles and now runs the lookup, so its result can change with no type error:

| Call | 1.19 | 1.20 |
| --- | --- | --- |
| `isLeapSecond("2024-06-15T12:34:60Z")` | `true` | `false` (no leap second can occur at 12:34) |
| `isLeapSecond("2024-12-31T23:59:60Z")` | `true` | `false` (no leap second that day) |
| `isLeapSecond("23:59:60")` | `true` | `false` (not an instant) |
| `isLeapSecond("2016-12-31T23:59:60Z")` | `true` | `true` |

```typescript
// 1.19: the syntax test
import { isLeapSecond } from "@northguild/gmt/plain/validate";
isLeapSecond("2024-06-15T12:34:60Z"); // true

// 1.20: the same test, renamed
import { hasSecond60 } from "@northguild/gmt/plain/validate";
hasSecond60("2024-06-15T12:34:60Z"); // true

// 1.20: whether a leap second was inserted
import { isLeapSecond } from "@northguild/gmt/timescale";
isLeapSecond("2024-06-15T12:34:60Z"); // false
isLeapSecond("2016-12-31T23:59:60Z"); // true
```

Migration: to keep the 1.19 result, rename the call and its import to `hasSecond60`. Its arguments and results are the same. To ask whether a second 60 is a real leap second, use `isLeapSecond`.

**2. A fiscal calendar needs `extraWeek` and `yearLabel`, and fiscal `getQuarter` options need `yearLabel`.**

| Call that compiled in 1.19 | 1.20 | Migration |
| --- | --- | --- |
| `getFiscalPeriod(value, { pattern, yearEndsOn })` | a type error, and `null` at run time | add `extraWeek: "lastPeriod", yearLabel: "startYear"` |
| `getQuarter(value, { fiscalYearStartMonth })` | a type error, and `null` at run time | add `yearLabel: "startYear"` |
| `getQuarter(value, {})` | a type error, and `null` at run time | drop the options to get calendar quarters |

```typescript
// 1.19
getFiscalPeriod("2024-01-28", { pattern: "4-5-4", yearEndsOn: "2026-01-31" }); // { year: 2023, period: 12, week: 53 }
// 1.20, the same result
getFiscalPeriod("2024-01-28", { pattern: "4-5-4", yearEndsOn: "2026-01-31", extraWeek: "lastPeriod", yearLabel: "startYear" }); // { year: 2023, period: 12, week: 53 }

// 1.19
getQuarter("2024-03-31", { fiscalYearStartMonth: 4 }); // { year: 2023, quarter: 4 }
// 1.20, the same result
getQuarter("2024-03-31", { fiscalYearStartMonth: 4, yearLabel: "startYear" }); // { year: 2023, quarter: 4 }
```

Migration: each migration in the table gives exactly the 1.19 result. `fiscalYearStartMonth` no longer defaults to `1`. If you added one to `year` to label a fiscal year by the year it ends in, pass `yearLabel: "endYear"` and remove the `+ 1`. `getQuarter` with no options still returns calendar quarters.

**3. The hours-of-work functions move to `@northguild/gmt/workforce`.** Hours-of-work rules serve drivers, seafarers, rail crew, flight crew and resident doctors alike, so they sit in a workforce layer of their own. The `/duty` subpaths are removed, and no alias is kept.

| 1.19 | 1.20 |
| --- | --- |
| `@northguild/gmt/duty` | `@northguild/gmt/workforce` |
| `@northguild/gmt/duty/calculate` | `@northguild/gmt/workforce/calculate` |
| `@northguild/gmt/duty/validate` | `@northguild/gmt/workforce/validate` |

```typescript
// 1.19
import { evaluateDutyLog } from "@northguild/gmt/duty";
import { isValidDutyLog } from "@northguild/gmt/duty/validate";

// 1.20
import { evaluateDutyLog } from "@northguild/gmt/workforce";
import { isValidDutyLog } from "@northguild/gmt/workforce/validate";
```

Migration: change the import path. The function names, the types, the arguments and the results are the same, and an import from `@northguild/gmt` is unchanged.
