/**
 * The ice wall's WebGPU renderer: one pipeline, one draw.
 *
 * The frame's polygons (`frame.ts`) are fanned from their centroid into one dynamic vertex buffer,
 * and the whole wall is a single draw. The pane images sit side by side in one atlas
 * texture. The fragment shader samples the pane, tints a shard with the frost and lights its rim
 * in the ice colour (the rim is `edge = 0`, the fan's centre `edge = 1`, so the highlight is the
 * edge falloff across the shard, strongest at the border: a fresnel look without a normal). A
 * whole pane has no tint and no rim, so its pixels are the capture's.
 *
 * The device is the globe's shared one (`globe/webgpu/device.ts`), taken before the canvas
 * exists, as that file says.
 */
import type { RendererOptions, WallRenderer } from "./renderer";
import type { Drawable } from "./frame";

const FLOATS = 7;
const MAX_VERTICES = 16384;
const FROST = 0.14;
const RIM = 0.75;

const SHADER = /* wgsl */ `
struct Uniforms {
  ice : vec4f,
  size : vec2f,
  pad : vec2f,
}
@group(0) @binding(0) var<uniform> u : Uniforms;
@group(0) @binding(1) var atlas : texture_2d<f32>;
@group(0) @binding(2) var samp : sampler;

struct Out {
  @builtin(position) pos : vec4f,
  @location(0) uv : vec2f,
  @location(1) alpha : f32,
  @location(2) edge : f32,
  @location(3) tint : f32,
}

@vertex
fn vs(@location(0) p : vec2f, @location(1) uv : vec2f, @location(2) attrs : vec3f) -> Out {
  var o : Out;
  o.pos = vec4f(p.x / u.size.x * 2.0 - 1.0, 1.0 - p.y / u.size.y * 2.0, 0.0, 1.0);
  o.uv = uv;
  o.alpha = attrs.x;
  o.edge = attrs.y;
  o.tint = attrs.z;
  return o;
}

@fragment
fn fs(i : Out) -> @location(0) vec4f {
  let texel = textureSample(atlas, samp, i.uv).rgb;
  let rim = (1.0 - clamp(i.edge, 0.0, 1.0)) * i.tint;
  var colour = mix(texel, u.ice.rgb, i.tint * ${FROST});
  colour = colour + u.ice.rgb * rim * ${RIM};
  let a = i.alpha;
  return vec4f(min(colour, vec3f(1.0)) * a, a);
}
`;

