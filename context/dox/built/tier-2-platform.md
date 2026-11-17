# Tier 2: widget platform

Part of [built/index.md](index.md). Tool rules: [tier-2-tools.md](tier-2-tools.md). Gates and CI: [tier-2-gates.md](tier-2-gates.md).

## Component kit

- Builders live in `src/widgets/builders`, the nine custom elements in `src/widgets/primitives/<name>/`, family pieces in `families/<family>/`. A tool's own layout is a CSS Module in `src/widgets/tools/`. No global form sheet exists; a new tool composes kit controls and adds no control CSS (rules: `reference/design-system.md` § Form controls).
- A builder takes its accessible name as a required argument. Optional fields end in "(optional)". `textInput` is always `type="text"`.
- `hold(live, ghosts)` keeps a cell's box stable. `.field` has a `minmax(0,1fr)` track.
- `toolLinks` start `aria-disabled` with no href until `setToolLink`. `copy()` with `reveal: true` shows the text on failure.
- `combobox()` takes `placement`. Trap: a caller's popup class must compose `listboxRootClass`.
- `drawer` and `edgeControl` follow APG Disclosure; Escape is a layer (see Escape below).
- `defineElements()` is called inside each `mountX()`, never at module top level.
- CSS Module names are `gmt-<file>__<local>`.
- Every widget root carries `data-widget="<mount name>"`, `role="region"`, an `aria-label`, `not-content` and `container-type: inline-size`, so Starlight prose spacing never reaches it.
- A disabled input or select has one shared style (dashed border, no fill, `opacity: 1`, `GrayText` in forced colours). A widget sets `disabled` and styles nothing; a select is always the `select` builder.
- Trap (Astro 7 `compressHTML: "jsx"`): a line break next to an element or `{expression}` deletes the space. Keep the space on the element's line or write `{" "}`. `scripts/lib/inline-whitespace.mjs` finds cases; `scripts/inline-whitespace.test.ts` fails on any `.astro` under `src/`.

## Global sheets and layers

- Only site-styling sheets are global, each in a `gmt.*` layer. Rendered elements use CSS Modules, component `<style>` blocks or plain sheets under `src/components/`, never `gmt.css` or `customCss`.
- Layer order: `starlight, theme, base, components, utilities, vendor, gmt.tokens, gmt.base, gmt.shell, gmt.content, gmt.controls, gmt.tools, gmt.chat, gmt.thirdparty, gmt.a11y`. Unlayered rules beat every layer, so modules need no `!important`.
- Browser target is Baseline 2024 (`build.cssTarget` chrome130, edge130, firefox132, safari18.2); Stylelint `use-baseline` enforces it.
- The Michroma face is inlined as a data URI. `Footer.astro` runs `displayFaceInlineSource()` before `#gmt-page-end`. No preload. `display-fallback.test.ts` and `scripts/display-font-built.test.ts` pin it. The fallback uses `local()` mono faces with `size-adjust: 130%`.
- Cards and sections sit on one opaque `--gmt-surface-widget` (7:1 contrast).
- The prose list dash applies to Markdown lists only: rules skip `ul` with a class and anything in `not-content`. `content-list-rule.test.ts` guards the selectors.
- Forced-colours rules go in the CSS Module that draws the element. A module is unlayered, so it beats `gmt-a11y.css` whatever the specificity. A mark drawn as a `background` gradient vanishes in forced colours and needs a system-colour rule.

## Widget tests

- `src/test/render-widget.ts` is the only place that touches the DOM by hand.
- Every component test runs `expectNoAxeViolations` (guard: `src/widgets/axe-guard.test.ts`). `color-contrast` and `target-size` are off in jsdom; the `a11y-axe` and `contrast-measure` gates measure them.
- Lint plugins `dox-test` and `dox-src` ban `dispatchEvent`, class queries, `data-role`, hand-typed markup, `nth-*` selectors, module-level instance counters and import-time element registration. Stylelint bans `!important`, id selectors and colour literals in modules.
- Legacy lists (`lint/legacy-test-files.mjs`, `lint/legacy-src-files.mjs`, `LEGACY_FILES` in `stylelint.config.mjs`) only shrink. A migrated file never returns.
- `Date.parse` is banned in tests too (`date-ban.test.ts`, oxlint). Use `Temporal.Instant.from(...).epochMilliseconds`.

#### Test isolation

