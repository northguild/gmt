#!/usr/bin/env node
/**
 * US clock-change freshness canary (CORE-90, #341).
 *
 *   node scripts/us-clock-watch.mjs check
 *     Compares three sources with the committed snapshot, `scripts/us-clock-watch.snapshot.json`:
 *       federal  the Congress.gov API: bills whose title names the subject, and their latest action
 *       state    the Open States v3 API: state bills that match the subject terms, latest action
 *       tz       the IANA tz database: the rules of every zone in `apps/dox/src/lib/us-region-zones.json`
 *     Exit 0 when nothing differs, 1 when something does, 2 when any source could not run (a
 *     network or HTTP error, a 429, a body that does not parse, a spent request budget, or a
 *     missing secret). The other sources still report. The verdict file
 *     (`artifacts/us-clock-watch.json`) is written before the exit; `scripts/canary-report.mjs`
 *     files the issues from it.
 *
 *   node scripts/us-clock-watch.mjs refresh
 *     Fetches all three sources in full and writes the snapshot. Run by hand, with both secrets in
 *     the environment, after a person has reviewed what changed. The first run lists the whole
 *     current congress (about 60 pages).
 *
 *   node scripts/us-clock-watch.mjs snapshot-tz --dir=<folder>
 *     Rewrites only the snapshot's `tz` part from a folder holding `northamerica`, `australasia`,
 *     `backward` and `version` (an unpacked tzdata release). It needs no network or key.
 *
 * Secrets, read from the environment and sent only in a request header, never in a URL, a log line
 * or the verdict file: `CONGRESS_GOV_API_KEY` (api.data.gov key, header `X-Api-Key`) and
 * `OPEN_STATES_API_KEY` (header `X-API-KEY`). A missing one makes that source "could not run".
 *
 * The script holds subject keywords only, no bill, title, statute or body. A bill's number and
 * title appear in the snapshot and in issue bodies as data the APIs returned.
 *
 * `checkedAt` is read from a response `Date` header: the script reads no clock of its own.
 *
 * Node built-ins and `fetch` only: no install, no build. Never wired into `validate` or `ci.yml`.
 * Retirement (specs/CORE-90/index.md, Decisions 11 and 13): the tz part when the US clock-change
 * checker (CORE-90 phase 2) ships; the federal and state parts when the Proposals view's data is
 * removed or replaced.
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
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
/** Congress.gov has no keyword search, so a bill title is matched on these (case-insensitive). */
export const TITLE_TERMS = [...SUBJECT_TERMS, "daylight time"];

const CONGRESS_BASE = "https://api.congress.gov/v3";
const OPEN_STATES_BASE = "https://v3.openstates.org";
const TZ_BASE = "https://data.iana.org/time-zones/tzdb";
/** `backward` holds the `Link` lines of St_Thomas, Midway, Saipan and Wake. */
const TZ_FILES = ["northamerica", "australasia", "backward"];
const CONGRESS_KEY = "CONGRESS_GOV_API_KEY";
const OPEN_STATES_KEY = "OPEN_STATES_API_KEY";

