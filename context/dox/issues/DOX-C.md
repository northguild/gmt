# Issue #137–#139 — Ask Dox (the chatbot that mounts widgets)

**Re-audited 2026-08-26 and escalated, not demoted, by explicit user decision** — the
chatbot is now Tier 6, the epic's final tier, and its ambition is higher than the
2026-08-21 draft's: answer, cite, and **mount a real Tier 2 widget** rather than print a
code block. Four stories now fold into these three issues: `DOX-C1` and `DOX-C2` are
unchanged in ID, `DOX-C3` splits into `DOX-C3a` (panel + link hardening) and `DOX-C3b`
(widget registry, new). **No new GitHub issues** — both land on #139.

Because Tiers 0–5 already produced real pages, real URLs, and a full widget platform,
the bot's job is well-defined: answer from the corpus, cite pages the reader can open
and verify, and — new in this rewrite — mount the widget that actually answers the
question instead of describing it in prose. It augments the docs; it does not replace
them.

## Prior art

A sibling `@northguild/worktree` repo has a working version of the chat portion of this,
documented in `context/dox/example-sibling-repo-docs.md`. Several of its mechanisms are
adopted below and attributed inline. Read `context/dox/overview.md` §2 "Reviewed prior
art" for the full take/reject list before starting any story here — in particular, **do
not adopt its central idea** (baking the whole corpus into one system prompt with no
retrieval). Its own numbers rule that out at our scale, and `DOX-C1` exists to measure
exactly that.

## Definition of done — binding for every story in this file

- The model API key never reaches the client. Verify against a **production** build,
  not a dev build.
- Out-of-corpus questions are **refused, not improvised**.
- **A link the model emits either resolves or is not a link.** Never a 404.
- Validate at the edge, not in the browser. Every limit and allowlist lives in the
  Worker; the client is untrusted.

---

### DOX-C1 — Retrieval index

**GitHub Issue:** #137 — see tracker.md\_

**Title:**

```
DOX-C1 Build retrieval chunks and lookup over gmt-corpus.json
```

**Description:**

```
Part of the Dox epic — see `context/dox/index.md`, Tier 6, item DOX-C1.
Depends on DOX-A3a (which emits `gmt-corpus.json` and the route manifest) and DOX-A4a
(guides to chunk).

## Gap
504 functions and 1,860 examples is far too large to inject wholesale into every
request's `systemInstruction`. The 2026-08-21 draft listed "corpus size vs. free tier"
as an open risk with a hand-wave mitigation. This story turns that risk into a
measurement and a mechanism.

## The corpus-location question is now resolved, not open
The 2026-08-21 draft left "where does the corpus live at runtime" as a three-way decision
for this story. **It is now settled by the Tier 0 hosting decision** (overview.md §2
"Hosting"): the site and the chat both live behind one Cloudflare Worker, so the Worker
can fetch the corpus from the static site it is already serving — option (b) from the
original list — with no extra deployment coupling and no staleness risk from baking the
corpus into the Worker bundle. Record this here rather than re-deriving it, and confirm
the fetch path and cache behavior work before moving to `DOX-C2`.

## Why we are not copying the sibling repo's no-retrieval approach
`example-sibling-repo-docs.md` §5 calls "the AI has no retrieval layer" its single most
important idea — the entire documentation set compiled into a system prompt at build
time. It is cheap, deterministic, and debuggable, and at their scale it is the right
call.

It is the wrong call here, by their own arithmetic: they measure one package at ~29 KB
of prompt and estimate four packages at 80–150 KB, "which you pay for on **every**
request," and they place real retrieval at "past ~500 KB of docs." We have 504 functions
and 1,860 examples in a single package — comfortably past that threshold before any
guides are added.

**Measure it in this story rather than assuming either way.** If the full corpus turns
out to be small enough to bake, that is a real finding and this story should say so.

## Scope
- Extend DOX-A3a's `gmt-corpus.json` into retrieval chunks: per function, the signature
  + description + examples + **the URL of its generated page**; guides chunked by
  heading with their own URLs.
- **Keyword/BM25 first.** With 504 functions and a rigid naming convention
  (`add*`/`diff*`/`startOf*`/`is*`/`format*`, namespace prefixes), lexical retrieval
  will carry surprisingly far. It needs no embedding model, no vector store, no
  additional service, and it runs in the Worker. Do not reach for embeddings until
  keyword retrieval has been shown to fail on real questions.
- Retrieve roughly 10–20 chunks per question.
- **Namespace scoping from page context.** Adapted from the sibling repo's package-scope
  idea (§5 option A), which does not map directly — we ship one package — but the shape
  does: a question asked from `/reference/zoned/...` should bias retrieval toward
  `zoned`. Make it a bias, not a filter, so a cross-namespace question still works.
- **Measure and record in this issue:** total corpus tokens, per-chunk tokens, and
  tokens for a typical retrieved set. Every later decision about caching, model choice,
  and free-tier viability depends on these, and right now they are unknown.

## Re-open the model choice here
The 2026-08-21 draft chose Gemini 2.5 Flash on free-tier SSE-streaming grounds, before
widgets were part of the plan. **`DOX-C3b` now requires the model to emit streamed tool
calls** so it can mount a Tier 2 widget instead of describing one in prose. That changes
the calculus toward whichever provider has the better streaming tool-use ergonomics.
Re-evaluate rather than inherit the 2026-08-21 choice, and record the decision here so
`DOX-C2` and `DOX-C3b` do not each re-litigate it.

## Before starting
Confirm DOX-A3a actually emits both the page URLs and the route manifest. If it does
not, fix it in DOX-A3a rather than reconstructing them here — the whole reason the site,
corpus, and manifest share one extraction is so correctness is structural rather than
best-effort.

## Definition of done
- Retrieval returns sensible chunks for a spread of real questions: a direct lookup
  ("what does formatDate do"), a task ("convert UTC to Tokyo"), a concept ("what happens
  during a DST gap"), and a near-miss ("addBusinessDay" singular).
- Every chunk carries a URL that resolves.
- Corpus token measurements are recorded in this issue.
- The same-origin corpus-fetch path is implemented and its caching behavior recorded.
- The model choice is re-evaluated and recorded, with the streaming tool-use requirement
  from `DOX-C3b` as an explicit input to that decision.
- A question with no good match returns few or no chunks rather than 20 bad ones — the
  refusal path in DOX-C2 depends on this being honest.
```

