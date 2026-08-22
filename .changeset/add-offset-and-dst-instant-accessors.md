---
"@burglekitt/gmt": minor
---

Add offset and DST-instant accessors: `getZonedOffset`, `getZonedOffsetAs`, `getTimeZoneOffset`, `formatTimeZoneName`, `isInDaylightSaving` (Story J10).

GMT could construct and manipulate zoned values but couldn't report their UTC offset — `getZonedOffset(value)` returns it as a `±HH:MM` string; `getZonedOffsetAs(value, unit)` reads it as a number in `"minutes"` or `"nanoseconds"` (following J8's `getDurationUnit(value, unit)` precedent, replacing what would otherwise be a `getZonedOffsetMinutes`/`getZonedOffsetNanoseconds` pair). `getTimeZoneOffset(timeZone, instant)` looks up a zone's offset at an arbitrary instant without needing an existing zoned value in hand. `formatTimeZoneName(timeZone, locale, options?)` returns a zone's localized display name across all six `Intl.DateTimeFormatOptions` `timeZoneName` styles.

`isInDaylightSaving(value)` is the third DST-related function in the roadmap and answers a distinct question from the other two: `hasDaylightSaving(timeZone)` asks whether a zone observes DST *at all* (zone-level, no instant), `getDstTransitions(timeZone, year)` asks *where* a zone's transitions fall (enumerates instants), and `isInDaylightSaving(value)` asks whether *this particular instant* is currently in DST. `docs/dst-disambiguation.md` now documents all four (including `disambiguation`/`offset`, the orthogonal construction-time concern) as one table.

Both `getZonedOffset`/`getZonedOffsetAs` live in `zoned/parse/`, not `zoned/get/` — per J0b's rule, they take a date *value* rather than reporting on *now* or a bare timezone. `getTimeZoneOffset` stays in `zoned/get/` alongside `getDstTransitions`, since neither argument is a value being described, both are coordinates for a zone-level lookup.

Updated `packages/gmt/README.md`, `packages/gmt/src/zoned/README.md`, `docs/dst-disambiguation.md`, and the `zoned-date-ops` skill.
