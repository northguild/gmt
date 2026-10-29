# Slice 8a — the component kit: elements, builders, registration, CSS Modules

Widgets stop hand-typing markup. Each recurring control is a light-DOM custom element, and each
layout piece is a typed builder that returns escaped HTML. Both ship with their own CSS Module.
Elements that no tool uses yet are still built and tested here: slices 8c–10g use them all.

## Current state (verified)

- `src/lib/widget-ui.ts` (469 lines) holds the shared helpers. `rangeFieldHtml` is at :336,
  `syncRange` at :353, `chipToggleHtml` at :411, `wireCopyButtons` at :167,
  `renderWidgetOutput` at :211, `renderAside` at :278 and `toolLinksHtml` at :443.
- Other helpers: `descriptionHoldHtml` (`ledger-widgets.ts`), `textSizers` (`edi-picture.ts:637`),
  `codeFrameHtml` (`code-frame.ts`) and `smoothHeights` (`smooth-height.ts`).
- Seven mounts hand-type a `role="slider"` handle: departure-board, dst-inspector,
  dwell-ledger, free-time-ledger, interval-visualizer, punctuality-board and timetable-reader.
- Ten mounts keep a module-level `let x = 0` counter for ids (for example
  `gnss-week-decoder-mount.ts:132`, used at :264).
- `renderTemplate(idPrefix, args)` returns a string and touches no DOM. Astro shells render it
  on the server with `<Fragment set:html>`, and `MountedWidget.tsx` sets `innerHTML`. Builders
  must stay pure string functions.
- Chip selected text is `color: var(--gmt-ice)` (`gmt-form-controls.css:584`) and is
  overridden per tool (cause 8). `--gmt-widget-card-bg` (`gmt-tokens.css:396`, light :541)
  is translucent, and nested cards stack it (cause 6).

## Files

Lay files out as `src/widgets/primitives/<name>/{<name>.ts,<name>.module.css,<name>.test.ts}`
and `src/widgets/builders/`.

### Elements (light DOM, no shadow root)

