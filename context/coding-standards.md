# Coding Standards

## API Contract

- All public functions accept **ISO 8601 strings** (or numeric Unix epochs where the domain requires it).
- Return types: ISO strings, numbers, booleans, arrays, `bigint`, or plain objects — never `Date` objects or Temporal objects.
- Invalid input returns a typed sentinel — never throws. **This table is the single source of truth for sentinels**; every other doc links here:

| Return type                                    | Sentinel | Examples                                                |
| ---------------------------------------------- | -------- | ------------------------------------------------------- |
| `string`                                       | `""`     | `addDate`, `floorToZone`, `resolveLocal`                |
| `number`                                       | `null`   | `getDay`, `spanMs`                                      |
| `boolean`                                      | `false`  | `isValidDate`, `isAfterZoned`                           |
| array                                          | `[]`     | `bucketRange`, `splitIntervalByUnitDate`                |
| object (`{ … } \| null`)                       | `null`   | `getIsoWeekDate`, `getFiscalPeriod`, `toOffsetInstant`  |
| `bigint` (`precision/` converters and parsers) | `0n`     | `toNanoseconds`, `parseNanoseconds`, `toPgMicroseconds` |
| `span/` functions (any numeric type)           | `null`   | `spanMs`, `spanNs` (`bigint \| null`), `spanWallClock`  |

- **Arguments follow TC39's option-reading rules** (1.16.0):
  - An explicit `undefined` positional argument is the same as omitting it (`GetOption`).
  - An options argument must be omitted, `undefined` or an Object. `null`, a string or a number returns the sentinel (`GetOptionsObject`). A function is an Object (ECMA-262 §6.1.7), so a function carrying the options is read like any other bag, as Temporal reads it; the same holds for every other object argument, a property bag or a GMT record. `internal/isObject.ts` is the one check: never test `typeof x === "object"` by hand. A member is read with an ordinary property get, as `GetOption` reads one, so a function's own `name` is a value like any other: a `cutoffSchedule` entry written as a function is labelled with it. The `Intl.DateTimeFormat`-backed formatters follow ECMA-402's `CoerceOptionsToObject` instead: `null` returns `""`, and a string or number means the defaults.
  - A locale is `string | string[]` everywhere (`CanonicalizeLocaleList`). An invalid tag returns the sentinel. `[]` means the default locale where the locale is optional, and returns the sentinel where it is required (`getLocaleMonthNames([])` is `[]`).
  - Unit names are accepted singular or plural (`"day"` and `"days"`), as Temporal §13.17 does.
- **One documented exception:** the `min*`/`max*` aggregators (`minDate`, `maxZoned`, …) return `string | null`, with `null` meaning "no valid item". Do not copy that shape into new string functions.

- **`get/` namespaces hold current-moment accessors only.** Each reads the clock and takes no date value: no argument, a time zone, output options, or a length counted from now (`getDay()`, `getZonedDay(timeZone)`, `getZonedIn(timeZone, units)`). Any function taking a date value belongs in `calculate/` (or `parse/`, `compare/`, `format/` as its verb dictates) — see J0b, which relocated `getLocaleDayOfWeek`/`getLocaleZonedDayOfWeek` out of `get/` for violating this.

## Allowed vs. Forbidden Patterns

### Allowed

| Pattern                          | Example                                 |
| -------------------------------- | --------------------------------------- |
| ISO strings                      | `"2024-03-10"`                          |
| Temporal objects (internal only) | `Temporal.PlainDate.from("2024-03-10")` |
| Tree-shakable exports            | `export * from "./plain"`               |

### Forbidden

| Pattern               | Replacement                                |
| --------------------- | ------------------------------------------ |
| `new Date()`          | `Temporal.Now.instant()`                   |
| `date.getTime()`      | `Temporal.Instant.from(date).epochSeconds` |
| Manual string parsing | `Temporal.PlainDate.from(string)`          |
| Mutating methods      | Use Temporal's immutable methods           |

## Always Wrap Temporal Calls in Try-Catch

Temporal's static methods (`.from()`, `.add()`, `.subtract()`, `.since()`, `.until()`, etc.) throw `RangeError` on invalid input. Every call must be wrapped:

```ts
export function addDays(dateStr: string, days: number): string {
  try {
    const date = Temporal.PlainDate.from(dateStr);
    return date.add({ days }).toString();
  } catch {
    return "";
  }
}
```

- Wrap the entire block that uses Temporal methods.
- The catch block takes no argument (`catch { ... }`) — we never need the error value.
- Return the appropriate sentinel for the function's return type.
- **Validate, then parse, is intentional.** A public function runs its `isValid*` guard and then parses the same string again inside `try`. The double parse keeps each function's contract explicit and self-contained; do not "optimise" it away or flag it in review.

### Scoped exception: the UTC clock readers

A function has no try-catch and documents no sentinel when all four of these hold:

1. It takes no argument.
2. Its only Temporal entry point is `Temporal.Now.instant()`.
3. Every conversion of that instant names `"UTC"` explicitly (`.toZonedDateTimeISO("UTC")`), or is `.toString()` with no options.
4. After the conversion it only reads a field or calls `.toString()` with no options — no arithmetic, rounding, `.with()` or options bag. `.add({ days: 1 })` throws at the upper limit of the `Instant` range.

On a conformant clock nothing in that chain can throw. ECMA-262 defines `Date.now()` as an integral time value within ±8.64e15 ms, Temporal's `HostSystemUTCEpochNanoseconds` keeps the reading inside the `Instant` range, and `"UTC"` is always a valid time zone. A catch there is dead code, and a documented `""` is a result no caller can receive. Do not add either. The one way to make these functions throw is to replace `Date.now` with a function that returns a non-integer, which no host does.

The functions are `getUtcNow`, `getUtc{Year,Month,Day,Hour,Minute,Second,Millisecond,Microsecond,Nanosecond}` and `getUnix{Year,Month,Day,Hour,Minute,Second,Millisecond,Microsecond,Nanosecond}`.

The exception is narrow. It does **not** cover:

- **A read of the system time zone** — `Temporal.Now.zonedDateTimeISO()` with no argument, `Temporal.Now.timeZoneId()`, or `Intl.DateTimeFormat().resolvedOptions().timeZone`. A host can report no usable zone: Node reports `Etc/Unknown` for an empty `TZ` and `undefined` for an unknown one, and `Temporal.Now.zonedDateTimeISO()` throws on both. `getNow`, `getToday`, `getSystemTimeZone` and the other system-zone readers keep their try-catch and their sentinel.
- **Any function that takes an argument**, even one validated before the clock is read (`getUtcNowUnit`, `getUnixNow`, `getZonedNow`, the `getZoned*` readers). It keeps its validation, its try-catch and its sentinel.

