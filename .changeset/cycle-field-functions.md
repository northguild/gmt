---
"@burglekitt/gmt": minor
---

Add `cycleDate`, `cycleDateTime`, `cycleTime`, and `cycleZoned` (Story E6), matching
`@internationalized/date`'s `cycle(field, amount, options)` — the datepicker-segment-editing
primitive GMT had no equivalent for.

`cycle*` is not `add*`: it adjusts a single field and **wraps** at that field's own min/max instead
of carrying into the next larger field. Cycling December's `month` by `+1` stays in the same year
(`cycleDate("2024-12-15", "month", 1)` → `"2024-01-15"`), where `addDate(value, { months: 1 })`
correctly overflows into January of the *next* year — the right answer for arithmetic, but not for
"pressing Up on a month segment shouldn't silently change the year." No composition of `addDate`
calls can express this; the wrap boundary is a property of the field itself, not of an amount to add.

- `cycleDate`/`cycleTime`/`cycleDateTime` cycle a single field of a `PlainDate`/`PlainTime`/
  `PlainDateTime` string. `cycleZoned` does the same for a `ZonedDateTime` string, and additionally
  takes `disambiguation`/`offset` (default `offset: "ignore"`, the same C3 precedent as `setZoned`/
  `startOfZoned`) to resolve any DST gap or overlap the wrapped local time lands on.
- All four build on Story J1's field setters (`setDate`/`setDateTime`/`setTime`/`setZoned`),
  computing the wrapped target value and delegating to the matching setter for the atomic
  overflow/disambiguation/offset resolution — so cycling `month` or `year` can still clamp (or, with
  `overflow: "reject"`, reject) `day` exactly the way `setDate`'s own `.with()` call does.
- `options.round` does not round to the nearest increment — it steps to the *next* multiple of
  `amount` in the direction of its sign (ceiling for positive, floor for negative), matching
  `@internationalized/date`'s `CycleOptions.round` exactly.
- `cycleTime`'s `overflow` option is accepted for signature consistency but is inert: a cycled time
  field's wrapped value is always already in range, so there's nothing for `setTime`'s `.with()` to
  constrain or reject.
- No `hourCycle: 12` option — GMT's `hour` field always cycles `0–23`; a 12-hour, AM/PM-preserving
  wrap is a display/formatting concern with no ISO representation to round-trip through GMT's string
  contract.

Purely additive — no existing function's behavior changes.
