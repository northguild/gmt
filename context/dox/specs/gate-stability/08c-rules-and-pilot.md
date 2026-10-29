# Slice 8c — the written rules, and the GNSS Week Decoder pilot

The kit (8a) and the cascade (8b) become binding rules in the agent and context docs. The first
widget then moves onto them end to end. Every later slice copies the pilot's pattern.

## 1 · Rules into the docs (present tense, no history)

**`.agents/dox-builder.md`, invariant 6 (lines 72-74).** Replace it with:

> **Widgets are an Astro shell, a pure `renderTemplate` built from the kit, and a `mount`.**
> - Markup comes only from `src/widgets/builders` and the `src/widgets/primitives` elements.
> - A missing piece is added to the kit, with a test, and never typed inline.
> - Style lives in the widget's CSS Module. Global sheets are layered and hold only tokens,
>   Starlight overrides and the shell.
> - No `nth-*` selector, no `!important`, no id selector, no colour literal in a module, and no
>   class shared across widgets.
> - State is a class or `data-*` attribute that the builder or mount sets.
> - Tests follow Testing Library: `screen` queries by role, label or text, `userEvent`,
>   jest-dom, and the `src/test/render-widget.ts` helpers only.

Add one invariant after it:

> **Accessibility is the component's job.** Each element owns its role, name, states and its
> WAI-ARIA APG keyboard model, and a builder will not compile without a label. Targets are
> WCAG 2.2 AA, with these house rules:
> - a 7:1 text floor;
> - targets of at least 24 × 24 px (SC 2.5.8);
> - focus never obscured (SC 2.4.11, through `scroll-padding`);
> - an `outline` focus ring that passes in forced colours and `prefers-contrast`;
> - motion from tokens that are 0 under reduced motion.
>
> Every component test runs `expectNoAxeViolations`.

**`.agents/dox-architect.md`, "What you must hold".** Add a bullet:

> **Specs name kit pieces.** A spec lists the builders and elements a widget uses. A piece the
> kit lacks is specced as a kit addition with its APG pattern, never as widget markup.

**`.agents/dox-tester.md`, "Surface gates".** Add a "Widget UI" bullet:

- `pnpm lint` is clean, with Stylelint and both local plugins inside it.
- `rg -n 'nth-(of-type|child)|!important' apps/dox/src` returns nothing new: compare it with the
  legacy lists.
- No new sheet appears in `src/styles/gmt.css` or `customCss`.
- Every touched widget's test file is off the legacy lists.

**`context/dox/built.md`, Tier 2 (after line 547).** Add two sections, each a decision and a
one-line reason:

- **"Component kit"** covers the 7 elements and 11 builders, and where they live.
  - Registration: `defineElements()` inside `mountX()`, with a `globalThis.HTMLElement`
    guard and one `AbortController` per connection.
  - CSS Modules: the naming function, and why the names are stable.
  - The layer order statement, which states that unlayered modules and Astro styles win.
  - The Baseline 2024 target and `cssTarget`.
  - Family pieces live in `src/widgets/families/<family>/`.
- **"Widget tests"** covers the kit helpers, the lint rules and the legacy lists that only
  shrink. It says that colour contrast and target size are measured in Chromium, never in
  jsdom.

**`context/dox/reference/design-system.md` § Maintenance rules.**
- Replace rule 5 (line 85, "No `@layer` in the GMT sheets") with the layer order and its
  reason: modules beat every global rule without `!important`.
- Rule 4 becomes "Respect the layer order". It no longer depends on bundle order.
- Add a "Custom elements and CSS Modules" section: light DOM, why there is no shadow root
  (global tokens and Starlight theming must reach inside), and the per-element contrast and
  forced-colour rules.

**`context/dox/reference/style-guide.md`, lines 10-19.** Rewrite where rules go:
- A widget rule goes in its module.
- A family rule goes in its family piece.
- A global rule goes in its `gmt.*` layer.
- Chat sheets sit in `gmt.chat`, after Tailwind's layers.
- The eight Astro components on `@layer starlight.*` keep it.

