/**
 * Whether a worker would draw the globe's labels exactly as the page does (#289).
 *
 * A canvas on the page takes its text settings from the element's computed style, and an
 * `OffscreenCanvas` in a worker has no element. The globe canvas and this probe set
 * `-webkit-font-smoothing: auto`, which is what a worker draws with, so both paths raster alike.
 * The page still draws the same label on the probe and on an `OffscreenCanvas` and compares the
 * pixels: where an engine still differs, the globe takes the main-thread renderer and keeps its
 * look; the worker draws only where the pixels are identical.
 */

const WIDTH = 160;
const HEIGHT = 32;

/** One label as the painter draws it: a round-joined halo, then the fill, at a fractional origin. */
function paintLabel(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  font: string,
): void {
  ctx.font = font;
  ctx.lineJoin = "round";
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#000";
  ctx.fillStyle = "#fff";
  ctx.strokeText("Los Angeles 0123", 10.3, 20.4);
  ctx.fillText("Los Angeles 0123", 10.3, 20.4);
}

/** True when the worker's text would match the page's byte for byte. */
export function workerTextMatchesPage(
  host: HTMLElement,
  font: string,
): boolean {
  const page = document.createElement("canvas");
  page.width = WIDTH;
  page.height = HEIGHT;
  page.style.cssText =
    "position:absolute;width:0;height:0;visibility:hidden;pointer-events:none;-webkit-font-smoothing:auto;-moz-osx-font-smoothing:auto";
  host.appendChild(page);
  try {
    const pageCtx = page.getContext("2d");
    const workerCtx = new OffscreenCanvas(WIDTH, HEIGHT).getContext("2d");
    if (!pageCtx || !workerCtx) return false;
    paintLabel(pageCtx, font);
    paintLabel(workerCtx, font);
    const a = pageCtx.getImageData(0, 0, WIDTH, HEIGHT).data;
    const b = workerCtx.getImageData(0, 0, WIDTH, HEIGHT).data;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  } catch {
    return false;
  } finally {
    page.remove();
  }
}
