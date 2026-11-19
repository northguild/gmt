/**
 * The readiness rows that read this browser and the deck window: the renderer, reduced motion and
 * fullscreen the deck window reported, the fonts and the gmt modules the deck imports.
 */
import {
  RETRY,
  row,
  type ReadinessRow,
  type ReadinessStatus,
} from "./readiness-rows";
import type { DeckEnv } from "./sync";

/* `load` is asked first: a face the page has not used yet is not loaded, and `check` alone
   would call that missing. */
export type FontSet = Pick<FontFaceSet, "check"> &
  Partial<Pick<FontFaceSet, "load">>;

/** A gmt module the deck imports: the loader's promise settles when the module resolves. */
export interface ModuleLoader {
  name: string;
  load: () => Promise<unknown>;
}

const RENDERER_TEXT: Record<DeckEnv["renderer"], [ReadinessStatus, string]> = {
  webgpu: ["ok", "WebGPU"],
  canvas2d: ["ok", "Canvas 2D"],
  sky: [
    "failed",
    "Failed: sky only, the Earth did not start in the deck window",
  ],
  pending: [
    "failed",
    "Failed: the Earth has not started yet; check again in a moment",
  ],
};

export function envRows(env: DeckEnv | null): ReadinessRow[] {
  if (!env) {
    const text =
      "Failed: no deck window answered; press T on the deck to open this view from it";
    return [
      row("renderer", "failed", text),
      row("motion", "failed", text),
      row("fullscreen", "failed", text),
    ];
  }
  const [status, text] = RENDERER_TEXT[env.renderer];
  return [
    row("renderer", status, text),
    row(
      "motion",
      "ok",
      env.reducedMotion
        ? "Reduced motion is on: flights and the shatter are cuts and fades"
        : "Reduced motion is off: flights and the shatter play",
    ),
    row(
      "fullscreen",
      "ok",
      env.fullscreen
        ? "The deck is fullscreen"
        : "The deck is not fullscreen; press F on the deck",
    ),
  ];
}

export async function modulesRow(
  modules: readonly ModuleLoader[],
): Promise<ReadinessRow> {
  const results = await Promise.all(
    modules.map(async (m) => {
      try {
        await m.load();
        return null;
      } catch {
        return m.name;
      }
    }),
  );
  const failed = results.filter((n): n is string => n !== null);
  if (failed.length === 0)
    return row("modules", "ok", `Loaded: ${modules.length} modules`);
  return row(
    "modules",
    "failed",
    `Failed: ${RETRY}. Not loaded: ${failed.join(", ")}`,
  );
}

export async function fontsRow(
  set: FontSet | null,
  fonts: readonly string[],
): Promise<ReadinessRow> {
  if (!set) return row("fonts", "ok", "Not checked: this browser cannot tell");
  const results = await Promise.all(
    fonts.map(async (font) => {
      try {
        await set.load?.(font);
        return set.check(font) ? null : font;
      } catch {
        return font;
      }
    }),
  );
  const missing = results.filter((font): font is string => font !== null);
  if (missing.length === 0) return row("fonts", "ok", "Loaded");
  return row(
    "fonts",
    "failed",
    `Failed: ${RETRY}. Not loaded: ${missing.join(", ")}`,
  );
}
