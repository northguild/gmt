/**
 * WebMCP tool for `/tools/free-time-ledger/`: when a container's free time ends and which days are
 * charged, computed by the same `freeTimeFacts` the page's redraw calls.
 */
import {
  FREE_TIME_PRESETS,
  NULL_REASON_TEXT,
  freeTimeFacts,
  readArgs,
  type LedgerState,
} from "../../free-time-ledger";
import { showFreeTimeLedgerInput } from "../../dox-tool-schemas";
import { loadFreeTimeLib } from "../../ledger-lib";
import { encodeWidgetPermalink } from "../../widget-permalink";
import { jsonSafe } from "../json-safe";
import { loadLibFor } from "../load-lib";
import { definePageTool, toModelContextTool } from "../page-tool";

const first = FREE_TIME_PRESETS[0];
if (!first) throw new Error("free-time-ledger: no presets");

/** The strings the page's permalink carries: the lists only when a working-day count reads them. */
function permalinkOf(state: LedgerState): Record<string, string> {
  const out: Record<string, string> = {
    clockStart: state.clockStart,
    clockEnd: state.clockEnd,
    freeDays: state.freeDays,
    firstDay: state.firstDay,
    basis: state.basis,
    chargeBasis: state.chargeBasis,
    zone: state.zone,
  };
  if (state.basis === "working" || state.chargeBasis === "working") {
    out["weekend"] = state.weekend.join(",");
    const holidays = state.holidays
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .join(",");
    if (holidays) out["holidays"] = holidays;
  }
  if (state.tiers.trim()) out["tiers"] = state.tiers.trim();
  return out;
}

export const def = definePageTool({
  page: "free-time-ledger",
  name: "compute_free_time_and_demurrage",
  title: "Free Time Ledger",
  doxTool: "showFreeTimeLedger",
  returns:
    "How many free days a container has, the date free time ends, and the chargeable days with their dates",
  argsSwaps: [
    [
      "many tariffs count both in calendar days, and where free time is in working days most charge calendar days after it, some working days only; ask",
      "most charge calendar days, even after working-day free time; some charge working days only; ask",
    ],
    [
      "a plain 2024-06-14T15:00:00 is read as wall time in zone",
      "one with no offset is read as wall time in zone",
    ],
  ],
  calls: ["freeTimeExpiry", "chargeableDays"],
  input: showFreeTimeLedgerInput,
  example: {
    clockStart: first.clockStart,
    clockEnd: first.clockEnd,
    freeDays: Number(first.freeDays),
    firstDay: first.firstDay,
    basis: first.basis,
    chargeBasis: first.chargeBasis,
    zone: first.zone,
  },
  async run(args, signal) {
    const lib = await loadLibFor(loadFreeTimeLib, signal);
    const state = readArgs(args);
    const facts = freeTimeFacts(state, lib);
    return {
      input: args,
      result: jsonSafe(facts),
      notes: [
        ...(facts.expiryReason ? [NULL_REASON_TEXT[facts.expiryReason]] : []),
        ...(facts.reason && facts.reason !== facts.expiryReason
          ? [NULL_REASON_TEXT[facts.reason]]
          : []),
      ],
      link: encodeWidgetPermalink("freetime", permalinkOf(state)),
    };
  },
});

export default toModelContextTool(def);
