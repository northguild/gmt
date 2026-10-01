/**
 * The areas a tool belongs to: the groups the example cards in the widget rail
 * sit under, and the area a tool page's key point names.
 *
 * A leaf module on purpose — no import of its own. It used to live in
 * `chat-constants.ts`, which also imports `~/generated/corpus-counts`. The
 * Markdown exporter (`mdx-jsx.ts`) needs these labels to render a tool page's
 * key point, and `scripts/build-corpus-counts.ts` — the script that *writes*
 * `corpus-counts` — reaches that exporter through `guide-source-parse.ts`. Had
 * the exporter imported `chat-constants.ts`, the generator would have imported
 * its own output: a stale read at best, and a failure on a clean checkout.
 * `chat-constants.ts` re-exports both names, so nothing that imported them from
 * there had to change.
 */

/** In display order. */
export const EXAMPLE_AREAS = [
  { id: "zones", label: "Zones and DST" },
  { id: "intervals", label: "Intervals" },
  { id: "transport", label: "Transport" },
  { id: "intermodal", label: "Intermodal and billing" },
] as const;

export type ExampleArea = (typeof EXAMPLE_AREAS)[number]["id"];

/** The display label for an area id, or the id itself for one that is not listed. */
export function exampleAreaLabel(id: string): string {
  return EXAMPLE_AREAS.find((area) => area.id === id)?.label ?? id;
}
