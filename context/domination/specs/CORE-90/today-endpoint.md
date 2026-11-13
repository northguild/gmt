# Slice 3 — today-endpoint: each US zone's class, from gmt, in the Worker

Index: [index.md](index.md). Pattern: `apps/dox/worker/canada-clock-change.ts` and
`worker/clock-change-shared.ts`. Rule: [built.md](../../../dox/built.md) § Binding rules, "A widget
draws the library's results and computes none of them".

## Why a Worker

The checkers compute their zone rows in the Worker, so every reader sees the same map whatever
their browser's tz data. This also keeps the polyfill off the page's first paint. This page
does the same.

## `apps/dox/worker/sunshine-protection-act.ts` (new)

```ts
import { hasDaylightSaving } from "@northguild/gmt/zoned/validate";
import { getTimeZoneOffset } from "@northguild/gmt/zoned/get";
import { getUtcNow } from "@northguild/gmt/utc/get";
import usZones from "../src/lib/us-region-zones.json";
import { json, rateLimited, transitionsFor } from "./clock-change-shared";

export interface WatchZone {
  zone: string;
  offset: string;                 // getTimeZoneOffset(zone, now)
  observes: boolean;              // hasDaylightSaving(zone, { at: now })
  last: Change | null;            // as mapZone picks it: three local years, by instant
  next: Change | null;
}
export interface SunshineActZones { now: string; zones: WatchZone[] }

export function computeSunshineActZones(now: string): SunshineActZones;
export function handleSunshineProtectionAct(
  request: Request, _env: unknown, now: () => string = getUtcNow,
): Promise<Response>;
export const SUNSHINE_ACT_RATE_LIMIT = { max: 20, windowSeconds: 60 } as const;
```

Import each function from its module barrel only, never from a namespace barrel (exports-map
rule).

- **The last and next pick.** Move the window logic of `mapZone` (three local years, then a pick
  by instant) into an exported `lastAndNext(zone, now)` in `clock-change-shared.ts`.
  - `mapZone` calls it, so the checkers' rows stay identical and `clock-change-shared.test.ts`
    passes unedited.
  - `computeSunshineActZones` calls it too. It does not copy the logic.
- **Order.** Rows follow `us-region-zones.json`, which keeps the `zone.tab` order. The two
  `undrawn` zones are included.
- **The method.**
  - `GET` answers `200`. Any other method answers `405` with `allow: GET`.
  - The rate-limit bucket is `sunshine-protection-act:` with `SUNSHINE_ACT_RATE_LIMIT`, through
    `rateLimited`, and answers `429` the same way.
- **Cache.** `cache-control: no-store`, through `json`, the same as the checkers. `now` changes
  every request.
- **CPU.** `transitionsFor` caches each zone-and-year scan for the isolate's life: 36 zones, three
  years. Assert in the test that a second `computeSunshineActZones` call with the same year makes no
  new `getDstTransitions` call. Spy on the module with `vi.spyOn` on a namespace import of
  `@northguild/gmt/zoned/get`, or count through an injected wrapper. Do whichever
  `clock-change-shared.test.ts` already does.

## `apps/dox/worker/index.ts`

Add `if (path === "/api/sunshine-protection-act") return handleSunshineProtectionAct(request, env);` beside the
two checker routes. Check `static-routing.test.ts` for a list of API paths and add the route
there if one exists.

## Classes on the page

The page script maps each row to one of the Today classes:

| `observes` | Class | List and pin words |
| ---------- | ----- | ------------------ |
| `true` | `changes` | "Changes its clocks twice a year" |
| `false` | `standard-all-year` | "Same time all year" |
| row missing | `no-data` | "No data" |

The words describe what the tz data shows. They never explain why ("exempt" is a legal word, so
it is not used).

## Pin panel fields (Today)

| Field | Content |
| ----- | ------- |
| Place | `cityOf(zone)`, then the IANA id in code font |
| Offset now | `offsetWords(offset)`, the existing helper |
| Last change | `lastText(row, now)`, the existing helper, or "None in the past year" |
| Next change | `nextText(row, now)`, the existing helper, or "None in the next year" |

"Next change" is runtime tense, read from the Worker's `now`. No static text dates it.

## Tests: `apps/dox/worker/sunshine-protection-act.test.ts` (new)

Every test passes `now` as a fixed instant string. None reads the clock.

- At `2026-11-13T12:00:00Z`:
  - `America/Phoenix`, `Pacific/Honolulu`, `America/Puerto_Rico`, `Pacific/Guam` and
    `Pacific/Pago_Pago` have `observes: false`;
  - `America/Denver`, `America/New_York`, `America/Anchorage` and `America/Adak` have
    `observes: true`;
  - `America/Denver.last` is the 2026-11-01 change.
- Every id in `us-region-zones.json` has exactly one row.
- `405` on POST, `429` after `max` calls from one client id, and `200` with JSON.

Run them with the existing Worker Vitest config. No network: the endpoint only reads tz data.

## Done when

- The route answers `200` on `pnpm dox:dev`.
- The test file passes.
- `clock-change-shared.test.ts` and both checker endpoint tests pass unedited.
