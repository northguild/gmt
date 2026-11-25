/**
 * The Sun's disc in a grey image: finding it and cutting the square round it. Pure maths on bytes;
 * `prepare-sky-bodies.mjs` reads the file and calls these (and re-exports them for its tests).
 */

/** The disc is found where the luma is above this share of the median on-disc luma. */
const DISC_THRESHOLD = 0.1;
/** The crop's half side, in solar radii. */
const DISC_CROP = 1.02;

/**
 * The disc in a grey image (`luma`, `size` square): the pixels brighter than 10% of the median
 * on-disc luma, whose centroid is the centre and whose area gives the radius. The on-disc luma
 * is first taken from the pixels over a tenth of the 99th percentile, which leaves out the sky.
 */
export function fitDisc(luma, size) {
  const sorted = Uint8Array.from(luma).sort();
  const seed = DISC_THRESHOLD * sorted[Math.floor(0.99 * (sorted.length - 1))];
  const inside = sorted.filter((v) => v > seed);
  const threshold = DISC_THRESHOLD * inside[inside.length >> 1];
  let area = 0;
  let sumX = 0;
  let sumY = 0;
  for (let p = 0; p < luma.length; p++)
    if (luma[p] > threshold) {
      area++;
      sumX += (p % size) + 0.5;
      sumY += Math.floor(p / size) + 0.5;
    }
  if (area === 0) throw new Error("no disc in the image");
  return { x: sumX / area, y: sumY / area, radius: Math.sqrt(area / Math.PI) };
}

/** The JPEG's luma bytes (0.299 R + 0.587 G + 0.114 B) of RGB bytes. */
export const lumaOf = (rgb) => {
  const luma = new Uint8Array(rgb.length / 3);
  for (let p = 0; p < luma.length; p++)
    luma[p] = Math.round(
      0.299 * rgb[3 * p] + 0.587 * rgb[3 * p + 1] + 0.114 * rgb[3 * p + 2],
    );
  return luma;
};

/**
 * The Sun as a square of `DISC_CROP` solar radii round the fitted disc, in luma, `size` pixels a
 * side with a pixel of edge coverage: black outside the limb. `rgb` is the crop, already scaled.
 */
export function discImage(rgb, size) {
  const luma = lumaOf(rgb);
  const edge = size / (2 * DISC_CROP);
  for (let j = 0, p = 0; j < size; j++)
    for (let i = 0; i < size; i++, p++) {
      const rho = Math.hypot(i + 0.5 - size / 2, j + 0.5 - size / 2);
      luma[p] = Math.round(
        luma[p] * Math.min(1, Math.max(0, edge - rho + 0.5)),
      );
    }
  return luma;
}
