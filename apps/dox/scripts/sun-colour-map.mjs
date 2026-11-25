/**
 * Whether a false-colour picture's colour table keeps the order of the brightness it encodes.
 * The Sun's source JPEG is one orange table over the continuum intensity; the site keeps only its
 * luma, which is the intensity's order only when every channel of the table rises with it.
 *
 * Run by `prepare-sky-bodies.mjs`, which stops when the table fails; tested in
 * `sun-colour-map.test.ts`.
 */

/**
 * Orders the lit pixels by the sum of their channels, splits that order into `bins` equal-width
 * groups of the sum's range, and returns the mean of each channel per group. A table that rises in
 * all three channels has each mean no lower than the one before, within `tolerance` (JPEG noise).
 *
 * `rgb` is packed bytes. Pixels whose sum is under `floor` (the black sky) are left out.
 * Returns `{ ok, worstDrop }`: the largest fall of any channel's mean between neighbouring groups.
 */
export function colourMapOrdered(
  rgb,
  { bins = 24, floor = 60, tolerance = 3 } = {},
) {
  const sums = Array.from({ length: bins }, () => [0, 0, 0, 0]);
  for (let p = 0; p < rgb.length; p += 3) {
    const total = rgb[p] + rgb[p + 1] + rgb[p + 2];
    if (total < floor) continue;
    const cell =
      sums[
        Math.min(bins - 1, Math.floor(((total - floor) / (765 - floor)) * bins))
      ];
    cell[0]++;
    cell[1] += rgb[p];
    cell[2] += rgb[p + 1];
    cell[3] += rgb[p + 2];
  }
  const means = sums
    .filter(([n]) => n >= 20)
    .map(([n, r, g, b]) => [r / n, g / n, b / n]);
  let worstDrop = 0;
  for (let i = 1; i < means.length; i++)
    for (let c = 0; c < 3; c++)
      worstDrop = Math.max(worstDrop, means[i - 1][c] - means[i][c]);
  return {
    ok: means.length >= 2 && worstDrop <= tolerance,
    worstDrop,
    groups: means.length,
  };
}