## 2 · Pilot: GNSS Week Decoder

**Current state (verified).**
- `src/lib/gnss-week-decoder-mount.ts` is 952 lines. Its template runs from :256 to about
  :410 and already has `data-widget`, `role="region"` and `aria-label` (slice 2). There is a
  module counter at :132 (`let instances = 0`), used for the radio group name at :264.
- Its test, `gnss-week-decoder-mount.test.tsx`, is 1003 lines and asserts a 40-item
  `REQUIRED_ROLES` list by `data-role`.
- Its styles: `gmt-gnss-week-decoder.css` plus the parts of `gmt-gnss-widgets.css` it uses,
  shared with gnss-rollover-checker and satellite-clock-converter. Cause 1's table fix (slice
  4) lives in that shared sheet.
- The shell is `src/components/GnssWeekDecoder.astro`. It mounts by a class query and seeds
  from `seedFromLocation("gnssweek")`. The registry entry is `gnssWeekEntry`
  (`widget-registry.ts:744`).

**Files.**
- **`gnss-week-decoder-mount.ts`.** `renderTemplate` uses the builders and elements only, with
  ids from `idScope(idPrefix)`, and the counter goes. `mount` calls `defineElements()` first
  and reads and writes element `value` properties. It keeps `getPermalinkState`.
- **`src/widgets/tools/gnss-week-decoder.module.css`** holds every rule the widget owns. It
  uses container queries on the widget root (docs column and chat rail), logical properties,
  and nesting.
- **`src/widgets/families/gnss/`** takes the pieces of `gmt-gnss-widgets.css` that this widget
  uses: lane, era pin and counter table, each as a builder with its module and test. The other
  two GNSS widgets keep the legacy classes until slice 9a. Delete those rules from the legacy
  sheet only once nothing uses them.
- **The shell** queries `[data-widget="gnss-week-decoder"]`, not a class.
- **`gmt-gnss-week-decoder.css`** is deleted, and so is its import in `gmt.css`.
- **The test** is rewritten on the kit. `REQUIRED_ROLES` becomes assertions by role and name:
  each control has a name, each lane is a labelled group, and each readout is an `<output>`
  with its text. Keep every behaviour case. Drive the week with `setRange` and the era radios
  with `user.click`, and end with `expectNoAxeViolations`.
- **Lint.** Take the mount, its test and its sheet off the slice 7 and 8b legacy lists.

## Traps

- Moving the rollover table's class into a family module must keep slice 4's
  `table-layout: fixed`. Unlayered module rules now beat the content-table rule, so delete the
  `:where()` work-around only for tables that have moved.
- `seedFromLocation` runs before `mount`. The elements must accept a value set before upgrade,
  so read the attribute in `connectedCallback`.
- In the chat rail, `MountedWidget.tsx` renders the same template. Check it at the rail's
  narrowest width.

## Definition of done

1. From `apps/dox`: `pnpm test`, `pnpm check` and `pnpm lint` pass.
2. Capture `html-diff` on HEAD before the change and compare after. Every `✗` line is a class
   rename, a kit tag or an id change that the report names. Then capture again.
3. Run all gates in Chromium, both themes, at 390 and 1440, on `/tools/gnss-week-decoder/`
   and the `/dox/` rail. `readout-still` must show no movement under drag.
4. **Chat rail.** Mount the decoder from a `/dox/` starter, then abort mid-load (close the
   rail). No console error, and no listener is left (the `destroy` check in the kit).
5. **Permalink.** Change week, era and system, copy the link, open it in a fresh tab, and the
   same state appears. Paste both URLs.
6. The doc edits in part 1 are in place, in present tense, with no slice or PR wording.
7. No card has a left-border-only accent.
8. `node scripts/verdict.mjs validate` passes.
