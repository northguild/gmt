/**
 * The upstream filings GMT has reported against `@js-temporal/polyfill`,
 * `tc39/proposal-temporal`, `fullcalendar/temporal-polyfill`, `tc39/ecma402` and `nodejs/node` on
 * GitHub, and on the Unicode Jira, the Chromium issue tracker and two Bugzilla servers. Every entry
 * names its tracker (`tracker`), and each tracker has its own identity fields, so no entry carries a
 * member that belongs to another tracker. `/upstream/` and its `UpstreamTracker.astro`
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
import { shortRef } from "./temporal-compat";
import committedData from "./upstream-filings.json";

/** `port` mirrors an already-merged upstream commit; `fix` and `report` are a
 * new, unreported defect (a PR and its paired issue); `release` asks for a
 * publish of commits already on `main`. */
export type FilingWork = "port" | "fix" | "report" | "release";

/** What every tracker's filing carries: our judgement, then what the tracker reports. */
interface FilingBase {
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
   * Set (as `true`) when `gmtNote` says GMT has no workaround: the bug reaches a GMT user, so the
   * page must not call the filing "Not affected". Absent otherwise. Allowed only with a `gmtNote`
   * (`scripts/upstream.mjs check` enforces it).
   */
  gmtUnguarded?: true;
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
   * from the tracker's own identity every run. */
  contributionUrl?: string | null;
  /**
   * The IANA zone the filing's own report names, in its title, summary or repro. Absent when it
   * names none: the filing still counts, it just has no pin on the deck's map.
   */
  zone?: string;
  state: "open" | "closed";
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  /** Live file only: discovery found this filing but the committed file doesn't have it
   * yet, so its hand-written fields (`summary`, `gmtGuard`, ...) are still empty. */
  new?: boolean;
}

/** A GitHub issue or pull request. */
export interface GitHubFiling extends FilingBase {
  tracker: "github";
  repo: string;
  number: number;
  kind: "pr" | "issue";
  draft: boolean;
  reviewDecision: "APPROVED" | "CHANGES_REQUESTED" | "REVIEW_REQUIRED" | null;
  comments: number;
  /** Comments by anyone outside GMT (`AUTHORS` in `scripts/upstream.mjs`), so a
   * cross-link one of us posts never counts as a maintainer response. */
  maintainerComments: number;
  mergedAt: string | null;
}

/** An issue in the Unicode Jira (`ICU-…` or `CLDR-…`). */
export interface JiraFiling extends FilingBase {
  tracker: "jira";
  /** The Jira key, such as `"ICU-23619"`. */
  key: string;
  /** Jira's own status name, such as `"Accepted"` or `"Done"`. */
  status: string;
  /** Jira's resolution name once resolved, such as `"Fixed"`; `null` while unresolved. */
  resolution: string | null;
  fixVersions: readonly string[];
  comments: number;
  maintainerComments: number;
}

/**
 * An issue on the Chromium issue tracker. The tracker has no public API, so what is read is the
 * state and the dates; the comment counts are `null` because the endpoint we can call without
 * signing in does not return comments.
 */
export interface ChromiumFiling extends FilingBase {
  tracker: "chromium";
  /** The numeric issue id. */
  id: number;
  comments: null;
  maintainerComments: null;
}

/** A bug on a Bugzilla server (`bugzilla.mozilla.org` or `bugs.webkit.org`). */
export interface BugzillaFiling extends FilingBase {
  tracker: "bugzilla";
  host: string;
  /** The numeric bug id. */
  id: number;
  /** Bugzilla's status, such as `"NEW"` or `"RESOLVED"`. */
  status: string;
  /** Bugzilla's resolution once resolved, such as `"FIXED"`; `null` while open. */
  resolution: string | null;
  comments: number;
  maintainerComments: number;
}

export type UpstreamFiling =
  | GitHubFiling
  | JiraFiling
  | ChromiumFiling
  | BugzillaFiling;

/**
 * A pull request or an issue GMT opened on a project outside Temporal, such as a comparison list
 * that should include GMT. It fixes no Temporal defect, so it is not a filing: it has no `work`,
 * `gmtGuard` or `gmtNote`, and it is counted nowhere. Only `summary` is hand-written; the rest is
 * synced.
 */
