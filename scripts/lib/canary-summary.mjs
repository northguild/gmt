/**
 * CORE-81: the job summary both canary workflows write. Pure: verdicts, the forced flags and the
 * outcome of each planned action in, GitHub-flavoured Markdown for `$GITHUB_STEP_SUMMARY` out.
 * The caller (`scripts/canary-report.mjs`) does the appending.
 *
 * Counts always come from the real verdicts, so a dry run never inflates them. Numbers print as
 * the verdict holds them, with no locale grouping, so the summary matches the log digit for digit.
 */

import { COMPAT_SOURCES, compatStates } from "./canary-issues.mjs";

const CHECK = "temporal-compat-check";
const ORACLE = "temporal-oracle";
const LEAP = "leap-seconds";

const NATIVE_LEGS = ["node", "chromium", "firefox", "webkit"];

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
 * The same groups on each engine: the Node check and one browser per native-suite leg. A source
 * that did not run keeps its row, so a missing engine is seen and not mistaken for a clean one.
 * @param {Record<string, Verdict | null | undefined>} verdicts
 * @returns {string[]}
 */
function compatEngineBlocks(verdicts) {
  const rows = COMPAT_SOURCES.map((source) => {
    const found = sourceOf(verdicts, source);
    if (!("ran" in found)) {
      return [source, `could not run — ${oneLine(found.message)}`, "—", "—", "—", "—"];
    }
    const v = found.ran;
    const engine = source === CHECK ? `Node ${v.runtime.node}` : v.engine;
    const c = v.counts;
    return [
      source,
      `${engine} (${v.engineId})`,
      String(c.stillNeeded),
      String(c.removable),
      String(c.guard),
      String(c.outOfScope),
    ];
  });
  return [
    [
      "| Compat source | Engine | Still needed | Removable | Guard | Out of scope |",
      "| --- | --- | --- | --- | --- | --- |",
      ...rows.map((r) => `| ${r.join(" | ")} |`),
    ].join("\n"),
  ];
}

/** @param {import("./canary-issues.mjs").EngineState} e */
function engineNote(e) {
  const state = e.row
    ? e.row.state === "still-needed"
      ? `still needed, ${e.row.failing} of ${e.row.probes} probes fail`
      : e.row.state.replace(/-/g, " ")
    : "no verdict";
  return `${e.engine ?? e.source}: ${state}`;
}

/**
 * The lines under the oracle table: which groups are removable on every engine in their scope,
 * which only on some, and whether the committed snapshot is current. Separate paragraphs,
 * because two consecutive lines would render as one.
 * @param {Record<string, Verdict | null | undefined>} verdicts
 * @returns {string[]}
 */
function checkNotes(verdicts) {
  /** @type {string[]} */
  const blocks = [];
  const states = compatStates(/** @type {any} */ (verdicts));
  const everywhere = states.filter((s) => s.everywhere).map((s) => s.id);
  if (everywhere.length > 0) {
    blocks.push(`Removable on every engine in scope: ${everywhere.join(", ")}`);
  }
  const partly = states.filter(
    (s) =>
      !s.everywhere &&
      s.engines.some((e) => e.inScope && e.row?.state === "removable"),
  );
  if (partly.length > 0) {
    blocks.push(
      `Removable on some engines only: ${partly
        .map(
          (s) =>
            `${s.id} (${s.engines
              .filter((e) => e.inScope)
              .map(engineNote)
              .join("; ")})`,
        )
        .join(", ")}`,
    );
  }
  const check = sourceOf(verdicts, CHECK);
  if ("ran" in check) {
    blocks.push(
      check.ran.snapshot.current
        ? "Snapshot: current"
        : "Snapshot: stale: run pnpm compat:snapshot",
    );
  }
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
 * The native Temporal suite: one table row per leg, then one line per host group that matched, so
 * nothing known is absorbed silently. The engine cell carries each run's engine version.
 * @param {Record<string, Verdict | null | undefined>} verdicts
 * @returns {string[]}
 */
function nativeBlocks(verdicts) {
  const header = [
    "Leg",
    "Engine",
    "Tests",
    "Passed",
    "Tagged",
    "Untagged",
    "Host tagged",
    "Host untagged",
    "Stale tags",
  ];
  /** @type {string[]} */
  const lines = [];
  const rows = NATIVE_LEGS.map((leg) => {
    const found = sourceOf(verdicts, `native-suite-${leg}`);
    if (!("ran" in found)) {
      return [
        leg,
        `could not run — ${oneLine(found.message).replace(/\|/g, "\\|")}`,
        "",
        "",
        "",
        "",
        "",
        "",
        "",
      ];
    }
    const v = found.ran;
    const c = v.counts;
    return [
      leg,
      oneLine(v.engine),
      String(c.tests),
      String(c.passed),
      String(c.tagged),
      String(c.untagged),
      String(c.hostTagged),
      String(c.hostUntagged),
      String(c.staleTags),
    ];
  });
  for (const leg of NATIVE_LEGS) {
    const found = sourceOf(verdicts, `native-suite-${leg}`);
    if (!("ran" in found)) continue;
    for (const g of found.ran.hostTagged) {
      lines.push(
        `${oneLine(found.ran.engine)}: ${g.group} — ${g.count} tests (${oneLine(g.reason)})`,
      );
    }
  }
  return [
    "### Native Temporal suite",
    [
      `| ${header.join(" | ")} |`,
      `| ${header.map(() => "---").join(" | ")} |`,
      ...rows.map((r) => `| ${r.join(" | ")} |`),
    ].join("\n"),
    ...(lines.length > 0 ? [lines.join("\n\n")] : []),
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
    if (force.nativeFailure) flags.push("--force-native-failure");
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
      ...compatEngineBlocks(verdicts),
      ...blocksFor(verdicts, ORACLE, "Oracle", oracleBlocks),
    );
    blocks.push(...checkNotes(verdicts), ...nativeBlocks(verdicts));
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
