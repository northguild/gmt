import { describe, expect, it } from "vitest";
import { clearLabels, nudgeInto } from "./zone-map-labels";

const box = (left: number, top: number, width = 100, height = 30) => ({
  left,
  top,
  right: left + width,
  bottom: top + height,
});

describe("clearLabels", () => {
  it("keeps every label when none meet", () => {
    expect(clearLabels([box(0, 0), box(200, 0), box(0, 100)])).toEqual([
      true,
      true,
      true,
    ]);
  });

  it("drops a later label that meets an earlier one, so the order is the priority", () => {
    expect(clearLabels([box(0, 0), box(50, 10)])).toEqual([true, false]);
    expect(clearLabels([box(50, 10), box(0, 0)])).toEqual([true, false]);
  });

  it("keeps two pixels clear between labels", () => {
    expect(clearLabels([box(0, 0), box(101, 0)])).toEqual([true, false]);
    expect(clearLabels([box(0, 0), box(102, 0)])).toEqual([true, true]);
    expect(clearLabels([box(0, 0), box(0, 32)])).toEqual([true, true]);
  });

  it("tests a label against the kept ones only, not the dropped", () => {
    // The second meets the first and goes; the third meets only the second, so it stays.
    expect(clearLabels([box(0, 0), box(90, 0), box(190, 0)])).toEqual([
      true,
      false,
      true,
    ]);
  });

  it("keeps a label with no laid-out size, and lets it hide nothing", () => {
    expect(clearLabels([box(0, 0, 0, 0), box(0, 0)])).toEqual([true, true]);
    expect(clearLabels([box(0, 0), box(0, 0, 0, 0)])).toEqual([true, true]);
  });

  it("drops a label that crosses its card's edge, and lets it hide nothing", () => {
    // Honolulu at 1440 px: 96 px of text in a 93 px card.
    const card = box(482, 400, 93, 140);
    const wide = { ...box(481, 450, 96), within: card };
    const later = box(481, 450);
    expect(clearLabels([wide, later])).toEqual([false, true]);
  });

  it("keeps a label whole inside its card, with half a pixel of slack", () => {
    const card = box(0, 0, 100, 100);
    expect(clearLabels([{ ...box(0, 10), within: card }])).toEqual([true]);
    expect(clearLabels([{ ...box(-0.5, 10, 100.5), within: card }])).toEqual([
      true,
    ]);
    expect(clearLabels([{ ...box(0, 71), within: card }])).toEqual([false]);
  });

  it("holds no label with no laid-out size to its card", () => {
    expect(
      clearLabels([{ ...box(500, 500, 0, 0), within: box(0, 0) }]),
    ).toEqual([true]);
  });
});

describe("nudgeInto", () => {
  const card = box(100, 100, 100, 100);

  it("leaves a label already inside its card where it is", () => {
    expect(nudgeInto(box(120, 120, 40, 30), card)).toEqual({ dx: 0, dy: 0 });
  });

  it("pushes a label across an edge back in, by just as much", () => {
    // Guam near its card's left and bottom edges.
    expect(nudgeInto(box(90, 180, 40, 30), card)).toEqual({ dx: 10, dy: -10 });
    expect(nudgeInto(box(170, 95, 40, 30), card)).toEqual({ dx: -10, dy: 5 });
  });

  it("gives up on a label wider or taller than its card", () => {
    expect(nudgeInto(box(90, 120, 110, 30), card)).toBeNull();
    expect(nudgeInto(box(120, 90, 40, 110), card)).toBeNull();
    expect(nudgeInto(box(99.75, 120, 100.5, 30), card)).toEqual({
      dx: 0.25,
      dy: 0,
    });
  });
});
