/**
 * CORE-81: the pure decision behind the canary issues. Verdicts and the open issues go in; a list
 * of `open` / `comment` actions comes out. Nothing here reads a file, the network, the process or
 * the clock, so the whole rule set is tested offline (`apps/dox/scripts/canary/canary-issues.test.ts`).
 *
 * Every canary issue carries the label `canary` and, as its body's first line, a hidden marker
 * naming the finding's key. An open `canary` issue with that marker gets a comment; otherwise a new
 * issue opens. A finding keyed by what is wrong, not by the run, is what stops a weekly run from
 * opening a second issue for a problem that is still there.
 *
 * Imports one constant (`ENGINE_IDS`) and nothing that reads or writes.
 */
import { ENGINE_IDS } from "./workarounds.mjs";

/** Label every canary issue carries. */
export const CANARY_LABEL = "canary";
/** Extra label on an issue a manual dispatch forced. */
export const DRY_RUN_LABEL = "canary-dry-run";
/** Extra label on a finding where GMT, a native Temporal engine and runtime data disagree. */
export const COMPAT_LABEL = "temporal-compat";
/** GitHub issue type every canary issue is created with. */
export const ISSUE_TYPE = "Task";
/** The four `temporal-polyfill` swap legs' verdict sources (CORE-92), in leg order. */
export const SWAP_SOURCES = [
  "temporal-polyfill-swap-node",
  "temporal-polyfill-swap-chromium",
  "temporal-polyfill-swap-firefox",
  "temporal-polyfill-swap-webkit",
];

/** The verdict sources each workflow reads, in the order its could-not-run message lists them. */
export const WORKFLOW_SOURCES = {
  "temporal-oracle": [
    "temporal-compat-check",
    "temporal-compat-chromium",
    "temporal-compat-firefox",
    "temporal-compat-webkit",
    "temporal-oracle",
    "native-suite-node",
    "native-suite-chromium",
    "native-suite-firefox",
    "native-suite-webkit",
    ...SWAP_SOURCES,
  ],
  "leap-seconds": ["leap-seconds"],
};

/**
 * How many untagged groups a body or comment tables. Defined here, not imported from
 * `canary-verdict.mjs` (`UNTAGGED_ROWS_IN_VERDICT`, also 50), so this module keeps importing nothing.
 * Each groups row embeds its example row as JSON, so an uncapped table could push the body past
 * GitHub's 65,536-character limit and make `gh issue create` fail on the run that needs it.
 */
const UNTAGGED_GROUPS_IN_BODY = 50;

const CHECK = "temporal-compat-check";
/** @param {string} leg */
const COMPAT = (leg) => `temporal-compat-${leg}`;
/**
 * Every source that judges the workaround groups, the Node check first, then one browser per
 * native-suite leg. A group is removable when every source in its scope says so.
 */
export const COMPAT_SOURCES = [
  CHECK,
  COMPAT("chromium"),
  COMPAT("firefox"),
  COMPAT("webkit"),
];
/** The engine a compat source runs on, with or without its verdict. */
const SOURCE_ENGINE = {
  [CHECK]: ENGINE_IDS.node,
  [COMPAT("chromium")]: ENGINE_IDS.chromium,
  [COMPAT("firefox")]: ENGINE_IDS.firefox,
  [COMPAT("webkit")]: ENGINE_IDS.webkit,
};
const ORACLE = "temporal-oracle";
const LEAP = "leap-seconds";
const LEAP_IANA = "IANA leap-seconds.list";
const LEAP_IANA_URL = "https://data.iana.org/time-zones/tzdb/leap-seconds.list";
const LEAP_IERS_URL = "https://hpiers.obspm.fr/iers/bul/bulc/Leap_Second.dat";
/** The native-suite legs, in the order their findings and summary rows list them. */
const NATIVE_LEGS = ["node", "chromium", "firefox", "webkit"];
/** @param {string} leg */
const NATIVE = (leg) => `native-suite-${leg}`;
const SWAP = (leg) => `temporal-polyfill-swap-${leg}`;
const SWAP_NODE = SWAP("node");
const SWAP_RESEARCH_URL =
  "https://github.com/northguild/gmt/blob/main/context/domination/research/temporal-polyfill-swap.md";
const SWAP_LEG_NAMES = {
  node: "Node",
  chromium: "Chromium",
  firefox: "Firefox",
  webkit: "WebKit",
};

const TRIAGE_PARAGRAPH =
  "Each row failed on the native engine and passed on @js-temporal/polyfill in the same runtime. Decide which it is: a GMT defect (fix it), a polyfill defect or an engine or specification defect (record it in context/domination/js-temporal-polyfill-bugs.md and tag the test in scripts/lib/native-suite-tags.mjs). Never skip the test.";
const HOST_PARAGRAPH =
  "Each row failed on the native engine and on @js-temporal/polyfill in the same runtime, so the cause is the runtime (its locale or time zone data, or its setup), not Temporal. Find what the runtime lacks, then add or widen a group in KNOWN_HOST_FAILURES in scripts/lib/native-suite-tags.mjs with that reason — one group per cause, never one entry per test — or fix the test if it depends on the host by mistake. Never skip the test.";
const CONTROL_PARAGRAPH =
  "Each row failed on @js-temporal/polyfill and passed on the native engine in the same runtime. GMT ships the polyfill, so this is a wrong answer GMT gives users of that runtime. Find the polyfill defect, record it in context/domination/js-temporal-polyfill-bugs.md and fix GMT's answer with a temporalCompat workaround, or fix GMT if the defect is its own. There is no tag for these rows. Never skip the test.";
const FORCED_NATIVE_ROW = {
  file: "src/dry-run.test.ts",
  test: "dry run: forced failure (no real test failed)",
  message: "forced",
};

const NO_VERDICT = "no verdict file: an earlier step or job failed";
const FLOOR_STEP =
  "Raise the @js-temporal/polyfill floor in packages/gmt/package.json to the release that made this removable, so no install resolves one with the defect.";
const FORCED_LEAP_LINE = "dry run: forced difference (no real row differs)";
const FORCED_ROW = {
  scan: "dry-run",
  calendar: "iso8601",
  op: "forced",
  row: 0,
  iso: "1970-01-01",
  input: "dry run",
  native: "dry run",
  expected: "dry run",
  gmt: "forced mismatch",
};

