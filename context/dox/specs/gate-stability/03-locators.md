# Slice 3 — gate locators by role and name, scoped to `[data-widget]`

Gate rows find elements with `.gmt-*` classes and `[data-role]` hooks. Example: readout-still's
tool table, `readout-still.mjs:158-495`, has `root: ".gmt-departure-board"` and
`controls: [{ sel: '[data-role="handle-after"]' }]`. The CSS Modules story hashes those classes,
and its primitives replace the `data-role` wiring, so every such locator would break. After this
slice no gate script names a `.gmt-*` class or `[data-role]`.

**Scripts:**

- `readout-still.mjs`: 55 class and 41 `data-role` locators, over 17 pages.
- `grow-measure.mjs`: 48 class and 60 `data-role` locators, over 40 pages.
- `canada-clock-still.mjs`, `canada-stored-still.mjs` and `canada-layout-check.mjs`.
- `data-credits-check.mjs`, `table-fit.mjs` and `globe-smoke.mjs`.
- `visual-snapshot.mjs`. Its gate id is `visual-diff`.
- `contrast-measure.mjs`.
- The helpers `lib/a11y-sweep.mjs` and `lib/clock-check-harness.mjs`.

The counts come from `grep -c '\.gmt-\|data-role' <script>`. Re-run it rather than trust these
figures.

## How each locator converts

Use the first rule that fits.

1. **Root:** `[data-widget="<slug>"]` (slice 2). `root: ".gmt-widget"` rows in `grow-measure`
   become the page's slug. `lib/clock-check-harness.mjs:17` `ROOT_SELECTOR` becomes
   `[data-widget="canada-clock-change"], [data-widget="morocco-clock-change"]`.
2. **Controls** (handles, presets, selects, buttons, chips): Playwright
   `root.getByRole(role, { name, exact: true })`.
   - Handles are `slider`. Presets are `combobox` or `radiogroup`.
   - The name is the control's accessible name **as rendered**. Read it from the page; never
     invent it.
   - A readout-still `value` key (today the `data-role` of the field a handle edits) becomes that
     field's label, so the row reads `{ slider: "End", value: "End time" }`.
3. **Readouts and cards with a role:** `status` / `output`, `table`, `cell`, `columnheader`,
   `heading`, `region`, `figure`, `img`, `tooltip`, `listbox` / `option`. If the element lacks the
   role it plainly has, **add the role to the markup**. Examples:
   - a chart frame is a `figure` with `aria-label`;
   - the globe tooltip is `role="tooltip"`;
   - a live clock readout is `role="status"` only if it already announces; otherwise `time`
     with a name.
   Never add a role that changes what a screen reader announces in a way the tool did not intend.
   No `role="img"` on anything that holds controls. No `status` on a value that ticks every
   second.
