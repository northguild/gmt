# Slice 9c — the last #429 widgets: elapsed vs clock, moving feasts, holiday rules, the Playground form

This slice moves the last three #429 mounts onto the kit, together with the Playground form
that the intermodal page reports (`gmt-pf`). After it, every #429 page renders from the kit.
Follow the [migration recipe](./09a-gnss-ids-bridge.md#2--migration-recipe-every-widget-in-9a10f).

## Current state (verified)

| Unit | Size | What changes |
|---|---|---|
| `elapsed-vs-clock-mount.ts` | 622 (test 814, sheet 509) | range ×2, preset, readouts ×4, asides ×4; uses `gmt-cutoff-`, `gmt-gnss-` and `gmt-ledger-` classes |
| `moving-feasts-mount.ts` | 670 (test 162, sheet 146) | range ×2, chips ×3, preset, hero ×2; module counter; Firefox load jump (cause 9b, slice 5 diagnoses it) |
| `holiday-rule-builder-mount.ts` | 918 (test 420, sheet 216) | chips, preset, hero, readouts ×12; module counter; Firefox load jump (9b) |
| `gmt-holiday-widgets.css` | 473 | family sheet for moving-feasts, holiday-rule-builder, observance-comparator and leap-day-birthday |
| `components/PlaygroundForm.astro` | 548 (sheets `gmt-playground-form.css` 137, `gmt-playground.css` 143) | Embedded on **714 content pages** and in `Scenario.astro` and `Mistake.astro`. Classes `gmt-pf-*`, `.gmt-field-grid`, `.gmt-label`. Its result goes through `playground-client.ts:70` `renderResult`, then `renderWidgetOutput`. |

`widget-registry.ts:15-17` keeps `playground-client.ts` out of the chat bundle, and that stays
true.

## Files and changes

- **elapsed-vs-clock.** Use `<gmt-range>` for both sliders, `<gmt-preset>`, and the
  `timeline` pieces from 9a in place of the cutoff, GNSS and ledger classes it borrows.
- **Holiday family** → `src/widgets/families/holiday/`. Move the parts of
  `gmt-holiday-widgets.css` that moving-feasts and holiday-rule-builder use (frame, policy rows,
  the year strip) into family builders with their modules. observance-comparator and
  leap-day-birthday keep the legacy rules until 10c, then slice 10c deletes the sheet.
- **moving-feasts.** Its three chip groups become `<gmt-chips>`: tradition as `kind="radio"`,
  the others as `checkbox`. Both heroes go through `hero`.
- **holiday-rule-builder.** Its 12 readouts become `<gmt-readout>`, each reserving its widest
  sample, so the load jump that slice 5 attributes to late text cannot resize the form.
- **Playground form.** `PlaygroundForm.astro` stays an Astro component, so its markup is Astro
  and not a builder string:
  - It imports `playground-form.module.css` in its frontmatter (Astro supports CSS Modules
    imports).
  - Labels use the kit's `field` contract: the `label` is required, and the hint is joined by
    `aria-describedby`.
  - Its result is a `<gmt-readout>`. `renderResult` sets the element's `value` and state, not
    `renderWidgetOutput`.
  - Repeatable rows: the add and remove buttons have names that say which row ("Remove row 2,
    start"), and focus moves to the new row's first control or, after a remove, to the previous
    row.
  - Delete `gmt-playground-form.css` and `gmt-playground.css` once nothing uses them, and
    check `Scenario.astro` and `Mistake.astro` first.
- **Tests.** Rewrite `PlaygroundForm.test.ts` and the three mount tests on the kit.
  `playground-templates.test.ts` keeps its template checks.

## Traps

- **The form is on 714 pages.** `html-diff` covers only the Tier 2 widget pages. For the form,
  diff the built HTML of one page per field kind: scalar, enum, expr, list, intervals, no-arg,
  `objectArg`. The generator's `buildPlaygroundFields` names them. List the pages you chose.
- The form's inline `<script>` (`PlaygroundForm.astro:245`) runs on every reference page. Call
  `defineElements()` there, inside the script's start function, never at the module top.
- Don't change `buildPlaygroundFields` output or the generated templates. This slice is markup
  and style only ("Generate, don't maintain" in `built.md`).
- moving-feasts and holiday-rule-builder had Firefox-only load jumps (cause 9b). The
  reservation here is the product fix for the late-text case. The weekly run confirms
  Firefox, and the local proof is `grow-measure` in Chromium plus a slowed font load: block
  the font in DevTools, reload, and see no jump.

## Definition of done

1. From `apps/dox`: `pnpm test`, `pnpm check` and `pnpm lint` pass, and the legacy lists are
   shorter by these units.
2. Run every gate in Chromium, both themes, at 390 and 1440, on `/tools/elapsed-vs-clock-difference/`,
   `/tools/moving-feasts/`, `/tools/holiday-rule-builder/` and `/mistakes/intermodal/`, plus the
   seven field-kind reference pages above. `contrast-measure` lists each #429 pair at 7:1 or
   more.
3. **Every #429 tool widget except the clock-change, globe and zone pages (10e, 10f) renders from the kit.**
   Re-run the full index gate command (`--browsers chromium`), and quote `.gates/summary.json`.
4. **Cause 9b, widget side.** On `/tools/moving-feasts/` and `/tools/holiday-rule-builder/`,
   `grow-measure` at 390 and 1440 reports no `jump-over-limit` and no `grew`. Every readout
   reserves its size and every region that changes height sits in `<gmt-grow>`.
5. **Chat rail** mount and abort for the three mounts.
6. **Permalink** round trip for the three mounts, and for one Playground form (edit an
   argument, reload, and it is still there, if the form keeps state today; if it does not, say
   so).
7. `html-diff` plus the seven-page diff: every `✗` is named.
8. No card has a left-border-only accent. No readout moves under drag (`readout-still`).
9. `node scripts/verdict.mjs validate` passes.
