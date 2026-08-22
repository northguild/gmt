# Story Group C — Ask Dox (the chatbot)

Three stories. The chatbot **augments** the docs site; it does not replace it. Because
Groups A–B already produced real pages at real URLs, the bot's job is narrow and
well-defined: answer from the corpus, and cite pages the reader can open and verify.

This is a deliberate re-scoping of the superseded plan, where the chat _was_ the product
and answers materialized as generative UI instead of prose. That mechanism is not
deleted — it is parked in [appendix-parked.md](../appendix-parked.md) — but it is not
the MVP of a chatbot, and it does not survive contact with "I just want a link I can
send to my colleague."

## Prior art

A sibling `@burglekitt/worktree` repo has a working version of this, documented in
`context/dox/example-sibling-repo-docs.md`. Several of its mechanisms are adopted below
and attributed inline. Read `context/dox/overview.md` §2 "Reviewed prior art" for the
full take/reject list before starting any story here — in particular, **do not adopt its
central idea** (baking the whole corpus into one system prompt with no retrieval). Its
own numbers rule that out at our scale, and C1 exists to measure exactly that.

## Definition of done — binding for every Group C story

- The `GEMINI_API_KEY` never reaches the client. Verify against a **production** build,
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
Part of the Dox epic — see `context/dox/index.md`, Story Group C, item C1.
Depends on A3 (which emits `gmt-corpus.json` and the route manifest) and A4 (guides to
chunk).

## Gap
~424 functions and 1,514 examples is far too large to inject wholesale into every
request's `systemInstruction`. The superseded plan proposed exactly that and listed
"corpus size vs. free tier" as an open risk with a hand-wave mitigation. This story
turns that risk into a measurement and a mechanism.

## Why we are not copying the sibling repo here
`example-sibling-repo-docs.md` §5 calls "the AI has no retrieval layer" its single most
important idea — the entire documentation set compiled into a system prompt at build
time. It is cheap, deterministic, and debuggable, and at their scale it is the right
call.

It is the wrong call here, by their own arithmetic: they measure one package at ~29 KB
of prompt and estimate four packages at 80–150 KB, "which you pay for on **every**
request," and they place real retrieval at "past ~500 KB of docs." We have 424 functions
and 1,514 examples in a single package — comfortably past that threshold before any
guides are added.

**Measure it in this story rather than assuming either way.** If the full corpus turns
out to be small enough to bake, that is a real finding and this story should say so.

## Scope
- Extend A3's `gmt-corpus.json` into retrieval chunks: per function, the signature +
  description + examples + **the URL of its generated page**; guides chunked by heading
  with their own URLs.
- **Keyword/BM25 first.** With 424 functions and a rigid naming convention
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

## The decision this story must settle: where the corpus lives at runtime
The plan did not previously say this, and the three options have materially different
consequences. Pick one, record it here, and note it in C2:

- **(a) Baked into the Worker bundle.** The sibling repo's approach. One upstream call
  per request, no extra hop, fully deterministic. **Cost:** a docs-only change makes the
  bot stale until the Worker is redeployed — the sibling repo flags this as "the single
  most important CI change" in its §10. Also bounded by Worker bundle size limits, which
  424 functions may strain.
- **(b) Worker fetches the corpus from the static site and caches it.** Always fresh, no
  redeploy coupling, no bundle-size ceiling. **Cost:** one extra hop on cold cache, and
  a fetch that can fail.
- **(c) Client retrieves, sends chunks to the Worker.** No staleness, no Worker
  bundle cost. **Cost:** ships the corpus to every reader, and lets a caller forge the
  "retrieved" context — which makes the refusal guarantee unenforceable. Do not choose
  this without a reason.

If (a) is chosen, wire the CI trigger overlap in the same story — do not leave it for
C2 to discover.

## Before starting
Confirm A3 actually emits both the page URLs and the route manifest. If it does not, fix
it in A3 rather than reconstructing them here — the whole reason the site, corpus, and
manifest share one extraction is so correctness is structural rather than best-effort.