4. **Pure geometry with no legitimate role:** drag tracks, plot areas, drawn SVG paths, sizer
   boxes, the "drawn" exclusion regions and the zones of a card a check measures. These carry a
   `data-gate` hook, a space-separated list of part names the mount writes on the element, and a
   gate finds them with `gate("part")` (`lib/locate.mjs`), the selector `[data-gate~="part"]`.
   The hook is `data-gate`, not `data-testid`: one element can hold several parts (`drawn
   track`), which an exact test id cannot. Each part exists only because no role or
   accessible name describes the element; a part that gains one is replaced by `getByRole`.
   Controls, lists, canvases and named regions are never parts: a gate finds those by role and
   name. A canvas is a `canvas` tag inside the globe's widget root; the pinned-zones list is the
   `listbox` named "Pinned zones…"; the zone list of the check pages is the `list` named "Zones".
   Each part, with the reason it has no role or name:
   - **Readout comparison** (`readout-still`)
     - `frame`: the tool's chart or call frame, a plain box the drag moves by design.
     - `drawn`: lanes, bars and the ring, drawn marks that are not text or controls.
     - `track`: the strip a handle runs along; the handle has the role, the strip has none.
     - `hold`: a hold's live wrapper, a layout box. `holdHtml` always writes it.
     - `grid`, `rider`, `hero`, `codeframe`, `instant`: named regions inside one tool's card,
       plain boxes the comparison treats on their own.
   - **Smooth height** (`grow-measure`)
     - `grow`: the box `smooth-height.ts`, `MountedWidget.tsx`, `wrapSection` and
       `MultiZoneScrubber.astro` size to its content; a layout wrapper with no role. Section
       rule: the section of a control is the ancestor whose parent's parent is the widget root.
   - **Clock-change checkers** (`canada-*`, `lib/clock-check-harness.mjs`); each is a zone or
     card set whose width, position or stacking a layout check measures, with no role of its own
     (sections that have `aria-labelledby` stay hooks, because a heading's text changes with
     copy and the gate must not):
     - `browser`, `probe-table`, `servers`, `keypoints`, `keypoints-card`, `pickcard`, `clocks`,
       `clock`, `clock-time`, `stack`, `help`, `minimums`, `changes`, `transitions`.
     - The stored-times form: `stored`, `stored-steps`, `stored-head`, `stored-toggle`,
       `stored-table`, `stored-form`.
     - The map: `map-stage`, `map-section`, `map-block`, `map-frame`, `map-pin`, `pin-cell`,
       `pin-zone`, `map-svg`, `map-shape`, `map-label`. SVG shapes and labels carry no role.
   - **Globe and credited maps** (`globe-smoke`, `data-credits-check`, `contrast-measure`)
     - `globe-stage`, `globe-zoom`, `hero-stage`, `credited-frame`: boxes around a canvas or
       figure.
     - `globe-tooltip`: a hover-only popover; adding `role="tooltip"` would change what a screen
       reader announces.
   - **Wall-clock text** (`visual-snapshot`)
     - `live`: any element whose text or drawing is a function of the current time. A masked
       value has no role by design (`status` is forbidden on a ticking value).
     - `live-face`: the planner's dial, hidden as well as masked.
   The shared helpers are in `lib/locate.mjs`: `gate()`, `control(page, root, {role, name, nth})`
   (exact name; `nth` picks among equal names, such as the two "Preset" selects of a tool with
   two), `presetSelect(page)` (the first native select inside a widget root, by role
   `combobox`) and `resolveMisses(page, asks)`, where an ask is exactly one match unless it gives
   `min` and `max`; `min` alone means at least that many.
   A part that matches nothing on a page is a no-op for the gate; `--resolve-only` catches the
   part that is gone from a page it is expected on. Tag selectors inside a scoped root
   (`root.locator("canvas")`, `figure.locator("svg path")`) are allowed where they are
   unambiguous.
5. **Behaviour the check itself measures:**
   - `table-fit.mjs:168` finds unbreakable pieces by class (`.gmt-cw`,
     `code:not(.gmt-codebreak)`, `.gmt-nobreak`). It switches to computed style: an inline
     element whose `white-space` is `nowrap` or `pre`, or whose `overflow-wrap` is `normal` and
     `word-break` is not `break-all`. It reports that piece's identity key. This finds the same
     set and survives hashing.
   - `lib/a11y-sweep.mjs:105` `.gmt-grow[data-growing]` becomes `[data-growing]`.
     `smooth-height.ts` is the only writer; check it with
     `grep -rn 'data-growing' apps/dox/src`.

Nothing in these scripts is left on a class or `data-role`. If an element fits none of rules
1–4, stop and report it in the handback with its markup. Do not keep the class.

## `--resolve-only`

Add a `--resolve-only` flag to `readout-still`, `grow-measure`, `canada-layout-check`,
`canada-clock-still`, `canada-stored-still`, `data-credits-check`, `globe-smoke` and
`visual-snapshot`. With it, the script:

- loads each of its pages once (Chromium, 1440, dark), waits for its normal ready signal and
  resolves every locator in its table;
- asserts a count of exactly 1 for single elements, at least 1 for lists, and 0 or 1 for rows
  marked `optional`;
- prints one line per page and exits 1 on any miss, naming the row and the locator.

It measures nothing and writes no finding. Run each script directly
(`node scripts/<script>.mjs --base <url> --resolve-only`, served as the runner serves it, see
`lib/static-server.mjs`). Add a unit test of the count check in `gate-checks.test.ts`.

## Messages

Each converted gate's failure message names elements by identity key (slice 1), not by
selector. Canada's "horizontal page scroll (376 > 375)" gains "widest: `<key>` right edge
376.0". Readout-still's "moved" names the moved element's key.

## Done

- `grep -nE '\.gmt-|data-role' <each script>` prints nothing except comments that describe
  product CSS.
- `--resolve-only` passes on every page of every converted gate.
- `pnpm test` passes.
- `pnpm gates --no-build --only readout-still,grow-measure,canada-clock-still,canada-stored-still,canada-layout-check --pages /tools/gnss-week-decoder/,/tools/connection-checker/,/check/canada-2026-clock-change/ --browsers chromium --themes dark`
  produces the same findings as before this slice. The keys differ; the rules and pages do not.
  Note: cause 1 and cause 4 still fail here until slice 4.
