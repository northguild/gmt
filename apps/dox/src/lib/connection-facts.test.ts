import { transportLib as lib } from "~/test/transport-lib";
import {
  CONNECTION_PRESETS,
  connectionFacts,
  legsOf,
  naiveCheck,
  verdict,
  type ConnectionState,
} from "./connection-checker";
import type { ScheduleLeg } from "./transport-widgets";

const stateOf = (id: string): ConnectionState => {
  const preset = CONNECTION_PRESETS.find((p) => p.id === id);
  if (!preset) throw new Error(`no preset ${id}`);
  return preset.state;
};

describe("connectionFacts", () => {
  it("holds the calls the redraw makes, unchanged", () => {
    const state = stateOf("made");
    const facts = connectionFacts(state, lib);
    expect(facts.result).toEqual(lib.scheduleDelivery(legsOf(state)));
    expect(facts.verdict).toEqual(verdict(legsOf(state), lib));
    expect(facts.naive).toEqual(naiveCheck(state));
    expect(facts.verdict.kind).toBe("made");
    expect(facts.arrival).toBe("2024-06-15T11:10:00Z");
    expect(facts.diagnosis).toBeNull();
  });

  it("reads a missed connection with no diagnosis to explain", () => {
    const facts = connectionFacts(stateOf("spring-forward"), lib);
    expect(facts.result).toBeNull();
    expect(facts.verdict.kind).toBe("missed");
    expect(facts.diagnosis).toBeNull();
  });

  it("diagnoses a connection the library cannot give a verdict on", () => {
    const facts = connectionFacts(
      { ...stateOf("made"), inboundDuration: "soon" },
      lib,
    );
    expect(facts.result).toBeNull();
    expect(facts.verdict.kind).toBe("no-verdict");
    expect(facts.diagnosis).not.toBeNull();
    expect(facts.arrival).toBeUndefined();
  });

  it("reports a range error from the single-leg arrival instead of throwing", () => {
    const state = stateOf("made");
    const legs = legsOf(state);
    const throwing = {
      ...lib,
      scheduleDelivery: (l: ScheduleLeg[]) => {
        if (l.length === 1) {
          throw new RangeError("out of range");
        }
        return lib.scheduleDelivery(l);
      },
    } as typeof lib;
    const facts = connectionFacts(state, throwing);
    expect(facts.arrivalOutOfRange).toBe(true);
    expect(facts.arrival).toBeUndefined();
    expect(facts.result).toEqual(lib.scheduleDelivery(legs));
  });

  it("does not hide other errors from the single-leg arrival", () => {
    const state = stateOf("made");
    const throwing = {
      ...lib,
      scheduleDelivery: (l: ScheduleLeg[]) => {
        if (l.length === 1) throw new TypeError("bug");
        return lib.scheduleDelivery(l);
      },
    } as typeof lib;
    expect(() => connectionFacts(state, throwing)).toThrow(TypeError);
  });
});
