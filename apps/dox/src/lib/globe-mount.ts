/**
 * DOX-C3b (#139) — the globe, mountable into the chat rail.
 *
 * `initGlobe` itself needed no refactor: `globe.ts` already takes a host element
 * and returns a `GlobeHost` with a thorough `destroy()`. But the *glue* around it
 * — the zone search combobox, the zoom buttons, keeping the search box in sync
 * with selection — lives in `Globe.astro`'s inline script and bootstraps off
 * `document.getElementById("globe-stage")`. That is document-scoped and
 * id-based, so it is not multi-instance-safe and cannot be reached from React.
 *
 * This module is that glue, container-scoped. `Globe.astro` is deliberately left
 * alone for now (step 5 consolidates it) — its conditional attribute emission
 * (`class:list`, `data-tools-fullbleed`) is fiddly to reproduce as a string, and
 * it sits on the two pages the visual gate cares most about.
 */
import {
  onceDestroy,
  type MountFn,
  type WidgetHandle,
} from "./widget-mount";

export interface GlobeArgs {
  /** The zone to select and centre on. The clock panel beside the globe lists
   *  every plottable zone regardless — see `zone-clock-list.ts`. */
  zone?: string;
}

/**
 * The globe's chrome, as a string.
 *
 * `idPrefix` exists because two ids here are load-bearing for accessibility —
 * the search `<label for>` and the clock panel's `aria-label`led listbox — and
 * an id must be unique in a document. The rail passes its own prefix so a globe
 * in the panel cannot collide with one on the page behind it.
 */
export function renderGlobeTemplate({
  idPrefix = "globe",
}: { idPrefix?: string } = {}): string {
  const stageId = `${idPrefix}-stage`;
  const searchId = `${idPrefix}-zone-search`;
  const clocksId = `${idPrefix}-clock-panel`;

  return `<div class="gmt-globe gmt-globe-embedded">
  <div class="gmt-globe-layout">
    <div class="gmt-globe-frame">
      <div class="gmt-globe-stage gmt-glass" id="${stageId}" data-role="stage">
        <div class="gmt-globe-zoom" role="group" aria-label="Zoom the globe">
          <button type="button" data-globe-zoom="in" aria-label="Zoom in">+</button>
          <button type="button" data-globe-zoom="out" aria-label="Zoom out">−</button>
          <button type="button" data-globe-zoom="reset" aria-label="Reset zoom">⊙</button>
        </div>
      </div>
    </div>
    <div class="gmt-globe-side">
      <div class="gmt-globe-search gmt-combobox">
        <label for="${searchId}">Find a zone</label>
        <input
          type="search"
          id="${searchId}"
          class="gmt-field"
          placeholder="e.g. Asia/Tokyo"
          autocomplete="off"
          data-globe-search
        />
      </div>
      <div
        class="gmt-globe-clocks"
        id="${clocksId}"
        data-role="clocks"
        role="listbox"
        aria-label="Pinned zones — select one to focus the globe"
        tabindex="0"
      ></div>
    </div>
  </div>
</div>`;
}

export const mountGlobe: MountFn<GlobeArgs> = async (root, args, signal) => {
  const stage = root.querySelector<HTMLElement>('[data-role="stage"]');
  const clockPanel = root.querySelector<HTMLElement>('[data-role="clocks"]');
  if (!stage || !clockPanel) return onceDestroy(() => {});

  const { initGlobe } = await import("./globe");
  if (signal.aborted) return onceDestroy(() => {});

  const host = await initGlobe(stage, clockPanel);
  // The import and the init are both awaited above; StrictMode's second pass
  // can have aborted in between, and the handle we just built is the one thing
  // that would leak (an rAF loop and a 1s clock interval) if we returned it.
  if (signal.aborted) {
    host.destroy();
    return onceDestroy(() => {});
  }

  const search = root.querySelector<HTMLInputElement>("[data-globe-search]");
  let combobox: { destroy(): void } | undefined;

  if (search) {
    const { createZoneCombobox } = await import("./zone-combobox");
    if (signal.aborted) {
      host.destroy();
      return onceDestroy(() => {});
    }
    combobox = createZoneCombobox(
      search,
      host.getZones().map((zone) => zone.id),
      (id) => host.focusZone(id),
    );
    search.value = host.getSelected() ?? "";
  }

  host.onSelect((reading) => {
    if (search) search.value = reading?.id ?? "";
  });

  for (const button of root.querySelectorAll<HTMLButtonElement>(
    "[data-globe-zoom]",
  )) {
    button.addEventListener("click", () => {
      const kind = button.dataset.globeZoom;
      if (kind === "in") host.zoomBy(1.4);
      else if (kind === "out") host.zoomBy(1 / 1.4);
      else host.setZoom(1);
    });
  }

  /* Seeded after wiring, so the selection lands on a live globe and the clock
     panel and search box follow it. `focusZone` already returns early for a zone
     with no coordinate (`globe.ts`'s `focusZoneImpl`), so an invented zone that
     somehow reached here degrades to "globe stays where it was" rather than
     throwing — the registry rejects those first (see `widget-registry.ts`). */
  if (args.zone) {
    host.selectZone(args.zone);
    host.focusZone(args.zone);
  }

  return onceDestroy(
    () => {
      combobox?.destroy();
      host.destroy();
    },
    // The *live* selection, not the seeded one — the reader may have spun the
    // globe somewhere else, and that is the view worth linking to.
    () => ({ zone: host.getSelected() ?? args.zone }),
  ) satisfies WidgetHandle;
};
