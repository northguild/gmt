/**
 * Marker labels, rasterised once into a texture atlas (#289).
 *
 * Text is the one thing a 2D canvas does better than a shader: it has the font
 * stack, the shaper and the hinting already. So the labels are drawn there once,
 * uploaded as a single texture, and sampled by instanced quads — which keeps the
 * per-frame cost at one draw call for every label on the globe, and keeps the
 * glyphs identical to the ones the canvas-2D fallback draws.
 *
 * Rebuilt only when the label set, the font or the device pixel ratio changes.
 * Drag, zoom and the clock tick all reuse it.
 */

/** Where one label sits in the atlas, and how big to draw it. */
export interface LabelRect {
  /** Texture coordinates, 0..1. */
  u0: number;
  v0: number;
  u1: number;
  v1: number;
  /** Size in CSS pixels. */
  widthCss: number;
  heightCss: number;
}

export interface LabelAtlas {
  texture: GPUTexture;
  view: GPUTextureView;
  sampler: GPUSampler;
  rects: ReadonlyMap<string, LabelRect>;
  /** What this atlas was built for, so a caller can tell when it is stale. */
  readonly font: string;
  readonly dpr: number;
  destroy(): void;
}

/** Atlas rows wrap at this width in device pixels, well inside every limit. */
const MAX_ATLAS_WIDTH = 1024;

/** Breathing room around each label, so filtering cannot pull in a neighbour. */
const PADDING = 2;

/**
 * Rasterise `labels` into one texture.
 *
 * Returns null when there is nothing to draw or no 2D context to draw it with —
 * labels are decoration, and a globe without them is still a working globe.
 */
export function buildLabelAtlas(
  device: GPUDevice,
  labels: readonly string[],
  font: string,
  dpr: number,
): LabelAtlas | null {
  const unique = [...new Set(labels)].filter((label) => label.length > 0);
  if (unique.length === 0) return null;

  const measurer = document.createElement("canvas").getContext("2d");
  if (!measurer) return null;
  measurer.font = font;

  /* `fontBoundingBox*` where the engine reports it, falling back to the em size:
     a label's box has to cover ascenders and descenders, and a height taken from
     the glyphs actually present would clip the next label that has a descender. */
  const probe = measurer.measureText("Mg");
  const ascent =
    probe.fontBoundingBoxAscent || probe.actualBoundingBoxAscent || 10;
  const descent =
    probe.fontBoundingBoxDescent || probe.actualBoundingBoxDescent || 3;
  const lineHeightCss = Math.ceil(ascent + descent);

  const measured = unique.map((label) => ({
    label,
    widthCss: Math.ceil(measurer.measureText(label).width),
  }));

  // Lay out in rows, in device pixels.
  const rowHeight = Math.ceil(lineHeightCss * dpr) + PADDING * 2;
  let x = 0;
  let y = 0;
  let width = 0;
  const placements = measured.map((entry) => {
    const boxWidth = Math.ceil(entry.widthCss * dpr) + PADDING * 2;
    if (x + boxWidth > MAX_ATLAS_WIDTH && x > 0) {
      x = 0;
      y += rowHeight;
    }
    const at = { ...entry, x, y, boxWidth };
    x += boxWidth;
    width = Math.max(width, x);
    return at;
  });
  const height = y + rowHeight;

  const limit = device.limits.maxTextureDimension2D;
  if (width > limit || height > limit) return null;

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, width);
  canvas.height = Math.max(1, height);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.scale(dpr, dpr);
  ctx.font = font;
  ctx.textBaseline = "alphabetic";
  /* White text, so the theme's label colour multiplies the alpha channel in the
     shader and one atlas serves both themes. */
  ctx.fillStyle = "#ffffff";
  for (const placement of placements) {
    ctx.fillText(
      placement.label,
      (placement.x + PADDING) / dpr,
      (placement.y + PADDING) / dpr + ascent,
    );
  }

  const texture = device.createTexture({
    label: "globe-label-atlas",
    size: [canvas.width, canvas.height],
    format: "rgba8unorm",
    usage:
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.COPY_DST |
      GPUTextureUsage.RENDER_ATTACHMENT,
  });
  device.queue.copyExternalImageToTexture({ source: canvas }, { texture }, [
    canvas.width,
    canvas.height,
  ]);

  const rects = new Map<string, LabelRect>();
  for (const placement of placements) {
    rects.set(placement.label, {
      u0: (placement.x + PADDING) / canvas.width,
      v0: (placement.y + PADDING) / canvas.height,
      u1: (placement.x + PADDING + placement.widthCss * dpr) / canvas.width,
      v1: (placement.y + PADDING + lineHeightCss * dpr) / canvas.height,
      widthCss: placement.widthCss,
      heightCss: lineHeightCss,
    });
  }

  return {
    texture,
    view: texture.createView(),
    sampler: device.createSampler({
      label: "globe-label-sampler",
      magFilter: "linear",
      minFilter: "linear",
    }),
    rects,
    font,
    dpr,
    destroy() {
      texture.destroy();
    },
  };
}
