/**
 * The canary as the page reads it: one row per workaround group.
 *
 * `./temporal-compat.json` is written by `pnpm compat:snapshot`, which runs the same probes
 * `pnpm compat` prints, and `validate` fails when the committed copy no longer matches them. So the
 * "does GMT still handle this" column is a measurement of GMT's own code against the polyfill it
 * depends on, not a sentence anyone typed — the same rule `gmt-stats.ts` applies to every figure.
 *
 * Deliberately no "has upstream fixed it yet" field. Commit presence cannot answer it (tc39
 * squash-merges, so a fix's original sha reports as absent from `main` while its code is there), and
 * a hand-written stage would rot silently. What the page shows about upstream instead is the live
 * state of the filings themselves, which `scripts/upstream.mjs` re-reads from GitHub.
 */
import snapshot from "./temporal-compat.json";

export interface CompatGroup {
  /** The canary ids this group covers, e.g. `["D3", "D4"]`. */
  defects: readonly string[];
  /** The group's one-line title from `scripts/temporal-compat.mjs`. */
  title: string;
  /** What has to happen upstream before the workaround can go. */
  trigger: string;
  probes: number;
  /** Probes still returning the wrong value on the installed polyfill. */
  failing: number;
}

export const compatGroups: readonly CompatGroup[] = snapshot.groups;

/** Groups whose workaround still has to run, because the installed polyfill still has the defect. */
export const groupsStillNeeded: number = compatGroups.filter(
  (g) => g.failing > 0,
).length;

/** Every probe across every group, and how many still fail. */
export const probeTotals: { probes: number; failing: number } =
  compatGroups.reduce(
    (total, g) => ({
      probes: total.probes + g.probes,
      failing: total.failing + g.failing,
    }),
    { probes: 0, failing: 0 },
  );

/** The short name a group is known by, e.g. `D3 + D4`. */
export const groupLabel = (g: CompatGroup): string => g.defects.join(" + ");

/**
 * The part of a group's title after the `—`, which is the human description; the title itself
 * starts with the ids, which the label already shows.
 */
export const groupSummary = (g: CompatGroup): string => {
  const dash = g.title.indexOf("—");
  return dash === -1 ? g.title : g.title.slice(dash + 1).trim();
};

/**
 * What each defect means for someone using GMT, in plain language.
 *
 * The canary's own titles name files and defect numbers because they are printed for whoever is
 * removing a workaround. A reader of the page wants to know which dates go wrong, so that line is
 * written here and `temporal-compat.test.ts` fails if a group has none — a missing entry would
 * otherwise silently fall back to the maintainer wording.
 */
const WHAT_BREAKS: Readonly<Record<string, string>> = {
  D1: "Dates within about a year of the earliest or latest date Temporal can represent, in the non-ISO calendars",
  D2: "Buddhist calendar dates before 1582, read through an old Julian/Gregorian switch",
  "D3 + D4": "Hebrew calendar years at or before year 0",
  D5: "Indian national calendar dates before ISO year 1",
  D6: "Counting months between two dates in a non-ISO calendar, at the end of a month",
  D7: "Counting years from a leap-month date in the Hebrew calendar",
  D8: "Japanese era codes, and the date the Meiji era starts",
  D9: "Adding or counting very large numbers of months in a non-ISO calendar",
  D10: "Coptic and Ethiopic dates in far years, where a short thirteenth month can be skipped",
  D11: "Rounding or measuring a span in months from the 29th, 30th or 31st",
  "zoned.A":
    "Zoned times within a day of the earliest or latest instant Temporal supports",
  "zoned.B":
    "Finding the next time zone transition within about two months of the latest instant",
  "zoned.D":
    "A calculation in UTC near the range limit that should be rejected, but quietly returned a value",
  "zoned.E":
    "Time zone transitions before 1847, including the 1844 date-line move in Asia/Manila and four Pacific zones",
};

/** The plain-language line for a group, falling back to the canary's own wording. */
export const groupWhatBreaks = (g: CompatGroup): string =>
  WHAT_BREAKS[groupLabel(g)] ?? groupSummary(g);

/** Group labels the page has no plain-language line for. */
export const groupsMissingDescription: readonly string[] = compatGroups
  .map(groupLabel)
  .filter((label) => !(label in WHAT_BREAKS));