---

### DOX-C2 — Worker proxy

**GitHub Issue:** #138 — see tracker.md\_

**Title:**

```
DOX-C2 Add /api/chat to the docs Worker: grounded SSE proxy with key custody
```

**Description:**

```
Part of the Dox epic — see `context/dox/index.md`, Tier 6, item DOX-C2.
Depends on DOX-C1.

## Gap
The site is static through Tier 5 and has no backend. A model API key cannot ship to
the browser.

## Rewritten 2026-08-26: same-origin, not a separate Worker
The 2026-08-21 draft specified `workers/dox-proxy` as its own Cloudflare Worker
deployment, which required an explicit CORS allowlist and a second pipeline. **This
story instead adds `main` and `/api/chat` to the same Worker `DOX-A2` already deployed**
(overview.md §2 "Hosting") — the `assets` binding keeps serving the static site, and a
`fetch` handler now also serves `/api/*` from the same isolate, same origin, same
deployment. **CORS is not needed at all**: there is only one origin.

## Scope
- Add `main` to `apps/dox/wrangler.jsonc` and route `/api/chat` inside the Worker's
  `fetch` handler, falling back to `env.ASSETS.fetch(request)` for everything else. Key
  set via `wrangler secret put` (name depends on the model chosen in `DOX-C1`) — never in
  the repo, never in a committed env file. Zero npm dependencies is achievable and worth
  aiming for; the sibling repo's equivalent bundles to ~30 KB.
- Unbuffered SSE passthrough — buffering defeats streaming and is easy to introduce
  accidentally. Return `new Response(upstream.body, ...)` rather than reading and
  re-emitting.
- `systemInstruction` assembled in this order, which matters:
  1. **Persona and scope** — answer only from the supplied context; say so when out of
     scope.
  2. **Linking rules** — an explicit allowlist of the routes retrieved for this
     question. Never invent routes; never link to GitHub anchors or SKILL.md headings.
     The sibling repo's §5 observation is worth heeding: *a model shown 20 valid routes
     hallucinates far less than one shown 120.*
  3. **Vocabulary** — the relevant `packages/gmt/skills/*/SKILL.md` content, placed
     **before** reference material so the model learns the library's terminology before
     reading signatures. Adopted from the sibling repo's §5.
  4. **GMT's core rules** from `packages/gmt/README.md` §Core Rules — ISO strings in and
     out, never `Date`, sentinel returns, invalid input never throws.
  5. **The DOX-C1 chunks** retrieved for this question, each labelled with its page URL.
  6. **Tool declarations for `DOX-C3b`'s widget registry**, if the chosen model supports
     streamed tool calls.
  7. An **explicit refusal instruction** for out-of-corpus questions.

### Validation pipeline — adopted from the sibling repo's §6
Enumerate these explicitly rather than trusting the upstream to reject bad input:

    method !== POST      → 405
    rate limit exceeded  → 429 + Retry-After
    missing API key      → 500
    malformed JSON       → 400
    messages not array   → 400
    too many messages    → 400
    bad role or shape    → 400  (roles restricted to user|assistant)
    content over cap     → 400
    model not allowed    → 400  (allowlist SHARED with client, one constants module)
    → upstream :streamGenerateContent (or equivalent, per DOX-C1's model choice)
       upstream !ok      → mapped, human-readable error JSON
       ok                → stream body straight back

Note the `OPTIONS` preflight branch from the 2026-08-21 draft is dropped: same-origin
requests do not trigger CORS preflight, so there is nothing to answer.

- **Share the model allowlist with the client from one module** so UI and Worker cannot
  drift.
- **Convert message-history shape in the Worker** if the chosen model's role names
  differ from the client's (e.g. `assistant` → `model`), so the client speaks one
  generic format. This is the seam if the provider is ever swapped.
- **Map upstream errors to user-facing strings**, distinguishing a daily quota 429 from a
  per-minute one — they need different advice ("come back tomorrow" vs "wait a moment").
  Never forward a raw upstream payload.
- **Rate limiting**, with the honest caveat recorded: an in-memory
  `Map<clientIp, {count, resetAt}>` is **per isolate, not global**. It blunts casual
  abuse; it does not stop a determined attacker. Sweep expired entries and reject rather
  than growing unbounded. If real global limits are needed later, the upgrade paths are
  Cloudflare WAF/Rate Limiting rules, Turnstile, or a Durable Object. Do not describe
  this as "rate limited" without the caveat.

### Testability — do this from day one
- **Keep SSE parsing pure.** A side-effect-free, React-free function that takes a line
  and returns a discriminated union (`{ type: "text" | "error" | "done" | "skip" }`),
  unit-tested against malformed payloads. The sibling repo calls this out as the thing
  that makes streaming testable at all, and it is right — retrofitting it later means
  untangling it from component state.
- **Put the clock behind a helper** (`getUnixNow()`) so rate-limit tests can fake time.
- Use DOX-A3a's committed stub for the generated corpus/manifest modules so Worker tests
  run on a clean checkout with no build step.

## Before starting
**There is no `systemKnowledge` setting in the Gemini API** (or equivalent flag in any
provider considered), and no config flag that restricts a model to a supplied corpus.
Grounding is achieved by `systemInstruction` + context injection + an explicit refusal
instruction, or it is not achieved. Do not go looking for a flag; this was already
verified.

Re-check current rate limits and model availability for whichever model `DOX-C1` chose
before committing — this moves, and the epic's cost assumptions rest on it.

Read `.github/workflows/ci.yml` for repo conventions before adding any workflow step. If
DOX-C1's runtime-location decision changes (i.e. the corpus ends up baked into the
Worker bundle after all rather than fetched same-origin), the Worker's deploy trigger
must also fire on docs and `skills/` changes, or the bot silently goes stale — the
sibling repo names this its single most important CI change.

Consider a script bridging `.env.local` → `worker/.dev.vars` so `wrangler dev` picks the
key up without a manual step, with committed `.example` counterparts. Small, and it
removes a recurring papercut.

## Definition of done
- A question with a corpus answer streams a correct, grounded response.
- A question with no corpus answer is **refused**, not improvised. Test with something
  plausible-but-absent (e.g. "how do I parse a cron expression with gmt") rather than
  something obviously off-topic — the plausible case is where grounding actually fails.
- Every branch of the validation pipeline has a test.
- Rate limiting is tested including per-IP independence, with a faked clock.
- The SSE parser is unit-tested independently of any component.
- Grep the deployed production assets for the key and confirm it is absent.
- Worker tests pass on a clean checkout with no prior build.
```

