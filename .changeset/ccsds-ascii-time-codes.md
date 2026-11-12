---
"@northguild/gmt": minor
---

Four new functions read and write the two CCSDS ASCII time codes of CCSDS 301.0-B-4. The parsers are in `@northguild/gmt/timescale/parse` and the formatters are in `@northguild/gmt/timescale/format`. All four are also in `@northguild/gmt/timescale` and the root.

- `parseCcsdsAsciiA(value)` and `formatCcsdsAsciiA(isoString, fractionalSecondDigits?)` use Code A, which names the day by its calendar date: `1988-01-18T17:20:43.123456Z`.
- `parseCcsdsAsciiB(value)` and `formatCcsdsAsciiB(isoString, fractionalSecondDigits?)` use Code B, which names the day by its number in the year: `1988-018T17:20:43.123456Z`. Day 366 exists only in a leap year.

A parser takes the code and returns the instant as an ISO 8601 UTC string. The `Z` is optional on input, and a code without it still counts as UTC, never as local time. A formatter converts its input to UTC and always writes the `Z`. A parser needs the seconds: `2024-06-15` and `2024-06-15T10:30` name a span of time, not an instant, so they return `""`.

A parser keeps the fraction digits exactly as sent, trailing zeros included, up to nine. Digits after the ninth are dropped, never rounded. In a formatter, `fractionalSecondDigits` is `"auto"` (the default, the shortest fraction that keeps every nanosecond), `0` (no fraction and no period) or `1` to `9` (exactly that many digits). Extra digits are cut, never rounded, so the result never moves into the next second, day or year.

Second 60 is accepted, and written, only at the 27 inserted leap seconds in the built-in IERS table. `2016-12-31T23:59:60Z` is valid. `2017-12-31T23:59:60Z` is not.

```typescript
import { formatCcsdsAsciiA, formatCcsdsAsciiB, parseCcsdsAsciiA, parseCcsdsAsciiB } from "@northguild/gmt";

parseCcsdsAsciiA("1988-01-18T17:20:43.123456Z"); // "1988-01-18T17:20:43.123456Z"
parseCcsdsAsciiA("2024-06-15T10:30:00"); // "2024-06-15T10:30:00Z"
parseCcsdsAsciiB("1988-018T17:20:43.123456Z"); // "1988-01-18T17:20:43.123456Z"
parseCcsdsAsciiB("2024-366T12:00:00Z"); // "2024-12-31T12:00:00Z"
parseCcsdsAsciiA("2016-12-31T23:59:60Z"); // "2016-12-31T23:59:60Z"
parseCcsdsAsciiA("2017-12-31T23:59:60Z"); // ""
formatCcsdsAsciiA("2024-06-15T12:30:00.123456789+02:00", 6); // "2024-06-15T10:30:00.123456Z"
formatCcsdsAsciiA("2024-06-15T12:30:00.123456789+02:00"); // "2024-06-15T10:30:00.123456789Z"
formatCcsdsAsciiA("2024-06-15T12:30:00.123456789+02:00", 0); // "2024-06-15T10:30:00Z"
formatCcsdsAsciiB("2024-01-01T01:00:00+02:00"); // "2023-365T23:00:00Z"
formatCcsdsAsciiB("2016-12-31T23:59:60Z"); // "2016-366T23:59:60Z"
```

Every parser returns `""` for text that is not a code of its kind, such as a lower-case `t` or `z`, a comma for the decimal sign, a missing leading zero, a year outside 0001 to 9999 or a day that does not exist. Every formatter returns `""` for a date-time with no offset, a `fractionalSecondDigits` outside `"auto"` and 0 to 9, or input it cannot read. None of them throws.
