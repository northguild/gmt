/**
 * What `scripts/upstream.mjs` needs to know about each tracker a filing can live on: how to name
 * an entry, where its page is, what to ask the tracker for, and how to read the answer.
 *
 * Kept apart from the command file so the readers are pure (a string in, the synced fields out)
 * and a test can feed them a recorded response without a network. Nothing here fetches.
 *
 * Four trackers, each with its own identity fields (no entry carries a member that belongs to
 * another tracker):
 *
 *   github    `repo`, `number`, `kind`   read with `gh`
 *   jira      `key`                       the Unicode Jira, read from its REST API
 *   chromium  `id`                        issues.chromium.org, read from the page's own JSON
 *   bugzilla  `host`, `id`                bugzilla.mozilla.org or bugs.webkit.org, REST API
 *
 * The Chromium endpoint is not a public API, so its reader checks the shape of what it gets and
 * throws on anything it does not recognise; the caller keeps the last known state and warns.
 */

export const TRACKERS = ["github", "jira", "chromium", "bugzilla"];

export const JIRA_HOST = "unicode-org.atlassian.net";
/** The Jira projects GMT files in: ICU (ICU4C/ICU4J) and CLDR. */
export const JIRA_PROJECTS = ["ICU", "CLDR"];
/** Our Jira account ids. Discovery searches each as a reporter, and a comment by one of them is
 * ours, never a maintainer response. */
export const JIRA_ACCOUNTS = ["712020:edbd7a30-b6e5-42d7-b938-06b19b5d87a9"];
export const CHROMIUM_HOST = "issues.chromium.org";
/** The Bugzilla servers we file on. */
export const BUGZILLA_HOSTS = ["bugzilla.mozilla.org", "bugs.webkit.org"];

/** Jira words a status in the language of the caller's address unless it is asked for English. */
export const JIRA_HEADERS = { "Accept-Language": "en" };

/** The fields every filing has whatever its tracker, before the tracker's own. */
export const COMMON_FIELDS = [
  "tracker",
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
];

/** The identity fields of each tracker. */
export const IDENTITY_FIELDS = {
  github: ["repo", "number", "kind"],
  jira: ["key"],
  chromium: ["id"],
  bugzilla: ["host", "id"],
};

/** What a tracker reports, in the order the committed file lists it (after `state`). */
export const SYNCED_FIELDS = {
  github: [
    "draft",
    "reviewDecision",
    "comments",
    "maintainerComments",
    "createdAt",
    "updatedAt",
    "closedAt",
    "mergedAt",
  ],
  jira: [
    "status",
    "resolution",
    "fixVersions",
    "comments",
    "maintainerComments",
    "createdAt",
    "updatedAt",
    "closedAt",
  ],
  chromium: [
    "comments",
    "maintainerComments",
    "createdAt",
    "updatedAt",
    "closedAt",
  ],
  bugzilla: [
    "status",
    "resolution",
    "comments",
    "maintainerComments",
    "createdAt",
    "updatedAt",
    "closedAt",
  ],
};

/** The date-valued fields of a filing. */
export const DATE_FIELDS = ["createdAt", "updatedAt", "closedAt", "mergedAt"];

/** `owner/repo#n`, `ICU-23619`, `chromium#n`, `host#n`: an entry's identity as one string. */
export function keyOf(ref) {
  switch (ref.tracker) {
    case "github":
      return `${ref.repo}#${ref.number}`;
    case "jira":
      return ref.key;
    case "chromium":
      return `chromium#${ref.id}`;
    case "bugzilla":
      return `${ref.host}#${ref.id}`;
    default:
      return `?#${ref.tracker}`;
  }
}

/** The identity members of `entry`, in schema order. */
export function identityOf(entry) {
  return Object.fromEntries(
    (IDENTITY_FIELDS[entry.tracker] ?? []).map((k) => [k, entry[k]]),
  );
}

/** An entry's canonical page. */
export function urlOf(ref) {
  switch (ref.tracker) {
    case "github":
      return `https://github.com/${ref.repo}/${ref.kind === "pr" ? "pull" : "issues"}/${ref.number}`;
    case "jira":
      return `https://${JIRA_HOST}/browse/${ref.key}`;
    case "chromium":
      return `https://${CHROMIUM_HOST}/issues/${ref.id}`;
    case "bugzilla":
      return `https://${ref.host}/show_bug.cgi?id=${ref.id}`;
    default:
      return "";
  }
}

/** True for `ICU-23619`-shaped keys of a project we file in. */
export const isJiraKey = (key) =>
  typeof key === "string" &&
  new RegExp(`^(?:${JIRA_PROJECTS.join("|")})-[1-9]\\d*$`).test(key);

