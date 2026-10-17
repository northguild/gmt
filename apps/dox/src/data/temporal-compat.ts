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
export const COMPAT_STATES = ["still-needed", "removable", "guard"] as const;
export type CompatState = (typeof COMPAT_STATES)[number];

/**
 * Why a group whose probes all pass is still kept, and until which release of which package.
 * Written by `workaroundState` in `pnpm compat:snapshot`, from the guard the script declares.
 */
export interface CompatGuard {
  /** The package whose version decides the guard. */
  package: string;
  /** The last version on which the passing probes prove nothing. */
  through: string;
  /** Plain-English reason the probes pass without proving the defect is gone. Shown on the page as written. */
  reason: string;
}

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
   * Present when the group declares a guard, from `workaroundState` in `pnpm compat:snapshot`.
   * With `state: "removable"` the guard has lapsed and the page shows no reason.
   */
  guard?: CompatGuard;
}

type SnapshotRow = (typeof snapshot.groups)[number];

/**
 * A JSON import types `state` as `string`, so each row is narrowed here, and a guarded row must say
 * why. Only the script writes the file and `snapshot --check` guards it, so a throw can fire only
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
  if (state === "guard") {
    const { guard } = row;
    if (
      guard === undefined ||
      !guard.package ||
      !guard.through ||
      !guard.reason
    ) {
      throw new Error(
        `temporal-compat.json: group ${label} has state "guard" but no complete guard (package, through, reason) — run pnpm compat:snapshot`,
      );
    }
  }
  return { ...row, state };
};

export const compatGroups: readonly CompatGroup[] =
  snapshot.groups.map(toCompatGroup);

/** Groups whose workaround still has to run, because the snapshot's `state` says so. */
export const groupsStillNeeded: number = compatGroups.filter(
  (g) => g.state === "still-needed",
).length;

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
    case "guard":
      return {
        badge: "Kept on purpose",
        count: `${g.probes} of ${g.probes} checks pass`,
      };
    default: {
      const unreachable: never = g.state;
      throw new Error(`stateLine: unhandled state ${String(unreachable)}`);
    }
  }
};

/**
 * The short form the `/upstream/` tables print for a GitHub reference: `tc39 #3292`,
 * `polyfill #369`, or `owner/repo #n` for any other repository.
 */
export const shortRef = (repo: string, number: number): string => {
  const name =
    repo === "tc39/proposal-temporal"
      ? "tc39"
      : repo === "js-temporal/temporal-polyfill"
        ? "polyfill"
        : repo;
  return `${name} #${number}`;
};

/** A run of plain text in a guard reason, or a reference the page prints as a link. */
export type ReasonPart = { text: string } | { text: string; href: string };

const GITHUB_REF = /\b([\w.-]+\/[\w.-]+)#(\d+)\b/g;

/**
 * A guard reason split for the page. Each `owner/repo#n` becomes a short link, so the narrow
 * state column never has to break a 27-character token mid-word. The snapshot, the Markdown twin
 * and the canary issue keep the full reference.
 */
export const reasonParts = (reason: string): readonly ReasonPart[] => {
  const parts: ReasonPart[] = [];
  let last = 0;
  for (const m of reason.matchAll(GITHUB_REF)) {
    const [whole, repo, number] = m;
    if (m.index > last) parts.push({ text: reason.slice(last, m.index) });
    parts.push({
      text: shortRef(repo, Number(number)),
      href: `https://github.com/${repo}/issues/${number}`,
    });
    last = m.index + whole.length;
  }
  if (last < reason.length) parts.push({ text: reason.slice(last) });
  return parts;
};

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
  D12: "Zoned strings whose offset is written with seconds, in a zone whose offset was not a whole number of minutes",
  D13: "Finding a zone's clock changes, and the start or length of a day, where two changes fall less than 14 days apart",
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
