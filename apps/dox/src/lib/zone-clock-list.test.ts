/// <reference types="vitest/globals" />

import { describe, expect, it } from "vitest";
import { nextActiveIndex, zoneOptionId } from "./zone-clock-list";

describe("nextActiveIndex", () => {
  const COUNT = 20;

  it("moves down/up by one, clamped at the ends", () => {
    expect(nextActiveIndex("ArrowDown", 5, COUNT)).toBe(6);
    expect(nextActiveIndex("ArrowUp", 5, COUNT)).toBe(4);
    expect(nextActiveIndex("ArrowDown", COUNT - 1, COUNT)).toBe(COUNT - 1);
    expect(nextActiveIndex("ArrowUp", 0, COUNT)).toBe(0);
  });

  it("pages by ten, clamped at the ends", () => {
    expect(nextActiveIndex("PageDown", 5, COUNT)).toBe(15);
    expect(nextActiveIndex("PageUp", 15, COUNT)).toBe(5);
    expect(nextActiveIndex("PageDown", COUNT - 5, COUNT)).toBe(COUNT - 1);
    expect(nextActiveIndex("PageUp", 3, COUNT)).toBe(0);
  });

  it("jumps to the first/last index on Home/End", () => {
    expect(nextActiveIndex("Home", 12, COUNT)).toBe(0);
    expect(nextActiveIndex("End", 3, COUNT)).toBe(COUNT - 1);
  });

  it("leaves current unchanged for an unhandled key", () => {
    expect(nextActiveIndex("Tab", 7, COUNT)).toBe(7);
    expect(nextActiveIndex("a", 7, COUNT)).toBe(7);
  });

  it("returns current unchanged when count is zero (empty list)", () => {
    expect(nextActiveIndex("ArrowDown", 0, 0)).toBe(0);
    expect(nextActiveIndex("End", 3, 0)).toBe(3);
  });

  it("clamps a single-item list to index 0 for every key", () => {
    expect(nextActiveIndex("ArrowDown", 0, 1)).toBe(0);
    expect(nextActiveIndex("PageDown", 0, 1)).toBe(0);
    expect(nextActiveIndex("End", 0, 1)).toBe(0);
  });
});

describe("zoneOptionId", () => {
  it("is stable for a given panel id and index, independent of mounting", () => {
    expect(zoneOptionId("gmt-globe-clocks", 3)).toBe("gmt-globe-clocks-opt-3");
    expect(zoneOptionId("gmt-globe-clocks", 3)).toBe(
      zoneOptionId("gmt-globe-clocks", 3),
    );
  });

  it("differs across panels and across indices", () => {
    expect(zoneOptionId("panel-a", 0)).not.toBe(zoneOptionId("panel-b", 0));
    expect(zoneOptionId("panel-a", 0)).not.toBe(zoneOptionId("panel-a", 1));
  });
});