/**
 * @typedef {{ polyfill: string, node: string, icu: string }} Runtime
 * @typedef {{ package: string, through: string, reason: string, lapsed: boolean }} Guard
 * @typedef {{
 *   id: string, defects: string[], title: string, trigger: string,
 *   state: "still-needed" | "removable" | "guard" | "out-of-scope",
 *   probes: number, failing: number, engines?: string[], guard?: Guard, steps: string[],
 * }} Workaround
 * @typedef {{ workarounds: number, stillNeeded: number, removable: number, guard: number,
 *   outOfScope: number }} CompatCounts
 * @typedef {{
 *   source: "temporal-compat-check", status: "ran", engineId: "v8", runtime: Runtime,
 *   counts: CompatCounts, snapshot: { path: string, current: boolean },
 *   workarounds: Workaround[], forced?: { removable: string },
 * }} CompatCheckVerdict
 * @typedef {{
 *   source: string, status: "ran", leg: "chromium" | "firefox" | "webkit", engine: string,
 *   engineId: "v8" | "firefox" | "webkit",
 *   runtime: { polyfill: string, node: string, playwright: string },
 *   counts: CompatCounts, workarounds: Workaround[],
 * }} BrowserCompatVerdict
 * @typedef {{
 *   scan: string, calendar: string, op: string, row: number, iso: string,
 *   input: string, native: string, expected: string, gmt: string,
 * }} MismatchRow
 * @typedef {{
 *   source: "temporal-oracle", status: "ran", runtime: Runtime, chromium: string,
 *   calendars: string[],
 *   counts: { comparisons: number, mismatches: number, tagged: number, untagged: number },
 *   untaggedGroups: { key: string, count: number, example: unknown }[],
 *   untagged: MismatchRow[], untaggedTruncated: boolean, report: string,
 *   forced?: { mismatch: true },
 * }} OracleVerdict
 * @typedef {{
 *   source: "leap-seconds", status: "ran",
 *   from: "IERS Leap_Second.dat" | "IANA leap-seconds.list", header: string | null,
 *   rows: { gmt: number, iers: number }, differences: string[],
 *   forced?: { difference: true },
 * }} LeapSecondsVerdict
 * @typedef {{ source: string, status: "could-not-run", message: string }} CouldNotRunVerdict
 * @typedef {{ file: string, test: string, message: string }} NativeFailure
 * @typedef {{
 *   source: string, status: "ran", leg: "node" | "chromium" | "firefox" | "webkit", engine: string,
 *   runtime: { node: string, vitest: string, playwright: string | null },
 *   counts: { files: number, tests: number, passed: number, skipped: number, tagged: number, untagged: number,
 *             hostTagged: number, hostUntagged: number, controlOnly: number, staleTags: number },
 *   tagged: { file: string, test: string, defect: string }[],
 *   untagged: NativeFailure[], untaggedTruncated: boolean,
 *   hostTagged: { group: string, count: number, reason: string }[],
 *   hostUntagged: NativeFailure[], hostUntaggedTruncated: boolean,
 *   controlOnly: NativeFailure[], controlOnlyTruncated: boolean,
 *   staleTags: ({ kind: "divergence", file: string, test: string, defect: string }
 *     | { kind: "host", group: string, reason: string })[],
 *   forced?: { nativeFailure: true },
 * }} NativeSuiteVerdict
 * @typedef {CompatCheckVerdict | BrowserCompatVerdict | OracleVerdict | LeapSecondsVerdict
 *   | NativeSuiteVerdict | CouldNotRunVerdict} Verdict
 * @typedef {{
 *   source: string, status: "ran", leg: "node" | "chromium" | "firefox" | "webkit",
 *   version: string, entry: string, entryLoaded: boolean,
 *   runtime: { node: string, vitest: string, playwright: string | null, browser: string | null },
 *   counts: { files: number, tests: number, passed: number, skipped: number, failed: number,
 *             both: number, fixed: number },
 *   failing: NativeFailure[], failingTruncated: boolean,
 *   sweep: null | { status: "ran", tz: string, from: string, through: string, zones: number,
 *                   differingZones: number, [field: string]: unknown }
 *        | { status: "could-not-run", message: string },
 *   forced?: { swapReady: true },
 * }} SwapVerdict
 * @typedef {{ removable?: string, mismatch?: boolean, nativeFailure?: boolean,
 *   leapDifference?: boolean, swapReady?: boolean }} Force
 * @typedef {{ workflow: "temporal-oracle" | "leap-seconds", runUrl: string }} Context
 * @typedef {{ key: string, title: string, labels: string[], body: string, comment: string }} Finding
 * @typedef {{ kind: "open", key: string, title: string, labels: string[], body: string }
 *   | { kind: "comment", key: string, issue: number, body: string }} Action
 */

/**
 * The hidden first line of a canary issue body. It renders nothing (GFM spec 0.29-gfm §4.6, HTML
 * block start condition 2).
 * @param {string} key
 * @returns {string}
 */
export function marker(key) {
  return `<!-- gmt-canary key="${key}" -->`;
}

/**
 * @param {Record<string, Verdict | null | undefined>} verdicts
 * @param {string} source
 * @returns {Verdict | null}
 */
function verdictOf(verdicts, source) {
  return verdicts[source] ?? null;
}

/**
 * Copies `verdicts` with the forced dry-run findings recorded beside the real data, which is
 * never altered. A forced item whose source is missing or did not run has nothing to force
 * against: that force is left out and returned in `skipped` with its reason, so the real
 * could-not-run finding is still filed. Throws, naming the flag, only when `removable` names an id
 * that the check verdict (which ran) does not have; the message lists the valid ids.
 * @param {Record<string, Verdict | null>} verdicts  keyed by source; null = no file
 * @param {Force} force
 * @returns {{ verdicts: Record<string, Verdict | null>, skipped: { flag: string, reason: string }[] }}
 */
export function applyForce(verdicts, force) {
  /** @type {Record<string, any>} */
  const copy = {};
  for (const [source, verdict] of Object.entries(verdicts)) {
    copy[source] =
      verdict === null || verdict === undefined
        ? null
        : structuredClone(verdict);
  }
  /** @type {{ flag: string, reason: string }[]} */
  const skipped = [];
  /**
   * The verdict to force against, or null after recording `flag` as skipped.
   * @param {string} flag
   * @param {string} source
   */
  const ran = (flag, source) => {
    const verdict = copy[source];
    if (verdict && verdict.status === "ran") return verdict;
    skipped.push({
      flag,
      reason: `the ${source} verdict is missing or did not run, so there is nothing to force against`,
    });
    return null;
  };
  forceRemovable(force, ran);
  if (force.mismatch) {
    const verdict = ran("--force-mismatch", ORACLE);
    if (verdict) verdict.forced = { mismatch: true };
  }
  if (force.nativeFailure) forceNativeFailure(copy, skipped);
  if (force.leapDifference) {
    const verdict = ran("--force-leap-difference", LEAP);
    if (verdict) verdict.forced = { difference: true };
  }
  if (force.swapReady) forceSwapReady(copy, skipped);
  return { verdicts: copy, skipped };
}

/**
 * Marks the check verdict's workaround `force.removable` as forced. Throws when no workaround has
 * that id.
 * @param {Force} force
 * @param {(flag: string, source: string) => any} ran
 */
