# INT-15 — Intermodal: EDI and event-standard timestamp interop

**Scope:** Read and write the timestamp formats the logistics industry actually exchanges.

## Gap

GMT can parse ISO 8601. The freight industry mostly does not send ISO 8601. It sends EDIFACT `DTM` segments, X12 date/time elements, EPCIS events and DCSA payloads — and the recurring defect across all of them is that some formats carry a UTC offset and some do not, with no in-band signal beyond a format qualifier.

## Scope

- `packages/gmt/src/intermodal/parse/parseEdifactDtm.ts`:
  - `parseEdifactDtm(value: string, formatQualifier: string): { instant?: string, local?: string, offset?: string } | null` — Parses a DTM date/time value against its format qualifier. Returns `local` without `instant` when the qualifier carries no offset, so the caller must supply a zone rather than receive a guess.
  - `formatEdifactDtm(isoString: string, formatQualifier: string): string` — Inverse.
- `packages/gmt/src/intermodal/parse/parseEpcisEvent.ts`:
  - `parseEpcisEvent(event: { eventTime: string, eventTimeZoneOffset: string }): { instant: string, offset: string, local: string } | null`
  - `formatEpcisEvent(value: { instant: string, offset: string }): { eventTime: string, eventTimeZoneOffset: string }`

## EDIFACT DTM format qualifiers

Data element 2379 selects the format of the value in composite C507.

| Qualifier | Format | Offset |
| --- | --- | --- |
| `102` | `CCYYMMDD` | none |
| `203` | `CCYYMMDDHHMM` | none |
| `303` | `CCYYMMDDHHMMZZZ` | yes |
| `304` | `CCYYMMDDHHMMSSZZZ` | yes |

([UNECE D.03A DTM](https://service.unece.org/trade/untdid/d03a/trsd/trsddtm.htm))

## Design notes

- **A qualifier without an offset must not silently become UTC.** `203` means local time at an unstated place. Returning `local` without `instant` forces the caller to supply the zone, which is the only correct resolution. This is the single most common EDI timestamp bug.
- **EPCIS requires both fields.** `eventTime` is UTC and `eventTimeZoneOffset` is the offset in force where the event happened, precisely so the event can be displayed in local time. Neither derives from the other, which is why CORE-4 exists.
  ([OpenEPCIS](https://openepcis.io/docs/epcis/))
- **X12 and DCSA are deliberately not hardcoded.** X12 214 carries status events in `AT7` segments, and DCSA carries `eventDateTime` with an `eventClassifierCode` marking a value planned, estimated or actual. Both are versioned, and trading partners vary within a version, so element-level qualifier maps belong in the consumer's implementation guide rather than bundled in GMT. This story provides the datetime primitives those parsers compose; it does not ship a partner map.
- `eventClassifierCode` is a reminder that one timestamp field carries three different meanings. Consumers must not compare a planned time to an actual time as though both were observations.

## What gmt provides (do not re-implement)

- `toOffsetInstant` / `fromOffsetInstant` from CORE-4 — the instant-plus-offset pair
- `resolveLocal` from CORE-4 — resolving an offsetless local time once the caller supplies a zone
- `regex/` — existing ISO 8601 pattern matchers

## Verification

- `parseEdifactDtm('202406151430', '203')` returns `local` with no `instant`
- `parseEdifactDtm('20240615143000+0200', '304')` returns both `instant` and `offset`
- Round-trip through `formatEdifactDtm` for every supported qualifier
- An unknown format qualifier returns the sentinel rather than guessing a format
- `parseEpcisEvent` preserves the original offset through a round-trip, including a negative offset
- An EPCIS event missing `eventTimeZoneOffset` returns the sentinel
- `pnpm run validate` stays green
