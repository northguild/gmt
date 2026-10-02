/**
 * The WebGPU renderer (#289).
 *
 * Draws the globe in three render passes:
 *
 * 1. **Coverage** into an offscreen 4× MSAA `rgba8unorm` target, resolved to a
 *    plain texture. One channel per vector layer — land fill, land stroke, region
 *    fill, region stroke — combined with blend operation `max`, so overlapping
 *    triangles and the joints between stroke segments never double-blend a
 *    translucent layer. A 2D canvas strokes an entire path as one coverage, and
 *    beaded joints are the tell-tale sign of a port that alpha-blended each
 *    segment instead. Rebuilt only when the camera, the size or the geometry
 *    changes: the once-a-second clock tick moves the sun, not the land.
 * 2. **Surface**, one full-screen quad, compositing everything the sphere is made
 *    of in the canvas-2D renderer's order and reading the coverage channels.
 *    Where the theme asks for it, the Earth imagery (#293) replaces the flat
 *    ocean and land, fading back to them as the reader zooms in.
 * 3. **Markers and labels**, instanced screen-space quads.
 *
 * Regions are drawn a colour group at a time, because the coverage target holds
 * one group's fill and stroke at once. The common case — the Dox globe's single
 * highlighted zone — is one group and costs nothing extra.
 *
 * Every failure path leads to the same place: reject, or report through
 * `onFailure`, and let `../engine.ts` fall back to canvas-2D. A reader should
 * never find out that a GPU was involved.
 */

import {
  MAX_EDGE_DEG,
  outlineSegments,
  preparePolygon,
  type PreparedPolygon,
} from "../geometry";
import { landGeometry } from "../land";
import type { FrameState, GlobeRenderer, RendererInit } from "../renderer";
import { triangulatePolygons, type Mesh } from "../triangulate";
import type {
  GlobeArc,
  GlobeMarker,
  GlobeRegion,
  GlobeTheme,
  Rgba,
} from "../types";
import { greatCirclePoints } from "../geometry";
import { CASING_CSS, LABEL_OFFSET_X, labelRingShift } from "../casing";
import { LABEL_MAX_ZOOM } from "../shading";
import { acquireDevice, createCheckedShaderModule } from "./device";
import {
  acquireImagery,
  IMAGERY_FORMAT,
  IMAGERY_SAMPLER,
  imageryReveal,
  type ImageryHandle,
} from "./imagery";
import { buildLabelAtlas, type LabelAtlas } from "./label-atlas";
import {
  fillShader,
  labelShader,
  markerShader,
  regionOverlayShader,
  strokeShader,
  surfaceShader,
} from "./shaders";
import { UNIFORM_BYTES, writeUniforms } from "./uniforms";

/** The coverage target's format, and the layer each channel carries. */
const COVERAGE_FORMAT: GPUTextureFormat = "rgba8unorm";

/** Samples in the coverage pass. Four is the universally available count. */
const COVERAGE_SAMPLES = 4;

/** Stroke widths in CSS pixels, matching the canvas-2D renderer's `lineWidth`. */
const LAND_STROKE_CSS = 0.5;
const GRID_STROKE_CSS = 0.5;
const LIMB_STROKE_CSS = 1;

/** How far the atmosphere glow reaches past the limb, as a multiple of R. */
const ATMOSPHERE_REACH = 1.06;

/** Where a label's box sits above its marker, in CSS pixels; `LABEL_OFFSET_X`
 *  (../casing.ts) places it to the right. */
const LABEL_OFFSET_Y = -7;

/** Floats per marker instance — see `markerShader`'s vertex inputs. */
const MARKER_FLOATS = 14;

/** Floats per label instance — see `labelShader`'s vertex inputs. */
const LABEL_FLOATS = 11;

/** One-hot channel masks, in the order the shaders document. */
const CHANNEL_LAND_FILL = [1, 0, 0, 0];
const CHANNEL_LAND_STROKE = [0, 1, 0, 0];
const CHANNEL_REGION_FILL = [0, 0, 1, 0];
const CHANNEL_REGION_STROKE = [0, 0, 0, 1];

const TRANSPARENT: Rgba = [0, 0, 0, 0];

/** A growable GPU buffer, reallocated only when the data outgrows it. */
interface DynamicBuffer {
  buffer: GPUBuffer | null;
  capacity: number;
  /** Elements actually in use — vertices, indices or instances. */
  count: number;
}

/** Regions sharing a fill and stroke colour draw together in one pass. */
interface RegionGroup {
  fill: Rgba;
  stroke: Rgba;
  strokeWidthCss: number;
  mesh: Mesh;
  outline: Float32Array<ArrayBuffer>;
}

