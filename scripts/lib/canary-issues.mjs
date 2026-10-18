/**
 * CORE-81: the pure decision behind the canary issues. Verdicts and the open issues go in; a list
 * of `open` / `comment` actions comes out. Nothing here reads a file, the network, the process or
 * the clock, so the whole rule set is tested offline (`apps/dox/scripts/canary/canary-issues.test.ts`).
 *
 * Every canary issue carries the label `canary` and, as its body's first line, a hidden marker
 * naming the finding's key. An open `canary` issue with that marker gets a comment; otherwise a new
 * issue opens. A finding keyed by what is wrong, not by the run, is what stops a weekly run from
 * opening a second issue for a problem that is still there.
 */

/** Label every canary issue carries. */
export const CANARY_LABEL = "canary";
/** Extra label on an issue a manual dispatch forced. */
export const DRY_RUN_LABEL = "canary-dry-run";
/** The verdict sources each workflow reads, in the order its could-not-run message lists them. */
export const WORKFLOW_SOURCES = {
  "temporal-oracle": ["temporal-compat-check", "temporal-oracle"],
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
const ORACLE = "temporal-oracle";
const LEAP = "leap-seconds";

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
 *   state: "still-needed" | "removable" | "guard",
 *   probes: number, failing: number, guard?: Guard, steps: string[],
 * }} Workaround
 * @typedef {{
 *   source: "temporal-compat-check", status: "ran", runtime: Runtime,
 *   counts: { workarounds: number, stillNeeded: number, removable: number, guard: number },
 *   snapshot: { path: string, current: boolean }, workarounds: Workaround[],
 *   forced?: { removable: string },
 * }} CompatCheckVerdict
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
 *   source: "leap-seconds", status: "ran", header: string | null,
 *   rows: { gmt: number, iers: number }, differences: string[],
 *   forced?: { difference: true },
 * }} LeapSecondsVerdict
 * @typedef {{ source: string, status: "could-not-run", message: string }} CouldNotRunVerdict
 * @typedef {CompatCheckVerdict | OracleVerdict | LeapSecondsVerdict | CouldNotRunVerdict} Verdict
 * @typedef {{ removable?: string, mismatch?: boolean, leapDifference?: boolean }} Force
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
  if (force.removable !== undefined) {
    const flag = `--force-removable=${force.removable}`;
    const verdict = ran(flag, CHECK);
    if (verdict) {
      const ids = verdict.workarounds.map(
        (/** @type {Workaround} */ w) => w.id,
      );
      if (!ids.includes(force.removable)) {
        throw new Error(
          `${flag}: no workaround has that id; valid ids: ${ids.join(", ")}`,
        );
      }
      verdict.forced = { removable: force.removable };
    }
  }
  if (force.mismatch) {
    const verdict = ran("--force-mismatch", ORACLE);
    if (verdict) verdict.forced = { mismatch: true };
  }
  if (force.leapDifference) {
    const verdict = ran("--force-leap-difference", LEAP);
    if (verdict) verdict.forced = { difference: true };
  }
  return { verdicts: copy, skipped };
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

/** @param {Workaround} w */
function realStateText(w) {
  if (w.state === "still-needed") {
    return `still needed (${w.failing} of ${w.probes} probes fail)`;
  }
  return w.state;
}

/** @param {CompatCheckVerdict} check */
function snapshotSentence(check) {
  return check.snapshot.current
    ? "pnpm compat:snapshot is due in the removal PR: once the group's repros are deleted, run it and commit apps/dox/src/data/temporal-compat.json; validate (snapshot --check) fails until you do."
    : "pnpm compat:snapshot is due now: the committed apps/dox/src/data/temporal-compat.json no longer matches this run's probes. Run it again in the removal PR after deleting the repros.";
}

/**
 * @param {CompatCheckVerdict} check
 * @param {Workaround} w
 * @param {boolean} isForced
 * @param {string} runUrl
 * @returns {Finding}
 */
