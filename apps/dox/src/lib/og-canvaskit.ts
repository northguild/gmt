/**
 * The CanvasKit that draws the share card, loaded once: `canvaskit-wasm`, the `full` build, for
 * paragraphs and fonts. Node only: the build, the social-preview script and the Earth script call it.
 */
import { createRequire } from "node:module";
import type { CanvasKit } from "canvaskit-wasm";

const { resolve } = createRequire(import.meta.url);

let singleton: Promise<CanvasKit> | undefined;

export function getCanvasKit(): Promise<CanvasKit> {
  singleton ??= import("canvaskit-wasm/full").then(({ default: init }) =>
    init({
      locateFile: (file: string) => resolve(`canvaskit-wasm/bin/full/${file}`),
    }),
  );
  return singleton;
}
