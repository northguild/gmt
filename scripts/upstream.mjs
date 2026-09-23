#!/usr/bin/env node
/**
 * Upstream-filing tooling for the docs site's tracker page (`/upstream/`).
 *
 *   node scripts/upstream.mjs sync     discover and refresh apps/dox/src/data/upstream-filings.json
 *                                       (the committed fallback) — the explicit, owner-run update
 *   node scripts/upstream.mjs refresh  best-effort refresh of the gitignored
 *                                       apps/dox/src/generated/upstream-filings.live.json — never
 *                                       touches the committed file, never fails the caller
 *   node scripts/upstream.mjs check    verify the committed file offline; exit 1 on a problem
 *
 * GMT reports the `@js-temporal/polyfill` and `tc39/proposal-temporal` defects it works around
 * upstream (`context/domination/js-temporal-polyfill-bugs.md`), and the docs site's `/upstream/`
 * page tracks every filing's status live. This is `stats.mjs` applied to that tracker: a
 * generator plus an offline check, so the published numbers can never drift from GitHub's own
 * or from `packages/gmt/src/internal/temporalCompat/repros.ts`'s guard groups.
 *
 * Each filing has two kinds of field:
 *
 *   hand-written  `summary`, `work`, `pairsWith`, `closes`, `dependsOn`, `gmtGuard` — the owner's
 *                 own judgement about what a filing says and what GMT workaround it would retire.
 *                 Neither `sync` nor `refresh` ever overwrites these — they always come from the
 *                 committed file; a filing that file doesn't have yet gets them empty, for a
 *                 human to fill in with `pnpm upstream:sync`.
 *   synced        `title`, `state`, `draft`, `reviewDecision`, `comments`, `maintainerComments`,
 *                 `createdAt`, `updatedAt`, `closedAt`, `mergedAt` — read fresh from GitHub, for
 *                 every filing whether or not this run's search re-discovers it.
 *
 * `sync` vs `refresh` — why there are two commands instead of one:
 *
 *   `sync` is what `pnpm upstream:sync` runs: an explicit, owner-initiated update of the
 *   committed `upstream-filings.json`, allowed to take its time and to fail loudly (`gh` not
 *   authenticated is a real problem to fix, not to shrug off). It is also the *only* place a new
 *   filing's hand-written fields get written, since the owner reviews `sync`'s "NEW" warning and
 *   edits the committed file by hand.
 *
 *   `refresh` is what `apps/dox`'s `generate` script runs on every `dox:dev` and `dox:build` — a
 *   convenience so the tracker looks live during ordinary work without anyone remembering to run
 *   `sync`. It must never make dev or CI slower or flakier than the committed snapshot already
 *   is, so it bounds its own total time (`REFRESH_BUDGET_MS`) and gives up **entirely** — one
 *   warning, no write, exit 0 — the moment anything about `gh` doesn't work: missing binary, no
 *   auth, rate limit, or a slow/offline network. Outside CI it also skips the network entirely
 *   while the live file is younger than `REFRESH_TTL_MS`, so a dev-server restart costs nothing
 *   (`UPSTREAM_REFRESH=force` overrides). `apps/dox/src/data/upstream-filings.ts` prefers
 *   the live file when `refresh` managed to write one, and falls back to the committed file
 *   otherwise — so a reader always sees *a* tracker, live or not.
 *
 * Discovery (`gh search issues --repo <repo> --author craig-o-curtis --include-prs`) is what
 * makes a new filing show up with no code change: the owner files it, and either command's next
 * run finds it. An existing filing the search happens to miss (a query quirk, a temporary API
 * hiccup) keeps its stored values rather than being dropped.
 */

