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

/**
 * The states a workaround group can be in. `workaroundState` in `pnpm compat:snapshot` decides
 * which; the page reads the answer and never works it out again.
 */
export const COMPAT_STATES = [
  "still-needed",
  "removable",
  "out-of-scope",
] as const;
export type CompatState = (typeof COMPAT_STATES)[number];

export interface CompatGroup {
  /** The canary ids this group covers, e.g. `["D3", "D4"]`. */
  defects: readonly string[];
  /** The group's one-line title from `scripts/temporal-compat.mjs`. */
  title: string;
  /** What has to happen upstream before the workaround can go. */
  trigger: string;
  probes: number;
  /** Probes still returning the wrong value; shown as a count, never used to choose the state. */
  failing: number;
  /**
   * Whether the workaround still has to run, as `workaroundState` in `pnpm compat:snapshot`
   * decided it on the polyfill installed at snapshot time. The page reads it as written.
   */
  state: CompatState;
  /**
   * Present when only some engines show the defect, from the script's `engines` scope (for
   * example `["firefox"]`). The snapshot is probed on Node, so such a row says `out-of-scope`
   * rather than `removable`: its probes pass there because the defect does not show there.
   */
  engines?: readonly string[];
}

type SnapshotRow = (typeof snapshot.groups)[number];

/**
 * A JSON import types `state` as `string`, so each row is narrowed here. Only the script writes the file and `snapshot --check` guards it, so a throw can fire only
 * on a hand-edited copy; it fails the build rather than rendering a wrong or empty column. The
 * row's values pass through unchanged: nothing is computed or corrected here.
 */
export const toCompatGroup = (row: SnapshotRow): CompatGroup => {
  const label = row.defects.join(" + ");
  const state = COMPAT_STATES.find((known) => known === row.state);
  if (state === undefined) {
    throw new Error(
      `temporal-compat.json: group ${label} has unknown state "${row.state}" — run pnpm compat:snapshot`,
    );
  }
  if (
    state === "out-of-scope" &&
    !(row as { engines?: string[] }).engines?.length
  ) {
    throw new Error(
      `temporal-compat.json: group ${label} has state "out-of-scope" but no engines — run pnpm compat:snapshot`,
    );
  }
  return { ...row, state };
};

export const compatGroups: readonly CompatGroup[] =
  snapshot.groups.map(toCompatGroup);

/** Groups whose workaround still has to run, because the snapshot's `state` says so. */
export const groupsStillNeeded: number = compatGroups.filter(
  (g) => g.state === "still-needed",
).length;

/** The engine ids the script scopes a workaround to, each as the page prints it. */
const ENGINE_LABELS: Readonly<Record<string, string>> = {
  firefox: "Firefox",
  webkit: "WebKit",
  chromium: "Chromium",
  node: "Node",
};

/** A lowercase engine id as the page prints it. */
export const engineLabel = (engine: string): string =>
  ENGINE_LABELS[engine] ?? engine.charAt(0).toUpperCase() + engine.slice(1);

/**
 * The badge text and the count line a row shows, chosen by `state` alone. The Astro row and the
 * Markdown twin both call it, so the two surfaces cannot drift. `failing` is only ever printed.
 */
export const stateLine = (g: CompatGroup): { badge: string; count: string } => {
  switch (g.state) {
    case "still-needed":
      return {
        badge: "✓ Yes",
        count: `${g.failing} of ${g.probes} checks fail`,
      };
    case "removable":
      return { badge: "No", count: `${g.probes} of ${g.probes} checks pass` };
    case "out-of-scope":
      return {
        badge: `✓ Yes, on ${(g.engines ?? []).map(engineLabel).join(" and ")}`,
        count: `${g.probes} of ${g.probes} checks pass on Node, which does not show this defect`,
      };
    default: {
      const unreachable: never = g.state;
      throw new Error(`stateLine: unhandled state ${String(unreachable)}`);
    }
  }
};

/** The repositories the `/upstream/` page knows by name, and the short label each one prints as. */
const KNOWN_REPOS: Readonly<Record<string, string>> = {
  "tc39/proposal-temporal": "tc39",
  "js-temporal/temporal-polyfill": "polyfill",
  "fullcalendar/temporal-polyfill": "fullcalendar",
  "tc39/ecma402": "ecma402",
  "nodejs/node": "node",
};

/**
 * The short form the `/upstream/` tables print for a GitHub reference: `tc39 #3292`,
 * `polyfill #369`, `node #67076`, or `owner/repo #n` for any other repository.
 */
