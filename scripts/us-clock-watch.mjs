#!/usr/bin/env node
/**
 * US clock-change freshness canary (CORE-90, #341).
 *
 *   node scripts/us-clock-watch.mjs check [--carry=<file>]
 *     Compares three sources with the committed snapshot, `scripts/us-clock-watch.snapshot.json`:
 *       federal  the Congress.gov API: bills whose title names the subject, and their latest action;
 *                a GovInfo title search finds the bills whose official or short title names it
 *       state    the Open States v3 API: state bills that match the subject terms, latest action
 *       tz       the IANA tz database: the rules of every zone in `apps/dox/src/lib/us-region-zones.json`
 *     Exit 0 when nothing differs, 1 when something does, 2 when any source could not run (a
 *     network or HTTP error, a 429, a body that does not parse, a spent request budget, or a
 *     missing secret). The other sources still report. The verdict file
 *     (`artifacts/us-clock-watch.json`) is written before the exit; `scripts/canary-report.mjs`
 *     files the issues from it.
 *     With `--carry`, the federal and state parts in `<file>` replace the committed ones where they
 *     are newer, and the check writes the parts it brought up to date back to `<file>`: the
 *     workflow keeps that file from one run to the next, so each change is reported once and no
 *     one runs `refresh`. A source that could not run, or got no `Date` header, carries its part
 *     forward unchanged. The tz part is always the committed one.
 *
 *   node scripts/us-clock-watch.mjs refresh
 *     Fetches the federal and state sources in full and writes them to the snapshot. The weekly
 *     check needs no refresh; one only resets the committed starting point. It lists the
 *     whole current congress (about 80 pages) and every state bill on the subject (about 100 pages,
 *     at most 10 a minute, so 15 minutes or more). The tz part is left as `snapshot-tz` wrote it.
 *
 *   node scripts/us-clock-watch.mjs snapshot-tz --dir=<folder>
 *     Rewrites only the snapshot's `tz` part from a folder holding `northamerica`, `australasia`,
 *     `backward` and `version` (an unpacked tzdata release). It needs no network or key. Run it on
 *     the release `apps/dox/src/lib/us-region-zones.json` names, so `check` flags a US rule change
 *     the zone map has not taken in yet.
 *
 * Secrets, read from the environment and sent only in a request header, never in a URL, a log line
 * or the verdict file: `CONGRESS_GOV_API_KEY` (an api.data.gov key, header `X-Api-Key`, sent to
 * Congress.gov and GovInfo) and
 * `OPEN_STATES_API_KEY` (header `X-API-KEY`). A missing one makes that source "could not run".
 *
 * The script holds subject keywords only, no bill, title, statute or body. A bill's number and
 * title appear in the snapshot and in issue bodies as data the APIs returned.
 *
 * `checkedAt` is read from a response `Date` header: the script reads no clock of its own.
 *
 * Node built-ins and `fetch` only: no install, no build. Never wired into `validate` or `ci.yml`.
 * Retirement (context/domination/issues/CORE-90.md, Decisions): the tz part when the US clock-change
 * checker (CORE-90 phase 2) ships; the federal and state parts when the Proposals view's data is
 * removed or replaced.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { formatJson } from "./lib/format-json.mjs";
import { couldNotRunVerdict, saveVerdict } from "./lib/canary-verdict.mjs";

// fileURLToPath, not `.pathname`: see scripts/test-markers.mjs.
const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SNAPSHOT = "scripts/us-clock-watch.snapshot.json";
const ZONES = "apps/dox/src/lib/us-region-zones.json";
const PREFIX = "us-clock-watch";

/** What the subject is, in words. Lower case, no proper noun: never a bill's or a law's name. */
export const SUBJECT_TERMS = [
  "daylight saving time",
  "standard time",
  "time zone",
];
/**
 * Congress.gov has no keyword search, so a bill's list title is matched on these (case-insensitive).
 * GovInfo's title search takes them too; it stems each word, so it needs no spelling variant.
 */
export const TITLE_TERMS = [
  ...SUBJECT_TERMS,
  "daylight savings time",
  "daylight time",
];

const CONGRESS_BASE = "https://api.congress.gov/v3";
const GOVINFO_BASE = "https://api.govinfo.gov";
const OPEN_STATES_BASE = "https://v3.openstates.org";
const TZ_BASE = "https://data.iana.org/time-zones/tzdb";
/** `backward` holds the `Link` lines of St_Thomas, Midway, Saipan and Wake. */
const TZ_FILES = ["northamerica", "australasia", "backward"];
const CONGRESS_KEY = "CONGRESS_GOV_API_KEY";
const OPEN_STATES_KEY = "OPEN_STATES_API_KEY";

