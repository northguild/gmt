# Slice 8 — tests-and-done: tests, gates, close-out

Index: [index.md](index.md). Runbooks: the gate runner and the layout-gate sections of
[built.md](../../../dox/built.md), and `reference/verification-and-risks.md`. Run commands with
`eval "$(fnm env)" && fnm use` first.

## Unit tests (Vitest, no network)

| File | Covers |
| ---- | ------ |
| `src/lib/feature-map.test.ts` | the core, with a `postal` config ([feature-map-kit.md](feature-map-kit.md) § Done when) |
| `src/lib/us-projection.test.ts` | parts, round trip, no overlapping clip boxes |
| `scripts/boundary-data.test.ts` | the US point table, feature and id agreement, size budgets |
| `worker/sunshine-protection-act.test.ts` | rows at a fixed `now`, methods, rate limit, cache ([today-endpoint.md](today-endpoint.md)) |
| `src/data/sunshine-protection-act-proposals.test.ts` | rows, gmt cross-check, `ageWords`, `STATE_CODES` equals the boundary file's codes |
| `src/lib/sunshine-protection-act-mount.test.ts` | see below |
| `src/lib/data-credits.test.ts`, `widget-permalink.test.ts`, `worker/tools.test.ts` | extended for the new entries |
| `src/data/sunshine-protection-act-wording.test.ts` (new) | the word scan below |

### `sunshine-protection-act-mount.test.ts`

- The template has every part before mount:
  - the switch, both lists with all rows, both pin panels, the legends, the national panel and
    five guidance cards (page) or none (chat);
  - the list has 36 Today rows and 56 Proposals rows.
- **Mount with injected deps.**
  - `fetch` serves the fixtures, `getToday` returns `2026-11-13`, and the width is 1024.
  - `root.dataset.state` becomes `"ready"`.
  - The Today classes follow a stubbed Worker answer.
  - The Proposals map is not fetched until the view switches.
- **Seed.**
  - `{ kind: "proposals", state: "DE" }` opens Proposals with Delaware pinned.
  - The Condition field reads the Delaware condition.
  - An unknown state opens unpinned.
- **Arizona's pin** includes the Navajo Nation line.
- **Narrow.** At width 375 there is no boundary fetch, the list is shown and pinning still fills
  the panel.
- **Bounding box.**
  - Record the pin panel's and the legend's rects. Then pin Delaware, pin Idaho, switch views
    and resolve the Worker answer.
  - Every rect is unchanged within 0.5 px.
  - Do this in the browser-mode project the checkers' layout tests use, since jsdom has no
    layout.
- **Teardown.**
  - Each test creates its own `AbortController` and aborts it in `afterEach` (inside
    `try/finally`, so an assertion failure still tears down). It also calls `handle.destroy()`.
  - One test aborts mid-fetch and asserts nothing draws after it.
  - No real timers are started. Leave no pending promise that resolves in a later file: await
    each injected fetch's settle in the test that started it.

### `sunshine-protection-act-wording.test.ts`

Scan these for the banned list in [guidance-text.md](guidance-text.md) and the
evidence-data regex, case-insensitive on whole words:

- `US_GUIDANCE`;
- `NATIONAL`;
- the rendered template text;
- the `showUsSunshineProtectionAct` doc entry;
- the starter text;
- the MDX body.

The only exceptions are the owner's page-scoped ones: the frontmatter `title`, the
`sidebar.label`, the slug, and the one naming sentence quoted in
[page-and-route.md](page-and-route.md). The test strips those exact strings, and nothing else,
before it scans. File and identifier names are not scanned. A scientific society's name is
allowed, so the list must not ban "Society" or "Academy".

## Gates — `pnpm --filter @gmt/dox gates --pages /check/us-sunshine-protection-act/`

| Gate | What to add |
| ---- | ----------- |
| `a11y-axe`, `a11y-tab-walk`, `a11y-media` | none: they take every `dist` page. Both themes, 1440 and 390. Tab walk: switch, then list, then pin links, then guidance links |
| `data-credits-check` | a `PAGES` row for this page's map credits corner (`sunshine-protection-act` frame and id) |
| `frame-check`, `table-fit`, `contrast-measure` | none, beyond confirming the page is selected |
| `grow-measure` | the `PAGES` row from [chat-registration.md](chat-registration.md) |
| `html-diff` | capture and compare: the checker pages are unchanged, and this page is new |
| `visual-diff` | the `PAGES` row; review the 1440, 1024 and 375 shots by reading the whole page, not one screenshot |
| `canada-layout-check` | not extended: it is checker-specific. This page's layout is covered by the bounding-box unit test and `frame-check` |

**Forced colours.** Check by hand in Chromium with `--force-prefers-color-scheme` emulation, or
through the `a11y-media` gate if it covers `forced-colors: active`. Every class keeps its pattern,
and the checked view segment shows as `Highlight`.

**The owner's own steps** (the "verify with the owner's steps" rule). Before calling it done,
ask the owner which window size and clicks he will try, and reproduce them in a real browser
against `pnpm dox:dev`. Warn him before any `packages/gmt` build: his dev server reads
`packages/gmt/dist`.

## Whole-repo checks

- `oxfmt --check` and the affected lint and typecheck first, then `pnpm run validate`. It stays
  green, including the CI timezone matrix. `apps/dox` must not change `packages/gmt`.
- `pnpm dox:docs-check` is unchanged. No new reference gaps.
- The canary tests in `apps/dox/scripts/canary/` pass offline. A `workflow_dispatch` dry run
  from the branch lists its planned issues in the job summary and files none (issues come only
  from `main`). The owner adds both secrets before the first run on `main`.
- No changeset: no file under `packages/` changes. If one does, stop. That is library pipeline
  work.

## Close-out (dox-builder, then finalizer)

- **`context/dox/built.md`**, in the present tense, with no history:
  - a "Sunshine Protection Act page" section: route, the two views, the Worker endpoint, data
    files and their licences, the evidence module and how it ages, and the starter;
  - **the owner's exception, recorded under § Binding rules as page-scoped.** This one page's
    title, sidebar label and slug name the proposal, and one neutral sentence says the name has
    been used in several sessions. Every other string on the page, in the chat and in tests stays
    effects-only. It is not a precedent for any other page;
  - in the shared-parts section, `feature-map.ts` as the map core, `wireZoneMap` as its checker
    config, `viewSwitch`, `geoUsComposite`, and the `keyPoints` heading argument;
  - the registration lists gain the new entries;
  - the boundary-script runbook gains the `us` row and the `states` output.
- **`context/canary/overview.md`**: the US clock-law watch row and its section
  ([freshness-canary.md](freshness-canary.md) § Context doc).
- **`context/domination/issues/CORE-90.md`**: record phase 1 and the watcher as shipped (what and
  where) and the owner's decisions from [index.md](index.md) § Decisions. Phase 2 waits for the
  law and a tz release, and the canary's tz issue is its trigger.
- **`context/domination/tracker.md`**:
  - CORE-90 is "In progress" while the PR is open.
  - After merge it returns to "Waiting". The row notes: "phase 1 page and watcher shipped; the
    tz-release canary issue triggers phase 2".
  - Run `pnpm deps:sync`.
- **Spec folder.** Delete the phase-1 slice files once they are folded in. Trim `index.md` to the
  phase-2 plan and keep the folder, because the story is not Done.
- **Research file.** `context/domination/research/us-permanent-daylight-time.md` exists, with
  each fact dated and every **verify** item resolved or cut.
- The PR body says "Part of #341", never "Closes #341". Git operations happen only on the
  owner's word.
