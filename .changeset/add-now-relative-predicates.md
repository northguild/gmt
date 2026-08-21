---
"@burglekitt/gmt": minor
---

Add now-relative predicates: `isRelativeDay`, `isThisUnit`, `isPast`, `isFuture`, and their zoned counterparts `isZonedRelativeDay`, `isZonedThisUnit`, `isZonedPast`, `isZonedFuture` (Story J6).

`isRelativeDay(value, offsetDays)` subsumes `isToday`/`isYesterday`/`isTomorrow` (`offsetDays: 0`/`-1`/`1`, or any other integer offset); `isThisUnit(value, unit, locale?)` subsumes `isThisWeek`/`isThisMonth`/`isThisYear`. Per Decision 5 in `context/roadmap/issues/J.md`, GMT ships one parameterized function per axis rather than date-fns's eleven near-duplicate named functions. `isPast`/`isFuture` stay separate — genuinely distinct before/after-now predicates, not one more value on an enumerable axis.

The plain functions compare against `getToday()` and so depend on the **system clock and system timeZone** — the same call can return a different answer on hosts in different timeZones at the same instant. The zoned variants resolve "today"/"now" in the value's own timeZone instead, making them deterministic regardless of the host machine's timeZone; `isZonedPast`/`isZonedFuture` additionally compare the exact instant rather than just the calendar day, since a `ZonedDateTime` carries a full time-of-day where a `PlainDate` does not.
