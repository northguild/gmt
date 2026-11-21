---
story: DOX-G12
issue: 548
status: approved
dox: none
---

# DOX-G12 · Slide decks and Deck 0, "Give Me Temporal"

A `/slides/` area that holds the site's talks, and its first deck: the HelsinkiJS talk "Give Me
Temporal", 22 minutes plus 5 of questions. The deck is a 16:9 stage in front of the landing's
space scene. Site work in `apps/dox`, plus a by-hand runner in `scripts/zone-matrix/`: no new
Dox tool or chat pill, and no `packages/gmt` change unless the zone-matrix control finds a GMT
bug, which is then fixed here through the library pipeline with a changeset.

## The spine: one clock against the whole planet

The date libraries people reach for show one clock as their site's visual: one local time. GMT
works across the whole planet at once, and the deck stages that contrast. The `date` table shows
the built-in answer with the venue's clock beside it: Date only knows the machine's clock. On
`one-clock` a wall of the five Date-based libraries' captured landing pages (Moment.js, Luxon, date-fns,
Day.js, Spacetime) hangs in a three-column grid in the left two thirds, with the clock in the right third;
each pane's caption carries that library's measured total of wrong answers from the four experiments. Stepping to the Temporal slide breaks the wall: the
panes shatter into ice and the shards fly off; as the last of them fade, the clock behind shatters
and the Earth comes up where it stood (same spot and size), and that slide's text enters once the shards are
clear. The wall's shards settle as clock pins with local times on the Earth, which
then spins slowly through the stand-ins slide and eases back to the held view before the bugs
([slice 2](./s2-space-stage.md)). On every slide the clock or the Earth sits in the right third and
never moves sideways; the content fits the left two thirds. Text waits for any motion that would
cross it, then enters; there is no wait under reduced motion, on a deep link, or without a globe.
The pins stand in the zones GMT's CI runs in ([slice 4c](./s4c-zone-matrix.md)).
The experiment slides come first, on the venue's clock, and put numbers on it: the same inputs go into every
library, and the standard gives the answer (`zone-probe.json`). The deck says a library is wrong with a
measured count, never an adjective. Right after the Earth comes up, `stand-ins` names the three libraries that
stand in for Temporal: `@internationalized/date` is a second API in its own classes with calendar faults
that our own probe measured (`intl-date-calendars.json`, [slice 4](./s4-deck-0.md)), and the two Temporal
polyfills still have bugs, counted from our filings. Then every slide is pinned to a place, and the camera
hops between them under the real sky, Sun and Moon. A contrast of viewpoint, never a verdict: no
text judges a library, and their marks appear only inside the captioned snapshots.

**One running question** ties the talk together: "03:30 on 28 March 2027 in Helsinki", a time
that never happens there, because the clocks skip from 03:00 to 04:00. It opens on `agent-answer` as
the question the owner put to agents without GMT; each agent's code is run by script, the room
guesses what the quoted one returns before the deck shows it, and `agents` lists what every one
returned. `gmt` answers the same question with
`resolveLocal(…, { disambiguation: "reject" })`, and `ask-dox` closes it live with an agent that
has GMT. Each bug slide ends on a "GMT:" step that shows what GMT does with the same input, or
says plainly that GMT has no workaround, read from the filing's own data.

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
([pipeline](../../../../.agents/skills/pipeline/SKILL.md)). Slices 1 to 4, 4c and 6 are built
except the Moon step; [slice 7](./s7-running-question.md) splits the remaining work into builder
phases with disjoint file ownership.

