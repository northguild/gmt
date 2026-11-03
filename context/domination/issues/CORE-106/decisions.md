# CORE-106 — Decisions

Part of [CORE-106](../CORE-106.md).

The rules `parseSqlOffsetDateTime` and `isValidSqlOffsetDateTime` follow, and what each rests on.

- **Home and names.** `parseSqlOffsetDateTime` lives in the new subpath `@northguild/gmt/instant/parse`
  (`package.json` `exports` and `typesVersions`, and the Dox module list). `isValidSqlOffsetDateTime`
  lives in `instant/validate`. The regex is `sqlOffsetDateTime`, exported beside `sqlDateTime`.
- **Output.** ISO 8601 extended form with the offset kept, `2024-03-15T14:30:00+00:00`. It loses
  nothing: `toOffsetInstant` gives the instant and the offset from it. PostgreSQL stores no offset,
  but SQL Server does, so a UTC-only result would drop data.
- **No writer.** Every audited database reads the ISO form that `fromOffsetInstant` and
  `formatRfc3339` write.
- **`T` and `Z` are rejected.** Neither is SQL-92 text, and `toOffsetInstant` and `parseRfc3339`
  read the ISO forms. One form has two readers: a space, then a full `±HH:MM` with no space before
  it (`2024-03-15 14:30:00+05:30`). Both give the same instant and offset.
- **Shared core.** `readSqlOffsetDateTime` (`internal/`) is the one reader; the parser and the
  validator both call it, and a public function never calls another public one. `isValidSqlDateTime`
  was fixed in the same way: the body of `parseSqlDateTime` moved into `readSqlDateTime`, with no
  change in behaviour.
- **`UnixUnit` stays at seconds and milliseconds.** Microseconds and nanoseconds stay compositions.

### Grammar

`YYYY-MM-DD␠HH:MM:SS[.f{0,9}][␠]±HH[:MM[:SS]]`, written as `YYYY-MM-DDTHH:MM:SS[.f]±HH:MM[:SS]`.

- The fraction drops trailing zeros, and a bare `.` is dropped.
- An hour-only offset gains `:00`; `:00` offset seconds are dropped.
- `-00`, `-00:00` and `-00:00:00` are written `+00:00`.
- Rejected: `T`, `Z`, a basic `±HHMM`, a bracket annotation, `BC`, `infinity`, second 60, and any
  trailing text.

### Authority

| Rule | Source |
| --- | --- |
| `<date value> <space> <time value> [ <time zone interval> ]` | SQL-92 (ISO/IEC 9075:1992) §5.3 `<timestamp string>` |
| Offset written `<sign> <hours value> <colon> <minutes value>`, no space before it | SQL-92 §5.3 `<time zone interval>` |
| Year 0001–9999, two-digit fields, seconds required, fraction digits up to the implementation | SQL-92 §5.3 Syntax Rule 21 and §6.1 Table 10 ("Valid values for fields in datetime items", in `<data type>` General Rule 4), as `sqlDateTime` already cites |
| Hour-only offset (`-08`), and `hh:mm:ss` for an offset that is not whole minutes | PostgreSQL §8.5.2 "Date/Time Output": in ISO style the offset is shown as `hh`, else `hh:mm`, else `hh:mm:ss` |
| One space before the offset; 7 fraction digits | SQL Server `datetimeoffset (Transact-SQL)`: the property row "Default string literal formats (used for down-level client)", `yyyy-MM-dd HH:mm:ss[.nnnnnnn] [{+\|-}hh:mm]`, and its CAST output example `2007-05-08 12:35:29.1234567 +12:15`. The "Supported string literal formats" table lists only `T` forms and says spaces are not allowed, so it does not support the space |
| One space before the offset, under an ISO NLS format | Oracle prints whatever `NLS_TIMESTAMP_TZ_FORMAT` says, so the space holds only under an ISO format such as `YYYY-MM-DD HH24:MI:SS.FF TZH:TZM` |
| Up to 9 fraction digits | Oracle TIMESTAMP fractional precision 0–9 (NLS datetime types); Temporal nanoseconds. **GMT rule:** the widest a database prints |
| Offset hours 00–23 rather than SQL-92's −12:59…+13:00 | **GMT rule.** SQL-92 §5.3 Syntax Rule 25 predates +14:00. MySQL 8.4 §11.1.3 accepts −13:59…+14:00 and SQL Server ±14:00. A reader must not reject what a database printed. 24 and above is outside Temporal's offset grammar (`UTCOffset`) |
| Second 60 rejected | **GMT rule**, as `sqlDateTime`: Temporal reads a leap second as `:59` |
| `T` and `Z` rejected | **GMT rule** (see above) |
| `-00:00` written `+00:00` | TC39 Temporal §11.1.6 `FormatUTCOffsetNanoseconds`, step 1 ("If offsetNanoseconds ≥ 0 … PLUS SIGN"), as `parseRfc3339` does. SQL gives no meaning to a negative zero offset |
| Offset seconds written only when non-zero | TC39 Temporal `FormatUTCOffsetNanoseconds` |
| Fraction trailing zeros dropped | TC39 Temporal `FormatFractionalSeconds`, precision `"auto"`, as `parseSqlDateTime` |
| A real calendar date and an instant in range | [§9 instant reading](../../../coding-standards.md#9-an-instant-string-is-read-as-the-zoned-string-it-may-be): `parseInstantNanoseconds` is the one reader |
| Sentinels `""` and `false`; never throws | [§ API Contract](../../../coding-standards.md#api-contract) |
| A validator and its parser share an internal core | [§ Loop cost](../../../coding-standards.md#loop-cost), "Resolve once" |

### Dox

- **The guide** `guides/conversion/databases.mdx` ("Database Timestamps") sits in Conversion at order 4,
  after Time-Ordered Identifiers, with no renumbering. It is this story's matrix as Read and Write
  columns, one section per database, with a runnable snippet for every `≈` and new row; a test runs
  each snippet.
- **The Database Timestamp Reader** (`/tools/database-timestamp-reader/`, kind `dbstamp`) and its chat
  tool `showDatabaseTimestampReader` are described in [built.md](../../../dox/built.md). A database's own
  arithmetic lives only in the printed call templates, the tool has no write-back line, and the new
  SQL offset forms are compared with `toOffsetInstant` and `parseRfc3339` only.
- **MySQL `TIMESTAMP` has a session zone field, on that form only.** Once a seed or chat call names a
  value, the zone is the caller's, or blank. A blank zone gives the wall-time call alone and a note.
  Presets carry `UTC` and `Asia/Kolkata`.
- The Dox loader (`database-lib.ts`) loads 13 gmt modules; `instant/validate` is not one of them.
