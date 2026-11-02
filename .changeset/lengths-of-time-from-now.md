---
"@northguild/gmt": minor
---

Add 19 functions for a length of time counted from now (Story CORE-104): one year, one month or 90 days, given back as seconds, an epoch, an HTTP date or a UTC timestamp, and the seconds left until a stored time. The seconds in "one year" depend on today's date: 31536000 from 2026-06-15, 31622400 from 2027-06-15, because the second year holds 29 February 2028. A hand-written `31_536_000` is a day short in that case.

```typescript
import { ttlFromNow, getUtcIn, formatHttpDateFromNow, secondsUntilRetryAfter } from "@northguild/gmt";

ttlFromNow({ days: 90 });
// { seconds: 7776000, milliseconds: 7776000000, epochSeconds: 1820836800,
//   httpDate: "Mon, 13 Sep 2027 12:00:00 GMT", iso: "2027-09-13T12:00:00Z" }  (from 2027-06-15T12:00:00Z)
getUtcIn({ months: 1 }); // "2027-07-15T12:00:00Z"
formatHttpDateFromNow({ years: 1 }); // "Thu, 15 Jun 2028 12:00:00 GMT"
secondsUntilRetryAfter("120"); // 120
```

- **A length from now, one form per function:** `getUnixIn`, `getUnixAgo`, `getUtcIn`, `getUtcAgo`, `getDateIn`, `getDateAgo`, `getDateTimeIn`, `getDateTimeAgo`, `getTimeIn`, `getTimeAgo`, `getZonedIn` (zone first), `getZonedAgo`, `formatHttpDateFromNow`, `totalUnitsFromNow` and `ttlFromNow`. They take a unit object such as `{ days: 90 }`. A duration string, an empty object or a negative amount returns the sentinel, so `null` still means bad input only. The name gives the direction: a past `Expires` is `formatHttpDate(getUtcAgo({ days: 1 }))`.
- **Counted in UTC.** Unix, UTC, HTTP-date and `ttlFromNow` results do not change with the server's time zone. `totalUnitsFromNow` takes a `timeZone` option for a wall-clock count, and `getZonedIn` and `getZonedAgo` count on the zone's wall clock. The plain functions start from the system zone, so `getDateIn({ days: 0 })` equals `getToday()`.
- **`ttlFromNow` reads the clock once**, so `seconds`, `milliseconds`, `epochSeconds`, `httpDate` and `iso` name the same instant. If any form cannot be written (a result past year 9999, for example) the whole result is `null`.
- **The reverse job:** `secondsUntilUnix`, `secondsUntilHttpDate` and `secondsUntilRetryAfter` return the whole seconds left, rounded up, and a negative number once the time has passed. `secondsUntilRetryAfter` takes either form of a `Retry-After` header. `spanSeconds` returns the signed, fractional seconds between two instants, like `spanMs` in another unit.
- **No cap on a length.** A draft revision of RFC 6265 has browsers limit `Max-Age` and `Expires` to 400 days; applying that limit is the caller's choice.

**Behaviour change:** near a clock change, in either direction, some results were wrong and are now right: `totalDuration`, `normalizeDuration`, `diffZoned`, `diffZonedAsDuration`, `intervalLengthZoned`, and, with a `timeZone`, `diffUnix`, `diffUnixAsDuration` and `intervalLengthUnix`. `formatRelativeZoned`, `formatRelativeUnix` and `formatRelativeUtc` change too. Where the Temporal specification has no value for the case (tc39/proposal-temporal [#3336](https://github.com/tc39/proposal-temporal/issues/3336), [#3311](https://github.com/tc39/proposal-temporal/issues/3311) and [#3310](https://github.com/tc39/proposal-temporal/issues/3310)), these functions now return the sentinel (`null` or `""`) instead of a number. For example, `totalDuration("-PT23H20M", "days", { relativeTo: "2024-03-11T02:30:00-04:00[America/New_York]" })` returned about `-1.0145` and now returns `null`. A caller that read that number now gets `null`, so check for it.
