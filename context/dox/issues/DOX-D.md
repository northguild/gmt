# Issue #140–#141 — HUD identity

Two stories, Tier 3: the expensive half of the aesthetic, applied as a CSS layer over
pages and widgets that already work.

`context/dox/overview.md` §3 is the specification for both stories — this file does not
restate it. Read §3 in full before starting either one, including its "Widget chrome"
subsection, which covers the surfaces Tier 2 introduces. `DOX-D1` and `DOX-D2` together
_are_ §3, implemented.

## Sequencing

These stories land after Tier 2 (the widget platform) and before Tier 4 (the globe) and
Tier 6 (the chat). **`DOX-D1` does not depend on `DOX-C3a`** — the chat panel does not
exist yet at this point in the sequence; the natural glass surfaces are Tier 2's widget
panels.

The sequencing is the mitigation for this epic's most likely failure mode: a screenshot
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

### Issue #140 — DOX-D1

**GitHub Issue:** #140 — see tracker.md

#### DOX-D1 — Chrome

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
does not exist yet.

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

Glass over a continuously-rendering full-bleed WebGL scene would be a serious
performance liability, but does not apply here: the globe (`DOX-E1a`, Tier 4, built
after this story) lives on the landing page and `/dox` rail only, and nothing in this
story's chrome has to stay legible over it. What remains is ordinary `backdrop-filter`
cost — cap the number of blurred surfaces and avoid nesting glass within glass, and
apply the same discipline to Tier 2's widget panels as to prose panels, per overview.md
§3 "Widget chrome".

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

#### DOX-D1 — what shipped

DOX-D1 is done. The spec above is retained for context; this section is what actually
shipped and why it diverges. Cut items are not scheduled follow-ups unless a later story
picks them up.

##### Glass panels

- `backdrop-filter` retuned to `blur(24px) saturate(1.4) brightness(0.72)` in dark,
  `brightness(0.97)` in light — not the spec's literal `0.45`. Over the near-black
  void the low-alpha tint already carries the contrast floor; `0.45` only muddied the
  glass. `0.72` is the lightest darkening that still holds body text ≥ 7:1 on real
  rendered pages (measured 11–16:1). Light mode barely darkens at all — the device is
  for glass over the dark void, and over white it just dulls. Re-measure if changed;
  do not raise dark above 1.0. (`--gmt-brightness`, gmt-tokens.css.)
- Tinted fill, hairline border gradient (`.gmt-glass::before`), 1px inset top
  highlight (`.gmt-glass::after`) — kept from the pre-DOX-D1 glass layer, unchanged.
- **L-shaped corner brackets — not applied.** The `.gmt-brackets` primitive still
  exists but sits on no surface. Cut as visual noise at this size; revisit only if a
  later pass wants them.
- **Static SVG grain overlay — skipped** (the spec marks it optional).

##### Animated borders

- The rotating conic `@property --angle` border was built, then **removed.** Its
  box-shadow/spread rings read unevenly on a wide-short control — a bloom looks huge
  beside a 32px height and thin beside a 500px width.
- Replaced with **`gmt-focus-sonar`**: a "sonar ping" on the focused `<input>` /
  `<select>` — a hard 2px ring hugging the control plus a second ring that pulses
  outward and fades (`--gmt-motion-sonar-duration: 2s`). Every layer is 0-blur, so
  the stroke reads identically on every edge regardless of aspect ratio. Still
  honours the spec's rule — only the active element animates; idle panels keep the
  static `.gmt-glass::before` gradient — via a different technique.
  (gmt-form-controls.css; `gmt-motion-border.css` was deleted.)
  > **Later:** the ping was changed from a permanent loop to a single outward
  > emit on focus (`animation-iteration-count: 1`), settling on the still ring.
  > `--gmt-motion-sonar-duration` retuned 2s → 1.2s (the beat between emits is
  > gone). The looping form is kept as an unused utility, `.gmt-sonar-loop`
  > (`@keyframes gmt-focus-sonar-loop`, `--gmt-motion-sonar-loop-duration: 2s`),
  > for a future standing "look here" pulse. gmt-primitives.css.