import { execFile, execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { formatJson } from "./lib/format-json.mjs";
import { loadGmt, tryLoadGmt } from "./lib/gmt.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const FILE = "apps/dox/src/data/upstream-filings.json";
const LIVE_FILE = "apps/dox/src/generated/upstream-filings.live.json";
const REPROS = "packages/gmt/src/internal/temporalCompat/repros.ts";
const AUTHOR = "craig-o-curtis";
const REPOS = ["js-temporal/temporal-polyfill", "tc39/proposal-temporal"];

/** `refresh`'s total time budget — past this, it gives up rather than run long in a dev loop. */
const REFRESH_BUDGET_MS = 10_000;
/** Per-`gh`-call cap, so one hung network call can't eat the whole budget by itself. */
const REFRESH_CALL_TIMEOUT_MS = 4_000;
/** How long a live file counts as fresh: `refresh` makes no network calls inside this window, so
 * restarting `dox:dev` repeatedly costs nothing. CI and `UPSTREAM_REFRESH=force` always refresh. */
const REFRESH_TTL_MS = 6 * 60 * 60 * 1000;

/** Fields the owner sets by hand; `sync` never overwrites them once a filing exists. */
const HAND_WRITTEN_FIELDS = [
  "summary",
  "work",
  "pairsWith",
  "closes",
  "dependsOn",
  "gmtGuard",
  "gmtNote",
  // `role` and `contributionUrl` are hand-written too: discovery searches by author, so a filing
  // someone else opened is only ever here because a human added it, and a sync that dropped these
  // would silently turn a maintainer's PR into one of ours.
  "role",
  "contributionUrl",
  "outcome",
];
const EMPTY_HAND_WRITTEN = {
  summary: "",
  work: null,
  pairsWith: [],
  closes: [],
  dependsOn: [],
  gmtGuard: null,
  gmtNote: null,
  role: "author",
  contributionUrl: null,
  outcome: null,
};

// ---------------------------------------------------------------- gh arguments and parsing

const PR_VIEW_FIELDS =
  "number,title,state,isDraft,reviewDecision,createdAt,updatedAt,closedAt,mergedAt,comments";
const ISSUE_VIEW_FIELDS =
  "number,title,state,createdAt,updatedAt,closedAt,comments";

const isPr = (kind) => kind === "pr";

/** `gh` arguments for discovery: every open-or-closed issue/PR by `AUTHOR` in `repo`. */
function discoverArgs(repo) {
  return [
    "search",
    "issues",
    "--repo",
    repo,
    "--author",
    AUTHOR,
    "--include-prs",
    "--limit",
    "100",
    "--json",
    "number,isPullRequest",
  ];
}

/** `gh` arguments reading one filing's synced fields. */
function viewArgs(repo, number, kind) {
  return [
    isPr(kind) ? "pr" : "issue",
    "view",
    String(number),
    "--repo",
    repo,
    "--json",
    isPr(kind) ? PR_VIEW_FIELDS : ISSUE_VIEW_FIELDS,
  ];
}

/** Discovery output as filing identities — no field detail. */
function parseDiscovered(repo, raw) {
  return JSON.parse(raw).map((row) => ({
    repo,
    number: row.number,
    kind: row.isPullRequest ? "pr" : "issue",
  }));
}

/** A filing's canonical GitHub URL. */
function filingUrl(repo, kind, number) {
  return `https://github.com/${repo}/${isPr(kind) ? "pull" : "issues"}/${number}`;
}

/** A date-only (UTC) slice of an ISO timestamp, or `null`. */
function dateOnly(iso) {
  return iso ? iso.slice(0, 10) : null;
}

/** The synced fields only a PR has; an issue gets their fixed defaults. */
function prOnlyFields(data, kind) {
  if (!isPr(kind))
    return { draft: false, reviewDecision: null, mergedAt: null };
  return {
    draft: Boolean(data.isDraft),
    reviewDecision: data.reviewDecision || null,
    mergedAt: dateOnly(data.mergedAt),
  };
}

const isMaintainerComment = (c) => c.author?.login !== AUTHOR;

/** The full synced-field set for one filing, from `gh … view`'s raw JSON output. */
function parseSynced(raw, repo, number, kind) {
  const data = JSON.parse(raw);
  const comments = data.comments ?? [];
  const pr = prOnlyFields(data, kind);
  return {
    title: data.title,
    url: filingUrl(repo, kind, number),
    // `gh pr view` reports MERGED as its own state, which the schema does not have: a merged PR is
    // closed, and `mergedAt` is what tells the two apart (`filingStatus` reads it first). Until
    // #361 merged, no filing of ours had ever exercised this.
    state:
      data.state.toLowerCase() === "merged"
        ? "closed"
        : data.state.toLowerCase(),
    draft: pr.draft,
    reviewDecision: pr.reviewDecision,
    comments: comments.length,
    maintainerComments: comments.filter(isMaintainerComment).length,
    createdAt: dateOnly(data.createdAt),
    updatedAt: dateOnly(data.updatedAt),
    closedAt: dateOnly(data.closedAt),
    mergedAt: pr.mergedAt,
  };
}

/**
 * One filing record. Field order matches the schema documented in the plan: identity, then
 * hand-written judgement, then what GitHub itself reports.
 */
function buildFiling({ repo, number, kind }, hw, synced) {
  // `role` and `contributionUrl` are written only for a filing we did not open, so the ones we did
  // stay as they are. They have to be listed here as well as in HAND_WRITTEN_FIELDS: this builds
  // the output field by field, so anything it does not name is dropped on the next sync — and a
  // dropped `role` reads as "ours", which is the one mistake this file must not make quietly.
  const ours = hw.role !== "contributor";
  return {
    repo,
    number,
    kind,
    ...(ours ? {} : { role: hw.role }),
    work: hw.work,
    title: synced.title,
    url: synced.url,
    ...(ours ? {} : { contributionUrl: hw.contributionUrl }),
    summary: hw.summary,
    pairsWith: hw.pairsWith,
    closes: hw.closes,
    dependsOn: hw.dependsOn,
    gmtGuard: hw.gmtGuard,
    gmtNote: hw.gmtNote,
    ...(hw.outcome ? { outcome: hw.outcome } : {}),
    state: synced.state,
    draft: synced.draft,
    reviewDecision: synced.reviewDecision,
    comments: synced.comments,
    maintainerComments: synced.maintainerComments,
    createdAt: synced.createdAt,
    updatedAt: synced.updatedAt,
    closedAt: synced.closedAt,
    mergedAt: synced.mergedAt,
  };
}

const byRepoThenNumber = (a, b) =>
  a.repo.localeCompare(b.repo) || a.number - b.number;

// ---------------------------------------------------------------- gh helpers

/**
 * Run a `gh` command. `timeout` (ms), when given, bounds the call itself — `execFileSync` kills
 * the process and throws if it runs longer, which is what turns an offline network from a hang
 * into an ordinary catchable error.
 */
function gh(args, timeout) {
  return execFileSync("gh", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...(timeout ? { timeout } : {}),
  });
}

