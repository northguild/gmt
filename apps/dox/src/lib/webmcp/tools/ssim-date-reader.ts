/**
 * WebMCP tool for `/tools/ssim-date-reader/`: an IATA SSIM date read in a window the caller
 * states, beside the locale pattern parser and the write-back, from the same `buildModel` the
 * page's full redraw calls. A call with no window opens with the window blank, never a century.
 */
import { loadAviationLib } from "../../aviation-lib";
import { showSsimDateReaderInput } from "../../dox-tool-schemas";
import {
  buildModel,
  permalinkOf,
  READ_REASONS,
  readArgs,
  SSIM_PRESETS,
  WRITE_REASONS,
} from "../../ssim-date-reader";
import { encodeWidgetPermalink } from "../../widget-permalink";
import { jsonSafe } from "../json-safe";
import { loadLibFor } from "../load-lib";
import { definePageTool, toModelContextTool } from "../page-tool";

const first = SSIM_PRESETS[0];
if (!first) throw new Error("ssim-date-reader: no presets");

export const def = definePageTool({
  page: "ssim-date-reader",
  name: "read_ssim_date",
  title: "SSIM Date Reader",
  doxTool: "showSsimDateReader",
  returns:
    "The ISO date an SSIM date reads as in the stated window, the date the locale pattern parser reads from the same text, and the SSIM date that an ISO date writes as",
  calls: [
    "parseSsimDate",
    "isValidSsimDate",
    "parseDateWithPattern",
    "formatSsimDate",
  ],
  rules: ["Give an SSIM date to read, or an ISO date to write."],
  input: showSsimDateReaderInput,
  example: {
    value: first.value,
    yearWindow: Number(first.window),
    locale: first.locale,
    date: first.date,
  },
  async run(args, signal) {
    const lib = await loadLibFor(loadAviationLib, signal);
    const state = readArgs({
      ...(args.value === undefined ? {} : { value: args.value }),
      ...(args.yearWindow === undefined
        ? {}
        : { window: String(args.yearWindow) }),
      ...(args.locale === undefined ? {} : { locale: args.locale }),
      ...(args.date === undefined ? {} : { date: args.date }),
    });
    const model = buildModel(lib, state);
    const notes: string[] = [];
    if (!model.read.blank && model.read.ssim === null) {
      notes.push(READ_REASONS[model.read.reason]);
    }
    if (!model.write.blank && model.write.written === null) {
      notes.push(WRITE_REASONS[model.write.reason]);
    }
    return {
      input: args,
      result: jsonSafe(model),
      notes,
      link: encodeWidgetPermalink("ssim", permalinkOf(state)),
    };
  },
});

export default toModelContextTool(def);
