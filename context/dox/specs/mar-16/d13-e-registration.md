## D. The five tools (continued)

### D13. Cross-links between the five tools

Each is a link in the tool's links row (`.gmt-widget-controls`), seeded with
`encodeWidgetPermalink`. With no result it is `aria-disabled` with no `href`. The round trip of
each is tested through `seedFromLocation`.

| From | Link text | To, seeded with |
| --- | --- | --- |
| Week Decoder | "Every satellite clock at this moment" | Clock Converter, `value` = the UTC result |
| Week Decoder | "Is a receiver on this counter affected, and when?" | Rollover Checker, `counter`, the decoder's era form (`firmwareNotBefore` for a pivot, `firmwareEra` for an integer; for `"rolling"`, the era it chose), `date` = the UTC result |
| Clock Converter | "This moment as a week on every counter" | Week Decoder, `mode: "utc"`, `utc` |
| Clock Converter | "Why these gaps grew" | Leap Second Timeline, `date` = the UTC instant |
| Rollover Checker | "See every era of this reading" | Week Decoder, `mode: "broadcast"`, `counter`, the reading's week and time of week, and `rolloverNotBefore` or `rolloverEra` from the firmware |
| Leap Second Timeline | "Count the real seconds between these dates" | Elapsed vs. Clock, `start` = `from`, `end` = `to` |
| Leap Second Timeline | "Every clock on this date" | Clock Converter, `value` = `date` |
| Elapsed vs. Clock | "See these dates on the timeline" | Leap Second Timeline, `from`, `to` |
| Elapsed vs. Clock | "Every clock at the start" | Clock Converter, `value` = `start` |

---

## E. Registration checklist

Each item names the test that guards it, or says that nothing does. "The five" are, in this order:
`showGnssWeekDecoder`, `showSatelliteClockConverter`, `showGnssRolloverChecker`,
`showLeapSecondTimeline`, `showElapsedVsClock`.

| # | File (under `apps/dox/`) | What is registered | Guard |
| --- | --- | --- | --- |
| E1 | `src/lib/dox-tools.ts` | the five input schemas after `showJourneySplitInput` (460); the names in `DoxToolName` (476), `DOX_TOOL_INPUTS` (502), `DOX_TOOL_DOCS` (530, **appended in the order above**), `DOX_TOOLS` (711), `ENABLED_TOOL_NAMES` (830) | `widget-registry.test.ts`, `chat-starters.test.ts` (with the purpose-by-name guard), typecheck |
| E2 | `worker/tools.ts` | the five imports (66) and tools with a trivial `execute` after `showJourneySplit` (409) | `tools.test.ts` |
| E3 | `src/components/ask/widget-registry.ts` | `import type` only; the schema imports (91); five entries, each with a literal `import("~/lib/<tool>-mount")`; `WIDGET_REGISTRY` (781) | `widget-registry.test.ts`, `widget-graph.test.ts` |
| E4 | `src/lib/widget-permalink.ts` | `"gnssweek"`, `"satclock"`, `"rollover"`, `"leapline"`, `"elapsed"` in `WidgetKind` (59) and their paths in `WIDGET_PAGE_PATHS` (99) | `widget-permalink.test.ts` |
| E5 | `src/lib/chat-constants.ts` | `EXAMPLE_AREAS` (360): `{ id: "leapseconds", label: "Leap seconds and TAI" }` after `intervals`, and `{ id: "gnss", label: "GNSS and maritime" }` after `intermodal`; the five starters | `chat-starters.test.ts` |
| E6 | `src/lib/widget-load-error.test.tsx` | the five mounts in `MOUNTS` | **manual** |
| E7 | `src/components/ask/widget-graph.test.ts` | in `heavy` (134): the five pure modules, `gnss-widgets.ts`, `timescale-widgets.ts`, `gnss-lib.ts`, `timescale-lib.ts`; **not** `gnss-names.ts` | **manual** |
| E8 | `astro.config.mjs` | `gmt-gnss-widgets.css`, then the five tool sheets, in `customCss` after `gmt-edi-widgets.css`; the Industries sidebar group (B6) | **manual** |
| E9 | `src/lib/mdx-jsx.ts` | `"GnssWeekDecoder"`, `"SatelliteClockConverter"`, `"GnssRolloverChecker"`, `"LeapSecondTimeline"`, `"ElapsedVsClock"` in the dropped-components list (near 369) | `scripts/llms.test.ts`, only after a build |
| E10 | `scripts/html-diff.mjs` | the five tool pages with their root class strings | **manual** |
| E11 | `scripts/visual-snapshot.mjs` | the five tool pages, `industries-maritime`, `industries-transport`, `industries`, `reference`, and the two retuned widgets of N1 (`tool-converter-bench`, `tool-dst-inspector`, already listed or added) | **manual** |
| E12 | `scripts/grow-measure.mjs` | the five: `root: ".gmt-widget"`, `preset: '[data-role="preset"]'`, `drag` = `tow-slider`, `moment-slider`, `date-slider`, `date-slider`, `end-slider` | **manual** |
| E13 | `scripts/readout-still.mjs` | `TOOLS` (147): the decoder (`week-slider`, `tow-slider`), the converter (`moment-slider`), the rollover checker (`date-slider`, presets in "A date" mode), the timeline (`date-slider`), elapsed (`end-slider`); frame `.gmt-gnss-frame` for each; drawn: the lanes, bars, strip, timeline or rulers and a hold's live wrapper | **manual** |
| E14 | `scripts/contrast-measure.mjs` | the five tool pages and `/industries/maritime/` in `PAGES` (76) | **manual** |
| E15 | `src/styles/gmt-a11y.css` | forced colours for the family: lanes, bars, strips, rulers, pins, marks, today marks, slivers and hatched rows keep a system colour; plates and chips take `border-color: CanvasText` | **manual**; the browser pass checks it |
| E16 | `src/lib/industry-tags.ts` / `industries.json` | the Workforce entry and icon (D1), the GNSS and Maritime entries and icons (step D3) | `industry-tags.test.ts`, `industry-overview.test.ts` |
| E17 | `gmt-cutoff-widgets.css`, `gmt-punctuality-widgets.css` | the five roots join the plate, mark, chip and series `:is()` lists, and `.gmt-gnss-frame` joins the chart-surface list | **manual** |
