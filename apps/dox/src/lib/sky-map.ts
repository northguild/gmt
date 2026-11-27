/**
 * The night sky's equirectangular maps: the Milky Way's, the Moon's. A map is read between its
 * four nearest cells, wrapping round in longitude and held at the poles.
 */

/** An all-sky or all-surface map's pixels, four bytes each, as `getImageData` gives them. */
export interface SkyMap {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

/**
 * The map's `channel` (0 red, 1 green, 2 blue, 0 to 255) at a place given as fractions of its
 * width and height: `u` 0 at the left edge, wrapping every 1; `v` 0 at the top, held to the first
 * and last cell centre. Bilinear between the four cells about the place. It runs once a pixel on
 * every frame of a flight (the Milky Way band), so it makes no closures and no objects.
 */
export function sampleMap(
  map: SkyMap,
  u: number,
  v: number,
  channel: 0 | 1 | 2 = 0,
): number {
  const { width, height, data } = map;
  const x = u * width - 0.5;
  const y = Math.min(height - 1, Math.max(0, v * height - 0.5));
  const x0 = Math.floor(x);
  const y0 = Math.min(height - 2, Math.floor(y));
  const left = (((x0 % width) + width) % width) * 4 + channel;
  const right = ((((x0 + 1) % width) + width) % width) * 4 + channel;
  const top = y0 * width * 4;
  const below = top + width * 4;
  const wl = 1 + x0 - x;
  const wr = x - x0;
  return (
    (data[top + left]! * wl + data[top + right]! * wr) * (1 + y0 - y) +
    (data[below + left]! * wl + data[below + right]! * wr) * (y - y0)
  );
}