export async function createWebgpuRenderer(
  init: RendererInit,
): Promise<GlobeRenderer> {
  let failureCallback: ((reason: string) => void) | null = null;
  let failed = false;
  const reportFailure = (reason: string): void => {
    if (failed) return;
    failed = true;
    failureCallback?.(reason);
  };

  const bundle = await acquireDevice(reportFailure);
  const { device, canvasFormat } = bundle;

  /* The canvas is created only now. `getContext("webgpu")` claims an element for
     good, so a failure before this point leaves the fallback a clean one. */
  const canvas = document.createElement("canvas");
  canvas.className = "gmt-globe-canvas";
  canvas.dataset.renderer = "webgpu";
  canvas.tabIndex = 0;
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", init.ariaLabel);

  const maybeContext = canvas.getContext("webgpu");
  if (!maybeContext) {
    bundle.release();
    throw new Error("canvas returned no WebGPU context");
  }
  const context = maybeContext;
  context.configure({
    device,
    format: canvasFormat,
    alphaMode: "premultiplied",
  });
  init.host.appendChild(canvas);

  // --- shaders and pipelines ----------------------------------------------
  /* Each module checks itself, with a scope it pops before awaiting the
     compiler, so no scope is ever held open across these awaits — see
     `withValidation` in ./device.ts for why that matters on a shared device. */
  const modules = {
    surface: await createCheckedShaderModule(
      device,
      "globe-surface",
      surfaceShader(),
    ),
    overlay: await createCheckedShaderModule(
      device,
      "globe-region-overlay",
      regionOverlayShader(),
    ),
    fill: await createCheckedShaderModule(device, "globe-fill", fillShader()),
    stroke: await createCheckedShaderModule(
      device,
      "globe-stroke",
      strokeShader(),
    ),
    marker: await createCheckedShaderModule(
      device,
      "globe-marker",
      markerShader(),
    ),
    label: await createCheckedShaderModule(
      device,
      "globe-label",
      labelShader(),
    ),
  };

  /** Straight source-over on a premultiplied target. */
  const premultipliedBlend: GPUBlendState = {
    color: {
      operation: "add",
      srcFactor: "one",
      dstFactor: "one-minus-src-alpha",
    },
    alpha: {
      operation: "add",
      srcFactor: "one",
      dstFactor: "one-minus-src-alpha",
    },
  };

  /** Keeps the greatest coverage written so far, never the sum. */
  const maxBlend: GPUBlendState = {
    color: { operation: "max", srcFactor: "one", dstFactor: "one" },
    alpha: { operation: "max", srcFactor: "one", dstFactor: "one" },
  };

  /* No error scope here: `createRenderPipelineAsync` reports a failure by
     rejecting with a `GPUPipelineError`, which the shell already treats as
     "use canvas-2D". */
  const pipelines = {
    fill: await device.createRenderPipelineAsync({
      label: "globe-fill",
      layout: "auto",
      vertex: {
        module: modules.fill,
        entryPoint: "vs",
        buffers: [
          {
            arrayStride: 8,
            attributes: [{ shaderLocation: 0, offset: 0, format: "float32x2" }],
          },
        ],
      },
      fragment: {
        module: modules.fill,
        entryPoint: "fs",
        targets: [{ format: COVERAGE_FORMAT, blend: maxBlend }],
      },
      multisample: { count: COVERAGE_SAMPLES },
    }),
    stroke: await device.createRenderPipelineAsync({
      label: "globe-stroke",
      layout: "auto",
      vertex: {
        module: modules.stroke,
        entryPoint: "vs",
        buffers: [
          {
            arrayStride: 16,
            stepMode: "instance",
            attributes: [
              { shaderLocation: 0, offset: 0, format: "float32x2" },
              { shaderLocation: 1, offset: 8, format: "float32x2" },
            ],
          },
        ],
      },
      fragment: {
        module: modules.stroke,
        entryPoint: "fs",
        targets: [{ format: COVERAGE_FORMAT, blend: maxBlend }],
      },
      multisample: { count: COVERAGE_SAMPLES },
    }),
    surface: await device.createRenderPipelineAsync({
      label: "globe-surface",
      layout: "auto",
      vertex: { module: modules.surface, entryPoint: "vs" },
      fragment: {
        module: modules.surface,
        entryPoint: "fs",
        // No blending: this is the first thing written to a cleared canvas.
        targets: [{ format: canvasFormat }],
      },
    }),
    overlay: await device.createRenderPipelineAsync({
      label: "globe-region-overlay",
      layout: "auto",
      vertex: { module: modules.overlay, entryPoint: "vs" },
      fragment: {
        module: modules.overlay,
        entryPoint: "fs",
        targets: [{ format: canvasFormat, blend: premultipliedBlend }],
      },
    }),
    marker: await device.createRenderPipelineAsync({
      label: "globe-marker",
      layout: "auto",
      vertex: {
        module: modules.marker,
        entryPoint: "vs",
        buffers: [
          {
            arrayStride: MARKER_FLOATS * 4,
            stepMode: "instance",
            attributes: [
              { shaderLocation: 0, offset: 0, format: "float32x2" },
              { shaderLocation: 1, offset: 8, format: "float32x2" },
              { shaderLocation: 2, offset: 16, format: "float32x4" },
              { shaderLocation: 3, offset: 32, format: "float32x4" },
              { shaderLocation: 4, offset: 48, format: "float32x2" },
            ],
          },
        ],
      },
      fragment: {
        module: modules.marker,
        entryPoint: "fs",
        targets: [{ format: canvasFormat, blend: premultipliedBlend }],
      },
    }),
    label: await device.createRenderPipelineAsync({
      label: "globe-label",
      layout: "auto",
      vertex: {
        module: modules.label,
        entryPoint: "vs",
        buffers: [
          {
            arrayStride: LABEL_FLOATS * 4,
            stepMode: "instance",
            attributes: [
              { shaderLocation: 0, offset: 0, format: "float32x2" },
              { shaderLocation: 1, offset: 8, format: "float32x2" },
              { shaderLocation: 2, offset: 16, format: "float32x2" },
              { shaderLocation: 3, offset: 24, format: "float32x4" },
              { shaderLocation: 4, offset: 40, format: "float32" },
            ],
          },
        ],
      },
      fragment: {
        module: modules.label,
        entryPoint: "fs",
        targets: [{ format: canvasFormat, blend: premultipliedBlend }],
      },
    }),
  };

  // --- uniforms ------------------------------------------------------------
  const uniformData = new Float32Array(UNIFORM_BYTES / 4);
  const uniformBuffer = device.createBuffer({
    label: "globe-uniforms",
    size: UNIFORM_BYTES,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  // --- imagery -------------------------------------------------------------
  /* The surface pass always binds an imagery texture. Until the real one has
     loaded — or for good, if it never does — that is a 1×1 placeholder, and
     the uniform weight of 0 keeps the shader from showing it. */
  const imageryPlaceholder = device.createTexture({
    label: "globe-imagery-placeholder",
    size: [1, 1],
    format: IMAGERY_FORMAT,
    usage: GPUTextureUsage.TEXTURE_BINDING,
  });
  const imageryPlaceholderView = imageryPlaceholder.createView();
  const imagerySampler = device.createSampler(IMAGERY_SAMPLER);

  /** One small buffer per coverage layer: the channel mask and a stroke width. */
  function makeLayerBuffer(label: string, mask: readonly number[]): GPUBuffer {
    const buffer = device.createBuffer({
      label,
      size: 32,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(
      buffer,
      0,
      new Float32Array([...mask, 0, 0, 0, 0]),
    );
    return buffer;
  }
  const layerBuffers = {
    landFill: makeLayerBuffer("globe-layer-land-fill", CHANNEL_LAND_FILL),
    landStroke: makeLayerBuffer("globe-layer-land-stroke", CHANNEL_LAND_STROKE),
    regionFill: makeLayerBuffer("globe-layer-region-fill", CHANNEL_REGION_FILL),
    regionStroke: makeLayerBuffer(
      "globe-layer-region-stroke",
      CHANNEL_REGION_STROKE,
    ),
  };

  function writeLayerWidth(buffer: GPUBuffer, widthDev: number): void {
    // `params.x`, the second vec4's first component.
    device.queue.writeBuffer(buffer, 16, new Float32Array([widthDev, 0, 0, 0]));
  }

  const fillLayerGroups = {
    landFill: device.createBindGroup({
      layout: pipelines.fill.getBindGroupLayout(1),
      entries: [{ binding: 0, resource: { buffer: layerBuffers.landFill } }],
    }),
    regionFill: device.createBindGroup({
      layout: pipelines.fill.getBindGroupLayout(1),
      entries: [{ binding: 0, resource: { buffer: layerBuffers.regionFill } }],
    }),
  };
  const strokeLayerGroups = {
    landStroke: device.createBindGroup({
      layout: pipelines.stroke.getBindGroupLayout(1),
      entries: [{ binding: 0, resource: { buffer: layerBuffers.landStroke } }],
    }),
    regionStroke: device.createBindGroup({
      layout: pipelines.stroke.getBindGroupLayout(1),
      entries: [
        { binding: 0, resource: { buffer: layerBuffers.regionStroke } },
      ],
    }),
  };
  const fillUniformGroup = device.createBindGroup({
    layout: pipelines.fill.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
  });
  const strokeUniformGroup = device.createBindGroup({
    layout: pipelines.stroke.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
  });
  const markerUniformGroup = device.createBindGroup({
    layout: pipelines.marker.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
  });

  // --- static land geometry ------------------------------------------------
  const land = landGeometry();
  const landVertices = createStaticBuffer(
    "globe-land-vertices",
    land.mesh.vertices,
    GPUBufferUsage.VERTEX,
  );
  const landIndices = createStaticBuffer(
    "globe-land-indices",
    land.mesh.indices,
    GPUBufferUsage.INDEX,
  );
  const landOutline = createStaticBuffer(
    "globe-land-outline",
    land.outline,
    GPUBufferUsage.VERTEX,
  );

  function createStaticBuffer(
    label: string,
    data: Float32Array<ArrayBuffer> | Uint32Array<ArrayBuffer>,
    usage: GPUBufferUsageFlags,
  ): GPUBuffer {
    const buffer = device.createBuffer({
      label,
      size: Math.max(4, align4(data.byteLength)),
      usage: usage | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(buffer, 0, data);
    return buffer;
  }

  // --- mutable state -------------------------------------------------------
  let theme = init.theme;
  const labelFont = init.labelFont;
  let widthCss = 1;
  let heightCss = 1;
  let widthDev = 1;
  let heightDev = 1;
  let dpr = 1;

  let regionGroups: RegionGroup[] = [];
  let markers: readonly GlobeMarker[] = [];
  let arcs: readonly GlobeArc[] = [];

  /* Which region group's geometry is currently in the dynamic buffers, and
     whether it still needs re-uploading. A region changes when the reader
     selects a different zone, not every frame, and re-uploading its mesh and
     outline at 60fps for a globe that is merely spinning is pure waste. */
  let boundGroup: RegionGroup | null = null;
  let geometryDirty = true;

  let msaaTexture: GPUTexture | null = null;
  let coverageTexture: GPUTexture | null = null;
  /* Views are cached rather than made per frame: they only change when the
     textures are recreated, which is on resize. */
  let msaaView: GPUTextureView | null = null;
  let resolveView: GPUTextureView | null = null;
  let coverageView: GPUTextureView | null = null;
  let surfaceGroup: GPUBindGroup | null = null;
  let overlayGroup: GPUBindGroup | null = null;

  const regionVertices: DynamicBuffer = { buffer: null, capacity: 0, count: 0 };
  const regionIndices: DynamicBuffer = { buffer: null, capacity: 0, count: 0 };
  const regionOutline: DynamicBuffer = { buffer: null, capacity: 0, count: 0 };
  const markerInstances: DynamicBuffer = {
    buffer: null,
    capacity: 0,
    count: 0,
  };
  const labelInstances: DynamicBuffer = { buffer: null, capacity: 0, count: 0 };

  let atlas: LabelAtlas | null = null;
  let labelGroup: GPUBindGroup | null = null;
  let atlasLabels = "";

  /** The loaded imagery, once it has arrived. */
  let imagery: ImageryHandle | null = null;
  let imageryRequested = false;
  /** When the first frame with the imagery was drawn, for the fade-in. */
  let imageryShownAt: number | null = null;

  /** What the coverage target was last drawn for; unchanged means reuse it. */
  let coverageKey = "";
  let destroyed = false;
  let firstFrameChecked = false;

  function align4(bytes: number): number {
    return (bytes + 3) & ~3;
  }

  /** Grow a dynamic buffer if needed, then upload. */
  function upload(
    slot: DynamicBuffer,
    label: string,
    data: Float32Array<ArrayBuffer> | Uint32Array<ArrayBuffer>,
    usage: GPUBufferUsageFlags,
    elementsPerItem: number,
  ): void {
    const bytes = align4(data.byteLength);
    if (!slot.buffer || slot.capacity < bytes) {
      slot.buffer?.destroy();
      // Doubling, so a growing selection does not reallocate every time.
      slot.capacity = Math.max(256, bytes * 2);
      slot.buffer = device.createBuffer({
        label,
        size: slot.capacity,
        usage: usage | GPUBufferUsage.COPY_DST,
      });
    }
    if (data.length > 0) device.queue.writeBuffer(slot.buffer, 0, data);
    slot.count = data.length / elementsPerItem;
  }

  // --- sizing --------------------------------------------------------------
  function resize(
    nextWidthCss: number,
    nextHeightCss: number,
    nextDpr: number,
  ): void {
    widthCss = Math.max(1, nextWidthCss);
    heightCss = Math.max(1, nextHeightCss);
    dpr = nextDpr;

    const limit = device.limits.maxTextureDimension2D;
    widthDev = Math.min(limit, Math.max(1, Math.round(widthCss * dpr)));
    heightDev = Math.min(limit, Math.max(1, Math.round(heightCss * dpr)));

    canvas.width = widthDev;
    canvas.height = heightDev;
    canvas.style.width = `${widthCss}px`;
    canvas.style.height = `${heightCss}px`;

    msaaTexture?.destroy();
    coverageTexture?.destroy();
    msaaTexture = device.createTexture({
      label: "globe-coverage-msaa",
      size: [widthDev, heightDev],
      format: COVERAGE_FORMAT,
      sampleCount: COVERAGE_SAMPLES,
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
    coverageTexture = device.createTexture({
      label: "globe-coverage",
      size: [widthDev, heightDev],
      format: COVERAGE_FORMAT,
      usage:
        GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    });
    msaaView = msaaTexture.createView();
    resolveView = coverageTexture.createView();
    coverageView = coverageTexture.createView();

    rebuildSurfaceGroup();
    overlayGroup = device.createBindGroup({
      layout: pipelines.overlay.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: uniformBuffer } },
        { binding: 1, resource: coverageView },
      ],
    });

    writeLayerWidth(layerBuffers.landStroke, LAND_STROKE_CSS * dpr);
    /* Stroke widths are uploaded in device pixels, so a change of scale
       invalidates the region's too, and the coverage target is a different size
       and has to be redrawn. */
    geometryDirty = true;
    coverageKey = "";
    rebuildLabels();
  }

  /** The surface pass's bindings: uniforms, coverage, and the imagery. */
  function rebuildSurfaceGroup(): void {
    if (!coverageView) return;
    surfaceGroup = device.createBindGroup({
      layout: pipelines.surface.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: uniformBuffer } },
        { binding: 1, resource: coverageView },
        { binding: 2, resource: imagery?.view ?? imageryPlaceholderView },
        { binding: 3, resource: imagerySampler },
      ],
    });
  }

  /**
   * Start fetching the imagery the first time a theme asks for it.
   *
   * Never before: a theme with `imagery: 0` — raised contrast, forced colours —
   * should not cost the reader a download it will never see. Not awaited
   * either: the globe is interactive and drawing flat while the image is on
   * its way, and fades it in when it lands.
   */
  function maybeLoadImagery(): void {
    if (imageryRequested || !init.imageryUrl || theme.imagery <= 0) return;
    imageryRequested = true;
    acquireImagery(device, init.imageryUrl).then(
      (handle) => {
        if (destroyed || failed) {
          handle.release();
          return;
        }
        imagery = handle;
        rebuildSurfaceGroup();
        init.invalidate();
      },
      (error: unknown) => {
        // The flat globe is the whole of the fallback; nothing else changes.
        console.info(`globe: imagery unavailable (${String(error)})`);
      },
    );
  }

  /** The imagery weight before the zoom fade: theme opacity times the reveal. */
  function imageryWeight(): number {
    if (!imagery || theme.imagery <= 0) return 0;
    const now = performance.now();
    imageryShownAt ??= now;
    return (
      theme.imagery * imageryReveal(now - imageryShownAt, init.reducedMotion())
    );
  }

  // --- regions -------------------------------------------------------------
  function setRegions(next: readonly GlobeRegion[]): void {
    /* Grouped by colour because the coverage target holds one group's fill and
       stroke at a time. Regions that share colours — the usual case — collapse to
       a single group and a single pass. */
    const byColour = new Map<string, GlobeRegion[]>();
    for (const region of next) {
      const key = `${region.fill.join()}|${region.stroke.join()}|${region.strokeWidth}`;
      const existing = byColour.get(key);
      if (existing) existing.push(region);
      else byColour.set(key, [region]);
    }

    geometryDirty = true;
    regionGroups = [...byColour.values()].map((group) => {
      const prepared: PreparedPolygon[] = [];
      for (const region of group) {
        for (const polygon of region.polygons) {
          prepared.push(preparePolygon(polygon, MAX_EDGE_DEG));
        }
      }
      return {
        fill: group[0].fill,
        stroke: group[0].stroke,
        strokeWidthCss: group[0].strokeWidth,
        mesh: triangulatePolygons(prepared),
        outline: concatFloat32(
          prepared.map((polygon) => outlineSegments(polygon)),
        ),
      };
    });
    coverageKey = "";
  }

  function concatFloat32(
    parts: readonly ArrayLike<number>[],
  ): Float32Array<ArrayBuffer> {
    let total = 0;
    for (const part of parts) total += part.length;
    const out = new Float32Array(total);
    let at = 0;
    for (const part of parts) {
      out.set(part, at);
      at += part.length;
    }
    return out;
  }

  // --- markers and labels --------------------------------------------------
  function setMarkers(next: readonly GlobeMarker[]): void {
    markers = next;
    rebuildMarkerInstances();
    rebuildLabels();
  }

  function rebuildMarkerInstances(): void {
    // A ring is a second instance, so one pipeline draws dots and selection rings.
    let count = 0;
    for (const marker of markers) count += marker.ring ? 2 : 1;
    const data = new Float32Array(count * MARKER_FLOATS);
    let at = 0;
    const put = (
      marker: GlobeMarker,
      outer: number,
      inner: number,
      colour: Rgba,
      night: Rgba | undefined,
    ) => {
      data[at] = marker.position[0];
      data[at + 1] = marker.position[1];
      data[at + 2] = outer;
      data[at + 3] = inner;
      data[at + 4] = colour[0];
      data[at + 5] = colour[1];
      data[at + 6] = colour[2];
      data[at + 7] = colour[3];
      const nightColour = night ?? colour;
      data[at + 8] = nightColour[0];
      data[at + 9] = nightColour[1];
      data[at + 10] = nightColour[2];
      data[at + 11] = nightColour[3];
      data[at + 12] = night ? 1 : 0;
      data[at + 13] = 0;
      at += MARKER_FLOATS;
    };
    for (const marker of markers) {
      put(marker, marker.radius, 0, marker.color, marker.nightColor);
      if (marker.ring) {
        /* A ring is the difference of two discs: outer edge at `radius`, hole at
           `radius - width`, which is how a stroked circle of that width reads. */
        put(
          marker,
          marker.ring.radius + marker.ring.width / 2,
          marker.ring.radius - marker.ring.width / 2,
          marker.ring.color,
          undefined,
        );
      }
    }
    upload(
      markerInstances,
      "globe-markers",
      data,
      GPUBufferUsage.VERTEX,
      MARKER_FLOATS,
    );
  }

  function rebuildLabels(): void {
    const labels = markers
      .map((marker) => marker.label)
      .filter(
        (label): label is string =>
          typeof label === "string" && label.length > 0,
      );
    const signature = `${labelFont}|${dpr}|${labels.join("\u0000")}`;
    if (signature === atlasLabels && atlas) {
      rebuildLabelInstances();
      return;
    }
    atlasLabels = signature;
    atlas?.destroy();
    atlas = buildLabelAtlas(device, labels, labelFont, dpr);
    labelGroup = atlas
      ? device.createBindGroup({
          layout: pipelines.label.getBindGroupLayout(0),
          entries: [
            { binding: 0, resource: { buffer: uniformBuffer } },
            { binding: 1, resource: atlas.view },
            { binding: 2, resource: atlas.sampler },
          ],
        })
      : null;
    rebuildLabelInstances();
  }

  function rebuildLabelInstances(): void {
    if (!atlas) {
      labelInstances.count = 0;
      return;
    }
    const rows: number[] = [];
    for (const marker of markers) {
      if (!marker.label) continue;
      const rect = atlas.rects.get(marker.label);
      if (!rect) continue;
      /* The atlas rectangle includes the halo margin, so the quad starts that
         far up and left of the text, which stays where it always was. A
         ringed marker's label slides right until its halo clears the ring,
         by whole device pixels so the glyphs still land one texel per pixel. */
      const ringShift = Math.ceil(labelRingShift(marker.ring) * dpr) / dpr;
      rows.push(
        marker.position[0],
        marker.position[1],
        LABEL_OFFSET_X - rect.marginCss,
        LABEL_OFFSET_Y - rect.marginCss,
        rect.widthCss,
        rect.heightCss,
        rect.u0,
        rect.v0,
        rect.u1,
        rect.v1,
        ringShift,
      );
    }
    upload(
      labelInstances,
      "globe-labels",
      new Float32Array(rows),
      GPUBufferUsage.VERTEX,
      LABEL_FLOATS,
    );
  }

  // --- arcs ----------------------------------------------------------------
  function setArcs(next: readonly GlobeArc[]): void {
    arcs = next;
    geometryDirty = true;
    coverageKey = "";
  }

  /**
   * Arc polylines as stroke segments.
   *
   * Arcs join the region stroke channel rather than getting a pipeline of their
   * own: a great circle densified by `greatCirclePoints` is a polyline, which is
   * exactly what the stroke pipeline already draws.
   */
  function arcSegments(): Float32Array<ArrayBuffer> {
    if (arcs.length === 0) return new Float32Array(0);
    const rows: number[] = [];
    for (const arc of arcs) {
      const points = greatCirclePoints(arc.from, arc.to);
      for (let i = 2; i < points.length; i += 2) {
        rows.push(points[i - 2], points[i - 1], points[i], points[i + 1]);
      }
    }
    return new Float32Array(rows);
  }

  // --- drawing -------------------------------------------------------------
  function writeUniformBlock(
    frame: FrameState,
    group: RegionGroup | null,
    imageryShown: number,
  ): void {
    writeUniforms(uniformData, {
      widthDev,
      heightDev,
      radiusDev: frame.camera.radius * dpr,
      centreXDev: frame.camera.centreX * dpr,
      centreYDev: frame.camera.centreY * dpr,
      dpr,
      zoom: frame.zoom,
      quiet: frame.quiet,
      sun: frame.sun,
      cameraTrig: [
        frame.camera.cosLambda,
        frame.camera.sinLambda,
        frame.camera.cosPhi,
        frame.camera.sinPhi,
      ],
      rotationLngDeg: frame.camera.rotation[0],
      subsolar: subsolarUnit(frame.subsolar[0], frame.subsolar[1]),
      theme,
      gridWidthCss: GRID_STROKE_CSS,
      limbWidthCss: LIMB_STROKE_CSS,
      atmosphereReach: ATMOSPHERE_REACH,
      imagery: imageryShown,
      casingWidthCss: CASING_CSS,
      regionFill: group?.fill ?? TRANSPARENT,
      regionStroke: group?.stroke ?? TRANSPARENT,
    });
    device.queue.writeBuffer(uniformBuffer, 0, uniformData);
  }

  function subsolarUnit(lng: number, lat: number): [number, number, number] {
    const rad = Math.PI / 180;
    const cosLat = Math.cos(lat * rad);
    return [
      cosLat * Math.cos(lng * rad),
      cosLat * Math.sin(lng * rad),
      Math.sin(lat * rad),
    ];
  }

  /** Draw land and one region group into the coverage target. */
  function encodeCoverage(
    encoder: GPUCommandEncoder,
    group: RegionGroup | null,
    withLand: boolean,
  ): void {
    if (!msaaView || !resolveView) return;
    const pass = encoder.beginRenderPass({
      label: "globe-coverage",
      colorAttachments: [
        {
          view: msaaView,
          resolveTarget: resolveView,
          loadOp: "clear",
          storeOp: "discard",
          clearValue: { r: 0, g: 0, b: 0, a: 0 },
        },
      ],
    });

    if (withLand) {
      pass.setPipeline(pipelines.fill);
      pass.setBindGroup(0, fillUniformGroup);
      pass.setBindGroup(1, fillLayerGroups.landFill);
      pass.setVertexBuffer(0, landVertices);
      pass.setIndexBuffer(landIndices, "uint32");
      pass.drawIndexed(land.mesh.indices.length);

      pass.setPipeline(pipelines.stroke);
      pass.setBindGroup(0, strokeUniformGroup);
      pass.setBindGroup(1, strokeLayerGroups.landStroke);
      pass.setVertexBuffer(0, landOutline);
      pass.draw(6, land.outline.length / 4);
    }

    if (group) {
      if (
        regionIndices.count > 0 &&
        regionVertices.buffer &&
        regionIndices.buffer
      ) {
        pass.setPipeline(pipelines.fill);
        pass.setBindGroup(0, fillUniformGroup);
        pass.setBindGroup(1, fillLayerGroups.regionFill);
        pass.setVertexBuffer(0, regionVertices.buffer);
        pass.setIndexBuffer(regionIndices.buffer, "uint32");
        pass.drawIndexed(regionIndices.count);
      }
      if (regionOutline.count > 0 && regionOutline.buffer) {
        pass.setPipeline(pipelines.stroke);
        pass.setBindGroup(0, strokeUniformGroup);
        pass.setBindGroup(1, strokeLayerGroups.regionStroke);
        pass.setVertexBuffer(0, regionOutline.buffer);
        pass.draw(6, regionOutline.count);
      }
    }

    pass.end();
  }

  /** Load one region group's geometry into the dynamic buffers, if it changed. */
  function bindGroupGeometry(group: RegionGroup): void {
    if (!geometryDirty && boundGroup === group) return;
    boundGroup = group;
    geometryDirty = false;
    const segments = concatFloat32([group.outline, arcSegments()]);
    upload(
      regionVertices,
      "globe-region-vertices",
      group.mesh.vertices,
      GPUBufferUsage.VERTEX,
      2,
    );
    upload(
      regionIndices,
      "globe-region-indices",
      group.mesh.indices,
      GPUBufferUsage.INDEX,
      1,
    );
    upload(
      regionOutline,
      "globe-region-outline",
      segments,
      GPUBufferUsage.VERTEX,
      4,
    );
    writeLayerWidth(layerBuffers.regionStroke, group.strokeWidthCss * dpr);
  }

  function render(frame: FrameState): void {
    if (destroyed || failed || !coverageView || !surfaceGroup) return;

    const first = regionGroups[0] ?? null;
    if (first) bindGroupGeometry(first);
    else if (geometryDirty || boundGroup !== null) {
      // Arcs still need drawing when there is no region to group them with.
      boundGroup = null;
      geometryDirty = false;
      regionVertices.count = 0;
      regionIndices.count = 0;
      upload(
        regionOutline,
        "globe-region-outline",
        arcSegments(),
        GPUBufferUsage.VERTEX,
        4,
      );
      writeLayerWidth(layerBuffers.regionStroke, 1 * dpr);
    }

    const imageryShown = imageryWeight();
    writeUniformBlock(frame, first, imageryShown);

    const encoder = device.createCommandEncoder({ label: "globe-frame" });

    /* The coverage target depends on the camera, the size and the geometry, none
       of which the once-a-second clock tick changes — that only moves the sun, so
       a still globe re-runs the surface pass alone. */
    const key = [
      frame.camera.rotation[0].toFixed(4),
      frame.camera.rotation[1].toFixed(4),
      frame.camera.radius.toFixed(3),
      widthDev,
      heightDev,
      regionGroups.length,
      regionIndices.count,
      regionOutline.count,
    ].join("|");
    if (key !== coverageKey) {
      coverageKey = key;
      encodeCoverage(encoder, first, true);
    }

    const canvasView = context.getCurrentTexture().createView();
    const extraGroups = regionGroups.slice(1);

    const surfacePass = encoder.beginRenderPass({
      label: "globe-surface",
      colorAttachments: [
        {
          view: canvasView,
          loadOp: "clear",
          storeOp: "store",
          clearValue: { r: 0, g: 0, b: 0, a: 0 },
        },
      ],
    });
    surfacePass.setPipeline(pipelines.surface);
    surfacePass.setBindGroup(0, surfaceGroup);
    surfacePass.draw(6);
    if (extraGroups.length === 0) {
      drawSprites(surfacePass, frame);
    }
    surfacePass.end();

    /* Each further colour group needs the coverage target to itself, so it gets a
       pass of its own. Never reached by the Dox globe, which highlights one zone. */
    for (const group of extraGroups) {
      bindGroupGeometry(group);
      writeUniformBlock(frame, group, imageryShown);
      encodeCoverage(encoder, group, false);
      const overlayPass = encoder.beginRenderPass({
        label: "globe-region-overlay",
        colorAttachments: [
          { view: canvasView, loadOp: "load", storeOp: "store" },
        ],
      });
      overlayPass.setPipeline(pipelines.overlay);
      overlayPass.setBindGroup(0, overlayGroup!);
      overlayPass.draw(6);
      overlayPass.end();
    }

    if (extraGroups.length > 0) {
      const spritePass = encoder.beginRenderPass({
        label: "globe-sprites",
        colorAttachments: [
          { view: canvasView, loadOp: "load", storeOp: "store" },
        ],
      });
      drawSprites(spritePass, frame);
      spritePass.end();
    }

    /* Still fading in — including the first frame with the imagery, which
       draws at weight 0 — so ask for the next frame. A globe at rest draws
       once a second otherwise, which would jump the fade instead of running
       it. */
    if (imagery && theme.imagery > 0 && imageryShown < theme.imagery) {
      init.invalidate();
    }

    if (!firstFrameChecked) {
      firstFrameChecked = true;
      /* One validation sweep around the first frame. Every later frame runs
         without it: awaiting an error scope per frame would stall the loop, and by
         then a mistake would already have been caught here. */
      device.pushErrorScope("validation");
      try {
        device.queue.submit([encoder.finish()]);
      } finally {
        // Popped even if the submit throws, so the scope cannot leak.
        void device.popErrorScope().then((error) => {
          if (error)
            reportFailure(`first frame failed validation: ${error.message}`);
        });
      }
      return;
    }

    device.queue.submit([encoder.finish()]);
  }

  function drawSprites(pass: GPURenderPassEncoder, frame: FrameState): void {
    if (markerInstances.count > 0 && markerInstances.buffer) {
      pass.setPipeline(pipelines.marker);
      pass.setBindGroup(0, markerUniformGroup);
      pass.setVertexBuffer(0, markerInstances.buffer);
      pass.draw(6, markerInstances.count);
    }
    /* Labels are dropped while the globe moves and once it is zoomed in — the
       same rule the canvas-2D renderer follows, so the two agree on when the
       globe stops being a labelled map and becomes an object in motion. */
    const showLabels = !frame.quiet && frame.zoom < LABEL_MAX_ZOOM;
    if (
      showLabels &&
      labelInstances.count > 0 &&
      labelInstances.buffer &&
      labelGroup
    ) {
      pass.setPipeline(pipelines.label);
      pass.setBindGroup(0, labelGroup);
      pass.setVertexBuffer(0, labelInstances.buffer);
      pass.draw(6, labelInstances.count);
    }
  }

  maybeLoadImagery();

  return {
    kind: "webgpu",
    canvas,
    resize,
    setTheme(next: GlobeTheme) {
      theme = next;
      maybeLoadImagery();
    },
    setRegions,
    setMarkers,
    setArcs,
    render,
    onFailure(callback) {
      failureCallback = callback;
      if (failed) callback("renderer already failed");
    },
    destroy() {
      destroyed = true;
      imagery?.release();
      imagery = null;
      imageryPlaceholder.destroy();
      atlas?.destroy();
      msaaTexture?.destroy();
      coverageTexture?.destroy();
      for (const slot of [
        regionVertices,
        regionIndices,
        regionOutline,
        markerInstances,
        labelInstances,
      ]) {
        slot.buffer?.destroy();
        slot.buffer = null;
      }
      uniformBuffer.destroy();
      for (const buffer of Object.values(layerBuffers)) buffer.destroy();
      landVertices.destroy();
      landIndices.destroy();
      landOutline.destroy();
      canvas.remove();
      bundle.release();
    },
  };
}