function forceRemovable(force, ran) {
  if (force.removable === undefined) return;
  const flag = `--force-removable=${force.removable}`;
  const verdict = ran(flag, CHECK);
  if (!verdict) return;
  const ids = verdict.workarounds.map((/** @type {Workaround} */ w) => w.id);
  if (!ids.includes(force.removable)) {
    throw new Error(
      `${flag}: no workaround has that id; valid ids: ${ids.join(", ")}`,
    );
  }
  verdict.forced = { removable: force.removable };
}

/**
 * Marks the first native leg that ran as forced, or records the skip.
 * @param {Record<string, any>} copy
 * @param {{ flag: string, reason: string }[]} skipped
 */
function forceNativeFailure(copy, skipped) {
  const first = NATIVE_LEGS.find((leg) => copy[NATIVE(leg)]?.status === "ran");
  if (first) {
    copy[NATIVE(first)].forced = { nativeFailure: true };
    return;
  }
  skipped.push({
    flag: "--force-native-failure",
    reason: "no native-suite verdict ran, so there is nothing to force against",
  });
}

/**
 * Marks the first swap leg that ran as forced, or records the skip.
 * @param {Record<string, any>} copy
 * @param {{ flag: string, reason: string }[]} skipped
 */
function forceSwapReady(copy, skipped) {
  const first = NATIVE_LEGS.find((leg) => copy[SWAP(leg)]?.status === "ran");
  if (first) {
    copy[SWAP(first)].forced = { swapReady: true };
    return;
  }
  skipped.push({
    flag: "--force-swap-ready",
    reason:
      "no temporal-polyfill-swap verdict ran, so there is nothing to force against",
  });
}

/**
 * GFM table cell: `|` escaped, line endings (LF, CRLF or a lone CR, GFM spec 0.29-gfm §2.1) turned
 * into a space (§4.10).
 * @param {unknown} value
 * @returns {string}
 */
function cell(value) {
  return String(value)
    .replace(/\|/g, "\\|")
    .replace(/\r\n?|\n/g, " ");
}

/**
 * @param {string[]} header
 * @param {string[][]} rows  already-escaped cells
 * @returns {string}
 */
function table(header, rows) {
  return [
    `| ${header.join(" | ")} |`,
    `| ${header.map(() => "---").join(" | ")} |`,
    ...rows.map((r) => `| ${r.join(" | ")} |`),
  ].join("\n");
}

/**
 * A table cell as a code span, so `*`, `_` and `<` in a value render literally. A backtick cannot
 * appear inside the span (GFM §6.1), so it becomes `'`.
 * @param {unknown} value
 */
function codeCell(value) {
  return `\`${cell(value).replace(/`/g, "'")}\``;
}

/** @param {unknown} example */
function exampleCell(example) {
  return codeCell(
    typeof example === "string" ? example : (JSON.stringify(example) ?? ""),
  );
}

/**
 * @param {Runtime} runtime
 * @param {string} [chromium]
 */
function runtimeLine(runtime, chromium) {
  const parts = [
    `@js-temporal/polyfill ${runtime.polyfill}`,
    `Node ${runtime.node}`,
    `ICU ${runtime.icu}`,
  ];
  if (chromium !== undefined) parts.push(`Chromium ${chromium}`);
  return parts.join(" · ");
}

/**
 * @param {string} text  one paragraph per entry, blank-line separated
 * @param {string} runUrl
 */
function withRun(text, runUrl) {
  return `${text}\n\nRun: ${runUrl}`;
}

/**
 * @param {string} flag
 * @returns {string}
 */
function dryRunNote(flag) {
  return `**Dry run.** Forced by a manual dispatch (${flag}); nothing here is a real finding. Close this issue once checked.`;
}

/**
 * The dry-run twin of a finding: its own key namespace, a `[dry run]` title, the extra label and
 * the dry-run note ahead of the same paragraphs, so a forced run never touches a real issue.
 * @param {Finding} real
 * @param {string} flag
 * @param {string[]} paragraphs  the body's paragraphs, before the run line
 * @param {string} runUrl
 * @returns {Finding}
 */
function dryRun(real, flag, paragraphs, runUrl) {
  return {
    key: `dry-run/${real.key}`,
    title: `[dry run] ${real.title}`,
    labels: [...real.labels, DRY_RUN_LABEL],
    body: withRun(`${dryRunNote(flag)}\n\n${paragraphs.join("\n\n")}`, runUrl),
    comment: real.comment,
  };
}

/** @param {Workaround} w */
function summaryOf(w) {
  const dash = w.title.indexOf("—");
  return dash === -1 ? w.title : w.title.slice(dash + 1).trim();
}

/**
 * How a compat source names its engine: the Node check by Node's version (its engine is V8, like
 * Chromium's), a browser by the name and version Playwright reports.
 * @param {CompatCheckVerdict | BrowserCompatVerdict} verdict
 */
function compatEngineLabel(verdict) {
  return verdict.source === CHECK
    ? `Node ${verdict.runtime.node}`
    : /** @type {BrowserCompatVerdict} */ (verdict).engine;
}

/**
 * @typedef {{ source: string, engineId: string, inScope: boolean, engine: string | null,
 *   row: Workaround | null, message: string | null }} EngineState
 *   one compat source's view of a group: `row` null when the source has no verdict for it,
 *   with `message` saying why
 * @typedef {{ id: string, workaround: Workaround, polyfill: string, engines: EngineState[],
 *   everywhere: boolean }} CompatState
 */

/**
 * Each workaround group's state on every compat source, in script order. A group with `engines`
 * is in scope only on those engines; `everywhere` is true when every in-scope source ran and
 * reports the group removable, and no source at all reports it still needed. A source in scope
 * with no verdict, or whose verdict does not know the group, blocks: a group is never called
 * removable on evidence from only part of its scope. A failing probe blocks from any engine,
 * in scope or not, the rule `workaroundState` applies: a failure is evidence wherever it happens.
 * @param {Record<string, Verdict | null>} verdicts
 * @returns {CompatState[]}
 */