const FETCH_TIMEOUT_MS = 30_000;
const FEDERAL_PAGE = 250;
const GOVINFO_PAGE = 100;
const STATE_PAGE = 20;
/** The default limits (tests pass smaller ones). */
export const LIMITS = {
  federalRequests: 400,
  /** A congress has a few dozen bill versions on the subject: one page of 100, or two. */
  govinfoRequests: 10,
  stateRequests: 60,
  /**
   * `refresh` lists every state bill: about 100 pages of 20 across the three terms. Open States
   * allows 250 requests a day per key, so a refresh and a check fit in one day.
   */
  stateRefreshRequests: 190,
  /** Stop when `X-RateLimit-Remaining` falls below this. */
  rateFloor: 100,
  /** Open States allows 10 requests a minute per key (its 429 body says so); 7 s keeps under it. */
  statePauseMs: 7000,
  /** An Open States search can take most of a minute; other hosts get `FETCH_TIMEOUT_MS`. */
  stateTimeoutMs: 120_000,
  /** One `check` stops here, inside the workflow job's `timeout-minutes`, so its issue is filed. */
  checkDeadlineMs: 45 * 60_000,
  /** A 502, 503, 504 or timed-out request is sent again this many times; never a 429. */
  retries: 2,
  /** The wait before such a request is sent again, on top of the source's own pause. */
  retryPauseMs: 10_000,
  tzRequests: 8,
};

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** A source failure with a message safe to print. */
class SourceError extends Error {}

/** A failure that may pass if the request is sent again: a gateway error or a timeout. */
class TransientError extends SourceError {}

/** RFC 9110 §15.6: the gateway and availability errors, worth sending again. */
const TRANSIENT_STATUS = new Set([502, 503, 504]);

const DEADLINE_MESSAGE = "the check's time limit ran out";

/** Throws once `deadline` (an `AbortSignal`, or undefined for no limit) has fired. */
function beforeDeadline(deadline) {
  if (deadline?.aborted) throw new SourceError(DEADLINE_MESSAGE);
}

/** One request's own timeout, cut short by `deadline` when there is one. */
const requestSignal = (timeoutMs, deadline) =>
  deadline
    ? AbortSignal.any([AbortSignal.timeout(timeoutMs), deadline])
    : AbortSignal.timeout(timeoutMs);

// ---------------------------------------------------------------- requests

/** `Fri, 13 Nov 2026 12:26:01 GMT` (RFC 9110 §5.6.7) as `2026-11-13T12:26:01Z`, or null. */
export function isoOfHttpDate(text) {
  const m =
    /^[A-Za-z]{3}, (\d{2}) ([A-Za-z]{3}) (\d{4}) (\d{2}:\d{2}:\d{2}) GMT$/.exec(
      (text ?? "").trim(),
    );
  const month = m ? MONTHS.indexOf(m[2]) + 1 : 0;
  if (!m || month === 0) return null;
  return `${m[3]}-${String(month).padStart(2, "0")}-${m[1]}T${m[4]}Z`;
}

/**
 * A sequential JSON getter with a request budget. A header carries the key; the URL never does.
 * `get(path, params)` returns `{ body, date }`, `date` being the response `Date` header as ISO or
 * null. `get(path, params, json)` sends `json` as a POST body: a search, so safe to send again.
 * Every thrown message names the host and path only, never the query. `deadline`, an
 * `AbortSignal`, ends the whole run; `timeoutMs` bounds each request. A transient failure is sent
 * again up to `retries` times, `retryPauseMs` apart; each send counts against `budget`.
 */