## Definition of done
- Retrieval returns sensible chunks for a spread of real questions: a direct lookup
  ("what does formatDate do"), a task ("convert UTC to Tokyo"), a concept ("what happens
  during a DST gap"), and a near-miss ("addBusinessDay" singular).
- Every chunk carries a URL that resolves.
- Corpus token measurements are recorded in this issue.
- The runtime-location decision is recorded, with its CI consequence if (a).
- A question with no good match returns few or no chunks rather than 20 bad ones — the
  refusal path in C2 depends on this being honest.
```

---

### DOX-C2 — Worker proxy

**GitHub Issue:** #138 — see tracker.md\_

**Title:**

```
DOX-C2 Cloudflare Worker proxying grounded Gemini SSE with key custody
```

**Description:**

```
Part of the Dox epic — see `context/dox/index.md`, Story Group C, item C2.
Depends on C1.

## Gap
The site is static and has no backend. A Gemini API key cannot ship to the browser.

## Scope
- `workers/dox-proxy` with `wrangler.toml`. Key set via
  `wrangler secret put GEMINI_API_KEY` — never in the repo, never in a committed env
  file. Zero npm dependencies is achievable and worth aiming for; the sibling repo's
  equivalent bundles to ~30 KB.
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
  5. **The C1 chunks** retrieved for this question, each labelled with its page URL.
  6. An **explicit refusal instruction** for out-of-corpus questions.

### Validation pipeline — adopted from the sibling repo's §6
Enumerate these explicitly rather than trusting the upstream to reject bad input:

    OPTIONS              → 204 + CORS headers
    method !== POST      → 405
    rate limit exceeded  → 429 + Retry-After
    missing API key      → 500
    malformed JSON       → 400
    messages not array   → 400
    too many messages    → 400
    bad role or shape    → 400  (roles restricted to user|assistant)
    content over cap     → 400
    model not allowed    → 400  (allowlist SHARED with client, one constants module)
    → Gemini :streamGenerateContent?alt=sse
       upstream !ok      → mapped, human-readable error JSON
       ok                → stream body straight back

- **Share the model allowlist with the client from one module** so UI and Worker cannot
  drift.
- **Convert message-history shape in the Worker** (`assistant` → Gemini's `model` role),
  so the client speaks one generic format. This is the seam if the provider is ever
  swapped.
- **CORS allowlist is explicit**: the deployed Pages origin plus localhost. Not `*`. Set
  `Vary: Origin`.
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
- Use A3's committed stub for the generated corpus/manifest modules so Worker tests run
  on a clean checkout with no build step.

## Before starting
**There is no `systemKnowledge` setting in the Gemini API**, and no config flag that
restricts a model to a supplied corpus. Grounding is achieved by `systemInstruction` +
context injection + an explicit refusal instruction, or it is not achieved. Do not go
looking for a flag; this was already verified.

Re-check current Gemini free-tier rate limits and model availability before committing to
`2.5 Flash` — this moves, and the epic's cost assumptions rest on it.

Read `.github/workflows/ci.yml` for repo conventions before adding any workflow step. If
C1 chose to bake the corpus into the Worker bundle, the Worker's deploy trigger must
also fire on docs and `skills/` changes, or the bot silently goes stale — the sibling
repo names this its single most important CI change.

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
- Requests from an unexpected origin are rejected.
- Grep the deployed production assets for the key and confirm it is absent.
- Worker tests pass on a clean checkout with no prior build.
```

---

### DOX-C3 — Chat panel

**GitHub Issue:** #139 — see tracker.md\_

**Title:**

```
DOX-C3 Add the Ask Dox chat panel with hardened, verifiable citations
```

**Description:**

```
Part of the Dox epic — see `context/dox/index.md`, Story Group C, item C3.
Depends on C2, A3 (route manifest), and A5 (tokens).

## Gap
No chat UI exists. This story is where the epic's original ambition finally lands — but
on top of a docs site rather than instead of one.

## Scope
- A dismissible panel on the docs site, available from any page. **Not a takeover, not a
  separate route, not the homepage.** The docs are the product; this augments them.
- Streaming answers rendered as markdown, built from A5's tokens and primitives.
- Stop button that actually halts the stream.
- Error and rate-limit states using A5's Signal-lost treatment rather than a generic
  error box — consistent with how the rest of the site communicates failure.
- Seed the retrieval scope from the current page (see C1), but never silently rewrite
  what the user typed.

### Link hardening — the most valuable thing taken from the prior art
Run **every** href the model emits through a resolver checked against A3's route
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
Base UI). One streaming panel does not need three libraries; A5's primitives and a plain
`fetch` reader are enough, and less weight on every page.

## Definition of done
- Asking "how do I convert a UTC timestamp to Tokyo time" returns a correct, grounded,
  streaming answer citing `convertToZone`'s page, and that link opens it.
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
