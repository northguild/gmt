/**
 * WebMCP tool for `/tools/tai64n-log-reader/`: the label at the start of each log line read as the
 * UTC instant, the TAI reading and the TAI minus UTC gap it names, and an instant written as a
 * label, from the same `readLog` and `writeLabel` the page's redraw calls. The instant is optional:
 * without one nothing is written, and `written` is `null`.
 */
import { showTai64nLogReaderInput } from "../../dox-tool-schemas";
import {
  ALL_REFUSED_TEXT,
  DEFAULT_INSTANT,
  DROPPED_HINT,
  LOG_MAX_CHARS,
  LOG_MAX_LINES,
  permalinkOf,
  readArgs,
  readLog,
  splitLog,
  TAI64N_PRESETS,
  writeLabel,
} from "../../tai64n-log-reader";
import { loadTai64nLib } from "../../tai64n-lib";
import { encodeWidgetPermalink } from "../../widget-permalink";
import { jsonSafe } from "../json-safe";
import { loadLibFor } from "../load-lib";
import { definePageTool, toModelContextTool } from "../page-tool";

const first = TAI64N_PRESETS[0];
if (!first) throw new Error("tai64n-log-reader: no presets");

export const noLabelNote = (n: number): string =>
  `Line ${n} starts with no label fromTai64n reads.`;
export const NO_LABEL_WRITTEN =
  "toTai64n writes no label for this instant, so there is nothing to read back.";

export const LINE_CUT_NOTE = `A line longer than ${LOG_MAX_CHARS} characters is read only up to its first ${LOG_MAX_CHARS}.`;

/** Whether `splitLog` cut a kept line to the character cap: the page keeps the cut text only. */
const cutByChars = (text: string): boolean =>
  text
    .split("\n")
    .map((l) => (l.endsWith("\r") ? l.slice(0, -1) : l))
    .filter((l) => l.trim() !== "")
    .slice(0, LOG_MAX_LINES)
    .some((l) => l.length > LOG_MAX_CHARS);

export const def = definePageTool({
  page: "tai64n-log-reader",
  name: "read_tai64n_labels",
  title: "TAI64N Log Reader",
  doxTool: "showTai64nLogReader",
  returns:
    "lines holds, for each line read, n (its number from 1), token, message, read (whether a label was read), utc, tai (the TAI reading), seconds (TAI minus UTC), and inserted (whether the instant is inside an inserted second), with empty strings and a null for a line with no label; written holds label and back (the instant read back from the label), or is null without an instant",
  calls: ["fromTai64n", "toTAI", "taiMinusUtc", "isLeapSecond", "toTai64n"],
  rules: ["Send at least one line that is not blank."],
  input: showTai64nLogReaderInput,
  example: { values: first.lines.join("\n"), instant: DEFAULT_INSTANT },
  async run(args, signal) {
    const lib = await loadLibFor(loadTai64nLib, signal);
    const state = readArgs(args);
    const split = splitLog(state.values);
    const rows = readLog(split.lines, lib);
    const lines = rows.map((r) => ({
      n: r.n,
      token: r.token,
      message: r.message,
      read: r.read,
      utc: r.utc,
      tai: r.tai,
      seconds: r.seconds,
      inserted: r.inserted,
    }));
    const notes: string[] = [];
    if (split.dropped > 0) notes.push(DROPPED_HINT);
    if (cutByChars(state.values)) notes.push(LINE_CUT_NOTE);
    if (rows.length > 0 && rows.every((r) => !r.read)) {
      notes.push(ALL_REFUSED_TEXT);
    } else {
      for (const r of rows) if (!r.read) notes.push(noLabelNote(r.n));
    }
    let written = null;
    if (args.instant !== undefined) {
      const w = writeLabel(state.instant, lib);
      written = { label: w.label, back: w.back };
      if (w.label === "") notes.push(NO_LABEL_WRITTEN);
    }
    return {
      input: args,
      result: jsonSafe({ lines, written }),
      notes,
      link: encodeWidgetPermalink("tai64n", permalinkOf(state)),
    };
  },
});

export default toModelContextTool(def);
