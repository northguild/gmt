---
"@burglekitt/gmt": minor
---

Add a GMT-native calendar-annotated `ZonedDateTime` string and make `zoned/` calendar-aware (Story E7), deliberately restoring — with a grammar, tests and docs — the capability E5's decision D2 removed.

The new grammar adds a time, a UTC offset and an IANA zone to E1's plain calendar string:

```
<calendar-native-date>T<time><offset>[u-ca=<id>[;era=<era>]][<timeZone>]

5784-06-15T14:30:00-05:00[u-ca=hebrew][America/New_York]
0031-04-30T12:00:00+09:00[u-ca=japanese;era=heisei][Asia/Tokyo]
7517-12-30T00:30:00-04:00[u-ca=ethiopic-amete-alem][America/Santiago]
```

`convertZonedToCalendar(value, calendar)` produces it across all 13 supported calendar systems, keeping the instant, wall time, offset and zone unchanged; `isValidCalendarZonedDateTime` and `isValidCalendarZonedInterval` validate it. `addZoned`, `subtractZoned`, `diffZoned`, `diffZonedAsDuration` and the 17 `zoned/interval/*` functions now accept it alongside bare ISO strings.

This closes a gap that was categorically impossible to compose around: adding one Hebrew month to a date in `America/New_York` needs calendar-unit arithmetic and DST resolution in the *same* operation. Doing the calendar step first applies DST to an already-resolved wall time; doing the zoned step first leaves no calendar to step in. `addZoned("5784-06-15T14:30:00-05:00[u-ca=hebrew][America/New_York]", { months: 1 })` now returns `"5784-07-15T14:30:00-04:00[u-ca=hebrew][America/New_York]"` — Adar I to Adar and EST to EDT together, one calendar day away from the ISO answer for the same input. The calendar tag, era, wall time and UTC offset are always re-derived from the arithmetic result, never copied: a Japanese Heisei value crossing 2019-05-01 comes back tagged Reiwa.

**The `[u-ca=...]` segment precedes `[timeZone]` — the reverse of RFC 9557, deliberately.** GMT's digits are calendar-native (Hebrew year 5784, not ISO year 5784), so the string is never valid RFC 9557 to begin with, and the `;era=` suffix is not valid RFC 9557 at any ordering. The RFC-legal ordering is the dangerous one: `Temporal.ZonedDateTime.from("5784-01-01T14:30:00-05:00[America/New_York][u-ca=hebrew]")` *succeeds* and silently reads 5784 as an ISO year — a ~3760-year misparse with no error anywhere. GMT's ordering makes that shape uniformly rejected instead.

**Purely additive — no existing behavior changes.** `isValidZonedDateTime` and `isValidZonedInterval` are deliberately left untouched and still reject every `[u-ca=...]` annotation, so the ~72 `zoned/` functions outside this story's scope (`formatZonedDateTime`, `roundZoned`, `setZoned`, `startOfZoned`, `parseDateFromZoned`, `convertZonedToUtc`, and the rest) continue to return their sentinel for a calendar-annotated value. Loosening them would have made `isValidZonedDateTime(x) === true` while `getZonedYear(x) === null` — a validator certifying strings the library still refuses. `addZonedBusinessDays`/`subtractZonedBusinessDays` also stay out by design: day-of-week is ISO-fixed in every supported calendar, so a tag would change nothing while implying it might.

Mixed-calendar endpoints follow the split E5 established for `plain/`: ordering functions accept them (ordering is calendar-independent — `Temporal.Instant` has no calendar field at all); the eight value-returning set operations require one shared calendar and return their sentinel on a mismatch; measurement functions (`diffZoned`, `diffZonedAsDuration`, `intervalCountZoned`, `intervalLengthZoned`, `splitIntervalByUnitZoned`) measure in the shared calendar when both tags match and fall back to Gregorian otherwise. That fallback is mandatory rather than merely convenient here: unlike `PlainDate`, `Temporal.ZonedDateTime.prototype.until` throws across mismatched calendars for *every* unit, including pure time units like hours.

**Two pre-existing latent bugs fixed along the way.** `addZoned` and `intervalFromDurationZoned` both rebuilt their non-`"compatible"` disambiguation path via `` `${x.toPlainDateTime().toString()}[${x.timeZoneId}]` ``. That was harmless while every input was plain ISO, but a calendared `toPlainDateTime().toString()` emits Temporal's own `[u-ca=...]` annotation, so appending the zone produced the forbidden segment ordering and silently degraded every non-default `disambiguation` to `""`/`null`. Both now round-trip the rebuild through bare ISO and re-attach the calendar to the result; `subtractZoned` had the same shape and was fixed alongside.

Decisions of record, the reversed `(b→a→b)` audit verdicts, and the unanticipated findings are recorded permanently in `context/roadmap/issues/E.md`'s new "E7 outcome" section. Extending `duration/`'s `relativeTo` to accept the zoned grammar was explicitly left out of scope as a follow-up.
