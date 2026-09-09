# HLTH-37 — Healthcare: DICOM date and time value representations

**Scope:** The DICOM `DA`, `TM` and `DT` value representations.

## Gap

Medical imaging is a large share of all clinical timestamps, and DICOM uses its own encodings that no general date library parses. `DT` carries an offset suffix in a non-ISO form; `DA` and `TM` carry none at all, and a study's date and time are frequently stored in separate attributes that must be recombined.

## Scope

- `packages/gmt/src/health/parse/dicomDate.ts`:
  - `parseDicomDate(value: string): string | null` — `DA`, format `YYYYMMDD`.
  - `parseDicomTime(value: string): { time: string, precision: string } | null` — `TM`, format `HHMMSS.FFFFFF` with truncation permitted at any component.
  - `parseDicomDateTime(value: string): { local: string, offset?: string } | null` — `DT`, format `YYYYMMDDHHMMSS.FFFFFF&ZZXX`.
- `packages/gmt/src/health/format/dicomDateTime.ts`:
  - `formatDicomDate(isoString: string): string`
  - `formatDicomTime(isoString: string, options?: { precision?: number }): string`
  - `formatDicomDateTime(isoString: string, options?: { includeOffset?: boolean }): string`
- `packages/gmt/src/health/convert/dicomCombine.ts`:
  - `combineDicomDateAndTime(date: string, time: string, options?: { offset?: string }): { local: string, offset?: string } | null` — Recombines separately stored `DA` and `TM` attributes.

## DICOM formats

| VR | Format | Notes |
| --- | --- | --- |
| `DA` | `YYYYMMDD` | Date only, no offset |
| `TM` | `HHMMSS.FFFFFF` | Fraction to six digits (microseconds); truncation permitted at hour, minute or second |
| `DT` | `YYYYMMDDHHMMSS.FFFFFF&ZZXX` | All components after the year optional; `&` is `+` or `-`, `ZZ` hours, `XX` minutes |

The offset suffix uses the same `&ZZXX` encoding as the *Timezone Offset From UTC* attribute.
([DICOM PS3.5 §6.2](https://dicom.nema.org/medical/dicom/current/output/chtml/part05/sect_6.2.html))

## Design notes

- **`&ZZXX` is not ISO 8601.** `+0500` has no colon, and the sign is part of the composite. It must be translated, not passed through.
- **`DA` and `TM` carry no offset**, so recombining them yields a local wall time, not an instant. `combineDicomCombine` returns the offset-absent form for the same reason HLTH-33 does — the scanner's timezone is not in the value.
- **Truncated `TM` is valid**, and precision must be reported so a study time of `10` (10:00, hour precision) is not mistaken for 10 seconds past midnight.
- DICOM permits fractional seconds to six digits. GMT's nanosecond core is finer, so no precision is lost — but formatting must truncate to six digits rather than emitting nine.

## What gmt provides (do not re-implement)

- `toOffsetInstant` / `resolveLocal` from CORE-4 — offset handling and local resolution
- `truncateNanoseconds` from CORE-1 — fractional-second truncation
- `regex/` — pattern matchers

## Verification

- `parseDicomDate('20240615')` returns `'2024-06-15'`
- `parseDicomTime('103000.123456')` preserves microsecond precision
- `parseDicomTime('10')` returns hour precision, not a second count
- `parseDicomDateTime('20240615103000.000000+0500')` returns the local time and a `'+05:00'` offset
- `parseDicomDateTime('20240615')` — a `DT` truncated to a date — parses with no offset
- Round-trip through the format functions for each VR
- `formatDicomTime` truncates to six fractional digits, never nine
- `combineDicomDateAndTime` with no offset returns the offset-absent form
- Malformed offsets and out-of-range components return the sentinel
- `pnpm run validate` stays green