##### Chamfered corners

- `corner-shape: bevel` + `border-radius` applied across panels and controls.
- **No `@supports` gate and no `clip-path: polygon()` fallback.** Firefox / Safari
  degrade to plain `border-radius`. The focus ring is a `box-shadow` that
  `corner-shape` never clipped in the first place, so it stays fully visible in the
  degraded path — the "verify focus in both chamfer paths" DoD line has no second
  path to test.

##### Scrollbars, caret, focus

- Kept the existing chunky bevelled `::-webkit-scrollbar` treatment (deliberate
  large-target a11y). **`scrollbar-width` / `scrollbar-color` not added** — in
  Chromium, setting `scrollbar-color` overrides `::-webkit-scrollbar` styling
  wholesale and regresses the primary look. Firefox keeps its native bar.
- `caret-color: var(--gmt-caret)` blocky caret on text fields — shipped.
- `:focus-visible` upgraded to a 2px cyan outline + soft outer glow; the sonar ping
  is the "animated … inset ring" the spec asks for on controls.

##### Accessibility gates

New `apps/dox/src/styles/gmt-a11y.css`:
`prefers-reduced-transparency` (blur dropped, near-opaque fill),
`prefers-contrast: more` (thicker borders, decorative shadows stripped),
`forced-colors: active` (system palette). `prefers-reduced-motion` is handled by the
existing global reset in gmt-controls.css, which collapses the sonar ping to its
still 2px ring.

##### Adjacent fixes made in the same pass

- Pagination pinned to a fixed 2-column grid so a lone prev/next link stays
  half-width and in a consistent position (gmt-controls.css).
- Expressive Code copy button restyled to match the playground's copy button — same
  box, icon, hover chip, and copied-state checkmark (gmt-primitives.css).
- In-field `::selection` given solid opaque high-contrast colours; the page's
  translucent cyan selection wash over an already cyan-tinted field was unreadable
  for low-vision readers (gmt-controls.css).

##### Verification run

- Body-text contrast on real rendered pages — **done**, 11–16:1.
- Keyboard-only pass (mouse unplugged, before/after, one widget),
  `prefers-reduced-transparency` / `-motion` / `-contrast` under devtools emulation,
  and a real Firefox / Safari check — **not run in this pass.** Carried as a
  follow-up verification task, not a code task.

---

### Issue #141 — DOX-D2

**GitHub Issue:** #141 — see tracker.md

#### DOX-D2 — Motion

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
- **A general-purpose reveal primitive for panel chrome and widgets** — a dock opening, a
  widget appearing, a section scrolling into view. **It is not a streamed-text
  typewriter.** Tier 6 renders replies with Streamdown, which handles progressive and
  incomplete markdown itself, and a typewriter layer would fight it. **Do not build a
  `push(chunk)` / text API** — the scroll-triggered `IntersectionObserver` in
  `apps/dox/src/lib/reveal-primitive.ts` is the correct shape. See
  `reference/visual-design.md` §Motion. This story must not block on Tier 6 to close.
- Glitch/RGB-split **only** on state transitions — never idle, never over text being
  actively read.
- Scanline sweep confined to panel chrome, never over paragraphs.
- **Debounce `startViewTransition`.** Calling it in a tight loop thrashes badly; this is
  the specific mistake to avoid.
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
- No layout jank when the reveal primitive is exercised on a panel or widget appearing.
- The reveal primitive exposes **no text/chunk API** — it reveals elements, not
  characters. Verify by reading the exported surface, not only by testing behavior.
- Content is readable no later than it was before this story. Measure it; a boot
  sequence that delays first readable text is a regression regardless of how it looks.
