/**
 * The pure decision behind the nightly gate issues. The summaries the sweep legs wrote and the
 * open `dox-gate` issues go in; a list of `open` / `comment` actions comes out. Nothing here reads
 * a file, the network, the process or the clock, so the whole rule set is tested offline
 * (`issue-plan.test.ts`). It is modelled on `scripts/lib/canary-issues.mjs`; the `gh` shell is
 * `file-issues.mjs`.
 *
 * One open issue per finding key. The key is `<gate>:<rule>:<page>:<selector>`, with the selector
 * trimmed and its whitespace collapsed; browsers, widths and themes are not in it, so one issue
 * lists every place the finding was seen. Only `FAIL` rows file: `FLAKY` is listed in the step
 * summary (`flakyRows`) and never filed. A leg with no readable `summary.json` is sorted by its
 * sweep job (`missingSummary`): one whose `SUMMARY_STEP` passed wrote the file and lost it on the
 * way, and joins the one `dox-gate:not-uploaded:all:` issue; any other files
 * `dox-gate:could-not-run:<leg>`. A `FAIL` row with no structured finding files
 * `<gate>:unstructured:all:` with its log tail. A run that would open more than `FLOOD_LIMIT` new
 * issues opens none and files one `dox-gate:flood` issue listing them, because that many at
 * once is one systemic cause for a person to triage.
 */

/** Label every nightly gate issue carries, and the one the open-issue query filters on. */
export const GATE_LABEL = "dox-gate";
/** Label of the issue a dry run files, in place of `bug`. */
export const DRY_RUN_LABEL = "dox-gate-dry-run";
/** The other label a real finding carries. */
export const BUG_LABEL = "bug";
/** GitHub issue type of every nightly gate issue. */
export const ISSUE_TYPE = "Bug";
/** More new issues than this in one run become the single flood issue. */
export const FLOOD_LIMIT = 10;
/** The key of the flood issue. */
export const FLOOD_KEY = "dox-gate:flood";
/** The synthetic finding a dry run files. */
export const DRY_RUN_KEY = "dry-run:synthetic:/:body";

/**
 * Names in `.github/workflows/dox-gates-nightly.yml` that the report reads or points at. A test
 * checks the workflow still has each one.
 */
/** The leg step that passes only when the runner left a readable summary.json. */
export const SUMMARY_STEP = "Check the summary was written";
/** The leg step that uploads the summary. */
export const UPLOAD_STEP = "Upload the findings";
/** The report step that downloads every leg's summary. */
export const DOWNLOAD_STEP = "Download the findings";
/** The key of the one issue for every leg whose summary was written but never reached the report. */
export const NOT_UPLOADED_KEY = "dox-gate:not-uploaded:all:";

/** Rows a body or comment tables, so a sweep-wide failure cannot push a body past GitHub's limit. */
const TABLE_ROWS = 40;
const MESSAGE_CHARS = 600;
const LOG_LINES = 10;

/**
 * @typedef {{
 *   kind?: string, gate: string, rule: string, page: string, selector?: string,
 *   browser?: string, width?: number, theme?: string | null, message?: string,
 * }} Finding
 * @typedef {{
 *   id: string, status: string, detail?: string, findings?: Finding[], logTail?: string[],
 * }} Row
 * @typedef {{ status: string, rows: Row[] }} Summary
 * @typedef {{ name: string, conclusion: string | null }} Step
 * @typedef {{ conclusion: string | null, steps: Step[] }} Job
 * @typedef {{ leg: string, summary: Summary | null, job?: Job | null }} LegSummary
 *   `summary` null: no readable `summary.json` reached the report. `job` is the leg's sweep job
 *   from the run's job list; absent or null when that list could not be read or lacks the leg.
 * @typedef {{ number: number, body: string, labels: { name: string }[] }} OpenIssue
 * @typedef {{ runUrl: string, sha: string, dryRun?: boolean }} Context
 * @typedef {{ kind: "open", key: string, title: string, labels: string[], body: string }
 *   | { kind: "comment", key: string, issue: number, body: string }} Action
 * @typedef {{ key: string, title: string, labels: string[], body: string, comment: string }} Planned
 */

