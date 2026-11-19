---
story: DOX-G12
issue: 548
status: approved
dox: none
---

# DOX-G12 · Slide decks and Deck 0, "Give Me Temporal"

A `/slides/` area that holds the site's talks, and its first deck: the HelsinkiJS talk "Give Me
Temporal", 20 minutes plus 5 of questions. The deck is a 16:9 stage in front of the landing's
space scene. Site work in `apps/dox`, plus a by-hand runner in `scripts/zone-matrix/`: no new
Dox tool or chat pill, and no `packages/gmt` change unless the zone-matrix control finds a GMT
bug, which is then fixed here through the library pipeline with a changeset.

## The spine: one clock against the whole planet

The date libraries people reach for show one clock as their site's visual: one local time. GMT
works across the whole planet at once, and the deck stages that contrast. On slide 2 a wall of
six captured library landing pages hangs in a three by two grid in the left two thirds, with the
clock in the right third. Stepping to the `date` slide breaks the wall: the panes shatter into ice
and the shards fly off, and the `date` table enters once they are clear. Stepping to the Temporal
slide turns the clock into the Earth where it stands (same spot and size), and that slide's text
enters once the turn ends. The shards settle as clock pins with local times on the Earth, and it
turns once. On every slide the clock or the Earth sits in the right third and never moves sideways;
the content fits the left two thirds. Text waits for any motion that would cross it, then fades in
over about 300 ms; there is no wait under reduced motion, on a deep link, or without a globe. The pins stand in the zones GMT's CI runs in ([slice 4c](./s4c-zone-matrix.md)).
Slides 5 to 9 put numbers on it: the same inputs go into every library, and the standard gives
the answer (`zone-probe.json`). Then every slide is pinned to a place, and the camera
hops between them under the real sky, Sun and Moon. A contrast of viewpoint, never a verdict: no
text judges a library, and their marks appear only inside the captioned snapshots.

