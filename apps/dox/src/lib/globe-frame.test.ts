import { describe, expect, it } from "vitest";
import {
  ATMOSPHERE,
  frameBand,
  SPACE_CLEARANCE,
  STACK_CLEARANCE,
} from "./globe-frame";

const row = { offsetTop: 334, offsetWidth: 226, offsetHeight: 46 };
const column = { offsetTop: 20, offsetWidth: 46, offsetHeight: 226 };

describe("frameBand", () => {
  it("centres the disc and fills 0.94 of the half-size when the stack is a column", () => {
    const { mid, fit } = frameBand({ width: 800, height: 600 }, column, false);
    expect(mid).toBe(300);
    expect(fit).toBeCloseTo(
      Math.min(300 * 0.94, (300 - SPACE_CLEARANCE) / ATMOSPHERE),
      6,
    );
  });

  it("keeps the wide layout on the centred rule even with a row", () => {
    const { mid } = frameBand({ width: 800, height: 380 }, row, true);
    expect(mid).toBe(190);
  });

  it("on a phone centres the disc above the zoom row, its atmosphere inside the band", () => {
    const { mid, fit } = frameBand({ width: 361, height: 380 }, row, false);
    const above = 334 - STACK_CLEARANCE;
    expect(mid).toBe(above / 2);
    expect(fit * ATMOSPHERE).toBeCloseTo(above / 2, 6);
    expect(mid + fit * ATMOSPHERE).toBeLessThanOrEqual(above + 1e-9);
  });

  it("is bound by the width where the band above the row is tall: the atmosphere spans the stage", () => {
    /* An iPhone 15: the stage is the viewport less two 16px gutters (globe-phone.module.css).
       The atmosphere is drawn whole: a disc as wide as the stage had its rim cut at the sides. */
    const { fit } = frameBand(
      { width: 361, height: 600 },
      { offsetTop: 554, offsetWidth: 226, offsetHeight: 46 },
      false,
    );
    expect(2 * fit * ATMOSPHERE).toBeCloseTo(361, 6);
  });
});
