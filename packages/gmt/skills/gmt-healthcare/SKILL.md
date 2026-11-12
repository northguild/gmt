---
name: gmt-healthcare
description: >
  HL7 v2 and FHIR R4 date-times in @northguild/gmt/healthcare — parseHL7 reads
  a DTM, or a TS with its degree of precision, as an instant, a local time with
  no offset, a partial value or the null value; formatHL7 writes an ISO 8601
  value as a DTM; isValidHL7 checks one. An HL7 time with no offset is the
  sender's local time, never UTC. parseFHIR, isValidFHIR and formatFHIR read,
  check and write a FHIR date, dateTime or instant, keeping the precision; a
  FHIR time with no zone is invalid. Reads the docs site (llms.txt) and the
  installed package's JSDoc; a routing pointer.
sources:
  - 'northguild/gmt:apps/dox/src/content/docs/guides/industries/healthcare-clinical-timestamps.mdx'
  - 'northguild/gmt:packages/gmt/src/healthcare/index.ts'
  - 'northguild/gmt:packages/gmt/src/types/hl7.ts'
  - 'northguild/gmt:packages/gmt/src/types/fhir.ts'
metadata:
  type: core
  library: '@northguild/gmt'
  library_version: '1.21.0'
---

# GMT Healthcare

Use this skill when the task is reading or writing the date-time of an HL7 v2
message (an `MSH-7`, an `OBX-14`, a `PID-7`) or of a FHIR R4 resource (a
`birthDate`, an `Observation.effectiveDateTime`, an `instant` such as
`Meta.lastUpdated`). Resolving a local time once the
sender's zone is known is in the `gmt-timezone` skill.

## When to load

- The user reads an HL7 v2 `DTM` or `TS` field, or a value such as
  `20240615103000-0500` or `199904011200^L`.
- The user asks why HL7 times are hours off, or whether an HL7 time is UTC.
- The user writes an ISO 8601 value into an HL7 field.
- The user checks that an HL7 time is well formed before storing it.
- The user reads, checks or writes a FHIR `date`, `dateTime` or `instant`, such
  as `2024-06` or `2015-02-07T13:28:17-05:00`.
- The user asks whether a FHIR value with no zone, or a second of `60`, is valid.

## Core rules

1. **No offset means the sender's local time, not UTC.** HL7 2.A.22: "if the
   time zone is not included, the time zone defaults to that of the local time
   zone of the sender". `parseHL7` returns `kind: "local"` for it, with no
   `instant`. Take the instant by supplying the sender's zone to
   `resolveLocal(result.local, zone)`; reading the digits as UTC moves every
   event by the sender's offset.

    ```typescript
    parseHL7("20240615103000-0500"); // { kind: "instant", instant: "2024-06-15T15:30:00Z", offset: "-05:00", local: "2024-06-15T10:30:00", precision: "second" }
    parseHL7("20240615103000"); // { kind: "local", local: "2024-06-15T10:30:00", precision: "second" }
    resolveLocal("2024-06-15T10:30:00", "Europe/Helsinki"); // "2024-06-15T07:30:00Z"
    ```

2. **Four kinds, and the digits sent are the precision.** `"instant"` (an offset
   and a minute or finer), `"local"` (no offset, a minute or finer), `"partial"`
   (a year, month, day or hour: a span, with no instant even when it carries an
   offset) and `"null"` (the HL7 null value `""`, two double quotes, which is not
   the empty string). `precision` says which digits were sent.
3. **A `TS` degree of precision only lowers the precision.** `199904011200^L` is
   April 1999, not 12:00. A degree finer than the digits sent, or not one of
   `Y L D H M S`, returns `null`. `^` separates the components and `&` the
   subcomponents (ch. 2 §2.5.4); a feed whose MSH-2 names others re-joins the
   field first. What is present but not expected is ignored (§2.6.2), so
   `20240615^D^X` reads as `20240615^D` and `2024&X` as `2024`. An empty
   component is not present: `20240615^D^` is `20240615^D`, `'""^'` the null
   value, and `^D` and `&X` return `null`.
4. **`formatHL7` writes a `DTM`, never a `TS`, and never rounds.** It reads the
   precision from the form of the input and `{ precision }` only lowers it; a
   fraction is cut to four digits. An instant with `Z` writes `+0000`. A local
   value writes no offset.
5. **Sentinels, never throws.** `parseHL7` returns `null`, `formatHL7` returns
   `""`, `isValidHL7` returns `false`, for any input of any type. `isValidHL7` is
   `parseHL7(value) !== null`; `'""'` is valid.
6. **Read the docs site.** This skill is a routing pointer. The map of the docs
   is `https://northguild.dev/gmt/llms.txt`, and each page has a `.md` twin that
   holds its text. The JSDoc ships in the installed package:
   `node_modules/@northguild/gmt/dist/**/*.d.ts`.