function requester({
  fetch,
  base,
  headers,
  budget,
  rateFloor = 0,
  pauseMs = 0,
  sleep,
  timeoutMs = FETCH_TIMEOUT_MS,
  deadline,
  retries = 0,
  retryPauseMs = 0,
}) {
  let sent = 0;
  return async function get(path, params = {}, json = undefined) {
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await send(path, params, json);
      } catch (error) {
        if (!(error instanceof TransientError) || attempt >= retries) {
          throw error;
        }
        await sleep(retryPauseMs);
      }
    }
  };

  async function send(path, params, json) {
    beforeDeadline(deadline);
    if (sent >= budget) {
      throw new SourceError(`request budget of ${budget} is spent`);
    }
    if (sent > 0 && pauseMs > 0) await sleep(pauseMs);
    beforeDeadline(deadline);
    sent += 1;
    const url = new URL(`${base}${path}`);
    for (const [name, value] of Object.entries(params)) {
      url.searchParams.set(name, String(value));
    }
    const where = `${url.host}${url.pathname}`;
    let response;
    try {
      response = await fetch(url, {
        ...(json === undefined
          ? { headers }
          : {
              method: "POST",
              headers: { ...headers, "Content-Type": "application/json" },
              body: JSON.stringify(json),
            }),
        signal: requestSignal(timeoutMs, deadline),
      });
    } catch (error) {
      beforeDeadline(deadline);
      throw new TransientError(`network error from ${where}: ${error.message}`);
    }
    if (response.status === 429) {
      throw new SourceError(`HTTP 429 from ${where} (rate limited; no retry)`);
    }
    if (!response.ok) {
      const Failure = TRANSIENT_STATUS.has(response.status)
        ? TransientError
        : SourceError;
      throw new Failure(`HTTP ${response.status} from ${where}`);
    }
    const remaining = Number(response.headers.get("x-ratelimit-remaining"));
    if (
      response.headers.get("x-ratelimit-remaining") !== null &&
      remaining < rateFloor
    ) {
      throw new SourceError(
        `${where}: X-RateLimit-Remaining is ${remaining}, under ${rateFloor}`,
      );
    }
    let body;
    try {
      body = JSON.parse(await response.text());
    } catch {
      throw new SourceError(`body from ${where} is not JSON`);
    }
    if (body === null || typeof body !== "object") {
      throw new SourceError(`body from ${where} is not a JSON object`);
    }
    return { body, date: isoOfHttpDate(response.headers.get("date")) };
  }
}

/** Text of `fetch` for a plain file (no key, no budget beyond the caller's loop). */
async function fetchText(fetch, url, deadline) {
  beforeDeadline(deadline);
  let response;
  try {
    response = await fetch(url, {
      signal: requestSignal(FETCH_TIMEOUT_MS, deadline),
    });
  } catch (error) {
    beforeDeadline(deadline);
    throw new SourceError(`network error from ${url}: ${error.message}`);
  }
  if (!response.ok)
    throw new SourceError(`HTTP ${response.status} from ${url}`);
  return await response.text();
}

/** The date part of a snapshot `checkedAt`. */
const dateOf = (checkedAt) => String(checkedAt).slice(0, 10);

// ---------------------------------------------------------------- federal

/** @param {string} title */
export const titleMatches = (title) => {
  const lower = String(title ?? "").toLowerCase();
  return TITLE_TERMS.some((term) => lower.includes(term));
};

const billKey = (b) => `${b.type} ${b.number}`;
const sameAction = (a, b) =>
  a?.actionDate === b?.actionDate && a?.text === b?.text;
const describeAction = (a) =>
  a?.actionDate || a?.text ? `${a.actionDate ?? "?"}: ${a.text ?? ""}` : "none";

/** The current congress number from `GET /congress/current`. */
async function currentCongress(get) {
  const { body, date } = await get("/congress/current", { format: "json" });
  const item = Array.isArray(body.congress) ? body.congress[0] : body.congress;
  const number =
    Number(item?.number) || Number(/^(\d+)/.exec(item?.name ?? "")?.[1]);
  if (!Number.isInteger(number) || number <= 0) {
    throw new SourceError("GET /congress/current: no congress number in body");
  }
  return { number, date };
}

/** One Congress.gov bill, from a list page or `GET /bill/{congress}/{type}/{number}`, as a row. */
const billRow = (b) => ({
  type: String(b.type),
  number: String(b.number),
  title: String(b.title),
  latestAction: {
    actionDate: b.latestAction?.actionDate ?? "",
    text: b.latestAction?.text ?? "",
  },
});

/**
 * The `type number` keys of the bills in `congress` whose GovInfo title names the subject. GovInfo
 * searches a bill's official and short titles, where a Congress.gov list shows only one of them.
 */
async function searchTitles(post, congress) {
  const terms = TITLE_TERMS.map((term) => `"${term}"`).join(" OR ");
  const query = `collection:BILLS AND congress:${congress} AND title:(${terms})`;
  const keys = new Set();
  for (let offsetMark = "*"; ;) {
    const { body } = await post(
      "/search",
      {},
      { query, pageSize: GOVINFO_PAGE, offsetMark },
    );
    const results = Array.isArray(body.results) ? body.results : [];
    for (const r of results) {
      // A package per printed version: BILLS-119hr139ih, BILLS-119hres1423rh.
      const id = /^BILLS-(\d+)([a-z]+?)(\d+)[a-z]+$/.exec(String(r.packageId));
      if (id && Number(id[1]) === congress) {
        keys.add(`${id[2].toUpperCase()} ${id[3]}`);
      }
    }
    if (results.length < GOVINFO_PAGE || !body.offsetMark) break;
    if (body.offsetMark === offsetMark) break;
    offsetMark = body.offsetMark;
  }
  return keys;
}