- Keyboard-only pass still clean — motion must not steal or trap focus.
```

#### DOX-D2 — what shipped

DOX-D2 is done. The spec above is retained for context; this section is what actually
shipped and why it diverges. Cut items are not scheduled follow-ups unless a later story
picks them up.

> **Hotfix `hotfix/gmt-dox-transitions` — most of DOX-D2's motion was reverted.**
> On the deployed Cloudflare Worker the navigation was clunky and the whole page
> flashed on every link click; it only looked smooth against the warm dev server.
> Root cause: `@view-transition { navigation: auto }` (cross-document view
> transitions) animating `::view-transition-old/new(root)` over a document that is
> still loading its CSS/fonts. A second regression: `.gmt-reveal` elements started
> at `opacity: 0` and only appeared once a bundled module ran an
> `IntersectionObserver`, leaving blank regions on slow prod JS.
>
> **Removed:** `gmt-motion.css`, `reveal-primitive.ts` (+ test), the boot
> sequence (`.dox-boot` gate in `ThemeProvider.astro`), the scanline sweep, the
> `startViewTransition` theme cross-fade in `ThemeSelect.astro`, the DOX-D2 motion
> tokens in `gmt-tokens.css`, and the `gmt-reveal` class from all six widgets /
> landing sections. The same PR's CI failure (an `astro sync` vs `astro build`
> file-rename race on `node_modules/.astro/data-store.json`, hit when nx runs
> `typecheck` and `build` concurrently) is fixed by making `dox:build`
> `dependsOn` `dox:typecheck` in `project.json` — typecheck runs its `astro sync`
> to completion first, so the two never touch the content-layer store at once.
>
> **Kept:** all DOX-D1 chrome, and the focus-only tab "sonar" ping in
> `gmt-content.css` (`@keyframes gmt-tab-sonar`, rides the DOX-D1
> `--gmt-motion-sonar-duration` token). Navigation is now plain and instant.
>
> If a later tier wants scroll-reveal, rebuild `reveal-primitive.ts` to the shape
> `reference/visual-design.md` §Motion describes — a scroll `IntersectionObserver`
> that toggles `.revealed` on `.gmt-reveal`, **no text/chunk API** — and make the
> elements visible by default so a JS stall never hides content.

The subsections below describe what originally shipped, for history.

##### Boot sequence

- Pure CSS animation (`@keyframes gmt-boot-in`, `gmt-motion.css`) on **shell chrome
  only** — `header`, `.sidebar-pane` / `#starlight__sidebar`, `mobile-starlight-toc nav`,
  each with a `--gmt-motion-boot-stagger` (60ms) delay. Never on a prose container, so
  first contentful paint of body text is byte-for-byte unchanged.
- Gated in `ThemeProvider.astro`'s existing inline `<head>` script (before `<body>`
  paints): a returning reader (`sessionStorage['dox-booted']`) or anyone with
  `prefers-reduced-motion` never gets the `.dox-boot` class, so the animation rules never
  match. The class is removed ~1.2s after `load`.
- No `boot-sequence.ts` module — the gate is ~10 lines inline; the stagger is CSS.

##### Reveal primitive

- `apps/dox/src/lib/reveal-primitive.ts` kept the spec's blessed shape — an
  `IntersectionObserver` toggling `.revealed` on `.gmt-reveal`. Rewritten: **one export**
  (`initRevealPrimitive`), one-shot (unobserve on first intersection, never reset), a
  `typeof window` guard, no scroll listener, no `destroy` (every navigation is a full
  load — no ClientRouter). `data-reveal-delay` (ms, clamped 0–1000) still honoured.
- **No text / chunk / `push()` API** — asserted by `reveal-primitive.test.ts`, which
  reads the export list, not just behaviour.
- Wired to the teaching widgets (`IntervalVisualizer`, `DstInspector`, `ConverterBench`),
  `ChartContainer`, `TimezoneMap`, and the landing `WhyNotDate` sections. Animates
  `opacity` + `transform` only — no reflow.
- Initialised from a **bundled** (module) `<script>` in `ThemeProvider.astro` — the
  earlier `<script is:inline>` could not see frontmatter imports and threw on every page.

##### View-transition morphs

