/// <reference types="vitest/globals" />

/**
 * What can be checked about the imagery texture without a GPU (#293).
 *
 * Whether it loads, uploads and draws is `scripts/globe-smoke.mjs`'s question.
 * What is checkable here is the sampler and format the shader's seam and pole
 * handling relies on, the mip chain's length, and the reveal curve.
 */

import { describe, expect, it } from "vitest";
import {
  IMAGERY_FORMAT,
  IMAGERY_REVEAL_MS,
  IMAGERY_SAMPLER,
  imageryReveal,
  mipLevelCount,
} from "./imagery";

describe("mipLevelCount", () => {
  it("halves down to a single texel", () => {
    expect(mipLevelCount(4096, 2048)).toBe(13);
    expect(mipLevelCount(2048, 4096)).toBe(13);
    expect(mipLevelCount(1, 1)).toBe(1);
  });

  it("follows the longer side of a size that is not a power of two", () => {
    // 5 → 2 → 1: three levels, as WebGPU's floor-halving gives.
    expect(mipLevelCount(5, 3)).toBe(3);
  });
});

describe("IMAGERY_SAMPLER", () => {
  it("repeats across the antimeridian, so the seam filters like any column", () => {
    expect(IMAGERY_SAMPLER.addressModeU).toBe("repeat");
  });

  it("clamps at the poles rather than wrapping one pole into the other", () => {
    expect(IMAGERY_SAMPLER.addressModeV).toBe("clamp-to-edge");
  });

  it("filters anisotropically, which needs every filter linear", () => {
    /* Near a pole a pixel spans many texels of longitude and few of latitude.
       Isotropic filtering picks its mip from the long side and smears the
       whole cap; anisotropy keeps it sharp to within a few degrees of the
       pole, where the image is uniform ice anyway. WebGPU rejects
       anisotropy unless all three filters are linear. */
    expect(IMAGERY_SAMPLER.maxAnisotropy).toBe(16);
    expect(IMAGERY_SAMPLER.magFilter).toBe("linear");
    expect(IMAGERY_SAMPLER.minFilter).toBe("linear");
    expect(IMAGERY_SAMPLER.mipmapFilter).toBe("linear");
  });
});

describe("IMAGERY_FORMAT", () => {
  it("is stored as sRGB, so filtering and mips run in linear light", () => {
    expect(IMAGERY_FORMAT).toBe("rgba8unorm-srgb");
  });
});

describe("imageryReveal", () => {
  it("runs from nothing to full over the reveal", () => {
    expect(imageryReveal(0, false)).toBe(0);
    expect(imageryReveal(IMAGERY_REVEAL_MS, false)).toBe(1);
    expect(imageryReveal(IMAGERY_REVEAL_MS * 10, false)).toBe(1);
    expect(imageryReveal(IMAGERY_REVEAL_MS / 2, false)).toBeCloseTo(0.5, 10);
  });

  it("never runs backwards", () => {
    expect(imageryReveal(-50, false)).toBe(0);
    let previous = 0;
    for (let at = 0; at <= IMAGERY_REVEAL_MS; at += IMAGERY_REVEAL_MS / 40) {
      const value = imageryReveal(at, false);
      expect(value).toBeGreaterThanOrEqual(previous);
      previous = value;
    }
  });

  it("is immediate under reduced motion", () => {
    expect(imageryReveal(0, true)).toBe(1);
  });
});
