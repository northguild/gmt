# Slice 2 — the Morocco Worker endpoint

`GET | HEAD | POST /gmt/api/morocco-clock-change`, computed per request on workerd from its own
tz data. It is built on `handleClockChangeCheck` from slice 1, so methods, caps, order of checks,
`no-store`, 405 and 429 behave exactly as Canada's do
([CORE-88 decisions](../../issues/CORE-88.md#decisions)).

## Files

- `apps/dox/src/lib/morocco-clock-change.ts` (pure; page, Worker and tests import it; slice 3
  already made it with `MOROCCO_ZONES`, `MOROCCO_RELEASE`, `MOROCCO_STOPPED` and
  `MOROCCO_KIND_LABELS`, so extend it and keep those):
  ```ts
  export const MOROCCO_ZONES = ["Africa/Casablanca", "Africa/El_Aaiun"] as const;
  export const MOROCCO_PROBE: readonly ProbeInstant[] = [
    { iso: "2026-11-02T12:00:00Z", epochMs: 1793620800000, role: "verdict" }, // = Canada's PROBE_INSTANT
    { iso: "2027-02-22T12:00:00Z", epochMs: 1803297600000, role: "blind" },
  ];
  export const MOROCCO_EXPECTED = "+00:00";   // tzdb 2026c and later, at both instants
  export const MOROCCO_RELEASE = "2026c";
  export const MOROCCO_CHANGES: readonly StatedChange[] = [
    { at: "2026-09-20T01:00:00Z", from: "+01:00", to: "+00:00", recordedBy: "2026c" },
    { at: "2027-02-07T02:00:00Z", from: "+01:00", to: "+00:00", recordedBy: "2026b" },
    { at: "2027-03-14T02:00:00Z", from: "+00:00", to: "+01:00", recordedBy: "2026b" },
  ];
  export const MOROCCO_STORED_ZONES = MOROCCO_ZONES;  // the picker; see below
  export const MOROCCO_RATE_LIMIT = { max: 20, windowSeconds: 60 } as const;
  export type { MoroccoCheck, StatedChange };          // shapes in index.md § Signatures
  ```
  Check `epochMs` with `Date.parse` in a test, not by eye. A `recordedBy: "2026b"` row is a
  change that 2026c removed. A `recordedBy: "2026c"` row is one that 2026c added. Each entry
  carries a comment naming its `africa` line in that release.
- `apps/dox/worker/morocco-clock-change.ts`:
  - `computeMoroccoCheck(now)` builds `probe` (2 zones × 2 instants, `getTimeZoneOffset`),
    `changes` (each stated change × zone, `present` = some `transitionsFor(zone, year)` entry has
    the same instant), `transitions` (2026 and 2027 for the two Moroccan zones) and `zones`, one
    shared `mapZone(zone, now)` row per id in `morocco-region-zones.json` (from slice 3).
  - The fixed tables are built once per isolate, as Canada's are. Only `zones` depends on `now`.
  - `handleMoroccoClockChange(request, _env, now = getUtcNow)` calls `handleClockChangeCheck`
    with prefix `"morocco"`, `MOROCCO_RATE_LIMIT`, `MOROCCO_STORED_ZONES` and `computeMoroccoCheck`.
  - Imports only module barrels: `@northguild/gmt/zoned/get`, `zoned/classify` (through the
    shared module) and `utc/*`. No namespace barrel.
- `apps/dox/worker/index.ts`: route `path === "/api/morocco-clock-change"` next to Canada's.
- `apps/dox/src/lib/dev-worker-proxy.test.ts`: add the path to the proxy pattern case.

## Saved-events picker

The picker offers `Africa/Casablanca` and `Africa/El_Aaiun` only, so the POST zone allowlist is
those two. It has no contrast zone. Canada picks Toronto because Canadian readers paste Toronto
lines. The neighbours' zones are on the map, not in the picker. The preset (slice 4) shows the kinds
that never change through lines that carry their own zone (`[Europe/Lisbon]`), and those are
classified as written whatever the picker holds.

## Tests — `worker/morocco-clock-change.test.ts`

The rule from CORE-88 applies: compare the Worker with the library in the test runtime, and never
assert an offset newer than the test runtime's data. Mirror `canada-clock-change.test.ts`:

- GET: 200, `cache-control: no-store`, `content-type` JSON. The body's `probe` has 4 rows, and
  each `offset` equals `getTimeZoneOffset(zone, instant)` in the test. `changes` has 6 rows, and
  each `present` equals whether the test's `getDstTransitions(zone, year)` holds that instant.
  `zones` has one row per id in `morocco-region-zones.json`. Each `kind` is computed in the test
  from `getDstTransitions` for 2026 and 2027, never typed.
- HEAD: same status and headers, `null` body. It shares the GET bucket: 20 calls from one client
  id, then the 21st GET is 429 with `retry-after`, and the bucket key starts `morocco:`. A
  Canada call does not spend the Morocco bucket (one Canada GET and then 20 Morocco GETs all
  answer 200).
- PUT: 405, `allow: GET, HEAD, POST`.
- POST: each of these is checked in this order:
  - a body over 65,536 bytes, streamed with no `content-length`, is 413;
  - a 429 follows once the bucket is spent;
  - `zone=America/Toronto` is 400;
  - a body that is not a form is 400;
  - 51 lines give 50 rows with `truncated: true`;
  - a line `2026-11-16T09:00:00+01:00 Africa/Casablanca` is completed to
    `…[Africa/Casablanca]`, and its `kind` equals the test's `classifyStoredZoned`;
  - a bare line takes the picked zone.
- A `File` in the `lines` field counts as `""`, with no coercion.

## Definition of done

1. `pnpm --filter @gmt/dox exec vitest run worker/morocco-clock-change.test.ts worker/canada-clock-change.test.ts src/lib/dev-worker-proxy.test.ts --reporter=verbose`
   passes. Never use `vitest list --json` with a file path.
2. `grep -n "@northguild/gmt\"\|@northguild/gmt/zoned\"\|@northguild/gmt/utc\"" apps/dox/worker/morocco-clock-change.ts apps/dox/worker/clock-change-shared.ts`
   prints nothing (module barrels only).
3. Locally, `pnpm --filter @gmt/dox dev:chat` in a scratch build. Then
   `curl -si http://127.0.0.1:8787/gmt/api/morocco-clock-change` answers 200 with
   `"offset":"+00:00"` for all four probe rows on Node and workerd with tz 2026c or later. Record
   the workerd tz version from the response or from `wrangler --version`.
4. `curl -si -X DELETE …/morocco-clock-change` gives 405 with `allow: GET, HEAD, POST`.
   `curl -si -X POST -F zone=Africa/Casablanca -F 'lines=2026-11-16T09:00:00+01:00' …` gives 200
   with one row.
5. `pnpm dox:check` and `pnpm dox:lint` are clean.
6. In `built.md` Tier 6, the lines that describe Canada's endpoint and `canada:` bucket also name `/gmt/api/morocco-clock-change`
   and the `morocco:` bucket, with one line saying why: each checker has its own count, so one
   page cannot spend another's.
