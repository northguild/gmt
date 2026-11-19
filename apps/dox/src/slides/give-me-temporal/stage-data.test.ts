import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { zoneMatrixSummary } from "~/data/zone-matrix";
import { resolvePlace, setPlanetZones, setPoints } from "~/lib/slides/places";
import { applyStageData } from "~/lib/slides/stage-data";
import { LAPSES } from "./lapses";
import { STAGE } from "./stage-data";

/** Every `.astro` file that writes this deck's slides. */
const dir = import.meta.dirname;
const sources = [
  resolve(dir, "Deck0.astro"),
  ...readdirSync(resolve(dir, "components"))
    .filter((f) => f.endsWith(".astro"))
    .map((f) => resolve(dir, "components", f)),
].map((file) => readFileSync(file, "utf8"));

afterEach(() => {
  setPoints({});
  setPlanetZones([]);
});

describe("Deck 0's stage data", () => {
  it("turns the planet on the zones GMT's CI runs in", () => {
    applyStageData(STAGE);
    expect(STAGE.planetZones).toEqual(zoneMatrixSummary.zones);
    expect(STAGE.planetZones).toHaveLength(10);
  });

  it("keeps every planet zone in the coordinate table", () => {
    for (const zone of STAGE.planetZones)
      expect(resolvePlace(zone)).toMatchObject({ kind: "zone", zone });
  });

  it("keeps every lapse's zones in the coordinate table", () => {
    for (const def of Object.values(LAPSES))
      for (const zone of def.zones)
        expect(resolvePlace(zone)).toMatchObject({ kind: "zone" });
  });

  it("lists the wall's images for the readiness check", () => {
    expect(STAGE.assetRows.map((r) => r.id)).toEqual(["wall"]);
    expect(sources.join("")).toContain("data-wall-pane");
  });
});
