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
  drawer,
  field,
  findWidget,
  html,
  type SafeHtml,
  widget,
  wireDrawer,
} from "~/widgets/builders";
import { defineElements } from "~/widgets/define";
import {
  combobox,
  type GmtCombobox,
} from "~/widgets/primitives/combobox/combobox";
import { listbox, type GmtListbox } from "~/widgets/primitives/listbox/listbox";
import styles from "~/widgets/tools/globe.module.css";
import { registerEscLayer } from "./esc-layers";
import type { GlobeHost } from "./globe";
import { followGlobe, heroOf, offerGlobe, skyWithoutGlobe } from "./hero-space";
import {
  EARTH_IMAGERY,
  LICENCE_CREDIT,
  MILKY_WAY,
  NIGHT_SKY,
  TZ_BOUNDARIES,
  watchDataCredits,
} from "./data-credits";
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
  /** The landing hero's frameless layout: the Earth is drawn across the whole host behind its
   *  copy, the zone list is a drawer that comes in when the reader works the globe, and the
   *  heading and caption are dropped (the hero supplies its own). */
  space?: boolean;
}

const DEFAULT_HEADING = "Every zone, computed live by @northguild/gmt";
const DEFAULT_CAPTION =
  "No hardcoded offset tables. No Date object. Every local time, UTC offset, and DST flag on this globe is computed in your browser by GMT's Zoned functions, and recomputed every second. Drag to spin, scroll to zoom, or search a zone to watch it work.";

/** The widget's slug: the gates, `findWidget` and the chat registry read it. */
export const GLOBE_WIDGET_NAME = "globe";

/** The screens where the zone drawer is a slide-over beside the copy; elsewhere a bottom sheet. */
const SLIDE_OVER = "(width >= 64rem) and (orientation: landscape)";

/** The share of the stage's half-size the Earth fills at rest. */
const SPACE_FILL = 0.94;

/** The atmosphere's reach beyond the disc, as drawn by the renderers. */
const ATMOSPHERE = 1.06;

/** Pixels kept clear between the atmosphere and the stage's edge. */
const SPACE_CLEARANCE = 16;

/** Pixels kept clear between the Earth's disc and the zoom stack. */
const STACK_CLEARANCE = 8;

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
  space = false,
}: GlobeTemplateOptions = {}): SafeHtml {
  const id = (local: string) => `${idPrefix}-${local}`;

  const tooltip = html`<div class="${styles.tooltip}" id="${id("tooltip")}" data-gate="globe-tooltip" hidden></div>`;

  const side = html`<div class="${styles.side}">
    <div class="${styles.search}">
      ${field({
        id: id("zone-search"),
        label: "Find a zone",
        ...(space ? { labelHidden: true as const } : {}),
        control: ({ id: cid, describedBy }) =>
          combobox({
            id: cid,
            describedBy,
            label: "Find a zone",
            items: [],
            placeholder: space
              ? "Find zone, e.g. Asia/Tokyo"
              : "e.g. Asia/Tokyo",
            placement: "below",
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
  </div>`;

  const zoom = html`<div class="${styles.zoom}" id="${id("zoom")}" data-gate="globe-zoom" role="group" aria-label="Globe controls">
    <button type="button" data-globe-zoom="in" aria-label="Zoom in">+</button>
    <button type="button" data-globe-zoom="out" aria-label="Zoom out">−</button>
    <button type="button" data-globe-zoom="reset" aria-label="Reset zoom">⊙</button>
    ${
      space
        ? html`<button type="button" data-globe-search aria-label="Find a zone" aria-controls="${id("drawer")}" aria-expanded="false"
            ><svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false"
              ><circle cx="6.5" cy="6.5" r="4.5" fill="none" stroke="currentColor" stroke-width="1.5"
              /><path d="m10 10 4.5 4.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"
            /></svg
          ></button>`
        : ""
    }
    ${dataCredits({
      credits: space
        ? [TZ_BOUNDARIES, EARTH_IMAGERY, NIGHT_SKY, MILKY_WAY, LICENCE_CREDIT]
        : [TZ_BOUNDARIES, EARTH_IMAGERY],
      id: id("data-credits"),
      placement: "stack",
    })}
  </div>`;

  const inner = space
    ? html`<div class="${styles.root}" data-space>
        <div class="${styles.globeLayer}" id="${id("layer")}" data-gate="globe-layer">${tooltip}</div>
        <div class="${styles.hit}" id="${id("hit")}" data-gate="globe-hit"></div>
        <div class="${styles.layout}">
          <div class="${styles.frame}">
            <div class="${styles.stage}" id="${id("stage")}" data-gate="globe-stage">${zoom}</div>
          </div>
          ${drawer({
            id: id("drawer"),
            gate: "globe-drawer",
            label: "Zone finder",
            closeLabel: "Close zone list",
            className: styles.drawer,
            closeClassName: styles.drawerClose,
            children: side,
          })}
        </div>
      </div>`
    : html`<div class="${styles.root}">
        <h2 class="${styles.title}">${heading}</h2>
        <div class="${styles.layout}">
          <div class="${styles.frame}">
            <div class="${styles.stage}" id="${id("stage")}" data-gate="globe-stage">${zoom}${tooltip}</div>
          </div>
          ${side}
        </div>
        <p class="${styles.caption}">${caption}</p>
      </div>`;

  const region: SafeHtml = widget(
    {
      name: GLOBE_WIDGET_NAME,
      label: space ? "Zoned Earth overview" : "Zoned Earth",
      scope: idPrefix,
    },
    inner,
  );
  return html`<div class="${styles.shell}" ${space ? html`data-space` : html`data-tools-fullbleed`}>${region}</div>`;
}

