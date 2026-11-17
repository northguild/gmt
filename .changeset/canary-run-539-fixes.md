---
"@northguild/gmt": patch
---

Formatted dates are right in four more cases.

- A Coptic date before year 1 AM prints its signed year and the era AM, as the Intl era and month code proposal numbers it: ISO `-0001-07-10` is `Epep 18, -285 AM`. Engines on ICU 78 printed `Epep 18, 286` with no era, which names a different year.
- In WebKit (Safari), the first day of year 1 AH in `islamic-civil`, `islamic-tbla` and `islamic-umalqura` prints as year 1 AH. WebKit printed its first hours as year 0 `Before Hijra`.
- In WebKit, formatting an Islamic-calendar range no longer stops responding. GMT's range check asked the polyfill for a date before 1 AH, which never returns in WebKit.
- In WebKit, an English time range that starts at noon with a long day period keeps both periods: `12:00 noon - 12:25 in the afternoon`.

On Node and Chromium only the Coptic change shows; Firefox 147 and later already printed all four right. Each repair stays off on an engine that prints the date right.