const FETCH_TIMEOUT_MS = 30_000;
const FEDERAL_PAGE = 250;
const STATE_PAGE = 20;
/** The default limits (tests pass smaller ones). */
export const LIMITS = {
  federalRequests: 400,
  stateRequests: 60,
  /** Stop when `X-RateLimit-Remaining` falls below this. */
  rateFloor: 100,
  statePauseMs: 1000,
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
 * `get(path)` returns `{ body, date }`, `date` being the response `Date` header as ISO or null.
 * Every thrown message names the host and path only, never the query.
 */
function requester({
  fetch,
  base,
  headers,
  budget,
  rateFloor = 0,
  pauseMs = 0,
  sleep,
}) {
  let sent = 0;
  return async function get(path, params = {}) {
    if (sent >= budget) {
      throw new SourceError(`request budget of ${budget} is spent`);
    }
    if (sent > 0 && pauseMs > 0) await sleep(pauseMs);
    sent += 1;
    const url = new URL(`${base}${path}`);
    for (const [name, value] of Object.entries(params)) {
      url.searchParams.set(name, String(value));
    }
    const where = `${url.host}${url.pathname}`;
    let response;
    try {
      response = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
    } catch (error) {
      throw new SourceError(`network error from ${where}: ${error.message}`);
    }
    if (response.status === 429) {
      throw new SourceError(`HTTP 429 from ${where} (rate limited; no retry)`);
    }
    if (!response.ok) {
      throw new SourceError(`HTTP ${response.status} from ${where}`);
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
  };
}

/** Text of `fetch` for a plain file (no key, no budget beyond the caller's loop). */
async function fetchText(fetch, url) {
  let response;
  try {
    response = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch (error) {
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

/** Every matching bill on the list pages of `congress`, from `fromDateTime` when given. */
async function listBills(get, congress, fromDateTime) {
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
      if (!titleMatches(b.title)) continue;
      found.push({
        type: String(b.type),
        number: String(b.number),
        title: String(b.title),
        latestAction: {
          actionDate: b.latestAction?.actionDate ?? "",
          text: b.latestAction?.text ?? "",
        },
      });
    }
    if (bills.length < FEDERAL_PAGE || !page.body.pagination?.next) break;
  }
  return { bills: found, date };
}

const byKey = (a, b) =>
  billKey(a).localeCompare(billKey(b), "en", { numeric: true });

/**
 * @returns {{ congress: number, date: string | null, bills: object[], differences: string[] }}
 *   `bills` is the snapshot's list brought up to date.
 */
export async function checkFederal(get, snapshot) {
  const { number, date: currentDate } = await currentCongress(get);
  const prior = snapshot.congress;
  const differences = [];
  let kept = snapshot.bills;
  let fromDateTime = `${dateOf(snapshot.checkedAt)}T00:00:00Z`;
  if (prior !== number) {
    differences.push(
      prior
        ? `a new session began: congress ${number} (the snapshot has ${prior})`
        : "the snapshot has no congress number: run `refresh`",
    );
    kept = [];
    fromDateTime = undefined;
  }
  const { bills, date } = await listBills(get, number, fromDateTime);
  const known = new Map(kept.map((b) => [billKey(b), b]));
  for (const b of bills) {
    const before = known.get(billKey(b));
    if (!before) {
      if (fromDateTime) {
        differences.push(
          `new: ${billKey(b)}: ${b.title} (latest action ${describeAction(b.latestAction)})`,
        );
      }
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
export async function refreshFederal(get) {
  const { number, date: currentDate } = await currentCongress(get);
  const { bills, date } = await listBills(get, number, undefined);
  return {
    congress: number,
    date: date ?? currentDate,
    bills: bills.sort(byKey),
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

async function loadTz(fetch, zones) {
  const release = (await fetchText(fetch, `${TZ_BASE}/version`)).trim();
  const texts = [];
  for (const file of TZ_FILES) {
    texts.push(await fetchText(fetch, `${TZ_BASE}/${file}`));
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
 * `snapshot` is the committed snapshot; `zones` is read lazily so a missing list fails only `tz`.
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
  const federal = async () => {
    const gone = missing(env, CONGRESS_KEY);
    if (gone) throw new SourceError(gone);
    const get = requester({
      fetch,
      base: CONGRESS_BASE,
      headers: { "X-Api-Key": env[CONGRESS_KEY], Accept: "application/json" },
      budget: limits.federalRequests,
      rateFloor: limits.rateFloor,
      sleep,
    });
    const { congress, differences } = await checkFederal(get, snapshot.federal);
    return { congress, differences };
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
    });
    const { differences } = await checkState(get, snapshot.state);
    return { differences };
  };
  const tz = async () => {
    const current = await loadTz(fetch, zones());
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
      "Usage: node scripts/us-clock-watch.mjs <check|refresh|snapshot-tz --dir=<folder>>\n",
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
  const sources = await runSources({
    env,
    fetch: io.fetch,
    sleep,
    snapshot,
    zones: () => readZones(root),
    limits,
  });
  const verdict = {
    source: PREFIX,
    status: "ran",
    ...Object.fromEntries(
      Object.entries(sources).map(([name, result]) => [
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
    const federal = await refreshFederal(
      requester({
        fetch,
        base: CONGRESS_BASE,
        headers: { "X-Api-Key": env[CONGRESS_KEY], Accept: "application/json" },
        budget: limits.federalRequests,
        rateFloor: limits.rateFloor,
        sleep,
      }),
    );
    const state = await refreshState(
      requester({
        fetch,
        base: OPEN_STATES_BASE,
        headers: {
          "X-API-KEY": env[OPEN_STATES_KEY],
          Accept: "application/json",
        },
        budget: limits.stateRequests,
        pauseMs: limits.statePauseMs,
        sleep,
      }),
    );
    const tz = await loadTz(fetch, readZones(root));
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
        `${state.bills.length} state bills, tz ${tz.release}\n`,
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
