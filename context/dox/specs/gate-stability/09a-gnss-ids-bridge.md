# Slice 9a — family pieces, then four #429 widgets: rollover, satellite, ID decoder, column bridge

The slice starts with the kit pieces that two or more widgets share. It then moves the first
four #429 widgets onto the kit, and fixes causes 6, 7 and 8 on their pages. Slices 9b–10f use
the **migration recipe** below and do not repeat it.

## Current state (verified)

Widget sizes:

| Widget | Mount | Test | Sheet | Kit pieces it needs |
|---|---|---|---|---|
| gnss-rollover-checker | 928 | 1075 | 812 | range ×2, chips, preset, hero ×3, copy, readouts ×8, asides ×4; module counter |
| satellite-clock-converter | 600 | 796 | 562 | range ×2, preset, hero, copy, readouts ×6, asides ×4 |
| id-timestamp-decoder | 484 | 260 | 315 | preset, hero ×6, copy, readouts ×6 |
| column-timestamp-bridge | 766 | 536 | 363 | chips, preset, hero ×4, copy, readouts ×7; module counter; `!important` cause at `:24` |

Shared family classes in the mounts (`grep -ohE 'gmt-(ledger|cutoff|punct|…)-…' src/lib/*-mount.ts`):

- `gmt-cutoff-chip` ×72 and `gmt-cutoff-chip--dim` ×13;
- `gmt-ledger-hold` ×67;
- `gmt-punct-hero*` ×43 in total;
- `gmt-edi-verdict` ×12 and `gmt-transport-verdict` ×8;
- `gmt-*-swatch` ×23;
- visually-hidden classes in three families (`gmt-ledger-sr`, `gmt-gnss-visually-hidden`,
  `gmt-transport-visually-hidden`) ×27;
- lane, axis, mark and tick classes (`gmt-ledger-lane*`, `gmt-cutoff-axis-tick`,
  `gmt-cutoff-mark`) ×35.

These are kit pieces that live in family sheets, and they are why widgets share classes today.

Cause 7 is `.gmt-punct-hero`: `gmt-punctuality-widgets.css:162` styles a caption for the
punctuality family, and the column bridge (`column-timestamp-bridge-mount.ts:346`) and the ID
decoder use it on a different surface.

## 1 · Kit additions (before any widget)

Each addition gets the 8a layout and tests, axe included.

| Piece | Replaces | Notes |
|---|---|---|
| `badge({ text, tone, dim? })` builder | `gmt-cutoff-chip` and `--dim` | Static text, not a control. Tone is a typed union whose ink passes 7:1 on `--gmt-surface-widget`. |
| `verdict({ tone, title, detail })` builder | `gmt-edi-verdict`, `gmt-transport-verdict` | A `<p>`. Its live behaviour comes from the parent `<gmt-readout>`. Accent is a **bottom border or a full bevelled border, never a left edge**. |
| `swatch({ series })` builder | `gmt-*-swatch` | `aria-hidden`. The name lives in the adjacent text. |
| `srOnly(text)` builder | the three visually-hidden classes | One global utility class in `gmt.base`, the only non-module class the kit writes. |
| `timeline` builders: `lane`, `axis`, `mark`, `tick` | the ledger and cutoff lanes and axes | Positions are set by the builder as `--gmt-at: <0–1>` and read by the module with `inset-inline-start: calc(var(--gmt-at) * 100%)`, so there is no `transform` for layout. A lane is `role="group"` with a label. |
| `plates` builder | `plateHtml` / `platesHtml` (`ledger-widgets.ts`) | A `<dl>`, so each value has its term. |

`gmt-ledger-hold` ×67 maps onto `<gmt-readout>` (reserved size) and needs no new piece.

## 2 · Migration recipe (every widget in 9a–10f)

1. **Baseline first.** On a build of HEAD, capture `html-diff`
   (`node scripts/html-diff.mjs capture .gates/html-<slice>`) for the slice's pages.
2. **`renderTemplate`** uses builders and elements only. Ids come from `idScope(idPrefix)`;
   delete any module counter. The root comes from `widget({ name, label })`, which keeps the
   slice 2 contract.
3. **`mount`** calls `defineElements()` first. It reads and writes element `value` properties
   and listens for `input` and `change` on the root with the mount's `signal`. It never queries
   by class. Keep `getPermalinkState` and the seed path unchanged.
