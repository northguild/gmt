# Visual design language

> Extracted from `overview.md` §3 on 2026-09-02. The language spec is below. The
> implementation rules (token order, maintenance rules, screenshot-diff gate) live in
> [reference/design-system.md](design-system.md) — load that when actually styling
> components.
>
> See also: [overview.md](../overview.md) for architecture and the tier table.

This section is unchanged in substance from the superseded plan — it was the strongest
part of it — but it is **demoted from a day-one gate to a Tier 3 input**. DOX-A5, in Tier 1,
ships the cheap 80% (palette, typography, tokens) as soon as there is real content to
style; DOX-D1–DOX-D2, in Tier 3, apply the expensive chrome over pages — and, by then,
widgets — that already work.

**Nothing may look like a default HTML control.** No stock `border-radius` buttons, no
system-chrome scrollbars, no browser-default focus rings, no unstyled `textarea`. The
reference is a videogame HUD, not a web app.

### The core tension — read this before styling anything

Game HUDs are built to be **glanced at**. Docs are built to be **read**: long
explanations, code, tables, teaching content. Most "cyber UI" attempts die here — they
set body copy in a display face, put scanlines over paragraphs, and add glow to text,
and the result is unusable after two minutes.

The rule: **maximal chrome, disciplined content surface.**

- Frames, panels, borders, corners, HUD furniture, meters, motion → go hard.
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

### Color — cyber blue/green (story DOX-A5)

Cool blue→green ramp on a blue-tinted near-black. Everything is a token; no literals in
component styles. In Starlight these map onto its documented CSS custom properties via
the `customCss` config option.

| Role               | Value                   | Use                                                  |
| ------------------ | ----------------------- | ---------------------------------------------------- |
| Void               | `#03080C`               | Page base                                            |
| Glass tint         | `rgba(6, 20, 26, 0.35)` | Panel fill over `backdrop-filter` (DOX-D1)           |
| Cyan (primary)     | `#22D3EE`               | Borders, active state, primary accent                |
| Spring (secondary) | `#4ADE80`               | Success, live values, ticking data                   |
| Teal (deep)        | `#0E7490`               | Idle borders, dividers, inactive chrome              |
| Ice (body)         | `#CFEAF2`               | **Long-form body copy**                              |
| Signal-lost        | `#F5A524`               | Sentinel returns — the one warm colour in the system |

**Body copy is Ice, not cyan or green.** Saturated blue-green text at paragraph length
is fatiguing and rarely clears contrast. The blue/green identity is carried by borders,
headings, labels, HUD furniture, and _live values_ — the numbers, timestamps, and
offsets, which are exactly the elements that should glow. This keeps the palette
unmistakably cyber while the prose stays readable.

Tie the semantic palette to **GMT's sentinel contract** — on-theme _and_ functional.
Invalid input returning `""` / `null` / `false` / `[]` renders as a distinct "signal
lost" state (amber, degraded, bracketed) rather than a blank field. A user seeing an
empty output box learns nothing; a user seeing `⟨ NO SIGNAL — invalid input ⟩` learns
the sentinel contract. Amber is reserved exclusively for this — its rarity is what makes
it communicate. This is the rule that makes story DOX-B1a's playground _teach_ rather than
just execute.

Body text must clear **7:1**, measured against real rendered pages, not flat swatches.
Glow is decoration, never a contrast mechanism.

### Typography (story DOX-A5)

Two faces, strictly separated:

- **Display** (headings, labels, HUD furniture, buttons): a technical/wide face —
  Chakra Petch, Michroma, or Orbitron. Uppercase, wide tracking. Never below ~13px.
- **Body + code**: JetBrains Mono. Comfortable size, ~1.6 line-height, normal tracking.

Long-form teaching content is **never** set in the display face. All Google Fonts —
self-host the subsets, no external CDN request at runtime.

### Panel construction — real glass (story DOX-D1)

Surfaces are layered, never a single `div` with a border:

1. `backdrop-filter: blur(24px) saturate(1.4) brightness(0.45)` — the **`brightness`
   component is not optional**. Blur alone does not make text legible; darkening the
   backdrop is what creates a stable contrast floor. This is the single technique that
   makes glass work.
2. A very low-alpha tinted fill on top (`rgba(6, 20, 26, 0.35)`) — cools the glass and
   guarantees a contrast floor if `backdrop-filter` is unsupported or disabled.
3. Hairline 1px border, gradient along one or two edges only (not all four).
4. Inner top highlight — a 1px inset light line; the thing that reads as "machined".
5. Corner brackets via pseudo-elements — L-shaped, two opposing corners, not all four.
6. Optional static grain overlay (SVG `feTurbulence` data URI, **never animated**).

Under `prefers-reduced-transparency`, drop to a near-opaque fill and skip the blur.

### Animated borders (story DOX-D1)

The signature motion element. Three techniques, in order of preference:

- **Rotating conic gradient** — register an angle with `@property --angle` (Baseline
  since Firefox 128 completed support in 2024), animate it, and use it as a
  `conic-gradient` border via `background-origin: border-box` + `mask-composite:
exclude`. GPU-friendly.
- **SVG stroke trace** — an inset `rect` with animated `stroke-dashoffset`. Best when
  corners are chamfered, since the path can follow the bevel exactly.
- **Edge-gradient shimmer** — a translating linear-gradient masked to the border, for
  idle/ambient breathing.

Rules: animate **only** the focused/active/streaming panel — every panel pulsing at once
reads as broken, not alive. Idle panels get a static border. All of it stops under
`prefers-reduced-motion`.

