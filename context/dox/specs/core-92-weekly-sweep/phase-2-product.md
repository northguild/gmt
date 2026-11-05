---
story: CORE-92
status: draft
---

# Phase 2 — product fixes P1–P5: readouts and contrast (M)

Start this phase after Phase 1. Each item begins red: run the command and record its first
failing line. Firefox runs need the [Phase 0 route](./phase-0-firefox-route.md). A gate cannot
take `--frames`, so frame repros run `grow-measure` directly against a static server. Close the
server with Ctrl-C when you are done.

```bash
SP=/private/tmp/claude-501/-Users-craigcurtis-workbench-northguild-gmt/8d601eb5-0c4a-4d64-b38d-1be55c5ef690/scratchpad
node scripts/lib/static-server.mjs dist 4173            # shell 1
node scripts/grow-measure.mjs --base http://127.0.0.1:4173/gmt --out "$SP/grow/<slug>-<b>" \
  --browsers <b> --widths <w> --pages /tools/<slug>/ --frames   # shell 2
```

## P1 — GNSS fuse chip wraps at 300 px (S; kit addition `hold`)

- **Kit addition.** Move `families/ids/hold.ts`, `hold.module.css` and `hold.test.ts` to
  `widgets/builders/` and export `hold` and `Ghost` from `builders/index.ts`. Point
  `format-card.ts`, `instant-hero.ts` and `id-rows.ts` at the new path. `data-gate="hold"` stays,
  so `readout-still`'s `"hold"` selector still works.
- **`families/gnss/fuse-board.ts` `fuseChips`.**
  - Each of the five slots is `hold(live, ghosts, { ghostClass })`.
  - The ghosts are each mark label, followed by the widest `at` the format can write, followed
    by ` (outside)`. To get the widest `at`, format a fixed sample instant with the same
    formatter, so the ghost is never typed in by hand.
  - A blank slot keeps its NBSP live content and carries the same ghosts, so it has the box of a
    full chip.
- **`fuse-board.module.css` `.chip`.**
  - Replace `overflow-wrap: anywhere` with `overflow-wrap: normal`, so a chip wraps only at
    spaces.
  - Add no fixed height. The accent stays a full border or a bottom border, never a left-only
    edge.
- **Test, `fuse-board.test.ts`:**
  - Every slot, blank or full, holds the same ghost set.
  - The ghost text ends ` (outside)`.
  - The live text is unchanged.
- **Bounding-box test.** `readout-still` measures every chip, the list and the content below
  while dragging to value 57340.
- **Red-first:**

  ```bash
  pnpm --filter dox gates --only readout-still --browsers firefox,chromium,webkit --pages /tools/gnss-rollover-checker/
  ```

  After Phase 1, Firefox at 300 px fails once, with
  `chip … grew 46→64, +2 grew around it, +N below moved`.

## P2 — the moving-feasts Date plate widens at 1440 (S–M)

- **`families/holiday/signal-plates.module.css` `.row`.**
  - Replace `repeat(3, minmax(0, 1fr))` and the `30rem` container query with a wrapping flex
    row whose plates are `flex: 1 1 max-content`.
  - A plate's max-content already includes its ghosts, because `.shown` and `.ghost` share one
    cell. So three plates sit on one row only when every ghost fits, and no measured breakpoint
    is needed.
- **`lib/moving-feasts-mount.ts:118` `DATE_SAMPLES`.** Check that the two extreme dates are the
  widest strings the plate can show in each engine. If a longer form exists, such as a weekday
  or an era, derive the samples from the formatter.
- `leap-day-birthday-mount.ts` and `observance-comparator-mount.ts` also use `signalPlates`.
  They are in the sweep.
- **Test, `signal-plates.test.ts`.** Read the CSS source, following the `table.test.ts:94`
  precedent: `.row` has no `minmax(0` track, and `.shown` and `.ghost` share `grid-area: 1 / 1`.
- **Red-first:**

  ```bash
  pnpm --filter dox gates --only readout-still --browsers firefox --pages /tools/moving-feasts/
  ```

  Run it at 1440. Then run the same command with `--browsers chromium,webkit`.

## P3 — a disabled `select()` dims to 4.6:1 (S; confirm first)

- **Confirm.** Write a scratch script in `$SP`, not committed. It loads `/tools/x12-time-reader/`
  and reads `getComputedStyle(select:disabled).opacity`, first through
  `chromium.connect($GMT_PW_FIREFOX_WS, { exposeNetwork: "<loopback>" })`, which is Linux
  Chromium in the same server, and then through native macOS Chromium and WebKit. Then run:

  ```bash
  pnpm --filter dox gates --only contrast-measure --pages /tools/x12-time-reader/,/tools/dtm-decoder/,/tools/cron-in-a-zone/
  ```

  Record which engines report `0.7`. The fix is the same either way.
- **Fix.** Add `opacity: 1` to `&:disabled` in `builders/select.module.css` and in
  `builders/text-input.module.css` (line 37). The comment says the user agent dims a disabled
  control with opacity, and that the kit dims by dashed border and `--gmt-ice-dim` ink.
- **Red test.** `select.test.ts` and `text-input.test.ts` read their CSS source: the `&:disabled`
  block sets `opacity: 1`.
- **Green.** The script reports `1` in every engine, and `contrast-measure` passes on the three
  pages in both themes.

## P4 — timetable-reader's hand-rolled Offset `<select>` (S; kit addition `selectOptions`)

- **Kit addition.** `builders/select.ts` exports `selectOptions(options, value): SafeHtml`.
  `select()` uses it, so the markup does not change. Add a JSDoc line naming its use: replacing
  the options of a live `select()`.
- **`lib/timetable-reader-mount.ts`.**
  - `offsetOptions` returns `SelectOption[]`.
  - The field (lines 233–242) is built with
    `select({ id, options, value: row.offset, describedBy: <why id> })`.
  - The update path (lines 848–858) writes `selectOptions(...)` and keeps the `dataset.options`
    compare and the `disabled` rule.
  - The `sizer` and `hold` code there is not touched.
- **`widgets/tools/timetable-reader.module.css:321`.** Remove `.offset` if nothing else uses it.
- **Test, `timetable-reader-mount.test.tsx`.**
  - The Offset control has the select builder's class and `aria-describedby` set to the why id.
  - It is disabled when there is one choice.
  - Its options are unchanged after an update.
- **Red-first:**

  ```bash
  pnpm --filter dox gates --only contrast-measure --themes dark,light --pages /tools/timetable-reader/
  ```

  Before the fix, the disabled border measures 1.23:1 (dark) and 1.29:1 (light).

## P5 — observance-comparator out-of-range days under 7:1 (S)

- **`families/holiday/month-grid.module.css:212` `.cell[data-outside]`.**
  - Set `background: none` and `color: var(--gmt-ice)`.
  - Remove the pick outline with `outline: none`, but keep any `:focus-visible` ring on a
    focusable cell.
  - The dashed hairline border and the empty fill are the cue. It is a pattern, not a tone.
- **`week-strip.ts:54`.** Confirm that no mark is drawn on an outside day.
- **Test, `month-grid.test.ts`.**
  - An outside cell has `data-outside` and no mark.
  - The CSS source for `.cell[data-outside]` has no `--gmt-ice-dim` and has `background: none`.
- **Red-first:**

  ```bash
  pnpm --filter dox gates --only contrast-measure --themes dark,light --pages /tools/observance-comparator/
  ```

  Before the fix there are 170 findings. Also run `holiday-rule-builder` and `moving-feasts`,
  which share `monthGrid`.

