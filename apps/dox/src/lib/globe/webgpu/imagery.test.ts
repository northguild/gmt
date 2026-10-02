/// <reference types="vitest/globals" />

/**
 * What can be checked about the imagery texture without a GPU (#293).
 *
 * Whether it loads, uploads and draws is `scripts/globe-smoke.mjs`'s question.
 * What is checkable here is the sampler and format the shader's seam and pole
 * handling relies on, the mip chain's length, the reveal curve, and the rules
 * for sharing one texture between globes — which the smoke never exercises,
 * since it never puts two globes on one device.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  acquireImagery,
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

/** A texture the fake device hands out, recording whether it was destroyed. */
interface FakeTexture {
  label: string;
  destroyed: boolean;
}

/** Just enough of a `GPUDevice` for `acquireImagery` to load and build mips. */
function fakeDevice() {
  const textures: FakeTexture[] = [];
  const pass = {
    setPipeline() {},
    setBindGroup() {},
    draw() {},
    end() {},
  };
  const device = {
    limits: { maxTextureDimension2D: 8192 },
    pushErrorScope() {},
    popErrorScope: () => Promise.resolve(null),
    createTexture({ label }: { label: string }) {
      const texture = {
        label,
        destroyed: false,
        createView: () => ({}),
        destroy() {
          texture.destroyed = true;
        },
      };
      textures.push(texture);
      return texture;
    },
    createShaderModule: () => ({
      getCompilationInfo: async () => ({ messages: [] }),
    }),
    createRenderPipelineAsync: async () => ({ getBindGroupLayout: () => ({}) }),
    createSampler: () => ({}),
    createBindGroup: () => ({}),
    createCommandEncoder: () => ({
      beginRenderPass: () => pass,
      finish: () => ({}),
    }),
    queue: { copyExternalImageToTexture() {}, submit() {} },
  };
  const imagery = () => textures.filter((t) => t.label === "globe-imagery");
  return { device: device as unknown as GPUDevice, imagery };
}

describe("acquireImagery", () => {
  let fetches = 0;
  let fail = false;

  beforeEach(() => {
    fetches = 0;
    fail = false;
    vi.stubGlobal("GPUTextureUsage", {
      TEXTURE_BINDING: 4,
      COPY_DST: 2,
      RENDER_ATTACHMENT: 16,
    });
    vi.stubGlobal("fetch", async () => {
      fetches++;
      return fail
        ? { ok: false, status: 503 }
        : { ok: true, status: 200, blob: async () => ({}) };
    });
    vi.stubGlobal("createImageBitmap", async () => ({
      width: 8,
      height: 4,
      close() {},
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shares one download and one texture between globes on a device", async () => {
    const { device, imagery } = fakeDevice();
    const [hero, rail] = await Promise.all([
      acquireImagery(device, "/earth.webp"),
      acquireImagery(device, "/earth.webp"),
    ]);
    expect(fetches).toBe(1);
    expect(imagery()).toHaveLength(1);
    hero.release();
    rail.release();
  });

  it("keeps separate textures for separate devices and images", async () => {
    const first = fakeDevice();
    const second = fakeDevice();
    const handles = await Promise.all([
      acquireImagery(first.device, "/earth.webp"),
      acquireImagery(second.device, "/earth.webp"),
      acquireImagery(first.device, "/other.webp"),
    ]);
    expect(fetches).toBe(3);
    expect(first.imagery()).toHaveLength(2);
    expect(second.imagery()).toHaveLength(1);
    for (const handle of handles) handle.release();
  });

  it("destroys the texture with the last holder, not before", async () => {
    const { device, imagery } = fakeDevice();
    const hero = await acquireImagery(device, "/earth.webp");
    const rail = await acquireImagery(device, "/earth.webp");
    hero.release();
    await Promise.resolve();
    expect(imagery()[0].destroyed).toBe(false);
    rail.release();
    await Promise.resolve();
    expect(imagery()[0].destroyed).toBe(true);
  });

  it("counts a holder's release once, however often it is called", async () => {
    const { device, imagery } = fakeDevice();
    const hero = await acquireImagery(device, "/earth.webp");
    const rail = await acquireImagery(device, "/earth.webp");
    hero.release();
    hero.release();
    await Promise.resolve();
    expect(imagery()[0].destroyed).toBe(false);
    rail.release();
  });

  it("loads afresh for a globe mounted after the last one let go", async () => {
    const { device, imagery } = fakeDevice();
    (await acquireImagery(device, "/earth.webp")).release();
    const again = await acquireImagery(device, "/earth.webp");
    expect(fetches).toBe(2);
    expect(imagery()).toHaveLength(2);
    expect(imagery()[1].destroyed).toBe(false);
    again.release();
  });

  it("forgets a failed load, so the next globe tries again", async () => {
    const { device } = fakeDevice();
    fail = true;
    await expect(acquireImagery(device, "/earth.webp")).rejects.toThrow(
      "HTTP 503",
    );
    fail = false;
    const handle = await acquireImagery(device, "/earth.webp");
    expect(fetches).toBe(2);
    handle.release();
  });
});
