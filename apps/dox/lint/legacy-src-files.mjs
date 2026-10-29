/**
 * Files in `src/lib/**` that still break a `dox-src` rule.
 *
 * Each path is listed by name, never by glob. The list may only shrink: a mount
 * leaves it when it moves onto the component kit.
 */
export const LEGACY_SRC_FILES = [
  "src/lib/code-frame.ts",
  "src/lib/cutoff-widgets.ts",
  "src/lib/data-credits.ts",
  "src/lib/edi-picture.ts",
  "src/lib/edi-render.ts",
  "src/lib/edi-widgets.ts",
  "src/lib/elapsed-vs-clock-mount.ts",
  "src/lib/holiday-widgets.ts",
  "src/lib/ledger-widgets.ts",
  "src/lib/leg-form.ts",
  "src/lib/library-compare-tables.ts",
  "src/lib/punctuality-widgets.ts",
  "src/lib/transport-widgets.ts",
  "src/lib/why-gmt-charts.ts",
  "src/lib/widget-ui.ts",
  "src/lib/zone-map-legacy.ts",
];
