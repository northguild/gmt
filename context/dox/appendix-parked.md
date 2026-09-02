# Appendix — parked work

Researched, specified, and **deliberately unscheduled**. Nothing here has a story ID or
a place in [tracker.md](tracker.md).

This file exists so the findings below are not re-derived — they cost real
investigation, and parking them is a recorded decision rather than a silent omission.

**Trimmed 2026-09-02.** Most of the audio / voice work, the full-bleed 3D staging, and
the declined-candidates list moved to:

- [reference/findings/speech-synthesis-capture.md](reference/findings/speech-synthesis-capture.md)
  — the one hard technical finding worth keeping
- [reference/rejected-candidates.md](reference/rejected-candidates.md) — the three
  declined items and one-line reasons
- The reactive-3D staging argument is now folded into
  [`issues/DOX-E.md`](issues/DOX-E.md) (`DOX-E1a`'s scope: landing-page hero only,
  not behind every panel).

**Read this before proposing any of it.** If something here is picked up later, promote
it into a numbered story in [tracker.md](tracker.md) and `issues/DOX-<letter>.md`
rather than working from this file directly.

---

## 1. Generative-UI widget registry — PROMOTED to DOX-C3b (2026-08-26)

**No longer parked.** By explicit user decision, this is now story `DOX-C3b` (issue
#139, Tier 6) — see [`issues/DOX-C.md`](issues/DOX-C.md). It became viable to
schedule for the same reason it was parked in the first place: Tier 2 now ships the
real widgets (the playground and the DST, interval, and converter inspectors,
`DOX-B1a`/`DOX-B2a`–`d`) _before_ the chat is built, so `DOX-C3b` is a typed registry
over widgets that already exist rather than a combined widget-plus-generative-UI build.

The two findings originally recorded here — that streamed tool-call arguments are
partial JSON and must never be raw-`JSON.parse`d, and that the registry must be fixed
and typed with no `eval` — are preserved verbatim in `issues/DOX-C.md` under `DOX-C3b`.
Read them there; this entry is now a pointer, not a specification.

---

## 2. Re-evaluate AI model provider(s) and Tanstack AI when `DOX-C1` is planned

Raised by the user during `DOX-A2` planning (2026-08-26), while confirming Cloudflare
deploy details — explicitly out of scope for `DOX-A2` (a pure static-site deploy story,
20 stories before `DOX-C1`) and deferred rather than researched then.

- A prior Gemini-based chat flow exists from a sibling repo, built "many months ago." The
  user flagged it may be stale — the AI landscape moves fast, and cheaper/better free-tier
  options may now exist worth comparing against it.
- The user also asked whether "Tanstack AI" or similar newer tooling would fit better than
  whatever the sibling repo used.
- **A concrete new fact surfaced mid-session, not yet evaluated:** the user created a
  Google AI Studio API key and added it to `apps/dox/.env` as
  `NORTHGUILD_GMT_GEMINI_API_KEY` (confirmed gitignored via `.gitignore:57`, not tracked).
  This is a real credential sitting in the repo now — when `DOX-C1` is planned, decide
  deliberately whether Gemini is still the right call before wiring it up, rather than
  defaulting to it because the key already exists.

When `DOX-C1` is planned: re-derive current free-tier model options (Cloudflare Workers AI
is a natural first candidate given the Worker is already the deploy target — same-origin,
no separate API key management), and evaluate Tanstack AI against whatever the corpus/
retrieval shape from `DOX-A3a`/`DOX-A3b` actually looks like by then, rather than assuming
either now.