### Scoped exception: manual string parsing in `parse*WithPattern` (J11 / Decision 4)

"Manual string parsing" is forbidden everywhere in GMT **except** the `parseDateWithPattern` / `parseDateTimeWithPattern` / `parseTimeWithPattern` family (`packages/gmt/src/plain/parse/`, engine in `packages/gmt/src/internal/patternToken.ts`), because Temporal has no `fromFormat`-style equivalent and this is the only way to decode a caller-supplied token pattern. The exception is bound by three rules, not a blanket carve-out:

1. The regex is built **from the pattern string itself** at call time — never hand-rolled per-format string slicing.
2. Extracted fields are **always** handed to `Temporal.*.from(fields, { overflow: "reject" })` for final construction and validation — a regex match only proves shape, never validity (e.g. `"02/31/2024"` matches `"MM/dd/yyyy"` but is not a real date). Parsers reject; arithmetic clamps — see [§ Calendar & zone semantics](#calendar--zone-semantics).
3. The try-catch and sentinel-return rules above are unchanged.

The full rationale is Decision 4 of the archived J roadmap file, which no longer exists in the tree: read it with `git show c1c64e1^:context/roadmap/issues/J.md`. This prohibition stands for every other function in the library.

### Scoped exception: fixed non-ISO grammars in `parseRfc2822`/`parseHttpDate` (J13)

The same three rules extend to `parseRfc2822` (`packages/gmt/src/zoned/parse/`) and `parseHttpDate` (`packages/gmt/src/utc/parse/`), for the same underlying reason as Decision 4: RFC 5322 and RFC 9110 date-times (`"Fri, 15 Mar 2024 14:30:00 -0400"`, `"Fri, 15 Mar 2024 14:30:00 GMT"`) are not ISO 8601 and Temporal's `.from()` cannot parse them at all — there is no `fromRFC2822`/`fromHTTPDate` equivalent to defer to, at any layer. Unlike `parse*WithPattern`, the grammar here is fixed (a hardcoded regex per format, not built from a caller-supplied pattern), which makes this an even narrower case than Decision 4's, not a broader one:

1. The regex encodes the fixed RFC grammar exactly (`regex/rfc-2822.ts`, `regex/http-date.ts`) — never hand-rolled per-call string slicing.
2. Extracted fields are **always** handed to `Temporal.PlainDateTime.from(fields, { overflow: "reject" })` for final construction and validation.
3. The try-catch and sentinel-return rules above are unchanged.

`parseSqlDateTime` and `parseRfc3339` are **not** part of this exception — both validate shape with a regex and then hand the whole string to `Temporal.*.from(string)` directly (which strictly validates the calendar date on its own), never extracting or constructing a field property bag by hand.

### Scoped exception: EDI date/time grammars in the `parseEdifact…` and `parseX12…` functions (INT-15)

The same three rules extend to the EDI parsers in `packages/gmt/src/intermodal/parse/`: `parseEdifactDate`, `parseEdifactTime`, `parseEdifactDateTime`, `parseEdifactOffsetDateTime`, `parseEdifactDatePeriod`, `parseEdifactDateTimePeriod`, `parseX12Date`, `parseX12Time`, `parseX12DateTime`, `parseX12DateRange`, `parseX12DateTimeRange` and `parseX12DateAndTime`. UN/EDIFACT data element 2379, X12 data element 1250 and X12 elements 373 and 337 name fixed digit-order grammars (`CCYYMMDDHHMM`, `MMDDCCYY`, `CCYYMMDDHHMMZHHMM`, `HHMMSSDD`, …) that are not ISO 8601 and that Temporal's `.from()` cannot parse at any layer. As with J13 the grammar is fixed per code, never caller-supplied:

1. Each grammar is a regex in one table keyed by the standard's own code, `internal/ediGrammar.ts`, built from fragments named in the standards' mask notation (`CCYY`, `MM`, `DD`, `HH`, `ZHHMM`, `ZZZ`). Each code's layout is written once, beside the kind of value it states, and its regex, its field reader and its writer derive from it. X12 element 337 is sent with no code, so its table is keyed by its four masks (`HHMM`, `HHMMSS`, `HHMMSSD`, `HHMMSSDD`): `parseX12Time` reads from it and `formatX12TimeElement` writes from it. `internal/ediDateTimeFields.ts` extracts the fields from those tables — never per-call string slicing in a public function. These grammars are not public patterns: a value is only valid against a code, so the public check is the kind's validator, such as `isValidEdifactDateTime(value, format)` or `isValidX12Date(value, format)`. `regex/` gains only the two grammars GS1 publishes verbatim, `epcisEventTime` and `epcisTimeZoneOffset`.
2. Extracted date and time fields are **always** handed to `Temporal.PlainDate.from` / `Temporal.PlainTime.from` / `Temporal.PlainDateTime.from(fields, { overflow: "reject" })`. A value that carries an offset (`205`, `208`, or `303` and `304` when the zone is `±HH`, `UTC` or `GMT`) is rebuilt as an extended ISO string, read by `toOffsetInstant` and written by `fromOffsetInstant`; no offset digit is sliced by hand.
3. The try-catch and sentinel-return rules above are unchanged.

**No century is guessed.** Neither UN/EDIFACT nor X12 says which century a two-digit year belongs to, so no EDI function reads a code whose grammar carries `YY` (`101`, `201`, `202`, `206`, `207`, `301`, `302`, `713`, `717`; `D6`, `TT`, `TR`, `RD6`, `TU`), and no EDI function takes options. A caller reads such a value with `parseDateWithPattern` or `parseDateTimeWithPattern`, whose `yy` token needs the caller's `yearWindow` (`TwoDigitYearOptions`) and returns the sentinel without it. `yearWindow` is either the first year of a fixed 100-year window (`2000` reads `00`–`99` as 2000–2099), for stored data, or `"rolling"`, the 100 years from 50 before the current UTC year to 49 after, for live data. `internal/twoDigitYear.ts` holds the arithmetic and no year of its own. A cut-off built into the library is right today and wrong later, so GMT never picks a century where it has a choice. Three formats have no choice, because their own standard mandates a two-digit-year rule: RFC 5322 §4.3 and RFC 9110 for their obsolete date forms, applied by `parseRfc2822` and `parseHttpDate`, and SWIFT's value-date rule (Message Format Validation Rules, Part II §4.1.1) for the `YYMMDD` value date of MT fields 30 and 32A, applied by `parseSwiftDate` and `formatSwiftDate`. A mandated rule is applied exactly as written; a format whose standard states none still takes the caller's `yearWindow`.

This prohibition stands for every other function in the library.

### Scoped exception: time-scale strings in the `timescale/` and `gnss/` converters (MAR-16)

The same three rules extend to `fromTAI`, `fromTT` and `fromTCG` (`packages/gmt/src/timescale/convert/`) and `gnssToUtc` (`packages/gmt/src/gnss/convert/`). A time-scale string (`"2026-01-01T00:00:37 TAI"`) is an ISO 8601 extended local date-time, one space, and a token naming the scale: `TAI`, `TT` or `TCG` (FITS 4.0 Table 30) or one of the six RINEX 4.02 §5.2.8 time-system identifiers (`GPS`, `GAL`, `BDT`, `QZS`, `GLO`, `IRN`). ISO 8601 has no designator for TAI or a satellite system's time, and no `Temporal.*.from` reads one at any layer. The grammar is fixed, never caller-supplied:

1. One regex, `timeScaleString` in `internal/timeScaleString.ts`: a four-digit year, `T`, seconds required, one to nine fraction digits after `.`, one space, the token. Not in `regex/`: no standards body publishes the joined form.
2. The extracted fields are always handed to `Temporal.PlainDateTime.from(fields, { overflow: "reject" })`. A second of 60 never reaches Temporal: it is refused for every token but `GLO`, and for `GLO` it is passed as 59 with a flag, and kept only for one of the 27 inserted leap seconds.
3. The try-catch and sentinel-return rules above are unchanged.

The UTC side reads a second-60 instant (`"2016-12-31T23:59:60Z"`) without manual parsing: GMT's instant grammar with second 60 (`internal/utcReading.ts`) checks the shape, and `Temporal.Instant.from` reads it with the specification's clamp to 59. Only the `timescale/` and `gnss/` converters, `timescale/`'s CCSDS ASCII time codes (`parseCcsdsAsciiA`, `parseCcsdsAsciiB`, `formatCcsdsAsciiA`, `formatCcsdsAsciiB`) and `finance/`'s FIX functions (`parseFixUtcTimestamp`, `formatFixUtcTimestamp`, `isValidFixUtcTimestamp`) do this, and only for one of the 27 inserted leap seconds. `formatFixUtcTimestamp` and `formatCcsdsAsciiA`/`B` accept a second-60 instant, and `parseFixUtcTimestamp` and `parseCcsdsAsciiA`/`B` return one. `isValidFixUtcTimestamp` only agrees with the parser. Every other function still rejects a second of 60.

This prohibition stands for every other function in the library.

### Scoped exception: finance message grammars in `finance/` (FIN-95, FIN-96)

The same three rules extend to `parseFixUtcTimestamp`, `formatFixUtcTimestamp`, `isValidFixUtcTimestamp`, `parseSwiftDate`, `formatSwiftDate` and `isValidSwiftDate` in `packages/gmt/src/finance/`. The FIX `UTCTimestamp` (`YYYYMMDD-HH:MM:SS[.sss…]`) and the SWIFT MT value date (`YYMMDD`, `6!n`) are not ISO 8601 and no `Temporal.*.from` reads them. The grammars are fixed, never caller-supplied:

1. One regex, `FIX_UTC_TIMESTAMP` in `internal/fixUtcTimestamp.ts`, with its field reader and both writers beside it. Not in `regex/`: FIX states the format in prose. The public check is `isValidFixUtcTimestamp`. SWIFT: one regex, `SWIFT_DATE` in `internal/swiftDate.ts`, with its field reader, the value-date century rule and the writer beside it. Not in `regex/`: SWIFT gives a format code (`6!n`), not a pattern, and a value is valid only once its century and range are known. The public check is `isValidSwiftDate`.
2. The fields are always handed to `Temporal.PlainDateTime.from(fields, { overflow: "reject" })` (FIX) or `Temporal.PlainDate.from(fields, { overflow: "reject" })` (SWIFT). A FIX second of 60 is passed as 59 with a flag, and kept only for one of the 27 inserted leap seconds.
3. The try-catch and sentinel-return rules above are unchanged.

**The century is SWIFT's.** `parseSwiftDate` and `formatSwiftDate` take no options and apply SWIFT's value-date rule (Message Format Validation Rules, Part II §4.1.1): `YY` above 79 is 19`YY`, the rest 20`YY`, a year after 2060 is refused, and the formatter refuses a year outside 1980 to 2060. This is one of the mandated rules the INT-15 [No century is guessed](#scoped-exception-edi-datetime-grammars-in-the-parseedifact-and-parsex12-functions-int-15) paragraph names.

This prohibition stands for every other function in the library.

### Scoped exception: aviation message grammars in `aviation/` (AV-97)

The same three rules extend to `parseSsimDate` and `formatSsimDate` in `packages/gmt/src/aviation/`. The SSIM date `DDMMMYY` (`01JAN26`) is not ISO 8601, and Temporal's `.from()` cannot parse it at any layer. The grammar is fixed, never caller-supplied:

1. One regex, in `internal/ssimDate.ts`, built from the table of twelve month letters, with a field reader and a writer derived from the same table. No public function slices the string itself. The grammar is not a public pattern, because a value is a date only once its century is known: the public check is `isValidSsimDate(value, options)`, and `regex/` gains nothing.
2. The extracted fields are always handed to `Temporal.PlainDate.from(fields, { overflow: "reject" })`.
3. The try-catch and sentinel-return rules above are unchanged.

**The month letters are a code.** They are fixed English and upper case, never read through `Intl`, and never case-folded. This is an explicit exception to the library's locale-aware formatting.

**The century is the caller's.** Both functions take `TwoDigitYearOptions` and return the sentinel without `yearWindow`, under the INT-15 [No century is guessed](#scoped-exception-edi-datetime-grammars-in-the-parseedifact-and-parsex12-functions-int-15) rule.

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

### Scoped exception: HL7 v2 date/time grammar in `parseHL7` and `formatHL7` (HLTH-93)

HL7 v2 `DTM` (`YYYY[MM[DD[HH[MM[SS[.S[S[S[S]]]]]]]]][+/-ZZZZ]`, ch. 2A 2.A.22) and the `TS` that wraps it (2.A.77) are not ISO 8601, and no `Temporal.*.from` reads either. The grammar is fixed and published:

1. The grammar is one regex in `internal/hl7DateTime.ts`, built from fragments named in the picture's own notation, with the split of a `TS` at `^` and `&` and Table 0529 beside it. Fields come out as named groups, never by per-call slicing in a public function. It is not a public pattern: a `DTM` is valid only as a whole, so the public check is `isValidHL7`. A second regex in the same file, `isoHl7Form`, reads the form of `formatHL7`'s ISO 8601 input and never its values: which groups are present (so the written precision, through `isoHl7Precision`), how many fraction digits there are, and whether there is an offset.
2. Extracted fields are **always** checked by Temporal before they are used. `parseHL7` hands them to `Temporal.PlainDate.from(fields, { overflow: "reject" })` and `Temporal.PlainDateTime.from(fields, { overflow: "reject" })`. A value at minute precision or finer that carries an offset is rebuilt as an extended ISO string and read by `toOffsetInstant`; the offset of a partial value (year, month, day or hour precision) is checked with the `utcOffset` regex and normalised with `formatUtcOffset`. `formatHL7` reads its input by the precision it is written at: a year's group goes to `Temporal.PlainDate.from({ year, month: 1, day: 1 }, { overflow: "reject" })`; a month is read from the string by `Temporal.PlainYearMonth.from`; a day is checked with `isDateString`, the core of `isValidDate`, and then read from the string by `Temporal.PlainDate.from`; an hour's groups go to `Temporal.PlainDateTime.from(fields, { overflow: "reject" })`. A local minute or finer is read from the string by `plainDateTimeOf`, the core of `isValidDateTime`, which calls `Temporal.PlainDateTime.from`, and a form with an offset, an hour-only one included, is read by `readFormOffsetInstant`, the reader `formatFHIR` shares. It writes digits from Temporal's fields.
3. The try-catch and sentinel-return rules above are unchanged.

### Scoped exception: FHIR R4 date/time grammar in `parseFHIR`, `isValidFHIR` and `formatFHIR` (HLTH-94)

FHIR R4 `date`, `dateTime` and `instant` are profiles of ISO 8601. Temporal reads none of them as they stand: a FHIR value may stop at a year or a month, and a second of `60` is allowed. HL7 publishes one `regex` per type in the R4 StructureDefinitions.

1. **The grammar is FHIR's own regexes.** They are published unchanged in `regex/fhir.ts` and anchored as R4 Datatypes §2.24.0.1 asks. `internal/fhirDateTime.ts` reads fields from `fhirDateTime`'s numbered groups, and nowhere else. `formatFHIR` reads the form of its ISO 8601 input with `isoHl7Form`, as `formatHL7` does.
2. **Temporal checks every extracted field.**
   - The date goes to `Temporal.PlainDate.from(fields, { overflow: "reject" })`.
   - A moment is read by `readOffsetInstant`, the internal core of `toOffsetInstant`.
   - A second of `60` is checked against the leap-second table (`parseUtcReading` and `taiOfUtc`).
   - `formatFHIR` reads a local form with `Temporal.PlainDateTime.from(fields, { overflow: "reject" })`, and a form with an offset with `readFormOffsetInstant`, which reads an hour-only time with `Temporal.Instant.from` and every finer one with `readOffsetInstant`. It writes digits from Temporal's fields, then checks its own result with the same reader.
3. The try-catch and sentinel-return rules above are unchanged.

This prohibition stands for every other function in the library.

### Calendar-annotated strings are RFC 9557 (E1, E7)

A calendar string is the RFC 9557 form Temporal writes: the ISO 8601 date (or zoned datetime),
then a `[u-ca=<id>]` annotation. The digits are always ISO; the annotation names the calendar the
date is presented in (RFC 9557 §3.3). Output is exactly `Temporal.PlainDate#toString()` /
`Temporal.ZonedDateTime#toString()` with `calendarName: "auto"`: no annotation for `iso8601`,
`[u-ca=<id>]` for every other calendar, `gregory` included. Eras, calendar years and month codes
are read values, never string content. Decision of record:
[calendar-standards-decisions.md](./domination/research/calendar-standards-decisions.md) Q1 and
[CORE-8 § Phase 2](./domination/issues/CORE-8.md#rfc-9557-calendar-strings-decisions-of-record),
which records the native Temporal evidence for each rule below.

- **`plain/` `PlainDate`** — `regex/calendar-date.ts`: `<date>[u-ca=<id>]`. Year is Temporal's
  `DateYear` (four digits, or a sign and six; `-000000` rejected). Parsed by
  `internal/calendarDateString.ts` (GMT's strict date or date-time shape before the first `[`, then
  `Temporal.PlainDate.from` on the whole string), written by
  `internal/formatDateInCalendar.ts`.
- **`zoned/`** — `regex/calendar-zoned-date-time.ts`: `<date>T<time><offset>[<timeZone>][u-ca=<id>]`,
  the calendar annotation after the zone (RFC 9557 §4.1). Parsed by `internal/calendarZonedString.ts`
  (GMT's strict `zonedDateTimeBody` shape before the first `[`, then the whole string goes to
  `zonedDateTimeFrom`), written by `formatZonedInCalendar`.
- **The annotation.** A `u-ca` annotation, lower-case key, optionally critical (`[!u-ca=…]`). The
  id goes to Temporal's `CanonicalizeCalendar` (`internal/calendarSystemIds.ts`
  `canonicalCalendarSystem`), which folds case and CLDR aliases (`islamicc` → `islamic-civil`,
  `ethiopic-amete-alem` → `ethioaa`), and must be a `CalendarSystem`.
- **Other annotations follow Temporal's ISO grammar** (`ParseISODateTime`), read by
  `Temporal.PlainDate.from` / `Temporal.ZonedDateTime.from` in the shared parse helpers. A time zone
  annotation on a date and elective unknown annotations (`[foo=bar]`) are ignored, and the first
  `u-ca` names the calendar. An unknown critical annotation, a second `u-ca` when either is
  critical, a calendar before the zone and `;era=` are rejected.
- **A plain calendar date-time is read as its date**, as `Temporal.PlainDate.from` reads it
  (decision of 2026-09-17; replaces E5 / issue #78's date-only rule).
  `"2024-10-03T14:30[u-ca=hebrew]"` is 2024-10-03 in Hebrew, and a bare date-time is its ISO date:
  the time is dropped. The part before the first `[` must match GMT's strict `plainDate` or
  `plainDateTime` shape, as `isValidDate`/`isValidDateTime` require, before Temporal reads the
  annotations (`internal/calendarDateString.ts`): basic format, a space or lower-case `t`
  separator, a UTC offset or designator, and a leap second (second `60`) are rejected, although
  `Temporal.PlainDate.from` reads all but the designator. Output is always the date
  (`Temporal.PlainDate#toString()`).
- **The same strict extended shape gates every zoned, UTC, instant and `relativeTo` string**
  (`internal/isoStringBody.ts`): before the first `[`, a zoned string is `zonedDateTimeBody`
  (`<date>T<time>`, then nothing, `Z` or `±HH:MM[:SS[.fraction]]`), an instant `instantBody` (the
  `Z` or offset required), a UTC string `utcDateTime` (upper-case `Z`), and a `relativeTo` the
  zoned shape when it has a time zone annotation, otherwise `plainDate`/`plainDateTime`; basic
  format, a space or lower-case `t` separator, a lower-case `z`, an hour-only time or offset and a
  zoned date without a time are rejected although Temporal reads them.
- **A plain time is a bare `HH:MM[:SS[.fraction]]`** (`plainTime`): a leading time designator
  (`"T14:30"`, `"t14:30"`) is rejected, although `Temporal.PlainTime.from` reads it. The `T`
  designator belongs to date-time strings, where it separates the date from the time; GMT's strict
  extended-body rule takes the time on its own without it.
- **Calendar ids** are the canonical CLDR `bcp47/calendar.xml` / Temporal ids, in strings and as
  function arguments: `iso8601`, `gregory`, `hebrew`, `islamic-civil`, `islamic-tbla`,
  `islamic-umalqura`, `japanese`, `buddhist`, `roc`, `persian`, `indian`, `ethiopic`, `ethioaa`,
  `coptic` (the Intl Era and Month Code proposal's `table-calendar-types` without `chinese` and
  `dangi`, which GMT does not support; `islamic` and `islamic-rgsa` are not supported either).
  `gregorian`, `taiwan` and `islamic-tabular` are not calendar ids and return the sentinel. The
  alias table is Temporal's, asked of the polyfill, never a GMT copy.
- **No converter from the pre-1.16.0 calendar-native-digit strings.** No standard defines them, and
  most are also valid RFC 9557 strings, so the two readings cannot be told apart. Do not add
  heuristic detection; a stored old string is regenerated from its ISO date.
- **`ethiopic` and `coptic` compute in `ethioaa`** (`computationCalendarId`): polyfill 0.5.1 cannot
  read their fields under ICU ≥ 78, and the three share months, days and arithmetic, differing by a
  constant year. A parsed value therefore carries `ethioaa`; code that writes a string back takes the
  calendar from `calendarSystemOfDateValue` / `calendarSystemOfZonedValue`, never from `calendarId`.
- **Where it is accepted.** `plain/`: `isValidCalendarDate` and the functions gated on it
  (`convertDateToCalendar`, `addDate`, `subtractDate`, `diffDate`, `diffDateAsDuration`, the
  `Date`-suffixed `plain/interval/*`), plus `duration/`'s `relativeTo` (`internal/resolveDurationRelativeTo.ts`,
  which also accepts the zoned form). `zoned/`: `isValidCalendarZonedDateTime` /
  `isValidCalendarZonedInterval` and the functions gated on them (`convertZonedToCalendar`,
  `addZoned`, `subtractZoned`, `diffZoned`, `diffZonedAsDuration`, `zoned/interval/*`). Every other
  `zoned/` function, and `isValidZonedDateTime`, reads annotations as `Temporal.ZonedDateTime.from`
  does (an elective one is ignored, an unknown critical one is rejected) and accepts `[u-ca=iso8601]`,
  but rejects any other calendar, so a validator never certifies a string its own namespace refuses.
  `utc/` and the `Interval` endpoints are instants: a calendar annotation (`[u-ca=hebrew]`) is
  ignored, as `Temporal.Instant.from` ignores it, and a time-zone annotation is read as
  [§ Calendar & zone semantics, rule 9](#9-an-instant-string-is-read-as-the-zoned-string-it-may-be)
  says.
- **Different calendars follow Temporal's `CalendarEquals`.** A difference between two values that
  name different calendars returns the sentinel (`diff*`, `intervalCount*`, `intervalLength*`,
  `splitIntervalByUnit*`, `intervalOverlappingDays*`; `internal/calendarDatePairPolicy.ts`,
  `calendarZonedPairPolicy.ts`), as Temporal's `until` throws. Ordering (`compare`) has no calendar
  check, so the ordering-only interval functions accept mixed calendars; value-returning interval
  set operations reject the mismatch, since their result must be written in one calendar. A bare
  ISO string names `iso8601`.

Every Temporal call keeps the try-catch and sentinel rules above. This is not a manual-parsing
exception: the regex restricts the shape and Temporal parses the string itself.

Do not extend the calendar grammar to a new namespace (e.g. `PlainDateTime`, `utc/`) without a new roadmap story.

## Loop Style

Avoid `while` loops in new code. Prefer `for` loops or array methods (`map`, `filter`, `reduce`, etc.). `while` loops are more error-prone and harder to reason about than bounded `for` loops.

**A bounded loop that runs out returns the sentinel, never a partial value.** When a walker, stepper or search hits its cap without converging (e.g. `zonedUnitStart`'s transition walk-back, `bucketRange`'s 10,000-boundary cap), the function returns `""` / `null` / `[]`. A plausible-looking wrong answer is worse than the documented sentinel.

### Loop cost

- **Name what bounds every loop.** A loop bounded by a constant, by the output size, or by one pass over the caller's own input needs no more. A loop that steps across the input span (days, weeks or offset changes between two instants), or that passes over a log or holiday list more than once per call, needs a stated reason no closed form exists, in a comment beside the loop.
- **Formula first.** Before stepping day by day, use epoch-day arithmetic (`epochDayOf`, `isoFieldsOf`, `isoWeekdayOf` in `internal/epochDay.ts`), whole-week jumps, and binary search over sorted arrays (`lowerBound`, `countWithin`). Walk only the remainder, at most a week, and only the dates near a zone transition.
- **Temporal at the edges.** Parse inputs once on the way in; format once on the way out. Build or parse no Temporal object per loop step or inside a sort comparator.
- **Resolve once.** Validate and resolve a calendar, schedule, zone or rule set once per public call, and pass it in resolved form to an `internal/` core. A public function never calls another public function; both call the core.
- **Remember only what is pure.** A module-level memo holds only facts that are a pure function of their key for the life of the process (zone transitions, parsed holiday strings, validated zone ids, `Intl` formatters built from explicit arguments). It is bounded and cleared on overflow, stores no answer that depends on the clock, on process defaults or on a global the caller can replace (the formatter cache drops a kind once `Intl[kind]` is no longer the constructor that built it), and does no work at import time. The existing memos are in `internal/zonedTransitionSearch.ts`, `internal/businessCalendar.ts`, `internal/formatterCache.ts` and `internal/validatedZones.ts`; reuse them before adding one. `internal/temporalCompat/` keeps its own probe caches for its workarounds.
- **No `new Intl.*Format` outside `internal/formatterCache.ts`**, except the default-locale read in `internal/resolveLocale.ts`.
- **Nothing runs at import, and no fixtures ship.** No top-level Temporal or `Intl` call. Test data, repros and canary tables never live in a module that shipped code imports.
- **Measure what you add.** A function with a span-dependent loop gets a `packages/gmt/bench/` row for a short, a 1-year and a 10-year input. The handoff gives the numbers and the size delta of each touched entry from `pnpm size --files <entry>`. Put no timing assertion in an `it` row: it is flaky across the CI matrix.
- **The existing rows are the contract when optimising.** A rewrite keeps every row green on the full zone matrix. Old against new over random inputs is a check, never an expected value.

## Plain / Zoned Separation

- `plain/` — timezone-free operations (`PlainDate`, `PlainTime`, `PlainDateTime`)
- `zoned/` — IANA timezone-aware operations (`ZonedDateTime`)
- Never mix the two in the same function or module.
- **Core namespaces, industry layers, cross-industry layers.** Core namespaces hold general time primitives anyone uses (`calendar/`, `duration/`, `instant/`, `zoned/`, `timescale/`, `precision/` and the rest). Industry layers are named for an industry and hold its own functions (`transport/`, `intermodal/`, `finance/`, `aviation/`, `healthcare/` and, later, `maritime/` and the rest). A cross-industry layer is a recognised industry domain that other industries draw on: `workforce/` (people's working time, the CORE-76 duty engine) and `gnss/`. A function shared across industries goes in the cross-industry layer for its domain, or in Core if it is truly general — never in a grab-bag "shared" namespace, never in one industry's namespace when other industries also need it, and never in a new namespace that is not a recognised domain.
- The other namespaces follow the same one-type-per-function rule: `utc/`, `unix/`, `instant/`, `calendar/`, `span/`, `interval/`, `precision/`, `duration/`, `regex/`, `transport/`, `intermodal/`, `finance/`, `workforce/`, `gnss/` (see `packages/gmt/src/`).

## International authority first

**International authority first.** A rule's authority is, in order: (1) an
international treaty or standards body — ISO, IEC, ITU, BIPM, IERS, IAU, IMO, ICAO, WMO, WHO,
UN/CEFACT, CCSDS, IGS/RINEX, IETF, Unicode/CLDR, IANA, ECMA; (2) a multinational industry body —
ISDA, IATA, BIMCO, DCSA, GS1, HL7 International, FIX, SWIFT; (3) a national source, only as one peer
among others and labelled with its country. A national system, agency or convention is never a
default, never the only authority and never gets its own named function. Where no international
source exists, the rule is a GMT rule backed by sources from at least two countries. Example zones,
locales, holidays and date orders are spread across regions; none is "the" example. An
international convention that is law (a maritime labour or watchkeeping convention, a road-transport
agreement, an aviation-operations annex) may shape an example's numbers, but it is never named in
code or docs: GMT tracks no law. Evidence records — `painpoints.md` and `research/*.md` — may still
cite national sources as proof that a painpoint exists. The full rule and its place among the epic's rules are in
[the tracker's Definition of Done](./domination/tracker.md#added-for-this-epic); an Authority table
row ([AUTHORITY_TABLE.md](./reference/AUTHORITY_TABLE.md)) names the international source first.

## Calendar & zone semantics

Decisions of record for date arithmetic and zone-aware boundaries. Code, tests and reviews follow these; do not re-open them without a new primary source.

### 1. TC39 Temporal is the authority

Where calendar semantics are ambiguous, GMT does what [Temporal](https://tc39.es/proposal-temporal/docs/plaindate.html) does.

- **Arithmetic clamps.** A day that does not exist follows Temporal's default `overflow: "constrain"`: `2024-02-29` plus one year is `2025-02-28`; Jan 31 plus one month is Feb 29/28.
- **Parsers reject.** `parse*` functions and the scoped grammars above use `overflow: "reject"` and return the sentinel for `"31 Feb"`. A parser must not invent a date.
- **Why clamp.** ISO 8601-1 defines calendar dates and durations, but it gives no rule for adding a month or a year to a day the result's month does not have. Temporal does: `add`, `subtract` and `with` default to `overflow: "constrain"`, which moves a day that does not exist to the last day of that month (the `RegulateISODate` operation in the [Temporal specification](https://tc39.es/proposal-temporal/)). Temporal is the highest rung in the [source order](../apps/dox/src/content/docs/guides/concepts/standards.mdx), so GMT follows it. Stated as a GMT rule: a date or period that would land on a day that does not exist lands on the last day of that month instead.
- **Known divergence, documented and not built:** a "month-end" rule would put a Feb-28 anchor on 02-29 in leap years. Temporal gives 02-28, and so does GMT (e.g. `getFiscalPeriod`'s `yearEndsOn`).

### 2. Zone-aware unit boundaries are never truncate-and-re-resolve

Never compute a zoned start-of-unit by truncating the wall clock and resolving it again — `zdt.round({ roundingMode: "trunc" })`, or `.with({ … })` plus `"compatible"` disambiguation. When the truncated wall time does not exist or occurs twice, Temporal relocates it, and the "start" lands after its own input or before an earlier boundary.

- Use `internal/zonedBucket.ts` (`zonedUnitStart`, `nextZonedBucketStart`), or Temporal's own `zdt.startOfDay()` / `zdt.hoursInDay` for days.
- **Probe zones** — every boundary function is tested against these transitions:

| Zone                                                                               | Transition                                                                                                                                                                                   |
| ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Pacific/Chatham`                                                                  | 2024-09-29 spring (+45 min offset), 2024-04-07 fall                                                                                                                                          |
| `Antarctica/Casey`                                                                 | 2020-10-04 (three-hour jump)                                                                                                                                                                 |
| `America/New_York`                                                                 | 2024-11-03 fall-back                                                                                                                                                                         |
| `Australia/Lord_Howe`                                                              | 30-minute DST                                                                                                                                                                                |
| `America/Santiago`                                                                 | 2024-09-08 (skipped local midnight)                                                                                                                                                          |
| `America/Havana`                                                                   | 2024-11-03 (midnight repeated on the same date)                                                                                                                                              |
| `America/Goose_Bay`                                                                | 2010-11-07 (fall-back reopens the previous date)                                                                                                                                             |
| `Pacific/Apia`                                                                     | 2011-12-30 (deleted day)                                                                                                                                                                     |
| `Asia/Manila`, `Pacific/Guam`, `Pacific/Saipan`, `Pacific/Kosrae`, `Pacific/Palau` | 1844-12-31 (deleted day crossing the date line, before the polyfill's 1847-01-01 transition search floor; `dateLineCrossingTimeZones` in `src/test/timeZoneMatrix.ts`, workaround `zoned.E`) |

- **When a transition opens a new bucket.** Hours: when the clock lands on an hour boundary or the label jumps — New York's repeated 01:00 is its own hour, so a fall-back day has 25 hour buckets. Day and larger: only when the local label changes — Havana's repeated midnight on 2024-11-03 stays one 25-hour day (matching `hoursInDay`), while Goose_Bay's fall-back into 6 November is its own 59-minute bucket because the date changed.

### 3. Boundary functions take no resolution options (the TC39 pattern)

TC39 splits the API in two ([ZonedDateTime docs](https://tc39.es/proposal-temporal/docs/zoneddatetime.html)): **field-setting** methods (`with`, `from`) take `disambiguation`/`offset`, while **boundary** methods take none — `startOfDay()` has no options and returns the day's earliest real instant, `round()` accepts only rounding options, and `hoursInDay` derives from `startOfDay`. GMT follows the same split.

- Field-setting functions keep their resolution options: `setZoned`/`setUnix`/`cycleZoned` take `disambiguation` and `offset` (default `"prefer"`, as `ZonedDateTime#with`); `addZoned`/`subtractZoned`, `intervalFromDurationZoned`, `convertPlainDateTimeToZoned` and `resolveLocal` take `disambiguation` only, because they resolve a plain date-time that has no offset (`PlainDateTime#toZonedDateTime` reads only `disambiguation`). An option a function cannot act on is not accepted "for consistency"; it is left off the signature.
- Boundary functions — `startOf*`/`endOf*`, quarter and locale-week variants, and everything built on them (`areZonedEqualBy`, `areUnixEqualBy`, `intervalCount*`) — **always** return the real boundary: `start ≤ input < next start`, end = next start − 1 ns. They take no `disambiguation`/`offset` options, and neither does `mapZonedHoursInDay` (the ignored options were removed in 1.16.0). Do not reintroduce an opt-in: any value, including the documented defaults, used to bring the bug back.
- **Day-length functions follow the TC39 date day.** `getHoursInZonedDay` and `mapZonedHoursInDay` use `startOfDay()`/`hoursInDay`: the day is the input's calendar date, from its earliest instant to the next date's. That equals the walker's day bucket everywhere except a fall-back that re-enters the previous date — America/Goose_Bay, 2010-11-07: an input at `2010-11-06T23:30-04:00` gets 6 November's 24 hours (ending 00:00-03:00 on the 7th, before the input), while `startOfZoned(…, "day")` returns the reopened 59-minute bucket. Documented and pinned by tests; do not "fix" one side to match the other.
- Equality helpers compare boundary **instants** when both values share a zone, so both passes of a repeated hour are different hours. Across zones `areZonedEqualBy` compares each value's own local unit label (New York 10:00 and Berlin 20:00 on the same date are the same day); `areUnixEqualBy` always resolves in one zone, so it always compares instants.

### 4. `roundZoned` / `roundUnix` pass TC39 through

They keep `ZonedDateTime.prototype.round` semantics exactly, including its behaviour around transitions. Their JSDoc says so; callers who need a floor use `floorToZone`. Do not "fix" them.

### 5. Repeated steps are computed from the anchor

For **calendar units** (years, months, weeks, days), step k of a split or series is `start.add({ [unit]: amount * k })`, never `previous.add(…)`. Compounding clamped results drifts: Jan 31 by month must give Mar 31 and Apr 30, not Mar 29/Apr 29. This matches Temporal and Luxon's `Interval.splitBy`.

- **Exact time units** (hours and smaller) never clamp, so they step from the previous boundary — `amount * k` would lose precision past 2^53.
- **A step that lands on the previous boundary is skipped, not fatal.** Anchored steps into a deleted local day (Apia, 2011-12-30) resolve to the same instant; drop that empty slice and continue. Only a step that goes backwards, or a bounded run of non-advancing steps, returns the sentinel.
- **Caps are per contract.** `bucketRange` caps at 10,000 buckets (it materialises a list); `intervalCount*` caps at 10,000 transitions (it only counts). Counts equal `bucketRange(...).length` only while `bucketRange` is within its cap.

### 6. Loop exhaustion → sentinel

See [§ Loop Style](#loop-style).

### 7. Validate-then-parse is intentional

See [§ Always Wrap Temporal Calls](#always-wrap-temporal-calls-in-try-catch).

### 8. Intervals are half-open `[start, end)`

An instant, date or time `t` is inside an interval when `start ≤ t < end`: SQL:2011's closed-open
application-time `PERIOD` (ISO/IEC 9075-2:2011), RFC 5545 §3.6.1's non-inclusive `DTEND` and
EWD831. This holds for `interval/` and for every positional `plain|utc|zoned|unix/interval`
function (all since 1.16.0). Tie-breaks and empty-interval edges follow the
[CORE-6 Design notes](./domination/issues/CORE-6.md#design-notes) and
[Decisions](./domination/issues/CORE-6.md#decisions); the rules below derive the relations that
those notes have no function for.

- **No one-unit steps.** Pieces end and start exactly at a cut: no nanosecond, day or `epochUnit`
  step in `intervalDifference*`/`intervalXor*`, and no one-unit gap in `intervalAbuts*`.
- **Instant-typed variants delegate.** After its UTC-string gate, a `Utc` variant calls the
  `interval/` function with the same relation (`intervalsOverlap`, `intervalContains`,
  `intersectIntervals`, `mergeIntervals`, `subtractIntervals`). Relations with no `interval/`
  function, and the `Date`/`DateTime`/`Time` variants, use `internal/halfOpenIntervals.ts`.
- **Outputs are re-serialised** in the type's canonical spelling (`toString()`, or
  `formatDateInCalendar`). `interval/`'s echo-the-caller's-string rule applies to caller-owned
  `Interval` records only.
- **Empty intervals** (`start === end`) hold no instant:
  - *contains / engulfs:* `inner ⊆ outer` and the two overlap, so an empty `inner` counts only
    strictly inside `outer` (`[end, end)` is not contained, as the point `end` is not);
  - *union:* the single run of `mergeIntervals([a, b])`, else `null`; a stranded empty interval is
    ignored, and two empty intervals give `null`;
  - *abuts:* Allen's "meets", one non-empty interval's `end` equal to the other non-empty
    interval's `start`; an empty interval abuts nothing;
  - *XOR:* the maximal runs covered an odd number of times, sorted by start; touching pieces join;
  - *overlapping days:* the calendar days holding at least one instant of the non-empty
    intersection, so an empty intersection counts `0`;
  - *count:* a zero-length interval touches no unit and counts `0`.
- **Tiling functions partition.** `intervalSplitAt*`, `splitIntervalByUnit*` and
  `intervalDivideEqually*` give each piece's `end` as the next piece's `start`; the pieces share no
  instant. JSDoc never describes a shared endpoint as belonging to both pieces.
- **A `Date` interval excludes its `end` day.** "The last day of the period" is passed as the next
  day: `addDate(end, { days: 1 })`.

### 9. An instant string is read as the zoned string it may be

`Temporal.ZonedDateTime.prototype.toString` writes the offset rounded to the minute
(`FormatDateTimeUTCOffsetRounded`), so a zoned string for a zone with a sub-minute offset carries
an offset up to 30 seconds from the real one: `Africa/Monrovia` stood at −00:44:30 until 1972 and
is written `-00:45`. `Temporal.ZonedDateTime.from` reads that string back to the same instant
(TC39 `ToTemporalZonedDateTime`, match-minutes in `InterpretISODateTimeOffset`);
`Temporal.Instant.from` takes the written offset literally. GMT writes zoned strings and reads
them back as instants, so every instant reader follows the zoned reading.

- **The rule.** When a string has a bracketed zone and an offset written to the minute, and that
  offset is the zone's real offset at that wall time rounded to the minute, the instant is the one
  the zone gives: `1960-01-01T00:20:00-00:45[Africa/Monrovia]` is `01:04:30Z`, not `01:05:00Z`.
  The match depends on the zone and the offset only; a calendar or elective annotation never
  changes it.
- **The instant range is the only range.** An instant reader has no `CheckISODaysRange` on the
  local date and does not need the written offset's own reading to be in range. Every string
  Temporal writes for an instant in range is valid and reads back, the first and last instants
  included: `-271821-04-19T23:58:45-00:01[Europe/London]` (local mean time, −00:01:15) is the
  first instant, although its local date is outside Temporal's date range and its reading at
  −00:01 is 15 seconds before the range.
- **Two cases where a zoned string GMT wrote does not read back as its instant.** Both are
  Temporal's own, GMT keeps Temporal's written format, and there are no others.
  1. *Every reader: a repeated wall time inside a sub-minute offset change reads as its first
     pass.* The match runs over the candidate instants in order, so when a wall time happened
     twice and the rounded offset fits the first pass, that pass is the answer, even for a string
     written from the second. This is a class of strings, not one zone: it arises wherever a zone's
     history has a fall-back of under a minute at a sub-minute offset (18 zones in the current tz
     database, Africa/Ndjamena in 1911 and America/Anchorage in 1900 among them). The example
     test262 uses: Pacific/Niue moved from −11:19:40 to −11:20:00 at the end of
     15 October 1952: the instant `-543069601000000000n` is written
     `1952-10-15T23:59:59-11:20[Pacific/Niue]` and reads back as `-543069621000000000n` (test262
     `intl402/Temporal/ZonedDateTime/from/zoneddatetime-sub-minute-offset.js`). The exact offset
     (`-11:20:00`) names the second pass.
  2. *Zoned reads only: a local date of −271821-04-19 is refused.* A function that keeps the zone
     reads through `Temporal.ZonedDateTime.from`, whose `InterpretISODateTimeOffset` runs
     `CheckISODaysRange` on the local date before it matches the offset. A zone west of Greenwich
     shows that date for the first hours of the instant range (the first 4 h 56 min 2 s in
     `America/New_York`), so the string Temporal writes there
     (`-271821-04-19T23:59:00-00:01[Europe/London]`) returns the sentinel from `transitTime`,
     `toOffsetInstant`, `isValidZonedDateTime` and every `zoned/` function, while the instant
     readers read it. GMT does not widen the zoned read: a validator must not certify a zoned
     string Temporal refuses. The spec step is recorded as a tc39 item to file in
     [js-temporal-polyfill-bugs.md § J](./domination/js-temporal-polyfill-bugs.md).
- **Everything else keeps the written offset.** The complete list: a string without a bracket; a
  `Z` instant; an offset written with seconds (TC39 matches it exactly, so
  `-00:45:00[Africa/Monrovia]` is −00:45:00 to an instant reader and invalid as a zoned string;
  polyfill 0.5.1 matches it by minutes, which `zonedDateTimeFrom` corrects as temporalCompat
  D12); a bracket whose zone does not exist; and a bracket whose zone has no instant in range
  with that wall time at the written offset or at one that rounds to it. An instant reader does
  not validate such a bracket; a function that keeps the zone (`transitTime`, `toOffsetInstant`,
  every `zoned/` function) rejects it. A string whose written reading is outside the instant
  range, and which its zone does not bring inside, is invalid.
- **One implementation.** `internal/instantNanoseconds.ts`: `parseInstantNanoseconds` (and
  `isValidInstant` on top of it) for epoch nanoseconds, `instantFrom` for a `Temporal.Instant`.
  A caller's instant string never goes to `Temporal.Instant.from` directly. The exceptions are
  strings that cannot carry a rounded offset to resolve: one gated on `isValidUtc` (a `Z` has no
  offset to round), one GMT has just written in `Z` form, and one already known to have no
  time-zone bracket (the offset branch of `scheduleDelivery`'s departure, reached only after a
  bracketed string has been refused).
- **No zone data.** The zone's offset comes from Temporal; GMT holds no offset table.
- **Test zones:** `Africa/Monrovia` in 1960 (30 seconds late when read literally) and
  `America/New_York` on 1883-11-18 before noon (−04:56:02, 2 seconds early); the range limits in
  `Europe/London`, `Africa/Monrovia`, `America/New_York`, `Asia/Kolkata` and `Asia/Tokyo`; and
  `Pacific/Niue` on 1952-10-15, all in `src/test/minuteRoundedOffsets.test.ts`.

## Changesets

The one rule; other docs link here.

| Change                                                         | Changeset                                              |
| -------------------------------------------------------------- | ------------------------------------------------------ |
| Bug fix, including a behaviour correction to shipped API       | `patch`                                                |
| Speed or size gain; no output, option or signature change      | `patch`                                                |
| Refactor, docs, tests or agent config with no behaviour change | empty, when a file under `packages/` changed; else none |
| New public API (function, option, namespace)                   | `minor`                                                |
| Breaking change (removed option, changed output or signature)  | `minor`, with a **Breaking changes** migration section |

`major` is never used. GMT's users are internal, so a breaking change ships in the next minor
release (owner decision, 2026-09-17). Fix to the standard: no compatibility shim, no deprecation
period, and no "removed in a later version" wording. The changeset's **Breaking changes** section
names every affected function and shows each old call or output next to its replacement.

Any file under `packages/` counts as a package change, even a README, a test or a comment, and CI's
**Story consistency** check (`changeset status`) fails without a changeset. So a change with no
release still carries an empty one (`pnpm changeset:add --empty`): two `---` lines and no package,
then one line that starts "No release." and says what changed. `apps/dox` is private, so a Dox-only
change needs none. A spec that says "no changeset" means no bump, never no file.

A speed or size changeset states the savings: before → after for size (minified and gzipped) and for speed.

Every epic story so far adds API, so its changeset is `minor`. A fix to an earlier story is still `patch`. Run `pnpm changeset:status` on every change, whatever the level, to prove coverage. It sees only files git tracks, so a new changeset counts once it is staged or committed. See `PUBLISHING.md` for the release flow.

## Linting Enforcement

The `Date` API ban is enforced at the AST level by three optional linting packages:

- `@northguild/gmt-eslint` — ESLint flat config
- `@northguild/gmt-biome` — Biome + GritQL plugins
- `@northguild/gmt-oxlint` — Oxlint JS plugin

If the linter passes, no `Date` object crept in.
