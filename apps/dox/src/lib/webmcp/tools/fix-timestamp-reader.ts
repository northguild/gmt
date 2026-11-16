/**
 * WebMCP tool for `/tools/fix-timestamp-reader/`: a FIX UTCTimestamp read into the instant and
 * precision it states, and an instant written at the five FIX precisions, from the same `readStamp`
 * and `writeInstant` the page's redraw calls. A section with none of its fields given is `null`.
 */
import { showFixTimestampReaderInput } from "../../dox-tool-schemas";
import { loadFinanceLib } from "../../finance-lib";
import {
  EMPTY_INSTANT_TEXT,
  EMPTY_STAMP_TEXT,
  permalinkOf,
  readArgs,
  readStamp,
  STAMP_PRESETS,
  WRITE_PRESETS,
  WRITE_REFUSED_TEXT,
  writeInstant,
} from "../../fix-timestamp-reader";
import { encodeWidgetPermalink } from "../../widget-permalink";
import { jsonSafe } from "../json-safe";
import { loadLibFor } from "../load-lib";
import { definePageTool, toModelContextTool } from "../page-tool";

const stamp = STAMP_PRESETS[0];
const write = WRITE_PRESETS[0];
if (!stamp || !write) throw new Error("fix-timestamp-reader: no presets");

export const NEEDS_A_FIELD = "Give a stamp to read or an instant to write.";

export const def = definePageTool({
  page: "fix-timestamp-reader",
  name: "read_fix_timestamp",
  title: "FIX Timestamp Reader",
  doxTool: "showFixTimestampReader",
  returns:
    "For a stamp, read holds kind (empty, read or refused), instant, precision, leapSecond, digits (the fraction digits sent), belowNanosecond (the three digits under the nanosecond, null unless sent) and the verdict title and detail; for an instant, written holds kind and rows, one for each of the five precisions with its out text (empty where the library writes none) and note; read is null with no stamp, written is null with no instant",
  calls: [
    "parseFixUtcTimestamp",
    "isValidFixUtcTimestamp",
    "formatFixUtcTimestamp",
  ],
  input: showFixTimestampReaderInput,
  example: { stamp: stamp.text, instant: write.text },
  async run(args, signal) {
    const lib = await loadLibFor(loadFinanceLib, signal);
    const state = readArgs({ stamp: args.stamp, write: args.instant });
    const notes: string[] = [];
    let read = null;
    let written = null;
    if (args.stamp !== undefined) {
      const r = readStamp(lib, state.stamp);
      read = {
        kind: r.kind,
        instant: r.parsed?.instant ?? null,
        precision: r.parsed?.precision ?? null,
        leapSecond: r.parsed?.leapSecond ?? null,
        digits: r.digits,
        belowNanosecond: r.belowNanosecond,
        verdict: { title: r.verdict.title, detail: r.verdict.detail },
      };
      if (r.kind === "empty") notes.push(EMPTY_STAMP_TEXT);
      if (r.kind === "refused") notes.push(r.verdict.detail);
    }
    if (args.instant !== undefined) {
      const w = writeInstant(lib, state.write);
      written = {
        kind: w.kind,
        rows: w.rows.map(({ precision, out, note }) => ({
          precision,
          out,
          note,
        })),
      };
      if (w.kind === "empty") notes.push(EMPTY_INSTANT_TEXT);
      if (w.kind === "refused") notes.push(WRITE_REFUSED_TEXT);
    }
    if (args.stamp === undefined && args.instant === undefined) {
      notes.push(NEEDS_A_FIELD);
    }
    return {
      input: args,
      result: jsonSafe({ read, written }),
      notes,
      link: encodeWidgetPermalink("fixstamp", permalinkOf(state)),
    };
  },
});

export default toModelContextTool(def);
