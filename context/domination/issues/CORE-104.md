# CORE-104 — Core: Lengths of time counted from now

**Scope:** One call for a length of time counted forward from now, written in calendar units ("one
year", "one month", "90 days"), and given back in the form the receiving format wants: a number of
seconds, an absolute epoch, an HTTP date or a UTC timestamp. The reverse job joins it: the seconds
left until a stored epoch or HTTP date. Every function returns the sentinel and never throws.

## Gap

A server hands out things that expire: cookies, tokens, signed links, cache entries, sessions. The
length is written in calendar terms, and its length in seconds depends on today's date:

- A cookie `Max-Age` of one year is `31536000` from 2026-06-15 and `31622400` from 2027-06-15: the
  second year spans 29 February 2028.
- A JWT `exp` one month ahead is `2419200` seconds away from 2027-02-10 and `2678400` from
  2027-03-10.

The hand-written `31_536_000` that every project repeats is a day short in a leap year. gmt can give
the right answer today, but only by composing functions whose link to "now" is not obvious:

- `totalDuration("P1Y", "seconds")` returns `null` with no `relativeTo`, and nothing points to now
  as the usual start.
- `relativeTo: getUtcNow()` returns `null` (a `Z` string is not a `relativeTo` in Temporal), while
  `getZonedNow("UTC")` works. The two look interchangeable.
- `getDaysInYear` measures the calendar year that holds the date, not the next 12 months: from
  2027-06-15 it returns `365`; the next 12 months are `366` days.
- `addUnix(getUnixNow(), { years: 1 })` gives an absolute epoch, but `addUnix` returns
  `number | null`, so each caller adds a guard.
- An HTTP date needs `addUtc(getUtcNow(), …)` and then `formatHttpDate(…)`.

Standards: [RFC 6265 §5.2](https://www.rfc-editor.org/rfc/rfc6265#section-5.2) (`Max-Age` in
delta-seconds, `Expires` as a date), [RFC 9110 §5.6.7](https://www.rfc-editor.org/rfc/rfc9110#section-5.6.7)
(HTTP-date), [RFC 7519 §2, §4.1.4–§4.1.6](https://www.rfc-editor.org/rfc/rfc7519#section-4.1.4)
(NumericDate for `exp`, `nbf`, `iat`; a small leeway for clock skew).

## Use cases

The issue's four examples, plus the same job in other places. Each row is one output form; the
architect decides which forms get a function.

| Job | Receives | Form | Standard |
| --- | --- | --- | --- |
| Cookie `Max-Age` | delta seconds | seconds from now | RFC 6265 §5.2.2 |
| Cookie or header `Expires` | HTTP date | date from now | RFC 6265 §5.2.1, RFC 9110 §5.6.7 |
| JWT `exp`, `nbf` | NumericDate | epoch seconds from now | RFC 7519 §4.1.4, §4.1.5 |
| `Cache-Control: max-age`, `s-maxage` | delta seconds | seconds from now | RFC 9111 §5.2.2.1 |
| `Strict-Transport-Security: max-age` (one or two years) | delta seconds | seconds from now | RFC 6797 §6.1.1 |
| OAuth `expires_in` sent with a token | delta seconds | seconds from now | RFC 6749 §5.1 |
| OAuth `expires_in` received → when to refresh | epoch | epoch from now plus N seconds | RFC 6749 §5.1 |
| Signed URL valid for 90 days | epoch seconds, or an ISO 8601 UTC time | epoch or UTC timestamp from now | — |
| Key-value or database TTL | relative seconds or ms, or an absolute epoch | seconds, ms or epoch from now | — |
| Password-reset or e-mail link (1 hour, 24 hours) | epoch | epoch from now | — |
| `Retry-After` received → how long to wait | delay-seconds or HTTP date | seconds until | RFC 9110 §10.2.3 |
| Rate-limit reset epoch → how long to wait | epoch | seconds until | — |
| "Expires in 3 days" on a token or a trial | epoch | seconds until, then `formatHumanDuration` | — |
| Is this token expired, with a leeway? | epoch | compare with now | RFC 7519 §4.1.4 |

The last four are the reverse job: time left until a stored instant. They share the "now" seam
and the units, so they belong in this story.

## Scope

Candidate functions, names and homes left to the `architect`. Each output form is its own
function with one return type ([no catch-all functions](../../coding-standards.md)):

- **Seconds from now** — `totalFromNow({ years: 1 }, "seconds")` → `31622400` from 2027-06-15.
  Milliseconds too, for stores that take them.
- **Epoch from now** — `addToNowUnix({ months: 1 }, { epochUnit: "seconds" })`, the `exp` value.
- **HTTP date from now** — `formatHttpDateFromNow({ years: 1 })` →
  `"Thu, 15 Jun 2028 12:00:00 GMT"` from 2027-06-15T12:00:00Z.
- **UTC timestamp from now** — `"2027-09-13T12:00:00Z"` for a signed-URL expiry or a database
  column.
- **Seconds until** an epoch or an HTTP date, negative or the sentinel once past (architect's
  call), and a `Retry-After` reader that takes either form.
- **Docs:** `totalDuration`'s page points to the new functions for "from now";
  `getDaysInYear`'s page says it is the calendar year, not the next 12 months; the `relativeTo`
  docs say a `Z` string is refused and `getZonedNow("UTC")` is the start to use.

Not in scope: a leeway policy or a token library. A leeway is a caller parameter.

## Tool

Left to `dox-architect`. Candidate: **Expiry Calculator**. Pick a length (1 year, 1 month, 90 days)
and a start date, and see the cookie `Max-Age`, the `Expires` header, the JWT `exp` and the
signed-URL time side by side. Moving the start across 29 February or a month end shows why a fixed
number of seconds is wrong. It ships with its Dox chat button.

## Design notes

- **The unit object `addUnix` takes**, so `{ years: 1 }` reads the same in both. Whether an ISO
  string (`"P1Y"`) or a human string (`"1y"`, through `parseHumanDuration`) is also accepted is
  the architect's call.
- **Calendar units count in UTC by default.** In a zone, one day across a clock change is 23 or 25
  hours: one day from 2026-03-28T12:00 in `Europe/Paris` is `82800` seconds; in UTC, `86400`.
  Whether a zone parameter is offered is the architect's call; the default stays UTC, as every
  receiving format above is UTC.
- **Seconds are POSIX seconds**, 86,400 to a day, as Temporal and every format above count them.
- **Each function is a thin wrapper over a pure one that takes a start**, so tests pin the start
  and never depend on the clock.
- **No built-in cap.** A draft revision of RFC 6265 has browsers cap `Max-Age` and `Expires` at 400
  days; a cap is the caller's to apply. The tool can show it.
- **Return types follow the `getUnixNow` pattern**: a typed call returns the bare type only when it
  cannot fail. A unit object can overflow Temporal's limits (`{ years: 300000 }`), so the sentinel
  probably stays; the architect confirms.

## What gmt provides (do not re-implement)

- `totalDuration` (`duration/calculate/`) — seconds across calendar units with a `relativeTo`
- `addUnix` (`unix/calculate/`) and `getUnixNow` (`unix/get/`) — the epoch form
- `addUtc` (`utc/calculate/`) and `getUtcNow` — the UTC timestamp form
- `formatHttpDate` (`utc/format/`) — the RFC 9110 IMF-fixdate writer; `isValidHttpDate` for the
  reverse job
- `getZonedNow` (`zoned/get/`) — the zoned start
- `parseHumanDuration` and `formatHumanDuration` (`duration/`) — human strings in and out

## Verification

- Seconds from now, start pinned:
  - `P1Y` from 2026-06-15 → `31536000`; from 2027-06-15 → `31622400`; from 2028-02-29 → `31536000`
    (ends 2029-02-28).
  - `P1M` from 2027-02-10 → `2419200`; from 2027-03-10 → `2678400`; from 2027-01-31 → `2419200`
    (ends 2027-02-28).
  - `P90D` from 2027-06-15T12:00:00Z → `7776000`.
  - `P1D` from 2026-03-28T12:00 `Europe/Paris` → `82800`; in UTC → `86400`.
- Epoch: one month from 2027-02-10T00:00:00Z → `1804636800`; 90 days from 2027-06-15T12:00:00Z →
  `1820836800`.
- HTTP date: one year from 2027-06-15T12:00:00Z → `Thu, 15 Jun 2028 12:00:00 GMT`.
- UTC timestamp: 90 days from 2027-06-15T12:00:00Z → `2027-09-13T12:00:00Z`.
- Seconds until: an epoch in the future, now, and in the past; `Retry-After: 120` and
  `Retry-After: <HTTP date>`.
- Sentinel rows: an empty or unknown unit object, an overflowing length, a malformed HTTP date.
- Full matrix: CI's 10 zones × Node 22, 24 and 26.
- `pnpm run validate` stays green.
