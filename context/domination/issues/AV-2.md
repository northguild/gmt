# AV-2 — Aviation: Airline timing — `blockTime` + `scheduledTime` + `notamTimestamp`

**Scope:** Airline-specific timestamp types and NOTAM handling.

## Gap

Aviation has its own timestamp vocabulary: block time (chocks-off to chocks-on), scheduled time (timetable), and NOTAM (Notice to Air Missions) timestamps with specific formats.

## Scope

- `packages/gmt/src/aviation/timing.ts`:
  - `blockTime(offBlocks: string, onBlocks: string): string` — Computes block time (flight time from chocks-off to chocks-on). Returns ISO duration.
  - `scheduledTime(isoString: string, airport: string): string` — Converts a scheduled UTC time to the airport's local time for passenger display.
  - `notamTimestamp(notamString: string): string` — Parses a NOTAM timestamp string (format: `DDHHMM` or ISO) → ISO 8601 UTC string.

## NOTAM timestamp format

NOTAMs use compact date/time formats:
- `DDHHMM` — Day, hour, minute in UTC (e.g., `251200` = 25th day, 12:00 UTC)
- Sometimes with month/year from NOTAM header
- Valid period: `B)` (begin) and `C)` (end) fields

## What gmt provides (do not re-implement)

- `spanMs` / `spanNs` from CORE-2 — duration calculation
- `convertUtcToZoned` — timezone conversion for airport local time

## Verification

- `blockTime` returns correct ISO duration
- `scheduledTime` converts to airport local time correctly
- `notamTimestamp` parses `DDHHMM` format correctly
- Invalid NOTAM format returns `""` sentinel
- `pnpm run validate` stays green
