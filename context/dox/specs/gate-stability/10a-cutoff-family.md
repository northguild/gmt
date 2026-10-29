# Slice 10a — the cutoff family: countdown, ruler, stack, delivery scheduler

From here on, the widgets #429 did not report move onto the kit. This slice takes the four
cutoff tools and the cutoff family pieces that twenty widgets borrow. Follow the
[migration recipe](./09a-gnss-ids-bridge.md#2--migration-recipe-every-widget-in-9a10f).

## Current state (verified)

| Widget | Mount | Test | Sheet |
|---|---|---|---|
| cutoff-countdown | 885 | 420 | 186 |
| cutoff-ruler | 638 | 377 | 348 |
| cutoff-stack | 708 | 444 | 119 |
| delivery-scheduler | 816 | 575 | 528, plus `gmt-charts.css` (280) |

- `gmt-cutoff-widgets.css` has 968 lines. Its classes appear in 20 mounts (`gmt-cutoff-chip`
  ×72 alone). 9a replaced the chip, the axis tick and the mark with kit pieces.
- What stays cutoff-only: the gate, the series swatch row, the ruler bands and the countdown
  face.
- `gmt-cutoff-widgets.css` has one `nth-*` rule.
- delivery-scheduler draws TanStack Charts (`delivery-scheduler-charts.ts`). Its
  `!important` rules for reduced motion went in 8b.

## Files and changes

- **`src/widgets/families/cutoff/`** holds `gate`, `bands` and `countdownFace`. Each is a
  builder with its module and test.
  - The countdown face's digits are a `<gmt-readout>` that reserves `88:88:88` in tabular
    figures, so the tick never resizes it.
  - The live region announces at most once a minute, through `aria-live` on a separate,
    visually hidden summary, never on each second.
- **The four widgets** follow the recipe. Every borrowed `gmt-cutoff-*` class goes to the 9a
  kit piece or to the family piece above.
- **`gmt-cutoff-widgets.css`.** Delete each rule once `rg` shows no user. The rules still used
  by widgets in 10b–10f stay until their last user moves. Slice 11 checks that the file is
  gone.
- **Charts.** TanStack Charts builds its own DOM (`ts-chart-*`), so its styles cannot be a
  module: a module is scoped, and `:global` is banned.
  - `gmt-charts.css` stays a global sheet in `gmt.tools`, as the one place that styles that
    library's DOM.
  - Record this in `built.md` § Component kit as the rule "third-party DOM is styled in a
    named global sheet". It applies to Pagefind, Starlight, TanStack Charts and the map
    tooltip.
  - The `nth-*` and `!important` bans still apply to that sheet.

## Traps

- cutoff-ruler and cutoff-stack draw time on an axis. Use the 9a `timeline` pieces, and set
  `--gmt-at` from the mount. Never use `left: <px>` from measured widths: the chat rail
  changes the width under the reader, and the container query re-lays the axis out.
- **The countdown ticks once a second.** `<gmt-readout>` announces on `change`. The countdown
  must not send `change` each second, or a screen reader reads every tick. Give it a
  `quiet` mode: the text updates, there is no announcement, and the separate summary
  announces each minute. Test it with fake timers.
- delivery-scheduler's charts read `prefers-reduced-motion` for `motion: false` (8b). Check
  that it still holds after the move.

## Definition of done

1. From `apps/dox`: `pnpm test`, `pnpm check` and `pnpm lint` pass, and the legacy lists are
   shorter by these four widgets.
2. Run every gate in Chromium, both themes, at 390 and 1440, on `/tools/cutoff-countdown/`,
   `/tools/cutoff-ruler/`, `/tools/cutoff-stack/` and `/tools/delivery-scheduler/`.
   `readout-still` shows no movement, and the countdown's box holds still across 70 s of
   ticks: a bounding-box sample each second.
3. **Chat rail** mount and abort for each widget.
4. **Permalink** round trip for each widget.
5. `html-diff`: every `✗` is named, and the baseline is captured again.
6. No card has a left-border-only accent.
7. `node scripts/verdict.mjs validate` passes.