/** Every open-or-closed issue/PR by `AUTHOR` in `repo` — discovery only, no field detail. */
function discover(repo, timeout) {
  return parseDiscovered(repo, gh(discoverArgs(repo), timeout));
}

/** The full synced-field set for one filing, read live from GitHub. */
function fetchSynced(repo, number, kind, timeout) {
  return parseSynced(
    gh(viewArgs(repo, number, kind), timeout),
    repo,
    number,
    kind,
  );
}

const execFileAsync = promisify(execFile);

/** `gh`, run concurrently and awaited — `refresh` fires every call for a batch at once, since
 * `gh`'s own per-call latency (not CPU) dominates, and doing 13 round trips one at a time is what
 * pushed a warm-network run close to `REFRESH_BUDGET_MS` in testing. */
async function ghAsync(args, timeout) {
  const { stdout } = await execFileAsync("gh", args, {
    encoding: "utf8",
    ...(timeout ? { timeout } : {}),
  });
  return stdout;
}

async function discoverAsync(repo, timeout) {
  return parseDiscovered(repo, await ghAsync(discoverArgs(repo), timeout));
}

async function fetchSyncedAsync(repo, number, kind, timeout) {
  return parseSynced(
    await ghAsync(viewArgs(repo, number, kind), timeout),
    repo,
    number,
    kind,
  );
}

// ---------------------------------------------------------------- guard groups

/** Every `DefectId` / `ZonedDefectId` / `BoundedWorkDefectId` literal `repros.ts` declares. */
function knownGuards() {
  const src = readFileSync(`${ROOT}${REPROS}`, "utf8");
  const guards = new Set();
  for (const m of src.matchAll(
    /export type (?:DefectId|ZonedDefectId|BoundedWorkDefectId) =([^;]+);/g,
  )) {
    for (const lit of m[1].matchAll(/"([^"]+)"/g)) guards.add(lit[1]);
  }
  return guards;
}

// ---------------------------------------------------------------- files

function readJsonFile(relPath) {
  const path = `${ROOT}${relPath}`;
  if (!existsSync(path)) return { checked: null, filings: [] };
  return JSON.parse(readFileSync(path, "utf8"));
}

