# Appendix — parked work

Researched, specified, and **deliberately unscheduled**. Nothing here has a story ID or
a place in [tracker.md](tracker.md).

This file exists for two reasons. First, so that the findings below are not re-derived —
several of them cost real investigation and one of them is a hard technical impossibility
that is easy to misread as solvable. Second, so that parking these is a recorded decision
rather than a silent omission.

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

## 2. Generative-UI widget registry

The superseded plan's central mechanism: rather than writing a code block, the model
emits a **function call** that the client maps to a real widget executing actual
`@burglekitt/gmt` code.

### Why it is parked

The idea is genuinely good, and **most of its value is already delivered without a model
at all** by Story Group B. B1's `<Playground>` runs the real library; B2 embeds one into
every one of the 1,514 examples. A reader gets live, runnable, sentinel-aware widgets on
every reference page, deterministically, with no API key and no latency.

What the generative version adds on top is that the model chooses *which* widget to show
for a free-form question. That is a real increment, but it is a small one over "the
answer cites a page that already has a live playground on it" — which is exactly what
Story Group C produces. It is also substantially more machinery: a widget registry with
typed params, Gemini function declarations, and partial-argument streaming.

### The finding worth preserving

Streamed function-call arguments are **partial JSON, which is by definition invalid
JSON** until the call completes. Never `JSON.parse` a raw chunk — a partial-JSON parser
is required. Additionally, if a provider's fine-grained tool streaming is used, note that
some do not guarantee valid JSON even at the *final* chunk, so the parser must handle a
malformed terminal object gracefully rather than only handling truncation.

### What was specified

A fixed, typed widget registry (never `eval`), registered as Gemini function
declarations, with a generic `showPlayground({ fn, args })` plus purpose-built widgets: a
timezone converter, a DST-transition inspector seeded from `docs/dst-disambiguation.md`,
an interval/duration visualizer, a regex tester for the 16 exported `regex` consts, and a
non-executing signature card. Optionally a command palette for jumping to a function by
name.

The DST inspector is the one worth revisiting first if this is ever picked up — it
surfaces genuinely non-obvious documented behavior (the `offset` parameter being
effectively inert on some functions, gap-versus-overlap resolution differing between
construction and arithmetic) that a generic playground papers over. It could also be
built as a plain Group B widget with no model involved.

---

## 3. Full-bleed conversation-reactive 3D scene

The superseded plan's D1: a full-bleed `@octanejs/three` canvas behind every glass panel,
subscribing to the active namespace — wireframe globe for `zoned`/`utc`/`unix`, analog
clockface for `plain`, crossfading between them, with a blended idle state.

### Why it is parked

It made the scene load-bearing in three ways simultaneously:

1. It was what every `backdrop-filter` panel sampled, so **glass legibility depended on
   scene content**. The scene could not be tuned for its own sake.
2. It had to read clearly *through* a 24px blur plus a darkened backdrop — a much harder
   design constraint than looking good on its own, and one that can only be evaluated
   behind a real glass panel, never in isolation.
3. It created the epic's worst-case frame budget: scene rendering **and** a response
   streaming **and** border animation, together, verified on integrated graphics. Each
   is fine alone; the combination is what drops frames.

Story E1 scopes the globe to a landing-page hero, which removes all three at once.
Nothing must stay legible over it, no panel samples it, and there is no combined worst
case. That is a large reduction in risk for a small reduction in effect.

### If it is ever picked up

The honest lever when the frame budget cannot be met is **scene fidelity** — fewer
meridians, lower render scale, slower rotation — not removing the glass, which is core
to the identity. Throttle the scene rather than the UI: the globe does not need 60fps,
and dropping it further while a response streams is the correct trade.

Also note this was specified against `@octanejs/three` and `@octanejs/drei`. As of
2026-08-21 `@octanejs/drei` was at `0.0.9` with 43 `octane` releases in roughly eight
weeks. Re-verify the whole ecosystem's maturity before depending on it; see
[overview.md](overview.md) §1.
