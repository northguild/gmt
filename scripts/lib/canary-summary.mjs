/**
 * CORE-81: the job summary both canary workflows write. Pure: verdicts, the forced flags and the
 * outcome of each planned action in, GitHub-flavoured Markdown for `$GITHUB_STEP_SUMMARY` out.
 * The caller (`scripts/canary-report.mjs`) does the appending.
 *
 * Counts always come from the real verdicts, so a dry run never inflates them. Numbers print as
 * the verdict holds them, with no locale grouping, so the summary matches the log digit for digit.
 */

const CHECK = "temporal-compat-check";
const ORACLE = "temporal-oracle";
const LEAP = "leap-seconds";

const NO_VERDICT = "no verdict file: an earlier step or job failed";

/**
 * @typedef {import("./canary-issues.mjs").Verdict} Verdict
 * @typedef {import("./canary-issues.mjs").Action} Action
 * @typedef {import("./canary-issues.mjs").Force} Force
 * @typedef {{ action: Action, ok: boolean, issue?: number, error?: string }} Result
 * @typedef {{ flag: string, reason: string }} Skipped  a force flag `applyForce` left out
 */

/** @param {unknown} text */
function oneLine(text) {
  return String(text).replace(/\s+/g, " ").trim();
}

/**
 * @param {Record<string, Verdict | null | undefined>} verdicts
 * @param {string} source
 * @returns {{ ran: any } | { message: string }}
 */
function sourceOf(verdicts, source) {
  const verdict = verdicts[source] ?? null;
  if (verdict === null) return { message: NO_VERDICT };
  if (verdict.status === "could-not-run") {
    return { message: /** @type {any} */ (verdict).message };
  }
  return { ran: verdict };
}

/**
 * @param {Record<string, Verdict | null | undefined>} verdicts
 * @param {string} source
 * @param {string} label
 * @param {(verdict: any) => string[]} whenRan  the blocks shown when the source ran
 * @returns {string[]}
 */
function blocksFor(verdicts, source, label, whenRan) {
  const found = sourceOf(verdicts, source);
  if ("ran" in found) return whenRan(found.ran);
  return [`${label}: could not run — ${oneLine(found.message)}`];
}

/** @param {string} header @param {string[][]} rows */
function table(header, rows) {
  return [
    `| ${header} | Count |`,
    "| --- | --- |",
    ...rows.map(([name, count]) => `| ${name} | ${count} |`),
  ].join("\n");
}

/** @param {any} check */
function workaroundBlocks(check) {
  const guards = check.workarounds.filter(
    (/** @type {any} */ w) => w.state === "guard",
  );
  const guardCell =
    check.counts.guard === 0 || guards.length === 0
      ? String(check.counts.guard)
      : `${check.counts.guard} (${guards
          .map(
            (/** @type {any} */ w) =>
              `${w.id}, through ${w.guard.package} ${w.guard.through}`,
          )
          .join("; ")})`;
  return [
    table("Workarounds", [
      ["Still needed", String(check.counts.stillNeeded)],
      ["Removable", String(check.counts.removable)],
      ["Guard", guardCell],
    ]),
  ];
}

/**
 * The lines under the oracle table: which groups are removable and whether the committed snapshot
 * is current. Separate paragraphs, because two consecutive lines would render as one.
 * @param {any} check
 * @returns {string[]}
 */
function checkNotes(check) {
  /** @type {string[]} */
  const blocks = [];
  const removable = check.workarounds
    .filter((/** @type {any} */ w) => w.state === "removable")
    .map((/** @type {any} */ w) => w.id);
  if (removable.length > 0) blocks.push(`Removable: ${removable.join(", ")}`);
  blocks.push(
    check.snapshot.current
      ? "Snapshot: current"
      : "Snapshot: stale: run pnpm compat:snapshot",
  );
  return blocks;
}

/** @param {any} oracle */
function oracleBlocks(oracle) {
  const c = oracle.counts;
  return [
    table("Oracle", [
      ["Comparisons", String(c.comparisons)],
      ["Mismatches", String(c.mismatches)],
      ["Tagged", String(c.tagged)],
      ["Untagged", String(c.untagged)],
    ]),
  ];
}

/**
 * @param {Record<string, Verdict | null | undefined>} verdicts
 * @returns {string | null}
 */
function runtimeLine(verdicts) {
  const check = sourceOf(verdicts, CHECK);
  const oracle = sourceOf(verdicts, ORACLE);
  const runtime =
    ("ran" in check && check.ran.runtime) ||
    ("ran" in oracle && oracle.ran.runtime) ||
    null;
  if (!runtime) return null;
  const parts = [
    `@js-temporal/polyfill ${runtime.polyfill}`,
    `Node ${runtime.node}`,
    `ICU ${runtime.icu}`,
  ];
  if ("ran" in oracle) parts.push(`Chromium ${oracle.ran.chromium}`);
  return parts.join(" · ");
}

