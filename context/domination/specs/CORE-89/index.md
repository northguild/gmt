---
story: CORE-89
issue: 340
status: approved
dox: none
---

# CORE-89 — the Morocco 2026 clock-change checker

`dox: none` because the work is the Dox site itself. It adds no library function, so there are
no reference pages to regenerate. Read [CORE-88's decisions](../../issues/CORE-88.md#decisions)
and the **Canada 2026 clock-change checker** entry in [built.md](../../../dox/built.md) first. Every rule there
applies here unless this spec says otherwise.

## Scope

- **Page** `/gmt/check/morocco-2026-clock-change/` (core, under `check/`, which the sidebar
  already lists automatically). It covers `Africa/Casablanca` and `Africa/El_Aaiun` and shows:
  - the reader's browser against tzdb 2026c at two instants;
  - the Worker's answer;
  - the clock changes old data gets wrong, and the "Upgrade to at least" card
    ([slice 8](./slice-8-minimums.md));
  - two live clocks;
  - a **regional map**, Morocco's two zones beside their neighbours' ([slice 3](./slice-3-map.md));
  - the saved-events check and the help card.
- **Shared parts** (slice 1). The probe, the clocks, the servers card, the help card, the
  saved-events check, the zone map and the boundary script move out of the Canada files into
  neutral modules. Each takes a config, so a third checker (CORE-90) needs only its own config.
  Nothing is built for CORE-90 now.
- **Library test** `packages/gmt/src/test/oh-morocco.test.ts`. Every row fails on tz data older
  than 2026c. **Weekly run**: the pinned Playwright 1.63.0 ships Chromium 153.0.8010.12, which
  predates 2026c (measured), so a `KNOWN_HOST_FAILURES` group is needed.
- **Release**: an empty changeset, as in CORE-88 (`.changeset/morocco-clock-change-checker.md`,
  "No release."). The test counts in the README are updated with `/update-readme`.

## The two instants and the verdict

| Instant | Role | 2026c and later | Older data (2026b and before) |
|---|---|---|---|
| `2026-11-02T12:00:00Z` (`PROBE_INSTANT`, shared with Canada) | **verdict** | `+00:00` | `+01:00` |
| `2027-02-22T12:00:00Z` (in the old data's Ramadan window, 7 Feb to 14 Mar 2027) | **blind** | `+00:00` | `+00:00` |

The verdict comes only from the first row. The second row explains why a check made during
Ramadan cannot tell: old data and new data agree there. The issue states the same fault: an hour
ahead most of the year, right for a few weeks. **Constants:** the page is about one dated change
recorded by one named release, so fixed 2026 and 2027 instants are what it describes, and they
do not age. Copy must read true before and after each instant; the fake-clock check is in slice 4.

## Clock changes your data gets wrong (stated data, diffed live)

The page states the 2027 changes that tzdb 2026b's `africa` file records under `Rule Morocco`:
`2027-02-07T02:00:00Z` (`+01:00`→`+00:00`) and `2027-03-14T02:00:00Z` (`+00:00`→`+01:00`). It
also states the new change, `2026-09-20T01:00:00Z` (`+01:00`→`+00:00`, 02:00 local), which 2026c
adds. `recordedBy` tells the two kinds apart: `"2026b"` is a change old data has and 2026c
removed, `"2026c"` one that 2026c added. For each zone the Worker marks every stated change
`present: boolean` against its own `getDstTransitions(zone, year)`. The page compares the stated list with the runtime's answer and
never computes the old rule. Old changes before 2027 are left out: they happened, both data sets
agree on them, and listing more years would only add rows that never differ.

## Authority

| Source | What it gives the page |
|---|---|
| tzdb 2026c `NEWS` (Release 2026c, 2026-07-08) | Morocco moves to permanent +00 on 2026-09-20 at 02:00. Western Sahara too. |
| tzdb 2026c `africa`: `Zone Africa/Casablanca`, `Zone Africa/El_Aaiun` | `1:00 Morocco %z 2026 Sep 20 2:00`, then `0:00 - %z` |
| tzdb 2026b `africa`: `Rule Morocco` lines for 2027 | The two 2027 changes that no longer happen |
| tzdb 2026d, 2026e `NEWS` | No Morocco change; 2026e is the newest release |
| Each runtime's release notes, or the commit pinning its tz or ICU data | The minimums card's rows, one source per row, from slice 8's research |

The page names only tzdb releases. It cites no statute, decree or government notice, and it
describes the change as what tzdb records.

## Signatures

```ts
// worker/morocco-clock-change.ts
export function computeMoroccoCheck(now: string): MoroccoCheck;
export async function handleMoroccoClockChange(request: Request, _env: unknown,
  now?: () => string): Promise<Response>;
// routed in worker/index.ts: path === "/api/morocco-clock-change"
// GET/HEAD → MoroccoCheck · POST (lines, zone) → StoredCheck · else 405 Allow: GET, HEAD, POST
// bucket `morocco:<clientId>`, MOROCCO_RATE_LIMIT = { max: 20, windowSeconds: 60 }

interface MoroccoCheck {
  now: string;                                   // the Worker's clock, ISO instant
  probe: { zone: string; instant: string; role: "verdict" | "blind";
           expected: string; offset: string }[]; // 2 zones × 2 instants
  changes: { zone: string; at: string; from: string; to: string;
             recordedBy: "2026b" | "2026c"; present: boolean }[];
  transitions: { zone: string; year: 2026 | 2027; changes: Change[] }[];
  zones: ZoneRow[];  // one per id in morocco-region-zones.json (10); ZoneRow = today's MapZone
}
```

`ZoneRow` keeps Canada's shape (`zone`, `offset`, `last`, `next`, `kind`) and moves to the
shared module in slice 1. The page takes stale zones from the shared `staleZoneIds(stopped, zones)`:
a zone in the stated stopped set (the two Moroccan zones) whose row does not come back as
`stopped`. The saved-events check then reads "can't check yet" for that zone, as Canada's does.

The interfaces of the shared parts are in [slice 1](./slice-1-shared-parts.md#interfaces).

## Files

| Status | Path |
|---|---|
| new | `apps/dox/worker/clock-change-shared.ts`, `worker/morocco-clock-change.ts` (+ test) |
| new | `apps/dox/src/lib/clock-change-{probe,clocks,stored-lines,stored,help}.ts`, `src/lib/zone-map.ts` (each with the Canada tests that cover it) |
| new | `apps/dox/src/lib/morocco-clock-change.ts`, `morocco-clock-change-mount.ts`, `morocco-map.ts`, `morocco-saved-example.ts` (+ tests) |
| new | `apps/dox/src/lib/morocco-region-zones.json`, `apps/dox/public/timezone-boundaries-morocco.json` |
| new | `apps/dox/src/data/morocco-key-points.ts`, `src/data/clock-change-text.ts` (the text types moved out of `canada-key-points.ts`) |
| new | `apps/dox/src/data/clock-change-minimums.ts` (+ test), `src/data/morocco-runtime-minimums.ts`; `canada-runtime-minimums.ts` keeps Canada's data only |
| new | `apps/dox/src/components/MoroccoClockChange.astro`, `MoroccoProbeScript.astro` |
| new | `apps/dox/src/content/docs/check/morocco-2026-clock-change.mdx`, `apps/dox/src/styles/clock-change.css` |
| new | `packages/gmt/src/test/oh-morocco.test.ts`, `.changeset/morocco-clock-change-checker.md` |
| moved | `scripts/prepare-canada-boundaries.py` → `scripts/prepare-region-boundaries.py` (with a `--region` option) |
| moved | Code for the shared parts and their CSS, from `canada-clock-change{,-mount}.ts`, `canada-map.ts`, `canada-stored-times.ts`, `worker/canada-clock-change.ts` and `canada-clock-change.css` |
| changed | `worker/index.ts`, `worker/tools.ts`, `src/lib/dox-tools.ts`, `src/lib/chat-constants.ts`, `src/components/ask/widget-registry.ts`, `src/lib/widget-permalink.ts`, `src/lib/mdx-jsx.ts`, `astro.config.mjs`, `src/styles/gmt-a11y.css` |
| changed | `src/lib/runtime-tz-canary.test.ts`, `scripts/{html-diff,visual-snapshot,deploy-smoke,data-credits-check,grow-measure,contrast-measure}.mjs`, `scripts/data-credits-built.test.ts`, `canada-{clock-still,stored-still,layout-check}.mjs` (a `--path` option) |
| changed | `scripts/lib/native-suite-tags.mjs`, `context/dox/built.md`, `context/domination/issues/CORE-89.md` |

## Slices

| # | Slice | Depends on |
|---|---|---|
| 1 | [Shared parts, map and boundary script included; Canada unchanged](./slice-1-shared-parts.md) | — |
| 2 | [Morocco Worker endpoint](./slice-2-worker.md) | 1, 3 |
| 3 | [Regional map: zones, boundary file, projection, credits](./slice-3-map.md) | 1 |
| 4 | [Morocco page, chat pill, widget](./slice-4-page.md) | 2, 3, 8 |
| 5 | [Library test `oh-morocco.test.ts`](./slice-5-library-test.md) | — |
| 6 | [Weekly-run known-failure group](./slice-6-weekly-run.md) | 5 |
| 7 | [Deploy smoke and close-out](./slice-7-deploy-smoke.md) | 2, 4 |
| 8 | [The "Upgrade to at least" card: research, then shared card and Morocco rows](./slice-8-minimums.md) | 1 |
| 9 | [Map labels, and the map fitted to its box (owner's request)](./slice-9-map-labels.md) | 10 |
| 10 | [Real coastlines and the land around the zones (owner's request)](./slice-10-real-coastlines.md) | 4 |
| 11 | [One copy of each helper, and the table in the chat rail](./slice-11-shared-helpers.md) | 9 |
| 12 | [Every zone in Morocco's box, and a ready signal for the browser checks](./slice-12-whole-region-and-ready-signal.md) | 11 |

Slice 3 makes the zone file the Worker reads. The owner's `pnpm dox:dev` reads `packages/gmt/dist`:
warn him before `pnpm run validate`, the only rebuild, at the end.

## Corrections to context

- `built.md` (Canada page) says "Node here carries tz 2026c". CI now runs Node 22.23.4,
  24.22.1 and 26.12.1, all on tz 2026e. Only a local Node 24.21.0 carries 2026c. Reword it to name
  the runtime instead of the release.
- The CORE-89 issue says the Canada checker "shows Casablanca as one probe row". It does not:
  `TABLE_ZONES` leaves it out, and only the API answers it. Fix that line in the slice 7 close-out.
- `built.md` (Tier 6) says other methods answer `405` with `allow: GET`; it is `Allow: GET, HEAD, POST`.
- Outside this story: the weekly run's Firefox leg has 11 untagged native failures and 25 untagged
  host failures (run 39655037352). Report it; this story does not fix it.
