---
"@northguild/gmt": minor
---

`isInDaylightSaving` and `hasDaylightSaving` now read daylight time from a zone's own clock changes, and `hasDaylightSaving` takes a reference instant in `options.at` (Story CORE-77). `getDstTransitions`, `startOfZoned` and `getHoursInZonedDay` now find two clock changes that fall less than 14 days apart.

Before, both functions compared a zone's 15 January and 15 July offsets, and `hasDaylightSaving` did so for the year 2024 only. A zone that moved its standard time during a year then read as being in daylight time afterwards: `Europe/Istanbul` has stayed at `+03:00` since 2016, and December 2016 read as daylight time.

```typescript
import { getDstTransitions, hasDaylightSaving, isInDaylightSaving } from "@northguild/gmt";

isInDaylightSaving("2015-07-01T12:00:00+03:00[Europe/Istanbul]"); // true — the clocks went back on 2015-11-08
isInDaylightSaving("2016-12-01T12:00:00+03:00[Europe/Istanbul]"); // false — was true
isInDaylightSaving("2019-07-15T12:00:00+01:00[Europe/Dublin]"); // true
isInDaylightSaving("2024-01-15T12:00:00+11:00[Australia/Sydney]"); // true — southern summer

hasDaylightSaving("Australia/Sydney", { at: "2024-06-15T12:00:00Z" }); // true — winter; the next period begins in October
hasDaylightSaving("Europe/Istanbul", { at: "2015-06-15T12:00:00Z" }); // true
hasDaylightSaving("Europe/Istanbul", { at: "2016-06-15T12:00:00Z" }); // false
hasDaylightSaving("America/Sao_Paulo", { at: "2018-06-15T12:00:00Z" }); // true
hasDaylightSaving("America/Sao_Paulo", { at: "2019-06-15T12:00:00Z" }); // false — the last period ended 2019-02-17

getDstTransitions("America/Boa_Vista", 2000).length; // 3 — was 1
```

- **The rule is GMT's own definition, not the tz database's daylight flag.** No JavaScript API exposes that flag, and it cannot be worked out from offsets. GMT holds no zone data: it reads the zone's offset changes from the runtime.
- **The rule.** Daylight time runs from a forward change of a zone's clocks to the backward change that undoes it. A backward change undoes the most recent forward change of the same size not yet undone, if it comes less than 365 days after it. An instant is in daylight time when it is at or after such a forward change and before its backward change.
- **A forward change never undone, or undone 365 days or more later, is a change of standard time.** `Europe/Istanbul` is on standard time from its last advance in March 2016.
- **The higher of two alternating offsets is the daylight one**, as in the tz database's rearguard form. `Europe/Dublin` is in daylight time in summer, and `Africa/Casablanca` in its months at `+01:00`. The database's main form names Dublin's winter and Casablanca's Ramadan weeks as daylight time.
- **Read as standard time, because the offsets do not show otherwise:**
  - the last summer before a zone kept its daylight offset for good. The tz database dates Istanbul's switch 2016-09-07, with no clock change, so GMT reads March to September 2016 as standard time;
  - a daylight period held 365 days or longer (`America/Santiago`, 2014 to 2016);
  - a daylight period that began, ended or was interrupted by a move of standard time, so the clocks went back by another amount or not at all (`America/Kentucky/Monticello` 2000, `Asia/Tomsk` 2002, `Asia/Jerusalem` 1948);
  - a daylight period whose end is past the last instant Temporal can represent.
