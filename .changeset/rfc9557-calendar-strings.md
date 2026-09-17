---
"@northguild/gmt": minor
---

Write calendar strings in the standard RFC 9557 form, the ISO date followed by `[u-ca=<id>]`, and name calendars by their CLDR and Temporal ids (Story CORE-8).

GMT's calendar strings carried the calendar's own year, month and day digits: the Hebrew New Year 5785 was `"5785-01-01[u-ca=hebrew]"`. No standard defines that form. Temporal's `PlainDate#toString()` always writes the ISO date, and RFC 9557 §3.3 says `u-ca` names the calendar a date is preferably shown in, not the calendar of its digits. Every standard parser, Temporal included, therefore read GMT's strings as a different date without an error. `;era=` was not RFC 9557 syntax, and the zoned form put `[u-ca=…]` before the time zone, the reverse of RFC 9557 §4.1.

```typescript
import { addDate, convertDateToCalendar } from "@northguild/gmt/plain";
import { convertZonedToCalendar } from "@northguild/gmt/zoned";

convertDateToCalendar("2024-10-03", "hebrew"); // "2024-10-03[u-ca=hebrew]"
convertDateToCalendar("2024-10-03", "islamicc"); // "2024-10-03[u-ca=islamic-civil]"
convertZonedToCalendar("2024-10-03T14:30:45-04:00[America/New_York]", "hebrew"); // "2024-10-03T14:30:45-04:00[America/New_York][u-ca=hebrew]"
addDate("2024-10-03[u-ca=hebrew]", { months: 1 }); // "2024-11-02[u-ca=hebrew]"
```

- **Output is exactly Temporal's.** `convertDateToCalendar` and every function that returns a calendar string write `Temporal.PlainDate#toString()` or `Temporal.ZonedDateTime#toString()`. Only `iso8601` has no annotation; `gregory` is written `[u-ca=gregory]`. A zoned string ends `…[timeZone][u-ca=<id>]`.
- **Calendar ids are the CLDR and Temporal ids,** in strings and as function arguments alike: `iso8601`, `gregory`, `hebrew`, `islamic-civil`, `islamic-tbla`, `islamic-umalqura`, `japanese`, `buddhist`, `roc`, `persian`, `indian`, `ethiopic`, `ethioaa` and `coptic`. Temporal's aliases and any letter case are accepted, and the canonical id is written (`islamicc` → `islamic-civil`, `ethiopic-amete-alem` → `ethioaa`, `HEBREW` → `hebrew`). `chinese`, `dangi`, `islamic` and `islamic-rgsa` are not supported.
- **Input is read as Temporal reads it.** A critical `[!u-ca=…]` is accepted, and the flag is not written back. Elective annotations such as `[foo=bar]` and a time zone annotation on a date are ignored. The first `u-ca` names the calendar. An unknown critical annotation, or a second `u-ca` when either is critical, is rejected. A calendar date-time such as `"2024-10-03T14:30[u-ca=hebrew]"` is read as its date. The part before the first `[` must still be GMT's written shape, so basic format (`20241003[u-ca=hebrew]`), a space or lower-case `t` separator, and an offset are rejected.
- **Different calendars follow Temporal's `CalendarEquals` check.** `diffDate`, `diffDateAsDuration`, `diffZoned`, `diffZonedAsDuration`, the `intervalCount*`, `intervalLength*`, `splitIntervalByUnit*` and `intervalOverlappingDays*` functions, and the value-returning interval set operations in `plain/` and `zoned/`, return their sentinel for two different calendars. A bare ISO string is `iso8601`. Temporal's ordering has no calendar check, so `intervalsOverlap*`, `intervalContains*`, `intervalEngulfs*`, `intervalAbuts*`, `isValidDateInterval` and `isValidCalendarZonedInterval` still accept mixed calendars.
- **`relativeTo`** in `durationAs`, `normalizeDuration` and `compareDurations` reads a calendar string as Temporal's `ParseTemporalRelativeToString` does: zoned when it has a time zone annotation, otherwise a date.

