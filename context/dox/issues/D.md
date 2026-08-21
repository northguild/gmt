# Story Group D — HUD identity

Two stories. The expensive half of the aesthetic, applied as a CSS layer over pages that
already work.

`context/dox/overview.md` §3 is the specification for both stories — this file does not
restate it. Read §3 in full before starting either one; D1 and D2 together _are_ that
section, implemented.

## The sequencing is the mitigation

In the superseded plan this work was story A3 of 15 — built first, in isolation, on a
throwaway kitchen-sink page, before any product UI existed. Here it lands eleventh, on a
site that is already deployed, searchable, and readable.

That ordering exists because the most likely failure mode in this epic is a screenshot
that looks incredible over a UI nobody can read for ten minutes. Landing the chrome last
means Group D can be reverted in full without losing the documentation. **Judge it by
reading a long reference page end to end, never by the screenshot.**

## Definition of done — binding for every Group D story

- **Restyle native elements; never rebuild them from `div`s.** Keep real `<textarea>`,
  `<button>`, `<input type="range">`, `<select>` and neutralize with `appearance: none`.
  Rebuilding loses IME composition (breaking all CJK input), autofill, mobile keyboard
  behavior, form semantics, and screen reader support — every one of which is invisible
  during development on a US-English desktop.
- **Focus must be more visible than default, never less.** Removing an outline without
  replacing it is the fastest way to make this site unusable by keyboard.
- Everything gated behind `prefers-reduced-motion`, `prefers-reduced-transparency`, and
  `prefers-contrast`.
- No color literals. Every value goes through an A5 token.
- **Keyboard-only pass with the mouse unplugged, before and after.** A5's Definition of
  Done captured the "before" state deliberately so this comparison is possible.

---

### D1 — Chrome

**GitHub Issue:** _blank — see tracker.md_

**Title:**

```
D1 Add glass panels, animated borders, and chamfered corners
```

**Description:**

```
Part of the Dox epic — see `context/dox/index.md`, Story Group D, item D1.
Depends on A5 (tokens) and C3 (the chat panel, the most natural surface for this).

## Gap
A5 shipped palette and typography — the content surface. This story is the housing:
overview.md §3's "maximal chrome, disciplined content surface" split, chrome half.

## Scope
- **Glass panels**, six layers, per overview.md §3 "Panel construction":
  `backdrop-filter: blur(24px) saturate(1.4) brightness(0.45)` — the `brightness`
  component is **not optional**; blur alone does not make text legible, and darkening
  the backdrop is what creates a stable contrast floor. Then the low-alpha tinted fill
  (which also guarantees a contrast floor where `backdrop-filter` is unsupported), a
  hairline border gradient along one or two edges only, a 1px inset top highlight, L-
  shaped corner brackets on two opposing corners, and optionally a static SVG grain
  overlay — never animated.
- **Animated borders**, preferring the rotating conic gradient: register the angle with
  `@property --angle` (Baseline since Firefox 128 in 2024), animate it, apply via
  `background-origin: border-box` + `mask-composite: exclude`. Animate **only** the
  focused/active/streaming panel — every panel pulsing at once reads as broken, not
  alive, and it is a performance rule as much as an aesthetic one. Idle panels get a
  static border.
- **Chamfered corners** via `corner-shape: bevel` + `border-radius`, as progressive
  enhancement behind `@supports`, with a `clip-path: polygon(…)` fallback.
- Restyled scrollbars (`scrollbar-width` / `scrollbar-color`, plus
  `::-webkit-scrollbar`), blocky terminal caret via `caret-color`, and an animated
  bracket or inset ring on `:focus-visible`.
- Apply over Starlight's existing components. Starlight ships a good accessible
  baseline; this story's real job is to restyle without regressing it.

## Before starting
Read `context/dox/overview.md` §3 in full — this story is that section.

Note that the superseded plan's largest performance liability, glass over a
continuously-rendering full-bleed WebGL scene, **no longer exists**: the globe is scoped
to a landing-page hero (E1) and nothing must stay legible over it. There is no
glass-over-live-WebGL frame budget to meet here. What remains is ordinary
`backdrop-filter` cost — cap the number of blurred surfaces and avoid nesting glass
within glass.

## Definition of done
- Body text still clears **7:1**, measured against real rendered pages with the glass
  applied — not against flat swatches, and not against A5's pre-glass measurement.
- **Focus states verified in BOTH chamfer paths.** Under the `clip-path` fallback,
  `box-shadow` and `outline` are clipped, so the focus ring must come from an inset ring
  or pseudo-element there. Test in a browser without `corner-shape` support.
- `prefers-reduced-transparency` drops to a near-opaque fill with the blur skipped
  entirely.
- `prefers-reduced-motion` stops all border animation.
- Keyboard-only pass with the mouse unplugged — matching or beating A5's captured
  baseline.
- Read a long reference page end to end and confirm it is still comfortable. If it is
  not, reduce the chrome; do not reduce the contrast.
```

---

### D2 — Motion

**GitHub Issue:** _blank — see tracker.md_

**Title:**

```
D2 Add boot sequence, view-transition morphs, and state-change motion
```

**Description:**

```
Part of the Dox epic — see `context/dox/index.md`, Story Group D, item D2.
Depends on D1.

## Gap
Without this, panels pop into place abruptly and there is no sense of a system booting.

## Scope
- Boot sequence on first paint: panels stagger in, HUD elements register.
- Entry/exit via `@starting-style` + `transition-behavior: allow-discrete`, Popover API
  for tooltips, and `view-transition-name` so elements morph rather than pop (all
  Baseline).
- Typewriter reveal for C3's streaming chat replies.
- Glitch/RGB-split **only** on state transitions — never idle, never over text being
  actively read.
- Scanline sweep confined to panel chrome, never over paragraphs.
- **Debounce `startViewTransition`.** Calling it per streamed token thrashes badly; this
  is the specific mistake to avoid.
- Chromatic aberration and bloom belong in E1's WebGL layer, **not** as CSS
  `text-shadow` on copy, which destroys readability.

## Before starting
Read `context/dox/overview.md` §3's "Motion" section.

Reconsider the boot sequence honestly for a documentation site: a reader arriving from a
search result to answer one question will see it on every cold load. Consider running it
once per session rather than per navigation, and make sure it never delays content
becoming readable. A docs site that withholds text for a flourish has traded its core
job for its personality.

## Definition of done
- Elements morph rather than pop.
- `prefers-reduced-motion` disables all of the above cleanly — verify in devtools, not
  by assumption.
- No layout jank while a C3 response streams.
- Content is readable no later than it was before this story. Measure it; a boot
  sequence that delays first readable text is a regression regardless of how it looks.
- Keyboard-only pass still clean — motion must not steal or trap focus.
```
