/**
 * WebMCP tool for `/tools/stored-time-audit/`: each stored zoned time on a line read under this
 * browser's own time-zone rules, from the same `parseAuditLines` and `readAuditLines` the page's
 * redraw calls. The lane drawing is not part of it.
 */
import {
  AUDIT_PRESETS,
  HOST_NOTE_TEXT,
  kindLabel,
  lineSentence,
  NOT_STORED_TEXT,
  parseAuditLines,
  permalinkOf,
  readArgs,
  readAuditLines,
  readingsOf,
  truncatedText,
} from "../../stored-time-audit";
import { loadStoredTimeLib } from "../../stored-time-lib";
import { showStoredTimeAuditInput } from "../../dox-tool-schemas";
import { encodeWidgetPermalink } from "../../widget-permalink";
import { jsonSafe } from "../json-safe";
import { loadLibFor } from "../load-lib";
import { definePageTool, toModelContextTool } from "../page-tool";

const first = AUDIT_PRESETS[0];
if (first === undefined) throw new Error("stored-time-audit: no presets");

export const def = definePageTool({
  page: "stored-time-audit",
  name: "check_stored_timestamps",
  title: "Stored Time Audit",
  doxTool: "showStoredTimeAudit",
  returns:
    "lines, one entry for each stored string read (at most twelve, cut to eighty characters), with n, value, kind (valid, validInOverlap, offsetMismatch, ambiguous, nonexistent, or null when it is not a stored zoned time), label, readings (each named value the audit gives: instant, earlier, later, storedOffset, zoneOffset, atStoredOffset or atZoneOffset) and sentence; the audit uses this browser's time-zone rules, so another device can read a line differently",
  calls: ["classifyStoredZoned"],
  rules: [
    "values must hold at least one character that is not whitespace; a blank list is refused",
  ],
  // The chat line gains a clause for retrieval; the description keeps to its length limit without it.
  whenSwaps: [
    [
      "asks to audit saved or stored zoned values and what is wrong with them, why a stored",
      "asks why a stored",
    ],
  ],
  argsSwaps: [
    [
      "values: the reader's strings exactly as given, one per line, each with an offset or `Z` and a bracketed zone; never invent or correct one. line: optional, which line to draw",
      "values: the reader's strings exactly as given, one per line, each with an offset or Z and a bracketed zone; never invent or correct one. line: optional, which line to draw",
    ],
  ],
  input: showStoredTimeAuditInput,
  example: { values: first.lines.join("\n") },
  async run(args, signal) {
    const lib = await loadLibFor(loadStoredTimeLib, signal);
    const state = readArgs(args);
    const parsed = parseAuditLines(state.values);
    const lines = readAuditLines(parsed.lines, lib);
    const notes: string[] = [HOST_NOTE_TEXT];
    const cut = truncatedText(parsed);
    if (cut !== "") notes.push(cut);
    if (lines.some((line) => line.result === null)) {
      notes.push(NOT_STORED_TEXT);
    }
    return {
      input: args,
      result: jsonSafe({
        lines: lines.map((line, i) => ({
          n: i + 1,
          value: line.value,
          kind: line.result?.kind ?? null,
          label: line.result === null ? null : kindLabel(line.result.kind),
          readings:
            line.result === null
              ? []
              : readingsOf(line.result).map(({ name, value }) => ({
                  name,
                  value,
                })),
          sentence: lineSentence(line),
        })),
      }),
      notes,
      link: encodeWidgetPermalink("storedaudit", permalinkOf(state)),
    };
  },
});

export default toModelContextTool(def);
