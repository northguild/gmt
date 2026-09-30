/**
 * DOX-C3b (#139) — the globe's markup and wiring, for every surface that hosts it.
 *
 * One template and one mount serve all three: the landing hero, `/tools/zoned-earth/`
 * and the `/dox` chat rail. A rail cannot instantiate an Astro component, which is
 * why the markup is a string here rather than in `Globe.astro`.
 *
 * Everything is container-scoped, never `document`-scoped, so two globes can live
 * in one document — one on the page and one in the rail.
 */
import { escapeHtml } from "./widget-ui";
import {
  onceDestroy,
  WidgetLoadError,
  type MountFn,
  type WidgetHandle,
} from "./widget-mount";

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
    /* Input and filter gear share one row so the gear is an addon on the
       field, not a control floating beside it: `align-items: stretch` makes it
       exactly the input's height without anyone hardcoding what that is.
       `.gmt-combobox` above stays the positioning context for both the
       typeahead list and the filter popup. */
    `<div class="gmt-globe-field-row">` +
    `<input type="search" id="${searchId}" class="gmt-field" placeholder="e.g. Asia/Tokyo" autocomplete="off" data-globe-search>` +
    /* Empty, and filled by `zone-filter-ui.ts` once the globe has mounted:
       which toggles are worth showing depends on live readings, and none of
       them mean anything before there is a clock list to narrow.
       A plain <div> with a button disclosure inside, not <details>: a <details>
       in this row brought its own layout with it — a marker box that ate the
       button's width, and a `::details-content` box that changed the row's
       height when it opened. The dismissal behaviour a popup needs is
       hand-written either way. */
    `<div class="gmt-globe-filters" id="${idPrefix}-filters" data-role="filters"></div>` +
    `</div>` +
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

  let initGlobe: typeof import("./globe").initGlobe;
  try {
    ({ initGlobe } = await import("./globe"));
  } catch (error) {
    /* The chunk carries `@northguild/gmt`, so a failed import is the library
       failing to load — the case `WidgetLoadError` exists to distinguish, and
       the one a reload can fix. */
    throw new WidgetLoadError(error);
  }
  if (signal.aborted) return onceDestroy(() => {});

  const filterPanel = root.querySelector<HTMLElement>('[data-role="filters"]');
  const host = await initGlobe(stage, clockPanel, filterPanel);
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
     panel and search box follow it. `focusZone` selects as well as rotates, so
     calling `selectZone` first only did the same work twice — and fired the
     selection callback twice with it. It returns early for a zone with no
     coordinate, so an invented zone degrades to "the globe stays where it was"
     rather than throwing; the registry rejects those first (see
     `widget-registry.ts`). */
  if (args.zone) host.focusZone(args.zone);

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