| Element | Replaces | Semantics and keys (WAI-ARIA APG) |
|---|---|---|
| `<gmt-range>` | `rangeFieldHtml`, `syncRange`, `rangePct` | Wraps a native `<input type="range">`. [Slider](https://www.w3.org/WAI/ARIA/apg/patterns/slider/): native keys, `aria-valuetext` from a `formatValue` property. |
| `<gmt-handle>` | the 7 hand-typed handles | `role="slider"`, `aria-valuemin`, `-max`, `-now`, `-valuetext`, `aria-orientation`. Arrows ±step, PageUp/PageDown ±largeStep, Home/End. Pointer drag with capture. Two on one track follow [Multi-Thumb Slider](https://www.w3.org/WAI/ARIA/apg/patterns/slider-multithumb/), each bounded by the other. |
| `<gmt-readout>` | `renderWidgetOutput`, `textSizers` | An `<output>` (implicit role `status`). It announces only on `change`, never on each `input` tick. It reserves the size of its widest declared sample, uses `font-variant-numeric: tabular-nums`, has no wrap, and shows a sentinel when empty. |
| `<gmt-preset>` | `descriptionHoldHtml`, `setPresetDescription` | A native `<select>` with a label, plus a description joined by `aria-describedby`. The height is reserved for the tallest description. |
| `<gmt-chips>` | `chipToggleHtml` | A `<fieldset>` with a `<legend>`, holding native inputs: [Checkbox](https://www.w3.org/WAI/ARIA/apg/patterns/checkbox/), [Radio Group](https://www.w3.org/WAI/ARIA/apg/patterns/radio/) or [Switch](https://www.w3.org/WAI/ARIA/apg/patterns/switch/) (`role="switch"`). It owns the selected colour, `var(--gmt-void)` on the solid accent (cause 8). |
| `<gmt-copy>` | `wireCopyButtons` | [Button](https://www.w3.org/WAI/ARIA/apg/patterns/button/). The result ("Copied", or the failure) goes to a polite live region that the element owns. |
| `<gmt-grow>` | direct `smoothHeights` calls | No role. It wraps `smooth-height.ts`, and its duration is `var(--gmt-motion-grow)`. That token is 0 under reduced motion (slice 8b). |

Every element follows these rules:

- Class base `const Base = (globalThis.HTMLElement ?? class {}) as typeof HTMLElement`, so a
  module imports in node and during SSR.
- One `AbortController` per connection. `connectedCallback` first aborts any previous
  controller, which keeps StrictMode's double connect idempotent, then wires listeners with
  `{ signal }`. `disconnectedCallback` aborts. An element that is moved re-wires.
- The element reads its initial state from attributes that the builder wrote, so SSR and
  `innerHTML` render the same markup. The mount reads and writes a `value` property, never
  inner nodes.
- The element emits `input` and `change` that bubble, with `detail.value`.
- Each element has a target of at least 24 × 24 CSS px
  ([WCAG 2.2 SC 2.5.8](https://www.w3.org/TR/WCAG22/#target-size-minimum)).
- Each element has a `:focus-visible` ring drawn with `outline` (it survives forced colours),
  plus its own `@media (forced-colors: active)` and `(prefers-contrast: more)` rules.
- `<gmt-handle>` keeps its pointer maths in an exported pure function,
  `valueAt(clientX, trackRect, min, max, step)`, which is unit-tested in node.

### Registration

`src/widgets/define.ts` exports `defineElements()`. It calls `customElements.define` only when
`customElements.get(name)` is undefined, and it does nothing when `customElements` is missing.
Each `mountX()` calls it on its first line. Never call it at module top level: SSR and node
tests import these modules. `customElements.define` upgrades elements that are already in the
document, so the order of `innerHTML` and `mount` does not matter.

### Builders (`src/widgets/builders/`)

- **`html.ts`**: an `html` tagged template that returns a branded `SafeHtml`. It escapes every
  interpolation that is not `SafeHtml` and joins arrays. Port `escapeHtml` and `escapeAttr`
  from `widget-ui.ts` and test them on `<`, `&`, `"`, `'` and backticks. It also exports
  `setHtml(el, value: SafeHtml)`, the one runtime `innerHTML` assignment a mount may make, so a
  redraw can only write builder output.
- **`ids.ts`**: `idScope(idPrefix)` returns `(local) => \`${idPrefix}-${local}\``. It replaces
  every module counter.
- **`index.ts`** exports `widget`, `card`, `section`, `fieldGrid`, `field`, `hint`, `hero`,
  `aside`, `toolLinks`, `table` and `codeFrame`. The arguments that give an accessible name are
  required in the types:
  - `widget` takes `{ name, label }` and writes the slice 2 root: `data-widget`,
    `role="region"` and `aria-label`.
  - `section` takes `{ heading, level }` and writes `<section aria-labelledby>`.
  - `field` takes `{ label }`, `aside` takes `{ label }`, `table` takes `{ caption }` and
    `codeFrame` takes `{ label }`.
  - `hint` returns an id that `field` joins to `aria-describedby`.
  - `table` takes typed columns, `{ key, header, align: "start" | "end", numeric }`. It writes
    the alignment and numeric state as classes on each cell, so the CSS needs no `nth-*`.
  - `codeFrame` adds `tabindex="0"` when its content can scroll.
- **One surface.** `card` and `section` paint `var(--gmt-surface-widget)`, a new opaque token
  in `gmt-tokens.css`, dark and light. It is `color-mix()` of today's tint over
  `--gmt-void`, so the colour matches today's single layer and nested cards no longer stack
  (cause 6). `--gmt-widget-card-bg` stays until slice 11 deletes it.
- **`hero`** takes `{ caption, value, tone? }`. It owns its caption ink on that surface
  (cause 7), and its value reserves size the way `<gmt-readout>` does.

### CSS Modules

In `astro.config.mjs` `vite.css.modules`, set:

- `localsConvention: "camelCaseOnly"`;
- `generateScopedName: (local, file) => \`gmt-${basename(file, ".module.css")}__${local}\``.

The names are readable and stable, so `html-diff` diffs stay legible and never churn on a
content edit.

`src/widgets/module-names.test.ts` fails when two `.module.css` files share a basename. Module
rules are unlayered, so they beat every layered global sheet (slice 8b). They use native
nesting and container queries, and select no element outside their own module.

## Tests

Each `<name>.test.ts` uses the slice 7 kit only, with queries by role and name.

- `<gmt-handle>`: the APG keys, values clamped at the bounds, two thumbs that never cross, and
  `aria-valuetext` after each key. `valueAt` has node tests at the edges, including a
  zero-width track.
- `<gmt-readout>`: it announces on `change` and not on `input`, and its sentinel shows when
  the value is empty.
- `<gmt-chips>`: Tab enters a radio group once, and the arrow keys move the selection.
- `<gmt-copy>`: clipboard success and failure each reach the live region.
- `<gmt-preset>`: the description follows the selection.
- Every element test ends with `expectNoAxeViolations`. A connect, disconnect, connect test
  proves that no listener is doubled.
- Builders: the escaping cases, plus a type test (`expectTypeOf`) that `field` without a
  `label` is rejected.

## Definition of done

1. From `apps/dox`: `pnpm test`, `pnpm check` and `pnpm lint` pass.
2. Create a scratch Astro page (delete it after) with every element, server-rendered. In
   Chromium, check that each element upgrades without a hydration mismatch and with no console
   error, in both themes, at 390 and 1440.
3. On that page, with forced colours emulated and with `prefers-contrast: more`, every focus
   ring is visible. Measure the ring contrast against the surface.
4. On that page, the readout and hero boxes keep their size under a keyboard sweep from min to
   max. The scratch bounding-box check uses the `readout-still` method.
5. **Forced colours, every component.** Each of the 7 elements and each builder that paints a
   surface has a `@media (forced-colors: active)` rule in its module, using system colours
   (`CanvasText`, `Highlight`, `ButtonText`). With forced colours emulated on the scratch page,
   every control, handle, chip and focus ring is visible: paste one screenshot per element.
6. **Axe in every component test.** Every element and builder test file calls
   `expectNoAxeViolations`; a guard test fails if a `src/widgets/**/*.test.ts` file does not.
7. **SC 2.5.8 and SC 2.4.11.** On the scratch page, every interactive target is at least
   24 × 24 CSS px (measure each bounding box at 390 and 1440), and `a11y-tab-walk` reports no
   `focus-obscured`.
8. `node scripts/verdict.mjs validate` passes.