export function compatStates(verdicts) {
  const sources = COMPAT_SOURCES.map((source) => {
    const verdict = verdictOf(verdicts, source);
    return {
      source,
      ran:
        verdict?.status === "ran"
          ? /** @type {CompatCheckVerdict | BrowserCompatVerdict} */ (verdict)
          : null,
      message:
        verdict === null
          ? NO_VERDICT
          : verdict.status === "could-not-run"
            ? /** @type {CouldNotRunVerdict} */ (verdict).message
            : null,
    };
  });
  /** @type {Map<string, { workaround: Workaround, polyfill: string }>} */
  const groups = new Map();
  for (const { ran } of sources) {
    if (!ran) continue;
    for (const workaround of ran.workarounds) {
      if (!groups.has(workaround.id)) {
        groups.set(workaround.id, {
          workaround,
          polyfill: ran.runtime.polyfill,
        });
      }
    }
  }
  return [...groups].map(([id, { workaround, polyfill }]) => {
    const engines = sources.map(({ source, ran, message }) => {
      const engineId = SOURCE_ENGINE[source];
      const inScope =
        !workaround.engines || workaround.engines.includes(engineId);
      const row = ran?.workarounds.find((w) => w.id === id) ?? null;
      return {
        source,
        engineId,
        inScope,
        engine: ran ? compatEngineLabel(ran) : null,
        row,
        message: ran
          ? row
            ? null
            : "this run's verdict has no such workaround"
          : message,
      };
    });
    const inScope = engines.filter((e) => e.inScope);
    return {
      id,
      workaround,
      polyfill,
      engines,
      everywhere:
        inScope.length > 0 &&
        inScope.every((e) => e.row?.state === "removable") &&
        engines.every((e) => e.row?.state !== "still-needed"),
    };
  });
}

/**
 * The groups every compat source in their scope reports removable, in script order.
 * @param {Record<string, Verdict | null>} verdicts
 * @returns {CompatState[]}
 */
export function removableEverywhere(verdicts) {
  return compatStates(verdicts).filter((state) => state.everywhere);
}

/** @param {EngineState} e */
function engineStateText(e) {
  if (!e.row) return `no verdict (${e.message})`;
  if (e.row.state === "still-needed") {
    return `still needed (${e.row.failing} of ${e.row.probes} probes fail)`;
  }
  return e.row.state.replace(/-/g, " ");
}

/** @param {EngineState} e */
function engineProbesText(e) {
  return e.row
    ? `${e.row.probes - e.row.failing} of ${e.row.probes} pass`
    : "—";
}

/** @param {CompatCheckVerdict | null} check  the Node check, when it ran */
function snapshotSentence(check) {
  if (check === null) {
    return "pnpm compat:snapshot is due in the removal PR: the Node check did not run this time, so whether the committed apps/dox/src/data/temporal-compat.json is current is unknown. Once the group's repros are deleted, run it and commit the file; validate (snapshot --check) fails until you do.";
  }
  return check.snapshot.current
    ? "pnpm compat:snapshot is due in the removal PR: once the group's repros are deleted, run it and commit apps/dox/src/data/temporal-compat.json; validate (snapshot --check) fails until you do."
    : "pnpm compat:snapshot is due now: the committed apps/dox/src/data/temporal-compat.json no longer matches this run's probes. Run it again in the removal PR after deleting the repros.";
}

/**
 * @param {CompatState} state
 * @param {CompatCheckVerdict | null} check  the Node check, when it ran
 * @param {boolean} isForced
 * @param {string} runUrl
 * @returns {Finding}
 */
function removableFinding(state, check, isForced, runUrl) {
  const { id, workaround: w, polyfill, engines } = state;
  const inScope = engines.filter((e) => e.inScope);
  const scopeLabels = inScope.map((e) => e.engine ?? e.source).join(", ");
  const opening = isForced
    ? `Forced removable for a dry run. Real state on this run: ${inScope
        .map((e) => `${engineStateText(e)} on ${e.engine ?? e.source}`)
        .join("; ")}.`
    : `Every probe for **${id}** returns the spec value on @js-temporal/polyfill ${polyfill} on every engine in its scope (${scopeLabels}), so the workaround can go.`;
  const scope = w.engines
    ? `only ${w.engines.join(", ")}: only that engine's Intl shows the defect, so the other rows are out of scope and count for nothing`
    : "every engine";
  const paragraphs = [
    opening,
    `**Trigger:** ${w.trigger}`,
    `**Scope:** ${scope}.`,
    `### Engines\n\n${table(
      ["Source", "Engine", "State", "Probes"],
      engines.map((e) => [
        cell(e.source),
        cell(e.engine ?? "—"),
        cell(engineStateText(e)),
        cell(engineProbesText(e)),
      ]),
    )}`,
  ];
  const lapsed = inScope.find((e) => e.row?.guard?.lapsed)?.row?.guard;
  if (lapsed) {
    paragraphs.push(
      `**Guard lapsed:** it held through ${lapsed.package} ${lapsed.through} (${lapsed.reason.replace(/\.$/, "")}). Before removing, confirm the installed release is the trigger; if it is not, raise guard.through to it and close this issue.`,
    );
  }
  const steps = [...w.steps, FLOOR_STEP];
  paragraphs.push(
    `### Removal steps\n\n${steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}`,
    `### Snapshot\n\n${snapshotSentence(check)}`,
    "A person removes the workaround; CI opens issues, never pull requests.",
  );
  const comment = isForced
    ? `${opening}\n\n${snapshotSentence(check)}`
    : `Still removable on this run on every engine in its scope (${scopeLabels}; @js-temporal/polyfill ${polyfill}).\n\n${snapshotSentence(check)}`;
  /** @type {Finding} */
  const real = {
    key: `temporal-compat/removable/${id}`,
    title: `Remove workaround ${id}: ${summaryOf(w)}`,
    labels: [CANARY_LABEL],
    body: withRun(paragraphs.join("\n\n"), runUrl),
    comment: withRun(comment, runUrl),
  };
  if (!isForced) return real;
  return dryRun(real, `--force-removable=${id}`, paragraphs, runUrl);
}

/**
 * @param {OracleVerdict} oracle
 * @param {boolean} isForced
 * @param {string} runUrl
 * @returns {Finding}
 */
