/**
 * WebMCP tool for `/tools/swift-value-date-reader/`: a six-digit SWIFT value date read into the
 * date it names, and an ISO date written as a value date, from the same `readValueDate` and
 * `writeValueDate` the page's redraw calls. A section with none of its fields given is `null`.
 */
import { showSwiftValueDateReaderInput } from "../../dox-tool-schemas";
import { loadFinanceLib } from "../../finance-lib";
import {
  deriveBands,
  permalinkOf,
  readArgs,
  READ_PRESETS,
  readValueDate,
  WRITE_PRESETS,
  writeValueDate,
} from "../../swift-value-date-reader";
import { encodeWidgetPermalink } from "../../widget-permalink";
import { jsonSafe } from "../json-safe";
import { loadLibFor } from "../load-lib";
import { definePageTool, toModelContextTool } from "../page-tool";

const read = READ_PRESETS[0];
const write = WRITE_PRESETS[0];
if (!read || !write) throw new Error("swift-value-date-reader: no presets");

export const def = definePageTool({
  page: "swift-value-date-reader",
  name: "read_swift_value_date",
  title: "SWIFT Value Date Reader",
  doxTool: "showSwiftValueDateReader",
  returns:
    "For a value, read holds kind (empty, read or refused), iso (the date it names), year, valid and code (T50 for a refused six-character value, else null); for a date, written holds kind, written (the YYMMDD text), back (the date read back from it) and same (whether it matches the date given); read is null with no value, written is null with no date",
  calls: [
    "parseSwiftDate",
    "isValidSwiftDate",
    "formatSwiftDate",
    "isValidDate",
  ],
  rules: ["Give a value, a date, or both."],
  input: showSwiftValueDateReaderInput,
  example: { value: read.text, date: write.text },
  async run(args, signal) {
    const lib = await loadLibFor(loadFinanceLib, signal);
    const state = readArgs(args);
    const bands = deriveBands(lib);
    const notes: string[] = [];
    let reading = null;
    let written = null;
    if (args.value !== undefined) {
      const r = readValueDate(lib, state.value, bands);
      reading = {
        kind: r.kind,
        iso: r.iso,
        year: r.year,
        valid: r.valid,
        code: r.code,
      };
      if (r.reason !== "") notes.push(r.reason);
    }
    if (args.date !== undefined) {
      const w = writeValueDate(lib, state.date, bands);
      written = {
        kind: w.kind,
        written: w.written,
        back: w.back,
        same: w.same,
      };
      if (w.reason !== "") notes.push(w.reason);
    }
    return {
      input: args,
      result: jsonSafe({ read: reading, written }),
      notes,
      link: encodeWidgetPermalink("swiftdate", permalinkOf(state)),
    };
  },
});

export default toModelContextTool(def);