/** Collapses every run of whitespace to one space and trims. */
export function collapse(text) {
  return String(text ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The key of a structured finding.
 * @param {Finding} f
 */
export function keyOf(f) {
  return `${f.gate}:${f.rule}:${f.page}:${collapse(f.selector)}`;
}

/**
 * The hidden first line of a gate issue body. A key can hold `"`, `>` and `--` (a CSS selector
 * does), none of which may sit in an HTML comment attribute unescaped, so each is written as an
 * entity. The same function builds the line and the line it is matched against, so the escape never
 * needs undoing.
 * @param {string} key
 */
export function marker(key) {
  const safe = key
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/>/g, "&gt;")
    .replace(/--/g, "-&#45;");
  return `<!-- dox-gate key="${safe}" -->`;
}

/** GFM table cell: `|` escaped, line breaks turned into a space. */
function cell(value) {
  return String(value ?? "")
    .replace(/\|/g, "\\|")
    .replace(/\r\n?|\n/g, " ");
}

/** A table cell as a code span (a backtick cannot appear inside one, so it becomes `'`). */
function codeCell(value) {
  return `\`${cell(value).replace(/`/g, "'")}\``;
}

function table(header, rows) {
  const shown = rows.slice(0, TABLE_ROWS);
  const lines = [
    `| ${header.join(" | ")} |`,
    `| ${header.map(() => "---").join(" | ")} |`,
    ...shown.map((r) => `| ${r.join(" | ")} |`),
  ];
  if (rows.length > shown.length) {
    lines.push("", `(${rows.length - shown.length} more places not listed)`);
  }
  return lines.join("\n");
}

const browserOfLeg = (leg) => leg.split("-")[0];

/**
 * Why a leg's summary never reached the report. `SUMMARY_STEP` passing means the runner wrote it,
 * so the upload or the download lost it: that is `not-uploaded`. Anything else is `could-not-run`,
 * described by how the job ended and the first step that did not succeed.
 * @param {string} leg
 * @param {Job | null | undefined} job
 * @returns {{ key: string, rule: string, page: string, message: string }}
 */
export function missingSummary(leg, job) {
  if (
    job?.steps.some(
      (s) => s.name === SUMMARY_STEP && s.conclusion === "success",
    )
  ) {
    return {
      key: NOT_UPLOADED_KEY,
      rule: "not-uploaded",
      page: "all",
      message: `These legs ran and wrote summary.json, but no readable copy reached the report job, so their findings were not filed. The gates did not cause this: look at each leg's \`${UPLOAD_STEP}\` step, the report's \`${DOWNLOAD_STEP}\` step and the run's artifacts.`,
    };
  }
  let message;
  if (!job) {
    message = `No readable summary.json reached the report from the ${leg} leg, and the run's job list did not say how the leg ended. It may have crashed, timed out or been cancelled, or it may have run and lost its upload. Open the leg's log in the run.`;
  } else {
    const first = job.steps.find(
      (s) => s.conclusion !== "success" && s.conclusion !== "skipped",
    );
    const step = first
      ? `; the first step that did not succeed is \`${first.name}\` (\`${first.conclusion ?? "unfinished"}\`)`
      : "";
    message = `The ${leg} leg did not finish: its gates runner wrote no summary.json. Its job ended \`${job.conclusion ?? "unfinished"}\`${step}. Open the leg's log in the run.`;
  }
  return {
    key: `dox-gate:could-not-run:${leg}`,
    rule: "could-not-run",
    page: leg,
    message,
  };
}

/**
 * Every finding the legs reported, one entry per key, with every place it was seen.
 * @param {LegSummary[]} legs
 * @returns {{ key: string, gate: string, rule: string, page: string, selector: string,
 *   message: string, tail: string[], places: { leg: string, browser: string, width: string,
 *   theme: string }[] }[]}
 */
