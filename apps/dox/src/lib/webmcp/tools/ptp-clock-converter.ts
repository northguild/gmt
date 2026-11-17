/**
 * WebMCP tool for `/tools/ptp-clock-converter/`: a PTP timestamp read as UTC and checked against
 * the leap-second table, and a UTC instant written as a PTP timestamp, from the same `readPtp`,
 * `checkOffset` and `writePtp` the page's redraw calls. The read needs all three of its fields; the
 * write needs the instant, and takes the page's default offset when none is given.
 */
import { showPtpClockConverterInput } from "../../dox-tool-schemas";
import { loadIotLib } from "../../iot-lib";
import {
  checkOffset,
  permalinkOf,
  readArgs,
  readPtp,
  READ_REASONS,
  READ_PRESETS,
  WRITE_PRESETS,
  WRITE_REASONS,
  writePtp,
} from "../../ptp-clock-converter";
import { encodeWidgetPermalink } from "../../widget-permalink";
import { jsonSafe } from "../json-safe";
import { loadLibFor } from "../load-lib";
import { definePageTool, toModelContextTool } from "../page-tool";

const read = READ_PRESETS[0];
const write = WRITE_PRESETS[0];
if (!read || !write) throw new Error("ptp-clock-converter: no presets");

export const NEEDS_ALL_THREE =
  "A timestamp is read only with seconds, nanoseconds and offset together, so none was read.";
export const offsetDefaultNote = (offset: string): string =>
  `No offset was given, so the instant was written with an offset of ${offset} seconds.`;

export const def = definePageTool({
  page: "ptp-clock-converter",
  name: "convert_ptp_timestamp",
  title: "PTP Clock Converter",
  doxTool: "showPtpClockConverter",
  returns:
    "read (for a timestamp) holds kind, seconds, nanoseconds, offset, utc, ignored (the count read with offset 0), valid and reason; check holds kind, announced, table, tableUtc and verdict; written (for an instant) holds kind, seconds, nanoseconds, back and reason; each is null without its inputs",
  argsSwaps: [[" Each is a string.", ""]],
  calls: ["isValidPtpTimestamp", "ptpToUtc", "taiMinusUtc", "utcToPtp"],
  rules: ["Give an instant, or give seconds, nanoseconds and offset together."],
  input: showPtpClockConverterInput,
  example: {
    seconds: read.seconds,
    nanoseconds: read.nanoseconds,
    offset: read.offset,
    instant: write.instant,
  },
  async run(args, signal) {
    const lib = await loadLibFor(loadIotLib, signal);
    const state = readArgs(args);
    const notes: string[] = [];
    const fields = [args.seconds, args.nanoseconds, args.offset];
    const wholeRead = fields.every((f) => f !== undefined);
    let reading = null;
    let checking = null;
    let written = null;
    if (wholeRead) {
      const r = readPtp(lib, state);
      reading = {
        kind: r.kind,
        seconds: r.record === null ? null : String(r.record.seconds),
        nanoseconds: r.record === null ? null : r.record.nanoseconds,
        offset: r.offset,
        utc: r.utc,
        ignored: r.ignored,
        valid: r.valid,
        reason: r.reason,
      };
      if (r.kind !== "read") notes.push(READ_REASONS[r.reason]);
      const c = checkOffset(lib, r);
      checking = {
        kind: c.kind,
        announced: c.announced,
        table: c.table,
        tableUtc: c.tableUtc,
        verdict: { title: c.verdict.title, detail: c.verdict.detail },
      };
    } else if (fields.some((f) => f !== undefined)) {
      notes.push(NEEDS_ALL_THREE);
    }
    if (args.instant !== undefined) {
      const w = writePtp(lib, state);
      written = {
        kind: w.kind,
        seconds: w.seconds === null ? null : String(w.seconds),
        nanoseconds: w.nanoseconds,
        back: w.back,
        reason: w.reason,
      };
      if (w.kind !== "written") notes.push(WRITE_REASONS[w.reason]);
      if (args.offset === undefined)
        notes.push(offsetDefaultNote(state.offset));
    }
    return {
      input: args,
      result: jsonSafe({ read: reading, check: checking, written }),
      notes,
      link: encodeWidgetPermalink("ptpclock", permalinkOf(state)),
    };
  },
});

export default toModelContextTool(def);
