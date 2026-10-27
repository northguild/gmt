/**
 * Pure helpers for the frames `grow-measure.mjs` records.
 *
 * `<main>` is taller than the tool's root: the footer, the pagination links and
 * the licence note come after it in the HTML. A frame drawn while the parser is
 * still streaming the page shows `<main>` without them, and the next frame, once
 * the parser has moved on, shows them below the widget. That is the document
 * arriving, not a layout shift: it appends below everything the reader is
 * looking at and nothing on screen moves. It surfaces as a 248 px (1440 wide) or
 * 450 px (390 wide) `<main>` jump on /check/canada-2026-clock-change/ whenever
 * the first frame lands mid-parse, which is a matter of timing and not of load.
 */

/**
 * The `<main>` heights of the frames drawn once the parser had finished
 * (`f.l === 0`). A frame without the flag counts as finished.
 */
export function settledMainHeights(frames) {
  return frames.filter((f) => f.l !== 1).map((f) => f.m);
}