export function collect(legs) {
  /** @type {Map<string, any>} */
  const byKey = new Map();
  const add = (key, base, place) => {
    const entry = byKey.get(key) ?? { key, ...base, places: [] };
    if (
      !entry.places.some((p) =>
        Object.keys(place).every((k) => p[k] === place[k]),
      )
    ) {
      entry.places.push(place);
    }
    byKey.set(key, entry);
  };
  for (const { leg, summary, job } of legs) {
    if (!summary) {
      const { key, rule, page, message } = missingSummary(leg, job);
      add(
        key,
        { gate: "dox-gate", rule, page, selector: "", message, tail: [] },
        { leg, browser: browserOfLeg(leg), width: "", theme: "" },
      );
      continue;
    }
    for (const row of summary.rows ?? []) {
      if (row.status !== "FAIL") continue;
      const structured = (row.findings ?? []).filter((f) => f.rule && f.page);
      if (structured.length === 0) {
        add(
          `${row.id}:unstructured:all:`,
          {
            gate: row.id,
            rule: "unstructured",
            page: "all",
            selector: "",
            message: `The gate failed with no structured finding (${row.detail ?? "no detail"}).`,
            tail: row.logTail ?? [],
          },
          { leg, browser: browserOfLeg(leg), width: "", theme: "" },
        );
        continue;
      }
      for (const f of structured) {
        add(
          keyOf(f),
          {
            gate: f.gate ?? row.id,
            rule: f.rule,
            page: f.page,
            selector: collapse(f.selector),
            message: collapse(f.message).slice(0, MESSAGE_CHARS),
            tail: [],
          },
          {
            leg,
            browser: f.browser ?? browserOfLeg(leg),
            width: f.width === undefined ? "" : String(f.width),
            theme: f.theme ?? "",
          },
        );
      }
    }
  }
  return [...byKey.values()].sort((a, b) => a.key.localeCompare(b.key));
}

/**
 * The `FLAKY` rows (failed, passed on the retry), for the step summary. Never filed.
 * @param {LegSummary[]} legs
 * @returns {{ leg: string, gate: string, detail: string }[]}
 */
export function flakyRows(legs) {
  return legs.flatMap(({ leg, summary }) =>
    (summary?.rows ?? [])
      .filter((r) => r.status === "FLAKY")
      .map((r) => ({ leg, gate: r.id, detail: r.detail ?? "" })),
  );
}

/** The command that reproduces a finding on one machine. */
function reproduce(entry) {
  const browser = entry.places[0]?.browser ?? "chromium";
  const pages = entry.page === "all" ? "" : ` --pages ${entry.page}`;
  return `pnpm --filter dox gates --only ${entry.gate}${pages} --browsers ${browser}`;
}

function placesTable(entry) {
  return table(
    ["Leg", "Browser", "Width", "Theme"],
    entry.places.map((p) => [
      cell(p.leg),
      cell(p.browser),
      cell(p.width || "-"),
      cell(p.theme || "-"),
    ]),
  );
}

/**
 * @param {ReturnType<typeof collect>[number]} entry
 * @param {Context} context
 * @returns {Planned}
 */
