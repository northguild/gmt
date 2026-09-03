# Appendix — parked work

Researched, specified, and **deliberately unscheduled**. Nothing here has a story ID or
a place in [tracker.md](tracker.md).

This file exists so the findings below are not re-derived — they cost real
investigation, and parking them is a recorded decision rather than a silent omission.

Most of the audio / voice work, the full-bleed 3D staging, and the declined-candidates
list live elsewhere:

- [reference/findings/speech-synthesis-capture.md](reference/findings/speech-synthesis-capture.md)
  — the one hard technical finding worth keeping
- [reference/rejected-candidates.md](reference/rejected-candidates.md) — the three
  declined items and one-line reasons
- The reactive-3D staging argument is in [`issues/DOX-E.md`](issues/DOX-E.md)
  (`DOX-E1a`'s scope: landing-page hero and `/dox` rail only, not behind every panel).

**Read this before proposing any of it.** If something here is picked up later, promote
it into a numbered story in [tracker.md](tracker.md) and `issues/DOX-<letter>.md`
rather than working from this file directly.

---

## 1. Generative-UI widget registry — now DOX-C3b

**Not parked.** This is story `DOX-C3b` (issue #139, Tier 6) — see
[`issues/DOX-C.md`](issues/DOX-C.md). Tier 2 ships the real widgets (the playground and
the DST, interval, and converter inspectors, `DOX-B1a`/`DOX-B2a`–`d`) _before_ the chat
is built, so `DOX-C3b` is a typed registry over widgets that already exist rather than a
combined widget-plus-generative-UI build.

One finding from the original research still holds: **the registry must be fixed and
typed, with no `eval`** — preserved in `issues/DOX-C.md` under `DOX-C3b`. The old
"streamed tool-call arguments are partial JSON, never raw-`JSON.parse`" warning no longer
applies: the AI SDK delivers `tool-<name>` parts with `part.input` already parsed, so the
residual risk is _validation_ (a well-formed input carrying nonsense arguments), which
`DOX-C3b` gates on.

This entry is a pointer, not a specification.

---

## 2. Model provider choice — open until `DOX-C1`

The framework question is settled (the AI SDK, via AI Elements — `DOX-C0`). The provider
choice is deferred to `DOX-C1` and is a small decision: behind the AI SDK a provider is
one import and one model string, not a one-way door, and any tool-capable provider works.

- **Candidates:** Gemini (a `NORTHGUILD_GMT_GEMINI_API_KEY` already exists in
  `apps/dox/.env`, gitignored — not a reason to default to it), Cloudflare Workers AI
  (same origin, no key custody), and `@ai-sdk/anthropic`.
- **Still open, and the reason this entry survives:** nobody has measured the corpus.
  `DOX-C1`'s token measurements are the input to this decision and do not exist yet.
  Choose on cost, latency and quality once they do.