---

### DOX-C3a — Chat panel

**GitHub Issue:** #139 — see tracker.md\_

**Title:**

```
DOX-C3a Add the Ask Dox chat panel with hardened, verifiable citations
```

**Description:**

```
Part of the Dox epic — see `context/dox/index.md`, Tier 6, item DOX-C3a.
Depends on DOX-C2, DOX-A3a (route manifest), DOX-A5 (tokens), and DOX-D2 (the reveal
primitive this story wires to streaming replies).

## Split from DOX-C3 in the 2026-08-26 rewrite
The original DOX-C3 covered the panel, link hardening, and streaming details in one
story. It now covers only those; **the widget-mounting mechanism is `DOX-C3b`**, split out
because it depends on the full Tier 2 widget set and is a materially different kind of
work (a typed registry plus tool declarations) from the panel itself.

## Gap
No chat UI exists through Tier 5. This story is where the epic's original ambition
lands — on top of a docs site and a widget platform, not instead of either.

## Scope
- A dismissible panel on the docs site, available from any page. **Not a takeover, not a
  separate route, not the homepage.** The docs are the product; this augments them.
- Streaming answers rendered as markdown, built from DOX-A5's tokens and primitives.
- Stop button that actually halts the stream.
- Error and rate-limit states using DOX-A5's Signal-lost treatment rather than a generic
  error box — consistent with how the rest of the site communicates failure.
- Seed the retrieval scope from the current page (see DOX-C1), but never silently
  rewrite what the user typed.
- Wire `DOX-D2`'s debounced, interruptible reveal primitive to streamed replies.

### Link hardening — the most valuable thing taken from the prior art
Run **every** href the model emits through a resolver checked against DOX-A3a's route
manifest. This turns "citations resolve" from a test we sample into a property that
holds at runtime:

| Link the model produced | Outcome |
| --- | --- |
| Relative path in the route manifest | Rendered as a real link |
| Full production URL on our own origin | Origin stripped, re-checked as a relative path |
| Relative path **not** in the manifest | Rendered as **plain text** — no link |
| GitHub anchor or SKILL.md heading | Rendered as **plain text** — no link |
| Other external URL | Only if the origin is allowlisted and the protocol is `https`, `http`, or `mailto` |
| Unparseable, or `javascript:` / `data:` | Dropped |

**The net effect: a hallucinated link degrades to plain text instead of a 404.** A broken
citation is worse than no citation — it makes the site look wrong when it is right.

Do **not** adopt the sibling repo's companion idea of auto-linking bold phrases that
match page titles. Turning prose the model did not intend as a link into a link is a
correctness risk dressed as a nicety.

### Streaming client details worth getting right first time
- **Two timeouts**: an overall request cap (~120 s) *and* a shorter **idle** timeout
  (~30 s) that resets on every chunk. The idle timer is what catches a stalled stream
  without killing a legitimately long answer. Clear the handle in a `finally` so no
  timer dangles.
- **One `AbortController` per request**; a new send aborts the previous one.
- **Optimistic append** — add the user message and an empty assistant placeholder before
  the network call, so the loading state is instant.
- **Classify errors vs warnings.** A rate limit, a validation rejection, or a user
  cancellation is a *warning*: rendered differently from a crash, and **excluded from the
  history sent upstream**. The UI can be forgiving without corrupting model context.
- **Clean the history snapshot** sent upstream: filter out error/warning messages and
  empty or still-streaming assistant messages.
- If chat history is persisted, note two real traps from the prior art: cache the parsed
  snapshot by its raw string (otherwise `JSON.parse` returns a fresh reference every call
  and you get an infinite render loop), and dispatch a `StorageEvent` manually on write
  (the native event only fires in *other* tabs). Also sanitize any message still marked
  `streaming: true` from a closed tab on load.
- Show a visible badge when the panel is pointed at a local Worker. Cheap, and it stops
  "why is the AI stale?" confusion.

## Before starting
Read `context/dox/overview.md` §3's "Controls" rule before building the composer: use a
real `<textarea>` with `appearance: none` and `field-sizing: content`, never a
contenteditable `div`. Rebuilding it loses IME composition — which breaks all CJK input
— plus autofill, mobile keyboard behavior, and screen reader support, none of which is
visible while developing on a US-English desktop.

Note that the sibling repo's own warning lists "no textarea, no multiline chat, no
copiable blocks" as its known weaknesses. Those are exactly the three things to get right
here. Multiline input and copyable code blocks are non-negotiable — Starlight already
ships copy buttons on code blocks, so use its components rather than rendering markdown
into bare `<pre>`.

Resist porting the prior art's client stack wholesale (React Query + TanStack Form +
Base UI). One streaming panel does not need three libraries; DOX-A5's primitives and a
plain `fetch` reader are enough, and less weight on every page.

## Definition of done
- Asking "how do I convert a UTC timestamp to Tokyo time" returns a correct, grounded,
  streaming answer citing `convertZonedToZoned`'s page, and that link opens it.
- **A deliberately induced hallucinated link renders as plain text, not a broken link.**
  Test this directly — stub a response containing `/reference/plain/calculate/notAReal`
  and confirm it degrades. This is the story's most important test.
- Multiline input works; Enter/Shift+Enter behavior is deliberate and documented.
- Code blocks in answers are copyable.
- Stop halts the stream mid-token.
- A stalled stream (no chunks, connection open) is caught by the idle timeout.
- A rate-limit response renders as a warning, not a crash, and does not enter history.
- Keyboard-only: open the panel, type, submit, stop, dismiss, and return focus sensibly
  — all without a mouse.
- The panel does not hydrate until opened.
```

