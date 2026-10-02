/**
 * The Earth imagery texture (#293).
 *
 * One equirectangular image — NASA's Blue Marble, prepared by
 * `scripts/prepare-globe-imagery.py` — fetched, decoded off the main thread by
 * `createImageBitmap`, uploaded, and given a full mip chain. The surface shader
 * samples it at each pixel's latitude and longitude.
 *
 * Shared per device and reference-counted, like the device itself
 * (`device.ts`): two globes on one page — the landing hero and the `/dox` rail —
 * would otherwise hold two copies of a 45 MB texture (4096×2048 RGBA plus its
 * mips).
 *
 * Every failure rejects, and the caller keeps drawing the flat globe. An image
 * that fails to load is decoration that did not arrive, not a broken globe.
 */

import { createCheckedShaderModule, withValidation } from "./device";

/**
 * Stored as sRGB, so the hardware decodes to linear light before it filters.
 * Averaging encoded values darkens every mip level and every minified sample;
 * the shader re-encodes what it reads before compositing.
 */
export const IMAGERY_FORMAT: GPUTextureFormat = "rgba8unorm-srgb";

/**
 * How the surface shader samples the image.
 *
 * `repeat` across longitude, so the antimeridian filters like any other
 * column; `clamp-to-edge` across latitude, so a pole never pulls in the other
 * pole. Anisotropic, because near a pole a pixel spans many texels of
 * longitude and few of latitude, and isotropic filtering would pick its mip
 * from the long side and smear the whole cap.
 */
export const IMAGERY_SAMPLER: GPUSamplerDescriptor = {
  label: "globe-imagery-sampler",
  addressModeU: "repeat",
  addressModeV: "clamp-to-edge",
  magFilter: "linear",
  minFilter: "linear",
  mipmapFilter: "linear",
  maxAnisotropy: 16,
};

/** How long the imagery takes to fade in once it has arrived. */
export const IMAGERY_REVEAL_MS = 600;

/** Mip levels down to 1×1, halving the longer side each time. */
export function mipLevelCount(width: number, height: number): number {
  return Math.floor(Math.log2(Math.max(width, height, 1))) + 1;
}

/**
 * How far the fade-in has run, 0..1, `elapsedMs` after the first frame drawn
 * with the imagery. Immediate under reduced motion, like the globe's own
 * reveal. Linear: the fade is a cross-fade between two finished pictures, and
 * an ease would only hold each of them longer.
 */
export function imageryReveal(
  elapsedMs: number,
  reducedMotion: boolean,
): number {
  if (reducedMotion) return 1;
  return Math.min(Math.max(elapsedMs / IMAGERY_REVEAL_MS, 0), 1);
}

export interface ImageryHandle {
  view: GPUTextureView;
  /** Release this holder's claim; the texture is destroyed with the last. */
  release(): void;
}

interface Entry {
  texture: Promise<GPUTexture>;
  holders: number;
}

/** Device → URL → the texture loading or loaded for it. */
const shared = new WeakMap<GPUDevice, Map<string, Entry>>();

/**
 * The imagery at `url` as a sampled texture, shared with any other globe on the
 * same device.
 *
 * A failed load is not remembered, so a globe mounted later tries again.
 */
export async function acquireImagery(
  device: GPUDevice,
  url: string,
): Promise<ImageryHandle> {
  let byUrl = shared.get(device);
  if (!byUrl) {
    byUrl = new Map();
    shared.set(device, byUrl);
  }
  const entries = byUrl;
  let entry = entries.get(url);
  if (!entry) {
    const created: Entry = { texture: loadTexture(device, url), holders: 0 };
    created.texture.catch(() => {
      if (entries.get(url) === created) entries.delete(url);
    });
    entries.set(url, created);
    entry = created;
  }
  const claimed = entry;
  claimed.holders++;

  let released = false;
  const release = (): void => {
    if (released) return;
    released = true;
    claimed.holders--;
    if (claimed.holders > 0) return;
    if (entries.get(url) === claimed) entries.delete(url);
    claimed.texture.then(
      (texture) => texture.destroy(),
      () => {},
    );
  };

  try {
    const texture = await claimed.texture;
    return { view: texture.createView({ label: "globe-imagery" }), release };
  } catch (error) {
    release();
    throw error;
  }
}

