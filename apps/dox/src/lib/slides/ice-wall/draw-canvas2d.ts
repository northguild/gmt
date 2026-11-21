/**
 * The ice wall's canvas-2D renderer.
 *
 * A whole pane is one `drawImage` under the affine that maps the image's corners to the pane's.
 * A shard is a `Path2D` clip of the pane image (in image pixels, built once) under the affine
 * that maps three of its projected corners; the three furthest apart keep the perspective error
 * of the affine under a pixel for a shard this small. The edge is a 1 px ice line, and the frost
 * a faint ice fill. No blur, no shadow.
 */
import { css, type RendererOptions, type WallRenderer } from "./renderer";
import type { Drawable } from "./frame";

const FROST_ALPHA = 0.14;
const EDGE_ALPHA = 0.85;
const BORDER_ALPHA = 0.55;

export function createCanvas2dRenderer(
  o: RendererOptions,
): WallRenderer | null {
  const ctx = o.canvas.getContext("2d", { alpha: true });
  if (!ctx) return null;
  const clips = new Map<string, Path2D>();
  let dpr = 1;
  let destroyed = false;

  const clipFor = (d: Drawable, iw: number, ih: number): Path2D => {
    const key = `${d.pane}:${d.cell}`;
    let path = clips.get(key);
    if (!path) {
      path = new Path2D();
      for (let i = 0; i < d.uvs.length; i += 2) {
        const x = d.uvs[i]! * iw;
        const y = d.uvs[i + 1]! * ih;
        if (i === 0) path.moveTo(x, y);
        else path.lineTo(x, y);
      }
      path.closePath();
      clips.set(key, path);
    }
    return path;
  };

  /** The indices of the three corners that span the largest triangle. */
  const spread = (uvs: readonly number[]): [number, number, number] => {
    const n = uvs.length / 2;
    let best: [number, number, number] = [0, 1 % n, 2 % n];
    let area = -1;
    for (let a = 0; a < n; a += 1)
      for (let b = a + 1; b < n; b += 1)
        for (let c = b + 1; c < n; c += 1) {
          const t = Math.abs(
            (uvs[b * 2]! - uvs[a * 2]!) * (uvs[c * 2 + 1]! - uvs[a * 2 + 1]!) -
              (uvs[c * 2]! - uvs[a * 2]!) * (uvs[b * 2 + 1]! - uvs[a * 2 + 1]!),
          );
          if (t > area) {
            area = t;
            best = [a, b, c];
          }
        }
    return best;
  };

  /** The matrix taking image pixels to screen pixels through three matched corners. */
  const affine = (
    d: Drawable,
    ids: readonly [number, number, number],
    iw: number,
    ih: number,
  ): [number, number, number, number, number, number] | null => {
    const [a, b, c] = ids;
    const u0 = d.uvs[a * 2]! * iw;
    const v0 = d.uvs[a * 2 + 1]! * ih;
    const du1 = d.uvs[b * 2]! * iw - u0;
    const dv1 = d.uvs[b * 2 + 1]! * ih - v0;
    const du2 = d.uvs[c * 2]! * iw - u0;
    const dv2 = d.uvs[c * 2 + 1]! * ih - v0;
    const det = du1 * dv2 - du2 * dv1;
    if (Math.abs(det) < 1e-9) return null;
    const x0 = d.pts[a * 2]!;
    const y0 = d.pts[a * 2 + 1]!;
    const dx1 = d.pts[b * 2]! - x0;
    const dy1 = d.pts[b * 2 + 1]! - y0;
    const dx2 = d.pts[c * 2]! - x0;
    const dy2 = d.pts[c * 2 + 1]! - y0;
    const m11 = (dx1 * dv2 - dx2 * dv1) / det;
    const m21 = (dx2 * du1 - dx1 * du2) / det;
    const m12 = (dy1 * dv2 - dy2 * dv1) / det;
    const m22 = (dy2 * du1 - dy1 * du2) / det;
    return [
      m11,
      m12,
      m21,
      m22,
      x0 - m11 * u0 - m21 * v0,
      y0 - m12 * u0 - m22 * v0,
    ];
  };

  const outline = (pts: readonly number[]): void => {
    ctx.beginPath();
    for (let i = 0; i < pts.length; i += 2) {
      if (i === 0) ctx.moveTo(pts[i]!, pts[i + 1]!);
      else ctx.lineTo(pts[i]!, pts[i + 1]!);
    }
    ctx.closePath();
  };

  return {
    kind: "canvas2d",
    resize(width, height, ratio) {
      dpr = ratio;
      o.canvas.width = Math.max(1, Math.round(width * ratio));
      o.canvas.height = Math.max(1, Math.round(height * ratio));
    },
    draw(drawables) {
      if (destroyed) return;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, o.canvas.width, o.canvas.height);
      ctx.lineJoin = "round";
      for (const d of drawables) {
        const pane = o.panes[d.pane];
        if (!pane || d.alpha <= 0) continue;
        const img = pane.image;
        const iw = "naturalWidth" in img ? img.naturalWidth : img.width;
        const ih = "naturalHeight" in img ? img.naturalHeight : img.height;
        if (!iw || !ih) continue;
        const whole = d.cell < 0;
        const m = affine(d, whole ? [0, 1, 3] : spread(d.uvs), iw, ih);
        if (!m) continue;
        ctx.save();
        ctx.globalAlpha = d.alpha;
        ctx.setTransform(
          m[0] * dpr,
          m[1] * dpr,
          m[2] * dpr,
          m[3] * dpr,
          m[4] * dpr,
          m[5] * dpr,
        );
        if (whole) {
          ctx.drawImage(img, 0, 0);
        } else {
          const path = clipFor(d, iw, ih);
          ctx.clip(path);
          ctx.drawImage(img, 0, 0);
          ctx.fillStyle = css(o.ice, FROST_ALPHA);
          ctx.fill(path);
        }
        ctx.restore();
        ctx.save();
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.lineWidth = 1;
        ctx.globalAlpha = d.alpha;
        ctx.strokeStyle = css(o.ice, whole ? BORDER_ALPHA : EDGE_ALPHA);
        outline(d.pts);
        ctx.stroke();
        if (d.cracks) {
          ctx.globalAlpha = d.alpha * d.cracks.strength;
          ctx.strokeStyle = css(o.ice, 1);
          for (const edge of d.cracks.edges) {
            outline(edge);
            ctx.stroke();
          }
        }
        ctx.restore();
      }
    },
    destroy() {
      destroyed = true;
      clips.clear();
    },
  };
}
