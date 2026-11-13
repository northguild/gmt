---
story: CORE-90
issue: 341
status: approved
dox: none
---

# CORE-90 — phase 1: the Sunshine Protection Act page and a freshness canary

Issue: [#341](https://github.com/northguild/gmt/issues/341). Story file:
[issues/CORE-90.md](../../issues/CORE-90.md). Facts checked 2026-11-13.

## Scope

Two phases, one story.

- **Phase 1 (this spec).** A Dox page titled **Sunshine Protection Act**, at
  `/check/us-sunshine-protection-act/`. Its map has two views:
  - **Today:** every US zone as the tz database models it. Each zone is drawn either as
    "changes its clocks" or as "standard time all year". The second class covers Arizona outside
    the Navajo Nation, Hawaii and the territories.
  - **Proposals:** each state's adopted position, dated. Its classes are "already on standard time
    all year", "daylight time all year if federal law changes" (19 states) and "standard time all
    year proposed". A text panel gives the national proposal, describing its effects only.
  - Below the map, evidence-based guidance on how disruptive a change would be.
- **A weekly freshness canary** (also phase 1) watches Congress.gov, Open States and the tz
  database, and opens an issue when they differ from a committed snapshot. Its tz issue is the
  signal to build phase 2 ([freshness-canary.md](freshness-canary.md)).
- **Phase 2 (not planned here).** The full checker at `/check/us-<year>-clock-change/` and the
  US test file in `packages/gmt/src/test/`. It waits until a change is law **and** a tz database
  release models it. Phase 2 reuses the CORE-89 checker parts and the two-form tense parts.
- **No projected offsets.** Phase 1 never says which zone would move or by how much. That comes
  from a tz database release, in phase 2.
- **Law wording is effects only.** The page, data module, chat text, canary script and tests
  never name, number or link a bill, statute, docket or body. **One owner exception, scoped to
  this page:** its title, sidebar label and slug use the name "Sunshine Protection Act", and one
  neutral sentence says proposals under that name have been put forward in several sessions
  ([page-and-route.md](page-and-route.md)). It is not a precedent. Citations live only in the
  evidence file
  `context/domination/research/us-permanent-daylight-time.md`. The builder writes that file from
  [evidence-data.md](evidence-data.md).
- **It is a tool.** It has a pin, two views and a permalink. It gets widget kind `sunshineact`,
  tool `showUsSunshineProtectionAct` and a CHAT_STARTERS pill that is not among the first five
  ([chat-registration.md](chat-registration.md)).
- **Dox only.** No `packages/` file changes, so no changeset.

## Files

| File | Slice |
| ---- | ----- |
| `apps/dox/src/content/docs/check/us-sunshine-protection-act.mdx` (new) | page-and-route |
| `apps/dox/src/components/SunshineProtectionAct.astro` (new) | page-and-route |
| `apps/dox/src/lib/sunshine-protection-act-mount.ts` + test (new) | page-and-route |
| `apps/dox/src/lib/feature-map.ts` + test (new; core moved out of `zone-map.ts`) | feature-map-kit |
| `apps/dox/src/lib/zone-map.ts` (thin config over `feature-map.ts`) | feature-map-kit |
| `apps/dox/src/widgets/families/clockcheck/zone-map.ts` (`featureListParts`, `viewSwitch`) | feature-map-kit |
| `apps/dox/src/lib/us-projection.ts` + test (new) | feature-map-kit |
| `apps/dox/scripts/prepare-region-boundaries.py` (`us` row), `scripts/boundary-data.test.ts` | boundary-data |
| `apps/dox/public/timezone-boundaries-us.json`, `public/state-boundaries-us.json` (new, generated) | boundary-data |
| `apps/dox/src/lib/us-region-zones.json` (new, generated), `src/lib/data-credits.ts` + test | boundary-data |
| `apps/dox/worker/sunshine-protection-act.ts` + test (new), `worker/index.ts` (route) | today-endpoint |
| `apps/dox/src/data/sunshine-protection-act-proposals.ts` + test (new) | evidence-data |
| `context/domination/research/us-permanent-daylight-time.md` (new, at implementation) | evidence-data |
| `apps/dox/src/data/sunshine-protection-act-guidance.ts` (new), `widgets/families/clockcheck/key-points.ts` (heading argument) | guidance-text |
| `dox-tools.ts`, `worker/tools.ts`, `widget-registry.ts`, `widget-permalink.ts`, `chat-constants.ts` | chat-registration |
| `widget-load-error.test.tsx` (`MOUNTS`), `widget-graph.test.ts` (`heavy`), `scripts/{html-diff,visual-snapshot,grow-measure}.mjs` (`PAGES`) | chat-registration |
| `apps/dox/src/data/sunshine-protection-act-wording.test.ts` (new), `scripts/data-credits-check.mjs` (`PAGES` row) | tests-and-done |
| `.github/workflows/us-clock-watch.yml`, `scripts/us-clock-watch.mjs`, `scripts/us-clock-watch.snapshot.json` (new) | freshness-canary |
| `scripts/canary-report.mjs`, `scripts/lib/canary-{issues,verdict,summary}.mjs`, `apps/dox/scripts/canary/*` tests and fixtures | freshness-canary |
| `context/dox/built.md`, `context/canary/overview.md`, `context/domination/issues/CORE-90.md`, `context/domination/tracker.md` | tests-and-done |

## Authority — what each rule rests on

| Rule | Source |
| ---- | ------ |
| Zones, their offsets and whether they change clocks | IANA tz database 2026e (`zone.tab`, `northamerica`), read through gmt (`hasDaylightSaving`, `getDstTransitions`, `getTimeZoneOffset`) |
| Navajo Nation keeps daylight time; the rest of Arizona does not | tz database `northamerica` (Navajo: "See America/Denver"); CRS R45208 (national peer) |
| The 19 states and their conditions; no state has adopted standard time all year since 2015 | CRS R45208, updated 24 July 2026 (national peer); each state's own statute, at implementation |
| The national proposal's effects | Engrossed bill text on govinfo (research file only) |
| Changes reach devices only after a tz database release; give a year's notice | IANA `tz-link.html` |
| Year-round daylight time was tried and reversed | tz database `northamerica` (US 1974), `europe` (UK 1968–71, Russia 2011–14) |
| Health and safety guidance, international bodies first | SRBR position paper (Roenneberg 2019), EU consultation 2018, EBRS/ESRS (to verify), then AASM (US peer) |
| Map geometry | timezone-boundary-builder 2026e (ODbL), Natural Earth 5.1.2 admin-0 and admin-1 (public domain) |
| Composite equal-area projection | d3-geo `geoAlbersUsa` (ISC) as the model; EPSG:5070 and EPSG:3338 parameters |
| Wording, colour, layout and lifetime rules | [built.md § Binding rules](../../../dox/built.md) and the CORE-89 checker-parts section |
| Federal bill watch: endpoints, key, 5,000 requests an hour | Congress.gov API README and `BillEndpoint.md` (LibraryOfCongress/api.congress.gov); api.data.gov developer manual |
| State bill watch: endpoints, key; no published rate limit | docs.openstates.org/api-v3, its changelog and `v3.openstates.org/openapi.json` |
| Keyboard path | WAI-ARIA APG: Radio Group (view switch), toggle Button with roving tabindex (feature list) |

## Slices

| Slice | File | Depends on |
| ----- | ---- | ---------- |
| 1 feature-map-kit | [feature-map-kit.md](feature-map-kit.md) | — |
| 2 boundary-data | [boundary-data.md](boundary-data.md) | — |
| 3 today-endpoint | [today-endpoint.md](today-endpoint.md) | 2 (zone list) |
| 4 evidence-data | [evidence-data.md](evidence-data.md) | — |
| 5 guidance-text | [guidance-text.md](guidance-text.md) | 4 (facts) |
| 6 page-and-route | [page-and-route.md](page-and-route.md) | 1–5 |
| 7 chat-registration | [chat-registration.md](chat-registration.md) | 6 |
| 8 tests-and-done | [tests-and-done.md](tests-and-done.md) | all |
| 9 freshness-canary | [freshness-canary.md](freshness-canary.md) | 2 (zone list) |

Slices 1, 2, 4 and 9 can run in parallel (9 needs only the zone list from 2). Build `packages/gmt` once, last, and warn the owner first:
his dev server reads `packages/gmt/dist`.

## Decisions — the owner's answers

1. **Place and name.** Under Checks, slug `us-sunshine-protection-act`, title and sidebar label
   "Sunshine Protection Act" — the page-scoped exception in Scope. Tool `showUsSunshineProtectionAct`,
   kind `sunshineact`; component, mount, data and test files follow the slug.
2. **It is a tool**, with a CHAT_STARTERS pill after the first five.
3. **A Worker endpoint** (`/api/sunshine-protection-act`) computes the Today classes.
4. **"if federal law changes"** is the UI wording. No body is named.
5. **"Standard time all year proposed"** means a measure passed by one chamber, or adopted by a
   whole legislature, in this session. Bills only introduced are counted in words, not drawn.
   An unverified measure leaves the class with an empty legend count; the class stays.
6. **One "Sources" link** to the research file on GitHub, the only place that cites law.
7. **Status.** "In progress" while the PR is open. After merge, back to "Waiting", with the note
   "phase 1 page and watcher shipped; the tz-release canary issue triggers phase 2". The PR says
   "Part of #341". The finalizer folds slices 1–9 into `built.md`, `context/canary/overview.md`
   and `issues/CORE-90.md`, deletes them, and trims this index to the phase-2 plan. The folder
   stays: the story is not Done.
8. **tz database pin** stays 2026e.
9. **Unverified facts** (California's measures, the EBRS/ESRS statement, each state's statute)
   are checked on their primary sites at implementation. Anything unverified is cut.
10. **Ageing.** Runtime "checked N days ago", and after the session ends (3 January 2027) a
    runtime note that it has ended. No test depends on the run date. The canary keeps the data
    honest by opening issues; the data module is still edited by hand.

11. **Canary retirement, in parts.** The tz part retires when phase 2 ships; the federal and
    state parts when the Proposals view's data is removed or replaced. The workflow header says so.
12. **Issue bodies may show the bill numbers and titles the APIs return**, as data, in GitHub
    issues only. The script, snapshot keys and site hold none of their own.
13. **Open States pacing.** One request a second, at most 60 a run; a 429 is could-not-run, with
    no retry.
