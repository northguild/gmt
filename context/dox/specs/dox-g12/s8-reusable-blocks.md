# Slice 8 · Reusable blocks for the next deck

[Index](./index.md) · Shell: [slice 1](./s1-deck-shell.md) · Stage: [slice 2](./s2-space-stage.md)
· Live agents: [slice 4b](./s4b-live-agents.md) · Zone matrix: [slice 4c](./s4c-zone-matrix.md)
· Binding rules: [built/index.md](../../built/index.md).

## Goal

A second deck is written by adding `src/slides/<slug>/` (its `.astro`, its data, its CSS and
`runtime.ts`), one row in `src/slides/decks.ts`, one in `src/slides/deck-runtime.ts` and one in
`src/slides/deck-pages.ts`. It copies
nothing from Deck 0 and edits nothing under `src/lib/slides/`, `src/components/slides/` or
`src/pages/slides/`. Paths are under `apps/dox/` unless they start with `scripts/`.

The slice changes no behaviour. Deck 0 looks, steps, animates and reads exactly as before. A real
defect found on the way is fixed here and named in the report.

## The building blocks

The catalogue of shared blocks, with each one's home and what a deck gets from it, is
[Slice 8b · The block catalogue](./s8b-block-catalogue.md).

## What the audit found, and the fix

### Authoring and styles

