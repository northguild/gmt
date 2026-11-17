# Coding Standards: Scoped Exceptions for Fixed Grammars

The no-manual-parsing rule has narrow exceptions. Each one keeps the three rules in the first entry. The messaging and health/rail grammars are in [string-grammars-industry.md](./string-grammars-industry.md) and [string-grammars-health-rail.md](./string-grammars-health-rail.md).

### Scoped exception: manual string parsing in `parse*WithPattern` (J11 / Decision 4)

"Manual string parsing" is forbidden everywhere in GMT **except** the `parseDateWithPattern` / `parseDateTimeWithPattern` / `parseTimeWithPattern` family (`packages/gmt/src/plain/parse/`, engine in `packages/gmt/src/internal/patternToken.ts`), because Temporal has no `fromFormat`-style equivalent and this is the only way to decode a caller-supplied token pattern. The exception is bound by three rules, not a blanket carve-out:

1. The regex is built **from the pattern string itself** at call time — never hand-rolled per-format string slicing.
2. Extracted fields are **always** handed to `Temporal.*.from(fields, { overflow: "reject" })` for final construction and validation — a regex match only proves shape, never validity (e.g. `"02/31/2024"` matches `"MM/dd/yyyy"` but is not a real date). Parsers reject; arithmetic clamps — see [§ Calendar & zone semantics](./calendar-and-zones.md#calendar--zone-semantics).
3. The try-catch and sentinel-return rules above are unchanged.

This prohibition stands for every other function in the library.

### Scoped exception: fixed non-ISO grammars in `parseRfc2822`/`parseHttpDate` (J13)

The same three rules extend to `parseRfc2822` (`packages/gmt/src/zoned/parse/`) and `parseHttpDate` (`packages/gmt/src/utc/parse/`), for the same underlying reason as Decision 4: RFC 5322 and RFC 9110 date-times (`"Fri, 15 Mar 2024 14:30:00 -0400"`, `"Fri, 15 Mar 2024 14:30:00 GMT"`) are not ISO 8601 and Temporal's `.from()` cannot parse them at all — there is no `fromRFC2822`/`fromHTTPDate` equivalent to defer to, at any layer. Unlike `parse*WithPattern`, the grammar here is fixed (a hardcoded regex per format, not built from a caller-supplied pattern), which makes this an even narrower case than Decision 4's, not a broader one:

1. The regex encodes the fixed RFC grammar exactly (`regex/rfc-2822.ts`, `regex/http-date.ts`) — never hand-rolled per-call string slicing.
2. Extracted fields are **always** handed to `Temporal.PlainDateTime.from(fields, { overflow: "reject" })` for final construction and validation.
3. The try-catch and sentinel-return rules above are unchanged.

`parseSqlDateTime` and `parseRfc3339` are **not** part of this exception — both validate shape with a regex and then hand the whole string to `Temporal.*.from(string)` directly (which strictly validates the calendar date on its own), never extracting or constructing a field property bag by hand.

### Scoped exception: time-scale strings in the `timescale/` and `gnss/` converters (MAR-16)

The same three rules extend to `fromTAI`, `fromTT` and `fromTCG` (`packages/gmt/src/timescale/convert/`) and `gnssToUtc` (`packages/gmt/src/gnss/convert/`). A time-scale string (`"2026-01-01T00:00:37 TAI"`) is an ISO 8601 extended local date-time, one space, and a token naming the scale: `TAI`, `TT` or `TCG` (FITS 4.0 Table 30) or one of the six RINEX 4.02 §5.2.8 time-system identifiers (`GPS`, `GAL`, `BDT`, `QZS`, `GLO`, `IRN`). ISO 8601 has no designator for TAI or a satellite system's time, and no `Temporal.*.from` reads one at any layer. The grammar is fixed, never caller-supplied:

1. One regex, `timeScaleString` in `internal/timeScaleString.ts`: a four-digit year, `T`, seconds required, one to nine fraction digits after `.`, one space, the token. Not in `regex/`: no standards body publishes the joined form.
2. The extracted fields are always handed to `Temporal.PlainDateTime.from(fields, { overflow: "reject" })`. A second of 60 never reaches Temporal: it is refused for every token but `GLO`, and for `GLO` it is passed as 59 with a flag, and kept only for one of the 27 inserted leap seconds.
3. The try-catch and sentinel-return rules above are unchanged.

The UTC side reads a second-60 instant (`"2016-12-31T23:59:60Z"`) without manual parsing: GMT's instant grammar with second 60 (`internal/utcReading.ts`) checks the shape, and `Temporal.Instant.from` reads it with the specification's clamp to 59. Only the `timescale/` and `gnss/` converters, `timescale/`'s CCSDS ASCII time codes (`parseCcsdsAsciiA`, `parseCcsdsAsciiB`, `formatCcsdsAsciiA`, `formatCcsdsAsciiB`) and `finance/`'s FIX functions (`parseFixUtcTimestamp`, `formatFixUtcTimestamp`, `isValidFixUtcTimestamp`) do this, and only for one of the 27 inserted leap seconds. `formatFixUtcTimestamp` and `formatCcsdsAsciiA`/`B` accept a second-60 instant, and `parseFixUtcTimestamp` and `parseCcsdsAsciiA`/`B` return one. `isValidFixUtcTimestamp` only agrees with the parser. Every other function still rejects a second of 60.

This prohibition stands for every other function in the library.

### Scoped exception: TAI64 text labels in `timescale/convert` (SPA-46)

The same three rules extend to `fromTai64n` (reader) and `toTai64n` (writer) in `packages/gmt/src/timescale/convert/`. A TAI64, TAI64N or TAI64NA label (`@400000002a2b2c2d00000000`) is hex text, not ISO 8601, and no `Temporal.*.from` reads it. Bernstein's [TAI64, TAI64N, and TAI64NA](https://cr.yp.to/libtai/tai64.html) defines the byte layouts (8, 12 and 16 bytes); daemontools [`tai64n`](https://cr.yp.to/daemontools/tai64n.html) defines only the TAI64N text, `@` and 24 lowercase hex digits. Reading 16 or 32 digits, an optional `@` and either hex case is GMT's own rule (precedent: `fromObjectId` reads either case). The grammar is fixed:

1. One regex, `tai64LabelText` in `internal/tai64Label.ts`, matched against the whole input. A function slices a matched label only by the layout's fixed offsets (8, 4 and 4 bytes), never by searching the string.
2. A decoded label goes through the leap-second table with `utcOfTai` only and is written by `formatUtcReading`, which reaches `Temporal.Instant.fromEpochNanoseconds`. The writer goes through `taiOfUtc` and builds the hex from bigint arithmetic: `formatTai64nLabel` makes no Temporal call.
3. The try-catch and sentinel-return rules above are unchanged.

This prohibition stands for every other function in the library, `fromTAI` and `toTAI` included.

### Scoped exception: CCSDS ASCII time codes in `timescale/` (SPA-52)

The same three rules extend to `parseCcsdsAsciiA`, `parseCcsdsAsciiB` (`packages/gmt/src/timescale/parse/`), `formatCcsdsAsciiA` and `formatCcsdsAsciiB` (`packages/gmt/src/timescale/format/`). CCSDS 301.0-B-4 §3.5.1 defines ASCII Time Code A (`YYYY-MM-DDThh:mm:ss.d…dZ`) and Code B (`YYYY-DDDThh:mm:ss.d…dZ`, day of year). Both are UTC and the `Z` is optional. No `Temporal.*.from` reads Code A without its `Z`, or with a second of 60, or reads Code B at all, because Temporal does not read an ordinal date. Reading only codes as fine as whole seconds is GMT's own rule. The grammar is fixed:

1. Two regexes, `CCSDS_ASCII_A` and `CCSDS_ASCII_B` in `internal/ccsdsAsciiTime.ts`, matched against the whole input. A function reads the capture groups only and never searches the string.
2. The year, month and day go to `Temporal.PlainDate.from(…, { overflow: "reject" })`. A Code B day is checked against `daysInYear` and added to 1 January with `PlainDate#add`. The date and time go to `Temporal.PlainDateTime.from(…, { overflow: "reject" })`. A second of 60 goes in as 59, and `taiOfUtc` decides whether it was one of the 27 inserted leap seconds. The writers take the UTC wall clock from `Temporal.Instant` and use `PlainTime#toString` for the time and `dayOfYear` for Code B.
3. The try-catch and sentinel-return rules above are unchanged.

This prohibition stands for every other function in the library.

### Scoped exception: human duration strings (CORE-85)

The same three rules extend to `parseHumanDuration` (`packages/gmt/src/duration/parse/`). A human duration string (`"2h 30m"`, `"3 days"`) is not ISO 8601, and no `Temporal.*.from` reads one. The grammar is GMT's own, fixed, and stated in full in the function's JSDoc:

1. One unit table and two sticky regexes, the pair and the separator, in `internal/humanDuration.ts`, beside two stateless helpers for the sign and for trailing zeros; every spelling comes from the table. Not in `regex/`: no standards body publishes the grammar.
2. The matched digits are rebuilt as an ISO 8601 duration string and handed whole to `Temporal.Duration.from(string)`, which applies the fraction, the sign and the limits. Never a property bag: a bag takes no fraction, and a Number loses digits past 2^53. Milliseconds are added to seconds in BigInt.
3. The try-catch and sentinel-return rules above are unchanged.

This prohibition stands for every other function in the library.

### Scoped exception: identifier grammars in `precision/identifiers/` (CORE-56)

UUIDs, ULIDs, ObjectIds, KSUIDs and Snowflakes carry a timestamp as digits in a fixed alphabet: hex (RFC 9562 §4, MongoDB ObjectId), Crockford base32 (ULID) or base62 (KSUID), or unsigned decimal (Snowflake). No `Temporal.*.from` reads any of them. The grammars are fixed:

1. One regex per grammar, in `internal/identifierText.ts`, with its digit decoder beside it. A public function matches the whole input against its grammar before decoding; no slicing of an unmatched string.
2. The decoded integer is converted to epoch nanoseconds in bigint and always handed to `Temporal.Instant.fromEpochNanoseconds` (through `internal/instantStringFromEpochNanoseconds.ts`), which rejects anything outside the instant range.
3. The try-catch and sentinel-return rules above are unchanged.

Slicing a matched grammar by fixed offsets (`uuid.slice(0, 8)`) is allowed under rule 1: the offsets come from the standard's layout table, never from searching the string.

This prohibition stands for every other function in the library.

### Scoped exception: recurrence and cron grammars in `internal/` (CORE-84)

An RFC 5545 §3.3.10 RECUR value (`FREQ=MONTHLY;BYDAY=-1FR`) and a five-field crontab schedule (`*/5 9-17 * * mon-fri`) are not ISO 8601, and no `Temporal.*.from` reads either. Both grammars are fixed and published (the RFC's ABNF; POSIX `crontab` with cronie crontab(5) extensions):

1. One tokenizer per grammar: `internal/recurrenceRuleText.ts` splits on `;`, `=` and `,`, and `internal/cronText.ts` splits on blanks, `,`, `-` and `/`. Each token is matched whole against an anchored `^…$` regex or a fixed name table. The modules live in `internal/`, outside `regex/`, because they are grammars, not single patterns.
2. Numbers are read from digit runs (the signed RRULE parts, `BYMONTHDAY`, `BYYEARDAY`, `BYWEEKNO`, `BYSETPOS` and the `BYDAY` ordinal, also take a leading `+` or `-`) and range-checked against the clause's stated bounds. A date or date-time (`UNTIL`) is rebuilt as an ISO 8601 string and handed whole to `Temporal.PlainDate.from`, `Temporal.PlainDateTime.from` or `Temporal.Instant.from`. An `UNTIL` with second 60 is rejected, as everywhere outside `timescale/`, `gnss/` and `finance/`.
3. The try-catch and sentinel-return rules above are unchanged.

This prohibition stands for every other function in the library.
