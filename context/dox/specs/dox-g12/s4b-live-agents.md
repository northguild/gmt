# Slice 4b · Live agents: the deck's tools, a page-tool call, Dox chat on stage

Built in phase C of [slice 7](./s7-running-question.md#phases-and-file-ownership); phase B places
the three panels on their slides.

[Index](./index.md) · Binding rules: [Tier 2 · WebMCP](../../built/tier-2-webmcp.md#rules-a-new-or-edited-page-tool-must-still-obey),
[Tier 6 · Chat](../../built/tier-6-chat.md#request-pipeline-workerindexts-workerchat-handlerts),
[Tier 6 · Brains](../../built/tier-6-brains.md#brains-and-budget).

## Goal

Four demos, each with a committed fallback, so the talk never depends on the venue's network:

1. **Agent bookend.** `agent-answer` and `agents` show the owner's committed transcript: agents
   with no GMT answer the running question, and their code is run by script
   ([slice 7](./s7-running-question.md#the-agents-answer-run-by-script)). `ask-dox`
   sends the same question, word for word from `quotes/agent-answer.json`, to `POST /gmt/api/chat`
   live, in the real Dox chat, and the answer streams in with its gmt tool calls shown.
2. **The deck's own page tools.** Three read-only WebMCP tools an agent in the browser can call.
3. **A live page-tool call.** `page-tools` runs Moving Feasts' `compute_easter_dates` for 2027
   in the page, through the tool's own `execute`, and shows the call and both Easter Sundays in
   the Dox chat. No network.
4. **Audience questions.** The questions part takes questions typed by the presenter into the Dox chat, with three ready questions.

Every network call has a recording made by a script from a real answer. It plays when the live
call fails or gives no output in 8 s, labelled "Recorded <date>, <brain>". The presenter view
shows Live or Recorded ([slice 3](./s3-presenter.md)): each demo dispatches `gmt-demo` on the deck
root with a `DemoState` (`sync.ts`), and `deck-mount.ts` passes it to its `setDemo` seam (phase B).

## 1 · Deck tools: `src/lib/slides/deck-tools/`

`definePageTool` needs a Dox chat tool and its docs, which a deck has not, so the deck builds
`ModelContextToolInit` directly, under the same rules: names match the page-tool pattern and
stay within 48 characters; descriptions within 1,000 characters, free of the banned words,
backticks, `*` and `#`; `annotations: { readOnlyHint: true }`; a JSON Schema input with
`additionalProperties: false`; errors resolve as `{ error }` and never reject.

| Name | Input | Returns |
| --- | --- | --- |
| `list_deck_slides` | none | `{ deck, slides: [{ n, id, title, place, minutes, spare }] }`; a spare has `minutes: null` |
| `read_deck_slide` | `{ id }` (enum of slide ids) | the slide's title, text, build count and filing keys |
| `read_upstream_filing` | `{ key }` (enum of the deck's filing keys) | the filing record from `upstream-filings.ts` |

The tools run in the deck page, so `read_deck_slide` reads the slide's section from the DOM
(heading, text, `data-builds`, the filing keys on its cards); nothing re-parses `.astro` source.

- **Kit addition:** `offerPageTools(slug, load)` in `webmcp/offer.ts`, where `load` resolves to
  a list of tools; `offerPageTool` becomes its one-tool case. One marker, one slug, three tools.
  Each tool is registered with the page's abort signal.
  The deck's own script (`src/slides/give-me-temporal/Deck0.astro`) offers them on the deck page;
  the presenter page does not.
- **Head:** `deckWebmcpHeadEntries(slug, tokens)` in `src/lib/head-tags.ts` emits the
  `gmt-webmcp` marker (content `slides/give-me-temporal`) and the origin-trial metas for the deck
  page only; the presenter page gets none. `head.dist.test.ts` allows markers on `tools/<slug>`
  and on registry decks, and nowhere else.
- The reader guide `guides/integration/browser-agents.mdx` gains one sentence and a link: the
  deck exposes its slides and filings the same way.

## 2 · The live page-tool call: `src/lib/slides/page-tool-call.ts`

Imports the tool from `src/lib/webmcp/tools/moving-feasts.ts` and calls its own `execute` with the
year the deck names (`tool.year` in its `live-data.ts`; Deck 0 asks for 2027), the path an agent's
call takes. 2027 because Gregorian Easter, 28 March, is the day Helsinki's clocks go forward, the
running question's date. `answerText` turns
the answer into the chat's text: the year, both Easter Sundays and the days between them. The
panel is `DeckLive.astro` in `tools` mode: the Dox chat, which runs the call when the slide
shows, with no network. The presenter's copy gets a static placeholder, so no second chat mounts.

## 3 · The Dox frame: `DeckDox.tsx` and `src/lib/slides/deck-transport.ts`

The three Dox parts of the deck (`ask-dox`, the questions part and `page-tools`) are the real Dox
chat, not a copy: `DeckLive.astro` renders one `DeckDox` island for each, by `mode` (`answer`,
`audience`, `tools`), with the deck's `DeckLiveData` (`src/lib/slides/live-data.ts`: page context,
questions, recordings, the tool call) and its venue zone as props, so a second deck passes its own
data and writes no panel. Each island (`client:only="react"`), which composes `DoxChat`, `WidgetRail`,
`WidgetReceipt`/`MountedWidget` (through the rail), `useBrains` and `ChatErrorBoundary`. Message
rendering, the composer, the starter pills, the tool receipts, the brain line, the Dox mark and the
sounds are `/dox`'s own, so Dox looks and behaves on the slide as it does on the page. The
presenter view's copy of a slide gets a static placeholder, so it never mounts a second chat.

One optional prop carries the difference, `DoxChat.host` (`ChatHost`); without it `/dox` is as it
was:
- `host.createTransport(brain)`: builds the chat's transport in place of `/api/chat`'s.
- `host.typing` (default `true`): `false` leaves out the composer, for the tool slide.
- `host.modelAnswers` (default `true`): `false` drops the note that models get things wrong.
- `host.brainPick` and `host.brainControls` (default `true`): the host's brain pick, and
  whether the composer shows its own picker and reset clock.
- `WidgetRail.idle` and `WidgetRail.className`: what the rail holds when no widget is open, and an
  extra class for the deck's layout.

The deck's rules are one `ChatTransport` made by `createDeckSession`:
- A question typed in the composer goes live, to `POST /gmt/api/chat`, through `DefaultChatTransport`
  with the deck's page context and the picked brain.
- 8 s to the first output (text or tool chunks). Past it, or on an HTTP error, a refusal or a
  stream error before any output, the live request is aborted and the question's recording plays,
  labelled "Recorded <date>, <brain>". A late live chunk is dropped. Without a recording the
  failure reaches the chat as the error `/dox` shows. Once output has reached the chat, a later
  stream error is the chat's own, because a message already on screen cannot be taken back.
- The ready questions (the starter pills) play their recordings with no network and no typing.
  `data-usage` chunks are dropped from a recording so it never overwrites the brains budget.
- One request at a time: the chat refuses a second send while busy.
- Leaving the slide (`gmt-deck-state`) or the page aborts every request and replay and gives the
  chat a fresh session, so nothing stays running.
- The page-tool slide answers from the page: its `local` stream streams the call, the answer and
  the `showMovingFeasts` tool input, so the receipt and the Moving Feasts month grids open in the
  rail. No network.
- Each source change is announced as `gmt-demo` (`announceDemo`) for the presenter.

**Brain bar.** Every Dox frame, `page-tools` included, ends in one bar with `/dox`'s own
`ResetClock` and `BrainSelector`: the brain the live questions go to, the questions left today and
when they come back, so the presenter sees on any Dox slide whether to change brains. The
composer's own copies are left out (`host.brainControls`), so a frame has one picker. The pick
is the deck's one (`src/lib/slides/deck-brain.ts`, kept for the tab in `sessionStorage`), given to
each chat through `host.brainPick`: a brain picked on one Dox slide holds on the others and when
a slide's chat starts afresh. While `/gmt/api/brains` is being read the bar says so; when it cannot
be read (`useBrains`' `status`) the bar says the counts are unknown and recorded answers still play,
where `/dox` leaves the badge out.

Typing in the composer never steps the deck (`keys.ts` ignores text fields). Sound follows what
`/dox` does. `deck-dox.module.css` only sizes the frame to the stage, and `deck-dox-chat.css`, scoped
by `[data-deck-dox]`, holds the few chat rules the frame changes; the chat and rail keep their own
styles.

## 4 · Recordings: `scripts/record-deck-answers.ts` and `replay.ts`

- The script (run by hand with `--deck <slug>`, against production or `wrangler dev`) sends
  each prepared question, stores the raw UI-message chunks with their offsets in ms from the
  first byte, the brain and the instant (gmt `getUtcNow`), to `<id>.json` in the deck's
  `recordedDir` (`src/slides/give-me-temporal/recorded/` for Deck 0). The questions come from the
  deck's `live-data.ts`, the same list the slides read. It reads `DOX_DEV_KEY` from the environment
  and sends it only as the `dox_dev` cookie it gets back from `/gmt/api/brains?key=`; the key is
  never written to a file.
- Recordings: `ask-dox` (the running question) and three prepared audience questions; the owner
  picks the three.
- `replay.ts` turns a recording back into a `ReadableStream` of the same chunks at the same
  offsets, fed to the same reader, so live and recorded render through one path. The label reads
  "Recorded" with the date (gmt `formatZonedDateTime`, in the deck's venue zone, `DeckEntry.zone`)
  and the brain.
- A test checks each recording parses as UI-message chunks and has a brain and an instant.

## 5 · Audience questions (the questions part)

`DeckLive.astro` in `audience` mode is the same Dox frame. The composer is the real one:
the room's typed question goes live. The three prepared questions are starter pills in the rail
that play their recordings with no network. On a failed live answer with no recording, the chat
shows `/dox`'s own error and the pills stay available.

## Quota and secrets

- The burst limit (20 a minute per isolate) and the visitor cap (5 a day) apply on stage. The
  venue laptop visits `/gmt/api/brains?key=<secret>` beforehand, which sets the HttpOnly
  `dox_dev` cookie and exempts it from the daily cap; the shared brain pool is not raised. The
  secret never appears in the deck, its bundle or any committed file.
- The presenter's readiness check reads `/gmt/api/brains`: `unlimited: true` confirms the cookie,
  and the brains' `remaining` shows the pool. Workers AI's allowance resets at 00:00 UTC and
  Gemini's at midnight Pacific; the runbook says which applies to the talk's time.
- `astro preview` has no Worker: the chat demos play their recordings there, which is also how the
  gates test them.

## Tests

All in the `isolated` Vitest project. `fetch` is stubbed with `vi.stubGlobal` and restored with
`vi.unstubAllGlobals()` in `afterEach`; each test aborts its session and unmounts in `afterEach`,
even after a failed assertion. Fake timers drive the 8 s budget and the replay offsets
(`vi.advanceTimersByTimeAsync`), and `vi.getTimerCount()` is 0 at the end.
- `deck-tools.test.ts`: names and descriptions obey the rules (reuse the page-tool rule
  helpers), schemas reject extra keys, unknown ids resolve to `{ error }`, `readOnlyHint` set.
- `offer.test.ts` extended: `offerPageTools` registers each tool once per document.
- `page-tool-call.test.ts`: the call returns `def`'s own example result shape; aborting stops it.
- `deck-transport.test.ts`: a ready question plays its recording with no fetch and no usage chunks;
  a typed question goes live with the page context and brain; a 429, a refusal, an unreachable
  network and a stall past 8 s each play the recording; a late live chunk is dropped; with no
  recording the error reaches the chat; abort (the request, a replay, the chat's own signal) leaves
  no timers; the `local` stream; `reconnectToStream` resolves `null`.
- `DeckDox.render.test.tsx`: a starter pill plays its recording with no `/api/chat` call and shows
  the "Recorded" line; the pills and composer are offered; a typed question reaches the network;
  leaving the slide aborts the request and clears the chat; the brain bar shows the brain and the
  questions left in each mode with one picker per frame, says so when the counts cannot be read,
  and a pick holds after the chat starts afresh and reaches the request as `model`.
- `deck-brain.test.ts`: one change notice per new pick, kept in `sessionStorage`, and shared in the
  page when storage is refused.
- `DoxChat.transport.test.tsx`: a given transport is used and `/api/chat` is not; the rail shows the
  examples by default and `idle` when given. `/dox`'s own tests stay unchanged.
- `replay.test.ts`: chunks arrive in order at their offsets; abort stops the stream.
- `slides-check.mjs` (phase B adds these): on the built site, `ask-dox` and the questions part play
  recordings and show "Recorded"; `page-tools` shows both Easter dates and the receipt; the deck
  page registers three tools with a stub `navigator.modelContext`.

## Definition of done

- On production with the cookie set, the Dox slides answer live and the presenter shows Live; with
  the network cut, every demo plays its recording, labelled, and the presenter shows Recorded.
- No secret in `dist/` or the committed recordings: the gate greps both for `DOX_DEV_KEY` and,
  when the variable is set locally, its value.
- Own tests, `pnpm dox:lint` and `pnpm dox:check` green; the owner's listening pass.
