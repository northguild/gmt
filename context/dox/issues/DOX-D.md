# Issue #140–#141 — HUD identity

Two stories, unchanged in ID and largely unchanged in scope from the 2026-08-21 draft —
their only correction is the dependency fix below, which follows from the tier
restructure (see overview.md §5). The expensive half of the aesthetic, applied as a CSS
layer over pages — and, as of this rewrite, widgets — that already work.

`context/dox/overview.md` §3 is the specification for both stories — this file does not
restate it. Read §3 in full before starting either one, including its "Widget chrome"
subsection, which did not exist in the 2026-08-21 draft and covers the surfaces Tier 2
introduced. `DOX-D1` and `DOX-D2` together _are_ §3, implemented.

## Moved to Tier 3 in the 2026-08-26 rewrite

These stories now land after Tier 2 (the widget platform) and before Tier 4 (the globe)
and Tier 6 (the chat) — not after the chat, as the 2026-08-21 draft's dependency line
implied. **`DOX-D1` no longer depends on `DOX-C3a`.** The chat panel does not exist yet at
this point in the sequence; the natural glass surfaces are Tier 2's widget panels
instead. See the corrected dependency line under `DOX-D1` below.

## The sequencing is the mitigation

In the superseded plan this work was story A3 of 15 — built first, in isolation, on a
throwaway kitchen-sink page, before any product UI existed. Here it lands in Tier 3, on a
site that is already deployed, searchable, readable, and — since Tier 2 precedes it —
already interactive.

That ordering exists because the most likely failure mode in this epic is a screenshot
that looks incredible over a UI nobody can read for ten minutes. Landing the chrome after
Tier 0's site and Tier 2's widgets means Tier 3 can be reverted in full without losing
the documentation or the interactivity. **Judge it by reading a long reference page end
to end, never by the screenshot.**

## Definition of done — binding for every story in this file

- **Restyle native elements; never rebuild them from `div`s.** Keep real `<textarea>`,
  `<button>`, `<input type="range">`, `<select>` and neutralize with `appearance: none`.
  Rebuilding loses IME composition (breaking all CJK input), autofill, mobile keyboard
  behavior, form semantics, and screen reader support — every one of which is invisible
  during development on a US-English desktop.
- **Focus must be more visible than default, never less.** Removing an outline without
  replacing it is the fastest way to make this site unusable by keyboard.
- Everything gated behind `prefers-reduced-motion`, `prefers-reduced-transparency`, and
  `prefers-contrast`.
- No color literals. Every value goes through a DOX-A5 token.
- **Keyboard-only pass with the mouse unplugged, before and after.** DOX-A5's Definition
  of Done captured the "before" state deliberately so this comparison is possible.

---

### DOX-D1 — Chrome

**GitHub Issue:** #140 — see tracker.md\_

**Title:**

```
DOX-D1 Add glass panels, animated borders, and chamfered corners
```

**Description:**

```
Part of the Dox epic — see `context/dox/index.md`, Tier 3, item DOX-D1.
Depends on DOX-A5 (tokens) and Tier 2's widget panels (`DOX-B2b`–`d`), the natural glass
surfaces at this point in the sequence — **not** on the chat panel, which is Tier 6 and
does not exist yet. This corrects the 2026-08-21 draft, which depended on `DOX-C3`.

## Gap
DOX-A5 shipped palette and typography — the content surface. This story is the housing:
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
continuously-rendering full-bleed WebGL scene, does not apply here: the globe (`DOX-E1a`,
Tier 4, built after this story) lives on the landing page only, and nothing in this
story's chrome has to stay legible over it. Promoting the globe to an interactive
feature elsewhere in this rewrite did not reintroduce that liability. What remains is
ordinary `backdrop-filter` cost — cap the number of blurred surfaces and avoid nesting
glass within glass, and apply the same discipline to Tier 2's widget panels as to prose
panels, per overview.md §3 "Widget chrome".

## Definition of done
- Body text still clears **7:1**, measured against real rendered pages with the glass
  applied — not against flat swatches, and not against DOX-A5's pre-glass measurement.
- **Focus states verified in BOTH chamfer paths.** Under the `clip-path` fallback,
  `box-shadow` and `outline` are clipped, so the focus ring must come from an inset ring
  or pseudo-element there. Test in a browser without `corner-shape` support.
- `prefers-reduced-transparency` drops to a near-opaque fill with the blur skipped
  entirely.
- `prefers-reduced-motion` stops all border animation.
- Keyboard-only pass with the mouse unplugged — matching or beating DOX-A5's captured
  baseline, repeated for at least one Tier 2 widget panel.
- Read a long reference page end to end and confirm it is still comfortable. If it is
  not, reduce the chrome; do not reduce the contrast.
```

---

### DOX-D2 — Motion

**GitHub Issue:** #141 — see tracker.md\_

**Title:**

```
DOX-D2 Add boot sequence, view-transition morphs, and state-change motion
```

**Description:**

```
Part of the Dox epic — see `context/dox/index.md`, Tier 3, item DOX-D2.
Depends on DOX-D1.

## Gap
Without this, panels pop into place abruptly and there is no sense of a system booting.

## Scope
- Boot sequence on first paint: panels stagger in, HUD elements register.
- Entry/exit via `@starting-style` + `transition-behavior: allow-discrete`, Popover API
  for tooltips, and `view-transition-name` so elements morph rather than pop (all
  Baseline).
- **A general-purpose, debounced, interruptible reveal primitive** — not specifically
  for chat replies, since the chat (`DOX-C3a`, Tier 6) does not exist yet at this point in
  the sequence. `DOX-C3a` wires this primitive to streaming replies later; this story
  must not block on Tier 6 to close.
- Glitch/RGB-split **only** on state transitions — never idle, never over text being
  actively read.
- Scanline sweep confined to panel chrome, never over paragraphs.
- **Debounce `startViewTransition`.** Calling it per streamed token thrashes badly; this
  is the specific mistake to avoid.
- Chromatic aberration and bloom belong in `DOX-E1a`'s WebGL layer, **not** as CSS
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
- No layout jank when the reveal primitive is exercised (simulate streamed text if
  `DOX-C3a` is not yet built).
- Content is readable no later than it was before this story. Measure it; a boot
  sequence that delays first readable text is a regression regardless of how it looks.
- Keyboard-only pass still clean — motion must not steal or trap focus.
```
