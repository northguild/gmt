/**
 * The order of the sidebar's "Start here" and "Migrate" groups, written once. The sidebar
 * (`astro.config.mjs`, so Starlight's previous and next links too), `llms.txt` and `llms-full.txt`
 * (`top-level-pages.ts`) all read it. A leaf module with no imports, so the config can import it.
 *
 * A `slug` is the sidebar's: the Migrate overview is `migrate`, where the raw page glob keys it
 * `migrate/index`. A `label` is the short text the sidebar shows; the page title stays in full.
 */

/** What a reader needs first, in reading order. */
export const START_HERE = [
  { slug: "install" },
  { slug: "core-rules" },
  { slug: "why-gmt" },
] as const satisfies readonly { slug: string; label?: string }[];

/** The Migrate group: the overview, the pages that weigh GMT against the others, the weekly engine runs, one page per library, then the behaviour matrix. */
export const MIGRATE = [
  { slug: "migrate", label: "Overview" },
  { slug: "compare", label: "GMT vs. the others" },
  { slug: "bundle-size" },
  { slug: "upstream" },
  { slug: "native-engines" },
  { slug: "migrate/date-fns", label: "From date-fns" },
  { slug: "migrate/luxon", label: "From Luxon" },
  { slug: "migrate/dayjs", label: "From Day.js" },
  { slug: "migrate/moment", label: "From Moment.js" },
  {
    slug: "migrate/internationalized-date",
    label: "From @internationalized/date",
  },
  { slug: "migrate/temporal", label: "From native Temporal" },
  { slug: "compare/behaviour", label: "Behaviour compared" },
] as const satisfies readonly { slug: string; label?: string }[];
