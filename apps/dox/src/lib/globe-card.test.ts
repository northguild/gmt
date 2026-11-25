import { describe, expect, it } from "vitest";
import { placeTooltip } from "./globe-card";

describe("placeTooltip", () => {
  const base = {
    width: 600,
    cardWidth: 120,
    cardHeight: 90,
    y: 300,
    top: 0,
    bottom: null,
    pad: 8,
  };

  it("without a limit is the plain clamp inside the host", () => {
    expect(placeTooltip({ ...base, x: 300, limit: null })).toEqual({
      x: 300,
      y: 300,
      below: false,
      occluded: false,
    });
    expect(placeTooltip({ ...base, x: 10, limit: null }).x).toBe(68);
    expect(placeTooltip({ ...base, x: 590, limit: null }).x).toBe(532);
  });

  it("keeps the card's right edge at or short of the limit", () => {
    const placed = placeTooltip({ ...base, x: 430, limit: 450 });
    expect(placed.x + base.cardWidth / 2).toBeLessThanOrEqual(450);
    expect(placed.occluded).toBe(false);
  });

  it("hides the card when the pin is at or past the limit", () => {
    expect(placeTooltip({ ...base, x: 450, limit: 450 }).occluded).toBe(true);
    expect(placeTooltip({ ...base, x: 500, limit: 450 }).occluded).toBe(true);
    expect(placeTooltip({ ...base, x: 449, limit: 450 }).occluded).toBe(false);
  });

  it("flips below the pin when the card would rise past the top bound", () => {
    const at = (y: number) => placeTooltip({ ...base, x: 300, y, limit: null });
    expect(at(106).below).toBe(false);
    expect(at(105).below).toBe(true);
    expect(at(20).below).toBe(true);
  });

  /* On a phone the stage sits under the hero's intro, inside a layer as tall as the page: a card
     flipped only at the page's top covered the last lines of the tagline (320 x 568). */
  it("takes the bound from the caller, below the host's top", () => {
    const at = (y: number) =>
      placeTooltip({ ...base, x: 300, y, top: 278, limit: null });
    expect(at(384).below).toBe(false);
    expect(at(383).below).toBe(true);
  });

  it("hangs the card 12px below its pin when flipped", () => {
    const placed = placeTooltip({ ...base, x: 300, y: 40, limit: null });
    expect(placed).toMatchObject({ y: 52, below: true });
  });

  /* On a phone the open zone sheet lies over the Earth and the card is in the top layer: a card
     reaching past the sheet's top was drawn over the zone list (390 x 844). */
  it("hides the card when it would reach past the bottom bound", () => {
    const at = (y: number, bottom: number) =>
      placeTooltip({ ...base, x: 300, y, bottom, limit: null }).occluded;
    expect(at(364, 364)).toBe(false);
    expect(at(365, 364)).toBe(true);
    expect(
      placeTooltip({ ...base, x: 300, y: 40, bottom: 141, limit: null })
        .occluded,
    ).toBe(true);
    expect(
      placeTooltip({ ...base, x: 300, y: 40, bottom: 142, limit: null })
        .occluded,
    ).toBe(false);
  });
});