/** One bill by its `type number` key, for a GovInfo match the list did not return. */
async function fetchBill(get, congress, key) {
  const [type, number] = key.split(" ");
  const path = `/bill/${congress}/${type.toLowerCase()}/${number}`;
  const { body } = await get(path, { format: "json" });
  if (!body.bill || typeof body.bill !== "object") {
    throw new SourceError(`GET ${path}: no bill in body`);
  }
  return billRow(body.bill);
}

/**
 * Every bill on the list pages of `congress`, from `fromDateTime` when given, whose title matches
 * or whose key is in `tracked`.
 */
async function listBills(get, congress, fromDateTime, tracked) {
  const found = [];
  let date = null;
  for (let offset = 0; ; offset += FEDERAL_PAGE) {
    const params = { format: "json", limit: FEDERAL_PAGE, offset };
    if (fromDateTime) {
      params.fromDateTime = fromDateTime;
      params.sort = "updateDate desc";
    }
    const page = await get(`/bill/${congress}`, params);
    date ??= page.date;
    const bills = Array.isArray(page.body.bills) ? page.body.bills : [];
    for (const b of bills) {
      if (titleMatches(b.title) || tracked.has(billKey(b))) {
        found.push(billRow(b));
      }
    }
    if (bills.length < FEDERAL_PAGE || !page.body.pagination?.next) break;
  }
  return { bills: found, date };
}

const byKey = (a, b) =>
  billKey(a).localeCompare(billKey(b), "en", { numeric: true });

/**
 * The subject's bills in `congress`: those `kept` from the snapshot, by number, and those whose
 * title names it, on the list or on GovInfo. A list from `fromDateTime` holds only the bills
 * updated since, so a kept bill missing from it has not changed.
 */
async function findBills(get, post, congress, kept, fromDateTime) {
  const titled = await searchTitles(post, congress);
  const tracked = new Set([...kept.map(billKey), ...titled]);
  const { bills, date } = await listBills(get, congress, fromDateTime, tracked);
  const seen = new Set([...kept, ...bills].map(billKey));
  for (const key of titled) {
    if (!seen.has(key)) bills.push(await fetchBill(get, congress, key));
  }
  return { bills, date };
}

/**
 * @returns {{ congress: number, date: string | null, bills: object[], differences: string[] }}
 *   `bills` is the snapshot's list brought up to date.
 */
export async function checkFederal(get, post, snapshot) {
  const { number, date: currentDate } = await currentCongress(get);
  const prior = snapshot.congress;
  const differences = [];
  let kept = snapshot.bills;
  let fromDateTime = `${dateOf(snapshot.checkedAt)}T00:00:00Z`;
  if (prior !== number) {
    differences.push(
      prior
        ? `a new session began: congress ${number} (the snapshot has ${prior})`
        : "the snapshot has no congress number, so the whole congress was listed",
    );
    kept = [];
    fromDateTime = undefined;
  }
  const { bills, date } = await findBills(
    get,
    post,
    number,
    kept,
    fromDateTime,
  );
  const known = new Map(kept.map((b) => [billKey(b), b]));
  for (const b of bills) {
    const before = known.get(billKey(b));
    if (!before) {
      differences.push(
        `new: ${billKey(b)}: ${b.title} (latest action ${describeAction(b.latestAction)})`,
      );
    } else if (!sameAction(before.latestAction, b.latestAction)) {
      differences.push(
        `changed: ${billKey(b)}: ${b.title} (latest action ${describeAction(before.latestAction)} became ${describeAction(b.latestAction)})`,
      );
    }
    known.set(billKey(b), b);
  }
  return {
    congress: number,
    date: date ?? currentDate,
    bills: [...known.values()].sort(byKey),
    differences,
  };
}

/** The whole current congress, for `refresh`. */
export async function refreshFederal(get, post) {
  const { number, date: currentDate } = await currentCongress(get);
  const { bills, date } = await findBills(get, post, number, [], undefined);
  return {
    congress: number,
    date: date ?? currentDate,
    bills: bills.sort(byKey),
  };
}

/** The Congress.gov getter and the GovInfo search poster, both on the api.data.gov key. */
function federalRequesters({ env, fetch, sleep, limits, deadline }) {
  const common = {
    fetch,
    headers: { "X-Api-Key": env[CONGRESS_KEY], Accept: "application/json" },
    rateFloor: limits.rateFloor,
    sleep,
    deadline,
    retries: limits.retries,
    retryPauseMs: limits.retryPauseMs,
  };
  return {
    get: requester({
      ...common,
      base: CONGRESS_BASE,
      budget: limits.federalRequests,
    }),
    post: requester({
      ...common,
      base: GOVINFO_BASE,
      budget: limits.govinfoRequests,
    }),
  };
}