| # | Slice | What the reader sees |
| --- | --- | --- |
| 1 | [Deck shell](./s1-deck-shell.md) | A 16:9 stage stepped by keyboard or clicker; overview, help, blank, fullscreen; an article without JS; one slide a page in print |
| 2 | [Space stage](./s2-space-stage.md) | The Earth and real sky behind every slide; hop flights between places; WASD free flight; the route as arcs; the Moon pull-back |
| 2b | [Ice wall](./s2b-ice-wall.md) | Captured library pages with their clocks hang in orbit; flying through shatters them into ice; shards become clock pins with local times |
| 3 | [Presenter view](./s3-presenter.md) | Notes, next slide, elapsed against plan, pace, live-or-recorded state, readiness check |
| 4 | [Deck 0 content](./s4-deck-0.md) | The 29 slides and the spare (ids, notes, framing); bug cards read from the filings; build-time gmt results |
| 4b | [Live agents](./s4b-live-agents.md) | The deck's own page tools; a live page-tool call; Dox chat answering on stage, with recorded fallbacks |
| 4c | [Zone matrix](./s4c-zone-matrix.md) | Library suites run under GMT's CI zones; a Compare page, a `/compare` column, Migrate lines |
| 5 | [Close-out](./s5-close-out.md) | Full gates, the venue runbook, `built/` updated |
| 6 | [Time, not the camera](./s6-time-not-camera.md) | One held view through the bugs; time-lapses; a visual per bug; filings as pins; the clocks return; the new moon over Shanghai |
| 7 | [The running question](./s7-running-question.md) | The agents' code run by script; the guess; a GMT step per bug; `familiar`; QR codes; spare slides; the builder phases |
| 8 | [Reusable blocks](./s8-reusable-blocks.md) | Nothing new: the next deck is a folder plus a row in `decks.ts`, `deck-runtime.ts` and `deck-pages.ts`, built from shared components, one animation loop and per-deck data |
| 8b | [The block catalogue](./s8b-block-catalogue.md) | Each shared block's home and what a deck gets from it |

## Deck 0 outline (22 minutes)

| # | id | Slide | Place | Min |
| --- | --- | --- | --- | --- |
| 1 | `title` | Give Me Temporal; the venue's time now | Helsinki | 0.5 |
| 2 | `agent-answer` | Ask an agent: the running question; the quoted agent's code; guess; what it returns, and that the time never happens | Helsinki (plain clock) | 0.75 |
| 3 | `agents` | What the agents returned: one row per agent asked | Helsinki (plain clock) | 0.25 |
| 4 | `moment` | Agents learned from Moment: the maintainers' 2020 and 2026 words, verbatim; Moment's npm downloads per year (`moment-downloads.json`); the closing line | Helsinki (plain clock) | 0.75 |
| 5 | `date` | `Date` only knows this machine: the agents' question as the first row, then the two home-page rows from `date-faults.ts` no other slide shows | Helsinki (plain clock) | 0.5 |
| 6 | `kinds` | `Date` takes anything: one `nextDay` over `Date`, called with six kinds of time, in five zones (`RunGrid`); then GMT's `addDate` | Helsinki (plain clock) | 0.5 |
| 7 | `experiments` | The same inputs into every library, answers from the standard; counts from `zone-probe.json` | Helsinki (plain clock) | 0.5 |
| 8 | `experiment-gaps` | A time the clocks skip: the question and the bars | Helsinki (plain clock) | 1 |
| 9 | `experiment-overlaps` | A time that happens twice | Helsinki (plain clock) | 0.75 |
| 10 | `experiment-host` | The same input on machines set to different zones | Helsinki (plain clock) | 0.75 |
| 11 | `experiment-odd` | Apia's missing day, Lord Howe's half hour, Kathmandu's +05:45 | Helsinki (plain clock) | 0.75 |
| 12 | `one-clock` | The web shows one clock: the ice wall of the five Date-based libraries, each with its measured wrong count | `wall` | 0.25 |
| 13 | `temporal` | The wall breaks, then the clock shatters into the Earth in place; its text enters once the shards clear; what Temporal is, with no bug counts and no GMT | `planet` | 1 |
| 14 | `stand-ins` | Until Temporal is everywhere: `@internationalized/date` (its own classes; Persian, Japanese and Chinese faults from our probe), `temporal-polyfill` and `@js-temporal/polyfill` (reports and fixes from our filings); all three pass the four zone experiments | `planet` | 0.75 |
| 15 | `abort` | `nodejs/node#67076` with `CLDR-19873`; then GMT | `planet`, lapse | 1.25 |
| 16 | `years` | `ICU-23609`, `fullcalendar/temporal-polyfill#127`; `ICU-23619`; then GMT | `planet`, lapses | 1.25 |
| 17 | `day-off` | `ICU-23627`; `fullcalendar/temporal-polyfill#128`; the new moon over Shanghai; then GMT | `planet`, lapses, the Moon | 1.25 |
| 18 | `manila` | `tc39/proposal-temporal#3330` and siblings: Manila skips 1844-12-31; then GMT | `planet`, lapse | 1.25 |
| 19 | `engines` | `nodejs/node#67457`: engines disagree on `until()` and `round()`; then GMT | `planet`, sun | 1 |
| 20 | `scoreboard` | Every filing as pins, by tracker and state | Overview | 0.5 |
| 21 | `why-not-temporal` | Why not just Temporal? Three things it leaves to the caller | Greenwich | 0.75 |
| 22 | `gmt` | The running question answered by GMT; the clock skips 02:59 to 04:00 | Greenwich | 1 |
| 23 | `familiar` | Names you already know: Moment, date-fns and Day.js call shapes beside the GMT call | Greenwich | 1 |
| 24 | `guards` | Tested guards and the canary, in one paragraph | Greenwich | 0.5 |
| 25 | `lint` | Lint that bans Date: the three lint packages, then each rule and what it bans | Greenwich | 0.5 |
| 26 | `ask-dox` | The running question, live to Dox chat, tool calls visible | Helsinki | 1.5 |
| 27 | `page-tools` | A live page-tool call, and this deck's own tools | Helsinki | 1.25 |
| 28 | `qa` | Questions; the audience panel; questions through Dox chat or aloud | Helsinki | 5 |
| 29 | `thanks` | Thanks; two QR codes; the links | Helsinki | 0 |
| spare | `spare-size` | How big is it? | Greenwich | none |

