/**
 * The colour and glow helpers the sky's painters share: a hex colour as channels, an `rgba()`
 * string, and the soft halo round a bright point. Their own module so the star and planet layers
 * load them without the Sun's and the Moon's painter (`sky-bodies.ts`).
 */
import type { Rgb } from "./sky-bodies";

/** `#rrggbb` as its channels, or null. */
export function parseHex(value: string): Rgb | null {
  const found = /^#([0-9a-f]{6})$/i.exec(value.trim());
  if (!found) return null;
  const n = parseInt(found[1]!, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export const rgba = ([r, g, b]: Rgb, a: number): string =>
  `rgba(${r}, ${g}, ${b}, ${a})`;

/**
 * The soft halo round a bright point (a star, a planet, the Sun's glare): `tint` at `alpha` from
 * `inner` px out, fading to nothing at `reach`.
 */
export function drawHalo(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  reach: number,
  tint: Rgb,
  alpha = 0.25,
  inner = 0,
): void {
  const glow = ctx.createRadialGradient(x, y, inner, x, y, reach);
  glow.addColorStop(0, rgba(tint, alpha));
  glow.addColorStop(1, rgba(tint, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(x - reach, y - reach, reach * 2, reach * 2);
}