### Chamfered corners (story DOX-D1)

Use `corner-shape: bevel` + `border-radius` where supported — `box-shadow`, `outline`,
`overflow` and `backdrop-filter` all follow the corner shape, which is exactly what
`clip-path` breaks.

**`corner-shape` is experimental and not Baseline.** Ship it as progressive enhancement
via `@supports`, with a `clip-path: polygon(…)` fallback — and note that under the
fallback, `box-shadow` and `outline` are clipped, so focus states must come from an
inset ring or a pseudo-element instead.

### Controls — the one hard engineering rule (story DOX-D1)

**Restyle native elements. Never rebuild them from `div`s.**

Keep real `<textarea>`, `<button>`, `<input type="range">`, `<select>`, and neutralize
them with `appearance: none`. Rebuilding as `div`s loses IME composition (breaks all CJK
input), autofill, mobile keyboard behavior, form semantics, and screen reader support —
and every one of those is invisible during development on a US-English desktop.

Starlight ships a good accessible baseline. Group D is what puts it at risk; the job
there is to restyle without regressing it.

Specifics:

- Composer: real `<textarea>` + `field-sizing: content` (Baseline since 2026-06-16 —
  Chrome 123, Firefox 152, Safari 26.2) to auto-grow, with a scroll-height JS fallback.
- Blocky terminal caret via `caret-color`, plus a bracket/underscore motif.
- Scrollbars: `scrollbar-width` + `scrollbar-color` (Baseline), `::-webkit-scrollbar`
  for finer control.
- **Focus must be more visible than default, never less.** `:focus-visible` gets an
  animated bracket or inset ring. Removing the outline without replacing it is the
  single fastest way to make this unusable by keyboard.

### Widget chrome (Tiers 2–5)

The 2026-08-21 draft's §3 covered panels, borders, controls and motion — everything a
chat console needs. It did not cover the surfaces this plan now builds on top of them:
timelines, scrubbers, draggable interval bars, and a globe. They obey the same split, but
the line between _housing_ and _content_ falls in a less obvious place.

**In a data widget, the plotted values are content, not chrome.** A dragged interval bar,
a DST transition marker, a clock face reading — these are the thing being read. They get
the same discipline as body copy: high contrast, no overlay texture, no glow that carries
meaning. The axis, the frame, the grid, the handles and the labels are housing and can go
as hard as any panel.

- **Live values glow; static values do not.** §3's Color section already reserves the
  blue/green identity for _live_ values — ticking clocks, offsets, computed results. That
  rule is what keeps a widget legible: the reader's eye is drawn to what changed. If every
  number glows, nothing does.
- **Sentinel treatment is mandatory in every widget, not just DOX-B1a's playground.** An
  interval function returning `[]`, a converter returning `""`, a zone lookup returning
  `false` — each renders as the signal-lost state. This is the rule that makes the widgets
  _teach_ rather than merely execute, and it must not be dropped as widgets multiply.
- **Distinguish the sentinel from a legitimately empty result.** `intervalIntersectionZoned`
  returning `[]` for two intervals that genuinely do not overlap is a _correct answer_, not
  invalid input. Rendering it as `⟨ NO SIGNAL ⟩` would teach the wrong lesson outright.
  Where the two are ambiguous, the widget must say which it is.
- **Never animate a value the reader is trying to read.** Transitions between states are
  fine; a value that is still settling while being read is not. This is the widget
  equivalent of §3's "never glitch over text being read."
- **Drag is never the only affordance.** Every draggable handle needs a keyboard path and a
  typed-input equivalent — see §7's accessibility risk. A timeline that can only be
  operated by dragging is unusable by a meaningful fraction of readers and is invisible as
  a problem during development.

### Motion (story DOX-D2)

Boot sequence on first paint. Glitch/RGB-split only on state _transitions_, never idle,
never over text being read. Scanline sweep confined to panel chrome. Chromatic aberration
and bloom belong in the WebGL layer (story DOX-E1a), not as CSS `text-shadow` on copy,
which destroys readability.

**Typewriter reveal for chat replies is a Tier 6 item, not a Tier 3 one.** DOX-D2 lands
before the chat exists in this sequence (Tier 3 vs Tier 6), so it ships the general
mechanism — a debounced, interruptible reveal primitive — and DOX-C3a wires it to streaming
replies when that tier is reached. DOX-D2 must not block on Tier 6 to close.

All of it gated behind `prefers-reduced-motion`, `prefers-reduced-transparency`, and
`prefers-contrast`.

### Performance notes

The superseded plan's largest performance liability was glass panels over a
continuously-rendering full-bleed WebGL scene, reacting to conversation state. That
specific failure mode is avoided here for a different reason than in the 2026-08-21 draft:
the globe is interactive (Tier 4, story DOX-E1a) but still lives on the landing page, not
behind every glass panel, so nothing in Tier 3's chrome has to stay legible over live
WebGL. Promoting the globe from decoration to a real feature did not reintroduce that
budget — it is still one canvas on one page. What remains:

- Cap blurred surfaces. Each `backdrop-filter` element re-samples what is behind it
  every frame. Avoid nested glass-within-glass.
- Never animate the grain overlay per-frame.
- Animate only the active panel's border — a performance rule as much as an aesthetic
  one.
- `will-change` only on elements actively animating, removed afterwards.
- Hydrate islands `client:visible`, never `client:load`. The playground pulls
  `@js-temporal/polyfill`, which is not small.

---

**For the implementation rules** (stylesheet stack, token order, `[data-theme="light"]`
discipline, the screenshot-diff gate), see
[reference/design-system.md](design-system.md).
