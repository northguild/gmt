/**
 * WebMCP tool for `/tools/epcis-event-reader/`: the two time fields of a GS1 EPCIS event, computed
 * by the same `readEpcis` the page's redraw calls.
 */
import {
  EPCIS_PRESETS,
  epcisNullText,
  permalinkOf,
  readArgs,
  readEpcis,
} from "../../epcis-event-reader";
import { showEpcisEventReaderInput } from "../../dox-tool-schemas";
import { loadEpcisLib } from "../../edi-lib";
import { encodeWidgetPermalink } from "../../widget-permalink";
import { jsonSafe } from "../json-safe";
import { loadLibFor } from "../load-lib";
import { definePageTool, toModelContextTool } from "../page-tool";

const first = EPCIS_PRESETS[0];
if (!first) throw new Error("epcis-event-reader: no presets");

export const def = definePageTool({
  page: "epcis-event-reader",
  name: "read_epcis_event_time",
  title: "EPCIS Event Reader",
  doxTool: "showEpcisEventReader",
  returns:
    "The instant, the offset and the local time at the event, whether the offset is stated, and the UTC and local dates of the same moment with how they compare. The result is empty with the reason when the library refuses the event, such as an offset it does not read or no offset at all. Every library call made, with its result, is included",
  calls: ["parseEpcisEvent", "convertUtcToPlainDate", "chopTime"],
  input: showEpcisEventReaderInput,
  example: {
    eventTime: first.eventTime,
    eventTimeZoneOffset: first.eventTimeZoneOffset,
  },
  async run(args, signal) {
    const lib = await loadLibFor(loadEpcisLib, signal);
    const state = readArgs(args);
    const read = readEpcis(state, lib);
    return {
      input: args,
      result: jsonSafe(read),
      notes:
        !read.blank && read.result === null ? [epcisNullText(state, lib)] : [],
      link: encodeWidgetPermalink("epcis", permalinkOf(state)),
    };
  },
});

export default toModelContextTool(def);
