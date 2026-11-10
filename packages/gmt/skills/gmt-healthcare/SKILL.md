---
name: gmt-healthcare
description: >
  HL7 v2 date-times in @northguild/gmt/healthcare — parseHL7 reads a DTM, or a
  TS with its degree of precision, as an instant, a local time with no offset,
  a partial value or the null value; formatHL7 writes an ISO 8601 value as a
  DTM; isValidHL7 checks one. An HL7 time with no offset is the sender's local
  time, never UTC. Reads the docs site (llms.txt) and the installed package's
  JSDoc; a routing pointer.
sources:
  - 'northguild/gmt:apps/dox/src/content/docs/guides/industries/healthcare-clinical-timestamps.mdx'
  - 'northguild/gmt:packages/gmt/src/healthcare/index.ts'
  - 'northguild/gmt:packages/gmt/src/types/hl7.ts'
metadata:
  type: core
  library: '@northguild/gmt'
  library_version: '1.21.0'
---

# GMT Healthcare

Use this skill when the task is reading or writing the date-time of an HL7 v2
message: an `MSH-7`, an `OBX-14`, a `PID-7`. Resolving a local time once the
sender's zone is known is in the `gmt-timezone` skill.

## When to load

- The user reads an HL7 v2 `DTM` or `TS` field, or a value such as
  `20240615103000-0500` or `199904011200^L`.
- The user asks why HL7 times are hours off, or whether an HL7 time is UTC.
- The user writes an ISO 8601 value into an HL7 field.
- The user checks that an HL7 time is well formed before storing it.

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
   `Y L D H M S`, returns `null`. Only `^` separates a `TS`.
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

## Key functions

- **Read and write**: `parseHL7`, `formatHL7`
- **Check**: `isValidHL7`
- **Types**: `Hl7DateTime`, `Hl7Precision`, `Hl7FormatOptions`

## References

- [healthcare reference](https://northguild.dev/gmt/reference/healthcare/)
- [Healthcare: Clinical Timestamps guide](https://northguild.dev/gmt/guides/industries/healthcare-clinical-timestamps/)
- [HL7 Timestamp Reader](https://northguild.dev/gmt/tools/hl7-timestamp-reader/)
- [Docs map for agents (llms.txt)](https://northguild.dev/gmt/llms.txt)
- [GMT Timezone skill](../gmt-timezone/SKILL.md)