The 3D form is an orbit tour on the existing globe engine and its canvas-2D fallback, under the
one-camera rule ([Tier 4 · Engine](../../built/tier-4-globe.md#engine-srclibglobe)), with a Moon
pull-back. A solar-system flight was rejected: it needs a free camera and a new fallback.

## URL scheme

| Route | What | Search and sitemap |
| --- | --- | --- |
| `/slides/` | Index of decks, from the registry `src/slides/decks.ts` | Indexed, in Pagefind and the sitemap |
| `/slides/give-me-temporal/` | Deck 0 (labelled "Deck 0" on the index) | In the sitemap, `pagefind: false`, site share card |
| `/slides/give-me-temporal/presenter/` | Presenter view | `noindex`, out of the sitemap and Pagefind |
| `/compare/zone-matrix/` | The zone-matrix results in full | Indexed like `/compare/behaviour/` |

A slide is `#<slide-id>`; a build is `#<slide-id>/<n>`; the sections carry the same ids, so the
fragment works without JS. Not in the sidebar. The site header shows in browse mode; fullscreen
covers the deck root alone.

## Phases

One PR. Each slice lands with its own tests (`pnpm dox:test -- <files>`), `pnpm dox:lint`,
`pnpm dox:check` and the owner's listening pass; the full gates
([Tier 2 · Gates](../../built/tier-2-gates.md#gates)) and `dox-tester` run once, in slice 5
([pipeline](../../../../.agents/skills/pipeline/SKILL.md)).

| # | Slice | What the reader sees |
| --- | --- | --- |
| 1 | [Deck shell](./s1-deck-shell.md) | A 16:9 stage stepped by keyboard or clicker; overview, help, blank, fullscreen; an article without JS; one slide a page in print |
| 2 | [Space stage](./s2-space-stage.md) | The Earth and real sky behind every slide; hop flights between places; WASD free flight; the route as arcs; the Moon pull-back |
| 2b | [Ice wall](./s2b-ice-wall.md) | Captured library pages with their clocks hang in orbit; flying through shatters them into ice; shards become clock pins with local times |
| 3 | [Presenter view](./s3-presenter.md) | Notes, next slide, elapsed against plan, pace, live-or-recorded state, readiness check |
| 4 | [Deck 0 content](./s4-deck-0.md) | The 20 slides (ids, notes, framing); bug cards read from the filings; build-time gmt results |
| 4b | [Live agents](./s4b-live-agents.md) | The deck's own page tools; a live page-tool call; Dox chat answering on stage, with recorded fallbacks |
| 4c | [Zone matrix](./s4c-zone-matrix.md) | Library suites run under GMT's CI zones; a Compare page, a `/compare` column, Migrate lines |
| 5 | [Close-out](./s5-close-out.md) | Full gates, the venue runbook, `built/` updated |
| 6 | [Time, not the camera](./s6-time-not-camera.md) | One held view through the bugs; time-lapses; a visual per bug; filings as pins; the clocks return |

## Deck 0 outline (20 minutes)

| # | id | Slide | Place | Min |
| --- | --- | --- | --- | --- |
| 1 | `title` | Give Me Temporal; the venue's time now | Helsinki | 0.5 |
| 2 | `one-clock` | The ice wall: six captures in a 3 by 2 grid in the left two thirds, each one clock; under them a recorded agent answer reaches for Moment | `wall` | 1 |
| 3 | `date` | `Date` is broken: the wall breaks on arrival, then rows from `date-faults.ts` enter and type out | `planet` (clock) | 1 |
| 4 | `temporal` | The clock turns into the Earth in place; its text enters after the turn; Temporal and engine state | `planet` | 1 |
| 5 | `experiments` | The experiments: the same inputs into every library, answers from the standard; counts from `zone-probe.json` | `planet` | 0.5 |
| 6 | `experiment-gaps` | A time the clocks skip | `planet` | 1 |
| 7 | `experiment-overlaps` | A time that happens twice | `planet` | 1 |
| 8 | `experiment-host` | The same input on machines set to different zones | `planet` | 1 |
| 9 | `experiment-odd` | Apia's missing day, Lord Howe's half hour, Kathmandu's +05:45 | `planet` | 1 |
| 10 | `abort` | `nodejs/node#67076` with `CLDR-19873`: a recorded terminal; a locale pattern aborts Node | `planet`, lapse | 1.5 |
| 11 | `years` | Wrong years: `ICU-23609`, `fullcalendar/temporal-polyfill#127`; then `ICU-23619`, `js-temporal/temporal-polyfill#368`; counters roll | `planet`, lapses | 1 |
| 12 | `day-off` | `ICU-23627`; `fullcalendar/temporal-polyfill#128` (Chinese New Year 2027); calendar pages | `planet`, lapses, the Moon | 1.5 |
| 13 | `manila` | `tc39/proposal-temporal#3330` and siblings: Manila skips 1844-12-31; the page drops out | `planet`, lapse | 1.5 |
| 14 | `engines` | `nodejs/node#67457`: engines disagree on `until()` and `round()` | `planet`, sun | 1 |
| 15 | `scoreboard` | Every filing as pins, by tracker and state | Overview | 0.5 |
| 16 | `gmt` | GMT: familiar names, results computed by gmt; the clock skips 02:59 to 04:00 | Greenwich | 1.5 |
| 17 | `guards` | Tested guards and the canary | Greenwich | 1 |
| 18 | `ask-dox` | The slide 2 question again, live to Dox chat, tool calls visible | Helsinki | 1 |
| 19 | `page-tools` | A live page-tool call, and this deck's own tools read by an agent | Helsinki | 1 |
| 20 | `thanks` | Thanks; the clock shows Helsinki now; audience questions | Helsinki | 0.5 |

Minutes sum to 20 (a built-output test holds it); slide 20 holds 5 minutes of questions. Persian
and Meiji share one slide. The experiment slides take a minute each, so every slide that a demo or
a build does not hold runs at a minute or less. The full zone-matrix results live on
`/compare/zone-matrix/`, not in the deck.

## Files

**Create** (under `apps/dox/`): `src/pages/slides/index.astro`, `src/pages/slides/give-me-temporal/{index,presenter}.astro`;
`src/slides/decks.ts`; `src/slides/give-me-temporal/` (`Deck0.astro`, `wall.json`, `recorded/`,
`quotes/`); `src/components/slides/` (`Deck`, `Slide`, `Build`, `Notes`, `FilingCard`,
`GmtResult`, `LiveAnswer` `.astro`, `slides.css`, `slides-print.css`); `src/lib/slides/` (`deck`,
`deck-mount`, `keys`, `stage`, `places`, `presenter`, `sync`, `pace`, `readiness`, `filing`,
`gmt-call`, `live-chat`, `replay`, `deck-tools`, and `ice-wall/`), each with its test;
`src/lib/globe/globe-theme.ts`; `src/lib/space-sky.ts`; `public/slides/give-me-temporal/wall/*.webp`;
`scripts/slides-check.mjs`, `scripts/slides-built.test.ts`, `scripts/capture-wall.ts`,
`scripts/record-deck-answers.ts`; `src/data/zone-matrix.{json,ts}`,
`src/content/docs/compare/zone-matrix.mdx`, `src/components/ZoneMatrix.astro`. At the repo
root: `scripts/zone-matrix/` (`package.json`, `pnpm-workspace.yaml`, `README.md`, `run.mjs`,
`suites.mjs`, `pins.mjs`, `tags.mjs`, tests).

**Modify:** `src/lib/globe/{controller,engine,globe}.ts`, `src/lib/hero-space.ts`,
`src/widgets/builders/carousel.ts`, `src/lib/head-tags.ts`, `src/lib/webmcp/head.dist.test.ts`,
`src/lib/webmcp/offer.ts`, `scripts/gates/registry.mjs`, `scripts/globe-smoke.mjs`,
`scripts/deploy-smoke.mjs`, `astro.config.mjs` (sitemap filter), `src/data/library-comparison.ts`,
`src/lib/library-compare-tables.ts`, `src/lib/mdx-jsx.ts`, `src/content/docs/compare.mdx`,
`src/content/docs/migrate/{moment,luxon,date-fns,dayjs,internationalized-date,temporal}.mdx`,
`guides/integration/browser-agents.mdx`, `context/dox/built/*`,
`context/dox/reference/visual-design.md`. At the root: `.gitignore`, `.fallowrc.jsonc`,
`oxlint.config.mts`, `.github/renovate.json5`, `scripts/lib/affected.mjs` (the behaviour-matrix
skips, repeated for `scripts/zone-matrix/`).

## Kit pieces

**Carousel** (`wireCarousel`, APG Carousel) gains an opt-in `steps` hook so prev and next walk
builds first; **Dialog** (native `<dialog>`, APG Dialog Modal) for overview and help, in the
[Escape order](../../built/tier-2-platform.md#escape-one-order-for-the-whole-site); **Button**,
**textInput**, **badge**, the **readout** element and Starlight `<Code>`. The globe engine gains
`ambient: false`, `flyTo(…, { hop })`, `steer()` and `getView()`; WebMCP gains `offerPageTools`;
the sky code moves to `space-sky.ts`. Each helper has one home.

## Budgets

- First paint is server-rendered slide text on `--gmt-void`; gmt, globe, sky, wall, chat load after.
- Flights and the shatter: median frame ≤ 17.5 ms, none over 34 ms, at `maxDpr` 1.5; no frames at rest.
- Panels: opaque `--gmt-surface-widget`, `corner-shape: bevel`, full border, bottom-edge accent
  only; no `backdrop-filter`; no left-only stripe anywhere.
- Every byte the deck needs is preloaded on the deck page; only the chat calls the network after load.
- Each slide is a headed `section`; the live region says "Slide n of m: title"; canvases are
  `aria-hidden`; reduced motion makes flights and the shatter cuts and fades; text clears 7:1.

## Decided

- Time comes from gmt, dynamically imported; never `Date.now`, `performance.now` or `Intl`. Every
  tier stays droppable: delete `src/slides` and `src/pages/slides` and the site builds.
- Bug slides quote filings statically; only gmt runs; counts are derived. Network demos play a
  labelled recording when the live call fails or is slow; no service worker.
- Day.js stays in the wall, captioned, `clock: false`; the shards settle as clock pins.
- Zone matrix: nine suites (the six on `/compare`, both polyfills, GMT run locally in the same
  harness as the control), no Test262, no CI workflow; `/compare` gains the column "Fails in our
  zone matrix". Every figure carries version, commit, Node, zone, date and command.
- Merge waits on four inputs: the talk date and start time (Europe/Helsinki), the slide 2 agent
  transcript, the wall captures, and a committed zone-matrix run with GMT at zero (slice 5).

## Docs drift found while planning

`tracker.md` shows DOX-G2 (#447) as Todo though #461 merged it; `specs/index.md` lists `dox-g2`;
`visual-design.md` names three globe hosts. The finalizer folds this folder into `built/`.
