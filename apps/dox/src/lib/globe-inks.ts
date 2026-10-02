/**
 * How strongly the Dox globe inks its labels and minor markers.
 *
 * Its own module so `globe.ts`, which paints with these, and
 * `globe-contrast.test.ts`, which holds them to the site's contrast floors over
 * the Earth imagery, read one number rather than two copies of it.
 */

/** Marker labels: quieter than body text, and still clear of 7:1. */
export const LABEL_ALPHA = 0.75;

/** Markers for zones outside the curated set, so the curated ones lead. */
export const MINOR_MARKER_ALPHA = 0.55;
