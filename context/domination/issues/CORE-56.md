# CORE-56 — Core: Time-ordered identifiers and data-platform epochs

**Scope:** Extracting and producing the timestamps embedded in time-ordered identifiers, and bridging the timestamp encodings of the data platforms that store them.

## Gap

CORE-3 bridged the classic foreign epochs (NTP, FILETIME, .NET ticks, Excel, Postgres). A second family is now more common in application code than any of them: identifiers that _are_ timestamps. UUIDv7 carries 48 bits of Unix milliseconds; UUIDv1 and v6 carry 100-nanosecond ticks since 15 October 1582; ULIDs, MongoDB ObjectIds, Twitter Snowflakes and KSUIDs each carry their own epoch and width. Reading the time out of one is a recurring need — ordering, retention, debugging — and each re-derivation gets the epoch or the bit layout wrong.

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

## Tool

**ID Timestamp Decoder.** Paste a UUID, ULID, ObjectId, Snowflake or KSUID and see the instant, the version, the epoch and the precision. A second panel round-trips Parquet INT96, Arrow and protobuf timestamps and flags the Arrow value that has no zone. Calls `fromUuidTimestamp`, `fromUlid`, `fromObjectId`, `fromSnowflake`, `fromKsuid`, `fromParquetInt96`, `fromArrowTimestamp`, `toProtoTimestamp`. Teaches: identifiers carry time, each with its own epoch.

## Design notes

- **A UUIDv7's sub-millisecond bits are not a timestamp.** RFC 9562 §6.2 permits implementations to fill `rand_a` with extra clock precision, but does not require it and does not define the encoding; reading those bits as time is a guess about a particular generator. `fromUuidTimestamp` returns milliseconds for v7 and the JSDoc says why.
- **The Gregorian epoch is the trap in v1/v6.** 1582-10-15 is 122 192 928 000 000 000 hundred-nanosecond ticks before the Unix epoch; the arithmetic is `bigint` throughout (CORE-1) and the result keeps 100 ns resolution, which is finer than millisecond `Date` code ever preserved.
- **Snowflake layouts differ, so there is no default.** Twitter's epoch and bit widths are cited as the documented example; passing an ID from another system with Twitter's layout produces a plausible wrong date, which is the failure the required parameter prevents.
- **INT96 is deprecated and everywhere.** Spark and Hive wrote it for a decade. Its Julian day is the same JD the Space realm uses (SPA-49); the conversion here is the integer-day special case and cites the same epoch constant, 2440588 for 1970-01-01.
- **Arrow zone-less timestamps are not instants.** The format says a `Timestamp` without a `timezone` is a wall-clock value "as if UTC"; returning it as an instant is the bug this function's union type prevents, the same shape HLTH-33 uses for offset-absent values. INT-15 prevents it another way: a code that states no offset is read by a parser that returns a local date-time.
- **protobuf `Duration` and `Timestamp` share a shape and differ in sign rules.** `Timestamp.nanos` is always non-negative; `Duration.nanos` takes the sign of `seconds`. Both are encoded here, not inferred.
- TAI64 labels live in SPA-46 because they are TAI; the identifiers here are all UTC-based.

## What gmt provides (do not re-implement)

- `parseInstantNanoseconds` from CORE-2 — an ISO instant string as range-checked `bigint` epoch nanoseconds, behind every `to*` here and both prefixes
- `floorDivide` and the `foreignEpochs` constants from CORE-3 — division toward negative infinity, and the `NANOSECONDS_PER_*` units, the 100 ns tick among them
- `exactDurationNanoseconds` from TRAN-57 — an exact ISO duration in nanoseconds, behind `toProtoDuration`
- `plainDateTimeOf` in `internal/inputChecks.ts` — the check behind `isValidDateTime`, which reads an Arrow wall-clock value

## Verification

