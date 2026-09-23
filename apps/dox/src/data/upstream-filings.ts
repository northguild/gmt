/**
 * The upstream filings GMT has reported against `@js-temporal/polyfill` and
 * `tc39/proposal-temporal`. `/upstream/` and its `UpstreamTracker.astro`
 * import every figure from here, the same way `gmt-stats.ts` is the one place
 * a GMT number is typed.
 *
 * Two sources, one export. `./upstream-filings.json` is committed — the
 * fallback for offline and local builds, and the only place a filing's
 * hand-written fields (`summary`, `gmtGuard`, ...) get edited, by
 * `pnpm upstream:sync` (see `scripts/upstream.mjs`). `apps/dox`'s `generate`
 * script also runs `node scripts/upstream.mjs refresh` on every `dox:dev` and
 * `dox:build`, which best-effort writes a *live* copy to the gitignored
 * `../generated/upstream-filings.live.json` and never touches the committed
 * one. This module prefers the live file when `refresh` managed to produce
 * one, so the tracker looks current during ordinary work, and falls back to
 * the committed snapshot otherwise — `dataSource` says which one won, and the
 * page's "last checked" line reads `checked` off whichever file that is.
 *
 * The live file is read with `import.meta.glob` rather than a static import
 * specifically because it may not exist: a missing static import is a build
 * error, but a glob that matches nothing is just an empty object.
 */
import committedData from "./upstream-filings.json";

/** `port` mirrors an already-merged upstream commit; `fix` and `report` are a
 * new, unreported defect (a PR and its paired issue); `release` asks for a
 * publish of commits already on `main`. */
export type FilingWork = "port" | "fix" | "report" | "release";

export interface UpstreamFiling {
  repo: string;
  number: number;
  kind: "pr" | "issue";
  /** `null` only for a filing `sync` just discovered and nobody has classified yet. */
  work: FilingWork | null;
  title: string;
  url: string;
  /** One hand-written sentence: what goes wrong for a user. Empty only right after discovery. */
  summary: string;
  /** `"owner/repo#number"` of the matching filing in the other repository, if any. */
  pairsWith: readonly string[];
  /** `"owner/repo#number"` issues this filing closes. */
  closes: readonly string[];
  /** `"owner/repo#number"` filings this one depends on. */
  dependsOn: readonly string[];
  /** The `packages/gmt/src/internal/temporalCompat/repros.ts` canary group this
   * filing would let GMT retire, or `null` when no GMT workaround covers the defect. */
  gmtGuard: string | null;
  /** Why the defect doesn't affect GMT, when no workaround is needed. Exactly one of
   * `gmtGuard` and `gmtNote` is set (`scripts/upstream.mjs check` enforces it). */
  gmtNote: string | null;
  /**
   * Whether we opened this filing or only contributed to someone else's.
   *
   * Absent means `"author"`, so the filings we opened need no field. A `"contributor"` row is a
   * maintainer's issue or PR that already carried the fix, where the useful thing was evidence
   * rather than a duplicate: it is tracked because its state is what retires a GMT workaround, but
   * it is never counted among the fixes we sent.
   */
  role?: "author" | "contributor";
  /**
   * Why a filing closed without merging, in the maintainer's own terms.
   *
   * A bare "Closed" reads as a rejection. Every one of ours was closed with a routing instruction
   * instead — ports must land in order, new fixes go to the standard first — so the page says which.
   */
  outcome?: string | null;
  /** A `"contributor"` row's link to our own comment. `url` cannot hold it: `sync` rewrites `url`
   * from the repo, kind and number every run. */
  contributionUrl?: string | null;
  state: "open" | "closed";
  draft: boolean;
  reviewDecision: "APPROVED" | "CHANGES_REQUESTED" | "REVIEW_REQUIRED" | null;
  comments: number;
  /** Comments not by the filing's own author, so a cross-link the owner posts
   * to their own filing never counts as a maintainer response. */
  maintainerComments: number;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  mergedAt: string | null;
  /** Live file only: `gh` found this filing but the committed file doesn't have it
   * yet, so its hand-written fields (`summary`, `gmtGuard`, ...) are still empty. */
  new?: boolean;
}

interface UpstreamFilings {
  /** When this file's data was last read from GitHub, ISO 8601. */
  checked: string;
  filings: readonly UpstreamFiling[];
}