- **Read as daylight time:** a move of standard time reversed by the same amount less than 365 days later (`America/Metlakatla`, 2018 to 2019).
- **`hasDaylightSaving(timeZone, { at })` answers for a reference instant.** It is `true` when the zone is in daylight time at `at`, or a daylight period begins less than 365 days after it. So a zone in its winter is `true`, and a zone that has stopped changing its clocks is `false`. `at` is an ISO 8601 instant string: `Z`, an offset, or a zoned string. A bracketed zone on `at` does not choose the zone that is judged; `timeZone` does.
- **Pass `at` for an answer that does not depend on the day the code runs.** Without it the reference is the current instant. An invalid `at`, such as the date `"2024-01-15"`, returns `false`.
- **The answer can change when the runtime's time zone data does.** An answer for a past instant changes when that data learns that a zone stopped changing its clocks.
- **Calls cost more.** On Node 24, `isInDaylightSaving` takes 0.2 to 0.6 ms a call where 1.17 took 0.05 ms, and `hasDaylightSaving` 0.4 to 1.1 ms where 1.17 took 0.03 ms. Each call searches the zone's clock changes, up to 365 days either side, and GMT keeps no cache. Cache the result yourself if you call either in a loop.
- **Two clock changes less than 14 days apart are now found.** `America/Boa_Vista`, `America/Noronha` and `America/Recife` went forward on 8 October 2000 and back on 15 October. The Temporal polyfill GMT runs on steps through a zone 14 days at a time and missed both changes. `getDstTransitions` now lists them, and a day beside them has the right start and length.

### Breaking changes

`isInDaylightSaving`:

| Call | 1.17 | 1.18 |
| --- | --- | --- |
| `isInDaylightSaving("2016-12-01T12:00:00+03:00[Europe/Istanbul]")` | `true` | `false` |
| `isInDaylightSaving("2016-07-01T12:00:00+03:00[Europe/Istanbul]")` | `true` | `false` |
| `isInDaylightSaving("2011-07-01T12:00:00+04:00[Europe/Moscow]")` | `true` | `false` |
| `isInDaylightSaving("2018-12-01T12:00:00+09:00[Asia/Pyongyang]")` | `true` | `false` |
| `isInDaylightSaving("2016-07-01T12:00:00-04:00[America/Caracas]")` | `true` | `false` |
| `isInDaylightSaving("1996-07-01T12:00:00+06:30[Asia/Colombo]")` | `true` | `false` |
| `isInDaylightSaving("2019-12-01T12:00:00+01:00[Africa/Casablanca]")` | `false` | `true` |
| `isInDaylightSaving("+275760-09-12T20:00:00-04:00[America/New_York]")` | `true` | `false` |

`hasDaylightSaving`. 1.17 took no options and compared January with July 2024:

| 1.17 call | 1.17 | 1.18 call | 1.18 |
| --- | --- | --- | --- |
| `hasDaylightSaving("Africa/Casablanca")` | `false` | `hasDaylightSaving("Africa/Casablanca", { at: "2024-06-15T12:00:00Z" })` | `true` |
| `hasDaylightSaving("America/Sao_Paulo")` | `false` | `hasDaylightSaving("America/Sao_Paulo", { at: "2018-06-15T12:00:00Z" })` | `true` |
| `hasDaylightSaving("America/Asuncion")` | `true` | `hasDaylightSaving("America/Asuncion", { at: "2026-06-15T12:00:00Z" })` | `false` |

Two clock changes less than 14 days apart:

| Call | 1.17 | 1.18 |
| --- | --- | --- |
| `getDstTransitions("America/Boa_Vista", 2000)` | one change, `2000-02-27T03:00:00Z` | three: that one, `2000-10-08T04:00:00Z` and `2000-10-15T03:00:00Z` |
| `startOfZoned("2000-10-08T01:00:00-03:00[America/Boa_Vista]", "day")` | `"2000-10-07T23:00:00-04:00[America/Boa_Vista]"` | `"2000-10-08T01:00:00-03:00[America/Boa_Vista]"` |
| `getHoursInZonedDay("2000-10-08T12:00:00-03:00[America/Boa_Vista]")` | `null` | `23` |
| `getHoursInZonedDay("2000-10-08T12:00:00-01:00[America/Noronha]")` | `-8881` | `23` |

Unchanged: a zone that changes its clocks twice a year reads as before, in both hemispheres. So does a zone that has never changed its clocks, a fixed offset and `UTC`.

Migration:

- **`hasDaylightSaving(timeZone)` now answers for the current instant, not for 2024.** Pass `{ at }` wherever the result is stored, compared or tested. To ask about 2024, pass an instant in 2024.
- **A stored `isInDaylightSaving` result** for a zone that moved its standard time can be wrong under the new rule. Recompute it.
- **For where a zone's offset changes, use `getDstTransitions(timeZone, year)`.** It lists every change and classifies none of them. For the offset itself, use `getZonedOffset`.
