/**
 * WebMCP tool for `/tools/dwell-ledger/`: how long a dwell lasted and which local days it touched,
 * computed by the same `dwellFacts` the page's redraw calls.
 */
import {
  DWELL_PRESETS,
  NO_ZONE,
  dwellFacts,
  dwellNotes,
  resolveWallTime,
} from "../../dwell-ledger";
import { showDwellLedgerInput } from "../../dox-tool-schemas";
import { loadDwellLib } from "../../ledger-lib";
import { encodeWidgetPermalink } from "../../widget-permalink";
import { jsonSafe } from "../json-safe";
import { loadLibFor } from "../load-lib";
import { definePageTool, toModelContextTool } from "../page-tool";

const first = DWELL_PRESETS[0];
if (!first) throw new Error("dwell-ledger: no presets");

export const def = definePageTool({
  page: "dwell-ledger",
  name: "compute_dwell_time",
  title: "Dwell Ledger",
  doxTool: "showDwellLedger",
  returns:
    "The elapsed hours of the dwell and the number of local calendar days it touched in the zone, with those dates listed, and the same count in the second zone when one was given. The result is empty with the reason when the library refuses the dwell, such as an exit before the entry",
  calls: ["dwellTime"],
  input: showDwellLedgerInput,
  example: { entry: first.entry, exit: first.exit, zone: first.zone },
  async run(args, signal) {
    const lib = await loadLibFor(loadDwellLib, signal);
    const zone = args.zone;
    // A wall time with no offset is read in the zone the reader named, as the page reads it.
    const state = {
      entry: resolveWallTime(args.entry, zone),
      exit: resolveWallTime(args.exit, zone),
      zone,
      compareZone: args.compareZone ?? NO_ZONE,
    };
    const facts = dwellFacts(state, lib);
    return {
      input: args,
      result: jsonSafe(facts),
      notes: dwellNotes(state, facts),
      link: encodeWidgetPermalink("dwell", {
        entry: state.entry,
        exit: state.exit,
        zone: state.zone,
        ...(state.compareZone === NO_ZONE
          ? {}
          : { compareZone: state.compareZone }),
      }),
    };
  },
});

export default toModelContextTool(def);