// ---------------------------------------------------------------- dates

/**
 * Day converters over a loaded GMT: the calendar day, in UTC, of a tracker's timestamp. Trackers
 * write timestamps in the reporter's offset, so slicing the first ten characters would give the
 * wrong day for a filing made late in the evening in California.
 */
export function makeDays(gmt) {
  /** An ISO timestamp with `Z` or an offset, with or without a colon (`-0800`, Jira's form). */
  const fromIso = (iso) => {
    if (typeof iso !== "string" || iso === "") return null;
    const normalised = iso.replace(/([+-]\d\d)(\d\d)$/, "$1:$2");
    // A `Z` time is already UTC. Any other offset is read as a zoned time in that fixed offset
    // and converted, because `parseDateFromUtc` takes UTC only.
    const offset = /([+-]\d\d:\d\d)$/.exec(normalised)?.[1];
    const utc = offset
      ? gmt.convertZonedToUtc(`${normalised}[${offset}]`)
      : normalised;
    return (utc && gmt.parseDateFromUtc(utc)) || null;
  };
  /** Seconds since the epoch, as Chromium writes them. */
  const fromEpochSeconds = (seconds) =>
    typeof seconds === "number" && Number.isFinite(seconds)
      ? gmt.parseDateFromUtc(gmt.convertUnixToUtc(seconds * 1000)) || null
      : null;
  return { fromIso, fromEpochSeconds };
}

// ---------------------------------------------------------------- Jira

/** The search that finds every issue we reported in the projects we file in. */
export function jiraDiscoveryUrl() {
  const accounts = JIRA_ACCOUNTS.map((a) => `"${a}"`).join(", ");
  const jql = `reporter in (${accounts}) AND project in (${JIRA_PROJECTS.join(", ")}) ORDER BY key ASC`;
  return `https://${JIRA_HOST}/rest/api/3/search/jql?jql=${encodeURIComponent(jql)}&fields=summary&maxResults=100`;
}

/** The keys a discovery response lists, and whether the list is complete. */
export function parseJiraDiscovery(raw) {
  const data = JSON.parse(raw);
  if (!Array.isArray(data.issues)) {
    throw new Error("Jira search: no issues array in the response");
  }
  const keys = data.issues.map((i) => i.key).filter(isJiraKey);
  return { keys, complete: data.isLast !== false };
}

/** One issue, through the v2 API (which returns comment bodies as plain text). */
export function jiraIssueUrl(key) {
  const fields =
    "summary,status,resolution,fixVersions,created,updated,resolutiondate,comment";
  return `https://${JIRA_HOST}/rest/api/2/issue/${key}?fields=${fields}`;
}

/** The synced fields of one Jira issue. */
export function parseJira(raw, key, days) {
  const data = JSON.parse(raw);
  const f = data.fields;
  if (data.key !== key || typeof f?.summary !== "string" || !f.status?.name) {
    throw new Error(`Jira ${key}: unexpected response shape`);
  }
  const comments = f.comment?.comments ?? [];
  const resolution = f.resolution?.name ?? null;
  const closed = resolution !== null || f.status.statusCategory?.key === "done";
  return {
    // A summary pasted into Jira can keep a trailing newline; the title is one line of text.
    title: f.summary.trim(),
    url: urlOf({ tracker: "jira", key }),
    state: closed ? "closed" : "open",
    status: f.status.name,
    resolution,
    fixVersions: (f.fixVersions ?? []).map((v) => v.name),
    comments: f.comment?.total ?? comments.length,
    maintainerComments: comments.filter(
      (c) => !JIRA_ACCOUNTS.includes(c.author?.accountId),
    ).length,
    createdAt: days.fromIso(f.created),
    updatedAt: days.fromIso(f.updated),
    closedAt: closed ? days.fromIso(f.resolutiondate) : null,
  };
}

// ---------------------------------------------------------------- Chromium

export const chromiumIssueUrl = (id) =>
  `https://${CHROMIUM_HOST}/action/issues/${id}`;

/** Chromium's tracker answers a request with no browser-like agent with a bot wall. */
export const CHROMIUM_HEADERS = { "User-Agent": "Mozilla/5.0" };

/**
 * The synced fields of one Chromium issue, from the tracker's own page JSON: `)]}'` and a
 * positional array. There is no documentation, so each position used here was read off live
 * issues, and every one is checked before use. Anything else throws.
 *
 *   response[0][1][21]  the issue: [null, id, core, null, created, modified, resolved, …]
 *   issue[2][5]         the title
 *   issue[4], issue[5]  created and last modified, `[seconds, nanoseconds]`
 *   issue[6]            resolved, `[seconds]`, present only once the issue is closed
 *
 * The comment counts are `null`: the endpoint does not list comments. A comment list needs a
 * signed-in call, and a count read from an unexplained position would be a guess.
 */
