import { transportLib as lib } from "~/test/transport-lib";
import {
  CROSSING_PRESETS,
  crossingFacts,
  explainNull,
  type CrossingState,
} from "./crossing-clock";

const stateOf = (id: string): CrossingState => {
  const preset = CROSSING_PRESETS.find((p) => p.id === id);
  if (!preset) throw new Error(`no preset ${id}`);
  return preset.state;
};

describe("crossingFacts", () => {
  it("returns the crossing and no reason when the library reads it", () => {
    const state = stateOf("canal");
    const facts = crossingFacts(state, lib);
    expect(facts.result).toEqual(
      lib.crossingTime(state.entry, state.exit, state.targetZone),
    );
    expect(facts.result?.duration).toBe("PT9H30M");
    expect(facts.reason).toBeNull();
  });

  it("returns the reason the library refuses a crossing", () => {
    const state = stateOf("inverted");
    const facts = crossingFacts(state, lib);
    expect(facts.result).toBeNull();
    expect(facts.reason).toBe(
      explainNull(state.entry, state.exit, state.targetZone, lib),
    );
    expect(facts.reason).toBe("inverted");
  });

  it("names an entry that is not an instant", () => {
    const facts = crossingFacts(
      { ...stateOf("canal"), entry: "tomorrow" },
      lib,
    );
    expect(facts.reason).toBe("invalid-entry");
  });
});
