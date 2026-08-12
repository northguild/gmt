# Story Group Summaries

## Story Group A — Foundation

Workspace plumbing, the Octane runtime, and the design system everything else is built
from. Do these in order; A3 in particular gates all later UI work.

- **A1. Workspace skeleton** — Create `apps/dox` as `@gmt/dox` (private, `type: module`),
  depending on `@burglekitt/gmt` via `workspace:*`. Wire the three easy-to-miss files:
  `pnpm-workspace.yaml` (`apps/*`), root `package.json` `"workspaces"`, and
  `oxlint.config.ts`'s `files.include` (`apps/**`). Add root `dox:dev`/`dox:build`
  scripts. See overview.md §4.
- **A2. Octane boots** — `vite@^7` + `octane@0.1.35` (exact, no caret — the package name
  has abandoned 2015-era `1.0.x` versions that sort highest by semver). Vite config uses
  the compiler at `octane/compiler/vite` (no separate `@octanejs/vite-plugin` needed);
  `octane/compiler/volar` for editor support. One static `App.tsrx` shell. **Gate:** if
  `.tsrx` tooling fights the repo's `nodenext`/`verbatimModuleSyntax` setup, resolve it
  here before anything is built on top.
- **A3. Design system + control primitives** — Built in isolation on a throwaway
  kitchen-sink page, before any product UI. Token layer (color/spacing/tracking/timing as
  CSS custom properties, no literals in components), self-hosted font subsets,
  `<GlassPanel>` (six-layer glass stack with the `brightness()` backdrop-filter),
  `<AnimatedBorder>` (conic sweep via `@property --angle`), the `corner-shape: bevel` /
  `clip-path` chamfer utility with a focus ring in both paths, and every native control
  (button, textarea, select, range, toggle, scrollbars, caret) restyled via
  `appearance: none` — never rebuilt as `div`s. Wires `prefers-reduced-motion` /
  `prefers-reduced-transparency` / `prefers-contrast` from the start. See overview.md §3
  in full — this story *is* that section, implemented.

## Story Group B — Data & Backend

The knowledge corpus and the server hop that keeps the Gemini key off the client.

- **B1. Knowledge extraction** — `apps/dox/scripts/build-knowledge.ts` walks
  `packages/gmt/src/**/*.ts` with the TypeScript compiler API (not regex): namespace,
  category, name, signature, description, `@param`/`@returns`, every `@example` as
  `{ call, result }`. The one-function-per-file layout makes this mechanical. Also
  ingests the six namespace READMEs, root README, `docs/dst-disambiguation.md`, and the
  17 `packages/gmt/skills/*/SKILL.md` guides (their `sources:` frontmatter is a
  symbol→file map for free). Emits `dox-knowledge.json`; a Vitest test asserts the
  349-function / ~999-example counts so corpus drift fails CI.
- **B2. Worker proxy** — `workers/dox-proxy` with `wrangler.toml`; key via
  `wrangler secret put GEMINI_API_KEY`. CORS locked to the deployed origin + localhost,
  unbuffered SSE passthrough. `systemInstruction` carries the corpus, GMT's core rules
  (ISO strings in/out, never `Date`, sentinel returns, invalid input never throws), and an
  explicit refusal instruction for out-of-corpus questions — this is how grounding is
  actually achieved; there is no `systemKnowledge` setting. Context caching enabled.

## Story Group C — Chat Core

The generative-UI mechanism: Dox invokes real widgets instead of writing code blocks.

- **C1. Chat UI, text only** — Transcript + composer + SSE client in TSRX, built from the
  Group A design system. Streaming markdown via `@octanejs/markdown` (fall back to a
  plain parser if it proves rough against partial streamed input — this layer is
  view-only). No widgets, no 3D, no voice yet — establishes a correct, grounded,
  streaming text answer first.
