---
name: gmt-aviation
description: >
  Aviation message times in @northguild/gmt/aviation — the IATA SSIM date
  (DDMMMYY, e.g. 01JAN26): parseSsimDate, formatSsimDate, isValidSsimDate;
  the METAR report-time group (YYGGggZ, e.g. 251200Z): parseMetarTime and
  isValidMetarTime; and NOTAM item B) and C) validity (YYMMDDHHMM, EST, PERM):
  parseNotamValidity and isValidNotamValidity. The SSIM month is a fixed
  English letter code that never goes through Intl, the century is the
  caller's through a required yearWindow, and a METAR time needs a reference
  instant. Reads the docs site (llms.txt) and the installed package's JSDoc;
  a routing pointer, not an API dump.
sources:
  - 'northguild/gmt:apps/dox/src/content/docs/guides/industries/aviation-message-times.mdx'
  - 'northguild/gmt:packages/gmt/src/aviation/format/index.ts'
  - 'northguild/gmt:packages/gmt/src/aviation/parse/index.ts'
  - 'northguild/gmt:packages/gmt/src/aviation/validate/index.ts'
  - 'northguild/gmt:packages/gmt/src/types/notam.ts'
  - 'northguild/gmt:packages/gmt/src/types/two-digit-year.ts'
metadata:
  type: core
  library: '@northguild/gmt'
  library_version: '1.21.0'
---

# GMT Aviation

Use this skill when the task is reading or writing a date from an IATA SSIM
schedule file, such as `01JAN26` in a validity period, reading the time group
of a METAR, SPECI or TAF (`251200Z`), or reading the validity of a NOTAM
(`1407031230EST`, `PERM`). The `yearWindow` option is the same one the EDI
parsers take; see the `gmt-intermodal` skill.

## When to load

- The user has an SSIM date such as `25OCT26` to read, or an ISO date to write
  in that form.
- The user asks whether a value is a valid SSIM date.
- The user has a METAR time group such as `302350Z` and needs the instant.
- The user has a NOTAM item B) or C) value and needs the instant, or needs to
  know the NOTAM is permanent or estimated.

## Core rules

1. **An SSIM date is not a date pattern.** It is `DDMMMYY`: two digits of day,
   three upper-case letters of month, two digits of year. Do not read it with
   `parseDateWithPattern` and `ddMMMyy`: that reads month names from the
   platform's CLDR data and accepts `01jan26`. Use the three functions.
2. **The month letters are a fixed English code.** `JAN` to `DEC`, upper case
   only, read from a constant table and never through `Intl`, so the machine's
   language changes nothing. `01jan26`, `01Jan26`, `01ENE26` and `01JANV26`
   return `""`.
3. **The century is the caller's, and there is no default.** `yearWindow` is
   required: a fixed first year (`2000`) for stored schedules, or `"rolling"`
   for live feeds. It places the two-digit year in a hundred-year window.
   ```typescript
   parseSsimDate("01JAN26", { yearWindow: 2000 }); // "2026-01-01"
   parseSsimDate("16DEC09", { yearWindow: 1950 }); // "2009-12-16"
   parseSsimDate("29FEB00", { yearWindow: 2000 }); // "2000-02-29"
   parseSsimDate("29FEB00", { yearWindow: 1900 }); // ""
   ```
4. **Sentinels, never exceptions.** Without `yearWindow` (or with an options
   argument that is not an object) the parser and the formatter return `""` and
   the validator returns `false`. So do a day that does not exist (`31FEB26`),
   non-ASCII digits and extra characters. No function throws.
5. **The formatter refuses a year outside the window.** It would read back as
   another century, so `formatSsimDate` returns `""` for it. It takes an ISO
   calendar date; a date-time, an instant or another calendar returns `""`.
   ```typescript
   formatSsimDate("2026-10-25", { yearWindow: 2000 }); // "25OCT26"
   formatSsimDate("1999-12-31", { yearWindow: 2000 }); // ""
   ```
6. **Validate before you trust.** `isValidSsimDate(value, options)` is `true`
   exactly when the parser returns a date.
7. **A METAR time needs the receipt time as its reference.** `YYGGggZ` names
   no month or year, so `parseMetarTime(value, referenceInstant)` takes the
   time the report was received, or the archive's timestamp, and never reads
   "now". It returns the nearest candidate in exact time, skipping a month that
   lacks the day. Without a valid reference it returns `""`.
   ```typescript
   parseMetarTime("302350Z", "2024-07-01T00:05:00Z"); // "2024-06-30T23:50:00Z"
   parseMetarTime("312350Z", "2024-07-01T00:05:00Z"); // "2024-05-31T23:50:00Z"
   parseMetarTime("251200Z", "2024-06-25T12:20:00"); // "" (no offset)
   ```
8. **`PERM` is `{ kind: "permanent" }`, never a far-future date.** A NOTAM
   validity is `{ kind: "instant", instant, estimated }` or
   `{ kind: "permanent" }`. A permanent NOTAM has no end to compare against,
   so do not turn it into `9999-12-31`.
   ```typescript
   parseNotamValidity("PERM", { yearWindow: 2000 }); // { kind: "permanent" }
   parseNotamValidity("2506151200", { yearWindow: 2000 });
   // { kind: "instant", instant: "2025-06-15T12:00:00Z", estimated: false }
   ```
9. **`EST` is `estimated: true`; keep it.** The instant is still the stated one.
   The flag says the end is an estimate that a later NOTAM replaces or
   cancels. Do not drop it.
   ```typescript
   parseNotamValidity("1407031230EST", { yearWindow: 2000 });
   // { kind: "instant", instant: "2014-07-03T12:30:00Z", estimated: true }
   ```
10. **Nothing in a NOTAM is corrected.** `2400`, `WIE`, `UFN`, a space before
    `EST` and lower case return `null`. `PERM` without a `yearWindow` returns
    `null` too. `isValidNotamValidity` is `true` exactly when the parser
    returns a validity; `isValidMetarTime` is `true` exactly when
    `parseMetarTime` returns an instant.
11. **Read the docs site.** This skill is a routing pointer. The map of the
    docs is `https://northguild.dev/gmt/llms.txt`, and each page has a `.md`
    twin that holds its text. The JSDoc ships in the installed package:
    `node_modules/@northguild/gmt/dist/**/*.d.ts`.

## Key functions

- **SSIM dates** (`@northguild/gmt/aviation`): `parseSsimDate`,
  `formatSsimDate`, `isValidSsimDate`
- **METAR report times**: `parseMetarTime` reads `YYGGggZ` against a reference
  instant; `isValidMetarTime` checks it
- **NOTAM validity**: `parseNotamValidity` reads item B) or C) as an instant,
  an estimate or `PERM`; `isValidNotamValidity` checks it

## References

- [aviation reference](https://northguild.dev/gmt/reference/aviation/)
- [Docs map for agents (llms.txt)](https://northguild.dev/gmt/llms.txt)
- [GMT Intermodal skill](../gmt-intermodal/SKILL.md)