function planned(entry, context) {
  const ofLegs = entry.gate === "dox-gate";
  const title =
    entry.rule === "could-not-run"
      ? `Dox nightly could not run the ${entry.page} leg`
      : entry.rule === "not-uploaded"
        ? "Dox nightly: leg findings did not reach the report"
        : `Dox gate: ${entry.rule} on ${entry.page} (${entry.gate})`;
  const tail =
    entry.tail.length > 0
      ? `\n\nLog tail:\n\n\`\`\`text\n${entry.tail
          .slice(-LOG_LINES)
          .join("\n")
          .replace(/```/g, "'''")}\n\`\`\``
      : "";
  const selector = entry.selector
    ? `\n\nSelector: ${codeCell(entry.selector)}`
    : "";
  const run = `Commit: ${context.sha}\nRun: ${context.runUrl}`;
  const repro = ofLegs
    ? ""
    : `\n\nReproduce:\n\n\`\`\`bash\n${reproduce(entry)}\n\`\`\``;
  return {
    key: entry.key,
    title,
    labels: [BUG_LABEL, GATE_LABEL],
    body: `${entry.message}${selector}${tail}\n\n${placesTable(entry)}\n\n${run}${repro}`,
    comment: `Still failing at ${context.sha}: ${context.runUrl}\n\n${placesTable(entry)}`,
  };
}

/** The synthetic finding of a dry run, in its own key namespace and under its own label. */
function dryRunFinding(context) {
  const entry = {
    key: DRY_RUN_KEY,
    gate: "dry-run",
    rule: "synthetic",
    page: "/",
    selector: "body",
    message:
      "**Dry run.** Forced by a manual dispatch (force_finding); nothing here is a real finding. Close this issue once checked.",
    tail: [],
    places: [
      { leg: "dry-run", browser: "chromium", width: "1440", theme: "dark" },
    ],
  };
  const real = planned(entry, context);
  return {
    ...real,
    title: `[dry run] ${real.title}`,
    labels: [DRY_RUN_LABEL, GATE_LABEL],
  };
}

/**
 * Whether `issue` is an open gate issue for `key`: it carries the `dox-gate` label and its body's
 * first line, trimmed, is the marker. A marker on line 2 does not match.
 * @param {OpenIssue} issue
 * @param {string} key
 */
export function matches(issue, key) {
  if (!issue.labels?.some((l) => l.name === GATE_LABEL)) return false;
  return (issue.body ?? "").split("\n", 1)[0].trim() === marker(key);
}

/**
 * @param {LegSummary[]} legs
 * @param {OpenIssue[]} openIssues
 * @param {Context} context
 * @returns {Action[]}
 */
export function planIssueActions(legs, openIssues, context) {
  /** @type {Planned[]} */
  let findings = collect(legs).map((e) => planned(e, context));
  const lowest = (key) =>
    openIssues
      .filter((issue) => matches(issue, key))
      .sort((a, b) => a.number - b.number)[0];

  /** @type {Action[]} */
  const actions = [];
  const fresh = findings.filter((f) => !lowest(f.key));
  const flood = fresh.length > FLOOD_LIMIT;
  if (flood) {
    const list = fresh.map((f) => `- \`${f.key}\`: ${f.title}`).join("\n");
    const lines = [
      `This run found ${fresh.length} new gate failures, more than ${FLOOD_LIMIT}. Many at once is usually one systemic cause (a shared stylesheet, a broken build, a runner problem), so none was filed on its own. Triage the cause first; the next run files whichever still fail.`,
      "",
      "Held back:",
      "",
      list,
      "",
      `Commit: ${context.sha}`,
      `Run: ${context.runUrl}`,
    ];
    findings = findings.filter((f) => !fresh.includes(f));
    findings.push({
      key: FLOOD_KEY,
      title: `Dox gate: ${fresh.length} new failures in one run`,
      labels: [BUG_LABEL, GATE_LABEL],
      body: lines.join("\n"),
      comment: `Still flooding at ${context.sha}: ${context.runUrl}\n\n${fresh.length} new failures:\n\n${list}`,
    });
  }
  if (context.dryRun) findings.push(dryRunFinding(context));

  for (const finding of findings) {
    const found = lowest(finding.key);
    actions.push(
      found
        ? {
            kind: "comment",
            key: finding.key,
            issue: found.number,
            body: finding.comment,
          }
        : {
            kind: "open",
            key: finding.key,
            title: finding.title,
            labels: finding.labels,
            body: `${marker(finding.key)}\n${finding.body}`,
          },
    );
  }
  return actions;
}
