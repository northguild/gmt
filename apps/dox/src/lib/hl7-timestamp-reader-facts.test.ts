/**
 * `hl7Facts`: the three facts the page's redraw and the WebMCP tool share. It is the page's own
 * reading, strip and ladder, so each one is checked against the function that makes it.
 */
import { hl7Lib as lib } from "~/test/hl7-lib";
import {
  hl7Facts,
  ladderOf,
  readHl7,
  stripOf,
  type Hl7State,
} from "./hl7-timestamp-reader";

const stateOf = (value: string, ...zones: string[]): Hl7State => ({
  value,
  zones: [zones[0] ?? "", zones[1] ?? "", zones[2] ?? "", zones[3] ?? ""],
});

describe("hl7Facts", () => {
  it("reads a local time and draws its strip and ladder from the same reading", () => {
    const state = stateOf("20240615103000", "Asia/Kolkata", "Europe/London");
    const facts = hl7Facts(state, lib);
    expect(facts.read).toEqual(readHl7(state, lib));
    expect(facts.strip).toEqual(
      stripOf("2024-06-15T10:30:00", state.zones, lib),
    );
    expect(facts.strip?.rows.filter((r) => r.zone !== "")).toHaveLength(2);
    expect(facts.ladder).toEqual(ladderOf(facts.read, facts.strip, lib));
  });

  it("has no strip for a value that states its offset", () => {
    const state = stateOf("20240615103000+0200", "Europe/London");
    const facts = hl7Facts(state, lib);
    expect(facts.read.parsed?.kind).toBe("instant");
    expect(facts.strip).toBeNull();
    expect(facts.ladder).toEqual(ladderOf(facts.read, null, lib));
  });

  it("has no strip for a partial value, and still gives a ladder", () => {
    const state = stateOf("2024", "Europe/London");
    const facts = hl7Facts(state, lib);
    expect(facts.read.parsed?.kind).toBe("partial");
    expect(facts.strip).toBeNull();
    expect(facts.ladder).toEqual(ladderOf(facts.read, null, lib));
  });

  it("has no strip for a value the library refuses, and the ladder has no rows to fill", () => {
    const state = stateOf("not a timestamp", "Europe/London");
    const facts = hl7Facts(state, lib);
    expect(facts.read.parsed).toBeNull();
    expect(facts.strip).toBeNull();
    expect(facts.ladder).toEqual(ladderOf(facts.read, null, lib));
  });
});
