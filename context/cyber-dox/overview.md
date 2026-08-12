# EPIC — Dox: AI documentation chat for `@burglekitt/gmt`

> This directory follows the same progressive-disclosure structure as
> `context/roadmap/`. Start at [index.md](index.md). This file (overview.md) holds
> context, architecture, and the visual design language; [story-groups.md](story-groups.md)
> holds the A–F build summary; [tracker.md](tracker.md) holds the issue/status table;
> `issues/A.md`–`issues/F.md` hold full per-story GitHub-issue-ready specs.
>
> Supersedes the original single-file draft. That version was LLM-generated and
> specified routes we no longer want plus a self-contradictory Octane + React Three
> Fiber stack. Every package and API claim below was verified against the npm registry
> and browser specs on 2026-08-12.

## 1. Context

`@burglekitt/gmt` exposes **349 functions** across `plain` (128), `zoned` (77), `unix`
(53), `utc` (52), `duration` (6), plus 16 `regex` consts. Today the only discovery path
is `packages/gmt/README.md`, whose "API Surface" section just links to GitHub tree URLs.

A 349-function temporal library is exactly the kind of API where users don't know what to
search for — the hard part isn't _finding_ `convertToZone`, it's knowing that DST
disambiguation is a problem they have.

Dox replaces the docs site that was never built. It is **one screen, no routes**: a chat
console where answers arrive as live, runnable UI rather than static code blocks, backed
by an ambient 3D scene that reacts to the topic under discussion. It teaches real-world
scenarios, not just signatures.

### Verified findings that shaped the design

- **Octane is real and far more complete than its age suggests.** `octane@0.1.35` (MIT,
  by Dominic Gannaway / trueadm — Inferno author, ex-React core), created 2026-06-22.
  `@octanejs/drei@0.0.1` — published 2026-08-12 — is an audited port of the complete
  `@react-three/drei@10.7.7` web API: 379 source exports, 217 runtime exports, 299 parity
  assertions across 105 test files run differentially against a real React 19 + R3F 9.6.1
  oracle, with exactly one documented divergence (`View.Port` is a no-op; inline Canvas
  views work). Its README states "no unsupported export is exposed as a stub."
- **Version trap.** `octane` has abandoned 2015-era `1.0.0`–`1.0.3` versions squatting
  the name, which sort _highest_ by semver. The `latest` dist-tag correctly points at
  `0.1.35`, but any range (`^1`, `*`) installs 11-year-old dead code.
  **Pin every Octane package to an exact version.**
- **The Vite plugin is in core** — `octane/compiler/vite`. A separate
  `@octanejs/vite-plugin` dep is not needed. `octane/compiler/volar` provides `.tsrx`
  editor support.
- **`speechSynthesis` output cannot be captured.** No spec in any browser exposes it to
  the Web Audio graph (`WebAudio/web-audio-api#1764`, `w3c/mediacapture-main#654`). A
  frequency visualizer "synced to" `speechSynthesis` is **impossible**, and it cannot be
  effects-processed. Chrome's "MediaStreamTrack support for the Web Speech API" is
  recognition _input_, not synthesis output — easy to misread as solving this.
- Therefore voice ships in two tiers: `speechSynthesis` with an honestly-driven
  visualizer, then **Kokoro** (`kokoro-js`, WebGPU/WASM, 82M params) as an opt-in
  download yielding real Float32 PCM — which unlocks a genuine vocoder chain and a
  genuinely synced `AnalyserNode`.
- **There is no `systemKnowledge` Gemini setting.** Grounding to only our corpus is
  achieved with `systemInstruction` + context injection + an explicit refusal
  instruction. This is more reliable than a config flag would be.

---

## 2. Architecture

