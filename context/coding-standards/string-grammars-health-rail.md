# Coding Standards: Scoped Exceptions for Health and Rail Grammars

Each entry extends the three rules of [the `parse*WithPattern` exception](./string-grammars.md#scoped-exception-manual-string-parsing-in-parsewithpattern-j11--decision-4).

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

### Scoped exception: GTFS Time in `rail/` (RAI-99)

Rules 1 and 3 extend to `parseGtfsTime`, `formatGtfsTime` and `isValidGtfsTime` in `packages/gmt/src/rail/`; rule 2 is replaced. A GTFS Schedule `Time` (`25:35:00`) is not ISO 8601: its hour runs past 23 to name a time after midnight on the same service day. The grammar is fixed, never caller-supplied:

1. One regex, in `internal/gtfsTime.ts`, with a field reader, a reader (`readGtfsTime`, which `parseGtfsTime` and `isValidGtfsTime` both call) and a writer (`writeGtfsTime`, which `formatGtfsTime` calls after reading the record's fields). No public function slices the string itself. Not in `regex/`: GTFS states the format in prose (Reference § Field Types, Time) and publishes no pattern. The public check is `isValidGtfsTime`, and `regex/` gains nothing.
2. **No Temporal call, and this is the difference.** A GTFS time names no date, and its hour is allowed past 23, so no time-of-day type holds it: `PlainTime` caps the hour at 23, refusing `25:35:00` as a string or with `"reject"`, and clamping it to `23:35:00` under the default `"constrain"`. There is nothing for Temporal to check that the regex and integer comparisons do not. The regex limits the hour to one to three digits (0–999); the parser compares minutes and seconds against 0–59; the writer checks `seconds` 0–86399, `dayOverflow` a non-negative integer, and the hour it writes at most 999. Turning a GTFS time into an instant is `gtfsToInstant`'s (RAI-100), which does call Temporal, with `"reject"`: the service date's shape is checked by the anchored regex in `internal/gtfsServiceDate.ts` (it checks shape only and slices nothing, so it is not manual parsing and needs no new scoped exception) and the date is then parsed by `Temporal.PlainDate.from`, noon is resolved by `resolveLocalInstant` with `"reject"`, and the time is added as exact seconds with `Instant.prototype.add`.
3. The try-catch and sentinel-return rules above are unchanged. `formatGtfsTime` reads a caller's record and so keeps its try-catch; the parser and the validator make no call that can throw.

**Nothing is trimmed.** GTFS § File Requirements asks producers to remove extra spaces and forbids tabs and line breaks in a value; a value that still carries them returns the sentinel, and the caller's CSV reader removes them.

This prohibition stands for every other function in the library.