- `src/test/isolation.ts` scans test sources. A file that calls `vi.mock`, `vi.doMock`, `vi.stubGlobal` or `vi.stubEnv` itself runs in the `isolated` project; every other file runs in `shared`. The scan runs once at start: restart watch mode after adding a `vi.mock`.
- `*.browser.test.ts` files stay out of both projects (`BROWSER_TEST_GLOB`) and run through `vitest.browser.config.ts`. `maxConcurrency` is 4.
- `setup-dom.ts` resets spies, fake timers, stubGlobal/stubEnv, widgets, DOM, storage and cookies. It never imports Testing Library.
- `installJsdomShims` puts `Event.timeStamp` on the `performance.now()` clock.
- A test undoes anything else it creates. `src/test/leak-guard.ts` fails a file that ends with a changed global, `Intl` member, env var or listener.
- Four things break holds: re-inserting a `data-enter` card; toggling a copy button inside a hold with `hidden` instead of `visibility: hidden` plus `inert`; measuring before `document.getAnimations()` finishes; writing NBSP as a literal character instead of `" "`.

## Element identity and gate hooks

- Gates find a widget by `[data-widget]`, never a `.gmt-*` class. A finding's `target` is the identity key from `scripts/lib/element-identity.mjs` (never id, class or `nth-*`); `recordFinding` throws without one.
- Controls are found by `getByRole(role, { name, exact: true })` through `scripts/lib/locate.mjs`. A part with no role or name carries a `data-gate` hook (`gate("part")`, written by `gateAttr()`). `--resolve-only` checks that locators resolve.
- Gate hooks (about 35) and their readers: `frame`, `hero`, `drawn`, `moving`, `notam`, `track`, `rider`, `hold`, `grid`, `codeframe`, `instant`, `live`, `live-face`, `grow` feed `readout-still`, `visual-snapshot` and `grow-measure`; `globe-*` feeds `globe-smoke`; `hero-*` feeds `hero-space`; `credited-frame` feeds `data-credits-check`; the Canada, Morocco and US checker hooks feed `canada-layout-check`, `canada-stored-still`, `canada-clock-still` and `contrast-measure`. Read the hook list from the code, not here.
- Gate diagnostics: `emulation-not-applied`, `layout-moved-during-measure` (0.5 px), `focus-obscured`, and load-jump naming.
- A region the mount rewrites sits in `<gmt-grow>` or a `hold`. Weekly Firefox and WebKit findings are fixed in the product, never waived.

## Playground

- The generator renders the first `@example` plus `PlaygroundForm.astro`, seeded from `LIVE_PLAYGROUND_TEMPLATES`.
- `GMT_MODULES` (`src/lib/gmt-modules.ts`) holds one dynamic import per module. `gmt-modules.test.ts` keeps its keys equal to the exports map.
- Unit-object controls use the key sets in `build-utils.ts`; the select offers one name per unit (singular): `collapseUnitAliases`, `playground-templates.test.ts` "one name per unit", `scripts/select-options.test.ts`.
- Trap: the first `@example` of a function that takes a unit object writes one key.
- Sentinel output: `""`, `null`, `false` or `[]` from invalid input renders as amber NO SIGNAL. `NULL_IS_EMPTY` lists functions where `null` means empty.

## Escape: one order for the whole site

- `lib/esc-layers.ts` (`registerEscLayer`) is the one helper and the one `keydown` listener (bubble phase). A layer registers `{ el, isOpen, close, opener }` and never listens for Escape itself: a layer that does breaks the cascade. Tests: `esc-layers.test.ts`, `esc-native.test.ts`; gate: `esc-cascade.mjs`.
- One press closes one layer and consumes the press (`preventDefault`, `stopImmediatePropagation`).
- Order (`pickLayer`): a `focusOnly` layer counts only while focus is in it; an outer layer gives way to an inner one; a layer named as another's `over` gives way to it; layers that hold focus go next; then the last opened. A layer whose state lives in a closure or React calls `changed()`.
- Focus returns to the opener (APG), never `<body>`; if the opener is `inert` or gone, focus stays. A layer with `returnsFocus` (the chat rail widget) does it itself.
- Native layers join automatically (`lib/esc-native.ts`, rendered by `EscLayers.astro`): every `[popover]` except `manual`, every `<dialog>`, every `<details>` outside a `nav` or `[data-esc-skip]`.
- React uses `useEscLayer` (`components/ask/use-esc-layer.ts`); a Radix popover ignores its own Escape (`onEscapeKeyDown` prevents it).
- The landing carousel is not a layer. The zone card on a framed globe is a layer only once a zone is chosen (`globe-mount.ts`).