// ---------------------------------------------------------------- state

const stateKey = (b) => `${b.jurisdiction} ${b.session} ${b.identifier}`;
const describeState = (date, description) => `${date || "?"}: ${description}`;

/** One Open States result as a snapshot row, or null when it is not a US state, DC or PR. */
function stateRow(b) {
  const j = b.jurisdiction;
  if (j?.classification !== "state") return null;
  if (!String(j.id ?? "").startsWith("ocd-jurisdiction/country:us/")) {
    return null;
  }
  return {
    jurisdiction: String(j.name),
    session: String(b.session),
    identifier: String(b.identifier),
    title: String(b.title),
    latestActionDate: b.latest_action_date ?? "",
    latestActionDescription: b.latest_action_description ?? "",
  };
}

/** Every result of every subject term since `actionSince` (a date), merged by bill. */
async function listStateBills(get, actionSince) {
  const found = new Map();
  let date = null;
  for (const term of SUBJECT_TERMS) {
    for (let pageNumber = 1; ; pageNumber += 1) {
      const params = {
        // A quoted phrase: Open States reads q as web-search syntax, so bare words match anywhere.
        q: `"${term}"`,
        sort: "latest_action_desc",
        per_page: STATE_PAGE,
        page: pageNumber,
      };
      if (actionSince) params.action_since = actionSince;
      const page = await get("/bills", params);
      date ??= page.date;
      const results = Array.isArray(page.body.results) ? page.body.results : [];
      for (const b of results) {
        const row = stateRow(b);
        if (row) found.set(stateKey(row), row);
      }
      const maxPage = Number(page.body.pagination?.max_page ?? 0);
      if (results.length === 0 || pageNumber >= maxPage) break;
    }
  }
  return { bills: [...found.values()], date };
}

const sortState = (a, b) => stateKey(a).localeCompare(stateKey(b), "en");

export async function checkState(get, snapshot) {
  const { bills, date } = await listStateBills(get, dateOf(snapshot.checkedAt));
  const known = new Map(snapshot.bills.map((b) => [stateKey(b), b]));
  const differences = [];
  for (const b of bills) {
    const before = known.get(stateKey(b));
    const now = describeState(b.latestActionDate, b.latestActionDescription);
    if (!before) {
      differences.push(
        `new: ${b.jurisdiction} ${b.session} ${b.identifier}: ${b.title} (latest action ${now})`,
      );
    } else if (
      before.latestActionDate !== b.latestActionDate ||
      before.latestActionDescription !== b.latestActionDescription
    ) {
      const was = describeState(
        before.latestActionDate,
        before.latestActionDescription,
      );
      differences.push(
        `changed: ${b.jurisdiction} ${b.session} ${b.identifier}: ${b.title} (latest action ${was} became ${now})`,
      );
    }
    known.set(stateKey(b), b);
  }
  return { date, bills: [...known.values()].sort(sortState), differences };
}

export async function refreshState(get) {
  const { bills, date } = await listStateBills(get, undefined);
  return { date, bills: bills.sort(sortState) };
}

// ---------------------------------------------------------------- tz

