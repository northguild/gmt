import { describe, expect, it } from "vitest";
import { colourMapOrdered } from "./sun-colour-map.mjs";

/** Packed bytes of `n` pixels along a colour table, `table(t)` for t in 0..1. */
const ramp = (table: (t: number) => number[], n = 4000): Uint8Array =>
  Uint8Array.from(
    Array.from({ length: n }, (_, i) => table(i / (n - 1))).flat(),
  );

/* The shape of the ESA table, measured on the pinned JPEG: red first, then green, then blue. */
const orange = (t: number) => [
  Math.min(255, 400 * t),
  Math.max(0, Math.min(255, 400 * (t - 0.4))),
  Math.max(0, Math.min(255, 400 * (t - 0.8))),
];

describe("colourMapOrdered", () => {
  it("accepts a table whose channels all rise", () => {
    expect(colourMapOrdered(ramp(orange)).ok).toBe(true);
  });

  it("rejects a table whose green falls partway", () => {
    const dips = (t: number) => [
      Math.min(255, 400 * t),
      t > 0.5 ? 40 : Math.min(255, 400 * t),
      0,
    ];
    const result = colourMapOrdered(ramp(dips));
    expect(result.ok).toBe(false);
    expect(result.worstDrop).toBeGreaterThan(20);
  });

  it("sets the tolerance: a 6-level step down passes at 8 and fails at the default 3", () => {
    const step = (t: number) => [
      Math.min(255, 400 * t),
      t < 0.3 ? 0 : t < 0.6 ? 100 : 94,
      0,
    ];
    expect(colourMapOrdered(ramp(step), { tolerance: 8 }).ok).toBe(true);
    expect(colourMapOrdered(ramp(step)).ok).toBe(false);
  });

  it("refuses a picture with too few lit pixels to judge", () => {
    expect(colourMapOrdered(new Uint8Array(300)).ok).toBe(false);
  });
});
