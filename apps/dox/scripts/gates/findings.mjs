/**
 * What a gate script tells the runner (`scripts/gates.mjs`) besides its exit code.
 *
 * When `GATE_REPORT` names a file, `recordFinding` appends one NDJSON line per failure and
 * `recordMeasured` one line for the count of things the run really measured. Without it both do
 * nothing, so a gate run by hand prints exactly what it printed before.
 *
 *   {"kind":"finding","gate":"readout-still","rule":"readout-moved","page":"/tools/dwell-ledger/",
 *    "target":"widget:dwell-ledger › status \"Total\"","selector":"section > output","browser":"chromium","width":390,"theme":null,"message":"…"}
 *   {"kind":"measured","gate":"readout-still","n":24}
 *
 * `rule` is a short stable id (`readout-moved`, `grew`, `contrast-below-7`), never prose: the runner
 * groups and the weekly issue dedupes on it. `n` counts the pages x browsers x widths measured; a
 * gate that exits 0 without it, or with 0, is a failed run.
 */
import { appendFileSync } from "node:fs";

/** The fields of a finding, in the order they are written. */
export const FINDING_FIELDS = [
  "gate",
  "rule",
  "page",
  "target",
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

/**
 * One failure. A missing field is written as null so every line has the same shape, except
 * `target`: a finding with no element identity (`lib/element-identity.mjs`, or `page` / `root`)
 * throws, so the gate crashes, the runner reports a gate failure, and no issue is ever keyed on
 * nothing.
 */
export function recordFinding(finding) {
  if (typeof finding.target !== "string" || finding.target.trim() === "") {
    throw new Error(
      `recordFinding: ${finding.gate ?? "?"}/${finding.rule ?? "?"} on ${finding.page ?? "?"} has no target (an element identity key, "page" or "root")`,
    );
  }
  const line = { kind: "finding" };
  for (const field of FINDING_FIELDS) line[field] = finding[field] ?? null;
  append(line);
}

/** The count of page x browser x width cells the gate actually measured. */
export function recordMeasured(gate, n) {
  append({ kind: "measured", gate, n });
}

/**
 * A short stable slug of a message with its numbers stripped, so the same failure keeps one key
 * whatever it measured (`moved 3px` and `moved 7px`) and two different failures on one page
 * keep two.
 */
function slugOf(text) {
  return text
    .toLowerCase()
    .replace(/\d+(?:\.\d+)?/g, "")
    .replace(/[^a-z]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/, "");
}

/**
 * A failure message of the form `<browser> <width>px[ <theme>]: <text>`, which the three Canada
 * scripts write, as a finding. The cell comes from the label and the rule from the text, so the
 * script's own wording does not have to change.
 *
 * These scripts name no element, so the target is `page › <slug>` with the slug taken from the
 * message with its numbers stripped. Without it every failure on a page that maps to one rule
 * (two different `check-failed` messages, a card and a readout that both `moved`) would share
 * one key and one issue. A caller that has an element passes its own `target`.
 */
export function recordLabelled({ gate, page, message, target }) {
  const cell =
    /^(?:(chromium|webkit|firefox) )?(\d+)px(?: (dark|light))?(?: [^:]*)?: (.*)$/s.exec(
      message,
    );
  const text = cell ? cell[4] : message;
  const slug = slugOf(text);
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
    target: target ?? (slug ? `page › ${slug}` : "page"),
    browser: cell?.[1] ?? null,
    width: cell ? Number(cell[2]) : null,
    theme: cell?.[3] ?? null,
    message: text,
  });
}
