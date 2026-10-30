/**
 * The globe's markup and wiring, for every surface that hosts it.
 *
 * One template and one mount serve all three: the landing hero, `/tools/zoned-earth/`
 * and the `/dox` chat rail. A rail cannot instantiate an Astro component, which is
 * why the markup is a string here rather than in `Globe.astro`.
 *
 * Everything is container-scoped, never `document`-scoped, so two globes can live
 * in one document: one on the page and one in the rail.
 */
import {
  dataCredits,
  field,
  findWidget,
  html,
  type SafeHtml,
  widget,
} from "~/widgets/builders";
import { defineElements } from "~/widgets/define";
import {
  combobox,
  type GmtCombobox,
} from "~/widgets/primitives/combobox/combobox";
import { listbox, type GmtListbox } from "~/widgets/primitives/listbox/listbox";
import styles from "~/widgets/tools/globe.module.css";
import { EARTH_IMAGERY, TZ_BOUNDARIES, watchDataCredits } from "./data-credits";
import {
  onceDestroy,
  WidgetLoadError,
  type MountFn,
  type WidgetHandle,
} from "./widget-mount";

export interface GlobeArgs {
  /** The zone to select and centre on. The clock panel beside the globe lists
   *  every plottable zone regardless; see `zone-clock-list.ts`. */
  zone?: string;
}