const readFile = () => readJsonFile(FILE);

const keyOf = (f) => `${f.repo}#${f.number}`;

/** The hand-written fields of `filing`, or the empty defaults when it has none. */
function handWrittenFieldsOf(filing) {
  return Object.fromEntries(
    HAND_WRITTEN_FIELDS.map((k) => [k, filing?.[k] ?? EMPTY_HAND_WRITTEN[k]]),
  );
}

// ---------------------------------------------------------------- commands

async function sync() {
  const gmt = await loadGmt();
  const existing = readFile();
  const byKey = new Map(existing.filings.map((f) => [keyOf(f), f]));

  // `(repo) => discover(repo)`, never `flatMap(discover)`: `flatMap` passes the element's index
  // as the second argument, which `discover` takes as its `timeout`, so the second repository got
  // a 1 ms cap and `sync` always died there.
  const discovered = REPOS.flatMap((repo) => discover(repo));
  const newlyFound = [];
  for (const { repo, number, kind } of discovered) {
    const key = `${repo}#${number}`;
    if (!byKey.has(key)) {
      byKey.set(key, { repo, number, kind, ...EMPTY_HAND_WRITTEN });
      newlyFound.push(key);
    }
  }

  const filings = [...byKey.values()]
    .map((filing) =>
      buildFiling(
        filing,
        handWrittenFieldsOf(filing),
        fetchSynced(filing.repo, filing.number, filing.kind),
      ),
    )
    .sort(byRepoThenNumber);

  const output = { checked: gmt.getUtcNow(), filings };
  writeFileSync(`${ROOT}${FILE}`, formatJson(output));

  console.log(`upstream: wrote ${filings.length} filing(s) to ${FILE}`);
  if (newlyFound.length > 0) {
    console.log(
      `upstream: NEW — fill in the hand-written fields for:\n` +
        newlyFound.map((k) => `  ${k}`).join("\n"),
    );
  }
}

/**
 * One filing for `refresh`: the committed hand-written fields over freshly synced ones. Marks a
 * filing `gh` found that the committed file doesn't have yet — real for a reader today, but not
 * something to hand-edit until the owner runs `pnpm upstream:sync` and gives it real hand-written
 * fields.
 */
async function refreshFiling(key, committedByKey, kindOf, timeout) {
  const [repo, numStr] = key.split("#");
  const number = Number(numStr);
  const committedFiling = committedByKey.get(key);
  const kind = kindOf.get(key) ?? committedFiling?.kind;
  const synced = await fetchSyncedAsync(repo, number, kind, timeout);
  const filing = buildFiling(
    { repo, number, kind },
    handWrittenFieldsOf(committedFiling),
    synced,
  );
  if (!committedFiling) filing.new = true;
  return filing;
}

/**
 * Best-effort refresh for `apps/dox`'s `generate` script — see the header comment for why this
 * is a separate command from `sync`. Everything here is wrapped in one try/catch: the first `gh`
 * problem of any kind (missing binary, no auth, rate limit, a slow/offline network past
 * `REFRESH_BUDGET_MS`) aborts the whole run with one warning line and writes nothing, leaving
 * whatever live file (or none) already existed. That is deliberately coarser than `sync`'s
 * per-field care — a partial write here would need the same validation `check` already gives the
 * committed file, for a cache nothing depends on being complete.
 */
/**
 * The live file is fresh enough to reuse: under the TTL, and no CI run or forced refresh.
 *
 * `mtimeMs` is filesystem metadata in epoch milliseconds, and this asks how long ago that was —
 * elapsed time, not a date anyone reads. GMT is string-in, string-out for date values and is the
 * wrong tool for a cache window, so this stays plain arithmetic.
 */
function liveFileIsFresh(livePath) {
  if (process.env.CI || process.env.UPSTREAM_REFRESH === "force") return false;
  return (
    existsSync(livePath) &&
    // oxlint-disable-next-line @northguild/gmt-oxlint/no-date-now -- see above: elapsed time, not a date
    Date.now() - statSync(livePath).mtimeMs < REFRESH_TTL_MS // date-ban: elapsed time against a file's epoch-ms mtime, not a date value
  );
}