```text
apps/dox/                  Vite 7 + Octane 0.1.35 (.tsrx) — ONE page, no router
  ├── scripts/build-knowledge.ts     JSDoc/README/skills → dox-knowledge.json
  ├── content/scenarios/*.md         hand-authored teaching docs (reviewed)
  └── src/
      ├── chat/            transcript, composer, SSE client
      ├── widgets/         generative-UI components (live gmt playgrounds)
      ├── scene/           @octanejs/three + drei — globe & clockface
      └── voice/           TTS tiers, AudioWorklet DSP, visualizer

workers/dox-proxy/         Cloudflare Worker — holds GEMINI_API_KEY, streams SSE
```

**Data flow.** Build extracts the corpus → Worker injects it as Gemini
`systemInstruction` (with context caching) → model answers **only** from that corpus, and
emits **function calls** rather than code blocks → client maps each call to a real widget
that executes actual `@burglekitt/gmt` code in-browser.

The generative-UI mechanism is the load-bearing idea: Dox does not _write_ a code block,
it _invokes a component_. Because `apps/dox` depends on `@burglekitt/gmt` via
`workspace:*`, widgets run the real library — the output shown is never simulated and can
never drift from shipped behavior. No `eval`; the model selects from a fixed widget
registry with typed params.

### Decisions taken

| Area        | Choice                                                                                                                                                                        |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework   | Octane `0.1.35` + TSRX, exact-pinned. No Astro (no routes ⇒ no islands needed)                                                                                                |
| 3D          | `@octanejs/three` + `@octanejs/drei` (`OrbitControls`, `Html`, `Text`, `Float`)                                                                                               |
| Model       | Gemini 2.5 Flash — free tier, best-in-class function-call arg streaming                                                                                                       |
| Key custody | Cloudflare Worker (free tier 100k req/day). Key never reaches the client                                                                                                      |
| Grounding   | `systemInstruction` + corpus injection + refusal instruction                                                                                                                  |
| Corpus      | ~80% generated from JSDoc, ~20% hand-authored scenarios                                                                                                                       |
| Voice       | Tier 1 `speechSynthesis`; Tier 2 opt-in Kokoro with real DSP                                                                                                                  |
| Markdown    | `@octanejs/markdown` / `@octanejs/mdx` — compile to real Octane components                                                                                                    |
| Motion      | `@octanejs/motion` + View Transitions + `@starting-style` + `allow-discrete` + Popover (all Baseline). **Not** scroll-driven animations — still flagged-off in Firefox stable |

### Octane adapter coverage (verified on the registry)