- `fromUuidTimestamp` on the RFC 9562 §A.1 v1 example returns the instant the RFC gives for it, and on the §A.6 v7 example returns its millisecond timestamp
- A v4 UUID returns the sentinel
- `fromUuidTimestamp(fromV6(fromV1))` — a v1 and its v6 reordering yield the same instant
- `uuidV7TimestampPrefix('2024-01-01T00:00:00Z')` is `'018cc251f400'`-style 12 hex digits, asserted against `1704067200000` in hex
- `fromUlid` round-trips with `ulidTimestampPrefix` to the millisecond; a ULID with an invalid base32 character returns the sentinel
- `fromObjectId('65a0f4d0…')` returns the instant of its leading four bytes
- `fromSnowflake` with Twitter's layout on a known tweet ID returns the documented creation time; the same ID with a different `epochMs` returns a different instant, asserted
- `fromKsuid` on the KSUID README example returns its documented timestamp
- `fromParquetInt96({ julianDay: 2440588, nanosOfDay: 0n })` is the Unix epoch; a value with 1 ns of day round-trips exactly
- `fromArrowLocalTimestamp(0n, 'second')` returns the wall-clock form `'1970-01-01T00:00:00'`; `fromArrowTimestamp(0n, 'second')` returns the instant
- `toArrowTimestamp` in nanoseconds gives the first and last instant an `int64` holds, and `0n` one nanosecond past either end, where `isValidInt64NanosecondInstant` is `false`
- `toProtoTimestamp('1969-12-31T23:59:59.5Z')` returns `{ seconds: -1n, nanos: 500000000 }`; `toProtoDuration('-PT1.5S')` returns `{ seconds: -1n, nanos: -500000000 }`
- `pnpm run validate` stays green

## Corrections

The brief above was corrected during planning and build. What ships:

- Every `string | null` return in the brief is `string` with the sentinel `""`. `fromUuidTimestamp` returns the instant string too, not `{ instant, version }`: the version is `uuid.charAt(14)`. `toArrowTimestamp` and `toArrowLocalTimestamp` return `0n` and not `null`, as every `bigint` precision converter does.
- The Arrow pair is four functions, one per kind of value, with the unit as the second argument. `fromArrowTimestamp(value, unit)` and `toArrowTimestamp(isoString, unit)` handle an instant. `fromArrowLocalTimestamp(value, unit)` and `toArrowLocalTimestamp(dateTime, unit)` handle a wall-clock time with no zone. There is no options object, no result union, and no zone name to read: a zoned Arrow value is a UTC instant whatever its zone.
- An `int64` of nanoseconds holds only 1677-09-21T00:12:43.145224192Z to 2262-04-11T23:47:16.854775807Z, so a nanosecond `0n` can mean the epoch or a value out of range. `isValidInt64NanosecondInstant` and `isValidInt64NanosecondDateTime` tell the two apart. For an instant, seconds, milliseconds and microseconds cover the whole Temporal range and need no guard. A wall time is checked with `isValidDateTime`, which also accepts the part-day past either end of the instant range (`-271821-04-19`, or after `+275760-09-13T00:00:00`), and `toArrowLocalTimestamp` gives `0n` there. Its JSDoc says so.
- Arrow units are Temporal's names (`"second"`, `"millisecond"`, `"microsecond"`, `"nanosecond"`, singular or plural), not `'s' | 'ms' | 'us' | 'ns'`.
- `uuidV7TimestampPrefix` returns the 13-character lower-case hyphenated prefix (`"018cc251-f400"`), not 12 bare hex digits.
- At exactly 2^48 ms, `ulidTimestampPrefix` returns `"8000000000"`, the exclusive end bound no ULID carries. Twelve hex digits cannot write 2^48, so `uuidV7TimestampPrefix` returns `""` there, and its JSDoc gives the Max UUID as the inclusive upper bound.
- `SnowflakeLayout` is `{ epochMs, shift, timestampBits? }`, and the layout has no default.
- A protobuf `Duration` bounds `seconds` and `nanos` separately, so `"PT315576000000.000000001S"` gives `{ seconds: 315576000000n, nanos: 1 }`, not `null`. `duration.proto` gives each field its own range: `seconds` "Must be from -315,576,000,000 to +315,576,000,000 inclusive", and `nanos` "Must be from -999,999,999 to +999,999,999 inclusive".
- `fromProtoTimestamp` and `fromProtoDuration` also accept `seconds` as a safe-integer `number`. Outputs are always `bigint`.
- `internal/protoRecord.ts` holds the `{ seconds, nanos }` reader the two `from*Proto*` functions share.
- `ArrowTimeUnit` is declared in `precision/convert/fromArrowTimestamp.ts`, so the reference generator gives it a page. `internal/arrowTimestamp.ts` holds the unit factor, the `int64` check and the wall-clock reading the four Arrow functions and the two guards share.
- `internal/instantStringFromEpochNanoseconds.ts` writes the instant string every `from*` reader here returns, so none of them calls the public `fromNanoseconds`.
- The ID Timestamp Decoder, given a Snowflake with no layout, says "Give an epoch and a shift: a Snowflake has no default layout." The first wording, "No layout given", read wrongly once an epoch was typed.