```typescript
import { diffDate, intervalsOverlapDate, isValidCalendarDate } from "@northguild/gmt/plain";
import { durationAs } from "@northguild/gmt/duration";

isValidCalendarDate("2024-10-03T14:30[u-ca=hebrew]"); // true
isValidCalendarDate("2024-10-03[foo=bar][u-ca=hebrew]"); // true
isValidCalendarDate("20241003[u-ca=hebrew]"); // false
diffDate("2024-10-03", "2024-11-03[u-ca=hebrew]", "days"); // null
intervalsOverlapDate("2024-10-03[u-ca=hebrew]", "2024-10-10", "2024-10-05", "2024-10-20"); // true
durationAs("P1M", "days", { relativeTo: "2024-02-10[!u-ca=hebrew]" }); // 30
```

### Breaking changes

Every calendar string changes. There is no converter from the old strings: no standard defines them, and an old string cannot be told apart from a valid RFC 9557 one.

| Call | 1.15 | 1.16 |
| --- | --- | --- |
| `convertDateToCalendar("2024-10-03", "hebrew")` | `"5785-01-01[u-ca=hebrew]"` | `"2024-10-03[u-ca=hebrew]"` |
| `convertDateToCalendar("2024-10-03", "japanese")` | `"0006-10-03[u-ca=japanese;era=reiwa]"` | `"2024-10-03[u-ca=japanese]"` |
| `convertDateToCalendar("2024-10-03", "ethiopic")` | `"2017-01-23[u-ca=ethiopic;era=ethiopic]"` | `"2024-10-03[u-ca=ethiopic]"` |
| `convertDateToCalendar("1000-01-01", "taiwan")` | `"-911-01-01[u-ca=taiwan]"` | `""`; with `"roc"`: `"1000-01-01[u-ca=roc]"` |
| `convertDateToCalendar("+275760-09-13", "hebrew")` | `"279517-10-11[u-ca=hebrew]"` | `"+275760-09-13[u-ca=hebrew]"` |
| `convertDateToCalendar("5785-01-01[u-ca=hebrew]", "gregorian")` | `"2024-10-03"` | `""`; with `"iso8601"`: `"5785-01-01"` |
| `convertZonedToCalendar("2024-10-03T14:30:45-04:00[America/New_York]", "hebrew")` | `"5785-01-01T14:30:45-04:00[u-ca=hebrew][America/New_York]"` | `"2024-10-03T14:30:45-04:00[America/New_York][u-ca=hebrew]"` |
| `addDate("5784-06-15[u-ca=hebrew]", { months: 1 })` | `"5784-07-15[u-ca=hebrew]"` | `"5784-07-14[u-ca=hebrew]"`, reading ISO 5784-06-15 |
| `diffDate("2024-10-03", "2024-11-03[u-ca=hebrew]", "days")` | `-1373406`, reading Hebrew year 2024 | `null` |

Calendar ids renamed:

| 1.15 | 1.16 |
| --- | --- |
| `gregorian` | `iso8601` (or `gregory`, which writes `[u-ca=gregory]`) |
| `taiwan` | `roc` |
| `islamic-tabular` | `islamic-tbla` |
| `ethiopic-amete-alem` | `ethioaa` (the old id is still accepted as Temporal's alias) |

Migration:

- **Regenerate every stored calendar string from its ISO date** with `convertDateToCalendar` or `convertZonedToCalendar`. Do not parse the old strings. Most of them are also valid RFC 9557, so `"5785-01-01[u-ca=hebrew]"` is now read, silently, as ISO year 5785. Only four old shapes are rejected: `;era=`, an unsigned 5- or 6-digit year, a negative year without six digits (`-911`), and `[u-ca=…]` before the time zone.
- **`;era=` is gone**, including the `;era=japanese` input alias. `convertDateToCalendar("1800-01-01[u-ca=japanese;era=ce]", "iso8601")` is `""`.
- **Replace the renamed ids** in calls and stored annotations. `gregorian`, `taiwan` and `islamic-tabular` return the sentinel.
- **Difference two dates in one calendar.** Convert one side first with `convertDateToCalendar`, then call `diffDate`.