Available and used here: `three` `0.1.28`, `drei` `0.0.1`, `motion` `0.1.34` (reuses
motion-dom's engine with Octane host components), `cmdk` `0.1.18`, `markdown` `0.0.1`,
`mdx` `0.1.32`, plus `shadcn` / `radix` / `base-ui` / `aria` / `lucide` / `floating-ui` /
`sonner`.

No adapter exists for `ai`, `tailwind`, `form`, `query`, `table`, `i18n`, `dnd`,
`virtual` — none of which block this app. Tailwind is a Vite/PostCSS plugin and needs no
framework binding; no `ai` adapter is needed because the Worker speaks raw Gemini SSE and
the Vercel AI SDK never enters the stack.

**Use `pnpm` for all install and registry commands.**

---

## 3. Visual design language

**Nothing may look like a default HTML control.** No stock `border-radius` buttons, no
system-chrome scrollbars, no browser-default focus rings, no unstyled `textarea`. The
reference is a videogame HUD, not a web app.

### The core tension — read this before styling anything

Game HUDs are built to be **glanced at**. Dox is built to be **read**: long explanations,
code, tables, teaching content. Most "cyber UI" attempts die here — they set body copy in
a display face, put scanlines over paragraphs, and add glow to text, and the result is
unusable after two minutes.

The rule: **maximal chrome, disciplined content surface.**

- Frames, panels, borders, corners, HUD furniture, meters, motion, sound → go hard.
- Body copy, code, tables, widget values → high contrast, generous line-height, no
  overlay texture, no glow, no letter-spacing tricks.

The aesthetic lives in the _housing_; the content stays legible inside it.

### Reference direction

Primary reference is **Destiny 2 crossed with Deus Ex: Mankind Divided** — Destiny for
information hierarchy that survives motion and holds up in dense text, Deus Ex for the
angular gold-on-black chamfered geometry. Secondary texture cues from Alien: Isolation
(CRT phosphor) and NieR:Automata (restraint, negative space).

Deliberately _not_ Cyberpunk 2077's maximal glitch — it is the obvious reference and the
worst fit for a reading surface.

### Panel construction — real glass

Surfaces are **transparent glass over the live 3D scene**, layered, never a single `div`
with a border:

1. `backdrop-filter: blur(24px) saturate(1.4) brightness(0.45)` — the **`brightness`
   component is not optional**. Blur alone does not make text legible over a moving
   scene; darkening the backdrop is what creates a stable contrast floor while keeping
   the globe visible through it. This is the single technique that makes glass work.
2. A very low-alpha tinted fill on top (`rgba(6, 20, 26, 0.35)`) — cools the glass and
   guarantees a contrast floor if `backdrop-filter` is unsupported or disabled.
3. Hairline 1px border, gradient along one or two edges only (not all four).
4. Inner top highlight — a 1px inset light line; the thing that reads as "machined".
5. Corner brackets via pseudo-elements — L-shaped, two opposing corners, not all four.
6. Optional static grain overlay (SVG `feTurbulence` data URI, **never animated**).

Under `prefers-reduced-transparency`, drop to a near-opaque fill and skip the blur
entirely.

### Animated borders

The signature motion element. Three techniques, in order of preference:

- **Rotating conic gradient** — register an angle with `@property --angle` (Baseline since
  Firefox 128 completed support in 2024), animate it, and use it as a `conic-gradient`
  border via `background-origin: border-box` + `mask-composite: exclude`. Gives a light
  sweeping around the panel edge. GPU-friendly.
- **SVG stroke trace** — an inset `rect` with animated `stroke-dashoffset`, for a pulse
  that runs the perimeter. Best when corners are chamfered, since the path can follow the
  bevel exactly.
- **Edge-gradient shimmer** — a translating linear-gradient masked to the border, for
  idle/ambient breathing.

Rules: animate **only** the focused/active/streaming panel — every panel pulsing at once
reads as broken, not alive. Idle panels get a static border. All of it stops under
`prefers-reduced-motion`.

### Chamfered corners

Use `corner-shape: bevel` + `border-radius` where supported — `box-shadow`, `outline`,
`overflow` and `backdrop-filter` all follow the corner shape, which is exactly what
`clip-path` breaks.

**`corner-shape` is experimental and not Baseline.** Ship it as progressive enhancement
via `@supports`, with a `clip-path: polygon(…)` fallback — and note that under the
fallback, `box-shadow` and `outline` are clipped, so focus states must come from an inset
ring or a pseudo-element instead.

### Typography

Two faces, strictly separated:

- **Display** (headings, labels, HUD furniture, buttons): a technical/wide face —
  Chakra Petch, Michroma, or Orbitron. Uppercase, wide tracking. Never below ~13px.
- **Body + code**: JetBrains Mono. Comfortable size, ~1.6 line-height, normal tracking.

Long-form teaching content is **never** set in the display face. All Google Fonts —
self-host the subsets, no external CDN request at runtime.

### Color — cyber blue/green

Cool blue→green ramp on a blue-tinted near-black. Everything is a token; no literals in
component styles.

| Role               | Value                   | Use                                                  |
| ------------------ | ----------------------- | ---------------------------------------------------- |
| Void               | `#03080C`               | Page base, behind the 3D scene                       |
| Glass tint         | `rgba(6, 20, 26, 0.35)` | Panel fill over `backdrop-filter`                    |
| Cyan (primary)     | `#22D3EE`               | Borders, active state, primary accent                |
| Spring (secondary) | `#4ADE80`               | Success, live values, ticking data                   |
| Teal (deep)        | `#0E7490`               | Idle borders, dividers, inactive chrome              |
| Ice (body)         | `#CFEAF2`               | **Long-form body copy**                              |
| Signal-lost        | `#F5A524`               | Sentinel returns — the one warm colour in the system |

**Body copy is Ice, not cyan or green.** Saturated blue-green text at paragraph length is
fatiguing and rarely clears contrast over a moving backdrop. The blue/green identity is
carried by borders, headings, labels, HUD furniture, and _live values_ — the numbers,
timestamps, and offsets, which are exactly the elements that should glow. This keeps the
palette unmistakably cyber while the prose stays readable.

Tie the semantic palette to **GMT's sentinel contract** — on-theme _and_ functional.
Invalid input returning `""` / `null` / `false` / `[]` renders as a distinct "signal lost"
state (amber, degraded, bracketed) rather than a blank field. A user seeing an empty
output box learns nothing; a user seeing `⟨ NO SIGNAL — invalid input ⟩` learns the
sentinel contract. Amber is reserved exclusively for this — its rarity is what makes it
communicate.

Body text must clear **7:1 against the darkened glass**, measured with the scene running
underneath at its brightest frame — not against a flat swatch. Glow is decoration, never
a contrast mechanism.

### Controls — the one hard engineering rule

**Restyle native elements. Never rebuild them from `div`s.**

Keep real `<textarea>`, `<button>`, `<input type="range">`, `<select>`, and neutralize
them with `appearance: none`. Rebuilding as `div`s loses IME composition (breaks all CJK
input), autofill, mobile keyboard behavior, form semantics, and screen reader support —
and every one of those is invisible during development on a US-English desktop.

Specifics:

- Composer: real `<textarea>` + `field-sizing: content` (**Baseline since 2026-06-16** —
  Chrome 123, Firefox 152, Safari 26.2) to auto-grow, with a scroll-height JS fallback.
- Blocky terminal caret via `caret-color`, plus a bracket/underscore motif.
- Scrollbars: `scrollbar-width` + `scrollbar-color` (Baseline), `::-webkit-scrollbar`
  for finer control.
- **Focus must be more visible than default, never less.** `:focus-visible` gets an
  animated bracket or inset ring. Removing the outline without replacing it is the single
  fastest way to make this unusable by keyboard.

### Motion

Boot sequence on first paint (panels stagger in, HUD elements register). Typewriter
reveal for Dox's replies. Glitch//RGB-split only on state _transitions_, never idle,
never over text being read. Scanline sweep confined to panel chrome.

Chromatic aberration and bloom belong in the **WebGL layer** as scene postprocessing —
not as CSS `text-shadow` on copy, which destroys readability.

All of it gated behind `prefers-reduced-motion`, `prefers-reduced-transparency`, and
`prefers-contrast`.

### Performance budget

Glass over a continuously-rendering WebGL scene is the most expensive combination in this
design, and it is central rather than optional — so it gets an explicit budget:

- **Cap the blurred surfaces.** Each `backdrop-filter` element re-samples what is behind
  it every frame. Target **2–3 glass surfaces** (chat panel, composer, active widget) —
  not every message bubble. Nested glass-within-glass is the main thing to avoid.
- **Throttle the scene, not the UI.** The globe does not need 60fps. Render it at 30fps,
  or at reduced resolution scaled up, and spend the frame budget on the interface. Drop
  it further while a response streams.
- Never animate the grain overlay per-frame.
- Animate only the active panel's border (see above) — this is a performance rule as much
  as an aesthetic one.
- `will-change` only on elements actively animating, removed afterwards. Watch the
  compositing layer count.
- **Measure the real worst case:** scene rendering **and** a response streaming **and**
  border animation running, together. Each is fine alone; the combination is what drops
  frames. Verify on integrated graphics, not just a discrete GPU.

If the budget cannot be met, the honest lever is scene fidelity — fewer meridians, lower
render scale, slower rotation — not removing the glass, which is core to the identity.

---

## 4. Workspace integration (do first — three files, easy to miss)

`apps/` does not exist and is not a workspace glob. All three must be updated:

1. `pnpm-workspace.yaml` — add `- 'apps/*'`
2. root `package.json` — `"workspaces"` duplicates the glob; add `apps/*` there too
3. `oxlint.config.ts` — `files.include` lists `packages/**`, `docs/**`, `context/**`,
   `scripts/**`; add `apps/**`

Nx infers `build`/`typecheck` targets from `tsconfig.build.json` via `@nx/js/typescript`,
so `apps/dox` joins `nx run-many` automatically once it has one. Node `>=20 <25`,
pnpm `10.32.1`.

---

## 5. Work breakdown

The build is broken into 15 stories across six Story Groups (A–F), following the same
progressive-disclosure pattern as `context/roadmap/`:

- [story-groups.md](story-groups.md) — narrative summary of each story
- [tracker.md](tracker.md) — issue/status table, build order
- `issues/A.md` … `issues/F.md` — full GitHub-issue-ready spec per story

| Group | Covers |
| --- | --- |
| A | Workspace skeleton, Octane runtime boot, design system + control primitives |
| B | Knowledge extraction, Worker proxy |
| C | Chat UI, widget registry, widget set |
| D | 3D scene, motion pass |
| E | UI sound design, voice tier 1 (`speechSynthesis`), voice tier 2 (Kokoro) |
| F | Scenario corpus, deploy |

Each story is independently verifiable; do not start the next until the current one's
Definition of Done passes. Group A must complete first — every later group is built on
its Octane runtime and design-system primitives.

---

## 6. Verification

- `pnpm nx run-many -t lint test typecheck build` stays green, including the existing
  20-cell GMT timezone matrix — Dox must not perturb `packages/gmt`.
- The corpus test asserts function/example counts, so adding a `gmt` function without
  re-extracting fails CI.
- Widget outputs are computed by the real library, so they are covered transitively by
  the existing suite.
- Manual grounding check: a question with no corpus answer must be refused, not
  improvised — the single most important behavioral test.
- **Keyboard-only pass with the mouse unplugged**, on the finished UI. The aesthetic makes
  this easy to break and hard to notice.
- **Contrast audit against live frames**, not flat swatches — screenshot the busiest
  scene state and sample body text over it.
- **Frame budget on integrated graphics** with scene + streaming + border animation
  running together.

## 7. Risks

- **Octane churn.** 35 releases in 7 weeks; `@octanejs/drei` peers on exact `octane` and
  `@octanejs/three`, so upgrades are lockstep. Mitigation: exact pins, upgrade
  deliberately, keep chat logic in plain `.ts` so only the view layer is coupled.
- **Corpus size vs. free tier.** 349 functions plus examples may push request size.
  Measure during story B1; if needed, send namespace-scoped slices selected by a cheap
  first-pass classification rather than adding a vector DB.
- **Kokoro download** is a real cost on first use — hence opt-in, with tier 1 working at
  zero download.
- **Aesthetic vs. readability.** The most likely failure mode is a screenshot that looks
  incredible and a UI nobody can read for ten minutes. Mitigation is the §3 split —
  maximal chrome, disciplined content — plus the contrast and keyboard gates in story A3.
  Judge it by reading a long answer end to end, never by the screenshot.
- **Glass performance.** Transparent panels over a live WebGL scene is the expensive
  path, chosen deliberately. If the budget cannot be met, reduce scene fidelity rather
  than removing the glass.
- **`corner-shape` is not Baseline.** The chamfer is progressive enhancement; the
  `clip-path` fallback clips `box-shadow` and `outline`, so focus states must be verified
  in _both_ paths.
