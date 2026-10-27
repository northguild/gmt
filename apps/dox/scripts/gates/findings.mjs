/**
 * What a gate script tells the runner (`scripts/gates.mjs`) besides its exit code.
 *
 * When `GATE_REPORT` names a file, `recordFinding` appends one NDJSON line per failure and
 * `recordMeasured` one line for the count of things the run really measured. Without it both do
 * nothing, so a gate run by hand prints exactly what it printed before.
 *
 *   {"kind":"finding","gate":"readout-still","rule":"readout-moved","page":"/tools/dwell-ledger/",
 *    "selector":".gmt-dwell-total","browser":"chromium","width":390,"theme":null,"message":"…"}
 *   {"kind":"measured","gate":"readout-still","n":24}
 *
 * `rule` is a short stable id (`readout-moved`, `grew`, `contrast-below-7`), never prose: the runner
 * groups and the nightly issue dedupes on it. `n` counts the pages x browsers x widths measured; a
 * gate that exits 0 without it, or with 0, is a failed run.
 */
import { appendFileSync } from "node:fs";

/** The fields of a finding, in the order they are written. */
export const FINDING_FIELDS = [
  "gate",
  "rule",
  "page",
  "selector",
  "browser",
  "width",
  "theme",
  "message",
];

function append(line) {
  const file = process.env.GATE_REPORT;
  if (!file) return;
  appendFileSync(file, `${JSON.stringify(line)}\n`);
}

/** One failure. A missing field is written as null so every line has the same shape. */
export function recordFinding(finding) {
  const line = { kind: "finding" };
  for (const field of FINDING_FIELDS) line[field] = finding[field] ?? null;
  append(line);
}

/** The count of page x browser x width cells the gate actually measured. */
export function recordMeasured(gate, n) {
  append({ kind: "measured", gate, n });
}

/**
 * A failure message of the form `<browser> <width>px[ <theme>]: <text>`, which the three Canada
 * scripts write, as a finding. The cell comes from the label and the rule from the text, so the
 * script's own wording does not have to change.
 */
export function recordLabelled({ gate, page, message }) {
  const cell =
    /^(?:(chromium|webkit|firefox) )?(\d+)px(?: (dark|light))?(?: [^:]*)?: (.*)$/s.exec(
      message,
    );
  const text = cell ? cell[4] : message;
  recordFinding({
    gate,
    rule: /HTTP/.test(text)
      ? "http-status"
      : /moved/.test(text)
        ? "moved"
        : /overlap|crosses/.test(text)
          ? "overlap"
          : /scrolls sideways/.test(text)
            ? "sideways-scroll"
            : "check-failed",
    page,
    browser: cell?.[1] ?? null,
    width: cell ? Number(cell[2]) : null,
    theme: cell?.[3] ?? null,
    message: text,
  });
}
