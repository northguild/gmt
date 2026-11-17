# Coding Standards: Scoped Exceptions for Messaging Grammars

Each entry extends the three rules of [the `parse*WithPattern` exception](./string-grammars.md#scoped-exception-manual-string-parsing-in-parsewithpattern-j11--decision-4).

### Scoped exception: EDI date/time grammars in the `parseEdifact…` and `parseX12…` functions (INT-15)

The same three rules extend to the EDI parsers in `packages/gmt/src/intermodal/parse/`: `parseEdifactDate`, `parseEdifactTime`, `parseEdifactDateTime`, `parseEdifactOffsetDateTime`, `parseEdifactDatePeriod`, `parseEdifactDateTimePeriod`, `parseX12Date`, `parseX12Time`, `parseX12DateTime`, `parseX12DateRange`, `parseX12DateTimeRange` and `parseX12DateAndTime`. UN/EDIFACT data element 2379, X12 data element 1250 and X12 elements 373 and 337 name fixed digit-order grammars (`CCYYMMDDHHMM`, `MMDDCCYY`, `CCYYMMDDHHMMZHHMM`, `HHMMSSDD`, …) that are not ISO 8601 and that Temporal's `.from()` cannot parse at any layer. As with J13 the grammar is fixed per code, never caller-supplied:

1. Each grammar is a regex in one table keyed by the standard's own code, `internal/ediGrammar.ts`, built from fragments named in the standards' mask notation (`CCYY`, `MM`, `DD`, `HH`, `ZHHMM`, `ZZZ`). Each code's layout is written once, beside the kind of value it states, and its regex, its field reader and its writer derive from it. X12 element 337 is sent with no code, so its table is keyed by its four masks (`HHMM`, `HHMMSS`, `HHMMSSD`, `HHMMSSDD`): `parseX12Time` reads from it and `formatX12TimeElement` writes from it. `internal/ediDateTimeFields.ts` extracts the fields from those tables — never per-call string slicing in a public function. These grammars are not public patterns: a value is only valid against a code, so the public check is the kind's validator, such as `isValidEdifactDateTime(value, format)` or `isValidX12Date(value, format)`. `regex/` gains only the two grammars GS1 publishes verbatim, `epcisEventTime` and `epcisTimeZoneOffset`.
2. Extracted date and time fields are **always** handed to `Temporal.PlainDate.from` / `Temporal.PlainTime.from` / `Temporal.PlainDateTime.from(fields, { overflow: "reject" })`. A value that carries an offset (`205`, `208`, or `303` and `304` when the zone is `±HH`, `UTC` or `GMT`) is rebuilt as an extended ISO string, read by `toOffsetInstant` and written by `fromOffsetInstant`; no offset digit is sliced by hand.
3. The try-catch and sentinel-return rules above are unchanged.

**No century is guessed.** Neither UN/EDIFACT nor X12 says which century a two-digit year belongs to, so no EDI function reads a code whose grammar carries `YY` (`101`, `201`, `202`, `206`, `207`, `301`, `302`, `713`, `717`; `D6`, `TT`, `TR`, `RD6`, `TU`), and no EDI function takes options. A caller reads such a value with `parseDateWithPattern` or `parseDateTimeWithPattern`, whose `yy` token needs the caller's `yearWindow` (`TwoDigitYearOptions`) and returns the sentinel without it. `yearWindow` is either the first year of a fixed 100-year window (`2000` reads `00`–`99` as 2000–2099), for stored data, or `"rolling"`, the 100 years from 50 before the current UTC year to 49 after, for live data. `internal/twoDigitYear.ts` holds the arithmetic and no year of its own. A cut-off built into the library is right today and wrong later, so GMT never picks a century where it has a choice. Three formats have no choice, because their own standard mandates a two-digit-year rule: RFC 5322 §4.3 and RFC 9110 for their obsolete date forms, applied by `parseRfc2822` and `parseHttpDate`, and SWIFT's value-date rule (Standards MT General Information, November 2025, §6.3.1 and §6.3.6) for the `YYMMDD` value date of MT fields 30 and 32A, applied by `parseSwiftDate` and `formatSwiftDate`. A mandated rule is applied exactly as written; a format whose standard states none still takes the caller's `yearWindow`.

This prohibition stands for every other function in the library.

### Scoped exception: finance message grammars in `finance/` (FIN-95, FIN-96)

The same three rules extend to `parseFixUtcTimestamp`, `formatFixUtcTimestamp`, `isValidFixUtcTimestamp`, `parseSwiftDate`, `formatSwiftDate` and `isValidSwiftDate` in `packages/gmt/src/finance/`. The FIX `UTCTimestamp` (`YYYYMMDD-HH:MM:SS[.sss…]`) and the SWIFT MT value date (`YYMMDD`, `6!n`) are not ISO 8601 and no `Temporal.*.from` reads them. The grammars are fixed, never caller-supplied:

1. One regex, `FIX_UTC_TIMESTAMP` in `internal/fixUtcTimestamp.ts`, with its field reader and both writers beside it. Not in `regex/`: FIX states the format in prose. The public check is `isValidFixUtcTimestamp`. SWIFT: one regex, `SWIFT_DATE` in `internal/swiftDate.ts`, with its field reader, the value-date century rule and the writer beside it. Not in `regex/`: SWIFT gives a format code (`6!n`), not a pattern, and a value is valid only once its century and range are known. The public check is `isValidSwiftDate`.
2. The fields are always handed to `Temporal.PlainDateTime.from(fields, { overflow: "reject" })` (FIX) or `Temporal.PlainDate.from(fields, { overflow: "reject" })` (SWIFT). A FIX second of 60 is passed as 59 with a flag, and kept only for one of the 27 inserted leap seconds.
3. The try-catch and sentinel-return rules above are unchanged.

**The century is SWIFT's.** `parseSwiftDate` and `formatSwiftDate` take no options and apply SWIFT's value-date rule (Standards MT General Information, November 2025, §6.3.1 and §6.3.6): `YY` from 01 to 60 is 20`YY`, any other `YY` is refused (T50), and the formatter refuses a year outside 2001 to 2060. This is one of the mandated rules the INT-15 [No century is guessed](#scoped-exception-edi-datetime-grammars-in-the-parseedifact-and-parsex12-functions-int-15) paragraph names.

This prohibition stands for every other function in the library.

### Scoped exception: aviation message grammars in `aviation/` (AV-97, AV-98)

The same three rules extend to `parseSsimDate` and `formatSsimDate`, and to `parseMetarTime` and `parseNotamValidity`, in `packages/gmt/src/aviation/`. The SSIM date `DDMMMYY` (`01JAN26`), the METAR group `YYGGggZ` (`251200Z`) and the NOTAM group `YYMMDDHHMM[EST]` or `PERM` (`1407031230EST`) are not ISO 8601, and Temporal's `.from()` cannot parse them at any layer. The grammars are fixed, never caller-supplied:

1. One regex, in `internal/ssimDate.ts`, built from the table of twelve month letters, with a field reader and a writer derived from the same table. The METAR group and the NOTAM group each get one regex and its reader in the same way: `internal/metarTime.ts` and `internal/notamDateTime.ts`. No public function slices the string itself. None of the grammars is a public pattern: an SSIM or NOTAM value is a date only once its century is known, and a METAR group is a time only once its month is known. Not in `regex/`: WMO gives the METAR group as a symbolic form and ICAO (PANS-AIM Appendix 3) gives the NOTAM group in prose. The public checks are `isValidSsimDate(value, options)`, `isValidMetarTime(value, referenceInstant)` and `isValidNotamValidity(value, options)`, and `regex/` gains nothing.
2. The extracted fields are always handed to Temporal with `{ overflow: "reject" }`: an SSIM date to `Temporal.PlainDate.from(fields, { overflow: "reject" })`, and a NOTAM group or a METAR group to `Temporal.PlainDateTime.from(fields, { overflow: "reject" })`. For a METAR group, the hour and minute go to `Temporal.PlainTime.from` with `"reject"` first, and the month is chosen by epoch-day arithmetic (`internal/epochDay.ts`) over at most two months each way from the reference before the chosen fields go to `PlainDateTime.from`.
3. The try-catch and sentinel-return rules above are unchanged.

**The month letters are a code.** They are fixed English and upper case, never read through `Intl`, and never case-folded. This is an explicit exception to the library's locale-aware formatting.

**The century is the caller's.** `parseSsimDate`, `formatSsimDate`, `parseNotamValidity` and `isValidNotamValidity` take `TwoDigitYearOptions` and return the sentinel without `yearWindow`, under the INT-15 [No century is guessed](#scoped-exception-edi-datetime-grammars-in-the-parseedifact-and-parsex12-functions-int-15) rule. `PERM` is included: without a window it returns `null`, like every other value.

**A METAR time needs a reference.** The group names no month or year, so `parseMetarTime` takes a required reference instant and never reads the clock.

This prohibition stands for every other function in the library.