function removableFinding(check, w, isForced, runUrl) {
  const rt = check.runtime;
  const opening = isForced
    ? `Forced removable for a dry run. Real state on this run: ${realStateText(w)}.`
    : `Every probe for **${w.id}** returns the spec value on @js-temporal/polyfill ${rt.polyfill} (Node ${rt.node}, ICU ${rt.icu}), so the workaround can go.`;
  const paragraphs = [
    opening,
    `**Trigger:** ${w.trigger}`,
    `**Probes:** ${w.probes - w.failing} of ${w.probes} pass.`,
  ];
  if (w.guard?.lapsed) {
    paragraphs.push(
      `**Guard lapsed:** it held through ${w.guard.package} ${w.guard.through} (${w.guard.reason.replace(/\.$/, "")}). Before removing, confirm the installed release is the trigger; if it is not, raise guard.through to it and close this issue.`,
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
    : `Still removable on this run (@js-temporal/polyfill ${rt.polyfill}, Node ${rt.node}, ICU ${rt.icu}).\n\n${snapshotSentence(check)}`;
  /** @type {Finding} */
  const real = {
    key: `temporal-compat/removable/${w.id}`,
    title: `Remove workaround ${w.id}: ${summaryOf(w)}`,
    labels: [CANARY_LABEL],
    body: withRun(paragraphs.join("\n\n"), runUrl),
    comment: withRun(comment, runUrl),
  };
  if (!isForced) return real;
  return dryRun(real, `--force-removable=${w.id}`, paragraphs, runUrl);
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
    labels: [CANARY_LABEL, "bug"],
    body,
    comment,
  };
  if (!isForced) return real;
  return dryRun(real, "--force-mismatch", paragraphs, runUrl);
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
  const paragraphs = [
    "packages/gmt/src/internal/leapSeconds.ts no longer matches IERS Leap_Second.dat (https://hpiers.obspm.fr/iers/bul/bulc/Leap_Second.dat).",
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
    title: "Leap-second table differs from IERS Leap_Second.dat",
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
 * Findings in order: removable (script order), mismatch, leap, could-not-run. A forced finding
 * follows the real one of its kind.
 * @param {Record<string, Verdict | null>} verdicts  after `applyForce`
 * @param {Context} context
 * @returns {Finding[]}
 */
export function findings(verdicts, context) {
  const { workflow, runUrl } = context;
  const sources = WORKFLOW_SOURCES[workflow];
  /** @type {Finding[]} */
  const out = [];

  if (sources.includes(CHECK)) {
    const check =
      /** @type {CompatCheckVerdict | CouldNotRunVerdict | null} */ (
        verdictOf(verdicts, CHECK)
      );
    if (check?.status === "ran") {
      for (const w of check.workarounds) {
        if (w.state === "removable") {
          out.push(removableFinding(check, w, false, runUrl));
        }
      }
      if (check.forced) {
        const w = check.workarounds.find(
          (x) => x.id === check.forced?.removable,
        );
        if (w) out.push(removableFinding(check, w, true, runUrl));
      }
    }
  }

  if (sources.includes(ORACLE)) {
    const oracle = /** @type {OracleVerdict | CouldNotRunVerdict | null} */ (
      verdictOf(verdicts, ORACLE)
    );
    if (oracle?.status === "ran") {
      if (oracle.counts.untagged > 0) {
        out.push(mismatchFinding(oracle, false, runUrl));
      }
      if (oracle.forced) out.push(mismatchFinding(oracle, true, runUrl));
    }
  }

  if (sources.includes(LEAP)) {
    const leap = /** @type {LeapSecondsVerdict | CouldNotRunVerdict | null} */ (
      verdictOf(verdicts, LEAP)
    );
    if (leap?.status === "ran") {
      if (leap.differences.length > 0) {
        out.push(leapFinding(leap, false, runUrl));
      }
      if (leap.forced) out.push(leapFinding(leap, true, runUrl));
    }
  }

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
