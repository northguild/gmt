# Slice 10c — EDI and ledger: billing deadlines, B/L date stamp, demurrage clock, DTM, EPCIS, free time, X12

This slice moves seven widgets onto the kit, and with them the EDI picture and the ledger
family. Follow the [migration recipe](./09a-gnss-ids-bridge.md#2--migration-recipe-every-widget-in-9a10f).

## Current state (verified)

| Widget | Mount | Test | Sheet |
|---|---|---|---|
| billing-deadlines | 623 | 732 | 313 |
| bl-date-stamp | 540 | 1001 | 234 (1 `nth-*`) |
| demurrage-clock | 628 | 829 | 185 |
| dtm-decoder | 688 | 847 | in `gmt-edi-widgets.css` |
| epcis-event-reader | 578 | 756 | in `gmt-edi-widgets.css` |
| free-time-ledger | 922 | 721 | 74, plus a hand-typed `role="slider"` |
| x12-time-reader | 931 | 717 | in `gmt-edi-widgets.css` |

Shared modules:

- `edi-picture.ts` (700 lines) holds the "taken apart" picture (`takenApartHtml` `:353`,
  `partsHtml` `:399`, `figureAria` `:422`), the timeline (`timelineHtml` `:550`,
  `timelineAria` `:589`) and the sizers (`holdHtml` `:618` through `callOutputSizer` `:698`).
- `edi-render.ts` (200 lines) writes into `innerHTML` (`drawFigure` `:135`, `drawTimeline`
  `:162`). `edi-widgets.ts` is 523 lines.
- `ledger-widgets.ts` (347 lines) holds `dayColumnsHtml` `:111`, `plateHtml` `:209`,
  `descriptionHoldHtml` `:241` and `platesHtml` `:254`.

Family sheets are `gmt-edi-widgets.css` (1355 lines) and `gmt-ledger-widgets.css` (499 lines,
1 `nth-*`).

## Files and changes

- **`src/widgets/families/edi/`** gets the EDI pieces:
  - `takenApart`, `figure`, `timeline` and `callFrame` become builders. Their `aria` text comes
    from the existing `figureAria` and `timelineAria`, unchanged.
  - The sizer family (`holdHtml`, `sizerHtml`, `textSizers`, `callSizer`, `outputSizer`,
    `asideSizer`, `figureSizer`, `callOutputSizer`) is replaced by the reservation in
    `<gmt-readout>` and the 8a `hero`, `aside` and `codeFrame` builders. Each builder takes a
    `reserve` sample, which is the text the sizer holds today.
  - `drawFigure` and `drawTimeline` set a builder's output on a `<gmt-grow>` slot, so the
    resize animates and never jumps.
- **`src/widgets/families/ledger/`** takes `dayColumns` (`dayColumnFit` stays a pure helper).
  `plates` is already in the kit (9a). `descriptionHoldHtml` is gone, replaced by
  `<gmt-preset>`.
- **free-time-ledger's handle** becomes `<gmt-handle>`. After it, `rg -n 'role="slider"'
  apps/dox/src/lib` returns nothing.
- **The seven widgets** follow the recipe.
- **Delete** `gmt-edi-widgets.css`, `gmt-ledger-widgets.css` and every widget sheet named
  above. Delete the dead exports from `edi-picture.ts`, `edi-render.ts` and
  `ledger-widgets.ts`. Keep the pure helpers (`shapeOf`, `cutValue`, `picHalves`,
  `timelineLayout`, the text formatters) with their tests.

## Traps

- **The sizers are why EDI readouts hold still.** Each one renders the longest text a slot can
  hold, hidden, so that the slot keeps its size. Before you delete any of them, list each slot
  and its sample text, then confirm that the replacement reserves the same width and height:
  `readout-still` and `grow-measure` on every EDI page.
- `figureAria` and `timelineAria` are tested pure functions. Keep their tests, and assert the
  built figure's accessible name with `getByRole("img", { name })`.
- bl-date-stamp's test has 1001 lines and leans on `data-role`. Map each case to the reader's
  view: the stamp field by its label, and the result by its `<output>` text.
- dtm-decoder, epcis-event-reader and x12-time-reader share most of `gmt-edi-widgets.css`.
  Move all three before you delete the sheet.

## Definition of done

1. From `apps/dox`: `pnpm test`, `pnpm check` and `pnpm lint` pass, and the legacy lists are
   shorter by these seven widgets.
2. `rg -n 'role="slider"|textSizers|holdHtml|descriptionHoldHtml' apps/dox/src/lib` returns
   nothing.
3. Run every gate in Chromium, both themes, at 390 and 1440, on the seven tool pages.
   `readout-still` and `grow-measure` pass, and no slot is smaller than its slot was before the
   change: compare the bounding boxes before and after and paste them.
4. **Chat rail** mount and abort, and a **permalink** round trip, for each of the seven.
5. `html-diff`: every `✗` is named, and the baseline is captured again.
6. No card or verdict has a left-border-only accent.
7. `node scripts/verdict.mjs validate` passes.