function mismatchFinding(oracle, isForced, runUrl) {
  const { counts } = oracle;
  const groups = isForced
    ? [{ key: "dry-run iso8601 forced", count: 1, example: FORCED_ROW }]
    : oracle.untaggedGroups;
  const rows = isForced ? [FORCED_ROW] : oracle.untagged;
  const shownGroups = groups.slice(0, UNTAGGED_GROUPS_IN_BODY);
  const groupsTruncated = groups.length > shownGroups.length;
  const groupsHeading = groupsTruncated
    ? `### Groups (first ${shownGroups.length} of ${groups.length})`
    : "### Groups";
  const groupsTable = table(
    ["Scan, calendar, op", "Rows", "Example"],
    shownGroups.map((g) => [
      cell(g.key),
      cell(g.count),
      exampleCell(g.example),
    ]),
  );
  const rowsHeading =
    !isForced && oracle.untaggedTruncated
      ? `### Rows (first ${rows.length} of ${counts.untagged})`
      : "### Rows";
  const rowsTable = table(
    [
      "scan",
      "calendar",
      "op",
      "row",
      "iso",
      "input",
      "native",
      "expected",
      "gmt",
    ],
    rows.map((r) => [
      cell(r.scan),
      cell(r.calendar),
      cell(r.op),
      cell(r.row),
      codeCell(r.iso),
      codeCell(r.input),
      codeCell(r.native),
      codeCell(r.expected),
      codeCell(r.gmt),
    ]),
  );
  const forcedOpening = `Forced mismatch for a dry run. Real counts on this run: ${counts.untagged} untagged of ${counts.comparisons} comparisons.`;
  const opening = isForced
    ? forcedOpening
    : `${counts.untagged} of ${counts.comparisons} comparisons differ from Chromium ${oracle.chromium}'s native Temporal and no entry in TAGGED_MISMATCHES explains them. Each is a GMT bug unless test262 disagrees with Chromium; then tag it with its test262 file.`;
  const paragraphs = [
    opening,
    runtimeLine(oracle.runtime, oracle.chromium),
    `${groupsHeading}\n\n${groupsTable}`,
    `${rowsHeading}\n\n${rowsTable}`,
  ];
  if (!isForced) {
    paragraphs.push(`Full list: ${oracle.report} in the run's artifact.`);
  }
  const body = withRun(paragraphs.join("\n\n"), runUrl);
  const seen = isForced
    ? forcedOpening
    : `Seen again on this run: ${counts.untagged} untagged.`;
  const commentGroups = groupsTruncated
    ? `${groupsHeading}\n\n${groupsTable}`
    : groupsTable;
  const comment = withRun(`${seen}\n\n${commentGroups}`, runUrl);
  /** @type {Finding} */
  const real = {
    key: "temporal-oracle/untagged-mismatch",
    title: "Oracle: GMT differs from native Temporal on untagged rows",
    labels: [CANARY_LABEL, COMPAT_LABEL],
    body,
    comment,
  };
  if (!isForced) return real;
  return dryRun(real, "--force-mismatch", paragraphs, runUrl);
}

/**
 * "Node 26" or "Chromium 153" from a verdict's engine line; the leg name when the line has no
 * leading name and version.
 * @param {NativeSuiteVerdict} v
 */
function legLabel(v) {
  const m = /^(\w+) v?(\d+)/.exec(v.engine);
  return m ? `${m[1]} ${m[2]}` : v.leg;
}

/** GitHub's limit on an issue body or comment, in characters. */
const BODY_LIMIT = 65_536;
/** Room kept for the run line and the paragraphs around the tables. */
const BODY_MARGIN = 1_500;
const FILE_CELL_CHARS = 150;
const TEST_CELL_CHARS = 200;

/**
 * A value cut to `max` characters, with an ellipsis when it was cut.
 * @param {string} value
 * @param {number} max
 */
const clip = (value, max) =>
  value.length > max ? `${value.slice(0, max - 1)}…` : value;

/**
 * The largest row count (at most `maxRows`) whose parts, joined with blank lines and added to
 * `fixedChars` of surrounding text, fit in one issue body. Every part list is built by `build(k)`.
 * @param {number} maxRows
 * @param {number} fixedChars
 * @param {(k: number) => string[]} build
 * @returns {{ k: number, parts: string[] }}
 */
function fitRows(maxRows, fixedChars, build) {
  for (let k = maxRows; k > 1; k--) {
    const parts = build(k);
    if (fixedChars + parts.join("\n\n").length + BODY_MARGIN <= BODY_LIMIT)
      return { k, parts };
  }
  return { k: 1, parts: build(1) };
}

/**
 * One `### <engine line>` section per leg: the failures as a table, with the "first N of M"
 * heading when the verdict, or the size of the body, cut them. Test and file cells are code spans,
 * so a name with `@user` or `#35` in it is not a mention or a link, and are cut to a fixed length.
 * Every leg shows the same number of rows, the most that fit in one body together with the
 * `fixedChars` of text around the sections.
 * @param {NativeSuiteVerdict[]} legs
 * @param {(leg: NativeSuiteVerdict) => NativeFailure[]} rowsOf  the rows to table
 * @param {(leg: NativeSuiteVerdict) => number} totalOf  how many the leg really has
 * @param {number} fixedChars  length of the text that goes in the body besides the sections
 * @returns {string[]}
 */
function failureSections(legs, rowsOf, totalOf, fixedChars) {
  const maxRows = Math.max(1, ...legs.map((v) => rowsOf(v).length));
  return fitRows(maxRows, fixedChars, (k) =>
    legs.map((v) => {
      const rows = rowsOf(v).slice(0, k);
      const total = totalOf(v);
      const heading =
        total > rows.length
          ? `### ${v.engine} (first ${rows.length} of ${total})`
          : `### ${v.engine}`;
      return `${heading}\n\n${table(
        ["file", "test", "message"],
        rows.map((r) => [
          codeCell(clip(r.file, FILE_CELL_CHARS)),
          codeCell(clip(r.test, TEST_CELL_CHARS)),
          codeCell(r.message),
        ]),
      )}`;
    }),
  ).parts;
}

/**
 * Tests that fail on the native engine and pass on the polyfill and have no tag. A forced run
 * shows one synthetic row on the forced leg instead of its real rows.
 * @param {NativeSuiteVerdict[]} ranLegs  the native legs that ran, in leg order
 * @param {boolean} isForced
 * @param {string} runUrl
 * @returns {Finding}
 */
function nativeFailureFinding(ranLegs, isForced, runUrl) {
  const legs = isForced
    ? ranLegs.filter((v) => v.forced).slice(0, 1)
    : ranLegs.filter((v) => v.counts.untagged > 0);
  const sections = failureSections(
    legs,
    (v) => (isForced ? [FORCED_NATIVE_ROW] : v.untagged),
    (v) => (isForced ? 1 : v.counts.untagged),
    TRIAGE_PARAGRAPH.length,
  );
  const paragraphs = [...sections, TRIAGE_PARAGRAPH];
  /** @type {Finding} */
  const real = {
    key: "native-suite/untagged-failure",
    title: `Native Temporal: GMT tests fail on ${legs.map(legLabel).join(", ")}`,
    labels: [CANARY_LABEL, COMPAT_LABEL],
    body: withRun(paragraphs.join("\n\n"), runUrl),
    comment: withRun(sections.join("\n\n"), runUrl),
  };
  if (!isForced) return real;
  return dryRun(real, "--force-native-failure", paragraphs, runUrl);
}

/**
 * Tests that fail on the native engine and on the polyfill in the same runtime, with no group.
 * @param {NativeSuiteVerdict[]} ranLegs
 * @param {string} runUrl
 * @returns {Finding}
 */
function nativeHostFailureFinding(ranLegs, runUrl) {
  const legs = ranLegs.filter((v) => v.counts.hostUntagged > 0);
  const sections = failureSections(
    legs,
    (v) => v.hostUntagged,
    (v) => v.counts.hostUntagged,
    HOST_PARAGRAPH.length,
  );
  return {
    key: "native-suite/untagged-host-failure",
    title: `Native suite: tests fail on both engines in ${legs.map(legLabel).join(", ")}`,
    labels: [CANARY_LABEL],
    body: withRun([...sections, HOST_PARAGRAPH].join("\n\n"), runUrl),
    comment: withRun(sections.join("\n\n"), runUrl),
  };
}