/**
 * The refresh's stopwatch: how long any one call may take, and a way to race the whole run.
 *
 * `performance.now()`, not `Date.now()`: this is elapsed time, and a monotonic clock cannot be
 * moved by an NTP correction part-way through. GMT handles date *values*; it is deliberately not
 * a timer.
 */
function startRefreshBudget() {
  const deadline = performance.now() + REFRESH_BUDGET_MS;
  const remaining = () => Math.max(deadline - performance.now(), 0);

  /** Per-call timeout: whatever is left of the run, capped so one call cannot eat the lot. */
  const timeLeft = () => Math.min(remaining(), REFRESH_CALL_TIMEOUT_MS);

  /**
   * Races `work` against the remaining total budget, so a hang past `REFRESH_BUDGET_MS` is caught
   * even if some individual call's own timeout did not fire (defense in depth — every call also
   * gets its own `timeLeft()`). Clears the timer once either side settles: an uncleared
   * `setTimeout` keeps the process alive until it fires whoever won, which otherwise made a
   * refresh that finished in under a second still take the full budget to exit.
   */
  const withBudget = (work) => {
    let timer;
    const expiry = new Promise((_, reject) => {
      timer = setTimeout(
        () => reject(new Error("refresh: time budget exceeded")),
        remaining(),
      );
    });
    return Promise.race([work, expiry]).finally(() => clearTimeout(timer));
  };

  return { timeLeft, withBudget };
}

/** Every filing the committed file knows plus everything discovery just found, newest state. */
async function fetchAllFilings(committedByKey, { timeLeft, withBudget }) {
  // One round trip per repo, concurrently — `gh`'s own network latency is what a sequential
  // loop was paying for 13 times over, not CPU work this process does itself.
  const discovered = (
    await withBudget(
      Promise.all(REPOS.map((repo) => discoverAsync(repo, timeLeft()))),
    )
  ).flat();

  const kindOf = new Map(discovered.map((d) => [keyOf(d), d.kind]));
  const keys = [...new Set([...committedByKey.keys(), ...kindOf.keys()])];

  const filings = await withBudget(
    Promise.all(
      keys.map((key) => refreshFiling(key, committedByKey, kindOf, timeLeft())),
    ),
  );
  return filings.sort(byRepoThenNumber);
}

async function refresh() {
  // `refresh` must never break dev or CI, so an unbuilt GMT is one warning and no write — the same
  // contract it already honours for a missing or unauthenticated `gh`.
  const gmt = await tryLoadGmt();
  if (gmt === null) {
    console.warn(
      "upstream: skipping refresh — packages/gmt is not built, so the committed snapshot stands",
    );
    return;
  }
  const livePath = `${ROOT}${LIVE_FILE}`;
  if (liveFileIsFresh(livePath)) {
    console.log(
      `upstream: ${LIVE_FILE} is under ${REFRESH_TTL_MS / 3_600_000} h old, skipping (UPSTREAM_REFRESH=force to refresh now)`,
    );
    return;
  }
  const budget = startRefreshBudget();
  const committedByKey = new Map(readFile().filings.map((f) => [keyOf(f), f]));

  try {
    const filings = await fetchAllFilings(committedByKey, budget);
    mkdirSync(dirname(livePath), { recursive: true });
    writeFileSync(livePath, formatJson({ checked: gmt.getUtcNow(), filings }));
    console.log(
      `upstream: refreshed ${filings.length} filing(s) into ${LIVE_FILE}`,
    );
  } catch (error) {
    console.warn(
      `upstream: refresh skipped (${error.message.split("\n")[0]}) — using ${FILE} until \`pnpm upstream:sync\` or the next successful refresh`,
    );
  }
}

// ---------------------------------------------------------------- check

const STALE_AFTER_DAYS = 30;
const REQUIRED_FIELDS = [
  "repo",
  "number",
  "kind",
  "work",
  "title",
  "url",
  "summary",
  "pairsWith",
  "closes",
  "dependsOn",
  "gmtGuard",
  "gmtNote",
  "state",
  "draft",
  "reviewDecision",
  "comments",
  "maintainerComments",
  "createdAt",
  "updatedAt",
  "closedAt",
  "mergedAt",
];
const DATE_FIELDS = ["createdAt", "updatedAt", "closedAt", "mergedAt"];
const WORK_VALUES = ["port", "fix", "report", "release"];
const STATE_VALUES = ["open", "closed"];
const REVIEW_DECISIONS = ["APPROVED", "CHANGES_REQUESTED", "REVIEW_REQUIRED"];