export const shortRef = (repo: string, number: number): string =>
  `${KNOWN_REPOS[repo] ?? repo} #${number}`;

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
  D9: "Adding a very large number of months in a non-ISO calendar, where the polyfill takes a long time to refuse an amount that is out of range",
  D16: "Time ranges that name the time zone in a long or offset form, such as Eastern Standard Time or GMT-5, which Chrome, Node and Safari cut to a short name or drop",
  D17: "Time ranges that show a flexible day period and a time zone, such as 10 in the morning GMT-5, which Firefox writes as 10 AM",
  D19: "Two names for one zone, such as UTC and Etc/UTC or Asia/Kolkata and Asia/Calcutta, which the polyfill treats as different zones in Safari and WebKit",
  D22: "A length in days or larger measured from a repeated hour, which the polyfill can measure from the wrong pass or refuse, so it can be an hour too long or missing. Where the specification has no value, which also happens after a skipped hour, GMT returns its sentinel",
  D23: "Some languages and calendars, among them Scottish Gaelic, Galician, Burmese and Telugu, whose date patterns use the week-of-year year: asking Node or Chrome for the parts of such a date, or of a range, stopped the process with no error to catch",
  D24: "Dates in the same languages near the start or end of a year, which every browser prints with the year the week belongs to rather than the calendar year, and with some calendars, such as Buddhist in Telugu, on every day of the year",
  D25: "Japanese calendar dates before 1873, which every browser prints in a Japanese era such as Meiji 5 or Taika, where the calendar uses the Gregorian era until the end of 1872. A range across 1873 prints each date in its own era",
  D26: "Islamic calendar dates before the Hijra (622 CE), which Node and Chrome print as a negative year. They have no name for the era before the Hijra, so GMT returns its empty value there",
  D27: "Japanese calendar dates in Japanese with a two-digit year, which every browser prints as 令和6年 where 令和06年 is asked for, and with Arabic-Indic or other digits asked for, which Node, Chrome and Safari print in Latin digits. The first year of an era stays 元年",
  D28: "Chinese and Korean calendar dates with a two-digit year, where the Gregorian year shown beside the cycle year was padded, such as 05 for the year 5",
  D29: "Date ranges in some languages and calendars that leave out, repeat or mix up a part of one date, such as a Chinese calendar range a year apart without the Gregorian year, or a Yoruba range with the weekday twice. GMT prints both dates in full, joined the language's own way",
  D30: "Dates in the calendars named islamic and islamic-rgsa, which Node and Chrome print with an astronomical Islamic calendar the standard no longer offers. GMT uses islamic-tbla for islamic, and the language's default calendar for islamic-rgsa",
  D31: "Coptic calendar dates before the year 1 AM (ISO 284-08-29), which Node and Chrome print as a positive year counted backwards, such as 286 for the year -285, with no era. GMT prints the signed year and the era name",
  D32: "Islamic calendar dates on the first day of the year 1 AH (ISO 0622-07-19, and 0622-07-18 for islamic-tbla), which Safari prints for its first hours as the year 0 Before Hijra, and, west of UTC, the last hours of the day before as AH. GMT prints year 1 AH for the whole day",
  D33: "Chinese and Korean (Dangi) calendar dates on a runtime that prints them differently from the Purple Mountain Observatory (Chinese) or KASI (Dangi) date, such as Node and Chrome, which put the Chinese New Year 2027 on 7 February where the observatory has 6 February. GMT has no calendar data of its own, so on such a runtime a Chinese or Dangi date format returns its empty value. A runtime that prints the observatory date keeps its own text",
  D34: "Coptic calendar dates on the first day of the year 1 AM (ISO 284-08-29), which Safari prints for its first hours with the long era name Anno Martyrum, and ranges across that day, which Safari prints with the era twice. GMT prints AM for the whole day",
  D35: "Comparing two durations from a plain date, where a day or hour amount would reach a date past the supported range, which the polyfill refuses, so the answer was missing. Only the years, months and weeks move the date, so GMT answers",
};

/** The plain-language line for a group, falling back to the canary's own wording. */
export const groupWhatBreaks = (g: CompatGroup): string =>
  WHAT_BREAKS[groupLabel(g)] ?? groupSummary(g);

/** Group labels the page has no plain-language line for. */
export const groupsMissingDescription: readonly string[] = compatGroups
  .map(groupLabel)
  .filter((label) => !(label in WHAT_BREAKS));