/**
 * Tests that fail on the polyfill and pass on the native engine in the same runtime.
 * @param {NativeSuiteVerdict[]} ranLegs
 * @param {string} runUrl
 * @returns {Finding}
 */
function nativeControlOnlyFinding(ranLegs, runUrl) {
  const legs = ranLegs.filter((v) => v.counts.controlOnly > 0);
  const sections = failureSections(
    legs,
    (v) => v.controlOnly,
    (v) => v.counts.controlOnly,
    CONTROL_PARAGRAPH.length,
  );
  return {
    key: "native-suite/control-only-failure",
    title: `Native suite: tests fail only on the polyfill in ${legs.map(legLabel).join(", ")}`,
    labels: [CANARY_LABEL, COMPAT_LABEL],
    body: withRun([...sections, CONTROL_PARAGRAPH].join("\n\n"), runUrl),
    comment: withRun(sections.join("\n\n"), runUrl),
  };
}

/**
 * Known-failure tags that no longer apply.
 * @param {NativeSuiteVerdict[]} ranLegs
 * @param {string} runUrl
 * @returns {Finding}
 */
function nativeStaleTagFinding(ranLegs, runUrl) {
  /** @type {{ leg: string, file: string, test: string, defect: string }[]} */
  const divergence = [];
  /** @type {{ leg: string, group: string, reason: string }[]} */
  const host = [];
  for (const v of ranLegs) {
    for (const tag of v.staleTags) {
      if (tag.kind === "divergence") divergence.push({ leg: v.leg, ...tag });
      else host.push({ leg: v.leg, group: tag.group, reason: tag.reason });
    }
  }
  /** @type {string[]} */
  const steps = [];
  if (divergence.length > 0) {
    steps.push(
      "Remove each row from KNOWN_NATIVE_FAILURES and update its record in context/domination/js-temporal-polyfill-bugs.md.",
    );
  }
  if (host.length > 0) {
    steps.push(
      "Remove the group from KNOWN_HOST_FAILURES, or narrow its legs.",
    );
  }
  /** @param {number} n @param {number} total @param {string} title */
  const heading = (title, n, total) =>
    total > n ? `### ${title} (first ${n} of ${total})` : `### ${title}`;
  const { parts: tables } = fitRows(
    Math.max(divergence.length, host.length, 1),
    steps.join("\n\n").length,
    (k) => [
      ...(divergence.length > 0
        ? [
            `${heading("Divergence rows", Math.min(k, divergence.length), divergence.length)}\n\n${table(
              ["leg", "file", "test", "defect"],
              divergence
                .slice(0, k)
                .map((t) => [
                  cell(t.leg),
                  codeCell(clip(t.file, FILE_CELL_CHARS)),
                  codeCell(clip(t.test, TEST_CELL_CHARS)),
                  cell(t.defect),
                ]),
            )}`,
          ]
        : []),
      ...(host.length > 0
        ? [
            `${heading("Host groups", Math.min(k, host.length), host.length)}\n\n${table(
              ["leg", "group", "reason"],
              host
                .slice(0, k)
                .map((t) => [cell(t.leg), cell(t.group), cell(t.reason)]),
            )}`,
          ]
        : []),
    ],
  );
  return {
    key: "native-suite/stale-tag",
    title: "Native suite: known failures no longer fail",
    labels: [CANARY_LABEL],
    body: withRun([...tables, ...steps].join("\n\n"), runUrl),
    comment: withRun(tables.join("\n\n"), runUrl),
  };
}

/**
 * @param {LeapSecondsVerdict} leap
 * @param {boolean} isForced
 * @param {string} runUrl
 * @returns {Finding}
 */
function leapFinding(leap, isForced, runUrl) {
  const header = leap.header ?? 'no "Updated through" line';
  const differences = isForced ? [FORCED_LEAP_LINE] : leap.differences;
  const list = differences.map((d) => `- ${d}`).join("\n");
  const url = leap.from === LEAP_IANA ? LEAP_IANA_URL : LEAP_IERS_URL;
  const paragraphs = [
    `packages/gmt/src/internal/leapSeconds.ts no longer matches ${leap.from} (${url}).`,
    `**IERS:** ${header}`,
    `### Differences\n\n${list}`,
    "A new row is a data edit in leapSeconds.ts plus a patch changeset; leapSeconds.test.ts checks the edit.",
  ];
  const comment = withRun(
    `Still differs on this run (${header}):\n\n${list}`,
    runUrl,
  );
  /** @type {Finding} */
  const real = {
    key: "leap-seconds/table-difference",
    title: "Leap-second table differs from the IERS table",
    labels: [CANARY_LABEL],
    body: withRun(paragraphs.join("\n\n"), runUrl),
    comment,
  };
  if (!isForced) return real;
  return dryRun(real, "--force-leap-difference", paragraphs, runUrl);
}

/**
 * @param {Context["workflow"]} workflow
 * @param {{ source: string, message: string }[]} failed
 * @param {string} runUrl
 * @returns {Finding}
 */
function couldNotRunFinding(workflow, failed, runUrl) {
  const list = failed.map((f) => `- **${f.source}**: ${f.message}`).join("\n");
  return {
    key: `${workflow}/could-not-run`,
    title: `Canary ${workflow} could not run`,
    labels: [CANARY_LABEL],
    body: withRun(
      `${list}\n\nThis canary reported nothing on this run; the run log says why.`,
      runUrl,
    ),
    comment: withRun(list, runUrl),
  };
}

/**
 * One finding per group removable on every engine in its scope, plus the forced one (the Node
 * check's `forced`), which shows the real per-engine states.
 * @param {Record<string, Verdict | null>} verdicts
 * @param {string} runUrl
 * @returns {Finding[]}
 */
function compatFindings(verdicts, runUrl) {
  const check = /** @type {CompatCheckVerdict | CouldNotRunVerdict | null} */ (
    verdictOf(verdicts, CHECK)
  );
  const checkRan = check?.status === "ran" ? check : null;
  const states = compatStates(verdicts);
  const out = states
    .filter((state) => state.everywhere)
    .map((state) => removableFinding(state, checkRan, false, runUrl));
  if (checkRan?.forced) {
    const state = states.find((x) => x.id === checkRan.forced?.removable);
    if (state) out.push(removableFinding(state, checkRan, true, runUrl));
  }
  return out;
}

/**
 * @param {Record<string, Verdict | null>} verdicts
 * @param {string} runUrl
 * @returns {Finding[]}
 */