4. **Styles.** The widget's own rules go to `src/widgets/tools/<name>.module.css`, with nesting,
   logical properties, container queries on the root, tokens only, and no `nth-*`. Delete the
   widget's sheet and its import in `gmt.css`. Delete family-sheet rules when no widget uses
   them any more (check with `rg`).
   - `gmt-a11y.css` holds forced-colours, `prefers-contrast` and reduced-transparency rules
     for widget classes (for example `gmt-cutoff-` ×54, `gmt-stored-` ×51). Move the widget's
     rules into `@media (forced-colors: active)` and `(prefers-contrast: more)` blocks in its
     module, and delete them from `gmt-a11y.css`. Zebra rows (`:nth-of-type(even)`) become a
     class the builder sets.
   - Every module has a forced-colours block, using system colours, for each surface, border
     and focus ring it paints.
5. **The shell** (`src/components/<Name>.astro`) mounts by `[data-widget="<name>"]`.
6. **The test is rewritten on the kit.** Keep every behaviour case, and replace each `data-role`
   lookup with a role, name or text query. End every case that changes state with
   `expectNoAxeViolations`. A behaviour that is only visible as a class becomes an accessible
   state (`aria-pressed`, `aria-checked`, the text in an `<output>`) or a Chromium gate check.
7. **Lint lists.** Take the mount, the test and the sheet off every legacy list (slices 7 and
   8b).
8. **Compare** `html-diff`. Every `✗` is a class rename, a kit tag or an id change, each named
   in the report. Then capture again.

## 3 · The four widgets

- **gnss-rollover-checker.** Use the slice 8c GNSS family pieces. Keep slice 4's
  `table-layout: fixed` in the family table module. The three heroes go through `hero`
  (cause 7). The chips go through `<gmt-chips>`, which owns the selected ink (cause 8).
- **satellite-clock-converter.** Use the same GNSS pieces, `<gmt-range>` for both sliders, and
  `<gmt-preset>`.
- **id-timestamp-decoder.** Six heroes go through `hero`, and its readouts reserve the widest
  sample identifier.
- **column-timestamp-bridge.** The mode hides fields: the module has
  `.field { &[hidden] { display: none } }`. Delete the interim plain rule from 8b. Chips go
  through `<gmt-chips kind="radio">`, an APG Radio Group with arrow keys.
- **`gmt-punctuality-widgets.css:162`.** Once these two widgets have moved, the `.gmt-punct-hero`
  rules stay only for the punctuality family (10a). Nothing outside that family may use them.

**Cause 6.** Every card and section in these four widgets paints `--gmt-surface-widget`, which
is opaque. `rg 'widget-card-bg' apps/dox/src/widgets` must return nothing.

## Traps

- The rollover checker's three heroes reserve their size. Measure them under drag, and do not
  shrink the reserved text: use the longest era label.
- `<gmt-readout>` announces on `change`. The ID decoder decodes as the reader types (`input`),
  so its result announces once typing pauses. Use the element's commit on `change` or blur, not
  a timer in the mount.
- `id-timestamp-decoder` and `column-timestamp-bridge` use `gmt-ledger-*` classes. Move only the
  pieces they use, and leave the legacy rules for the widgets that still use them.

## Definition of done

1. From `apps/dox`: `pnpm test`, `pnpm check` and `pnpm lint` pass, and the legacy lists are
   shorter by these four widgets.
2. Run every gate in Chromium, both themes, at 390 and 1440, on `/tools/gnss-rollover-checker/`,
   `/tools/satellite-clock-converter/`, `/tools/id-timestamp-decoder/` and
   `/tools/column-timestamp-bridge/`.
   - `contrast-measure` lists each pair that #429 reported, with its new ratio of at least 7:1.
   - `readout-still` shows no movement.
3. **Chat rail.** Mount each of the four from `/dox/`, then abort while it loads. No console
   error and no leaked listener.
4. **Permalink.** For each of the four, set a state, open the link in a fresh tab, and the same
   state appears.
5. **Cause 9b, widget side.** On `/tools/id-timestamp-decoder/`, `grow-measure` at 390 and 1440
   reports no `jump-over-limit` on `main`: the six heroes and the result reserve their size.
6. `html-diff`: every `✗` is named, and the baseline is captured again.
7. No card or verdict has a left-border-only accent.
8. `node scripts/verdict.mjs validate` passes.
