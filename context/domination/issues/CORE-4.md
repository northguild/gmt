# CORE-4 — Core: Offset-preserving instants and local-time resolution

**Scope:** The instant-plus-original-offset pair that every logistics, clinical and event-sourcing standard stores, and the explicit resolution of local wall times that carry no zone.

## Gap

GMT can represent an instant and it can represent a zoned datetime, but it has no primitive for the shape the world actually exchanges: an absolute instant **plus** the local UTC offset that was in force where the event happened. Neither field derives from the other, and both are load-bearing — the instant orders events globally, the offset renders them as the human on the ground saw them.

Separately, feeds routinely deliver a local wall time with no offset at all ("gate-out 08:00"), and resolving one requires a zone the sender did not send, plus a policy for wall times that are ambiguous or do not exist.

## Scope

- `packages/gmt/src/instant/convert/toOffsetInstant.ts`:
  - `toOffsetInstant(isoString: string, timeZone?: string): { instant: string, offset: string, timeZone?: string } | null` — Splits a zoned string into the two-field pair. `offset` is `±HH:MM`.
  - `fromOffsetInstant(value: { instant: string, offset: string }): string` — Renders the pair back to a local-time string with its original offset.
- `packages/gmt/src/instant/convert/resolveLocal.ts`:
  - `resolveLocal(localDateTime: string, timeZone: string, options?: { disambiguation?: 'compatible' | 'earlier' | 'later' | 'reject' }): string` — Resolves a zoneless wall time against a zone. Defaults to `'compatible'`, matching Temporal.
  - `classifyLocal(localDateTime: string, timeZone: string): 'unique' | 'ambiguous' | 'nonexistent' | null` — Reports which case a wall time falls into **before** resolving it, so callers can branch rather than silently accept a policy.

## Why two fields

| Standard | Instant field | Offset field |
| --- | --- | --- |
| GS1 EPCIS 2.0 | `eventTime` (UTC) | `eventTimeZoneOffset` — required, so the event can be shown in the local time where it occurred |
| DCSA Track & Trace | `eventDateTime` | Carried in the timestamp, alongside an `eventClassifierCode` of planned / estimated / actual |
| UN/EDIFACT DTM | Qualifier `102` / `203` (no offset) | Qualifier `303` / `304` (`CCYYMMDDHHMMZZZ` / `CCYYMMDDHHMMSSZZZ`) |
| DICOM | `DT` value | `&ZZXX` suffix |

Sources: [OpenEPCIS](https://openepcis.io/docs/epcis/), [UNECE DTM](https://service.unece.org/trade/untdid/d03a/trsd/trsddtm.htm), [DCSA](https://dcsa.org/standards/track-and-trace/standard-documentation-track-and-trace).

## Design notes

- **An offset is not a zone.** `-05:00` does not identify `America/New_York`. Store the zone for anything scheduled in the future; store the offset for anything that already happened. The pair carries both when both are known, and `timeZone` stays optional because most feeds do not send it.
- **Ambiguous and nonexistent wall times are the single most common datetime bug.** 01:30 occurs twice on a fall-back day and never on a spring-forward day. `classifyLocal` exists so realm code can refuse rather than guess — a demurrage clock or a medication window should not silently pick the earlier instant.
- Every realm function that accepts a local wall time routes through `resolveLocal` and states its disambiguation policy in JSDoc. This is a binding rule in the tracker's Definition of Done.

## What gmt provides (do not re-implement)

- `Temporal.ZonedDateTime.from` with its `disambiguation` option — the underlying behaviour
- `getZonedDateTimeFields` — offset extraction
- `isValidTimeZone` — zone validation

## Verification

- `toOffsetInstant` round-trips through `fromOffsetInstant` for zones with and without DST
- Offset is preserved across a DST boundary: two events an hour apart in `America/New_York` on a fall-back night yield different offsets for the same wall time
- `classifyLocal('2024-11-03T01:30:00', 'America/New_York')` returns `'ambiguous'`
- `classifyLocal('2024-03-10T02:30:00', 'America/New_York')` returns `'nonexistent'`
- `resolveLocal` with `'earlier'` and `'later'` returns instants one hour apart for the ambiguous case
- `resolveLocal` with `'reject'` returns the sentinel rather than throwing
- Full IANA timezone coverage
- `pnpm run validate` stays green