function oracleFindings(verdicts, runUrl) {
  const oracle = /** @type {OracleVerdict | CouldNotRunVerdict | null} */ (
    verdictOf(verdicts, ORACLE)
  );
  if (oracle?.status !== "ran") return [];
  const out = [];
  if (oracle.counts.untagged > 0) {
    out.push(mismatchFinding(oracle, false, runUrl));
  }
  if (oracle.forced) out.push(mismatchFinding(oracle, true, runUrl));
  return out;
}

/**
 * @param {Record<string, Verdict | null>} verdicts
 * @param {string} runUrl
 * @returns {Finding[]}
 */
function nativeSuiteFindings(verdicts, runUrl) {
  const ranLegs = /** @type {NativeSuiteVerdict[]} */ (
    NATIVE_LEGS.map((leg) => verdictOf(verdicts, NATIVE(leg))).filter(
      (v) => v?.status === "ran",
    )
  );
  /** @type {[boolean, () => Finding][]} */
  const candidates = [
    [
      ranLegs.some((v) => v.counts.untagged > 0),
      () => nativeFailureFinding(ranLegs, false, runUrl),
    ],
    [
      ranLegs.some((v) => v.forced),
      () => nativeFailureFinding(ranLegs, true, runUrl),
    ],
    [
      ranLegs.some((v) => v.counts.hostUntagged > 0),
      () => nativeHostFailureFinding(ranLegs, runUrl),
    ],
    [
      ranLegs.some((v) => v.counts.controlOnly > 0),
      () => nativeControlOnlyFinding(ranLegs, runUrl),
    ],
    [
      ranLegs.some((v) => v.staleTags.length > 0),
      () => nativeStaleTagFinding(ranLegs, runUrl),
    ],
  ];
  return candidates.filter(([applies]) => applies).map(([, make]) => make());
}

/**
 * @param {Record<string, Verdict | null>} verdicts
 * @param {string} runUrl
 * @returns {Finding[]}
 */
function leapSecondsFindings(verdicts, runUrl) {
  const leap = /** @type {LeapSecondsVerdict | CouldNotRunVerdict | null} */ (
    verdictOf(verdicts, LEAP)
  );
  if (leap?.status !== "ran") return [];
  const out = [];
  if (leap.differences.length > 0) out.push(leapFinding(leap, false, runUrl));
  if (leap.forced) out.push(leapFinding(leap, true, runUrl));
  return out;
}

/**
 * CORE-92: whether the `temporal-polyfill` swap passed on every runtime. Ready only when all four
 * legs ran, name one version, have no test that fails on the swap and passes on the control, and
 * the Node leg's offset sweep ran and found no differing zone. Fail closed: each leg must say its
 * swap pass loaded `temporal-polyfill` (`entryLoaded: true`), and `counts.failed` and
 * `differingZones` must be the number 0, so a missing or malformed field blocks. Otherwise the
 * reason names the first condition that failed, in that order.
 * @param {Record<string, Verdict | null | undefined>} verdicts
 * @returns {{ ready: true, version: string } | { ready: false, reason: string }}
 */
export function swapReady(verdicts) {
  const legs = SWAP_SOURCES.map((source) => ({
    source,
    verdict: /** @type {SwapVerdict | CouldNotRunVerdict | null} */ (
      verdictOf(verdicts, source)
    ),
  }));
  /** @type {SwapVerdict[]} */
  const ran = [];
  for (const { source, verdict } of legs) {
    if (verdict?.status !== "ran") {
      return { ready: false, reason: `${source}: did not run` };
    }
    ran.push(/** @type {SwapVerdict} */ (verdict));
  }
  const versions = [...new Set(ran.map((v) => v.version))];
  if (versions.length > 1) {
    return {
      ready: false,
      reason: `legs ran different versions: ${versions.join(", ")}`,
    };
  }
  for (const v of ran) {
    if (v.entryLoaded !== true) {
      return {
        ready: false,
        reason: `${v.source}: the swap pass did not load temporal-polyfill`,
      };
    }
  }
  // Fail closed: anything but a counted zero blocks, so a verdict that lost a field never passes.
  for (const v of ran) {
    const n = v.counts?.failed;
    if (n !== 0) {
      return {
        ready: false,
        reason:
          Number.isInteger(n) && /** @type {number} */ (n) > 0
            ? `${v.source}: ${n} ${n === 1 ? "test fails" : "tests fail"} on the swap`
            : `${v.source}: the failed count is missing`,
      };
    }
  }
  const sweep = ran[0]?.sweep;
  if (sweep?.status !== "ran") {
    return { ready: false, reason: "offset sweep: did not run" };
  }
  const n = sweep.differingZones;
  if (n !== 0) {
    return {
      ready: false,
      reason:
        Number.isInteger(n) && n > 0
          ? `offset sweep: ${n} ${n === 1 ? "zone differs" : "zones differ"}`
          : "offset sweep: the differing zone count is missing",
    };
  }
  return { ready: true, version: /** @type {string} */ (versions[0]) };
}

/**
 * "Chromium 153.0.8010.12" for a browser leg (Playwright's `chromium 153…` capitalised), "Node
 * 26.12.1" for the Node leg.
 * @param {"node" | "chromium" | "firefox" | "webkit"} leg
 * @param {SwapVerdict} v
 */
function swapRuntimeName(leg, v) {
  if (leg === "node") return `Node ${v.runtime.node}`;
  const version = (v.runtime.browser ?? "").replace(/^\S+\s*/, "");
  return `${SWAP_LEG_NAMES[leg]} ${version}`.trim();
}

/**
 * The swap issue's paragraphs, built from whichever legs ran.
 * @param {Record<string, Verdict | null | undefined>} verdicts
 * @param {string} version
 * @param {string} runUrl
 * @returns {string[]}
 */
function swapParagraphs(verdicts, version, runUrl) {
  const rows = NATIVE_LEGS.map((leg) => {
    const v = verdictOf(verdicts, SWAP(leg));
    if (v?.status !== "ran") {
      return [SWAP_LEG_NAMES[leg], "did not run", "", "", ""];
    }
    const swap = /** @type {SwapVerdict} */ (v);
    const c = swap.counts;
    return [
      cell(swapRuntimeName(leg, swap)),
      String(c.tests),
      String(c.failed),
      String(c.both),
      String(c.fixed),
    ];
  });
  const node = verdictOf(verdicts, SWAP_NODE);
  const sweep =
    node?.status === "ran" ? /** @type {SwapVerdict} */ (node).sweep : null;
  let sweepLine = "Offset sweep: did not run.";
  if (sweep?.status === "ran") {
    const span = `from ${sweep.from} to ${sweep.through} (tz ${sweep.tz})`;
    sweepLine =
      sweep.differingZones === 0
        ? `Offset sweep: every one of ${sweep.zones} zones matches \`Intl.DateTimeFormat\` at 12:00 UTC each day ${span}.`
        : `Offset sweep: ${sweep.differingZones} of ${sweep.zones} zones differ from \`Intl.DateTimeFormat\` at 12:00 UTC on some day ${span}.`;
  }
  return [
    `temporal-polyfill ${version}, imported from \`temporal-polyfill/full/implementation\`, passed every check on this run: ${runUrl}`,
    table(
      [
        "Runtime",
        "Tests",
        "Fail on swap only",
        "Fail on both",
        "Fail only on @js-temporal/polyfill",
      ],
      rows,
    ),
    sweepLine,
    `What the swap involves is in [temporal-polyfill-swap.md § 5 and § 7](${SWAP_RESEARCH_URL}). Type errors are not checked here; § 5 lists them.`,
    "A person makes the swap. CI opens issues, never pull requests.",
  ];
}

