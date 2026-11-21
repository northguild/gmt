/**
 * The DOM a sky mounts into, as the hero and the deck give it: a host holding the Milky Way band
 * canvas under the star canvas, attached to the document. The caller removes `host` after the test.
 */
export function skyHost(): {
  host: HTMLElement;
  stars: HTMLCanvasElement;
  band: HTMLCanvasElement;
} {
  const host = document.createElement("div");
  const stars = document.createElement("canvas");
  const band = document.createElement("canvas");
  host.append(band, stars);
  document.body.append(host);
  return { host, stars, band };
}