---

### DOX-C3b — Widget registry

**GitHub Issue:** #139 — see tracker.md\_ (folds into the same issue as `DOX-C3a`)

**Title:**

```
DOX-C3b Let Ask Dox answer by mounting a real Tier 2 widget
```

**Description:**

```
Part of the Dox epic — see `context/dox/index.md`, Tier 6, item DOX-C3b. Un-parks
`appendix-parked.md` §2 by explicit user request — see overview.md's "What the
2026-08-26 audit changed".
Depends on DOX-C3a and every Tier 2 widget (`DOX-B1a`, `DOX-B2a`–`d`).

## Gap
Without this, the chat can only describe a widget in prose ("try changing
`disambiguation` to `earlier`"). With Tier 2's widgets already built, the model can
instead answer a free-form question by mounting the actual DST inspector, interval
visualizer, converter bench, or generic playground, live, in the panel.

## Why this is cheap now
This idea was parked in the 2026-08-21 draft's `appendix-parked.md` §2 because building
both a widget system and a generative-UI layer in one story was a lot of simultaneous
machinery. **That is no longer true.** Tier 2 already built every widget this story
mounts; this story is a typed registry plus tool declarations over widgets that already
exist and already work, not a widget-building project.

## Two findings carried forward from `appendix-parked.md` §2 — do not re-derive
- **Streamed tool-call arguments are partial JSON, which is by definition invalid JSON**
  until the call completes. Never `JSON.parse` a raw chunk — a partial-JSON parser is
  required. Additionally, note that some providers' fine-grained tool streaming does not
  guarantee valid JSON even at the *final* chunk, so the parser must handle a malformed
  terminal object gracefully, not only a truncated one.
- **The registry is fixed and typed. Never `eval`.**

## Scope
- A fixed, typed widget registry mapping a tool name to one of Tier 2's real components:
  a generic `showPlayground({ fn, args })` plus purpose-built entries for the DST
  inspector (`DOX-B2b`), the interval visualizer (`DOX-B2c`), and the converter/format
  bench (`DOX-B2d`).
- Register these as tool/function declarations for whichever model `DOX-C1` selected,
  gated on that model actually supporting streamed tool calls — if it does not,
  `DOX-C3a` ships without this story rather than blocking on it.
- A partial-JSON-tolerant parser for streamed tool-call arguments, unit-tested against
  both truncated and malformed-terminal payloads.
- Reuse `DOX-B1b`'s permalink mechanism so a mounted widget's state is itself linkable
  from the chat transcript.

## Before starting
Read `appendix-parked.md` §2 in full before designing the registry — it records the
original widget list (including a command palette for jumping to a function by name,
which this story may or may not pick up) and the reasoning for why the DST inspector was
called out as the one worth building first, which `DOX-B2b` has now done.

## Definition of done
- A free-form question that matches a Tier 2 widget's purpose (e.g. "what happens to
  1:30am on November 3rd in New York") causes the model to mount that widget, live, in
  the panel, seeded with relevant arguments.
- A stubbed streamed tool call with a malformed *terminal* JSON object does not crash
  the client — verified with a direct test, not by inference from the truncated case.
- No `eval` or dynamic code execution exists anywhere in the registry or its dispatch
  path — verified by reading the implementation, not only by testing happy paths.
- A mounted widget's state can be copied as a permalink from the chat transcript.
```
