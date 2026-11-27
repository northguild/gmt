/**
 * What the landing starts as soon as its copy has painted, so the Earth is not waiting behind a
 * chain of script fetches: the Earth's imagery (the largest file the hero needs, and the one the
 * first lit frame waits for) and the globe's code, each in the order the globe asks for it. The
 * mount itself still waits for the browser to be idle (`Globe.astro`); this only moves the fetches
 * ahead of it. It runs after the first contentful paint, so none of it competes with the page's
 * stylesheet or the copy, which is the page's largest paint.
 */
import { EARTH_IMAGERY_URL } from "./globe-assets";
import { whenPainted } from "./yield-to-main";

/** The token that is 0 where the photograph is not shown (`gmt-a11y.css`, the light theme). */
export const IMAGERY_ALPHA_TOKEN = "--gmt-globe-imagery-alpha";

/** Whether the theme shows the photograph on this page: the token is 0 under forced colours and raised contrast. */
function imageryShown(stage: HTMLElement): boolean {
  const alpha = parseFloat(
    getComputedStyle(stage).getPropertyValue(IMAGERY_ALPHA_TOKEN),
  );
  return !(alpha <= 0);
}

/**
 * Preloads the Earth's imagery and imports the globe's chunks, once the copy has painted. Only the
 * WebGPU renderer reads the imagery, so a browser without it fetches neither the file nor that
 * renderer's chunk.
 */
export async function warmGlobe(stage: HTMLElement): Promise<void> {
  await whenPainted();
  const gpu = "gpu" in navigator;
  if (gpu && imageryShown(stage)) {
    const link = document.createElement("link");
    link.rel = "preload";
    link.setAttribute("as", "fetch");
    link.href = EARTH_IMAGERY_URL;
    link.crossOrigin = "anonymous";
    link.setAttribute("fetchpriority", "high");
    document.head.append(link);
  }
  /* The same specifiers the mount and the engine import, so each is one chunk fetched once. */
  const chunks: Promise<unknown>[] = [
    import("./globe-mount"),
    import("./globe"),
  ];
  if (gpu) chunks.push(import("./globe/webgpu/renderer-webgpu"));
  await Promise.allSettled(chunks);
}
