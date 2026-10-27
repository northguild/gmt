/**
 * The one screen every verdict script prints, so they all look alike.
 *
 * `formatScreen({ title, status, rows, logPath })` returns the text, with no trailing newline:
 *
 *   title   "verdict validate"
 *   status  "FAIL at step 12 of 12 (pnpm -r --if-present run test)  9m41s"
 *   rows    [{ status, index, label, detail, duration, details }]
 *   logPath the log file or folder, printed last as `log: <logPath>`
 *
 * A row's `status` is "PASS", "FAIL" or "----" (not run). `index` is a number or omitted.
 * `detail` is a short note after the label ("36,412 tests", "not run"), `duration` a string such as
 * "2m10s" (see `formatDuration`), and `details` indented lines printed under the row.
 */

const DETAIL_INDENT = "            ";

/** Milliseconds as "0.4s", "11.8s", "2m10s" or "3m02s". */
export function formatDuration(ms) {
  if (ms < 60_000) return `${(Math.round(ms / 100) / 10).toFixed(1)}s`;
  const total = Math.round(ms / 1000);
  const seconds = String(total % 60).padStart(2, "0");
  return `${Math.floor(total / 60)}m${seconds}s`;
}

/**
 * @typedef {object} Row
 * @property {string} status "PASS", "FAIL" or "----"
 * @property {number} [index]
 * @property {string} label
 * @property {string} [detail]
 * @property {string} [duration]
 * @property {string[]} [details]
 */

/**
 * @param {{ title: string, status: string, rows?: Row[], logPath?: string }} screen
 * @returns {string}
 */
export function formatScreen({ title, status, rows = [], logPath }) {
  const indexWidth = Math.max(
    2,
    ...rows.map((row) => String(row.index ?? "").length),
  );
  const labelWidth = Math.max(0, ...rows.map((row) => row.label.length));
  // Rows with no duration (not run) put their detail straight after the label, outside the column.
  const timed = rows.filter((row) => row.duration);
  const detailWidth = Math.max(
    0,
    ...timed.map((row) => (row.detail ?? "").length),
  );
  const durationWidth = Math.max(
    0,
    ...rows.map((row) => (row.duration ?? "").length),
  );

  const out = [`${title}: ${status}`];
  for (const row of rows) {
    const index =
      row.index === undefined
        ? " ".repeat(indexWidth)
        : String(row.index).padStart(indexWidth);
    const head = `  ${row.status.padEnd(4)}  ${index}  `;
    out.push(
      (row.duration
        ? [
            head + row.label.padEnd(labelWidth),
            detailWidth > 0
              ? `  ${(row.detail ?? "").padEnd(detailWidth)}`
              : "",
            `  ${row.duration.padStart(durationWidth)}`,
          ].join("")
        : head + (row.detail ? `${row.label}  ${row.detail}` : row.label)
      ).trimEnd(),
    );
    for (const line of row.details ?? [])
      out.push(`${DETAIL_INDENT}${line}`.trimEnd());
  }
  if (logPath) out.push(`log: ${logPath}`);
  return out.join("\n");
}
