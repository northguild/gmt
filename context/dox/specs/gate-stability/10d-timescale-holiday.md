# Slice 10d — timescale, holidays, cron and the converter bench

This slice moves five widgets onto the kit and retires the last two family sheets that 9a and
9c left behind: `gmt-holiday-widgets.css` and `gmt-gnss-widgets.css`. Follow the
[migration recipe](./09a-gnss-ids-bridge.md#2--migration-recipe-every-widget-in-9a10f).

## Current state (verified)

| Widget | Mount | Test | Sheet | Notes |
|---|---|---|---|---|
| leap-day-birthday | 484 | 216 | 210 (1 `nth-*`, `:137`) | module counter `:69`; `innerHTML` `:388`, `:391` |
| leap-second-timeline | 785 | 872 | 516 | `gmt-cutoff-chip` ×8, `gmt-gnss-flag` ×4, `gmt-gnss-table`; `innerHTML` ×9 (`:375`–`:667`) |
| observance-comparator | 918 | 465 | 423 | module counter `:114` (`:386`, `:503`); `innerHTML` ×6 |
| cron-in-a-zone | 744 | 296 | 486 (1 `nth-*`, `:420`) | `hintCount` counter `:431`; `select.innerHTML` `:471` |
| converter-bench | 326 | 272 | 66 | no counter; `ConverterBench.astro` is on 715 content pages |

- leap-day-birthday and observance-comparator borrow `gmt-ledger-hold`, `gmt-ledger-sr` and
  `gmt-holiday-frame`/`-card`/`-policy`. 9c moved the holiday frame and policy rows into
  `src/widgets/families/holiday/`; these two are the last users of the legacy rules.
- cron-in-a-zone borrows `gmt-cutoff-chip` and `gmt-cutoff-dst--gap`/`--overlap`, and calls
  `instantPiecesHtml` (`widget-ui.ts:61`), which emits `gmt-gnss-nb` spans.
- Live regions today: `gmt-ledger-sr` `:263` (leap-day), `gmt-gnss-visually-hidden` `:260`
  (leap-second), `gmt-ledger-sr` `:465` (observance), `gmt-cron-sr` `:341` (cron). Each is a
  `<p aria-live="polite">`.

## Files and changes

- **Counters.** All three go. Ids come from `idScope(idPrefix)`. observance-comparator's
  `root.dataset["uid"]` fallback (`:503`) goes too: the mount reads its scope from the root the
  template built.
- **Live regions** become the 9a `srOnly` builder with `live: "polite"`. One rule per page,
  not four copies of a visually-hidden class.
- **Redraws.** Every `innerHTML` assignment in these mounts sets a builder's `SafeHtml`
  through `setHtml` (8a), inside a `<gmt-grow>` where the region changes height:
  leap-day's rows, observance's matrix and columns, leap-second's steps list.
- **leap-second-timeline.** Its axis, grid, risers and marks use the 9a timeline pieces with
  `--gmt-at`. The flags become `badge`. The insertions table goes through `table()`.
  `timelinePlates` uses the 9a `plates` builder.
- **cron-in-a-zone.** The chip and the DST gap/overlap marks are kit `badge` variants. Its two
  tables go through `table()`, so `th:nth-child(2)` becomes a column class. The zone select
  rebuild (`:471`) builds `<option>`s through a builder, not by clearing `innerHTML`.
- **`instantPiecesHtml`** moves to `src/widgets/builders/instant.ts` with its module rule
  (no wrap inside a piece). Its other callers (column-timestamp-bridge, rollover checker,
  satellite clock, 9a) already use the builder by this slice; check with `rg`.
- **leap-day-birthday.** `td:nth-child(5) .gmt-ledger-hold` becomes a column class from
  `table()`. Its `readsSizers` reserve moves into `<gmt-readout reserve>`.
- **converter-bench.** Its selects use `field` + `fieldGrid`. The code frame already comes from
  `codeFrameHtml`; replace it with the 8a `codeFrame` builder.
- **Delete** `gmt-holiday-widgets.css`, `gmt-gnss-widgets.css`, the five widget sheets and their
  `gmt.css` imports, once `rg -n 'gmt-(holiday|gnss)-' apps/dox/src` lists no user.

## Traps

- **converter-bench is on 715 pages**, like the Playground form (9c). `html-diff` samples a few
  pages, so run it on a reference page with the bench in its `fullbleed` form and one without.
  Run `table-fit` and `a11y-axe` on three reference pages, not only `/tools/converter-bench/`.
- **The comment at `converter-bench-mount.ts:13-21`** says lookups are null-tolerant
  `querySelector`s by `data-role`, so a missing role makes a control inert. After the move,
  lookups go through the scope's ids and throw on a missing element. Rewrite the comment to say
  so, and make one test assert that a broken template throws `WidgetLoadError`.
- **Leap-second risers and marks are dense near 1972–1979.** Under `--gmt-at` positioning,
  two marks can share a pixel at 390 px. Keep the current collision handling (chips) and check
  the 390 snapshot by eye in both themes.
- **observance-comparator folds columns** (`folded` at `:586`). The fold must keep column
  widths, so `readout-still` runs while toggling the fold.
- `gmt-gnss-widgets.css` holds the cause-1 table fix (slice 4) for the rollover checker. 9a moved
  that table; confirm that no `gmt-gnss-table` remains before you delete the sheet.

## Definition of done

1. From `apps/dox`: `pnpm test`, `pnpm check` and `pnpm lint` pass, and the legacy lists are
   shorter by these five widgets.
2. `rg -n 'gmt-(holiday|gnss)-|let (counter|instances|hintCount)' apps/dox/src/lib` returns
   nothing, and `gmt-holiday-widgets.css` and `gmt-gnss-widgets.css` are gone.
3. Run every gate in Chromium, both themes, at 390 and 1440, on the five tool pages and on
   three reference pages that carry the converter bench. `readout-still` and `table-fit` pass.
4. **Chat rail** mount and abort, and a **permalink** round trip, for each of the five.
5. `html-diff`: every `✗` is named, and the baseline is captured again.
6. No card has a left-border-only accent.
7. `node scripts/verdict.mjs validate` passes.
