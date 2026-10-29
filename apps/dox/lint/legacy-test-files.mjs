/**
 * Test files that still break a `dox-test` or Testing Library rule.
 *
 * Each path is listed by name, never by glob. The list may only shrink: a widget's test
 * leaves it when it moves onto the test kit. `lint/dox-test-rules.test.ts` fails if an entry is a glob.
 */
export const LEGACY_TEST_FILES = [
  "src/components/PlaygroundForm.test.ts",
  "src/components/ask/widget-registry.test.ts",
  "src/lib/code-break.test.ts",
  "src/lib/content-list-rule.test.ts",
  "src/lib/data-credits.test.ts",
  "src/lib/elapsed-vs-clock-mount.test.tsx",
  "src/lib/font-floor.test.ts",
  "src/lib/holiday-widgets.test.ts",
  "src/lib/industry-tags.test.ts",
  "src/lib/label-fit-days.test.ts",
  "src/lib/page-markdown.test.ts",
  "src/lib/ref-table.test.ts",
  "src/lib/rehype-table-scroll.test.ts",
  "src/lib/retrieval/fetch-chunks.test.ts",
  "src/lib/scroll-regions.test.ts",
  "src/lib/scroll-reveal.test.ts",
  "src/lib/smooth-height.test.ts",
  "src/lib/text-contrast.test.ts",
  "src/lib/why-gmt-charts.test.ts",
  "src/lib/widget-load-error.test.tsx",
  "src/lib/widget-ui.test.ts",
];
