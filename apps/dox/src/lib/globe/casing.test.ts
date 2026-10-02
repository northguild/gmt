/// <reference types="vitest/globals" />

import { describe, expect, it } from "vitest";
import {
  LABEL_HALO_CSS,
  LABEL_OFFSET_X,
  LABEL_RING_GAP_CSS,
  labelRingShift,
} from "./casing";

describe("labelRingShift", () => {
  it("leaves an unringed marker's label where it is", () => {
    expect(labelRingShift(undefined)).toBe(0);
  });

  it("moves a ringed marker's label until its halo clears the ring", () => {
    const ring = { radius: 8, width: 1.5 };
    const shift = labelRingShift(ring);
    const ringEdge = ring.radius + ring.width / 2;
    // The halo's left edge, after the shift, lies outside the ring by the gap.
    expect(LABEL_OFFSET_X + shift - LABEL_HALO_CSS).toBeCloseTo(
      ringEdge + LABEL_RING_GAP_CSS,
      10,
    );
  });

  it("never moves a label left, even round a ring smaller than its offset", () => {
    expect(labelRingShift({ radius: 1, width: 0.5 })).toBe(0);
  });
});