- **C2. Widget registry + first playground** — The widget contract, registered as Gemini
  **function declarations**, so the model calls `showPlayground({ fn, args })` instead of
  emitting a code block. The generic playground: editable inputs, live output computed by
  calling real `@burglekitt/gmt` (never simulated), sentinel-aware rendering (`""` shown
  as *invalid input*, not blank). Partial call args parsed with a partial-JSON parser —
  never `JSON.parse` per chunk.
- **C3. Widget set** — Timezone converter, DST-transition inspector (seeded from
  `docs/dst-disambiguation.md`), interval/duration visualizer, regex tester for the 16
  consts, signature card. Optionally an `@octanejs/cmdk` palette for jumping straight to
  a function.

## Story Group D — Scene & Motion

The ambient 3D backdrop the glass panels sample, and the choreography around it.

- **D1. Scene: globe + clockface** — `@octanejs/three` Canvas, full-bleed behind the
  glass panels (it must read well *through* blur, not just alone — see the panel
  construction note in overview.md §3). Wireframe globe with meridians for
  `zoned`/`utc`/`unix` topics, analog clockface for `plain` topics, blended idle state.
  `@octanejs/drei` supplies `OrbitControls`/`Html`. Scene subscribes to the active
  namespace and crossfades. Respects `prefers-reduced-motion`; pauses
  `requestAnimationFrame` when the tab is hidden.
- **D2. Motion pass** — `@octanejs/motion` for widget entry/morph choreography, plus CSS
  primitives: `view-transition-name` so widgets morph rather than pop, `@starting-style` +
  `transition-behavior: allow-discrete` for entry/exit, Popover API for tooltips. Boot
  sequence on first paint, typewriter reveal for replies, glitch/RGB-split on state
  transitions only (never idle). `startViewTransition` debounced — running it per token
  thrashes.

## Story Group E — Audio

Sound design and the two-tier voice system. `speechSynthesis` output cannot be captured
by any browser spec, so tier 1 and tier 2 are genuinely different techniques, not a
progressive enhancement of the same one.

- **E1. UI sound design** — Web Audio oscillators + short envelopes, no audio files.
  Cues for keypress, send, response-start, token stream, widget materialize, error,
  hover/focus — each under ~60ms, slight random pitch detune so repeat keypresses don't
  machine-gun. Muted by default with a persisted toggle; `AudioContext` only after a user
  gesture; silenced under `prefers-reduced-motion` too (motion and sound sensitivity
  correlate).
- **E2. Voice tier 1** — `speechSynthesis` behind an explicit gesture. Text chunked at
  sentence boundaries to dodge Chrome's ~15s/~200-char cutoff. Handles the
  `voiceschanged` race (`onvoiceschanged =` assignment — Safari lacks
  `addEventListener` here). Visualizer driven from `boundary` events, explicitly labeled
  in code as a driven approximation, not real audio — because it isn't.
- **E3. Voice tier 2 (opt-in HD)** — `kokoro-js` behind an explicit "download HD voice"
  action (~80–300MB, cached; WASM fallback where WebGPU is absent). Its Float32 PCM feeds
  a real graph: ring modulator (`OscillatorNode` → `GainNode.gain`, ~30 Hz) → bitcrusher
  `AudioWorkletProcessor` → `WaveShaperNode` → `AnalyserNode` → destination — a genuine
  vocoder and a genuinely synced visualizer, which tier 1 cannot offer.

## Story Group F — Content & Launch

- **F1. Scenario corpus (the teaching layer)** — ~12–15 markdown docs in
  `apps/dox/content/scenarios/`, seeded from the 17 `skills/` guides: booking across a
  DST boundary, storing vs. displaying timestamps, why `Pacific/Chatham` (+12:45) breaks
  offset assumptions, epoch seconds vs. milliseconds, recurring events across zone
  changes. Each states the trap, the wrong approach, and the `gmt` answer, folded into
  the corpus at high retrieval priority. This is what makes Dox teach rather than just
  document — B1's extraction gives accuracy, this gives judgment.
- **F2. Deploy** — GitHub Actions: build `@burglekitt/gmt` → build knowledge bundle →
  build `apps/dox` → Pages, plus a separate `wrangler-action` step for the Worker.
