---
"@northguild/gmt": minor
---

Add `isValidUtcTimestamp`, a check that a string is a real UTC instant written `YYYY-MM-DDTHH:MM:SS[.f]Z` and nothing else (Story CORE-78). That is the plain RFC 3339 spelling, the one readers other than Temporal expect. Use it for a timestamp from a request, or for one headed for storage.

`isValidUtc` answers a wider question: can Temporal read this string as a UTC instant? It is also true for four forms outside RFC 3339 §5.6: a time without seconds, a comma before the fraction, an expanded `±YYYYYY` year and an RFC 9557 annotation. `isValidUtcTimestamp` is false for all four. `isValidUtc` does not change.

```typescript
import { isValidUtc, isValidUtcTimestamp } from "@northguild/gmt";

isValidUtcTimestamp("2026-10-06T12:00:00Z"); // true
isValidUtcTimestamp("2026-10-06T12:00:00.123456789Z"); // true (nine fraction digits)
isValidUtcTimestamp("0000-01-01T00:00:00Z"); // true (year 0000)

// The four forms `isValidUtc` accepts and this check does not.
isValidUtc("2026-10-06T12:00:00Z[Europe/Paris]"); // true
isValidUtcTimestamp("2026-10-06T12:00:00Z[Europe/Paris]"); // false (RFC 9557 annotation)
isValidUtcTimestamp("2026-10-06T12:00:00,5Z"); // false (comma before the fraction)
isValidUtcTimestamp("-005000-01-01T00:00:00Z"); // false (expanded year)
isValidUtcTimestamp("2026-10-06T12:00Z"); // false (no seconds)

// Other spellings RFC 3339 allows, and instants that do not exist.
isValidUtcTimestamp("2026-10-06t12:00:00z"); // false (lower-case t and z)
isValidUtcTimestamp("2026-10-06T12:00:00+00:00"); // false (a numeric offset, not Z)
isValidUtcTimestamp("2026-02-30T00:00:00Z"); // false (February has no 30th)
isValidUtcTimestamp("2016-12-31T23:59:60Z"); // false (leap second)
```

- **The shape is one spelling of the RFC 3339 §5.6 `date-time`.** A four-digit year, `0000` to `9999`. An upper-case `T`. A time with seconds. An optional fraction of one to nine digits after a dot. An upper-case `Z`, with nothing after it. `Temporal.Instant.prototype.toString()`, called with no options, writes this shape for those years.
- **The instant is checked as well as the shape.** A day that does not exist is false. The `rfc3339DateTime` pattern alone matches 30 February. Every string that is true here is also true for `isValidUtc`.
- **It is not the whole RFC 3339 grammar.** A lower-case `t` or `z`, a space in place of the `T`, and a numeric offset are all false, `+00:00` included. `isValidRfc3339DateTime` checks the whole grammar, with the same two GMT limits.
- **A leap second is false**, as everywhere in GMT. Temporal would read `:60` as `:59`.
- **It does not pick one spelling of an instant.** `12:00:00Z` and `12:00:00.000Z` are the same instant, and both are true.
- **A reader's range and precision are its own.** A reader may still refuse or round a string that is true here: PostgreSQL has no year `0000` and keeps microseconds. See `toPgMicroseconds` and the `precision/` functions.