/** A tzdata line without its comment, spaces collapsed; `""` when nothing is left. */
const cleanLine = (line) =>
  line.replace(/#.*$/, "").trim().replace(/\s+/g, " ");
/** A `RULES` field names a rule set unless it is `-` or a fixed amount such as `1:00`. */
const isRuleName = (field) =>
  field !== undefined && field !== "-" && !/^[-+]?\d/.test(field);

/**
 * `{ zones, rules, links }` of tzdata source text. A `Zone` line and the indented lines after it
 * are one block; `Rule` lines group by name, in file order; `Link TARGET NAME` maps NAME to TARGET.
 */
export function parseTzdb(text) {
  const zones = new Map();
  const rules = new Map();
  const links = new Map();
  let block = null;
  for (const raw of text.split("\n")) {
    const line = cleanLine(raw);
    if (line === "") continue;
    const fields = line.split(" ");
    if (/^\s/.test(raw)) {
      if (block) block.push(line);
      continue;
    }
    block = null;
    if (fields[0] === "Zone" && fields[1]) {
      block = [line];
      zones.set(fields[1], block);
    } else if (fields[0] === "Rule" && fields[1]) {
      if (!rules.has(fields[1])) rules.set(fields[1], []);
      rules.get(fields[1]).push(line);
    } else if (fields[0] === "Link" && fields[1] && fields[2]) {
      links.set(fields[2], fields[1]);
    }
  }
  return { zones, rules, links };
}

/** The rule-set names a block's lines use: field 4 of the `Zone` line, field 2 of each other line. */
function ruleNames(lines) {
  const names = [];
  for (const [index, line] of lines.entries()) {
    const fields = line.split(" ");
    const name = fields[index === 0 ? 3 : 1];
    if (isRuleName(name) && !names.includes(name)) names.push(name);
  }
  return names;
}

/**
 * The SHA-256 of a zone's normalised `Zone` block and of every `Rule` line the block names. A link
 * is followed to its target, and the link line itself is part of the hash.
 */
export function zoneHash(tzdb, name) {
  const parts = [];
  let current = name;
  for (let hop = 0; tzdb.links.has(current); hop += 1) {
    if (hop > 8) throw new SourceError(`zone ${name}: links loop`);
    parts.push(`Link ${tzdb.links.get(current)} ${current}`);
    current = tzdb.links.get(current);
  }
  const lines = tzdb.zones.get(current);
  if (!lines) throw new SourceError(`zone ${name} is not in the tz data`);
  parts.push(...lines);
  for (const rule of ruleNames(lines))
    parts.push(...(tzdb.rules.get(rule) ?? []));
  return createHash("sha256").update(parts.join("\n")).digest("hex");
}

/** `{ release, zones: { name: sha256 } }` for `zones`, from the tzdata text and release. */
export function tzSnapshot(release, text, zones) {
  const tzdb = parseTzdb(text);
  return {
    release,
    zones: Object.fromEntries(zones.map((z) => [z, zoneHash(tzdb, z)])),
  };
}

/** Reads the zone list: `{ zones: [...] }` as `us-region-zones.json` holds it. */
function readZones(root) {
  const data = JSON.parse(readFileSync(join(root, ZONES), "utf8"));
  const zones = Array.isArray(data) ? data : data.zones;
  if (!Array.isArray(zones) || zones.length === 0) {
    throw new SourceError(`${ZONES}: no zone list`);
  }
  return zones;
}

async function loadTz(fetch, zones, deadline) {
  const release = (
    await fetchText(fetch, `${TZ_BASE}/version`, deadline)
  ).trim();
  const texts = [];
  for (const file of TZ_FILES) {
    texts.push(await fetchText(fetch, `${TZ_BASE}/${file}`, deadline));
  }
  return tzSnapshot(release, texts.join("\n"), zones);
}

export function compareTz(current, snapshot) {
  const changed = [];
  for (const [zone, hash] of Object.entries(current.zones)) {
    if (snapshot.zones?.[zone] !== hash) changed.push(zone);
  }
  return changed;
}

// ---------------------------------------------------------------- the three sources, run

/** Runs `work`, turning a thrown failure into a could-not-run result with the key redacted. */
async function guarded(work, secrets) {
  try {
    return { status: "ran", ...(await work()) };
  } catch (error) {
    let message = error.message;
    for (const secret of secrets) {
      if (secret) message = message.split(secret).join("[key]");
    }
    return { status: "could-not-run", message };
  }
}

const missing = (env, name) =>
  env[name] ? null : `secret \`${name}\` is not set`;

/**
 * The verdict of one `check`: each source `{ status: "ran", … } | { status: "could-not-run", message }`.
 * `snapshot` is the snapshot compared with; `zones` is read lazily so a missing list fails only
 * `tz`. A federal or state source that ran gives `since`, the `checkedAt` it compared with, and
 * `next`, its part brought up to date (null when no response carried a `Date`). Every source stops
 * once `limits.checkDeadlineMs` has passed since the call.
 */
export async function runSources({
  env,
  fetch,
  sleep,
  snapshot,
  zones,
  limits,
}) {
  const secrets = [env[CONGRESS_KEY], env[OPEN_STATES_KEY]];
  const deadline = AbortSignal.timeout(limits.checkDeadlineMs);
  const federal = async () => {
    const gone = missing(env, CONGRESS_KEY);
    if (gone) throw new SourceError(gone);
    const { get, post } = federalRequesters({
      env,
      fetch,
      sleep,
      limits,
      deadline,
    });
    const { congress, date, bills, differences } = await checkFederal(
      get,
      post,
      snapshot.federal,
    );
    return {
      congress,
      since: snapshot.federal.checkedAt,
      differences,
      next: date ? { checkedAt: date, congress, bills } : null,
    };
  };
  const state = async () => {
    const gone = missing(env, OPEN_STATES_KEY);
    if (gone) throw new SourceError(gone);
    const get = requester({
      fetch,
      base: OPEN_STATES_BASE,
      headers: {
        "X-API-KEY": env[OPEN_STATES_KEY],
        Accept: "application/json",
      },
      budget: limits.stateRequests,
      pauseMs: limits.statePauseMs,
      sleep,
      timeoutMs: limits.stateTimeoutMs,
      deadline,
      retries: limits.retries,
      retryPauseMs: limits.retryPauseMs,
    });
    const { date, bills, differences } = await checkState(get, snapshot.state);
    return {
      since: snapshot.state.checkedAt,
      differences,
      next: date ? { checkedAt: date, bills } : null,
    };
  };
  const tz = async () => {
    const current = await loadTz(fetch, zones(), deadline);
    const changed = compareTz(current, snapshot.tz);
    return {
      release: current.release,
      snapshotRelease: snapshot.tz.release,
      differences: changed,
    };
  };
  return {
    federal: await guarded(federal, secrets),
    state: await guarded(state, secrets),
    tz: await guarded(tz, secrets),
  };
}

// ---------------------------------------------------------------- command

const EMPTY_SNAPSHOT = {
  federal: { checkedAt: "", congress: 0, bills: [] },
  state: { checkedAt: "", bills: [] },
  tz: { release: "", zones: {} },
};

function readSnapshot(root) {
  const data = JSON.parse(readFileSync(join(root, SNAPSHOT), "utf8"));
  for (const part of Object.keys(EMPTY_SNAPSHOT)) {
    if (data?.[part] === undefined)
      throw new Error(`${SNAPSHOT}: no \`${part}\``);
  }
  return data;
}

/** A carried federal or state part: a `checkedAt` timestamp and a bill list. */
const isPart = (part) =>
  typeof part?.checkedAt === "string" &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(part.checkedAt) &&
  Array.isArray(part.bills);

/**
 * The snapshot a `check` compares with: the committed one, with each federal or state part in the
 * carried file that is newer. `note` says which parts came from where. A carried file that is
 * missing or does not parse leaves the committed snapshot as it is.
 */
function withCarried(committed, carryPath) {
  if (!existsSync(carryPath)) {
    return { snapshot: committed, note: "no carried snapshot" };
  }
  let carried;
  try {
    carried = JSON.parse(readFileSync(carryPath, "utf8"));
  } catch {
    return { snapshot: committed, note: "the carried snapshot does not parse" };
  }
  const snapshot = { ...committed };
  const taken = [];
  for (const part of ["federal", "state"]) {
    const next = carried?.[part];
    const valid =
      isPart(next) && (part === "state" || Number.isInteger(next.congress));
    if (valid && next.checkedAt > String(committed[part].checkedAt)) {
      snapshot[part] = next;
      taken.push(`${part} of ${next.checkedAt}`);
    }
  }
  return {
    snapshot,
    note:
      taken.length > 0
        ? `carried ${taken.join(", ")}`
        : "the carried snapshot is no newer",
  };
}

/**
 * Runs the command line; returns the exit code. Nothing reads `process` here, so a test passes
 * its own `env`, `fetch`, `sleep` and sinks.
 * @param {string[]} argv
 * @param {{ root: string, env: Record<string, string | undefined>, fetch: typeof fetch,
 *   sleep: (ms: number) => Promise<void>, stdout: (t: string) => void, stderr: (t: string) => void,
 *   limits?: Partial<typeof LIMITS> }} io
 */
export async function main(argv, io) {
  const { root, env, stdout } = io;
  const secrets = [env[CONGRESS_KEY], env[OPEN_STATES_KEY]].filter(Boolean);
  const redact = (text) =>
    secrets.reduce((t, s) => t.split(s).join("[key]"), String(text));
  const stderr = (text) => io.stderr(redact(text));
  const args = argv.filter((a) => a !== "--");
  const command = args[0] ?? "check";
  const usage = () => {
    stderr(
      "Usage: node scripts/us-clock-watch.mjs <check [--carry=<file>]|refresh|snapshot-tz --dir=<folder>>\n",
    );
    return 1;
  };
  if (!["check", "refresh", "snapshot-tz"].includes(command)) return usage();
  const limits = { ...LIMITS, ...io.limits };
  const sleep = io.sleep;

  if (command === "snapshot-tz") {
    const dir = args.find((a) => a.startsWith("--dir="))?.slice(6);
    if (!dir) return usage();
    try {
      const snapshot = readSnapshot(root);
      const text = TZ_FILES.map((f) => readFileSync(join(dir, f), "utf8")).join(
        "\n",
      );
      const release = readFileSync(join(dir, "version"), "utf8").trim();
      snapshot.tz = tzSnapshot(release, text, readZones(root));
      writeFileSync(join(root, SNAPSHOT), formatJson(snapshot));
      stdout(`${PREFIX}: tz part written for release ${release}\n`);
      return 0;
    } catch (error) {
      stderr(`${PREFIX}: cannot write the tz part: ${error.message}\n`);
      return 2;
    }
  }

  if (command === "refresh")
    return await refresh({ ...io, limits, sleep, stderr });

  const carry = args.find((a) => a.startsWith("--carry="))?.slice(8);
  if (carry === "" || args.slice(1).some((a) => !a.startsWith("--carry="))) {
    return usage();
  }
  let snapshot;
  try {
    snapshot = readSnapshot(root);
  } catch (error) {
    stderr(`${PREFIX}: cannot run: ${error.message}\n`);
    saveVerdict(
      root,
      couldNotRunVerdict(PREFIX, `cannot run: ${error.message}`),
      PREFIX,
    );
    return 2;
  }
  const carryPath = carry === undefined ? null : resolve(root, carry);
  if (carryPath) {
    const carried = withCarried(snapshot, carryPath);
    snapshot = carried.snapshot;
    stdout(`${PREFIX}: ${carried.note}\n`);
  }
  const sources = await runSources({
    env,
    fetch: io.fetch,
    sleep,
    snapshot,
    zones: () => readZones(root),
    limits,
  });
  if (carryPath) {
    const next = {
      federal: sources.federal.next ?? snapshot.federal,
      state: sources.state.next ?? snapshot.state,
      tz: snapshot.tz,
    };
    mkdirSync(dirname(carryPath), { recursive: true });
    writeFileSync(carryPath, formatJson(next));
    stdout(
      `${PREFIX}: carried forward federal of ${next.federal.checkedAt}, state of ${next.state.checkedAt}\n`,
    );
  }
  const verdict = {
    source: PREFIX,
    status: "ran",
    ...Object.fromEntries(
      Object.entries(sources).map(([name, { next: _next, ...result }]) => [
        name,
        JSON.parse(redact(JSON.stringify(result))),
      ]),
    ),
  };
  saveVerdict(root, verdict, PREFIX);
  return report(sources, stdout, stderr);
}

/** Prints what each source found; returns 0, 1 (a difference) or 2 (a source could not run). */
function report(sources, stdout, stderr) {
  let code = 0;
  for (const [name, result] of Object.entries(sources)) {
    if (result.status !== "ran") {
      stderr(`${PREFIX}: ${name} could not run: ${result.message}\n`);
      code = 2;
    } else if (result.differences.length > 0) {
      stderr(
        `${PREFIX}: ${name} differs:\n${result.differences.map((d) => `  ${d}`).join("\n")}\n`,
      );
      if (code === 0) code = 1;
    } else {
      stdout(`${PREFIX}: ${name} matches the snapshot\n`);
    }
  }
  return code;
}

async function refresh({ root, env, fetch, sleep, stdout, stderr, limits }) {
  const gone = [CONGRESS_KEY, OPEN_STATES_KEY].filter((n) => !env[n]);
  if (gone.length > 0) {
    stderr(
      `${PREFIX}: refresh needs ${gone.map((n) => `\`${n}\``).join(" and ")}\n`,
    );
    return 2;
  }
  try {
    const { tz } = readSnapshot(root);
    const { get, post } = federalRequesters({ env, fetch, sleep, limits });
    const federal = await refreshFederal(get, post);
    const state = await refreshState(
      requester({
        fetch,
        base: OPEN_STATES_BASE,
        headers: {
          "X-API-KEY": env[OPEN_STATES_KEY],
          Accept: "application/json",
        },
        budget: limits.stateRefreshRequests,
        pauseMs: limits.statePauseMs,
        sleep,
        timeoutMs: limits.stateTimeoutMs,
        retries: limits.retries,
        retryPauseMs: limits.retryPauseMs,
      }),
    );
    if (!federal.date || !state.date) {
      throw new SourceError(
        "a response carried no Date header, so there is no checkedAt",
      );
    }
    const snapshot = {
      federal: {
        checkedAt: federal.date,
        congress: federal.congress,
        bills: federal.bills,
      },
      state: { checkedAt: state.date, bills: state.bills },
      tz,
    };
    writeFileSync(join(root, SNAPSHOT), formatJson(snapshot));
    stdout(
      `${PREFIX}: snapshot written: ${federal.bills.length} federal bills (congress ${federal.congress}), ` +
        `${state.bills.length} state bills; tz ${tz.release} kept\n`,
    );
    return 0;
  } catch (error) {
    stderr(`${PREFIX}: refresh failed: ${error.message}\n`);
    return 2;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  process.exitCode = await main(process.argv.slice(2), {
    root: ROOT,
    env: process.env,
    fetch: globalThis.fetch,
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    stdout: (text) => process.stdout.write(text),
    stderr: (text) => process.stderr.write(text),
  });
}
