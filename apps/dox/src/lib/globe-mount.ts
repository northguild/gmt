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
import { escapeHtml } from "./widget-ui";
import { onceDestroy, type MountFn, type WidgetHandle } from "./widget-mount";

export interface GlobeArgs {
  /** The zone to select and centre on. The clock panel beside the globe lists
   *  every plottable zone regardless — see `zone-clock-list.ts`. */
  zone?: string;
}

export interface GlobeTemplateOptions {
  /** Namespaces the ids below. Two globes in one document — one on the page and
   *  one in the chat rail — would otherwise collide on `globe-stage`. */
  idPrefix?: string;
  heading?: string;
  caption?: string;
  /** Drops the heading and caption for a host that supplies its own (HeroGlobe
   *  on the landing page), and switches the layout class. */
  embedded?: boolean;
}

const DEFAULT_HEADING = "Every zone, computed live by @northguild/gmt";
const DEFAULT_CAPTION =
  "No hardcoded offset tables. No Date object. Every local time, UTC offset, and DST flag on this globe is computed in your browser by GMT's Zoned functions, and recomputed every second. Drag to spin, scroll to zoom, or search a zone to watch it work.";

/**
 * The globe's chrome, for both surfaces.
 *
 * This used to render only the rail's copy while `Globe.astro` kept its own
 * template, and **the two had already drifted**: `mountGlobe` looks up
 * `[data-role="stage"]`, which the `.astro` markup never had, so mounting the
 * globe against a page's own markup would have silently produced an inert
 * widget. Both ids and data-roles are emitted now, and there is one template.
 *
 * The conditional attributes are the fiddly part and the reason this
 * consolidation was left until last: Astro renders `class:list` and an
 * `undefined` attribute value by omitting them entirely, and this markup sits
 * on the two pages the visual gate cares most about.
 */
export function renderGlobeTemplate({
  idPrefix = "globe",
  heading = DEFAULT_HEADING,
  caption = DEFAULT_CAPTION,
  embedded = false,
}: GlobeTemplateOptions = {}): string {
  const stageId = `${idPrefix}-stage`;
  const searchId = `${idPrefix}-zone-search`;
  const clocksId = `${idPrefix}-clock-panel`;

  /* Astro emits `class:list={{ x: cond }}` as a space-joined class list and
     omits `data-tools-fullbleed={undefined}` altogether. Reproduced literally
     so the built pages stay byte-identical. */
  const rootClass = embedded ? "gmt-globe gmt-globe-embedded" : "gmt-globe";
  const fullbleed = embedded ? "" : " data-tools-fullbleed";

  return (
    `<div class="${rootClass}"${fullbleed}>` +
    (embedded
      ? ""
      : `<h2 class="gmt-chart-title">${escapeHtml(heading)}</h2>`) +
    `<div class="gmt-globe-layout">` +
    `<div class="gmt-globe-frame">` +
    /* `not-content` is Starlight's opt-out from its markdown typography
       (every rule in its style/markdown.css carries
       `:not(:where(.not-content *))`). Without it the canvas — a sibling of
       the zoom cluster inside `.sl-markdown-content` — picked up
       `margin-top: var(--sl-content-gap-y)` (1rem) plus `max-width: 100%`,
       which pushed the square canvas 16px down inside the square
       `overflow: hidden` stage and squashed its width. That clipped the
       bottom of the globe on every viewport whose stage was under ~600px.
       Scoped to the stage, not `.gmt-globe`: the root's own `<h2>` heading
       and `<p>` caption *should* keep Starlight's content styling. */
    `<div class="gmt-globe-stage gmt-glass not-content" id="${stageId}" data-role="stage">` +
    `<div class="gmt-globe-zoom" role="group" aria-label="Zoom the globe">` +
    `<button type="button" data-globe-zoom="in" aria-label="Zoom in">+</button>` +
    `<button type="button" data-globe-zoom="out" aria-label="Zoom out">−</button>` +
    `<button type="button" data-globe-zoom="reset" aria-label="Reset zoom">⊙</button>` +
    `</div>` +
    `</div>` +
    `</div>` +
    `<div class="gmt-globe-side">` +
    `<div class="gmt-globe-search gmt-combobox">` +
    `<label for="${searchId}">Find a zone</label>` +
    `<input type="search" id="${searchId}" class="gmt-field" placeholder="e.g. Asia/Tokyo" autocomplete="off" data-globe-search>` +
    `</div>` +
    `<div class="gmt-globe-clocks" id="${clocksId}" data-role="clocks" role="listbox" aria-label="Pinned zones — select one to focus the globe" tabindex="0"></div>` +
    `</div>` +
    `</div>` +
    (embedded
      ? ""
      : `<p class="gmt-globe-caption">${escapeHtml(caption)}</p>`) +
    `</div>`
  );
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