- **CSS only, cross-document**: `@view-transition { navigation: auto }` +
  `view-transition-name` on `header`, `.site-title`, and (desktop only, to avoid a name
  collision) `.sidebar-pane`. Chromium / Safari 18.2+ morph the shell between page loads;
  Firefox and older Safari fall back to today's plain navigation. **No `<ClientRouter />`
  was added** — an SPA router would have needed every widget `<script>` re-wired for
  `astro:page-load` and changed the whole site's navigation model, for a motion story.
- **The one JS `startViewTransition`**: the light/dark toggle in `ThemeSelect.astro`
  cross-fades through it. A `busy` boolean guards it — that **is** the "debounce
  `startViewTransition`" DoD line; there is no other call site to thrash. Widget
  slider/preset changes stay CSS-only, deliberately.
- `@starting-style` / `transition-behavior: allow-discrete` and the Popover API: **not
  used** — the site has no custom `display: none` → visible surfaces or custom tooltips
  (Starlight owns its own). Nothing to convert.

##### Glitch / RGB-split — cut

- The earlier build ran a `MutationObserver` on every panel + `document.body` watching
  `characterData`, so any widget-output change triggered a glitch, and applied a
  `text-shadow` RGB split to every descendant. That is "idle" glitching and glitching
  "over text being read" — both forbidden — and `text-shadow` on copy is called out by
  name in §Motion. **Deleted** (`glitch-transition.ts`, the glitch keyframes, and
  `--gmt-motion-glitch-duration`). Not scheduled; the frost + sonar carry the identity.

##### Scanline sweep

- Kept, but rebuilt as a **one-shot** sweep fired when a panel *reveals* (folded into
  `reveal-primitive.ts`; `scanline-sweep.ts` and its `focusin`/`click` observer deleted).
  One pass as the panel arrives, never over a panel being read. `::after` layer,
  `overflow: hidden` on the panel only while `.scanline-active` is set.

##### Frost grain — tried, cut

- D1's optional static SVG grain was attempted here for the "ice sheet" feel — a tiled
  noise asset over the glass panels. Every placement (header, sidebar, home cards, chart
  panels, then just `.gmt-widget-card` via `background-blend-mode`) read as a grey film
  that dulled the fill colour and sat on the reading surface. Tuned progressively fainter
  until it was invisible, then **removed entirely**. The panel backgrounds are exactly
  D1's. Not scheduled; the sonar ping carries the HUD identity.

##### Sonar ping on tabs

- The install-page tab triggers got a directional variant, `@keyframes gmt-tab-sonar`
  (`gmt-content.css`) — the echo radiates up and out to the sides and pulls back from the
  bottom, where the tab meets the code panel. `.tablist-wrapper` + `[role="tablist"]`
  set `overflow: visible` (we wrap the tab row, never scroll it) and the focused tab gets
  `position: relative; z-index: 10` so the ping isn't clipped or drawn under its
  neighbours. The buttons/inputs keep D1's `gmt-focus-sonar` unchanged.

##### Accessibility gates

- `prefers-reduced-motion`: a dedicated block in `gmt-motion.css` neutralises boot,
  reveal, scanline, and `::view-transition-*`, on top of the global animation reset in
  `gmt-controls.css`.
- `prefers-reduced-transparency`: frost dropped (`gmt-a11y.css`).
- `prefers-contrast`: frost is faint soft-light on one surface — left in place; D1's
  contrast block already strips decorative shadows.
- `matchMedia` is read at init only (no live `change` listener) — matches D1.

##### Verification run

- `pnpm --filter @gmt/dox build` / `check` / `lint` / `test` (245 tests incl. the new
  `reveal-primitive.test.ts`) — **green**.
- Console clean on real pages (no `ReferenceError` — the inline-script wiring bug is
  fixed). Boot plays once per session; reveal + one sweep on scroll; tab ping radiates
  unclipped.
- Keyboard-only pass, `prefers-reduced-*` devtools emulation, real Firefox/Safari, and a
  full screenshot diff — **carried as the same follow-up verification task D1 opened.**