The main slides' minutes sum to 27 (22 for the talk, 5 for `qa`); a built-output test holds it, and every value is a multiple of
0.25, so the float sum is exact. The spare comes after
`thanks`, carries no minutes, is left out of the pace plan and is reached only by a jump (the
overview, a deep link, or a link in `qa`'s notes); Next never lands on it and Next from it
returns to `qa` ([slice 7](./s7-running-question.md#spare-slides)). The full
zone-matrix results live on `/compare/zone-matrix/`, not in the deck.

## Files

Each slice names the files it creates and modifies; [slice 7](./s7-running-question.md#phases-and-file-ownership)
assigns every file the remaining work touches to exactly one builder phase. Outside `apps/dox`
the story touches only `scripts/zone-matrix/` (the by-hand runners) and the root config named in
[slice 4c](./s4c-zone-matrix.md).

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
- Bug slides quote filings statically; only gmt runs; counts are derived. A figure on a slide
  comes from its filing or from a cited primary source record (the USNO new moon). Network demos
  play a labelled recording when the live call fails or is slow; no service worker.
- No agent's answer is typed onto a slide: each returned value comes from running the
  committed code by script ([slice 7](./s7-running-question.md#the-agents-answer-run-by-script)).
- Day.js stays in the wall, captioned, `clock: false`; the shards settle as clock pins. Library
  names appear only in the wall's captions and as the labels of code shapes on `familiar`.
- Zone matrix: nine suites (the six on `/compare`, both polyfills, GMT run locally in the same
  harness as the control), no Test262, no CI workflow; `/compare` gains the column "Fails in our
  zone matrix". Every figure carries version, commit, Node, zone, date and command.
- The talk starts 2026-12-16 18:00 Europe/Helsinki (`decks.ts`). The merge waits on the owner's
  inputs listed in [slice 5](./s5-close-out.md#the-merge-waits-on-the-owners-inputs).

## Docs drift found while planning

`tracker.md` shows DOX-G2 (#447) as Todo though #461 merged it, and has no DOX-G12 row yet;
`specs/index.md` lists `dox-g2`. `ICU-23627` and `WebKit 331726` carry a `gmtNote` that says
GMT has no workaround, yet `gmtBadge` (`src/lib/upstream-badges.ts`) labels every filing with a
note "Not affected" ([slice 7](./s7-running-question.md#the-gmt-step-on-each-bug-slide) fixes it).
The finalizer folds this folder into `built/`.