const isNullOrOneOf = (value, allowed) =>
  value === null || allowed.includes(value);

function checkFilingsPresent(data, report) {
  if (!Array.isArray(data.filings) || data.filings.length === 0) {
    report.problems.push(
      `${FILE}: no filings recorded — run \`pnpm upstream:sync\``,
    );
  }
}

/**
 * How old the `checked` stamp is, through GMT rather than `Date.parse`.
 *
 * `diffUtc` returns `null` for anything it cannot read, so an unparseable stamp is one branch
 * rather than a `NaN` that compares false against everything.
 */
const unreadableStamp = (checked, gmt) =>
  typeof checked !== "string" || !gmt.isValidUtc(checked);

/** `null` when the stamp is unreadable, so callers get one branch instead of a `NaN`. */
const stampAgeDays = (checked, gmt) =>
  gmt.diffUtc(checked, gmt.getUtcNow(), "days");

function reportStampAge(checked, ageDays, report) {
  if (ageDays < 0) {
    report.problems.push(`${FILE}: "checked" (${checked}) is in the future`);
    return;
  }
  if (ageDays > STALE_AFTER_DAYS) {
    report.warnings.push(
      `${FILE}: "checked" (${checked}) is over ${STALE_AFTER_DAYS} days old — run \`pnpm upstream:sync\``,
    );
  }
}

function checkStamp(checked, report, gmt) {
  const ageDays = unreadableStamp(checked, gmt)
    ? null
    : stampAgeDays(checked, gmt);
  if (ageDays === null) {
    report.problems.push(`${FILE}: "checked" is missing or not a valid date`);
    return;
  }
  reportStampAge(checked, ageDays, report);
}

const labelOf = (f) => `${FILE}: ${f.repo ?? "?"}#${f.number ?? "?"}`;

function checkRequiredFields(f, label, report) {
  for (const field of REQUIRED_FIELDS) {
    if (!Object.hasOwn(f, field))
      report.problems.push(`${label} — missing field "${field}"`);
  }
}

function checkDuplicate(f, label, seen, report) {
  const key = keyOf(f);
  if (seen.has(key)) report.problems.push(`${label} — duplicate entry`);
  seen.add(key);
}

function checkKindAndUrl(f, label, report) {
  if (!["pr", "issue"].includes(f.kind)) {
    report.problems.push(`${label} — kind "${f.kind}" is not "pr" or "issue"`);
    return;
  }
  const expectedUrl = filingUrl(f.repo, f.kind, f.number);
  if (f.url !== expectedUrl) {
    report.problems.push(
      `${label} — url "${f.url}" does not match repo/kind/number (expected ${expectedUrl})`,
    );
  }
}

function checkEnums(f, label, report) {
  if (!isNullOrOneOf(f.work, WORK_VALUES)) {
    report.problems.push(
      `${label} — work "${f.work}" is not port/fix/report/release/null`,
    );
  }
  if (!STATE_VALUES.includes(f.state)) {
    report.problems.push(`${label} — state "${f.state}" is not open/closed`);
  }
  if (!isNullOrOneOf(f.reviewDecision, REVIEW_DECISIONS)) {
    report.problems.push(
      `${label} — reviewDecision "${f.reviewDecision}" is not a known GitHub value or null`,
    );
  }
}

/**
 * Every filing is either covered by a GMT workaround (gmtGuard) or explained as not affecting
 * GMT (gmtNote). A row with neither would be a known gap the page shows as open.
 */
function checkGuard(f, label, guards, report) {
  if ((f.gmtGuard === null) === (f.gmtNote === null)) {
    report.problems.push(
      `${label} — needs exactly one of gmtGuard (the GMT workaround that covers it) or gmtNote (why it does not affect GMT)`,
    );
  }
  if (f.gmtGuard !== null && !guards.has(f.gmtGuard)) {
    report.problems.push(
      `${label} — gmtGuard "${f.gmtGuard}" is not a group in ${REPROS}`,
    );
  }
}

/**
 * A filing we only contributed to must link the contribution.
 *
 * Discovery searches by author, so a row someone else opened is here by hand; without the comment
 * link the page would show a maintainer's PR with nothing saying what we did on it.
 */