interface GlobeTemplateOptions {
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

/** The widget's slug: the gates, `findWidget` and the chat registry read it. */
export const GLOBE_WIDGET_NAME = "globe";

/** The viewport width at and below which the hero stacks the globe above its zone list. */
const EMBEDDED_STACKED = "(width <= 99.9375rem)";

/**
 * The globe's chrome, for both surfaces.
 *
 * A shell holds the region: the shell takes the page margin (or, embedded, fills the hero's
 * column) and carries `data-tools-fullbleed` on the page so the content column widens. The
 * region is the kit `widget()`, and the parts the mount needs are found with `findWidget`.
 */
export function renderGlobeTemplate({
  idPrefix = "globe",
  heading = DEFAULT_HEADING,
  caption = DEFAULT_CAPTION,
  embedded = false,
}: GlobeTemplateOptions = {}): SafeHtml {
  const id = (local: string) => `${idPrefix}-${local}`;

  const inner = html`<div class="${styles.root}" ${embedded ? html`data-embedded` : ""}>
    ${embedded ? "" : html`<h2 class="${styles.title}">${heading}</h2>`}
    <div class="${styles.layout}">
      <div class="${styles.frame}">
        <div class="${styles.stage}" id="${id("stage")}" data-gate="globe-stage">
          <div class="${styles.zoom}" id="${id("zoom")}" data-gate="globe-zoom" role="group" aria-label="Globe controls">
            <button type="button" data-globe-zoom="in" aria-label="Zoom in">+</button>
            <button type="button" data-globe-zoom="out" aria-label="Zoom out">−</button>
            <button type="button" data-globe-zoom="reset" aria-label="Reset zoom">⊙</button>
            ${dataCredits({
              credits: [TZ_BOUNDARIES, EARTH_IMAGERY],
              id: id("data-credits"),
              placement: "stack",
            })}
          </div>
          <div class="${styles.tooltip}" id="${id("tooltip")}" data-gate="globe-tooltip" hidden></div>
        </div>
      </div>
      <div class="${styles.side}">
        <div class="${styles.search}">
          ${field({
            id: id("zone-search"),
            label: "Find a zone",
            control: ({ id: cid, describedBy }) =>
              combobox({
                id: cid,
                describedBy,
                label: "Find a zone",
                items: [],
                placeholder: "e.g. Asia/Tokyo",
                placement: embedded ? "above" : "below",
              }),
          })}
          <div class="${styles.filters}" id="${id("filters")}"></div>
        </div>
        ${listbox({
          id: id("clocks"),
          label: "Pinned zones — select one to focus the globe",
          items: [],
          className: styles.clocks,
        })}
      </div>
    </div>
    ${embedded ? "" : html`<p class="${styles.caption}">${caption}</p>`}
  </div>`;

  const region: SafeHtml = widget(
    {
      name: GLOBE_WIDGET_NAME,
      label: embedded ? "Zoned Earth overview" : "Zoned Earth",
      scope: idPrefix,
    },
    inner,
  );
  return html`<div class="${styles.shell}" ${embedded ? html`data-embedded` : html`data-tools-fullbleed`}>${region}</div>`;
}

export const mountGlobe: MountFn<GlobeArgs> = async (root, args, signal) => {
  watchDataCredits();
  defineElements();
  const globe = findWidget(root, GLOBE_WIDGET_NAME);
  const stage = globe.part("stage");
  const clockPanel = globe.part<GmtListbox>("clocks");
  const tooltip = globe.part("tooltip");
  const zoom = globe.part("zoom");
  const search = globe.el.querySelector<GmtCombobox>("gmt-combobox");

  let initGlobe: typeof import("./globe").initGlobe;
  try {
    ({ initGlobe } = await import("./globe"));
  } catch (error) {
    /* The chunk carries `@northguild/gmt`, so a failed import is the library
       failing to load: the case `WidgetLoadError` exists to distinguish, and
       the one a reload can fix. */
    throw new WidgetLoadError(error);
  }
  if (signal.aborted) return onceDestroy(() => {});

  const host = await initGlobe(
    stage,
    clockPanel,
    globe.part<HTMLElement>("filters"),
    {
      tooltip,
      zoom,
    },
  );
  // The import and the init are both awaited above; StrictMode's second pass
  // can have aborted in between, and the handle we just built is the one thing
  // that would leak (an rAF loop and a 1s clock interval) if we returned it.
  if (signal.aborted) {
    host.destroy();
    return onceDestroy(() => {});
  }

  const wiring = new AbortController();
  if (search) {
    search.items = host.getZones().map((zone) => zone.id);
    search.value = host.getSelected() ?? "";
    search.addEventListener(
      "change",
      (event) => {
        const zone = (event as CustomEvent<{ value: string }>).detail.value;
        if (zone) host.focusZone(zone);
      },
      { signal: wiring.signal },
    );
    /* In the hero the search box sits in the bottom half of a fixed-height column when the
       globe is stacked over its list, so its list opens upward there and downward beside it. */
    if (globe.el.querySelector("[data-embedded]")) {
      const stacked = globalThis.matchMedia?.(EMBEDDED_STACKED);
      const place = () =>
        search.setAttribute(
          "data-placement",
          stacked?.matches === false ? "below" : "above",
        );
      place();
      stacked?.addEventListener("change", place, { signal: wiring.signal });
    }
  }

  host.onSelect((reading) => {
    if (search) search.value = reading?.id ?? "";
  });

  for (const button of zoom.querySelectorAll<HTMLButtonElement>(
    "[data-globe-zoom]",
  )) {
    button.addEventListener(
      "click",
      () => {
        const kind = button.dataset.globeZoom;
        if (kind === "in") host.zoomBy(1.4);
        else if (kind === "out") host.zoomBy(1 / 1.4);
        else host.setZoom(1);
      },
      { signal: wiring.signal },
    );
  }

  /* Seeded after wiring, so the selection lands on a live globe and the clock
     panel and search box follow it. `focusZone` selects as well as rotates, so
     calling `selectZone` first only did the same work twice, and fired the
     selection callback twice with it. It returns early for a zone with no
     coordinate, so an invented zone degrades to "the globe stays where it was"
     rather than throwing; the registry rejects those first (see
     `widget-registry.ts`). */
  if (args.zone) host.focusZone(args.zone);

  return onceDestroy(
    () => {
      wiring.abort();
      host.destroy();
    },
    // The *live* selection, not the seeded one: the reader may have spun the
    // globe somewhere else, and that is the view worth linking to.
    () => ({ zone: host.getSelected() ?? args.zone }),
  ) satisfies WidgetHandle;
};