/**
 * The swap issue, or its dry-run twin when a leg was forced. Nothing for a run that ran but is not
 * swap-ready.
 * @param {Record<string, Verdict | null>} verdicts
 * @param {string} runUrl
 * @returns {Finding[]}
 */
function swapFindings(verdicts, runUrl) {
  const result = swapReady(verdicts);
  const forcedBy = NATIVE_LEGS.some(
    (leg) => /** @type {any} */ (verdictOf(verdicts, SWAP(leg)))?.forced,
  );
  if (!result.ready && !forcedBy) return [];
  const firstRan = /** @type {SwapVerdict | undefined} */ (
    NATIVE_LEGS.map((leg) => verdictOf(verdicts, SWAP(leg))).find(
      (v) => v?.status === "ran",
    )
  );
  const version = result.ready ? result.version : (firstRan?.version ?? "");
  const paragraphs = swapParagraphs(verdicts, version, runUrl);
  const comment = `temporal-polyfill ${version} also passes (run ${runUrl}).\n\n${paragraphs.join("\n\n")}`;
  /** @type {Finding} */
  const real = {
    key: "temporal-polyfill-swap/ready",
    title: `Swap to temporal-polyfill ${version}: it passes the GMT suite and the offset sweep`,
    labels: [CANARY_LABEL],
    body: paragraphs.join("\n\n"),
    comment,
  };
  /** @type {Finding[]} */
  const out = result.ready ? [real] : [];
  if (forcedBy) {
    const outcome = result.ready ? "every check passed" : result.reason;
    out.push(
      dryRun(
        real,
        "--force-swap-ready",
        [
          `Forced for a dry run. Real result on this run: ${outcome}.`,
          ...paragraphs,
        ],
        runUrl,
      ),
    );
  }
  return out;
}

/**
 * A swap leg that ran but whose swap pass did not load `temporal-polyfill` (`entryLoaded` is not
 * `true`) tested the wrong Temporal, so it counts as a leg that could not run. The Node leg's
 * offset sweep that could not run is listed too: it is part of that leg's check.
 * @param {Record<string, Verdict | null>} verdicts
 * @returns {{ source: string, message: string }[]}
 */
function swapSweepFailures(verdicts) {
  /** @type {{ source: string, message: string }[]} */
  const out = [];
  for (const source of SWAP_SOURCES) {
    const leg = /** @type {SwapVerdict | null} */ (
      /** @type {unknown} */ (verdictOf(verdicts, source))
    );
    if (leg?.status === "ran" && leg.entryLoaded !== true) {
      out.push({ source, message: "swap entry not loaded" });
    }
  }
  const node = /** @type {SwapVerdict | null} */ (
    /** @type {unknown} */ (verdictOf(verdicts, SWAP_NODE))
  );
  if (node?.status === "ran" && node.sweep?.status === "could-not-run") {
    out.push({
      source: SWAP_NODE,
      message: `offset sweep: ${/** @type {{ message: string }} */ (node.sweep).message}`,
    });
  }
  return out;
}

/**
 * The sources with no verdict or a could-not-run one, with the reason for each.
 * @param {Record<string, Verdict | null>} verdicts
 * @param {string[]} sources
 * @returns {{ source: string, message: string }[]}
 */
function failedSources(verdicts, sources) {
  const failed = [];
  for (const source of sources) {
    const verdict = verdictOf(verdicts, source);
    if (verdict === null) {
      failed.push({ source, message: NO_VERDICT });
    } else if (verdict.status === "could-not-run") {
      failed.push({
        source,
        message: /** @type {CouldNotRunVerdict} */ (verdict).message,
      });
    }
  }
  return failed;
}

/**
 * Findings in order: removable on every engine in scope (script order), mismatch, native
 * (untagged failure, host failure, stale tag), leap, could-not-run. A forced finding
 * follows the real one of its kind.
 * @param {Record<string, Verdict | null>} verdicts  after `applyForce`
 * @param {Context} context
 * @returns {Finding[]}
 */
export function findings(verdicts, context) {
  const { workflow, runUrl } = context;
  const sources = WORKFLOW_SOURCES[workflow];
  /** @type {[string, (v: Record<string, Verdict | null>, url: string) => Finding[]][]} */
  const perSource = [
    [CHECK, compatFindings],
    [ORACLE, oracleFindings],
    [NATIVE("node"), nativeSuiteFindings],
    [LEAP, leapSecondsFindings],
    [SWAP_NODE, swapFindings],
  ];
  const out = perSource.flatMap(([source, make]) =>
    sources.includes(source) ? make(verdicts, runUrl) : [],
  );
  const failed = failedSources(verdicts, sources);
  if (sources.includes(SWAP_NODE)) failed.push(...swapSweepFailures(verdicts));
  if (failed.length > 0) {
    out.push(couldNotRunFinding(workflow, failed, runUrl));
  }
  return out;
}

/**
 * An open issue matches a finding when it carries the `canary` label and the first line of its
 * body, trimmed, equals the finding's marker exactly. GitHub may store bodies with CRLF.
 * @param {{ number: number, body: string, labels: { name: string }[] }} issue
 * @param {string} key
 */
function matches(issue, key) {
  if (!issue.labels.some((l) => l.name === CANARY_LABEL)) return false;
  const first = (issue.body ?? "").split(/\r?\n/, 1)[0]?.trim();
  return first === marker(key);
}

/**
 * @param {Record<string, Verdict | null>} verdicts  after `applyForce`
 * @param {{ number: number, body: string, labels: { name: string }[] }[]} openIssues
 * @param {Context} context
 * @returns {Action[]}
 */
export function planIssueActions(verdicts, openIssues, context) {
  return findings(verdicts, context).map((finding) => {
    const found = openIssues
      .filter((issue) => matches(issue, finding.key))
      .sort((a, b) => a.number - b.number)[0];
    if (found) {
      return {
        kind: /** @type {const} */ ("comment"),
        key: finding.key,
        issue: found.number,
        body: finding.comment,
      };
    }
    return {
      kind: /** @type {const} */ ("open"),
      key: finding.key,
      title: finding.title,
      labels: finding.labels,
      body: `${marker(finding.key)}\n${finding.body}`,
    };
  });
}