## Decisions

- **Decoding only.** The library reads the instant an ID carries and produces two prefixes for range scans (`uuidV7TimestampPrefix`, `ulidTimestampPrefix`). It generates no UUID, ULID, ObjectId, Snowflake or KSUID, uses no randomness and ships no vendor layout presets.
- **Out of scope:** UUID v2 and the versions with no timestamp (v3, v4, v5, v8, which return `""`), lower bounds from an instant for Snowflake and ObjectId, Sonyflake's 10 ms tick, KSUID and ObjectId prefixes, and the Parquet `TIMESTAMP` logical type (a plain int64: `fromNanoseconds`).
- **Strict input.** `fromUuidTimestamp` reads only the 8-4-4-4-12 form, in any case. A URN, braces, bare hex or whitespace gives `""`, and so does a version digit other than 1, 6 or 7 or a variant other than `10xx`, the Nil and Max UUIDs among them. A ULID has no Crockford folding, so `I`, `L`, `O` and `U` give `""`. A KSUID character outside `0-9A-Za-z` is rejected.
- **UUID v7 is read to the millisecond.** The sub-millisecond `rand_a` bits are optional and undetectable (RFC 9562 §6.2), so they are never read as time. The v7 prefix is the 13-character lower-case hyphenated form.
- **Snowflake layout is a required argument.** A `bigint` or a string is accepted and a `number` is not.
- **`fromParquetInt96` always reads UTC.** There is no wall-clock option. `nanosOfDay` must be in [0, 86 400 x 10^9).
- **Arrow without a timezone is not an instant.** `fromArrowLocalTimestamp` and `toArrowLocalTimestamp` read and write it as a plain date-time, and the instant pair never takes one. The caller picks the function from the column's schema.
- **Protobuf:** `seconds` input is a `bigint` or a safe-integer `number`. `Timestamp.nanos` counts forward for negative seconds. `Duration.nanos` takes the sign of `seconds`. A day is 24 h, and a year, month or week gives `null`. `fromProtoDuration` writes hours as its largest unit.
- **Rounding.** Sub-unit digits floor toward negative infinity, one uniform grid either side of the epoch (the `toFileTime` precedent).
- **Sentinels** are `""`, `null` and `0n` per [coding-standards § API Contract](../../coding-standards.md#api-contract).
- **Reference pins.** The Arrow `Timestamp` rule rests on `apache/arrow` `format/Schema.fbs` at commit `e2524aa088cd6a391b40635245d757542e2b2810`, the last commit to change that file when the story closed. Other sources: RFC 9562 with errata 7955 and 8288, ulid/spec @ d0c7170, mongodb/specifications @ 0a7a8b5, twitter-archive/snowflake @ b3f6a3c, discord-api-docs @ 11df0a2, segmentio/ksuid @ d337249, protocolbuffers/protobuf @ a19cce4, and apache/parquet-format.
- **Dox tools.** The ID Timestamp Decoder and the Column Timestamp Bridge are two standalone tools. Epoch and precision are static prose on the Decoder's page, and no widget module holds an epoch table. Snowflake presets are labelled by their literal values and never by a vendor name. The Dox decisions are in [context/dox/built.md](../../dox/built.md).
