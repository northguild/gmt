---
"@northguild/gmt": minor
---

Add `parseSqlOffsetDateTime` and `isValidSqlOffsetDateTime`, which read the timestamp-with-time-zone text a database prints, and the `sqlOffsetDateTime` regex they match. PostgreSQL `timestamptz` prints `2024-03-15 14:30:00+00`, and SQL Server `datetimeoffset` prints `2007-05-08 12:35:29.1234567 +12:15`. Neither is the RFC 3339 form the library's other readers take: PostgreSQL may print an hour-only offset (`+00`), and SQL Server puts a space before the offset. Until now no function in the library read them.

`parseSqlOffsetDateTime` returns an ISO 8601 date-time that keeps the offset, or `""` when the text is not a SQL offset timestamp. `isValidSqlOffsetDateTime` returns `true` for the same text. It accepts a value of any type, and a `true` result narrows it to `string`. A date that does not exist, such as 30 February, is rejected by both.

```typescript
import { parseSqlOffsetDateTime } from "@northguild/gmt/instant/parse";
import { isValidSqlOffsetDateTime } from "@northguild/gmt/instant/validate";

parseSqlOffsetDateTime("2024-03-15 14:30:00-08"); // "2024-03-15T14:30:00-08:00"
parseSqlOffsetDateTime("2007-05-08 12:35:29.1234567 +12:15"); // "2007-05-08T12:35:29.1234567+12:15"
parseSqlOffsetDateTime("2024-03-15 14:30:00"); // "" (no offset: use parseSqlDateTime)

isValidSqlOffsetDateTime("2024-03-15 14:30:00+00"); // true
isValidSqlOffsetDateTime("2024-02-30 00:00:00+00"); // false
```

The result keeps the offset the database printed, so pass it to `toOffsetInstant` to get the instant. To write a value for a database, use `fromOffsetInstant` or `formatRfc3339`: every major database reads that ISO 8601 form.

- The new subpath `@northguild/gmt/instant/parse` holds `parseSqlOffsetDateTime`. The root export has it too.
- `convertUnixToPlainDate`, `convertUnixToPlainDateTime` and `convertUnixToPlainTime` now name their first parameter `value`, as `convertUnixToUtc` and `convertUnixToZoned` do. It was `unix`. No call changes, but your editor's hover text and the API reference show the new name.
