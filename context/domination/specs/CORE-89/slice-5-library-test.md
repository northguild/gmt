# Slice 5 — `packages/gmt/src/test/oh-morocco.test.ts`

This slice adds one test file beside `oh-canada.test.ts` and copies its shape: the header
comment, the `runtime` and `stale` failure messages, `it.each` tables, and imports from relative
source paths. It changes no library source, so it needs no changeset entry beyond the empty one
in [index](./index.md#scope).

## Header comment

The comment says:

- **What tzdb records.** tzdb 2026c records that `Africa/Casablanca` and `Africa/El_Aaiun` move
  their clocks back at 02:00 local on 2026-09-20, to `+00:00`, and do not change them again.
  2026d and 2026e leave this unchanged.
- **What older data records.** tzdb 2026b and earlier record a change every year around Ramadan.
  The two such changes in 2027, at 2027-02-07T02:00Z and 2027-03-14T02:00Z, no longer happen.
- **What old data gets wrong.** Old data reads `+01:00` for most of the year and `+00:00` inside
  those weeks. So a check made during Ramadan matches either way.
- **What a failure means.** As in `oh-canada.test.ts`, a failing row means the runtime's tz data
  is old. The fix is to update Node or the browser, not the code.
- **Where the expected values come from.** They follow from the rule above and were checked on
  Node 26.12.1 (tz 2026e). The `old` column holds what Node 24.19.0 (tz 2026b) gives.

It names no statute and no government notice.

`stale` reads: "`${runtime}`: if this fails, the runtime's tz data is older than tzdb 2026c. Update it."

## Rows

Every row must fail on tz data older than 2026c. A value that old and new data share, such as one
inside Ramadan or a value just before 2026-09-20T01:00Z, appears only beside a value that does
fail, in the same row. Each table runs for both zones.

| Function | Input | 2026c+ | Old (2026b) |
|---|---|---|---|
| `getTimeZoneOffset` | `2026-09-20T00:59:59Z` / `2026-09-20T01:00:00Z` | `+01:00` / `+00:00` | `+01:00` / `+01:00` |
| `getTimeZoneOffset` | `2026-11-02T12:00:00Z` | `+00:00` | `+01:00` |
| `getTimeZoneOffset` | `2027-02-07T01:59:59Z` / `2027-02-07T02:00:00Z` | `+00:00` / `+00:00` | `+01:00` / `+00:00` |
| `getTimeZoneOffset` | `2027-02-22T12:00:00Z` (Ramadan) / `2027-06-01T12:00:00Z` | `+00:00` / `+00:00` | `+00:00` / `+01:00` |
| `getTimeZoneOffset` | `2027-03-14T01:59:59Z` / `2027-03-14T02:00:00Z` | `+00:00` / `+00:00` | `+00:00` / `+01:00` |
| `getDstTransitions(zone, 2026)` | — | 3 changes, the last at `2026-09-20T01:00:00Z` to `+00:00` | 2 changes |
| `getDstTransitions(zone, 2027)` | — | `[]` | 2 changes |
| `getHoursInZonedDay` | 2026-09-20 / 2027-02-07 / 2027-03-14 | 25 / 24 / 24 | 24 / 25 / 23 |
| `convertPlainDateTimeToZoned` | `2026-09-20T01:30:00`, `later` | `…T01:30:00+00:00[zone]` | `…+01:00[zone]` |
| `convertPlainDateTimeToZoned` | `2027-03-14T02:30:00`, `reject` | `2027-03-14T02:30:00+00:00[zone]` | `""` (gap) |
| `convertPlainDateTimeToZoned` | `2027-02-07T02:30:00`, `earlier` | `…+00:00[zone]` | `…+01:00[zone]` (overlap) |
| `convertUtcToZoned` | `2027-06-01T12:00:00Z` | `2027-06-01T12:00:00+00:00[zone]` | `…T13:00:00+01:00[zone]` |
| `addZoned` | `2026-09-19T12:00:00+01:00[zone]` + 1 day | `2026-09-20T12:00:00+00:00[zone]` | `…+01:00[zone]` |
| `diffZoned` (hours) | 2026-09-19T12:00 to 2026-09-20T12:00 local | 25 | 24 |
| `isInDaylightSaving` | `convertUtcToZoned("2026-11-02T12:00:00Z", zone)` | `false` | `true` |
| `hasDaylightSaving` | `{ at: "2026-11-02T12:00:00Z" }` | `false` | `true` |
| `classifyStoredZoned` | `2026-11-16T09:00:00+01:00[zone]` | `offsetMismatch`, zone offset `+00:00` | `valid` |
| `classifyStoredZoned` | `2027-03-14T02:30:00+00:00[zone]` | `valid` | not `valid` |

- **Check each value before writing it.** Use the function's own JSDoc and a plain run on Node
  26.12.1. Where a row above disagrees with the library, the library's documented rule wins; fix
  the row and say so in the hand-back. `isInDaylightSaving` follows gmt's own pairing rule (see
  its JSDoc), which counts Casablanca's `+01:00` months as daylight time.
- **Inputs are always strings.** Derive a zoned input with a library call, as the
  `isInDaylightSaving` row does. Never hand-type an offset the runtime might not agree with.
- **Use the gmt option names.** The `disambiguation` names must be the ones gmt exports
  (`earlier`, `later`, `reject`). Read `convertPlainDateTimeToZoned`'s signature to confirm them.

## Page link

`MOROCCO_KEY_POINTS`'s `TESTS_HREF` (slice 4) points at this file on `main`.

## Definition of done

1. `pnpm --filter @northguild/gmt exec vitest run src/test/oh-morocco.test.ts --reporter=verbose`
   passes on Node 26.12.1. Do not use `vitest list --json` with a file path.
2. `eval "$(fnm env)" && fnm exec --using=24.21.0 pnpm --filter @northguild/gmt exec vitest run src/test/oh-morocco.test.ts`
   passes. Node 24.21.0 carries tz 2026c, the first release with the change.
3. `fnm exec --using=24.19.0 pnpm --filter @northguild/gmt exec vitest run src/test/oh-morocco.test.ts`
   fails **every** test. Node 24.19.0 carries tz 2026b. The summary line shows `0 passed`.
   Paste that line into the hand-back.
4. `node scripts/test-markers.mjs check` and `node scripts/stats.mjs check` pass. Use
   `/update-readme` to sync the test counts in `README.md` and `packages/gmt/README.md`.
5. `pnpm --filter @northguild/gmt lint` and `typecheck` are clean.
