# CORE-89 — Core: The Morocco 2026 clock-change checker in Dox

**Scope:** Dox gains a Morocco 2026 clock-change checker at `/gmt/check/morocco-2026-clock-change`, built from the Canada checker's parts, which become shared rather than copied. Adds no library function.

## Gap

Since 2026-09-20, Morocco and Western Sahara stay on UTC+00 all year and no longer change their clocks for Ramadan; tzdb 2026c records it. A runtime with older tz data shows `Africa/Casablanca` and `Africa/El_Aaiun` at `+01:00` outside Ramadan and `+00:00` during it, so it is an hour ahead for most of the year and right for a few weeks, which hides the fault. Measured: Chromium 153.0.8010.12 gives `+01:00` at 2026-10-22T12:00Z and 2027-06-01T12:00Z; Chromium 156.0.8078.4, WebKit 26.6 and Node 26.12.1 (tz 2026e) give `+00:00`. The Canada checker leaves Casablanca out of its table; only its API answers that zone.

## Scope

- **The checker** at `/gmt/check/morocco-2026-clock-change`, MIT like the rest of Dox, with its chat pill and widget registration: the reader's runtime against tzdb 2026c for both zones, the clock changes that no longer happen, and which saved events moved (`classifyStoredZoned`). The Dox Worker computes it when the page is requested.
- **Shared parts.** The Canada checker's runtime probe, live clocks, saved-events check and help card become parts both pages use. The Canada page keeps its behaviour and its tests.
- **A test file** beside `packages/gmt/src/test/oh-canada.test.ts`: fixed instants through 2027, Ramadan included, every row failing on tz data older than 2026c. The page links to it.
- **The weekly native run.** A `KNOWN_HOST_FAILURES` group for Chromium, with evidence, if the run's Chromium still predates 2026c when the test lands.

## What gmt provides (do not re-implement)

- The Canada checker, its Worker endpoint and its page parts (`CORE-88`)
- `classifyStoredZoned` (`CORE-83`)
- `getTimeZoneOffset`, `getDstTransitions` and the zone helpers the Worker endpoint calls

## Verification

- The checker page and its Worker endpoint answer 200 live, and the Worker column matches tzdb 2026c for both zones.
- The Canada page renders and behaves as before on the shared parts.
- The checker works keyboard-only and at 375 px.
- `pnpm run validate` stays green.

## Decisions

**Endpoint** (`apps/dox/worker/morocco-clock-change.ts`, routed from `routeApi`)

- `GET /gmt/api/morocco-clock-change` answers `200 application/json` with `cache-control: no-store`: `now`, `probe` (two zones at two instants), `changes`, `transitions` (2026 and 2027) and one `zones` row per id in `morocco-region-zones.json`. HEAD, `405` with `Allow: GET, HEAD, POST`, `413` and `429` are the Canada endpoint's, because both are configs on `handleClockChangeCheck`.
- Rate limit: `morocco:<clientId>`, 20 calls in 60 seconds, a bucket of its own so one page cannot spend the other's.
- The stored-times cap is 25 lines and 20,000 bytes for both checkers (see [CORE-88](./CORE-88.md#decisions)).

**Instants and the verdict**

- The verdict comes from `2026-11-02T12:00:00Z`: tzdb 2026c gives `+00:00`, older data `+01:00`. The second instant, `2027-02-22T12:00:00Z`, sits in the old data's Ramadan weeks and gives `+00:00` on both, so it explains why a check made in those weeks cannot tell. Both are fixed on purpose: the page is about one dated change recorded by one named release.

**Stated changes**

- The page states three changes per zone: the 2026c stop (`2026-09-20T01:00:00Z`, `+01:00` to `+00:00`) and the two 2027 changes tzdb 2026b records under `Rule Morocco` (`2027-02-07T02:00:00Z`, `2027-03-14T02:00:00Z`). `recordedBy` names the release. The Worker marks each `present` from its own `getDstTransitions`; the page never computes the old rule. The page names only tzdb releases.

**Map, boundary data and credits**

- The map is a config over the shared zone map: ten zones from tzdb 2026e `zone.tab` rows for `MA`, `EH`, `DZ`, `MR`, `ES`, `PT` and `GI`, a Lambert conformal conic fitted to the frame, and the Natural Earth coastline. Boundary data comes from `prepare-region-boundaries.py --region morocco` and carries `ODbL-1.0` and its attribution.

**The Upgrade to at least card**

- Each row names a primary source (release notes, the commit with the first release tag that holds the data, or the package page). The release must carry tz 2026c or later. A line with no such release is left out.

**Tests and checks**

- `packages/gmt/src/test/oh-morocco.test.ts` fails on tz data older than 2026c. The weekly run lists the Chromium that predates 2026c in `KNOWN_HOST_FAILURES`.
- The deployed Worker has tz 2026e. The workerd that `wrangler dev` runs locally (1.20260825.1) carries older data than 2026c, so `deploy-smoke.mjs` runs only against the deployed Worker.

**Registration**

- A chat starter, the `moroccoclock` widget, the `showMoroccoClockChange` Worker tool and the permalink kind, in every list of `context/dox/built.md`.
