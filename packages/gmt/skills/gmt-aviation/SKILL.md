---
name: gmt-aviation
description: >
  Aviation schedule dates in @northguild/gmt/aviation — the seven-character
  IATA SSIM date (DDMMMYY, e.g. 01JAN26) read, written and checked:
  parseSsimDate, formatSsimDate and isValidSsimDate. The month is a fixed
  English letter code that never goes through Intl, and the century is the
  caller's through a required yearWindow. Reads the docs site (llms.txt) and
  the installed package's JSDoc; a routing pointer, not an API dump.
sources:
  - 'northguild/gmt:apps/dox/src/content/docs/guides/industries/aviation-message-times.mdx'
  - 'northguild/gmt:packages/gmt/src/aviation/format/index.ts'
  - 'northguild/gmt:packages/gmt/src/aviation/parse/index.ts'
  - 'northguild/gmt:packages/gmt/src/aviation/validate/index.ts'
  - 'northguild/gmt:packages/gmt/src/types/two-digit-year.ts'
metadata:
  type: core
  library: '@northguild/gmt'
  library_version: '1.21.0'
---

# GMT Aviation

Use this skill when the task is reading or writing a date from an IATA SSIM
schedule file, such as `01JAN26` in a validity period or a creation date. The
`yearWindow` option is the same one the EDI parsers take; see the
`gmt-intermodal` skill.

## When to load

- The user has an SSIM date such as `25OCT26` to read, or an ISO date to write
  in that form.
- The user asks whether a value is a valid SSIM date.

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
   exactly when the parser returns a date, and it narrows `unknown` to `string`.
7. **Read the docs site.** This skill is a routing pointer. The map of the
   docs is `https://northguild.dev/gmt/llms.txt`, and each page has a `.md`
   twin that holds its text. The JSDoc ships in the installed package:
   `node_modules/@northguild/gmt/dist/**/*.d.ts`.

## Key functions

- **SSIM dates** (`@northguild/gmt/aviation`): `parseSsimDate`,
  `formatSsimDate`, `isValidSsimDate`

## References

- [aviation reference](https://northguild.dev/gmt/reference/aviation/)
- [Docs map for agents (llms.txt)](https://northguild.dev/gmt/llms.txt)
- [GMT Intermodal skill](../gmt-intermodal/SKILL.md)