- `FilingCard.astro` and `FilingReport.astro` are dead: delete them.
- Generic components import Deck 0 (`WallFigures`, `NewMoonPanel`, the experiment slides,
  `TalkSchedule`, types from Deck 0's `content.ts`): move the deck-only ones to
  `src/slides/give-me-temporal/components/`, give the generic ones props, and move shared types to
  `src/components/slides/types.ts`.
- The bug-slide markup is pasted about seven times, and the tables are built by hand three times:
  use Visual, Swap and DeckTable, with the DOM unchanged.
- The spare slide's bundle table repeats `BundleSize.astro`, and the `thanks` slide repeats the
  GitHub icon: share the table and use `<Icon name="github">`.
- The two deck pages are about 90 lines of boilerplate with the slug written in: one `[slug]`
  route, with byte-equivalent output.
- `slides.css` is 2,102 lines, about 1,200 of them Deck 0: Deck 0's rules move next to the deck
  and its components. The panel declaration (pasted 8 times), the hand-written screen-reader-only
  rules (5), `.gmt-deck-step` (restates `.gmt-icon-button`) and the repeated text sizes each
  become one rule or token. Reduced-motion blocks that the site-wide rule already covers are dropped.

### Runtime and visuals

- The rAF loop is copied four times: use `play`.
- The reduced-motion check is repeated in four files: use `lib/reduced-motion.ts`, and use one
  test stub in `src/test/jsdom-shims.ts`.
- `stage.ts` is one 970-line closure: split it into the camera core and the reveal, lapse and
  filings features, and split its tests the same way.
- Deck 0 data lives in `lib/slides/` (lapses, named points, planet zones, the wall readiness row,
  the fly keys): move it into `DeckStageData` in `src/slides/give-me-temporal/stage-data.ts`.
  Build-time checks on place and lapse names read the deck's own stage data by slug, so a second
  deck needs no copy of them.
- The DST-jump and lazy-gmt-loading code is written two and three times: one helper each.
- `bug-visuals.ts` is an if/else switch: make it a registry.
- `DeckState` names two different types: the slide-number one becomes `DeckPosition`.
- The 24-hour crystal-clock dial has no caller: remove it, and restore the 12-hour widget as on
  `main`.
- Exports used only in their own file lose `export`.
- Modules past 400 lines split into a core and feature files: the stage, the ice wall, the earth
  clock, the deck mount, the presenter, the readiness checks, `DeckDox.tsx`, `slides-check.mjs`,
  the zone-matrix runner and the comparison tables.
- Each stage test file builds the same mocked stage by hand: one harness and one fixture deck in
  `src/test/`.

### Live agents and chat

- The agent quote, the agent table, the live panels and `DeckDox.tsx` hard-code Deck 0's question,
  zone, Node version, year, recordings and Easter tool question: move them into `DeckLiveData` in
  `src/slides/give-me-temporal/live-data.ts`.
- `LiveAnswer`, `AudienceQuestions` and `PageToolCall` are three near-identical wrappers that read
  the URL for `/presenter/`: fold them into one `DeckLive`, and take the presenter flag from the
  deck.
- `AudienceQuestions` passes `demoId="thanks"` on the `qa` slide: check whether this is a defect.
- `DoxChat` gained six props that only the deck uses: group them into one `host` object.
- The compact hive-chat rules in `gmt-hive.css` serve only the deck: move them to the deck's
  Dox sheet.

### Scripts and data

- `scripts/zone-matrix/probe/cases.json` (26,003 lines) is a cache rebuilt on every run: stop
  committing it, and write it to `scripts/zone-matrix/.work/`.
- `src/data/zone-matrix.json` lists 50 distinct ids 726 times and repeats each run's constants in
  every cell: give it a compact shape, and prove the reader's output is unchanged against a dump
  of the old file. Merge `summarise` and `summarize`.
- The two runners duplicate six helpers, and a third spawns Node itself: one `node-runner.mjs`.
- The CI zones are written out twice: read them from `ci.yml`.
- `agent-run.json` repeats each Node major's version and tzdata in every cell: one grid of
  `nodes` × `zones` with a value per cell, and the recorder stops when a major's version or tzdata
  changes between zones.
- The GNSS counter and line tables carry two near-identical sheets: one `gnss-table.module.css`.
- Every browser gate parses its own options and starts its own server: `scripts/lib/gate-cli.mjs`.
- `slides-check.mjs` repeats the secret scan and the spare checks from `slides-built.test.ts`,
  and `globe-smoke.mjs` repeats the camera and wall checks from `slides-check.mjs`: each check
  keeps one home. Fix the stale "23 slides" label.

## File ownership

The four phases run at the same time. Each file belongs to one phase. A change one phase needs in
another phase's file goes to the lead, who applies it once all four are done.

| Phase                         | Owns                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **B1** · authoring and styles | `src/components/slides/**` except B3's files; `src/slides/**` except the runtime, stage-data, live-data, `quotes/` and `recorded/`; `src/pages/slides/**`; `src/widgets/builders/{deck-controls,presenter}*`; `BundleSize.astro`, `Icon.astro`, `octicons.ts`, `gmt-primitives.css`                                                                                                                                                                                                                                 |
| **B2** · runtime and visuals  | `src/lib/slides/**` except B3's files; `lib/slides/stage-data.ts`; `give-me-temporal/stage-data.ts`; `frames.ts`, `reduced-motion.ts`; `src/test/jsdom-shims.ts` and new fixtures; the crystal clock; `lib/globe/**`, `space-sky.ts`, `hero-space.ts`                                                                                                                                                                                                                                                               |
| **B3** · live agents and chat | `AgentQuote`, `AgentTable`, `LiveAnswer`, `AudienceQuestions`, `PageToolCall`, `DeckDox.tsx` and its sheet; `lib/slides/{agent-quote,live-demos,page-tool-call,recorded-files,replay,recording-capture,deck-transport,deck-brain}`, `deck-tools/**`; `lib/slides/live-data.ts`, `give-me-temporal/live-data.ts`; `quotes/`, `recorded/`; `components/ask/**`, `chat-fetch.ts`, `webmcp/offer.ts`, `gmt-hive.css`; `src/test/{chat-stream,deck-events,dialog-fullscreen-shims}.ts`; `scripts/record-deck-answers.ts` |
| **B4** · scripts and data     | `scripts/zone-matrix/**`; `src/data/zone-matrix.*`, `zone-probe.*`; `scripts/{slides-check,globe-smoke,capture-wall}*`, `slides-built.test.ts`, `scripts/lib/{slides-check-helpers,wall-probe}.mjs`; the `.gitignore` zone-matrix entry                                                                                                                                                                                                                                                                             |
| **Lead**                      | `src/slides/deck-runtime.ts`, `give-me-temporal/runtime.ts`; the cross-phase edits (`Slide.astro` and `Build.astro` checks, `Deck0.astro` imports for `DeckLive` and the agent components, the `[data-quote]` sheet import); this spec folder                                                                                                                                                                                                                                                                       |

## Checked and kept

- `.gmt-deck-step` is a bordered square step button; `.gmt-icon-button` is a borderless padded
  icon. They are not the same rule.
- The ice wall (`lib/slides/ice-wall/wall.ts`) keeps its own frame loop: it runs until the shards
  settle, not over a fixed time, so `play` does not fit it.
- The earth clock keeps its own 24-hour face; the shared crystal clock is 12-hour.
- `page-tool-call.ts` runs the Moving Feasts tool only. The `tools` mode of `DeckLive` is the
  shared panel; a second deck with another page tool adds its tool there.
- `deck-brain.ts` keeps its own `localStorage` guard: the site has no shared safe-storage helper.
- `summarise` and `summarize` in `src/data/zone-matrix.ts` did different jobs, one suite and the
  whole record: the first is now `summariseSuite`, and `summarize` calls it per suite.
- `AudienceQuestions` passing `demoId="thanks"` on `qa` was a defect: `DeckLive` takes the slide
  id it sits on.
- `onReducedMotionChange` had no caller and is deleted.
- Each Dox slide's chat read Dox's counts on its own, so a question on one slide left the others
  showing the old count. `use-brains.ts` now holds one copy per page: every chat shows the same
  counts, and overlapping reads share one request. `globe-smoke` answers `/api/brains` itself,
  since the served `dist/` has no Worker.
- Folding the panel sizes into `--gmt-deck-text-sm`, `-md` and `-lg` defined each token as itself.
  That cycle voids every use, so the answer and familiar-names slides overflowed the stage.
  `css-validity.test.ts` now scans every sheet under `src/` for a custom property that reads
  itself.

## Left out of this slice

These are on the branch but are not part of the slide system. They are raised with the owner
rather than changed here:

- The widget CSS sweep from `overflow-wrap: anywhere` to `normal` in 20 module sheets, and the
  wording in `tier-0-1-site.md` that now contradicts it.
- The widget sweep from border colour to inset box-shadow in 22 places.
- The `packages/gmt` test-timeout fix.
- The commits that ride along on the branch without belonging to the deck.
- Running the zone-matrix `node:test` files in CI.
- The other 118 `cqi` values beyond the text-size tokens.

## Done when

- Every finding above is fixed or listed with a reason.
- `node .agents/skills/ui-standards/scripts/run.mjs` prints PASS; each `ui-standards-ok:` line says why
  its rule cannot apply.
- `pnpm dox:test`, `pnpm dox:lint` and `pnpm dox:check` pass across the whole app, and the
  zone-matrix `node:test` suite passes.
- After the one Dox build, run once at the end, `slides-check`, `globe-smoke`,
  `slides-built.test.ts` and `give-me-temporal/built.test.ts` pass against it.
- The spec files name the moved, renamed and deleted files, and this file lists the building
  blocks.
