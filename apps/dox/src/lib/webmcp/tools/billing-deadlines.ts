/**
 * WebMCP tool for `/tools/billing-deadlines/`: the last dates to issue, dispute and resolve an
 * invoice, computed by the same `billingFacts` the page's redraw calls.
 */
import {
  BILLING_PRESETS,
  billingFacts,
  nullReasonText,
  readArgs,
  type BillingState,
} from "../../billing-deadlines";
import { showBillingDeadlinesInput } from "../../dox-tool-schemas";
import { loadBillingLib } from "../../ledger-lib";
import { encodeWidgetPermalink } from "../../widget-permalink";
import { jsonSafe } from "../json-safe";
import { loadLibFor } from "../load-lib";
import { definePageTool, toModelContextTool } from "../page-tool";

const first = BILLING_PRESETS[0];
if (!first) throw new Error("billing-deadlines: no presets");

/** Strings only, and only the fields that are not blank, as the page's permalink carries them. */
function permalinkOf(state: BillingState): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of Object.keys(state) as (keyof BillingState)[]) {
    if (state[key] !== "") out[key] = state[key];
  }
  return out;
}

export const def = definePageTool({
  page: "billing-deadlines",
  name: "compute_billing_deadlines",
  title: "Billing Deadlines",
  doxTool: "showBillingDeadlines",
  returns:
    "The last dates to issue, dispute and resolve, and whether each date given falls on or before its deadline. The result is empty, with the reason, when the library refuses the dates",
  calls: ["billingTimeline"],
  input: showBillingDeadlinesInput,
  example: {
    anchorOn: first.anchorOn,
    invoiceIssuedOn: first.invoiceIssuedOn,
    issueDays: Number(first.issueDays),
    disputeDays: Number(first.disputeDays),
    resolutionDays: Number(first.resolutionDays),
  },
  async run(args, signal) {
    const lib = await loadLibFor(loadBillingLib, signal);
    const state = readArgs(args);
    const facts = billingFacts(state, lib);
    return {
      input: args,
      result: jsonSafe(facts),
      notes: facts.reason ? [nullReasonText(facts.reason)] : [],
      link: encodeWidgetPermalink("billing", permalinkOf(state)),
    };
  },
});

export default toModelContextTool(def);
