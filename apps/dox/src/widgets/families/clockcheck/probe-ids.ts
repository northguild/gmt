/**
 * The local part names of the "Your browser" card. `probeCard` writes each as `<idPrefix>-<name>`
 * (`idScope`), the mount finds them with `findWidget(...).part(name)`, and the page's inline script
 * (`probeInlineSource`) builds the same ids from the card's scope, `<idPrefix>-browser`. One list,
 * so the three cannot drift.
 */
export type VariantName = "pending" | "ok" | "bad" | "unreadable";

export const VARIANTS: readonly VariantName[] = [
  "pending",
  "ok",
  "bad",
  "unreadable",
];

export const PROBE_PARTS = {
  /** The status region that holds the four finished variants. */
  verdict: "browser-verdict",
  /** The places named in the bad variant. */
  wrong: "browser-wrong",
  variant: (name: VariantName): string => `browser-variant-${name}`,
  /** The browser's reading for place `k` at the verdict instant. */
  yours: (k: number): string => `browser-yours-${k}`,
  /** The browser's reading for blind row `k` (instant by instant, place by place). */
  blind: (k: number): string => `browser-blind-${k}`,
  status: "browser-status",
  recheck: "browser-recheck",
} as const;