function isUpstreamFilings(value: unknown): value is UpstreamFilings {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as UpstreamFilings).checked === "string" &&
    Array.isArray((value as UpstreamFilings).filings)
  );
}

// `eager: true` + `import: "default"` because a page needs this synchronously
// at render time, not a dynamic loader; the glob (rather than a static
// `import`) is what lets the file be absent without failing the build.
//
// `import.meta.glob` is Vite's, so it exists during an Astro build and not in the plain Node that
// generates the text surfaces. Guarded rather than assumed: without this, importing this module
// from `lib/mdx-jsx.ts` — which the `.md`, `llms-full.txt` and retrieval-chunk pipeline runs
// outside Vite — dies on `glob is not a function`. Outside Vite it takes the committed snapshot,
// which is the same fallback a missing live file already gets, and the one `upstream check` gates.
const liveModules = (
  typeof import.meta.glob === "function"
    ? import.meta.glob("../generated/upstream-filings.live.json", {
        eager: true,
        import: "default",
      })
    : {}
) as Record<string, unknown>;
const liveData = Object.values(liveModules)[0];

/** Which file backed `upstreamFilings` this run: the live refresh, or the committed fallback. */
export const dataSource: "live" | "committed" = isUpstreamFilings(liveData)
  ? "live"
  : "committed";

const upstreamFilings: UpstreamFilings = (
  dataSource === "live" ? liveData : committedData
) as UpstreamFilings;
export const filings: readonly UpstreamFiling[] = upstreamFilings.filings;
export const checked: string = upstreamFilings.checked;

/** Every distinct repository a filing names, in first-seen (JSON) order. */
export const filingRepos: readonly string[] = [
  ...new Set(filings.map((f) => f.repo)),
];

/** Filings for one repository, in the order the JSON lists them (repo, then number). */
export function filingsForRepo(repo: string): readonly UpstreamFiling[] {
  return filings.filter((f) => f.repo === repo);
}

export interface CountRow {
  label: string;
  count: number;
}

/** How many filings name each repository. */
export const filingsByRepo: readonly CountRow[] = filingRepos.map((repo) => ({
  label: repo,
  count: filingsForRepo(repo).length,
}));

/** How many filings are a PR versus an issue. */
export const filingsByKind: readonly CountRow[] = (
  ["pr", "issue"] as const
).map((kind) => ({
  label: kind,
  count: filings.filter((f) => f.kind === kind).length,
}));

/** How many filings are open versus closed. */
export const filingsByState: readonly CountRow[] = (
  ["open", "closed"] as const
).map((state) => ({
  label: state,
  count: filings.filter((f) => f.state === state).length,
}));

/** Filings with at least one comment from someone other than the author. */
export const filingsWithMaintainerResponse: number = filings.filter(
  (f) => f.maintainerComments > 0,
).length;

/** Every distinct non-null `gmtGuard` a filing names — the GMT canary groups
 * these filings would collectively let `pnpm compat` retire, deduplicated
 * because more than one filing can target the same group (#369 and #370 both
 * target `D1`). */
export const guardsAddressed: readonly string[] = [
  ...new Set(
    filings.map((f) => f.gmtGuard).filter((g): g is string => g !== null),
  ),
].sort();

export const totalFilings: number = filings.length;

/** Filings a GMT workaround already covers, so GMT returns the correct answer today. */
export const handledInGmt: number = filings.filter(
  (f) => f.gmtGuard !== null,
).length;

/** Filings whose defect is in code GMT doesn't use, so they don't affect GMT. */
export const unaffectingGmt: number = filings.filter(
  (f) => f.gmtGuard === null && f.gmtNote !== null,
).length;

const isOurs = (f: UpstreamFiling): boolean => f.role !== "contributor";

/** Filings we opened ourselves. */
export const filedByUs: number = filings.filter(isOurs).length;

/** Filings someone else opened, where our contribution was evidence on an existing fix. */
export const contributions: number = filings.filter((f) => !isOurs(f)).length;

/** Our own pull requests — the filings that carry a ready-to-merge patch. A maintainer's PR we
 * only commented on is not one of these, which is why the page cannot count `kind === "pr"`. */
export const filedPrs: number = filings.filter(
  (f) => isOurs(f) && f.kind === "pr",
).length;
