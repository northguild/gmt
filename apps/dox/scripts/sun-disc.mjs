/**
 * The Sun's disc in a grey image: finding it and cutting the square round it. Pure maths on bytes;
 * `prepare-sky-bodies.mjs` reads the file and calls these (and re-exports them for its tests).
 */

/** The disc is found where the luma is above this share of the median on-disc luma. */
export const DISC_THRESHOLD = 0.1;
/** The crop's half side, in solar radii. */
export const DISC_CROP = 1.02;

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

/** The share of the disc's pixels that may be brighter than the map's white, as for the Moon (`body-paint.ts`). */
const WHITE_SHARE = 0.001;
/**
 * The half side, in solar radii, of the square the mosaic's background is read over: smaller
 * than one of its 25 tiles (about 0.4 radii), so a tile's edge stays sharp in the background,
 * and larger than a sunspot.
 */
const FLAT_REACH = 0.06;
/** Pixels further than this share from their ring's median (spots, faculae) are left out of the background. */
const FLAT_BAND = 0.07;

/**
 * The disc with the mosaic's flat field taken out. Past the limb darkening, the photosphere's
 * continuum has no structure wider than a sunspot group, so anything wider in the image is the
 * 25 tiles' own vignetting and their steps (about 2 %). Each pixel is divided by its ring's
 * median (the limb darkening, kept), then by the median of that ratio over the square round it,
 * spots and faculae left out. Pixels past the limb are left as they are.
 */
export function flattenDisc(luma, size) {
  const radius = size / (2 * DISC_CROP);
  const centre = size / 2;
  const rhoOf = (p) =>
    Math.hypot((p % size) + 0.5 - centre, Math.floor(p / size) + 0.5 - centre);
  const rings = Array.from({ length: Math.ceil(radius) }, () => []);
  for (let p = 0; p < luma.length; p++) {
    const rho = rhoOf(p);
    if (rho < radius - 1) rings[Math.floor(rho)].push(luma[p]);
  }
  const profile = rings.map((ring) => {
    ring.sort((a, b) => a - b);
    return ring[ring.length >> 1] ?? 0;
  });
  const ratio = new Float32Array(luma.length).fill(Number.NaN);
  for (let p = 0; p < luma.length; p++) {
    const rho = rhoOf(p);
    const level = rho < radius - 1 ? profile[Math.floor(rho)] : 0;
    const r = level > 0 ? luma[p] / level : Number.NaN;
    if (Math.abs(r - 1) < FLAT_BAND) ratio[p] = r;
  }
  const reach = Math.max(1, Math.round(FLAT_REACH * radius));
  const out = Float32Array.from(luma);
  const square = [];
  for (let j = 0; j < size; j++)
    for (let i = 0; i < size; i++) {
      const p = j * size + i;
      if (rhoOf(p) > radius + 1) continue;
      square.length = 0;
      for (
        let y = Math.max(0, j - reach);
        y <= Math.min(size - 1, j + reach);
        y++
      )
        for (
          let x = Math.max(0, i - reach);
          x <= Math.min(size - 1, i + reach);
          x++
        ) {
          const r = ratio[y * size + x];
          if (!Number.isNaN(r)) square.push(r);
        }
      if (square.length < reach * reach) continue;
      square.sort((a, b) => a - b);
      out[p] = luma[p] / square[square.length >> 1];
    }
  return out;
}

/**
 * The Sun as a square of `DISC_CROP` solar radii round the fitted disc, in luma, `size` pixels a
 * side: the mosaic's flat field taken out (`flattenDisc`), scaled so the disc's white (its
 * 99.9th percentile) is 255, with a pixel of edge coverage and black outside the limb. `rgb` is
 * the crop, already scaled. The painter reads a byte over 255 as the level, so nothing clips.
 */
export function discImage(rgb, size) {
  const flat = flattenDisc(lumaOf(rgb), size);
  const edge = size / (2 * DISC_CROP);
  const inside = [];
  for (let p = 0; p < flat.length; p++)
    if (
      Math.hypot(
        (p % size) + 0.5 - size / 2,
        Math.floor(p / size) + 0.5 - size / 2,
      ) <
      edge - 1
    )
      inside.push(flat[p]);
  inside.sort((a, b) => a - b);
  const white =
    inside[Math.floor((1 - WHITE_SHARE) * (inside.length - 1))] || 255;
  const luma = new Uint8Array(flat.length);
  for (let j = 0, p = 0; j < size; j++)
    for (let i = 0; i < size; i++, p++) {
      const rho = Math.hypot(i + 0.5 - size / 2, j + 0.5 - size / 2);
      luma[p] = Math.round(
        Math.min(255, (flat[p] * 255) / white) *
          Math.min(1, Math.max(0, edge - rho + 0.5)),
      );
    }
  return luma;
}
