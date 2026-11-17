import { billingLib as lib } from "~/test/ledger-lib";
import {
  BILLING_PRESETS,
  billingFacts,
  datesOf,
  explainNull,
  windowsOf,
  type BillingState,
} from "./billing-deadlines";

const stateOf = (id: string): BillingState => {
  const preset = BILLING_PRESETS.find((p) => p.id === id);
  if (!preset) throw new Error(`no preset ${id}`);
  return preset;
};

describe("billingFacts", () => {
  it("holds the chain billingTimeline lays out, and no reason", () => {
    const state = stateOf("thirty-day-30");
    const facts = billingFacts(state, lib);
    expect(facts.result).not.toBeNull();
    expect(facts.result).toEqual(
      lib.billingTimeline(datesOf(state), windowsOf(state)),
    );
    expect(facts.reason).toBeNull();
  });

  it("explains a refused chain the way the page does", () => {
    const state = { ...stateOf("thirty-day-30"), issueDays: "" };
    const facts = billingFacts(state, lib);
    expect(facts.result).toBeNull();
    expect(facts.reason).toEqual(explainNull(state, lib));
    expect(facts.reason?.reason).toBe("missing-window");
  });

  it("gives every preset a chain", () => {
    for (const preset of BILLING_PRESETS) {
      expect(billingFacts(preset, lib).result, preset.id).not.toBeNull();
    }
  });
});