/**
 * The dry-run lines: one naming the flags that were applied, then one per flag that was skipped,
 * with its reason.
 * @param {"temporal-oracle" | "leap-seconds"} workflow
 * @param {Force} force
 * @param {Skipped[]} skipped
 * @returns {string | null}
 */
function dryRunLines(workflow, force, skipped) {
  const notApplied = new Set(skipped.map((s) => s.flag));
  const flags = [];
  if (workflow === "temporal-oracle") {
    if (force.removable !== undefined) {
      flags.push(`--force-removable=${force.removable}`);
    }
    if (force.mismatch) flags.push("--force-mismatch");
  } else if (force.leapDifference) {
    flags.push("--force-leap-difference");
  }
  const lines = [];
  const applied = flags.filter((flag) => !notApplied.has(flag));
  if (applied.length > 0) lines.push(`**Dry run:** ${applied.join(", ")}`);
  for (const { flag, reason } of skipped) {
    lines.push(`**Dry run:** ${flag} not applied: ${oneLine(reason)}`);
  }
  return lines.length > 0 ? lines.join("\n\n") : null;
}

/**
 * @param {Result[] | null} results
 * @param {string | undefined} notFiledReason
 * @returns {string}
 */
function issuesLine(results, notFiledReason) {
  if (results === null) {
    return notFiledReason === undefined
      ? "**Issues:** Not filed (--print)."
      : `**Issues:** Not filed: ${oneLine(notFiledReason)}`;
  }
  if (results.length === 0) return "**Issues:** No issues filed.";
  const parts = results.map(({ action, ok, issue, error }) => {
    if (action.kind === "open") {
      return ok
        ? `opened #${issue} (${oneLine(action.title)})`
        : `failed to open (${oneLine(action.title)}): ${oneLine(error ?? "")}`;
    }
    return ok
      ? `commented on #${action.issue}`
      : `failed to comment on #${action.issue}: ${oneLine(error ?? "")}`;
  });
  return `**Issues:** ${parts.join("; ")}.`;
}

/**
 * GFM for $GITHUB_STEP_SUMMARY.
 * @param {"temporal-oracle" | "leap-seconds"} workflow
 * @param {Record<string, Verdict | null>} verdicts  the real verdicts, before applyForce
 * @param {Force} force
 * @param {Result[] | null} results
 *        null when no action ran (`--print`, or applyForce threw)
 * @param {string} [notFiledReason]  with null `results`: the applyForce message, shown as the
 *        reason nothing was filed; omitted means `--print`
 * @param {Skipped[]} [skipped]  the force flags `applyForce` left out, each with its reason
 * @returns {string}
 */
export function summaryMarkdown(
  workflow,
  verdicts,
  force,
  results,
  notFiledReason,
  skipped = [],
) {
  /** @type {string[]} */
  const blocks = [];
  if (workflow === "temporal-oracle") {
    blocks.push("## Temporal oracle");
    const runtime = runtimeLine(verdicts);
    if (runtime) blocks.push(runtime);
    blocks.push(
      ...blocksFor(verdicts, CHECK, "Workarounds", workaroundBlocks),
      ...blocksFor(verdicts, ORACLE, "Oracle", oracleBlocks),
    );
    const check = sourceOf(verdicts, CHECK);
    if ("ran" in check) blocks.push(...checkNotes(check.ran));
  } else {
    blocks.push("## Leap-second canary");
    const found = sourceOf(verdicts, LEAP);
    if ("ran" in found) {
      const leap = found.ran;
      blocks.push(
        `IERS: ${leap.header ?? 'no "Updated through" line'}`,
        table("Leap-second table", [
          ["GMT rows", String(leap.rows.gmt)],
          ["IERS rows", String(leap.rows.iers)],
          ["Differences", String(leap.differences.length)],
        ]),
      );
      if (leap.differences.length > 0) {
        blocks.push(
          leap.differences
            .map((/** @type {string} */ d) => `- ${oneLine(d)}`)
            .join("\n"),
        );
      }
    } else {
      blocks.push(
        `Leap-second table: could not run — ${oneLine(found.message)}`,
      );
    }
  }
  const dry = dryRunLines(workflow, force, skipped);
  if (dry) blocks.push(dry);
  blocks.push(issuesLine(results, notFiledReason));
  return `${blocks.join("\n\n")}\n`;
}
