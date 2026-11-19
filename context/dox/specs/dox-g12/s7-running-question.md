# Slice 7 · The running question, the GMT steps, the spares

[Index](./index.md) · Content per slide: [slice 4](./s4-deck-0.md) · Moon: [slice 6](./s6-time-not-camera.md#the-new-moon-over-shanghai)
· Live demos: [slice 4b](./s4b-live-agents.md) · Binding rules: [built/index.md](../../built/index.md).

## Phases and file ownership

Each file belongs to exactly one phase. Paths are under `apps/dox/` unless they start with `scripts/`.

| Phase | Starts | Owns |
| --- | --- | --- |
| **R** · agent run, familiar data | now | `scripts/zone-matrix/agent-answer.mjs`, `agent-answer.test.mjs`, `familiar.test.mjs`, `README.md` (its section); `src/slides/give-me-temporal/quotes/` (`agent-answer.json` replaces `agent-moment.json`; `agent-run.json`); `src/slides/give-me-temporal/familiar.json`; `src/lib/slides/agent-quote.ts` + test; `src/components/slides/{AgentQuote,AgentTable}.astro` |
| **U** · upstream data | now | `scripts/upstream.mjs`, `scripts/lib/upstream-trackers.mjs`, `src/data/upstream-filings.{json,ts,test.ts}`, `src/lib/upstream-badges.{ts,test.ts}` |
| **C** · live agents ([4b](./s4b-live-agents.md)) | now | `src/lib/slides/{deck-tools/,page-tool-call,deck-transport,replay}.ts` + tests; `src/components/slides/DeckLive.astro`, `DeckDox.tsx`, `deck-dox.module.css` and `deck-dox-chat.css`; `src/lib/slides/live-data.ts`, `src/slides/give-me-temporal/{live-data,recorded}.ts`; `src/lib/webmcp/offer.ts`, `src/lib/head-tags.ts`, `src/lib/webmcp/head.dist.test.ts`; `src/slides/give-me-temporal/Deck0.astro`'s script; `scripts/record-deck-answers.ts`; `src/slides/give-me-temporal/recorded/`; `guides/integration/browser-agents.mdx` |
| **A** · Moon and sky ([6](./s6-time-not-camera.md#the-new-moon-over-shanghai)) | after the spin and view-transition builder | `src/lib/space-sky.ts`, `src/lib/slides/{stage,places,time-lapse}.ts` + tests, `src/slides/give-me-temporal/{content.ts,content.test.ts,new-moon.json}`, `src/slides/give-me-temporal/components/NewMoonPanel.astro`; in `Deck0.astro` only `day-off`'s build 2 and its notes |
| **B** · deck structure | after A, R, U and C | the rest of `Deck0.astro`; `src/components/slides/{Slide,GmtStep,FamiliarPair,QrCode}.astro`, `slides.css`, `slides-print.css`; `src/slides/give-me-temporal/components/{ExperimentSlide.astro,experiment-slide.css}`; `src/lib/slides/{deck,deck-mount,bug-visuals,qr}.ts` + tests; `src/widgets/builders/deck-controls.ts` + test; `scripts/slides-built.test.ts`, `src/slides/give-me-temporal/built.test.ts`, `scripts/slides-check.mjs`; `apps/dox/package.json` and `pnpm-lock.yaml` (`lean-qr`); `presenter.ts` if the spares need it |

R, U and C share no file with the builder now changing `stage.ts`, `deck-mount.ts` and `slides.css`
(the Earth's slow spin and the view transitions, [slice 2](./s2-space-stage.md)), so they run
beside it. A waits for it because it edits `stage.ts`. B places A's panel, R's quote and C's
three components, and runs every browser check on the assembled deck. C announces its demo
state by dispatching `gmt-demo` (detail: `DemoState` from `sync.ts`) on the deck root; B makes
`deck-mount.ts` call its `setDemo` seam on that event, so C never edits `deck-mount.ts`.

## The agent's answer, run by script

The owner asks agents with no GMT, word for word: "Write a JavaScript function that sets a
reminder for 03:30 on 28 March 2027, Helsinki time, and returns the time as a UTC ISO string."
The transcript, `quotes/agent-answer.json`, holds the shared `question`, `quoted` (the id of the
answer `agent-answer` quotes) and `answers`, one per agent asked: `id`, `model`, `date`, `answer`
(the prose), `code` (the module as written), `call` (the expression that calls it, for example
`setReminder()`), and optional `excerpt` (line ranges the slide shows when the code is long).
It holds four: ChatGPT and Mistral in their fast modes, ChatGPT Think and Gemini on auto; the
deck quotes Mistral's.

`scripts/zone-matrix/agent-answer.mjs` (run by hand: `cd scripts/zone-matrix && fnm exec
--using=26 -- node agent-answer.mjs`) reuses the zone-matrix harness and its pinned `node_modules`:
- Reads the transcript; stops with exit 2 and the file path when any field of any answer is
  empty. Every answer below runs in turn.
- Finds every `import`/`require` specifier in `code`, maps each to its package name and stops with
  exit 2 naming the package when it is not pinned in `scripts/zone-matrix/package.json`, with the
  command that pins it exactly. Any library the agent picks can be added that way.
- Writes the code and a runner to `scripts/zone-matrix/.work/agent-answer/` (ignored), as ESM or
  CJS as the code needs, and runs `call` on every zone and Node major of the `gmt-matrix` job
  (`readMatrix`, `onNode` with `TZ`, the probe's pattern). A promise is awaited; a throw is
  recorded as `{ threw: "<name>: <message>" }`.
- Writes `quotes/agent-run.json`, one record per answer id: `sha256` of `code` + `call`, the
  command, the instant (gmt `getUtcNow`), the library versions (`versionOf`), and per run
  `{ node, tzdata, zone, value }`. The runs include `Europe/Helsinki`, the zone the slides show,
  whatever the CI matrix lists.

The deck reads both through `agent-quote.ts`: an answer is `ready` only when every transcript
field is set, its record exists, its hash matches and it holds the run on Node 26 at
`TZ=Europe/Helsinki`. Otherwise its panel or row shows a marked "transcript to come" or "run record
out of date", so the dev server keeps building, and `slides-check` fails naming the answer, the
file and the command. `quotedAnswer` gives `agent-answer` the quoted one; `agentAnswers` gives
`agents` every one, in file order. Each shows the value from Node 26 at `TZ=Europe/Helsinki` and
the number of distinct values across its runs.

## Guesses

Three plain pauses: the question shows, the answer comes on the next step, and the notes say
"Ask the room, take two or three answers, then step on." `agent-answer` build 1 (what does the code
return?); on `date`, the row whose input is `new Date("2025-03-30T01:30")`, found by input in
`dateFaults` (a missing row fails the build), with its result and reason in build 1; on
`experiment-gaps`, `ExperimentSlide`'s new `guess` prop moves the bars, example and foot into
build 1. Hidden answers keep their space, so nothing moves when they appear.

## The GMT step on each bug slide

`GmtStep.astro` is the last build of `abort`, `years`, `day-off`, `manila` and `engines`. Props:
`filings` (keys) and an optional `call` (`module`, `name`, `args`) rendered like `GmtResult`.
For each filing it shows the guard (`gmtGuard`, with that compat group's probe and failing
counts from `temporal-compat.ts`) or the `gmtNote` as written through `inlineCodeHtml`. A
filing U marks `gmtUnguarded` reads "GMT has no workaround", never a check mark. The step ends
with a provenance line: gmt's version and the build's Node and ICU (`process.versions`). The
calls and filings per slide are in [slice 4](./s4-deck-0.md#slides).

**Phase U:** a hand-written `gmtUnguarded: true`, allowed only with `gmtNote`, set on
`ICU-23627` and `WebKit 331726`; `scripts/upstream.mjs check` accepts it; `gmtBadge` returns
"No GMT workaround" (neutral, no check icon) for it. Tests in `upstream-badges.test.ts` and
`upstream-filings.test.ts`.

## Familiar

`FamiliarPair.astro` renders each entry of `familiar.json`: the job in words, the Moment, date-fns
and Day.js shapes as code text (no results), and the GMT call through `GmtResult`. R's
`familiar.test.mjs` runs each shape against the libraries pinned in the harness and asserts it
does not throw, so no shape on stage is wrong.

## QR codes

`lean-qr` 2.7.4 (MIT, no dependencies, 68.8 kB unpacked, published 2026-09-07) is an exact
dependency of `apps/dox`. `qr.ts` exports `qrModel(url)`: `generate(url, { minCorrectionLevel:
correction.H, maxVersion: 6 })`, split into the data modules (one path), the three finder
patterns (bevelled octagons) and an odd square hole of about 30 % of the side in the middle.
Version 7 and up would put an alignment pattern in the hole, so `lean-qr` throws at build time
instead. `QrCode.astro` takes `logo: "linkedin" | "northguild"` and draws the LinkedIn logo (Simple
Icons, CC0) or the NorthGuild shield (`ng-mark.ts`) in the hole. The `<svg>` has `role="img"` and an
`aria-label`, and the label and the URL show as text. The code takes the deck's colours: ice
modules and cyan eyes and logo on the opaque surface plate, with a bevelled border and a faint
cyan glow (light on dark is a reflectance reversal ISO/IEC 18004 allows). Forced colours map it to
`CanvasText` on `Canvas`. The quiet zone is four modules. Each code is at least 30 % of the stage
height: the LinkedIn code is version 5, 37 modules plus the quiet zone, so at 1280×720 a module
gets about 4.8 px; both codes decode at half that size.

## Spare slides

`Slide` gains `spare`; a spare with `minutes`, or a main slide without, throws at build. Spares
render `data-spare` and no `data-minutes`. A `qa` slide ("Q&D: Questions and Dox", with the audience panel) comes
right before `thanks`, and `thanks` is the last main slide. In `deck.ts`, End and `last()` go to
`thanks`, Next from `thanks` goes nowhere, and Next never lands on a spare: a spare is reached by
a jump (the slide list, a deep link, or a link in `qa`'s notes), and Next from a spare returns to
`qa`. The live region says "Slide n of 25: title" or "Spare n of 1: title". The overview gets a second list, "Spare slides, for questions"; spare dots carry
`data-spare` with a gap before them. The pace plan stays at 25 minutes (20 for the talk, 5 for `qa`) on a spare, and print puts
the spare after `thanks`.

## Tests and checks

Every phase: its own tests (`pnpm dox:test -- <files>`, or `node --test` in
`scripts/zone-matrix/`), `pnpm dox:lint` (new tests follow `lint/dox-test-rules.mjs`: find by
role, label and text; no `dispatchEvent`, class or `data-` selectors, markup reads or style
asserts; nothing added to `legacy-test-files.mjs`) and `pnpm dox:check`. Every mount a test starts
is aborted or destroyed in `afterEach`; fake timers, `vi.getTimerCount()` 0 at the end.
- **R:** the runner on fixture transcripts (empty field, unpinned package, CJS, ESM, async,
  throw, several answers) without spawning Node for every zone (inject `onNode`);
  `agent-quote.test.ts` for ready, empty, missing record, stale hash, the quoted answer and an
  answer whose record is missing; `familiar.test.mjs`.
- **U:** the badge and check rules above.
- **B:** `src/slides/give-me-temporal/built.test.ts`: the outline of 25 ids then the spare,
  each bug slide's last build holds a GMT step, `thanks` has two QR images with names.
  `scripts/slides-built.test.ts`: main minutes sum to 25, spares have no `data-minutes`.
  `slides-check.mjs`: `qa` holds the audience panel. `deck.test.ts` (End, Next on `thanks`, Next from a spare), `deck-controls.test.ts` (two
  lists), `qr.test.ts` (deterministic, `viewBox` is modules + 8). `slides-check.mjs` adds the
  transcript gate, C's checks ([4b](./s4b-live-agents.md#tests)) and A's Moon check.

## Browser checks

On the owner's dev server, `http://localhost:4401/gmt/slides/give-me-temporal/`, never
restarted (an agent's own server uses a port from 4410 to 4450), at 1440×900, 1280×720 and
1920×1080: step every slide and build of the phase; nothing overflows the left two thirds; a
revealed answer moves nothing (bounding boxes before and after); the GMT steps and the QR codes
fit; the Moon step lands with the Shanghai pin in view. B also walks the spare and the overview,
and scans both QR codes with a phone from 3 m off a 1280×720 screen.

## Definition of done

- The deck plays end to end in 25 minutes (20 and 5 for questions) on the presenter timer, the spare after `thanks`.
- No value on a slide is typed by hand: each comes from gmt, the filings, the compat data, the run
  record or a cited source record.
- Own tests, `pnpm dox:lint`, `pnpm dox:check` green per phase; the owner's listening pass per
  phase. Full gates and `dox-tester` once, in [slice 5](./s5-close-out.md).