export interface UpstreamListing {
  tracker: "github";
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
  "gmtUnguarded",
  "role",
  "contributionUrl",
  "outcome",
  "zone",
] as const;

/** The fields a person writes on a listing; the same list as `LISTING_HAND_WRITTEN_FIELDS` in
 * `scripts/upstream.mjs`, which a test holds equal. */
export const LISTING_HAND_WRITTEN_FIELDS = ["summary"] as const;

/** The stable identity of an entry: `owner/repo#n`, `ICU-23619`, `chromium#n`, `host#n`. */
export const filingKey = (f: UpstreamFiling | UpstreamListing): string => {
  switch (f.tracker) {
    case "github":
      return `${f.repo}#${f.number}`;
    case "jira":
      return f.key;
    case "chromium":
      return `chromium#${f.id}`;
    case "bugzilla":
      return `${f.host}#${f.id}`;
  }
};

/** The trackers, in page order. Mirrors `TRACKERS` in `scripts/upstream.mjs`. */
export const TRACKERS = ["github", "jira", "chromium", "bugzilla"] as const;

/**
 * The repositories the tracker follows, in page order. Mirrors `REPOS` in `scripts/upstream.mjs`,
 * which a test holds equal.
 */
export const TRACKED_REPOS = [
  "js-temporal/temporal-polyfill",
  "tc39/proposal-temporal",
  "fullcalendar/temporal-polyfill",
  "tc39/ecma402",
  "nodejs/node",
] as const;

/** A heading on the page: one GitHub repository, or one other tracker. */
export interface FilingGroup {
  /** Stable id, the page's grouping key. */
  id: string;
  /** What the heading says. */
  name: string;
  /** Where the heading links. */
  href: string;
}

const JIRA_HOST = "unicode-org.atlassian.net";

/** Which heading a filing sits under. */
export function filingGroup(f: UpstreamFiling): FilingGroup {
  switch (f.tracker) {
    case "github":
      return {
        id: f.repo,
        name: f.repo,
        href: `https://github.com/${f.repo}`,
      };
    case "jira":
      return {
        id: JIRA_HOST,
        name: "Unicode Jira (ICU and CLDR)",
        href: `https://${JIRA_HOST}`,
      };
    case "chromium":
      return {
        id: "issues.chromium.org",
        name: "Chromium issue tracker",
        href: "https://issues.chromium.org",
      };
    case "bugzilla":
      return {
        id: f.host,
        name:
          f.host === "bugs.webkit.org" ? "WebKit Bugzilla" : "Mozilla Bugzilla",
        href: `https://${f.host}`,
      };
  }
}

/** The short label a table prints for one filing: `tc39 #3292`, `ICU-23619`, `Chromium 585635918`. */
export function filingRef(f: UpstreamFiling | UpstreamListing): string {
  switch (f.tracker) {
    case "github":
      return shortRef(f.repo, f.number);
    case "jira":
      return f.key;
    case "chromium":
      return `Chromium ${f.id}`;
    case "bugzilla":
      return `${f.host === "bugs.webkit.org" ? "WebKit" : "Mozilla"} ${f.id}`;
  }
}

/** The page order of two entries: tracker, then repository or host, then number. */
const orderKey = (
  f: UpstreamFiling | UpstreamListing,
): [number, string, number] => {
  const rank = TRACKERS.indexOf(f.tracker);
  switch (f.tracker) {
    case "github": {
      const i = (TRACKED_REPOS as readonly string[]).indexOf(f.repo);
      return [
        rank,
        String(i === -1 ? TRACKED_REPOS.length : i).padStart(3, "0") + f.repo,
        f.number,
      ];
    }
    case "jira":
      return [rank, f.key.split("-")[0], Number(f.key.split("-")[1])];
    case "chromium":
      return [rank, "", f.id];
    case "bugzilla":
      return [rank, f.host, f.id];
  }
};