export function parseChromium(raw, id, days) {
  const text = raw.replace(/^\)\]\}'\s*/, "");
  const data = JSON.parse(text);
  const issue = data?.[0]?.[1]?.find?.(
    (x) => Array.isArray(x) && x[1] === id && Array.isArray(x[2]),
  );
  const title = issue?.[2]?.[5];
  const seconds = (x) => (Array.isArray(x) ? x[0] : null);
  if (
    data?.[0]?.[0] !== "b.IssueFetchResponse" ||
    typeof title !== "string" ||
    typeof seconds(issue[4]) !== "number" ||
    typeof seconds(issue[5]) !== "number"
  ) {
    throw new Error(`Chromium ${id}: unexpected response shape`);
  }
  const resolved = seconds(issue[6]);
  const closed = typeof resolved === "number";
  return {
    title,
    url: urlOf({ tracker: "chromium", id }),
    state: closed ? "closed" : "open",
    comments: null,
    maintainerComments: null,
    createdAt: days.fromEpochSeconds(seconds(issue[4])),
    updatedAt: days.fromEpochSeconds(seconds(issue[5])),
    closedAt: closed ? days.fromEpochSeconds(resolved) : null,
  };
}

// ---------------------------------------------------------------- Bugzilla

const BUG_FIELDS =
  "id,summary,status,resolution,is_open,creator,creation_time,last_change_time,cf_last_resolved";

export const bugzillaBugUrl = (host, id) =>
  `https://${host}/rest/bug/${id}?include_fields=${BUG_FIELDS}`;
export const bugzillaCommentsUrl = (host, id) =>
  `https://${host}/rest/bug/${id}/comment`;
export const bugzillaHistoryUrl = (host, id) =>
  `https://${host}/rest/bug/${id}/history`;

const CLOSED_STATUSES = new Set(["RESOLVED", "VERIFIED", "CLOSED"]);

/** When a bug last moved to a closed status, from its history response; `null` if never. */
function lastClosedAt(historyRaw) {
  const history = JSON.parse(historyRaw).bugs?.[0]?.history ?? [];
  let when = null;
  for (const entry of history) {
    const closes = entry.changes?.some(
      (c) => c.field_name === "status" && CLOSED_STATUSES.has(c.added),
    );
    if (closes) when = entry.when;
  }
  return when;
}

/**
 * The synced fields of one Bugzilla bug, from its bug and comment responses.
 *
 * Bugzilla files the description as comment 0, so it is not a reply. A maintainer's reply is a
 * comment by anyone but us: the reporter on a bug we filed, or whoever wrote `ourComment` (the
 * comment number in a contributor row's `contributionUrl`) on a bug someone else filed.
 *
 * bugs.webkit.org does not send `cf_last_resolved`, and its `last_change_time` moves with every
 * comment, so the closing day comes from `history` (the bug's history response) when given.
 *
 * @param {string} bugRaw
 * @param {string} commentsRaw
 * @param {string} host
 * @param {number} id
 * @param {{ fromIso: (iso: string) => string }} days
 * @param {{ history?: string | null, ourComment?: number | null }} [options]
 */
export function parseBugzilla(
  bugRaw,
  commentsRaw,
  host,
  id,
  days,
  { history = null, ourComment = null } = {},
) {
  const bug = JSON.parse(bugRaw).bugs?.[0];
  const list = JSON.parse(commentsRaw).bugs?.[String(id)]?.comments;
  if (
    bug?.id !== id ||
    typeof bug.summary !== "string" ||
    !Array.isArray(list)
  ) {
    throw new Error(`Bugzilla ${host}#${id}: unexpected response shape`);
  }
  const replies = list.filter((c) => c.count > 0);
  const us =
    ourComment === null
      ? bug.creator
      : (list.find((c) => c.count === ourComment)?.creator ?? bug.creator);
  const closed = bug.is_open === false;
  const closedAt =
    bug.cf_last_resolved ??
    (history === null ? null : lastClosedAt(history)) ??
    bug.last_change_time;
  return {
    title: bug.summary,
    url: urlOf({ tracker: "bugzilla", host, id }),
    state: closed ? "closed" : "open",
    status: bug.status,
    resolution: bug.resolution || null,
    comments: replies.length,
    maintainerComments: replies.filter((c) => c.creator !== us).length,
    createdAt: days.fromIso(bug.creation_time),
    updatedAt: days.fromIso(bug.last_change_time),
    closedAt: closed ? days.fromIso(closedAt) : null,
  };
}