export async function createWebgpuRenderer(
  o: RendererOptions,
  gpu: { device: GPUDevice; format: GPUTextureFormat },
): Promise<WallRenderer | null> {
  const { device, format } = gpu;
  const context = o.canvas.getContext("webgpu") as GPUCanvasContext | null;
  if (!context) return null;
  context.configure({ device, format, alphaMode: "premultiplied" });

  // The atlas: the panes in a row, each the size of the first.
  const first = o.panes[0]?.image;
  if (!first) return null;
  const pw = "naturalWidth" in first ? first.naturalWidth : first.width;
  const ph = "naturalHeight" in first ? first.naturalHeight : first.height;
  const count = o.panes.length;
  const atlas = device.createTexture({
    size: [pw * count, ph],
    format: "rgba8unorm",
    usage:
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.COPY_DST |
      GPUTextureUsage.RENDER_ATTACHMENT,
  });
  for (let i = 0; i < count; i += 1) {
    const image = o.panes[i]!.image;
    const bitmap =
      image instanceof ImageBitmap ? image : await createImageBitmap(image);
    device.queue.copyExternalImageToTexture(
      { source: bitmap },
      { texture: atlas, origin: [i * pw, 0] },
      [pw, ph],
    );
  }

  const module = device.createShaderModule({ code: SHADER });
  const pipeline = device.createRenderPipeline({
    layout: "auto",
    vertex: {
      module,
      entryPoint: "vs",
      buffers: [
        {
          arrayStride: FLOATS * 4,
          attributes: [
            { shaderLocation: 0, offset: 0, format: "float32x2" },
            { shaderLocation: 1, offset: 8, format: "float32x2" },
            { shaderLocation: 2, offset: 16, format: "float32x3" },
          ],
        },
      ],
    },
    fragment: {
      module,
      entryPoint: "fs",
      targets: [
        {
          format,
          blend: {
            color: {
              srcFactor: "one",
              dstFactor: "one-minus-src-alpha",
              operation: "add",
            },
            alpha: {
              srcFactor: "one",
              dstFactor: "one-minus-src-alpha",
              operation: "add",
            },
          },
        },
      ],
    },
    primitive: { topology: "triangle-list" },
  });
  const uniforms = device.createBuffer({
    size: 32,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const vertices = device.createBuffer({
    size: MAX_VERTICES * FLOATS * 4,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  const bind = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: uniforms } },
      { binding: 1, resource: atlas.createView() },
      {
        binding: 2,
        resource: device.createSampler({
          magFilter: "linear",
          minFilter: "linear",
        }),
      },
    ],
  });

  let cssW = 1;
  let cssH = 1;
  let destroyed = false;
  const data = new Float32Array(MAX_VERTICES * FLOATS);

  const writeUniforms = (): void => {
    device.queue.writeBuffer(
      uniforms,
      0,
      new Float32Array([
        o.ice[0],
        o.ice[1],
        o.ice[2],
        o.ice[3],
        cssW,
        cssH,
        0,
        0,
      ]),
    );
  };

  const push = (
    n: number,
    x: number,
    y: number,
    u: number,
    v: number,
    alpha: number,
    edge: number,
    tint: number,
  ): number => {
    const k = n * FLOATS;
    data[k] = x;
    data[k + 1] = y;
    data[k + 2] = u;
    data[k + 3] = v;
    data[k + 4] = alpha;
    data[k + 5] = edge;
    data[k + 6] = tint;
    return n + 1;
  };

  /** Writes a polygon as a fan from its centroid, and returns the new vertex count. */
  const fan = (d: Drawable, n: number, whole: boolean): number => {
    const k = d.pts.length / 2;
    let cx = 0;
    let cy = 0;
    let cu = 0;
    let cv = 0;
    for (let i = 0; i < k; i += 1) {
      cx += d.pts[i * 2]!;
      cy += d.pts[i * 2 + 1]!;
      cu += d.uvs[i * 2]!;
      cv += d.uvs[i * 2 + 1]!;
    }
    cx /= k;
    cy /= k;
    cu /= k;
    cv /= k;
    const slot = (u: number): number => (d.pane + u) / o.panes.length;
    const tint = whole ? 0 : 1;
    for (let i = 0; i < k; i += 1) {
      if (n + 3 > MAX_VERTICES) break;
      const j = (i + 1) % k;
      n = push(n, cx, cy, slot(cu), cv, d.alpha, 1, tint);
      n = push(
        n,
        d.pts[i * 2]!,
        d.pts[i * 2 + 1]!,
        slot(d.uvs[i * 2]!),
        d.uvs[i * 2 + 1]!,
        d.alpha,
        0,
        tint,
      );
      n = push(
        n,
        d.pts[j * 2]!,
        d.pts[j * 2 + 1]!,
        slot(d.uvs[j * 2]!),
        d.uvs[j * 2 + 1]!,
        d.alpha,
        0,
        tint,
      );
    }
    return n;
  };

  const pass = (n: number): void => {
    const encoder = device.createCommandEncoder();
    const view = context.getCurrentTexture().createView();
    const run = encoder.beginRenderPass({
      colorAttachments: [
        {
          view,
          clearValue: { r: 0, g: 0, b: 0, a: 0 },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });
    if (n > 0) {
      run.setPipeline(pipeline);
      run.setBindGroup(0, bind);
      run.setVertexBuffer(0, vertices);
      run.draw(n);
    }
    run.end();
    device.queue.submit([encoder.finish()]);
  };

  return {
    kind: "webgpu",
    resize(width, height, dpr) {
      cssW = width;
      cssH = height;
      o.canvas.width = Math.max(1, Math.round(width * dpr));
      o.canvas.height = Math.max(1, Math.round(height * dpr));
      writeUniforms();
    },
    draw(drawables) {
      if (destroyed) return;
      let n = 0;
      for (const d of drawables) {
        if (d.alpha <= 0) continue;
        n = fan(d, n, d.cell < 0);
      }
      if (n > 0)
        device.queue.writeBuffer(vertices, 0, data.buffer, 0, n * FLOATS * 4);
      pass(n);
    },
    destroy() {
      destroyed = true;
      atlas.destroy();
      vertices.destroy();
      uniforms.destroy();
    },
  };
}
