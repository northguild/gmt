# CORE-106 — Core: Database audit and consistency

**Scope:** Check that gmt has the right call for every date and time form the major databases
hand a JS/TS backend, through their usual drivers, and add what is missing. Twelve databases
were audited from their own documentation: PostgreSQL, MySQL, SQL Server, Oracle, SQLite,
MongoDB, DynamoDB, Redis, Couchbase, Cassandra, ScyllaDB and Neo4j. Most forms are already
covered. One is not: the SQL `TIMESTAMP WITH TIME ZONE` text that PostgreSQL and SQL Server
print. The story adds a reader and a validator for it, fixes two small inconsistencies, and gives
`dox-architect` the matrix the databases guide is built from.

## Gap

`parseSqlDateTime` reads SQL's zone-less timestamp text. Its offset-carrying sibling has no
reader, and `formatSqlDateTime`'s JSDoc says so ("There is no zoned counterpart"). The three ISO
readers all reject what the databases print:

- PostgreSQL `timestamptz` in the default ISO DateStyle prints `2024-03-15 14:30:00+00`. It uses
  a space separator and an hour-only offset whenever the offset is a whole number of hours
  ([§8.5.2](https://www.postgresql.org/docs/current/datatype-datetime.html#DATATYPE-DATETIME-OUTPUT),
  Table 8.14 and the paragraph after it). Historic zones print `hh:mm:ss`.
- SQL Server `datetimeoffset` prints `2007-05-08 12:35:29.1234567 +12:15`, with a space before
  the offset and seven fraction digits
  ([datetimeoffset](https://learn.microsoft.com/en-us/sql/t-sql/data-types/datetimeoffset-transact-sql)).
  Oracle's `TIMESTAMP WITH TIME ZONE` does the same under an ISO `NLS_TIMESTAMP_TZ_FORMAT`.
- `toOffsetInstant` and `isValidInstant` need a `T` separator. `parseRfc3339` takes a space and
  reads `2024-03-15 14:30:00+05:30` (as `…+05:30[+05:30]`), but needs a full `±HH:MM` with no
  space before it, as RFC 3339 §5.6 `time-numoffset` requires. It rejects PostgreSQL's `+00` and
  `+00:19:32` and SQL Server's ` +12:15`.

A backend that reads `timestamptz` as text (a `pg` type parser returning the raw string,
`COPY`/CSV exports, logs) has no gmt call for it today.

Standards: SQL-92 §5.3 `<timestamp string>` and `<time zone interval>`; the vendor output
formats above.

## Use cases — the audit matrix (input for the Dox databases guide)

`✓` is an existing export. `≈` is a near-miss: a short composition of existing exports, which
the guide shows. `✗` is not covered, and the Design notes say why.

| Database | Type / form on the wire | gmt call |
| --- | --- | --- |
| PostgreSQL | `date`, `time`, `timestamp` text | ✓ `isValidDate`, `isValidTime`, `parseSqlDateTime` / `formatSqlDateTime` |
| PostgreSQL | `timestamptz` text `2024-03-15 14:30:00+05:30`, `…-08` | **new** `parseSqlOffsetDateTime`, `isValidSqlOffsetDateTime` |
| PostgreSQL | binary `timestamp`/`timestamptz`: int64 µs since 2000-01-01 | ✓ `fromPgMicroseconds` / `toPgMicroseconds` |
| PostgreSQL | `interval`, `intervalstyle = iso_8601` (`P1Y2M`, `P3DT4H5M6S`) | ✓ `parseDuration`; ≈ the default `postgres` style: `SET intervalstyle = 'iso_8601'` (§8.5.5) |
| PostgreSQL | `EXTRACT(EPOCH FROM …)`: numeric seconds with a fraction | ≈ `convertUnixToUtc(Math.round(s * 1000))` (ms precision) |
| PostgreSQL | `uuidv7()` | ✓ `fromUuidTimestamp` |
| MySQL | `DATE`, `DATETIME(fsp)` text | ✓ `isValidDate`, `parseSqlDateTime` / `formatSqlDateTime` |
| MySQL | `TIMESTAMP`: stored UTC, shown in session `time_zone`, no offset | ≈ `SET time_zone = '+00:00'`, then `resolveLocal(parseSqlDateTime(v), "UTC")` |
| MySQL | offset literal on input `2020-01-01 10:10:10+05:30` (§11.1.3) | ≈ `fromOffsetInstant({ instant, offset })`: `T` is allowed; round to µs first with `roundUtc` |
| MySQL | `TIME` −838:59:59…838:59:59 (elapsed time, not a time of day) | ≈ split, then `durationFromUnits({ hours, minutes, seconds })` |
| SQL Server | `date`, `time(7)`, `datetime2(7)`, `datetime`, `smalldatetime` text | ✓ `isValidDate`, `isValidTime`, `parseSqlDateTime` (up to 9 digits) |
| SQL Server | `datetimeoffset` text `… 12:35:29.1234567 +12:15` | **new** `parseSqlOffsetDateTime` |
| SQL Server | .NET ticks / FILETIME from CLR interop | ✓ `fromDotNetTicks`, `fromFileTime` |
| Oracle | `TIMESTAMP` under `NLS_TIMESTAMP_FORMAT = 'YYYY-MM-DD HH24:MI:SS.FF'` | ✓ `parseSqlDateTime` |
| Oracle | `TIMESTAMP WITH TIME ZONE` under `'… TZH:TZM'` | **new** `parseSqlOffsetDateTime` |
| Oracle | `INTERVAL YEAR TO MONTH`, `DAY TO SECOND` (driver objects) | ≈ `durationFromUnits` |
| SQLite | `datetime()` text, UTC, `YYYY-MM-DD HH:MM:SS[.SSS]` | ≈ `resolveLocal(parseSqlDateTime(v), "UTC")`; write with `formatSqlDateTime` |
| SQLite | `unixepoch()` integer seconds | ✓ `convertUnixToUtc(v, { epochUnit: "seconds" })` |
| SQLite | `julianday()` real | ≈ `convertUnixToUtc(Math.round((jd - 2440587.5) * 86400000))` |
| MongoDB | BSON Date: int64 ms since 1970 | ✓ `convertUnixToUtc` / `convertUtcToUnix` (ms is the default) |
| MongoDB | Extended JSON v2 relaxed `{"$date": "2019-08-11T17:54:14.692Z"}` | ✓ `isValidUtc`; canonical `$numberLong` ms → `convertUnixToUtc` |
| MongoDB | `Timestamp {t, i}` (`t` is seconds) | ✓ `convertUnixToUtc(t, { epochUnit: "seconds" })` |
| MongoDB | `ObjectId` | ✓ `fromObjectId` |
| DynamoDB | TTL attribute: Number, epoch seconds | ✓ `getUnixIn(…, { epochUnit: "seconds" })`, `convertUtcToUnix` |
| DynamoDB | ISO 8601 `S` sort keys | ≈ `roundUtc(v, { smallestUnit: "millisecond", roundingMode: "floor", fractionalSecondDigits: 3 })`: fixed digits sort as text |
| Redis | `TIME` → `[seconds, microseconds]` | ≈ `fromArrowTimestamp(BigInt(s) * 1_000_000n + BigInt(us), "microsecond")` |
| Redis | `EXPIREAT`, `EXPIRETIME` epoch seconds | ✓ `convertUnixToUtc(v, { epochUnit: "seconds" })`, `getUnixIn(…, { epochUnit: "seconds" })` |
| Redis | `PEXPIREAT`, `PEXPIRETIME` epoch ms | ✓ `convertUnixToUtc(v)`, `getUnixIn(…)` |
| Redis | `EXPIRE` seconds from now | ✓ write only: `ttlFromNow(…)?.seconds` |
| Redis | stream ID `<ms>-<seq>` | ≈ `convertUnixToUtc(Number(id.split("-")[0]))` |
| Couchbase | epoch ms (`STR_TO_MILLIS`, `MILLIS_TO_STR`) | ✓ `convertUnixToUtc` / `convertUtcToUnix` |
| Couchbase | ISO 8601 strings | ✓ `isValidUtc`, `toOffsetInstant` |
| Cassandra, ScyllaDB | `timestamp`: int64 ms since 1970 | ✓ `convertUnixToUtc` / `convertUtcToUnix` |
| Cassandra, ScyllaDB | `date`: uint32 days, epoch at 2^31 | ≈ `addDate("1970-01-01", { days: raw - 2 ** 31 })` |
| Cassandra, ScyllaDB | `time`: int64 ns since midnight | ≈ `convertUtcToPlainTime(fromNanoseconds(BigInt(ns)))` |
| Cassandra, ScyllaDB | `duration` (months, days, ns) | ≈ `durationFromUnits({ months, days, nanoseconds })` when all three share a sign. The sign rule is Temporal's (TC39 Temporal `IsValidDuration`: mixed signs throw), not the databases'; neither doc states one |
| Cassandra, ScyllaDB | `timeuuid` (UUID v1) | ✓ `fromUuidTimestamp` |
| Neo4j | `DATE`, `LOCAL TIME`, `LOCAL DATETIME` | ✓ `isValidDate`, `isValidTime`, `isValidDateTime` |
| Neo4j | `ZONED DATETIME` `2025-02-18T12:34:56.789+01:00[Europe/Stockholm]` | ✓ `isValidZonedDateTime`, `toOffsetInstant` |
| Neo4j | `DURATION` `P14DT16H12M` | ✓ `parseDuration` |

_Correction: the single Redis expiry row was wrong. `PEXPIREAT` is ms, `EXPIRE` takes a length of time rather than an instant, and Redis 7.0+ reads an expiry back with `EXPIRETIME` / `PEXPIRETIME`; the row is split by unit and direction._

Sources: [PostgreSQL §8.5](https://www.postgresql.org/docs/current/datatype-datetime.html),
[MySQL 8.4 §11.1.3](https://dev.mysql.com/doc/refman/8.4/en/date-and-time-literals.html),
[SQL Server datetimeoffset](https://learn.microsoft.com/en-us/sql/t-sql/data-types/datetimeoffset-transact-sql),
[Oracle 23 NLS datetime types](https://docs.oracle.com/en/database/oracle/oracle-database/23/nlspg/datetime-data-types-and-time-zone-support.html),
[SQLite date functions](https://sqlite.org/lang_datefunc.html),
[MongoDB Extended JSON v2](https://www.mongodb.com/docs/manual/reference/mongodb-extended-json/),
[DynamoDB TTL](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/time-to-live-ttl-before-you-start.html),
[Redis TIME](https://redis.io/docs/latest/commands/time/),
[Couchbase SQL++ date functions](https://docs.couchbase.com/server/current/n1ql/n1ql-language-reference/datefun.html),
[Cassandra CQL types](https://cassandra.apache.org/doc/latest/cassandra/developing/cql/types.html),
[Neo4j temporal values](https://neo4j.com/docs/cypher-manual/current/values-and-types/temporal/).
The guide's tests run every `≈` row before it is published.

## Scope

- `parseSqlOffsetDateTime(value)`: SQL offset timestamp text in, ISO 8601 offset datetime out.
- `isValidSqlOffsetDateTime(value)`: the matching guard.
- `sqlOffsetDateTime`: the regex both share, exported beside `sqlDateTime`.
- Consistency: point the SQL siblings' JSDoc at the new pair, and give the three
  `convertUnixToPlain*` the `value` parameter name their siblings use.
- Consistency: `isValidSqlDateTime` stops calling the public `parseSqlDateTime`. The parser's
  body moves into an internal core both call, with no change in behaviour.

## Tool

Left to `dox-architect`. Candidate: a **Database Timestamp Reader**. Pick a database and a type,
paste what it printed, and see the instant, the offset and the gmt call that reads it. It is
built from the matrix above. The issue also asks for a databases/backend guide page under
`apps/dox/src/content/docs/guides/`; the matrix is its outline.

## Design notes

- **Not covered on purpose.** Each has a reason:
  - `timetz` (PostgreSQL) and Neo4j `ZONED TIME`: Temporal has no time-with-offset type, and
    PostgreSQL itself advises against `timetz` (§8.5.3).
  - Oracle's region form (`… America/Los_Angeles PDT`) and Couchbase's custom format strings
    are session- or format-dependent text, not a standard form.
  - PostgreSQL `infinity`, BC years and years past 9999, and Neo4j's ±999,999,999 years, fall
    outside SQL-92's year range or Temporal's.
  - Mixed-sign PostgreSQL intervals (`P-1Y-2M3DT…`) cannot be a Temporal duration.
- **Writing needs no new function.** PostgreSQL, MySQL 8.0.19+, SQL Server and SQLite all read
  ISO 8601 with a `T` and `±HH:MM`, which `fromOffsetInstant` and `formatRfc3339` already write.
- **Consistency findings left as they are:**
  - The epoch-in-any-unit converter is named for Arrow (`fromArrowTimestamp`); `UnixUnit` stops at
    milliseconds. µs and ns need `bigint`, which the `unix/` number API cannot hold exactly.
  - Identifier readers name their parameter after the id (`ulid`, `uuid`, `objectId`).
  - `formatSqlDateTime` drops trailing zeros where a fixed-precision column prints them. Every
    database reads the shorter form.
  - `toExcelSerial` returns `number | null` beside `bigint` siblings, as the sentinel table says.
- Painpoint: "SQL offset timestamp text" in [painpoints.md](../painpoints.md) § Cross-cutting,
  added with this story (PostgreSQL §8.5.2, SQL Server `datetimeoffset`).

## What gmt provides (do not re-implement)

- `parseSqlDateTime`, `formatSqlDateTime`, `isValidSqlDateTime`, regex `sqlDateTime` (`plain/`)
- `toOffsetInstant` / `fromOffsetInstant` and `resolveLocal` (`instant/convert/`)
- `parseInstantNanoseconds` (`internal/instantNanoseconds.ts`): the one instant reader
- `parseRfc3339` / `formatRfc3339` (`zoned/`)
- `fromPgMicroseconds`, `fromArrowTimestamp`, `fromNanoseconds` (`precision/convert/`)
- `fromUuidTimestamp`, `fromObjectId` (`precision/identifiers/`)
- `convertUnixToUtc` / `convertUtcToUnix`, `getUnixIn`, `ttlFromNow` (`unix/`, `utc/`, `duration/`)

## Verification

- `2024-03-15 14:30:00+00` → `2024-03-15T14:30:00+00:00`, and `2007-05-08 12:35:29.1234567 +12:15`
  → `2007-05-08T12:35:29.1234567+12:15`.
- `1880-01-01 00:00:00-00:44:30` keeps its seconds offset.
- `2024-02-30 00:00:00+00`, `… BC`, `infinity`, `2024-03-15T14:30:00+00` and `… Z` → `""`.
- Validator and parser agree on every row.
- `pnpm run validate` stays green.

## Decisions

[Decisions](CORE-106/decisions.md): the home and names of `parseSqlOffsetDateTime` and `isValidSqlOffsetDateTime`, the ISO output, the shared core, the grammar and how it is written, the authority each rule rests on (SQL-92, PostgreSQL, SQL Server, Oracle, MySQL, TC39 Temporal), and the Dox guide, reader and chat tool decisions.
