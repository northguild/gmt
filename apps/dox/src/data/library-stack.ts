/**
 * The structural anchors on the home page's library chart: the standard, the layer built on it,
 * and the root cause. Competitor rows come from `library-comparison.ts`.
 *
 * Here rather than in `WhyDateAlternatives.astro` for the same reason as `date-faults.ts`: the
 * text surfaces render this table too (CORE-8 review, #253).
 */
export interface Layer {
  name: string;
  detail: string;
  foundation: string;
  kind: "date" | "wraps" | "nonstandard" | "standard" | "gmt";
}

export const libraryStack: Layer[] = [
  {
    name: "Temporal",
    detail: "The TC39 standard. Separate types for instants, wall-clock times, zoned times, plain dates, and durations. No Date anywhere.",
    foundation: "TC39 standard",
    kind: "standard",
  },
  {
    name: "@northguild/gmt",
    detail: "Temporal underneath, with an ISO 8601 string-in / typed-value-out surface on top. The layer you actually write against.",
    foundation: "Temporal inside",
    kind: "gmt",
  },
  {
    name: "Date",
    detail: "Epoch milliseconds interpreted through the host timezone. Every fault above lives here.",
    foundation: "root cause",
    kind: "date",
  },
];
