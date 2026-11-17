import { freeTimeLib as lib } from "~/test/ledger-lib";
import {
  FREE_TIME_PRESETS,
  chargeTermsOf,
  explainExpiryNull,
  explainNull,
  freeDaysOf,
  freeTimeFacts,
  termsOf,
  tiersOf,
  type LedgerState,
} from "./free-time-ledger";

const stateOf = (id: string): LedgerState => {
  const preset = FREE_TIME_PRESETS.find((p) => p.id === id);
  if (!preset) throw new Error(`no preset ${id}`);
  return preset;
};

describe("freeTimeFacts", () => {
  it("holds the two calls the redraw makes, unchanged", () => {
    const state = stateOf("friday-three-days");
    const facts = freeTimeFacts(state, lib);
    expect(facts.freeTime).toEqual(
      lib.freeTimeExpiry(state.clockStart, freeDaysOf(state), termsOf(state)),
    );
    const tiers = tiersOf(state);
    expect(facts.charges).toEqual(
      lib.chargeableDays(state.clockStart, state.clockEnd, freeDaysOf(state), {
        ...chargeTermsOf(state),
        ...(tiers === undefined ? {} : { tiers: tiers ?? [] }),
      }),
    );
    expect(facts.freeTime).not.toBeNull();
    expect(facts.charges).not.toBeNull();
    expect(facts.reason).toBeNull();
    expect(facts.expiryReason).toBeNull();
  });

  it("reads every preset as a result and the one with no free days names why it has no expiry", () => {
    for (const preset of FREE_TIME_PRESETS) {
      const facts = freeTimeFacts(preset, lib);
      if (preset.id === "no-free-time") {
        expect(facts.freeTime, preset.id).toBeNull();
        expect(facts.expiryReason, preset.id).toBe("no-free-days");
        expect(facts.charges, preset.id).not.toBeNull();
        continue;
      }
      expect(facts.freeTime, preset.id).not.toBeNull();
      expect(facts.charges, preset.id).not.toBeNull();
    }
  });

  it("explains charges the library refuses, and says the expiry still reads", () => {
    const state = {
      ...stateOf("friday-three-days"),
      clockEnd: "2024-06-10T00:00:00Z",
    };
    const facts = freeTimeFacts(state, lib);
    expect(facts.charges).toBeNull();
    expect(facts.reason).toBe(explainNull(state, lib));
    expect(facts.reason).toBe("inverted");
    expect(facts.freeTime).not.toBeNull();
    expect(facts.expiryReason).toBeNull();
  });

  it("explains an expiry the library refuses", () => {
    const state = { ...stateOf("friday-three-days"), clockStart: "later" };
    const facts = freeTimeFacts(state, lib);
    expect(facts.freeTime).toBeNull();
    expect(facts.expiryReason).toBe(explainExpiryNull(state, lib));
    expect(facts.expiryReason).toBe("invalid-start");
  });
});
