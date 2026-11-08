/**
 * The upstream filings GMT has reported against `@js-temporal/polyfill`,
 * `tc39/proposal-temporal` and `fullcalendar/temporal-polyfill`. `/upstream/` and its `UpstreamTracker.astro`
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
 * one. When the live file is newer, this module lays it over the committed
 * one (`overlayLive`), so the tracker's states and comments look current
 * during ordinary work. The committed file still decides which filings exist
 * and what their hand-written fields say, so a live file left over from an
 * older commit can never hide a filing. `dataSource` says whether the live
 * file was used, and the page's "last checked" line reads that file's `checked`.
 *
 * The live file is read with `import.meta.glob` rather than a static import
 * specifically because it may not exist: a missing static import is a build
 * error, but a glob that matches nothing is just an empty object.
 */
import { isAfterUtc } from "@northguild/gmt";
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
  /** Comments by anyone outside GMT (`AUTHORS` in `scripts/upstream.mjs`), so a
   * cross-link one of us posts never counts as a maintainer response. */
  maintainerComments: number;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  mergedAt: string | null;
  /** Live file only: `gh` found this filing but the committed file doesn't have it
   * yet, so its hand-written fields (`summary`, `gmtGuard`, ...) are still empty. */
  new?: boolean;
}

/**
 * A pull request or an issue GMT opened on a project outside Temporal, such as a comparison list
 * that should include GMT. It fixes no Temporal defect, so it is not a filing: it has no `work`,
 * `gmtGuard` or `gmtNote`, and it is counted nowhere. Only `summary` is hand-written; the rest is
 * synced.
 */
export interface UpstreamListing {
  repo: string;
  number: number;
  kind: "pr" | "issue";
  /** One hand-written sentence: what the pull request or issue asks for. */
  summary: string;
  title: string;
  url: string;
  state: "open" | "closed";
  draft: boolean;
  reviewDecision: "APPROVED" | "CHANGES_REQUESTED" | "REVIEW_REQUIRED" | null;
  comments: number;
  maintainerComments: number;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  mergedAt: string | null;
}

export interface UpstreamFilings {
  /** When this file's data was last read from GitHub, ISO 8601. */
  checked: string;
  filings: readonly UpstreamFiling[];
  /** Absent in a live file written before listings existed. */
  listings?: readonly UpstreamListing[];
}

/** The fields a person writes in the committed file. `sync` and `refresh` copy them and never read
 * them from GitHub. The same list as `HAND_WRITTEN_FIELDS` in `scripts/upstream.mjs`, which a test
 * holds equal. */
export const HAND_WRITTEN_FIELDS = [
  "summary",
  "work",
  "pairsWith",
  "closes",
  "dependsOn",
  "gmtGuard",
  "gmtNote",
  "role",
  "contributionUrl",
  "outcome",
] as const;

/** The fields a person writes on a listing; the same list as `LISTING_HAND_WRITTEN_FIELDS` in
 * `scripts/upstream.mjs`, which a test holds equal. */
export const LISTING_HAND_WRITTEN_FIELDS = ["summary"] as const;

const keyOf = (f: { repo: string; number: number }): string =>
  `${f.repo}#${f.number}`;

/**
 * The repositories the tracker follows, in page order. Mirrors `REPOS` in `scripts/upstream.mjs`,
 * which a test holds equal.
 */
export const TRACKED_REPOS = [
  "js-temporal/temporal-polyfill",
  "tc39/proposal-temporal",
  "fullcalendar/temporal-polyfill",
] as const;

const repoRank = (repo: string): number => {
  const i = (TRACKED_REPOS as readonly string[]).indexOf(repo);
  return i === -1 ? TRACKED_REPOS.length : i;
};

const byRepoThenNumber = (
  a: { repo: string; number: number },
  b: { repo: string; number: number },
): number =>
  repoRank(a.repo) - repoRank(b.repo) ||
  a.repo.localeCompare(b.repo) ||
  a.number - b.number;

/**
 * The live file laid over the committed one.
 *
 * The live file is a cache, and `refresh` reuses it for six hours without a network call. One
 * written before a pull still holds the filings and summaries of that older commit. So the
 * committed file decides which filings exist and what their hand-written fields say. The live file
 * adds two things: newer GitHub fields (state, comments, dates) for those filings, and any filing
 * discovery found that the committed file does not have yet. Listings follow the same rule with one
 * difference: nothing discovers them, so a listing only the live file has is dropped, and a live
 * file without `listings` leaves the committed ones as they are. A live file checked before the
 * committed one has nothing newer, so the committed file stands alone.
 */
export function overlayLive(
  committed: UpstreamFilings,
  live: UpstreamFilings,
): UpstreamFilings {
  if (!isAfterUtc(live.checked, committed.checked)) return committed;
  const liveByKey = new Map(live.filings.map((f) => [keyOf(f), f]));
  const fromCommitted = committed.filings.map((own) => {
    const fresh = liveByKey.get(keyOf(own));
    if (fresh === undefined) return own;
    const merged: Record<string, unknown> = { ...fresh };
    for (const field of HAND_WRITTEN_FIELDS) {
      if (field in own) merged[field] = own[field];
      else delete merged[field];
    }
    return merged as unknown as UpstreamFiling;
  });
  const committedKeys = new Set(committed.filings.map(keyOf));
  const onlyLive = live.filings.filter((f) => !committedKeys.has(keyOf(f)));
  return {
    checked: live.checked,
    filings: [...fromCommitted, ...onlyLive].sort(byRepoThenNumber),
    listings: overlayListings(committed.listings ?? [], live.listings),
  };
}

function overlayListings(
  committed: readonly UpstreamListing[],
  live: readonly UpstreamListing[] | undefined,
): readonly UpstreamListing[] {
  if (live === undefined) return committed;
  const liveByKey = new Map(live.map((l) => [keyOf(l), l]));
  return committed
    .map((own) => {
      const fresh = liveByKey.get(keyOf(own));
      if (fresh === undefined) return own;
      const merged: Record<string, unknown> = { ...fresh };
      for (const field of LISTING_HAND_WRITTEN_FIELDS)
        merged[field] = own[field];
      return merged as unknown as UpstreamListing;
    })
    .sort(byRepoThenNumber);
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

const committedFilings = committedData as UpstreamFilings;

/** Which file the page's GitHub fields came from this run: a live refresh newer than the committed
 * file, or the committed file alone. */
export const dataSource: "live" | "committed" =
  isUpstreamFilings(liveData) &&
  isAfterUtc(liveData.checked, committedFilings.checked)
    ? "live"
    : "committed";

const upstreamFilings: UpstreamFilings =
  dataSource === "live" && isUpstreamFilings(liveData)
    ? overlayLive(committedFilings, liveData)
    : committedFilings;
export const filings: readonly UpstreamFiling[] = upstreamFilings.filings;
export const checked: string = upstreamFilings.checked;
/** Pull requests GMT opened outside Temporal. Not filings: no tally below counts them. */
export const listings: readonly UpstreamListing[] =
  upstreamFilings.listings ?? [];

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
