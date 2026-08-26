# Appendix — parked work

Researched, specified, and **deliberately unscheduled**. Nothing here has a story ID or
a place in [tracker.md](tracker.md).

This file exists for two reasons. First, so that the findings below are not re-derived —
several of them cost real investigation and one of them is a hard technical impossibility
that is easy to misread as solvable. Second, so that parking these is a recorded decision
rather than a silent omission.

**Re-audited 2026-08-26.** One section that lived here — the generative-UI widget
registry — has been **promoted out** to `DOX-C3b` by explicit user decision; see §2 below
for the pointer. The reactive-3D-scene section has been **partially promoted**: its
live-data idea is now `DOX-E1a`, the interactive globe, while the full-bleed-behind-glass
version it originally specified stays parked for the reasons recorded in §3.

**Read this before proposing any of it.** If something here is picked up later, promote
it into a numbered story in `story-groups.md` and `tracker.md` rather than working
from this file directly.

---

## 1. Audio and voice

Three stories in the superseded plan (its Story Group E) — roughly 20% of that plan's
total effort, for something no documentation reader asked for. Parked in full.

### Why it is parked, not deleted

The research underneath it is sound and non-obvious. The design work is done. If the
site ever wants a voice mode, this is a real specification, not a sketch.

### The finding worth preserving

**`speechSynthesis` output cannot be captured.** No specification in any browser exposes
`speechSynthesis` output to the Web Audio graph — see `WebAudio/web-audio-api#1764` and
`w3c/mediacapture-main#654`. This means:

- A frequency visualizer genuinely synced to `speechSynthesis` is **impossible**, not
  merely difficult. Any visualizer over it is a driven approximation and must be labeled
  as such in code, or the next person to read it will assume it is real.
- `speechSynthesis` output cannot be effects-processed at all.
- Chrome's "MediaStreamTrack support for the Web Speech API" is recognition **input**,
  not synthesis output. This is the specific thing that is easy to misread as solving
  the problem. It does not.

This is why the superseded plan had two voice tiers rather than one progressive
enhancement: they are genuinely different techniques, not two quality levels of the same
one.

### What was specified

- **UI sound design.** Web Audio oscillators with short envelopes, no audio files. Cues
  for keypress, send, response-start, token stream, widget materialize, error,
  hover/focus — each under ~60ms, with slight random pitch detune so repeated keypresses
  do not machine-gun. Muted by default with a persisted toggle. `AudioContext` created
  only after a user gesture. Silenced under `prefers-reduced-motion` too, since motion
  and sound sensitivity correlate.
- **Voice tier 1 — `speechSynthesis`.** Behind an explicit gesture. Text chunked at
  sentence boundaries to dodge Chrome's ~15s / ~200-character cutoff. Handles the
  `voiceschanged` race via `onvoiceschanged =` assignment, because Safari lacks
  `addEventListener` on that interface. Visualizer driven from `boundary` events and
  explicitly labeled in code as an approximation, per the finding above.
- **Voice tier 2 — Kokoro (opt-in HD).** `kokoro-js`, 82M params, WebGPU with WASM
  fallback, behind an explicit "download HD voice" action (~80–300MB, cached). Yields
  real Float32 PCM, which unlocks a genuine chain: ring modulator (`OscillatorNode` →
  `GainNode.gain`, ~30 Hz) → bitcrusher `AudioWorkletProcessor` → `WaveShaperNode` →
  `AnalyserNode` → destination. A real vocoder and a genuinely synced visualizer, which
  tier 1 cannot offer at any effort level.

### If it is ever picked up

The download cost is the honest blocker on tier 2 and the reason it must stay opt-in
with tier 1 working at zero download. Re-verify `kokoro-js`'s current size and WebGPU
support before committing — this was assessed in mid-2026.

---

## 2. Generative-UI widget registry — PROMOTED to DOX-C3b (2026-08-26)

