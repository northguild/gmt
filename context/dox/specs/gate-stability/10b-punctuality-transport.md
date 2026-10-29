# Slice 10b — punctuality and transport: departure board, punctuality board, timetable, journey split, ETA drift, crossing clock

This slice moves six widgets onto the kit, three of them with hand-typed handles. Follow the
[migration recipe](./09a-gnss-ids-bridge.md#2--migration-recipe-every-widget-in-9a10f).

## Current state (verified)

| Widget | Mount | Test | Sheet | Notes |
|---|---|---|---|---|
| departure-board | 994 | 986 | 227 | hand-typed `role="slider"`; builds heroes in the DOM (`:581-606`, `hero.className = "gmt-punct-hero"`) |
| punctuality-board | 963 | 1106 | 377 | hand-typed `role="slider"`; `gmt-punct-` ×50 |
| timetable-reader | 1209 | 975 | 1135 | hand-typed `role="slider"`; module counter; 7 `nth-*` in its sheet; the latent cause-1 table (slice 4) |
| journey-split | 567 | 951 | 516 | `gmt-ledger-` ×13 |
| eta-drift | 872 | 770 | 284 | builds heroes in the DOM (`:575`) |
| crossing-clock | 547 | 405 | 336 | `crystal-clock.ts` `renderCrystalClock` (`:340`) into `innerHTML` (`:498`) |

Family sheets: `gmt-punctuality-widgets.css` (477, which holds `.gmt-punct-hero` at `:162`,
cause 7), `gmt-transport-widgets.css` (221) and `gmt-crystal-clock.css` (327).

## Files and changes

- **Three handles become `<gmt-handle>`.**
  - Their `aria-valuetext` is the written time the board shows, not minutes since midnight.
  - The timetable reader's handle scrubs a service day. Its PageUp and PageDown step one
    departure.
- **Heroes built in the DOM.** departure-board and eta-drift build hero nodes at runtime. Have
  them call the `hero` builder and update the element through its `value`, never through
  `className`.
  - The `gmt-punct-heroes` strip (`aria-hidden="true"` at `departure-board-mount.ts:189` and
    `eta-drift-mount.ts:170`) stays hidden from the accessibility tree only if the same facts
    are in text elsewhere. Check this, and make the strip visible to assistive technology if
    they are not.
- **`src/widgets/families/punctuality/`** holds the board row, the delay band and the hatch
  (`gmt-punct-hatch` ×8). Delete `gmt-punctuality-widgets.css`, and cause 7's leaked rule
  goes with it.
- **`src/widgets/families/transport/`** holds the badge row, the reason and the verdict (9a
  `verdict`). Delete `gmt-transport-widgets.css` once its last user moves.
- **timetable-reader.** Its table goes through `table()`, so its 7 `nth-*` rules become
  column classes. It keeps slice 4's `table-layout: fixed` in its module, inside the
  `@container` query.
- **crossing-clock.** `renderCrystalClock` becomes a builder in
  `src/widgets/families/clock/`, with `crystal-clock.module.css`.
  - The clock face is `role="img"` with an `aria-label` of the written time. The hands are
    `aria-hidden`.
  - `bindClockGlow` (`crystal-clock.ts:469`) takes its duration from motion tokens.
  - Delete `gmt-crystal-clock.css` here if only crossing-clock uses it. Otherwise delete it
    in 10f with the Zone Planner.

## Traps

- punctuality-board's test has 1106 lines. Keep every case. Board rows are a table or a list
  with names, so query rows by their train or flight id text.
- timetable-reader has the biggest sheet (1135 lines). Move it in one pass, then run
  `table-fit` and `readout-still` before you delete the legacy sheet.
- Hero values update on every handle move. They reserve their size (the 8a hero contract),
  so `readout-still` must show no movement in the hero strip.

## Definition of done

1. From `apps/dox`: `pnpm test`, `pnpm check` and `pnpm lint` pass, and the legacy lists are
   shorter by these six widgets.
2. `rg -n 'role="slider"' apps/dox/src/lib` lists only `free-time-ledger` (10c).
3. Run every gate in Chromium, both themes, at 390 and 1440, on the six tool pages.
   - `readout-still` and `table-fit` pass.
   - `contrast-measure` has no hero caption below 7:1.
4. **Keyboard.** Every APG slider key works on the three handles, with jsdom tests.
5. **Chat rail** mount and abort, and a **permalink** round trip, for each of the six.
6. `html-diff`: every `✗` is named, and the baseline is captured again.
7. No card has a left-border-only accent.
8. `node scripts/verdict.mjs validate` passes.
