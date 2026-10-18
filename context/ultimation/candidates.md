# Ultimation candidates

Gaps known before the parity matrix exists. Each is unnumbered: ULT-1's matrix confirms or
removes it, and a candidate becomes a story only under the rule in [index.md](index.md). Items
marked "verify" were read from the source tree, not from a test.

| Candidate | Known gap | What would qualify it |
| --- | --- | --- |
| Pattern-based output formatting | GMT parses with patterns but formats only through `Intl`. | A token grammar from CLDR skeletons or LDML patterns, never an invented one. |
| Year-month, month-day, year-week, year-quarter, day-of-year as values | Getters exist; no functions take `2024-W06`, `2024-Q4`, `2024-06` or `--12-25` as inputs (verify). Temporal has `PlainYearMonth` and `PlainMonthDay`. | ISO 8601-1 forms and Temporal's types; HLTH-35's partial dates cover part. |
| Chinese and Dangi calendars | Declared unsupported in `types/calendar-system.ts`; `@js-temporal/polyfill` throws reading them. | A polyfill release that reads them, then the calendar test matrix extended. |
| Non-UTC time scales | Partly shipped with MAR-16 and SPA-48; the rest is the Space chain. | The scale and format lists of the IERS Conventions and the IAU resolutions. |
| tzdb awareness | GMT cannot report the host's tzdb release or compare rules. Includes reading a caller-supplied TZif file and comparing its rules with the host's. | RFC 9636. Note: zic 2023d to 2026a, in slim mode, write a file that breaks RFC 9636 §3.3 when compiling tzdb 2026b or later data; `zic -b fat` avoids it (tzdb 2026b NEWS). Independent loading stays a limit until Temporal accepts custom zone data. |
| Recurrence beyond RFC 5545 | CORE-84 covers `RRULE` and cron. Not covered: RFC 7529 `RSCALE` and `SKIP`, and frequency-alias vocabularies. | RFC 7529 for non-Gregorian recurrence; an alias vocabulary only from a published grammar. |
| Natural-language date parsing | "next Friday at 3pm" is absent. | A published, locale-aware grammar that returns ambiguity instead of guessing; otherwise a non-goal. |
| Windows zone names and metazones | GMT takes IANA identifiers only. | CLDR `windowsZones` and `metaZones`, standards-body data behind an opt-in subpath. |
| Open-ended intervals and date ranges | ISO 8601-2 `..` and date-range operations distinct from instant intervals (verify against `interval/`). | ISO 8601-2. |
| Additional chronologies | Julian, a cutover calendar and others. Historical calendars are parked in the Domination epic. | A recorded consumer; otherwise a documented non-goal. |
| SQL interval and timestamp text | SQL standard `INTERVAL` literals and interval output styles beside the existing SQL date-time formatter (verify what `formatSqlDateTime` covers). | ISO/IEC 9075. |
| A published conformance corpus | The suite's expected values recorded as JSON vectors, runners per engine and a public scoreboard. | A named consumer outside GMT that would run the vectors. |

Human durations (CORE-85), monotonic and hybrid logical clocks (the IoT realm) and leap
seconds (SPA-48) are already planned or shipped, so they are not candidates.
