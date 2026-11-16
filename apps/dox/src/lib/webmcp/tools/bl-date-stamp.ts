/**
 * WebMCP tool for `/tools/bl-date-stamp/`: the calendar date a bill of lading carries for a
 * moment at a place, set beside the UTC date, computed by the same `readBlDate` the page's
 * redraw calls.
 */
import {
  BL_DATE_PRESETS,
  blNullText,
  permalinkOf,
  readArgs,
  readBlDate,
} from "../../bl-date-stamp";
import { showBlDateStampInput } from "../../dox-tool-schemas";
import { loadBlDateLib } from "../../ledger-lib";
import { encodeWidgetPermalink } from "../../widget-permalink";
import { jsonSafe } from "../json-safe";
import { loadLibFor } from "../load-lib";
import { definePageTool, toModelContextTool } from "../page-tool";

const first = BL_DATE_PRESETS[0];
if (!first) throw new Error("bl-date-stamp: no presets");

export const def = definePageTool({
  page: "bl-date-stamp",
  name: "compute_bill_of_lading_date",
  title: "B/L Date Stamp",
  doxTool: "showBlDateStamp",
  returns:
    "The date a bill of lading carries at the place, the UTC date, whether they match, and the date in each other calendar asked for. The result is empty, with the reason, when the library gives no date",
  calls: ["bolTimestamp", "areDatesEqual", "isAfterDate", "isValidDate"],
  input: showBlDateStampInput,
  example: {
    value: first.value,
    event: first.event as "shippedOnBoard",
    timeZone: first.timeZone,
    zone2: first.zone2,
  },
  async run(args, signal) {
    const lib = await loadLibFor(loadBlDateLib, signal);
    const state = readArgs(args);
    const read = readBlDate(state, lib);
    return {
      input: args,
      result: jsonSafe(read),
      notes: read.bl === "" ? [blNullText(state, lib)] : [],
      link: encodeWidgetPermalink("bldate", permalinkOf(state)),
    };
  },
});

export default toModelContextTool(def);