## FHIR R4: `date`, `dateTime` and `instant`

The rules above are HL7 v2. FHIR R4 (Datatypes §2.24.0.1) is a different
grammar, and it differs from HL7 on the point that matters most.

1. **Three functions, one `type` parameter.** `parseFHIR(value)` reads a value of
   any of the three types. `isValidFHIR(value, type)` and
   `formatFHIR(value, type, { precision })` take `type` as `"date"`,
   `"dateTime"` or `"instant"`. `date` takes a day or coarser, `instant` a second
   or finer, and `dateTime` takes all five precisions.
2. **Precision is kept, never padded.** `parseFHIR("2024-06")` is
   `{ value: "2024-06", precision: "month", offset: "" }`. The five precisions
   are `year`, `month`, `day`, `second` and `fraction`; FHIR has no hour or
   minute. Comparing two partial values is FHIRPath's job, not GMT's.
3. **A time with no zone is invalid.** Unlike HL7, FHIR never leaves a time to the
   sender's local zone: `parseFHIR("2024-06-15T10:30:00")` is `null`, and
   `isValidFHIR(…, "dateTime")` is `false`. There is nothing to resolve, so
   `resolveLocal` is never needed.
4. **A second of `60` is valid only on an inserted leap second.**
   `2016-12-31T23:59:60Z` is valid and `2017-12-31T23:59:60Z` is not, at any
   offset spelling. `formatFHIR` never writes a second of `60`; it returns `""`.
5. **`Z`, `+00:00` and `-00:00` read as one offset.** `parseFHIR` gives
   `offset: "+00:00"` for all three and keeps `value` as sent, so compare
   `offset`, not the strings.
6. **The patterns prove shape only.** `fhirDate`, `fhirDateTime` and `fhirInstant`
   (`@northguild/gmt/regex`) are the R4 regexes. `fhirDateTime` accepts
   `2024-02-30`, `fhirDate` accepts `2023-02-29`, and `fhirInstant` accepts
   `2017-12-31T23:59:60Z` and a ten-digit fraction; `isValidFHIR` refuses all
   of them. A value `isValidFHIR` accepts always matches its pattern.
7. **`formatFHIR` reads the wall clock as written.** It cuts and never rounds.
   Under `date` it gives the date at the input's own offset
   (`2024-06-15T23:30:00-05:00` is `2024-06-15`), and it keeps the designator as
   written. It never zero-fills: an HL7 time at minute precision gives `""`
   under `dateTime` and `instant` until the caller cuts it to a day or adds
   `:00` knowingly. A `Z[zone]` value gives that zone's local date under `date`
   (`2024-06-15T23:30:00Z[Europe/Berlin]` is `2024-06-16`), and an offset that is
   not a whole number of minutes (`+02:00:30`) returns `""`.
8. **Sentinels, never throws.** `parseFHIR` returns `null`, `formatFHIR` returns
   `""`, `isValidFHIR` returns `false`, for any input of any type.

```typescript
parseFHIR("2024-06"); // { value: "2024-06", precision: "month", offset: "" }
parseFHIR("2015-02-07T13:28:17-05:00"); // { value: "2015-02-07T13:28:17-05:00", precision: "second", offset: "-05:00" }
isValidFHIR("2024-06-15T10:30:00", "dateTime"); // false (a time needs a zone)
formatFHIR("2024-06-15T23:30:00-05:00", "date"); // "2024-06-15"
formatFHIR("2024-06-15T10:30:00Z", "dateTime", { precision: "month" }); // "2024-06"
```

## Key functions

- **Read and write**: `parseHL7`, `formatHL7`, `parseFHIR`, `formatFHIR`
- **Check**: `isValidHL7`, `isValidFHIR`
- **Types**: `Hl7DateTime`, `Hl7Precision`, `Hl7PartialPrecision`,
  `Hl7MomentPrecision`, `Hl7FormatOptions`, `FhirDateTime`, `FhirDateType`,
  `FhirPrecision`, `FhirFormatOptions`
- **Patterns**: `fhirDate`, `fhirDateTime`, `fhirInstant`

## References

- [healthcare reference](https://northguild.dev/gmt/reference/healthcare/)
- [Healthcare: Clinical Timestamps guide](https://northguild.dev/gmt/guides/industries/healthcare-clinical-timestamps/)
- [HL7 Timestamp Reader](https://northguild.dev/gmt/tools/hl7-timestamp-reader/)
- [Docs map for agents (llms.txt)](https://northguild.dev/gmt/llms.txt)
- [GMT Timezone skill](../gmt-timezone/SKILL.md)
