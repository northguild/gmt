# INT-15 — Intermodal: EDI and event-standard timestamp interop

**Scope:** Read and write the timestamp formats the logistics industry actually exchanges — EDIFACT, X12, EPCIS.

## Gap

GMT can parse ISO 8601. The freight industry mostly does not send ISO 8601. It sends EDIFACT `DTM` segments, X12 date/time elements, EPCIS events and DCSA payloads — and the recurring defect across all of them is that some formats carry a UTC offset and some do not, with no in-band signal beyond a format qualifier.

X12 is the other half of the problem and the first draft left it out entirely, on the grounds that trading-partner maps vary. The partner maps do vary; the two data elements underneath them do not. Data element **1250** (Date Time Period Format Qualifier) and data element **623** (Time Code) are fixed enumerations published by X12, used identically in a 214 motor-carrier status, a 315 ocean status, a 404 rail bill of lading and a healthcare 837 claim. Parsing them is standards work, not partner work.

## Scope

- `packages/gmt/src/intermodal/parse/parseEdifactDtm.ts`:
  - `parseEdifactDtm(value: string, formatQualifier: string): { instant?: string, local?: string, offset?: string, periodEnd?: { instant?: string, local?: string } } | null` — Parses a DTM date/time value against its data element 2379 format code. Returns `local` without `instant` when the code carries no offset, so the caller must supply a zone rather than receive a guess. Period codes return `periodEnd`.
  - `formatEdifactDtm(isoString: string, formatQualifier: string): string` — Inverse.
- `packages/gmt/src/intermodal/parse/parseX12DateTime.ts`:
  - `parseX12DateTime(value: string, formatQualifier: string): { instant?: string, local?: string, date?: string, time?: string, periodEnd?: string } | null` — Data element 1250 formats.
  - `formatX12DateTime(isoString: string, formatQualifier: string): string`
  - `x12TimeCode(timeCode: string): { offset: string } | { zone: string, daylight: boolean | null } | null` — Data element 623. The ISO-style codes carry their offset in X12's own text and return `{ offset }`: `01`–`12` are "Equivalent to ISO P01" … `P12` (UTC+1 … UTC+12), `13`–`24` are `M12` … `M01` in **descending** order (13 = UTC−12, 24 = UTC−1), `25`–`29` are the half-hour offsets M2:30, M3:30, P5:30, P9:30, P10:30, and `GM`/`UT` are UTC. The named standard/daylight codes (`AD`/`AS` Alaska, `CD`/`CS` Central, `ED`/`ES` Eastern, `HD`/`HS` Hawaii-Aleutian, `MD`/`MS` Mountain, `ND`/`NS` Newfoundland, `PD`/`PS` Pacific, `TD`/`TS` Atlantic) name a zone whose offset X12 does **not** state; the function returns `{ zone, daylight }` with X12's zone name and a daylight flag and no offset, and the caller resolves the name against an IANA zone. Generic codes (`AT`, `CT`, `ET`, `HT`, `MT`, `NT`, `PT`, `TT`, `LT`) say neither standard nor daylight and return `{ zone, daylight: null }`, so the caller resolves against a date as well as a zone.
- `packages/gmt/src/intermodal/parse/parseEpcisEvent.ts`:
  - `parseEpcisEvent(event: { eventTime: string, eventTimeZoneOffset: string }): { instant: string, offset: string, local: string } | null`
  - `formatEpcisEvent(value: { instant: string, offset: string }): { eventTime: string, eventTimeZoneOffset: string }`

## EDIFACT DTM format codes (data element 2379)

| Code | Format | Offset |
| --- | --- | --- |
| `101` | `YYMMDD` | none |
| `102` | `CCYYMMDD` | none |
| `201` | `YYMMDDHHMM` | none |
| `203` | `CCYYMMDDHHMM` | none |
| `204` | `CCYYMMDDHHMMSS` | none |
| `301` | `YYMMDDHHMMZZZ` | yes |
| `303` | `CCYYMMDDHHMMZZZ` | yes |
| `304` | `CCYYMMDDHHMMSSZZZ` | yes |
| `718` | `CCYYMMDD-CCYYMMDD` | none; a period |
| `719` | `CCYYMMDDHHMM-CCYYMMDDHHMM` | none; a period |