/**
 * A filing that closed without merging needs an `outcome`.
 *
 * The page shows GitHub's own state, and "Closed" on its own reads as "rejected" — which is the
 * opposite of what every closure of ours has said so far.
 */
/** Closed with nothing merged — the state that reads as a rejection unless a row explains it. */
const closedUnmerged = (f) => f.state === "closed" && !f.mergedAt;

/**
 * Each rule is a named predicate and the problem it reports.
 *
 * Written this way rather than as a run of `if`s so that every rule is one testable question with
 * a name, and adding one is adding a row. `applies` is deliberately separate from `message`: the
 * message reads the same field the predicate judged, and keeping them adjacent stops the two
 * drifting apart.
 */
const OUTCOME_RULES = [
  {
    applies: (f) => closedUnmerged(f) && !f.outcome,
    message: (_f, label) =>
      `${label} — closed without merging, so it needs an outcome saying why (a bare "Closed" reads as a rejection)`,
  },
  {
    applies: (f) => !closedUnmerged(f) && Boolean(f.outcome),
    message: (_f, label) =>
      `${label} — outcome is only for a filing that closed without merging`,
  },
];

const ROLE_RULES = [
  {
    applies: (f) =>
      f.role !== undefined && f.role !== "author" && f.role !== "contributor",
    message: (f, label) =>
      `${label} — role "${f.role}" is not "author" or "contributor"`,
  },
  {
    applies: (f) => f.role === "contributor" && !f.contributionUrl,
    message: (_f, label) =>
      `${label} — a contributor filing needs contributionUrl (the link to our own comment)`,
  },
  {
    applies: (f) => f.role !== "contributor" && Boolean(f.contributionUrl),
    message: (_f, label) =>
      `${label} — contributionUrl is only for a filing we did not open (role "contributor")`,
  },
];

/** Runs a rule table, reporting the message of every rule that applies. */
function applyRules(rules, f, label, report) {
  for (const rule of rules) {
    if (rule.applies(f)) report.problems.push(rule.message(f, label));
  }
}

function checkOutcome(f, label, report) {
  applyRules(OUTCOME_RULES, f, label, report);
}

function checkRole(f, label, report) {
  applyRules(ROLE_RULES, f, label, report);
}

function checkDates(f, label, report, gmt) {
  for (const field of DATE_FIELDS) {
    const value = f[field];
    // These are plain calendar days (`dateOnly` trims the time off on the way in), so the check is
    // GMT's date validator rather than `Date.parse`, which also accepts things like "2026" and
    // whatever the host decides "03/04/2026" means.
    if (value !== null && !gmt.isValidDate(value)) {
      report.problems.push(
        `${label} — ${field} "${value}" is not a valid date`,
      );
    }
  }
}

function checkFiling(f, { guards, seen, report, gmt }) {
  const label = labelOf(f);
  checkRequiredFields(f, label, report);
  checkDuplicate(f, label, seen, report);
  checkKindAndUrl(f, label, report);
  checkEnums(f, label, report);
  checkGuard(f, label, guards, report);
  checkRole(f, label, report);
  checkOutcome(f, label, report);
  checkDates(f, label, report, gmt);
  if (f.summary === "") report.warnings.push(`${label} — empty summary`);
}

function reportCheck({ problems, warnings }, data) {
  for (const w of warnings) console.warn(`upstream: warning: ${w}`);

  if (problems.length > 0) {
    console.error(
      "upstream: problems found:\n" + problems.map((p) => `  ${p}`).join("\n"),
    );
    process.exit(1);
  }
  console.log(`upstream: ${data.filings.length} filing(s) OK`);
}

async function check() {
  const gmt = await loadGmt();
  const report = { problems: [], warnings: [] };
  const data = readFile();
  checkFilingsPresent(data, report);
  checkStamp(data.checked, report, gmt);
  const context = { guards: knownGuards(), seen: new Set(), report, gmt };
  for (const f of data.filings ?? []) checkFiling(f, context);
  reportCheck(report, data);
}

const argv = process.argv.slice(2).filter((a) => a !== "--");
const command = argv[0] ?? "check";
const commands = { check, sync, refresh };
if (!commands[command]) {
  console.error("Usage: node scripts/upstream.mjs <check|sync|refresh>");
  process.exit(1);
}
await commands[command]();
