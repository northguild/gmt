/**
 * What `/pulse/` shows, joined from its sources. The one hand-written source is
 * `scripts/lib/pulse.mjs`; `scripts/build-pulse.mjs` reads each workflow file (its name, its
 * schedules, its jobs) and the recent runs, and writes `generated/pulse.json` and
 * `generated/pulse-runs.live.json`. This module adds what the other pages already know: the
 * workaround states from the compat snapshot and the filings. Counts come from those joins.
 */
import pulseData from "../generated/pulse.json";
import { compatGroups, groupLabel, type CompatGroup } from "./temporal-compat";
import { filingKey, filings, type UpstreamFiling } from "./upstream-filings";

export type PulseAreaId = "temporal" | "clocks" | "site";

export type PulseLife =
  | { kind: "permanent"; why: string }
  | { kind: "workarounds"; groups: "all" | readonly string[] }
  | {
      kind: "condition";
      until: string;
      waitsOn?: readonly string[];
      waitsOnRepos?: readonly string[];
    };

export interface PulseCheck {
  id: string;
  name: string;
  area: PulseAreaId;
  source: string;
  job?: string;
  scripts?: readonly string[];
  watches: string;
  finds: string;
  life: PulseLife;
  story: string;
}

export interface PulseCard {
  source: string;
  file: string;
  kind: "workflow" | "test";
  name: string;
  crons: readonly string[];
  jobs: readonly { id: string; name: string }[];
  checkIds: readonly string[];
}

export interface PulseRun {
  startedAt: string;
  conclusion: string;
  url: string;
}

interface RunsFile {
  runsRead: string;
  workflows: Record<string, readonly PulseRun[] | null>;
}

const isRunsFile = (value: unknown): value is RunsFile =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as RunsFile).runsRead === "string" &&
  typeof (value as RunsFile).workflows === "object";

// The live file is optional and gitignored. Outside Vite `import.meta.glob` does not exist, and a
// missing file is the same as a failed read: every strip then says NO SIGNAL. The guard reads
// `import.meta.env`, which Vite replaces at build; `typeof import.meta.glob` would stay in the
// built code and be false there (`lib/import-meta-glob-guard.test.ts`).
const liveModules = (
  import.meta.env === undefined
    ? {}
    : import.meta.glob("../generated/pulse-runs.live.json", {
        eager: true,
        import: "default",
      })
) as Record<string, unknown>;
const live = Object.values(liveModules)[0];
const runsFile: RunsFile | null = isRunsFile(live) ? live : null;

export const areas = pulseData.areas as readonly {
  id: PulseAreaId;
  heading: string;
  blurb: string;
}[];
export const checks = pulseData.checks as readonly PulseCheck[];
export const cards = pulseData.cards as readonly PulseCard[];

/** When the run history was read (UTC), or `null` when this build read none. */
export const runsRead: string | null = runsFile?.runsRead ?? null;

/** The recent scheduled runs of a card's workflow, newest first, or `null` when none were read. */
export const runsFor = (card: PulseCard): readonly PulseRun[] | null =>
  runsFile?.workflows[card.file] ?? null;

export const checkById = (id: string): PulseCheck => {
  const found = checks.find((c) => c.id === id);
  if (found === undefined) throw new Error(`pulse: no check ${id}`);
  return found;
};

export const cardsIn = (area: PulseAreaId): readonly PulseCard[] =>
  cards.filter((card) => checkById(card.checkIds[0]!).area === area);

/** The workaround groups a life claims, as the compat snapshot has them. */
export function groupsClaimed(life: PulseLife): readonly CompatGroup[] {
  if (life.kind !== "workarounds") return [];
  return life.groups === "all"
    ? compatGroups
    : compatGroups.filter((g) =>
        (life.groups as readonly string[]).includes(groupLabel(g)),
      );
}

/** The filings a `condition` life waits on: the keys it names, and every open one in its repos. */
export function filingsWaitedOn(life: PulseLife): readonly UpstreamFiling[] {
  if (life.kind !== "condition") return [];
  const keys = life.waitsOn ?? [];
  const repos = life.waitsOnRepos ?? [];
  return filings.filter(
    (f) =>
      keys.includes(filingKey(f)) ||
      (f.tracker === "github" && repos.includes(f.repo) && f.state === "open"),
  );
}

export type LifeStep = "watching" | "fixed" | "retired" | "permanent";

/**
 * Where a check is on its way out. `fixed` means the thing it waits on has been fixed upstream and
 * the check is due to go; `retired` never shows, because a retired check is gone from the list.
 */
export function lifeStep(life: PulseLife): LifeStep {
  switch (life.kind) {
    case "permanent":
      return "permanent";
    case "workarounds": {
      const claimed = groupsClaimed(life);
      return claimed.length > 0 && claimed.every((g) => g.state === "removable")
        ? "fixed"
        : "watching";
    }
    case "condition": {
      const waited = filingsWaitedOn(life);
      return waited.length > 0 && waited.every((f) => f.state === "closed")
        ? "fixed"
        : "watching";
    }
  }
}

/** The counts the summary row and a workaround life line print. */
export interface WorkaroundCounts {
  total: number;
  stillNeeded: number;
  removable: number;
  guards: number;
  other: number;
}

export function countWorkarounds(
  groups: readonly CompatGroup[],
): WorkaroundCounts {
  const count = (state: CompatGroup["state"]) =>
    groups.filter((g) => g.state === state).length;
  const stillNeeded = count("still-needed");
  const removable = count("removable");
  const guards = count("guard");
  return {
    total: groups.length,
    stillNeeded,
    removable,
    guards,
    other: groups.length - stillNeeded - removable - guards,
  };
}

export const summary = {
  checks: checks.length,
  scheduled: cards.filter((c) => c.crons.length > 0).length,
  workarounds: countWorkarounds(compatGroups),
  filingsOpen: filings.filter((f) => f.state === "open").length,
};
