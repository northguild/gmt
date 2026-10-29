/**
 * The runner's screen: one line per gate, details only under a FAIL.
 *
 * It is the runner's own formatter rather than `scripts/lib/verdict-format.mjs` because the screen
 * needs a five-character `FLAKY` status, no index column, durations as `38s` and `1m02s`, and a
 * closing `logs: … summary: …` line, none of which `formatScreen` there has.
 *
 *   gates: FAIL  1 of 8 failed  (against origin/main @ 0a59823, 4 pages, chromium,webkit, dark,light)  4m12s
 *     PASS   build                 1m48s
 *     FAIL   readout-still         1 page · chromium,webkit           52s
 *            readout-moved  /tools/dwell-ledger/  chromium 390  dwell total moved 4px
 *   logs: /abs/path/apps/dox/.gates/   summary: .gates/summary.json
 *
 * A status is `PASS`, `FAIL`, `FLAKY` or `SKIP`. `MAX_FINDINGS` findings show under a FAIL, then
 * `N more in <log>`; a FAIL that wrote none shows the last `LOG_TAIL` lines of its log.
 */

export const MAX_FINDINGS = 5;
export const LOG_TAIL = 10;
const MAX_MESSAGE = 140;
const LABEL_WIDTH = 20;
const DETAIL_WIDTH = 34;
const INDENT = " ".repeat(9);

/** Milliseconds as `38s`, `1m02s`, `4m12s`. */
export function formatDuration(ms) {
  const total = Math.round(ms / 1000);
  if (total < 60) return `${total}s`;
  return `${Math.floor(total / 60)}m${String(total % 60).padStart(2, "0")}s`;
}

function clip(text) {
  const one = text.replace(/\s+/g, " ").trim();
  return one.length > MAX_MESSAGE ? `${one.slice(0, MAX_MESSAGE - 1)}…` : one;
}

/** One finding as `rule  page  browser width  selector message`. */
export function findingLine(f) {
  const cell = [f.browser, f.width].filter(
    (x) => x !== null && x !== undefined,
  );
  const selector =
    f.selector && !String(f.message ?? "").includes(f.selector)
      ? `${f.selector} `
      : "";
  return [
    f.rule,
    f.page,
    cell.length > 0 ? cell.join(" ") : null,
    clip(`${selector}${f.message ?? ""}`),
  ]
    .filter((part) => part !== null && part !== undefined && part !== "")
    .join("  ");
}

/**
 * @param {{
 *   status: "PASS" | "FAIL",
 *   headline: string,
 *   context: string,
 *   durationMs: number,
 *   rows: { id: string, status: string, detail?: string, durationMs?: number,
 *           findings?: object[], moreIn?: string, logTail?: string[] }[],
 *   logsDir: string,
 *   summaryPath: string,
 * }} summary
 */
export function formatGatesScreen(summary) {
  const lines = [
    `gates: ${summary.status}  ${summary.headline}  (${summary.context})  ${formatDuration(summary.durationMs)}`,
  ];
  for (const row of summary.rows) {
    const duration =
      row.durationMs === undefined ? "" : formatDuration(row.durationMs);
    lines.push(
      `  ${row.status.padEnd(5)}  ${row.id.padEnd(LABEL_WIDTH)}  ${
        duration === ""
          ? (row.detail ?? "")
          : (row.detail ?? "").padEnd(DETAIL_WIDTH)
      }${duration === "" ? "" : `  ${duration}`}`.trimEnd(),
    );
    if (row.status !== "FAIL") continue;
    const findings = row.findings ?? [];
    for (const f of findings.slice(0, MAX_FINDINGS)) {
      lines.push(`${INDENT}${findingLine(f)}`);
    }
    if (findings.length > MAX_FINDINGS) {
      lines.push(
        `${INDENT}${findings.length - MAX_FINDINGS} more in ${row.moreIn}`,
      );
    }
    if (findings.length === 0) {
      for (const line of (row.logTail ?? []).slice(-LOG_TAIL))
        lines.push(`${INDENT}${line}`);
    }
  }
  lines.push(`logs: ${summary.logsDir}   summary: ${summary.summaryPath}`);
  return lines.join("\n");
}
