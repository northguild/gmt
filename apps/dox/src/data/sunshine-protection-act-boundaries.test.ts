/**
 * The page's literal lists and the boundary file the map draws must name the same places: the
 * chat checks a state against `STATE_CODES` and a name against `us-state-names.json` without
 * loading the geometry, so a drift would pin a state no shape answers to, or draw one the chat
 * refuses.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import stateNames from "../lib/us-state-names.json";
import { STATE_CODES } from "./sunshine-protection-act-proposals";

interface Boundaries {
  features: { properties: { postal: string; name: string } }[];
}

const boundaries = JSON.parse(
  readFileSync(
    resolve(__dirname, "../../public/state-boundaries-us.json"),
    "utf8",
  ),
) as Boundaries;

describe("the state lists and the boundary file", () => {
  it("name the same 56 places", () => {
    const drawn = boundaries.features.map((f) => f.properties.postal).sort();
    expect([...STATE_CODES].sort()).toEqual(drawn);
    expect(Object.keys(stateNames).sort()).toEqual(drawn);
  });

  it("give each place the same name", () => {
    for (const { properties } of boundaries.features)
      expect((stateNames as Record<string, string>)[properties.postal]).toBe(
        properties.name,
      );
  });
});