const byPageOrder = (
  a: UpstreamFiling | UpstreamListing,
  b: UpstreamFiling | UpstreamListing,
): number => {
  const [ra, sa, na] = orderKey(a);
  const [rb, sb, nb] = orderKey(b);
  return ra - rb || sa.localeCompare(sb) || na - nb;
};

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
  const liveByKey = new Map(live.filings.map((f) => [filingKey(f), f]));
  const fromCommitted = committed.filings.map((own) => {
    const fresh = liveByKey.get(filingKey(own));
    if (fresh === undefined) return own;
    const merged: Record<string, unknown> = { ...fresh };
    for (const field of HAND_WRITTEN_FIELDS) {
      if (field in own) merged[field] = own[field];
      else delete merged[field];
    }
    return merged as unknown as UpstreamFiling;
  });
  const committedKeys = new Set(committed.filings.map(filingKey));
  const onlyLive = live.filings.filter((f) => !committedKeys.has(filingKey(f)));
  return {
    checked: live.checked,
    filings: [...fromCommitted, ...onlyLive].sort(byPageOrder),
    listings: overlayListings(committed.listings ?? [], live.listings),
  };
}

function overlayListings(
  committed: readonly UpstreamListing[],
  live: readonly UpstreamListing[] | undefined,
): readonly UpstreamListing[] {
  if (live === undefined) return committed;
  const liveByKey = new Map(live.map((l) => [filingKey(l), l]));
  return committed
    .map((own) => {
      const fresh = liveByKey.get(filingKey(own));
      if (fresh === undefined) return own;
      const merged: Record<string, unknown> = { ...fresh };
      for (const field of LISTING_HAND_WRITTEN_FIELDS)
        merged[field] = own[field];
      return merged as unknown as UpstreamListing;
    })
    .sort(byPageOrder);
}

function isUpstreamFilings(value: unknown): value is UpstreamFilings {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as UpstreamFilings).checked === "string" &&
    Array.isArray((value as UpstreamFilings).filings) &&
    // A live file written before the trackers were named holds GitHub entries without a
    // `tracker`; it is ignored and the committed file stands.
    (value as UpstreamFilings).filings.every((f) =>
      (TRACKERS as readonly string[]).includes(f?.tracker),
    )
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
// The guard reads `import.meta.env`, which Vite replaces at build; `typeof import.meta.glob`
// would stay in the built code and be false there (`lib/import-meta-glob-guard.test.ts`).
const liveModules = (
  import.meta.env === undefined
    ? {}
    : import.meta.glob("../generated/upstream-filings.live.json", {
        eager: true,
        import: "default",
      })
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

/** Every distinct heading a filing sits under, in first-seen (JSON) order. */
export const filingGroups: readonly FilingGroup[] = [
  ...new Map(filings.map((f) => [filingGroup(f).id, filingGroup(f)])).values(),
];

/** Filings under one heading, in the order the JSON lists them. */
export function filingsForGroup(id: string): readonly UpstreamFiling[] {
  return filings.filter((f) => filingGroup(f).id === id);
}

export interface CountRow {
  label: string;
  count: number;
}

/** How many filings sit under each heading. */
export const filingsByRepo: readonly CountRow[] = filingGroups.map((g) => ({
  label: g.id,
  count: filingsForGroup(g.id).length,
}));

/** How many filings are a GitHub PR versus a GitHub issue; other trackers have issues only. */
export const filingsByKind: readonly CountRow[] = (
  ["pr", "issue"] as const
).map((kind) => ({
  label: kind,
  count: filings.filter(
    (f) => (f.tracker === "github" ? f.kind : "issue") === kind,
  ).length,
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
  (f) => (f.maintainerComments ?? 0) > 0,
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
  (f) => f.gmtGuard === null && f.gmtNote !== null && !f.gmtUnguarded,
).length;

/** Filings whose defect reaches a GMT user and that no GMT workaround covers. */
export const unguardedInGmt: number = filings.filter(
  (f) => f.gmtUnguarded === true,
).length;

const isOurs = (f: UpstreamFiling): boolean => f.role !== "contributor";

/** Filings we opened ourselves. */
export const filedByUs: number = filings.filter(isOurs).length;

/** Filings someone else opened, where our contribution was evidence on an existing fix. */
export const contributions: number = filings.filter((f) => !isOurs(f)).length;

/** Our own pull requests — the filings that carry a ready-to-merge patch. A maintainer's PR we
 * only commented on is not one of these, which is why the page cannot count `kind === "pr"`. */
export const filedPrs: number = filings.filter(
  (f) => isOurs(f) && f.tracker === "github" && f.kind === "pr",
).length;
