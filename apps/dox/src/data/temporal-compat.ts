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
};

/**
 * The short form the `/upstream/` tables print for a GitHub reference: `tc39 #3292`,
 * `polyfill #369`, or `owner/repo #n` for any other repository.
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
};

/** The plain-language line for a group, falling back to the canary's own wording. */
export const groupWhatBreaks = (g: CompatGroup): string =>
  WHAT_BREAKS[groupLabel(g)] ?? groupSummary(g);

/** Group labels the page has no plain-language line for. */
export const groupsMissingDescription: readonly string[] = compatGroups
  .map(groupLabel)
  .filter((label) => !(label in WHAT_BREAKS));