export const mountGlobe: MountFn<GlobeArgs> = async (root, args, signal) => {
  try {
    return await mountGlobeInner(root, args, signal);
  } catch (error) {
    /* A hero whose globe failed still gets its night sky, drawn at the start rotation. */
    const hero = heroOf(root);
    if (hero) offerGlobe(hero, null);
    void skyWithoutGlobe(root);
    throw error;
  }
};

const mountGlobeInner: MountFn<GlobeArgs> = async (root, args, signal) => {
  watchDataCredits();
  defineElements();
  const globe = findWidget(root, GLOBE_WIDGET_NAME);
  const space = globe.el.querySelector("[data-space]") !== null;
  const stage = globe.part("stage");
  /* In space mode the engine draws into a layer behind the whole hero, not into the stage. */
  const surface = space ? globe.part("layer") : stage;
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

  const drawerEl = space
    ? globe.el.querySelector<HTMLElement>("[data-drawer]")
    : null;
  const closeButton = drawerEl?.querySelector<HTMLElement>("button") ?? null;
  const slideOver = globalThis.matchMedia?.(SLIDE_OVER);
  /* The hero's copy: on a wide screen the Earth keeps clear of wherever its words end. */
  const findCopy = (): HTMLElement | null =>
    surface
      .closest('[data-gate="hero-stage"]')
      ?.querySelector<HTMLElement>('[data-gate="hero-copy"]') ??
    root.querySelector<HTMLElement>('[data-gate="hero-copy"]');

  const host = await initGlobe(
    surface,
    clockPanel,
    globe.part<HTMLElement>("filters"),
    {
      tooltip,
      zoom,
      ...(space
        ? {
            /* The card keeps clear of the slide-over's close, which straddles its edge. */
            tooltipLimit: (): number | null => {
              if (
                !closeButton ||
                drawerEl?.dataset["open"] !== "true" ||
                slideOver?.matches !== true
              )
                return null;
              return (
                closeButton.getBoundingClientRect().left -
                surface.getBoundingClientRect().left -
                8
              );
            },
            engine: {
              framing: (width: number, height: number) =>
                frameSpace(
                  stage,
                  surface,
                  zoom,
                  findCopy(),
                  slideOver?.matches === true,
                  width,
                  height,
                ),
              framingWatch: [stage, zoom, surface, findCopy()].filter(
                (el): el is HTMLElement => el !== null,
              ),
              hitArea: globe.part<HTMLElement>("hit"),
              maxDpr: 1.5,
              pauseWhenHidden: stage,
              entrance: "dawn",
            },
          }
        : {}),
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
  }

  /* Without a zone drawer, the zone card is a layer once the reader has chosen a zone: Escape
     unpins it. The zone the globe starts on is shown, not opened by the reader, so Escape passes
     it by. With a drawer the card is the drawer's selection, not a layer of its own: Escape
     closes the settings panel, then the drawer, and the card stays. */
  let chosen = false;
  let seeding = false;
  const card = globe.el.querySelector("[data-drawer]")
    ? null
    : registerEscLayer(
        {
          el: tooltip,
          isOpen: () => chosen && !tooltip.hidden,
          close: () => host.selectZone(null),
        },
        wiring.signal,
        tooltip.ownerDocument,
      );
  host.onSelect((reading) => {
    if (search) search.value = reading?.id ?? "";
    chosen = !seeding && reading !== null;
    card?.changed();
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

  if (space) wireSpace(globe.el, host, surface, clockPanel, wiring.signal);
  /* The landing's night sky shows what is behind the Earth for the globe's camera (a hero without one is skipped). */
  const hero = space ? heroOf(globe.el) : null;
  if (hero) offerGlobe(hero, host);
  if (hero) void followGlobe(hero, host, stage, surface, wiring.signal);

  /* Seeded after wiring, so the selection lands on a live globe and the clock
     panel and search box follow it. `focusZone` selects as well as rotates, so
     calling `selectZone` first only did the same work twice, and fired the
     selection callback twice with it. It returns early for a zone with no
     coordinate, so an invented zone degrades to "the globe stays where it was"
     rather than throwing; the registry rejects those first (see
     `widget-registry.ts`). */
  seeding = true;
  if (args.zone) host.focusZone(args.zone);
  seeding = false;

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

/**
 * The right edge of the copy's words and buttons: the union of its descendants' boxes. In carousel
 * mode the column holds pages of different widths and only one shows, so the edge is the
 * column's own content box, and the Earth stays where it is as the pages change.
 */
function copyEnd(copy: HTMLElement): number {
  if (document.documentElement.dataset["homeCarousel"] !== undefined) {
    const box = copy.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) return -Infinity;
    return (
      box.right - (parseFloat(getComputedStyle(copy).paddingInlineEnd) || 0)
    );
  }
  let end = -Infinity;
  for (const el of copy.querySelectorAll("*")) {
    const r = el.getBoundingClientRect();
    if (r.width !== 0 && r.height !== 0) end = Math.max(end, r.right);
  }
  return end;
}

/**
 * Where the Earth sits in the hero, in the surface's pixels. Its centre-y is the globe area's
 * middle and its radius fills most of the area's shorter side, leaving the atmosphere clear of
 * the area's edge. The disc shrinks only as far as it must to keep the zoom stack off it, so a
 * narrow hero, where the stack sits against the square's corner, never has the Earth under
 * the buttons. When the hero stacks (narrower than 64rem, or portrait) its centre-x is the area's.
 * Side by side it is the page's centre,
 * or, where the copy reaches too far for that, the nearest x that keeps the atmosphere 16 px
 * clear of the copy's end (never left of the page's centre).
 */
function frameSpace(
  stage: HTMLElement,
  surface: HTMLElement,
  stack: HTMLElement,
  copy: HTMLElement | null,
  wide: boolean,
  width: number,
  height: number,
): { cx: number; cy: number; radius: number } {
  const box = stage.getBoundingClientRect();
  const origin = surface.getBoundingClientRect();
  if (box.width === 0 || box.height === 0)
    return {
      cx: width / 2,
      cy: height / 2,
      radius: Math.min(width, height) / 2,
    };
  const half = Math.min(box.width, box.height) / 2;
  const cy = box.top - origin.top + box.height / 2;
  const fit = Math.min(
    half * SPACE_FILL,
    (half - SPACE_CLEARANCE) / ATMOSPHERE,
  );
  /* The stack's laid-out box in the stage, not where its entrance transform has it now. */
  const left = box.left - origin.left + stack.offsetLeft;
  const top = box.top - origin.top + stack.offsetTop;
  const radiusAt = (cx: number): number => {
    if (stack.offsetWidth === 0 || stack.offsetHeight === 0) return fit;
    const nearX = Math.max(left, Math.min(cx, left + stack.offsetWidth));
    const nearY = Math.max(top, Math.min(cy, top + stack.offsetHeight));
    const reach = Math.hypot(nearX - cx, nearY - cy) - STACK_CLEARANCE;
    return Math.max(0, Math.min(fit, reach));
  };
  let cx = box.left - origin.left + box.width / 2;
  if (wide) {
    const page = document.documentElement.clientWidth / 2 - origin.left;
    cx = page;
    if (copy) {
      const end = copyEnd(copy) - origin.left;
      if (Number.isFinite(end)) {
        /* The radius depends on where the centre is (the zoom stack), and the centre on the
           radius: a few passes settle it, and the last one fixes the centre to the final radius. */
        let radius = radiusAt(page);
        for (let pass = 0; pass < 4; pass++) {
          cx = Math.max(page, end + SPACE_CLEARANCE + ATMOSPHERE * radius);
          radius = radiusAt(cx);
        }
        cx = Math.max(page, end + SPACE_CLEARANCE + ATMOSPHERE * radius);
      }
    }
  }
  return { cx, cy, radius: radiusAt(cx) };
}

/**
 * The zone drawer's behaviour. It opens, without moving focus, on the reader's first work on
 * the globe; the magnifier opens it with focus on the search box and closes it again. Once the
 * reader has closed it, a drag or a zoom leaves it shut. A tap that picks a place always opens
 * it, with focus on that zone's row in the list, so the reader can go on with the arrow keys.
 * A press anywhere outside the Earth closes it, without moving focus: the sky, the hero copy,
 * the header and the rest of the page.
 * The drawer, the globe's own controls and any layer drawn over them (a popover, a list, a
 * dialog) are not outside, and neither is the Earth itself, judged by its disc and not by the
 * canvas box. Escape closes it too, after the settings panel inside it (see `registerEscLayer`).
 */
function wireSpace(
  root: HTMLElement,
  host: GlobeHost,
  /** The element the host's pixel positions are measured in. */
  surface: HTMLElement,
  /** The zone list in the drawer. */
  clocks: HTMLElement | null,
  signal: AbortSignal,
): void {
  const panel = root.querySelector<HTMLElement>("[data-drawer]");
  const magnifier = root.querySelector<HTMLButtonElement>(
    "[data-globe-search]",
  );
  if (!panel || !magnifier) return;
  let closedByReader = false;
  const drawerHandle = wireDrawer(panel, {
    signal,
    toggle: magnifier,
    /* The zoom stack, magnifier included, is hidden while the list is open. */
    inertWhenOpen:
      magnifier.closest<HTMLElement>('[data-gate="globe-zoom"]') ?? undefined,
    onToggle: (open) => {
      if (!open) closedByReader = true;
      /* The card clears the drawer's edge, so it is placed again for the new state. */
      host.requestRender();
    },
  });
  magnifier.addEventListener(
    "click",
    () => {
      if (drawerHandle.expanded) drawerHandle.close();
      else {
        drawerHandle.open();
        /* The search takes focus with its list shut: an open list would cover the zones the
           reader came to see, and one Escape then closes the drawer. */
        panel.querySelector<GmtCombobox>("gmt-combobox")?.focusInput();
      }
    },
    { signal },
  );
  host.onInteract((kind) => {
    /* The tap has already picked its zone, or cleared the choice, by the time this runs. */
    if (kind === "tap" && host.getSelected() !== null) {
      drawerHandle.open();
      clocks?.focus({ preventScroll: true });
    } else if (!closedByReader) drawerHandle.open();
  });
  const doc = root.ownerDocument;
  const hitArea = root.querySelector<HTMLElement>('[data-gate="globe-hit"]');
  doc.addEventListener(
    "pointerdown",
    (event) => {
      if (!drawerHandle.expanded || !(event.target instanceof Element)) return;
      const target = event.target;
      if (
        panel.closest("[data-drawer]")?.contains(target) ||
        target.closest(
          '[data-gate="globe-zoom"], [data-gate="globe-tooltip"], [popover], dialog, [role="listbox"], [role="dialog"], [role="menu"]',
        )
      )
        return;
      if (hitArea?.contains(target)) {
        const rect = surface.getBoundingClientRect();
        const centre = host.getCentre();
        if (
          Math.hypot(
            event.clientX - rect.left - centre.x,
            event.clientY - rect.top - centre.y,
          ) <= centre.radius
        )
          return;
      }
      drawerHandle.close(false);
    },
    { capture: true, signal },
  );
}
