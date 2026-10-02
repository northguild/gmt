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
 *
 * Two channels: red is the glyph coverage, green a halo round the glyphs. The
 * halo is what keeps a label readable over the Earth imagery (#293), where the
 * text colour that reads on a flat dark sphere can sit on desert or ice; the
 * label shader draws it only where the imagery shows.
 */

/**
 * Where one label sits in the atlas, and how big to draw it.
 *
 * The rectangle covers the glyph box plus the halo round it, so the quad is
 * drawn `marginCss` up and left of where the text itself starts.
 */
export interface LabelRect {
  /** Texture coordinates, 0..1. */
  u0: number;
  v0: number;
  u1: number;
  v1: number;
  /** Size in CSS pixels, halo margin included. */
  widthCss: number;
  heightCss: number;
  /** The halo margin on each side, in CSS pixels. */
  marginCss: number;
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
const GUARD = 1;

/**
 * Width of the halo round each glyph, in CSS pixels — a stroke twice this wide,
 * centred on the outline.
 */
const HALO_CSS = 2;

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

  /* The halo margin in whole device pixels, so a texel still lands on exactly
     one device pixel once the quad is grown by it. */
  const marginDev = Math.ceil(HALO_CSS * dpr);
  const inset = GUARD + marginDev;

  // Lay out in rows, in device pixels.
  const rowHeight = Math.ceil(lineHeightCss * dpr) + inset * 2;
  let x = 0;
  let y = 0;
  let width = 0;
  const placements = measured.map((entry) => {
    const boxWidth = Math.ceil(entry.widthCss * dpr) + inset * 2;
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

  const atlasWidth = Math.max(1, width);
  const atlasHeight = Math.max(1, height);

  /**
   * One coverage layer, read back as alpha. White on transparent, so the
   * alpha channel is the coverage and the theme supplies every colour.
   */
  const rasterise = (
    paint: (
      ctx: CanvasRenderingContext2D,
      label: string,
      x: number,
      y: number,
    ) => void,
  ): Uint8ClampedArray | null => {
    const canvas = document.createElement("canvas");
    canvas.width = atlasWidth;
    canvas.height = atlasHeight;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.scale(dpr, dpr);
    ctx.font = font;
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#ffffff";
    for (const placement of placements) {
      paint(
        ctx,
        placement.label,
        (placement.x + inset) / dpr,
        (placement.y + inset) / dpr + ascent,
      );
    }
    return ctx.getImageData(0, 0, atlasWidth, atlasHeight).data;
  };

  const glyphs = rasterise((ctx, label, x, y) => ctx.fillText(label, x, y));
  const halo = rasterise((ctx, label, x, y) => {
    ctx.lineWidth = HALO_CSS * 2;
    ctx.lineJoin = "round";
    ctx.strokeText(label, x, y);
    ctx.fillText(label, x, y);
  });
  if (!glyphs || !halo) return null;

  const texels = new Uint8Array(atlasWidth * atlasHeight * 4);
  for (let i = 0; i < texels.length; i += 4) {
    texels[i] = glyphs[i + 3];
    texels[i + 1] = halo[i + 3];
    texels[i + 3] = 255;
  }

  const texture = device.createTexture({
    label: "globe-label-atlas",
    size: [atlasWidth, atlasHeight],
    format: "rgba8unorm",
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
  });
  device.queue.writeTexture(
    { texture },
    texels,
    { bytesPerRow: atlasWidth * 4 },
    [atlasWidth, atlasHeight],
  );

  const marginCss = marginDev / dpr;
  const rects = new Map<string, LabelRect>();
  for (const placement of placements) {
    const left = placement.x + GUARD;
    const top = placement.y + GUARD;
    rects.set(placement.label, {
      u0: left / atlasWidth,
      v0: top / atlasHeight,
      u1: (left + placement.widthCss * dpr + marginDev * 2) / atlasWidth,
      v1: (top + lineHeightCss * dpr + marginDev * 2) / atlasHeight,
      widthCss: placement.widthCss + marginCss * 2,
      heightCss: lineHeightCss + marginCss * 2,
      marginCss,
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
