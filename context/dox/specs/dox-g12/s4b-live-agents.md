# Slice 4b · Live agents: the deck's tools, a page-tool call, Dox chat on stage

[Index](./index.md) · Binding rules: [Tier 2 · WebMCP](../../built/tier-2-webmcp.md#rules-a-new-or-edited-page-tool-must-still-obey),
[Tier 6 · Chat](../../built/tier-6-chat.md#request-pipeline-workerindexts-workerchat-handlerts),
[Tier 6 · Brains](../../built/tier-6-brains.md#brains-and-budget).

## Goal

Four demos, each with a committed fallback, so the talk never depends on the venue's network:

1. **Agent bookend.** Slide 2 quotes a real agent answer that reaches for Moment.js (the owner's
   transcript, committed). Slide 14 sends the same question to `POST /gmt/api/chat` live, and
   the answer streams in with its gmt tool calls shown.
2. **The deck's own page tools.** Three read-only WebMCP tools an agent in the browser can call.
3. **A live page-tool call.** Slide 15 runs the Cut-off Ruler's `check_eta_against_cutoff`
   in the page, through the same facts function the tool uses, and shows the JSON call and
   answer. No network.
4. **Audience questions.** Slide 16 takes questions typed by the presenter into Dox chat.

Every network call has a recording made by a script from a real answer. It plays when the live
call fails or gives no output in 8 s, labelled "Recorded <date>, <brain>". The presenter view
shows Live or Recorded ([slice 3](./s3-presenter.md)).

## 1 · Deck tools: `src/lib/slides/deck-tools/`

`definePageTool` needs a Dox chat tool and its docs, which a deck has not, so the deck builds
`ModelContextToolInit` directly, under the same rules: names match the page-tool pattern and
stay within 48 characters; descriptions within 1,000 characters, free of the banned words,
backticks, `*` and `#`; `annotations: { readOnlyHint: true }`; a JSON Schema input with
`additionalProperties: false`; errors resolve as `{ error }` and never reject.

| Name | Input | Returns |
| --- | --- | --- |
| `list_deck_slides` | none | `{ deck, slides: [{ n, id, title, place, minutes }] }` from the registry |
| `read_deck_slide` | `{ id }` (enum of slide ids) | the slide's title, text, build count and filing keys |
| `read_upstream_filing` | `{ key }` (enum of the deck's filing keys) | the filing record from `upstream-filings.ts` |

The tools run in the deck page, so `read_deck_slide` reads the slide's section from the DOM
(heading, text, `data-builds`, the filing keys on its cards); nothing re-parses `.astro` source.

- **Kit addition:** `offerPageTools(slug, load)` in `webmcp/offer.ts`, where `load` resolves to
  a list of tools; `offerPageTool` becomes its one-tool case. One marker, one slug, three tools.
  Each tool is registered with the page's abort signal.
- **Head:** `deckWebmcpHeadEntries(slug, tokens)` in `src/lib/head-tags.ts` emits the
  `gmt-webmcp` marker (content `slides/give-me-temporal`) and the origin-trial metas for the deck
  page only; the presenter page gets none. `head.dist.test.ts` allows markers on `tools/<slug>`
  and on registry decks, and nowhere else.
- The reader guide `guides/integration/browser-agents.mdx` gains one sentence and a link: the
  deck exposes its slides and filings the same way.

## 2 · The live page-tool call: `src/lib/slides/page-tool-call.ts`

Imports `def` from `src/lib/webmcp/tools/cutoff-ruler.ts` and calls `def.run(def.example,
signal)`, the path an agent's call takes. The slide shows two panels: the call as JSON (name and
`def.example`) and the answer as JSON, both in Starlight `<Code>` style blocks built with
`textContent`. The chunk is preloaded on the deck page; the call runs on the build step that
reveals it. A slide-14 agent may call it too; slide 15 needs no network either way.

## 3 · Live chat: `src/lib/slides/live-chat.ts`

Plain DOM, no React (React stays inside `/dox`). `ai`'s `DefaultChatTransport` with
`api: "/gmt/api/chat"` and `prepareSendMessagesRequest` returning `{ messages, pageContext:
"/slides/give-me-temporal/" }`; the stream is read with `readUIMessageStream`.
- **Rendering** into a `LiveAnswer.astro` panel: text parts as text nodes, fenced code as
  `<pre><code>` (no `innerHTML`, no Markdown library); each tool part as a row with its name and
  input JSON, then its output when it arrives; the brain from the retrieval trace part
  (`RETRIEVAL_PART_ID`) as a `badge`. `data-status` updates a status line; `data-usage` is
  ignored; `data-refusal` shows its text as a refusal and counts as a failure for the fallback.
- **Budget:** 8 s to first output, measured on the gmt clock; past it, or on an HTTP error or
  refusal, the live request is aborted and the recording plays in its place, with the label.
  A late live answer is dropped, never mixed in.
- **One request at a time;** a second press while one runs is ignored. Leaving the slide aborts.

## 4 · Recordings: `scripts/record-deck-answers.ts` and `replay.ts`

- The script (run by hand with Node's type stripping, against production or `wrangler dev`) sends
  each prepared question, stores the raw UI-message chunks with their offsets in ms from the
  first byte, the brain and the instant (gmt `getUtcNow`), to
  `src/slides/give-me-temporal/recorded/<id>.json`. It reads `DOX_DEV_KEY` from the environment
  and sends it only as the `dox_dev` cookie it gets back from `/gmt/api/brains?key=`; the key is
  never written to a file.
- Recordings: `ask-dox` (the slide 2 question) and three prepared audience questions.
- `replay.ts` turns a recording back into a `ReadableStream` of the same chunks at the same
  offsets, fed to the same reader, so live and recorded render through one path. The label reads
  "Recorded" with the date (gmt `formatZonedDateTime`, `Europe/Helsinki`) and the brain.
- A test checks each recording parses as UI-message chunks and has a brain and an instant.

## 5 · Audience questions (slide 20)

A kit `textInput` and a Send `button` under the slide's thanks text; Enter sends. Live only:
on failure the panel says so in plain words and offers the three prepared questions as buttons
that play their recordings. Keys typed in the field never step the deck (slice 1's key rules).

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
`vi.unstubAllGlobals()` in `afterEach`; each test aborts its controller and the panel is
destroyed in `afterEach`, even after a failed assertion. Fake timers drive the 8 s budget and
the replay offsets (`vi.advanceTimersByTimeAsync`), and `vi.getTimerCount()` is 0 at the end.
- `deck-tools.test.ts`: names and descriptions obey the rules (reuse the page-tool rule
  helpers), schemas reject extra keys, unknown ids resolve to `{ error }`, `readOnlyHint` set.
- `offer.test.ts` extended: `offerPageTools` registers each tool once per document.
- `page-tool-call.test.ts`: the call returns `def`'s own example result shape; aborting stops it.
- `live-chat.test.ts`: streamed text and tool parts render as text nodes; a refusal, an HTTP 429,
  a stall past 8 s and a network error each switch to the recording with the label; a late live
  chunk after the switch is dropped.
- `replay.test.ts`: chunks arrive in order at their offsets; abort stops the stream.
- `slides-check.mjs`: on the built site, slide 14 and 16 play recordings and show "Recorded";
  slide 15 shows both JSON panels; the deck page registers three tools with a stub
  `navigator.modelContext`.

## Definition of done

- On production with the cookie set, slides 14 to 16 answer live and the presenter shows Live; with
  the network cut, every demo plays its recording, labelled, and the presenter shows Recorded.
- No secret in `dist/` or the committed recordings: the gate greps both for `DOX_DEV_KEY` and,
  when the variable is set locally, its value.
- Own tests, `pnpm dox:lint` and `pnpm dox:check` green; the owner's listening pass.
