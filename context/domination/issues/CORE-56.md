# CORE-56 — Core: Time-ordered identifiers and data-platform epochs

**Scope:** Extracting and producing the timestamps embedded in time-ordered identifiers, and bridging the timestamp encodings of the data platforms that store them.

## Gap

CORE-3 bridged the classic foreign epochs (NTP, FILETIME, .NET ticks, Excel, Postgres). A second family is now more common in application code than any of them: identifiers that *are* timestamps. UUIDv7 carries 48 bits of Unix milliseconds; UUIDv1 and v6 carry 100-nanosecond ticks since 15 October 1582; ULIDs, MongoDB ObjectIds, Twitter Snowflakes and KSUIDs each carry their own epoch and width. Reading the time out of one is a recurring need — ordering, retention, debugging — and each re-derivation gets the epoch or the bit layout wrong.

The same code then writes those records to Parquet, Arrow, or a protobuf API, each with its own timestamp encoding: the deprecated but ubiquitous Parquet `INT96` (a Julian day plus nanoseconds of day), Arrow's unit-plus-optional-zone `Timestamp` whose zone-less form is wall-clock time and not an instant, and protobuf's `{ seconds, nanos }`. These are precision bridges in exactly CORE-3's sense.

([RFC 9562 §5.1, §5.6, §5.7, §6.2](https://www.rfc-editor.org/rfc/rfc9562.html), [ULID specification](https://github.com/ulid/spec), [MongoDB ObjectId](https://www.mongodb.com/docs/manual/reference/method/ObjectId/), [Twitter Snowflake](https://github.com/twitter-archive/snowflake/tree/snowflake-2010), [KSUID](https://github.com/segmentio/ksuid), [parquet-format INT96 (PARQUET-323, PARQUET-861)](https://github.com/apache/parquet-format), [Arrow `Schema.fbs` Timestamp](https://github.com/apache/arrow/blob/main/format/Schema.fbs), [protobuf `google.protobuf.Timestamp`](https://protobuf.dev/reference/protobuf/google.protobuf/#timestamp))

## Scope

- `packages/gmt/src/precision/identifiers/uuid.ts`:
  - `fromUuidTimestamp(uuid: string): { instant: string, version: 1 | 6 | 7 } | null` — v1/v6: the 60-bit count of 100 ns intervals since 1582-10-15T00:00:00Z, preserved to the tick; v7: the 48-bit millisecond field. Other versions return the sentinel because they carry no time.
  - `uuidV7TimestampPrefix(isoString: string): string` — The 12 hex characters a UUIDv7 for that instant begins with. GMT generates no randomness and no UUIDs; this is for range queries and ordering.
- `packages/gmt/src/precision/identifiers/ulid.ts`:
  - `fromUlid(ulid: string): string | null` — 48-bit milliseconds from the Crockford base32 prefix.
  - `ulidTimestampPrefix(isoString: string): string`
- `packages/gmt/src/precision/identifiers/objectId.ts`:
  - `fromObjectId(hex: string): string | null` — The leading 32-bit seconds.
- `packages/gmt/src/precision/identifiers/snowflake.ts`:
  - `fromSnowflake(id: bigint | string, layout: { epochMs: number, timestampBits?: number, shift?: number }): string | null` — Twitter's layout (41 bits, shifted 22, epoch 1288834974657) is the documented example; Discord, Instagram and others differ, so the layout is a parameter with no default.
- `packages/gmt/src/precision/identifiers/ksuid.ts`:
  - `fromKsuid(ksuid: string): string | null` — 32-bit seconds since the KSUID epoch (1400000000 Unix seconds, 2014-05-13T16:53:20Z), base62.
- `packages/gmt/src/precision/platform/parquetInt96.ts`:
  - `fromParquetInt96(value: { julianDay: number, nanosOfDay: bigint } | Uint8Array): string | null` — `(julianDay − 2440588) × 86400 × 10⁹ + nanosOfDay` nanoseconds since the Unix epoch; the 12-byte little-endian layout is accepted directly.
  - `toParquetInt96(isoString: string): { julianDay: number, nanosOfDay: bigint }`
- `packages/gmt/src/precision/platform/arrowTimestamp.ts`:
  - `fromArrowTimestamp(value: bigint, options: { unit: 's' | 'ms' | 'us' | 'ns', timeZone?: string }): { instant: string } | { local: string, zoneless: true } | null` — With a zone the value is an instant; without one it is wall-clock time encoded "as if UTC", and the union type says so.
  - `toArrowTimestamp(isoString: string, options): bigint | null`
- `packages/gmt/src/precision/platform/protoTimestamp.ts`:
  - `toProtoTimestamp(isoString: string): { seconds: bigint, nanos: number } | null` and `fromProtoTimestamp(value): string` — `nanos` in `[0, 999 999 999]`, normalised for negative seconds per the well-known type.
  - `toProtoDuration(isoDuration: string): { seconds: bigint, nanos: number } | null` and `fromProtoDuration(value): string` — signs of `seconds` and `nanos` must agree.

## Design notes

- **A UUIDv7's sub-millisecond bits are not a timestamp.** RFC 9562 §6.2 permits implementations to fill `rand_a` with extra clock precision, but does not require it and does not define the encoding; reading those bits as time is a guess about a particular generator. `fromUuidTimestamp` returns milliseconds for v7 and the JSDoc says why.
- **The Gregorian epoch is the trap in v1/v6.** 1582-10-15 is 122 192 928 000 000 000 hundred-nanosecond ticks before the Unix epoch; the arithmetic is `bigint` throughout (CORE-1) and the result keeps 100 ns resolution, which is finer than millisecond `Date` code ever preserved.
- **Snowflake layouts differ, so there is no default.** Twitter's epoch and bit widths are cited as the documented example; passing an ID from another system with Twitter's layout produces a plausible wrong date, which is the failure the required parameter prevents.
- **INT96 is deprecated and everywhere.** Spark and Hive wrote it for a decade. Its Julian day is the same JD the Space realm uses (SPA-49); the conversion here is the integer-day special case and cites the same epoch constant, 2440588 for 1970-01-01.
- **Arrow zone-less timestamps are not instants.** The format says a `Timestamp` without a `timezone` is a wall-clock value "as if UTC"; returning it as an instant is the bug this function's union type prevents, the same shape HLTH-33 and INT-15 use for offset-absent values.
- **protobuf `Duration` and `Timestamp` share a shape and differ in sign rules.** `Timestamp.nanos` is always non-negative; `Duration.nanos` takes the sign of `seconds`. Both are encoded here, not inferred.
- TAI64 labels live in SPA-46 because they are TAI; the identifiers here are all UTC-based.

## What gmt provides (do not re-implement)

- `toNanoseconds` / `fromNanoseconds` / `truncateNanoseconds` from CORE-1 — the `bigint` core
- `fromFileTime` / `toFileTime` from CORE-3 — the 100 ns tick arithmetic the UUID epoch shares in unit if not in epoch
- `isValidInstant` from CORE-1 — output validation

## Verification

- `fromUuidTimestamp` on the RFC 9562 §A.1 v1 example returns the instant the RFC gives for it, and on the §A.6 v7 example returns its millisecond timestamp with `version: 7`
- A v4 UUID returns the sentinel
- `fromUuidTimestamp(fromV6(fromV1))` — a v1 and its v6 reordering yield the same instant
- `uuidV7TimestampPrefix('2024-01-01T00:00:00Z')` is `'018cc251f400'`-style 12 hex digits, asserted against `1704067200000` in hex
- `fromUlid` round-trips with `ulidTimestampPrefix` to the millisecond; a ULID with an invalid base32 character returns the sentinel
- `fromObjectId('65a0f4d0…')` returns the instant of its leading four bytes
- `fromSnowflake` with Twitter's layout on a known tweet ID returns the documented creation time; the same ID with a different `epochMs` returns a different instant, asserted
- `fromKsuid` on the KSUID README example returns its documented timestamp
- `fromParquetInt96({ julianDay: 2440588, nanosOfDay: 0n })` is the Unix epoch; a value with 1 ns of day round-trips exactly
- `fromArrowTimestamp(0n, { unit: 's' })` returns the zoneless form `'1970-01-01T00:00:00'`; with `timeZone: 'UTC'` it returns the instant
- `toProtoTimestamp('1969-12-31T23:59:59.5Z')` returns `{ seconds: -1n, nanos: 500000000 }`; `toProtoDuration('-PT1.5S')` returns `{ seconds: -1n, nanos: -500000000 }`
- `pnpm run validate` stays green