**No longer parked.** By explicit user decision, this is now story `DOX-C3b` (issue
#139, Tier 6) — see `issues/DOX-C.md`. It became viable to schedule for the same reason
it was parked in the first place: Tier 2 now ships the real widgets (the playground and
the DST, interval, and converter inspectors, `DOX-B1a`/`DOX-B2a`–`d`) _before_ the chat is
built, so `DOX-C3b` is a typed registry over widgets that already exist rather than a
combined widget-plus-generative-UI build.

The two findings originally recorded here — that streamed tool-call arguments are
partial JSON and must never be raw-`JSON.parse`d, and that the registry must be fixed
and typed with no `eval` — are preserved verbatim in `issues/DOX-C.md` under `DOX-C3b`.
Read them there; this entry is now a pointer, not a specification.

---

## 3. Full-bleed conversation-reactive 3D scene — PARTIALLY PROMOTED (2026-08-26)

The superseded plan's DOX-D1: a full-bleed `@octanejs/three` canvas behind every glass panel,
subscribing to the active namespace — wireframe globe for `zoned`/`utc`/`unix`, analog
clockface for `plain`, crossfading between them, with a blended idle state.

**Its live-data idea is promoted.** `DOX-E1a` (issue #142, Tier 4) is now an interactive
globe — click a zone, read live time, offset, and DST state — by explicit user decision.
That is this section's core idea, taken out of "decoration" and made a real feature.

**Its full-bleed-behind-glass staging stays parked.** The three reasons below are exactly
why: promoting the globe to interactive did not, and must not, also promote it to living
behind every panel. `DOX-E1a` still lives on the landing page only.

### Why the full-bleed staging stays parked

It made the scene load-bearing in three ways simultaneously:

1. It was what every `backdrop-filter` panel sampled, so **glass legibility depended on
   scene content**. The scene could not be tuned for its own sake.
2. It had to read clearly _through_ a 24px blur plus a darkened backdrop — a much harder
   design constraint than looking good on its own, and one that can only be evaluated
   behind a real glass panel, never in isolation.
3. It created the epic's worst-case frame budget: scene rendering **and** a response
   streaming **and** border animation, together, verified on integrated graphics. Each
   is fine alone; the combination is what drops frames.

`DOX-E1a` scopes the globe to a landing-page hero, which removes all three at once —
even now that the globe is interactive rather than decorative. Nothing must stay legible
over it, no panel samples it, and there is no combined worst case. **This is the one
part of the 2026-08-21 draft's scoping decision that the 2026-08-26 rewrite did not
reverse**, and it should not be reversed casually: promoting interactivity is cheap;
promoting staging reintroduces the exact three-way coupling this section documents.

### If the full-bleed staging is ever picked up

The honest lever when the frame budget cannot be met is **scene fidelity** — fewer
meridians, lower render scale, slower rotation — not removing the glass, which is core
to the identity. Throttle the scene rather than the UI: the globe does not need 60fps,
and dropping it further while a response streams is the correct trade.

Also note this was specified against `@octanejs/three` and `@octanejs/drei`. As of
2026-08-21 `@octanejs/drei` was at `0.0.9` with 43 `octane` releases in roughly eight
weeks. Re-verify the whole ecosystem's maturity before depending on it; see
[overview.md](overview.md) §1.

---

## 4. Candidates raised and declined in the 2026-08-26 spike

Three "amazing tier" candidates were evaluated alongside the DST Transition Inspector
(now `DOX-B2b`) and **declined** rather than scheduled. Recorded so they are not
re-proposed without knowing they were already considered.

- **A `domain_map.yaml`-driven discovery page**, distinct from a scenario index. Declined
  as a separate concept because `DOX-A4d` (Tier 5) already builds a mentor-voiced index
  driven by the same `domain_map.yaml` — a second, differently-framed discovery page
  would compete with it rather than add coverage. If `DOX-A4d`'s index turns out not to
  serve the "which function do I need" case well in practice, revisit as a distinct page
  rather than folding more into `DOX-A4d`.
- **Per-page generated OG images.** A `satori`/`astro-og`-style generated link-preview
  image per reference page, so a shared reference link looks deliberate rather than like
  a raw URL. Declined for this rewrite as a nice-to-have with no correctness or teaching
  value — it does not fail any of this epic's core goals (search, link, read, teach) by
  its absence. Revisit if the site's external sharing volume ever makes it worth the
  build.
- **A docs feedback / analytics loop.** Nothing in any tier currently tells the team
  whether the docs work — no "was this helpful", no search-with-no-results log, no 404
  log. Declined for this rewrite because it is orthogonal to every tier's Definition of
  Done and would need its own privacy/hosting decisions independent of the rest of the
  epic. Worth a dedicated look once Tier 0 has real traffic to measure, since Group D's
  chrome work in particular is currently styled on faith rather than data.

---

## 5. Re-evaluate AI model provider(s) and Tanstack AI when `DOX-C1` is planned

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
