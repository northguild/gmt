# `speechSynthesis` output cannot be captured

> The hard finding from the audio research that is expensive to re-derive.

**No specification in any browser exposes `speechSynthesis` output to the Web Audio
graph** — see [WebAudio/web-audio-api#1764](https://github.com/WebAudio/web-audio-api/issues/1764)
and [w3c/mediacapture-main#654](https://github.com/w3c/mediacapture-main/issues/654).
This means:

- A frequency visualizer genuinely synced to `speechSynthesis` is **impossible**, not
  merely difficult. Any visualizer over it is a driven approximation and must be labeled
  as such in code, or the next person to read it will assume it is real.
- `speechSynthesis` output cannot be effects-processed at all.
- Chrome's "MediaStreamTrack support for the Web Speech API" is recognition **input**,
  not synthesis output. This is the specific thing that is easy to misread as solving
  the problem. It does not.

> **If you propose anything that depends on capturing `speechSynthesis` audio,
> re-verify this** — the W3C issue threads linked above are the primary sources, and
> this file is a pointer to them, not a substitute.