async function loadTexture(
  device: GPUDevice,
  url: string,
): Promise<GPUTexture> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`imagery: HTTP ${response.status}`);
  const bitmap = await createImageBitmap(await response.blob());

  /* Everything that awaits happens before the upload's error scopes open, so
     they are pushed and popped in one synchronous run; see `withValidation`. */
  const made: { texture?: GPUTexture } = {};
  try {
    const { width, height } = bitmap;
    const limit = device.limits.maxTextureDimension2D;
    if (width > limit || height > limit) {
      throw new Error(`imagery: ${width}×${height} exceeds the ${limit} limit`);
    }
    const levels = mipLevelCount(width, height);
    const pipeline = await mipPipeline(device);
    await withValidation(device, "globe imagery", () => {
      const texture = device.createTexture({
        label: "globe-imagery",
        size: [width, height],
        format: IMAGERY_FORMAT,
        mipLevelCount: levels,
        usage:
          GPUTextureUsage.TEXTURE_BINDING |
          GPUTextureUsage.COPY_DST |
          GPUTextureUsage.RENDER_ATTACHMENT,
      });
      // Held outside the callback, so a scope error can still destroy it.
      made.texture = texture;
      device.queue.copyExternalImageToTexture({ source: bitmap }, { texture }, [
        width,
        height,
      ]);
      encodeMips(device, pipeline, texture, levels);
    });
    return made.texture!;
  } catch (error) {
    made.texture?.destroy();
    throw error;
  } finally {
    bitmap.close();
  }
}

/**
 * Each level drawn from the one above it with a linear filter.
 *
 * WebGPU has no `generateMipmap`. Sampling the centre of a destination texel,
 * which sits on the corner shared by four source texels, averages those four —
 * an exact box filter for a power-of-two image, in linear light because the
 * views are `-srgb`.
 */
const MIP_SHADER = /* wgsl */ `
@group(0) @binding(0) var source: texture_2d<f32>;
@group(0) @binding(1) var sourceSampler: sampler;

struct Out {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
}

/* One triangle that covers the viewport, from vertex_index alone. */
@vertex
fn vs(@builtin(vertex_index) index: u32) -> Out {
  let corner = vec2<f32>(f32((index << 1u) & 2u), f32(index & 2u));
  var out: Out;
  out.position = vec4<f32>(corner * 2.0 - 1.0, 0.0, 1.0);
  out.uv = vec2<f32>(corner.x, 1.0 - corner.y);
  return out;
}

@fragment
fn fs(in: Out) -> @location(0) vec4<f32> {
  return textureSample(source, sourceSampler, in.uv);
}
`;

const mipPipelines = new WeakMap<GPUDevice, Promise<GPURenderPipeline>>();

/** The mip pass's pipeline, built once per device. */
function mipPipeline(device: GPUDevice): Promise<GPURenderPipeline> {
  let pipeline = mipPipelines.get(device);
  if (!pipeline) {
    pipeline = createCheckedShaderModule(
      device,
      "globe-imagery-mips",
      MIP_SHADER,
    ).then((module) =>
      device.createRenderPipelineAsync({
        label: "globe-imagery-mips",
        layout: "auto",
        vertex: { module, entryPoint: "vs" },
        fragment: {
          module,
          entryPoint: "fs",
          targets: [{ format: IMAGERY_FORMAT }],
        },
      }),
    );
    // A failure is not kept, so the next load tries again.
    pipeline.catch(() => mipPipelines.delete(device));
    mipPipelines.set(device, pipeline);
  }
  return pipeline;
}

/** Draw every level below the first from the one above it, and submit. */
function encodeMips(
  device: GPUDevice,
  pipeline: GPURenderPipeline,
  texture: GPUTexture,
  levels: number,
): void {
  const sampler = device.createSampler({
    label: "globe-imagery-mips",
    minFilter: "linear",
    magFilter: "linear",
  });
  const encoder = device.createCommandEncoder({ label: "globe-imagery-mips" });
  for (let level = 1; level < levels; level++) {
    const group = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: texture.createView({
            baseMipLevel: level - 1,
            mipLevelCount: 1,
          }),
        },
        { binding: 1, resource: sampler },
      ],
    });
    const pass = encoder.beginRenderPass({
      label: `globe-imagery-mip-${level}`,
      colorAttachments: [
        {
          view: texture.createView({ baseMipLevel: level, mipLevelCount: 1 }),
          loadOp: "clear",
          storeOp: "store",
          clearValue: { r: 0, g: 0, b: 0, a: 0 },
        },
      ],
    });
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, group);
    pass.draw(3);
    pass.end();
  }
  device.queue.submit([encoder.finish()]);
}
