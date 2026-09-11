# Visual design language

> Implementation rules (sheet order, tokens, the visual gate) are in
> [design-system.md](design-system.md).

**Nothing may look like a default HTML control.** No stock `border-radius` buttons, no
system-chrome scrollbars, no browser-default focus rings. The reference is a videogame HUD —
Destiny 2 crossed with Deus Ex: Mankind Divided — not a web app, and deliberately not
Cyberpunk 2077's maximal glitch.

## The core tension

HUDs are built to be glanced at; docs are built to be read. The rule: **maximal chrome,
disciplined content surface.**

- Frames, panels, borders, corners, HUD furniture, meters, motion → go hard.
- Body copy, code, tables, widget values → high contrast, generous line-height, no overlay
  texture, no glow, no letter-spacing tricks.

## Colour

Cool blue→green on a blue-tinted near-black. Everything is a token.

| Role               | Value     | Use                                                        |
| ------------------ | --------- | ---------------------------------------------------------- |
| Void               | `#03080C` | Page base                                                  |
| Cyan (primary)     | `#22D3EE` | Borders, active state, primary accent; **Dox's voice**     |
| Spring (secondary) | `#4ADE80` | Success, live values, ticking data; **the reader's voice** |
| Teal (deep)        | `#0E7490` | Idle borders, dividers, inactive chrome                    |
| Ice (body)         | `#CFEAF2` | **Long-form body copy**                                    |
| Signal-lost        | `#F5A524` | Sentinel returns only — the one warm colour                |

- **Body copy is Ice, not cyan or green**, and clears **7:1** measured on real rendered pages.
  Glow is decoration, never a contrast mechanism.
- **Amber is reserved for GMT's sentinel contract.** An invalid-input result (`""` / `null` /
  `false` / `[]`) renders as `⟨ NO SIGNAL — invalid input ⟩`, never as a blank field. Its rarity
  is what makes it communicate.
- **Role colours in the transcript** resolve from one `--gmt-hive-role` per turn, so recolouring
  a role is one declaration.
- **The Dox mark** — the faceted crystal — is one geometry module (`src/lib/dox-mark.ts`) shared
  by the chat and the header link. It turns clockwise while Dox works and settles square when
  the answer lands (Web Animations API, `rotateZ` under a fixed `rotateX` tilt).

## Typography

- **Display** (headings, labels, buttons): a wide technical face, uppercase, wide tracking,
  never below ~13px.
- **Body and code:** JetBrains Mono, ~1.6 line-height, normal tracking.
- Long-form content is **never** set in the display face. Fonts are self-hosted.

## Panels

- Glass: `backdrop-filter: blur(24px) saturate(1.4) brightness(var(--gmt-brightness))` —
  `0.72` in dark, `0.97` in light. The darkening is what holds body text above 7:1 (measured
  11–16:1); do not raise dark above 1.0.
- A low-alpha tinted fill (the contrast floor where `backdrop-filter` is unavailable), a
  hairline gradient border on one or two edges, and a 1px inset top highlight.
- No corner brackets on surfaces and no grain overlay — both read as noise.
- One layer of glass, never glass within glass. Under `prefers-reduced-transparency`, a
  near-opaque fill and no blur.

## Corners, borders, focus

- `corner-shape: bevel` + `border-radius`; browsers without `corner-shape` fall back to plain
  radius. Focus rings are `box-shadow`, which `corner-shape` never clips.
- Focus is **more visible than default, never less**: a 2px cyan ring plus the sonar ping — one
  outward emit on focus (`gmt-focus-sonar`). Only the focused element animates; idle panels keep
  a static border.

## Controls — the one hard engineering rule

**Restyle native elements. Never rebuild them from `div`s.** Keep real `<textarea>`,
`<button>`, `<input type="range">` and `<select>`, neutralised with `appearance: none`.
Rebuilding loses IME composition (all CJK input), autofill, mobile keyboards, form semantics
and screen reader support — none of which is visible while developing on a US-English
desktop.

- Scrollbars keep the chunky `::-webkit-scrollbar` treatment. Do not add `scrollbar-color`: in
  Chromium it overrides the webkit styling wholesale.
- Blocky caret via `caret-color`.

## Widget chrome

- **In a data widget, the plotted values are content.** Bars, markers and clock readings get
  body-copy discipline; the axis, frame, grid, handles and labels are housing.
- **Live values glow; static values do not.**
- **Sentinel treatment is mandatory in every widget.**
- **Distinguish the sentinel from a legitimately empty result.** An interval intersection
  returning `[]` for intervals that do not overlap is a correct answer, not invalid input.
- **Never animate a value the reader is trying to read.**
- **Drag is never the only affordance.** Every draggable handle has a keyboard path and a typed
  input.

## Motion

- Navigation is plain and instant. No boot sequence, no scroll reveal, no scanlines, no view
  transitions — they flashed the deployed site on every navigation.
- **No typewriter reveal for chat replies.** Streamdown renders progressive markdown itself.
- If scroll-reveal is ever added, elements are visible by default (a JS stall must never hide
  content) and it reveals elements, never characters.
- Everything is gated behind `prefers-reduced-motion`, `prefers-reduced-transparency` and
  `prefers-contrast` (`gmt-a11y.css`).

## Performance

- The globe renders on the landing page, `/tools/zoned-earth/` and the `/dox` rail only — never
  behind panels.
- Cap blurred surfaces: each `backdrop-filter` re-samples what is behind it every frame.
