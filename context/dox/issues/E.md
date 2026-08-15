### E1 — UI sound design

**GitHub Issue:** _blank — see tracker.md_

**Title:**

```
E1 Synthesized UI sound cues via Web Audio oscillators
```

**Description:**

```
Part of the Dox epic — see `context/dox/index.md`, Story Group E, item E1.
Depends on A3 (the interactions being scored: keypress, send, focus, etc.) and C1–C3
(the chat/widget events being scored). Independent of E2/E3.

## Gap
No sound exists yet. This is the cheaper, unambiguous half of "videogame feel" — unlike
voice (E2/E3), it requires no external audio and no capture workaround.

## Scope
- Synthesize with Web Audio oscillators + short envelopes. No audio files — everything
  generated, tiny, and tunable.
- Cues: keypress tick, send, response-start, token stream (very subtle), widget
  materialize, error, hover/focus.
- Each cue under ~60ms at low gain, with slight random pitch detune so repeated
  keypresses don't machine-gun into an identical repeated tone.
- Muted by default, with a persisted (localStorage or similar) toggle.
- `AudioContext` created only after an explicit user gesture — never autoplay.
- Silence everything under `prefers-reduced-motion` as well as any dedicated mute
  toggle — motion sensitivity and sound sensitivity correlate, per
  `context/dox/overview.md` §5 Chunk 11 (E1's origin).

## Before starting
No external research needed here — this is pure Web Audio API oscillator/gain-envelope
work, well-trodden ground. Focus on restraint: the failure mode is cues that are cute
for thirty seconds and fatiguing for five minutes.

## Definition of done
- A 5-minute session using the app doesn't feel fatiguing from sound.
- Muting is genuinely silent — verify no residual audio graph activity.
- No autoplay-policy warning appears in the console on load.
```

---

### E2 — Voice tier 1

**GitHub Issue:** _blank — see tracker.md_

**Title:**

```
E2 speechSynthesis voice with sentence chunking and driven visualizer
```

**Description:**

```
Part of the Dox epic — see `context/dox/index.md`, Story Group E, item E2.
Depends on C1 (text responses to speak).

## Gap
No voice exists yet. This tier is the free, zero-download baseline —
`window.speechSynthesis`, present in essentially every browser.

## Scope
- `speechSynthesis` behind an explicit user gesture (required on iOS Safari, good
  practice everywhere).
- Chunk text at sentence boundaries before speaking, to dodge Chrome's ~15s/~200-char
  utterance cutoff on desktop.
- Handle the `voiceschanged` race (`getVoices()` returns `[]` on first call) using
  `onvoiceschanged =` direct assignment — **Safari does not support
  `addEventListener` for this event.**
- Visualizer driven from `SpeechSynthesisUtterance` `boundary` events (fires per
  word/sentence in Chrome/Edge/Safari; unreliable in Firefox) plus `start`/`end`/`pause`.
  **Explicitly comment in the code that this is a driven approximation, not real audio
  analysis** — see the next point for why.

## Before starting
Read `context/dox/overview.md` §1's finding on `speechSynthesis`: **no browser
spec exposes its audio output to the Web Audio graph.** A frequency visualizer "synced
to" `speechSynthesis` is not achievable — only an honestly-approximated one driven from
`boundary` event timing. Do not spend time trying to route `speechSynthesis` through an
`AnalyserNode`; multiple W3C threads confirm this is unimplemented across every engine
(`WebAudio/web-audio-api#1764`, `w3c/mediacapture-main#654`).

## Definition of done
- Speaks correctly in both Chrome and Safari.
- A long response is not truncated mid-sentence.
- Visualizer moves plausibly with speech without claiming to be real audio analysis.
```

---

### E3 — Voice tier 2 (opt-in HD)

**GitHub Issue:** _blank — see tracker.md_

**Title:**

```
E3 Opt-in Kokoro on-device TTS with real vocoder chain and synced visualizer
```

**Description:**

```
Part of the Dox epic — see `context/dox/index.md`, Story Group E, item E3.
Depends on E2 (the tier this sits above) — E2 must ship first so voice works at zero
download before this heavier opt-in path is offered.

## Gap
E2's `speechSynthesis` cannot be effects-processed or genuinely visualized (per E2's
notes). This tier exists specifically to deliver both, using a real audio buffer.

## Scope
- `kokoro-js` (WebGPU/WASM, ~82M params, `kokoro-js` on npm) behind an explicit
  "download HD voice" user action — not automatic. Model download is ~80–300MB; cache it
  (Cache Storage or OPFS) so it's a one-time cost. Provide a WASM fallback path for
  devices/browsers without WebGPU.
- Its output is real Float32 PCM, which feeds an actual Web Audio graph:
  ring modulator (`OscillatorNode` driving `GainNode.gain`, ~30 Hz for a Dalek-ish
  timbre) → bitcrusher (`AudioWorkletProcessor`) → `WaveShaperNode` for drive →
  `AnalyserNode` → destination.
- The `AnalyserNode` tap feeds the visualizer — this is the tier where it becomes
  genuinely real, unlike E2's driven approximation.

## Before starting
Re-verify `kokoro-js`'s current API and model-loading pattern against its npm page —
this landscape (in-browser ML inference) moves quickly. Confirm WebGPU availability
detection and the WASM fallback path work correctly before wiring up the DSP chain on
top.

## Definition of done
- The visualizer's bars visibly track actual audio amplitude — muting the output
  silences the bars, proving the analysis is real (unlike E2, where muting wouldn't
  necessarily prove anything since the visualizer isn't reading real audio there).
- First-use download is clearly opt-in, with visible progress, not silent.
- Cached model persists across page reloads.
- WASM fallback verified on a browser/device without WebGPU.
```