`102`, `203`, `204`, `303`, `304`, `718` and `719` are what IFTSTA, IFTMIN, COPARN and BAPLIE messages carry in practice; `406` (`ZHHMM`, "Offset from Coordinated Universal Time (UTC) where Z is plus (+) or minus (-)") is the offset-only code the `ZZZ` field of `301`–`304` follows. ([UNECE UNTDID D.03A, data element 2379](https://service.unece.org/trade/untdid/d03a/tred/tred2379.htm); the UNECE host refused requests from this environment and the codes were confirmed against the [StylusStudio mirror of D03A](https://www.stylusstudio.com/edifact/D03A/2379.htm))

## X12 date/time formats (data element 1250, selection)

| Code | Format |
| --- | --- |
| `D8` | `CCYYMMDD` |
| `D6` | `YYMMDD` |
| `DT` | `CCYYMMDDHHMM` |
| `RTS` | `CCYYMMDDHHMMSS` — a single date-time despite the `R` |
| `TM` | `HHMM` |
| `TS` | `HHMMSS` |
| `RTM` | `HHMM-HHMM` |
| `RD8` | `CCYYMMDD-CCYYMMDD` |
| `RD6` | `YYMMDD-YYMMDD` |
| `RDT` | `CCYYMMDDHHMM-CCYYMMDDHHMM` |
| `DTS` | `CCYYMMDDHHMMSS-CCYYMMDDHHMMSS` |
| `TC` | `DDD` — Julian day of year |
| `TU` | `YYDDD` |
| `UN` | Unstructured — returned as the sentinel, never guessed |

`DTM` is a segment name, not a 1250 code; the previous revision of this table listed it as one. X12 `G62`, `DTM` and `DTP` segments pair a date element with a time element and, in `G62`/`DTM`, a data element 623 time code. ([X12 DE 1250, release 005010](https://www.stedi.com/edi/x12-005010/element/1250), [X12 DE 623](https://www.stedi.com/edi/x12/element/623) — Stedi's X12-licensed dictionary; the X12 standard itself is the authority and is to be cited at implementation.)

## Design notes

- **A qualifier without an offset must not silently become UTC.** `203` means local time at an unstated place. Returning `local` without `instant` forces the caller to supply the zone, which is the only correct resolution. This is the single most common EDI timestamp bug.
- **A named X12 time code is a zone name, not an offset.** `ES` names a zone and says standard time; X12 states no offset, and the legal offset of a named zone is a jurisdiction's fact GMT does not carry. Returning the name and the daylight flag is all the standard supports; mapping the name to an IANA zone is the caller's, and would otherwise be a place-registry assertion. `ET` says neither standard nor daylight, so it returns `daylight: null` and the caller resolves against a date as well as a zone.
- **EPCIS requires both fields.** `eventTime` is UTC and `eventTimeZoneOffset` is the offset in force where the event happened, precisely so the event can be displayed in local time. Neither derives from the other, which is why CORE-4 exists.
  ([OpenEPCIS](https://openepcis.io/docs/epcis/))
- **Partner maps are still not bundled.** Which qualifier a given 214 or 315 uses in which segment is implementation-guide data. This story parses the values those guides name; it does not know which segment holds the estimated arrival.
- **Healthcare X12 uses the same elements.** 837 and 834 `DTP` segments carry `D8` and `RD8`; HLTH consumers import this parser rather than duplicating it, and its location under `intermodal/` reflects where the EDI expertise lives, not where it is used.
- DCSA carries `eventDateTime` with an `eventClassifierCode` marking a value planned, estimated or actual. That vocabulary is TRAN-57's; this story parses timestamps and does not interpret classifiers.

## Corrections

- Named X12 623 codes returned a statute's offset, tagged with a `source` marker saying the offset came from a zone's legal definition, with that statute and a second jurisdiction's definitions cited for implementation; they now return `{ zone, daylight }` and no offset, and the function is `x12TimeCode`. Generic codes returned two candidate offsets derived from the same statute; they return `daylight: null` instead.

## What gmt provides (do not re-implement)

- `toOffsetInstant` / `fromOffsetInstant` from CORE-4 — the instant-plus-offset pair
- `resolveLocal` from CORE-4 — resolving an offsetless local time once the caller supplies a zone
- `regex/` — existing ISO 8601 pattern matchers

## Verification

- `parseEdifactDtm('202406151430', '203')` returns `local` with no `instant`
- `parseEdifactDtm('20240615143000+0200', '304')` returns both `instant` and `offset`
- `parseEdifactDtm('20240615-20240620', '718')` returns a `local` start and a `periodEnd`
- `parseEdifactDtm('240615', '101')` applies the documented century pivot and says so in JSDoc
- Round-trip through `formatEdifactDtm` for every supported code
- An unknown format code returns the sentinel rather than guessing a format
- `parseX12DateTime('20240615', 'D8')` returns a `date`; `'20240615-20240620'` with `'RD8'` returns a period
- `x12TimeCode('ES')` returns `{ zone: 'Eastern', daylight: false }` and no offset; `'ED'` returns `daylight: true`; `'ET'` returns `daylight: null`; `'UT'` and `'GM'` return `{ offset: '+00:00' }`; `'01'` returns `+01:00`, `'13'` returns `-12:00` and `'24'` returns `-01:00` (the descending run, asserted); `'27'` returns `+05:30`; an unknown code returns the sentinel
- `parseX12DateTime('20240615143000', 'RTS')` returns one local date-time, not a range; `'166'` with `'TC'` returns day 166 as an ordinal needing a year; `'UN'` returns the sentinel
- `parseEpcisEvent` preserves the original offset through a round-trip, including a negative offset
- An EPCIS event missing `eventTimeZoneOffset` returns the sentinel
- `pnpm run validate` stays green
