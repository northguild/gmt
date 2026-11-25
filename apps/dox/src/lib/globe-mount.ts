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
import phone from "~/widgets/tools/globe-phone.module.css";
import { registerEscLayer } from "./esc-layers";
import { cueOnAppear } from "./sound/appear";
import { cue } from "./sound/cue";
import { HOME_LOCKED_QUERY } from "./home-carousel";
import { watchCover } from "./globe-cover";
import { frameSpace } from "./hero-frame";
import { cardBand, followViewport } from "./globe-sheet";
import type { GlobeHost } from "./globe";
import {
  followGlobe,
  heroAimFrame,
  heroOf,
  offerGlobe,
  skyWithoutGlobe,
} from "./hero-space";
import { loadClock } from "./space-sky";
import { mountSkyView, renderSkyView, type SkyView } from "./sky-view";
import {
  EARTH_IMAGERY,
  LICENCE_CREDIT,
  SKY_CREDITS,
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
  /* The rings a chosen pin ripples (globe-lock.ts), under the card. */
  const lock = html`<div class="${styles.lock}" id="${id("lock")}" aria-hidden="true" hidden></div>`;

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
    ${space ? renderSkyView(id("sky-view")) : ""}
    ${listbox({
      id: id("clocks"),
      label: "Pinned zones — select one to focus the globe",
      items: [],
      className: styles.clocks,
    })}
  </div>`;

  const zoom = html`<div class="${styles.zoom} ${phone.stack}" id="${id("zoom")}" data-gate="globe-zoom" role="group" aria-label="Globe controls">
    <button type="button" data-globe-zoom="in" data-cue aria-label="Zoom in">+</button>
    <button type="button" data-globe-zoom="out" data-cue aria-label="Zoom out">−</button>
    <button type="button" data-globe-zoom="reset" data-cue aria-label="Reset zoom">⊙</button>
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
        ? [TZ_BOUNDARIES, EARTH_IMAGERY, ...SKY_CREDITS, LICENCE_CREDIT]
        : [TZ_BOUNDARIES, EARTH_IMAGERY],
      id: id("data-credits"),
      placement: "stack",
    })}
  </div>`;

  const inner = space
    ? html`<div class="${styles.root}" data-space>
        <div class="${styles.globeLayer}" id="${id("layer")}" data-gate="globe-layer">${lock}${tooltip}</div>
        <div class="${styles.hit}" id="${id("hit")}" data-gate="globe-hit"></div>
        <div class="${styles.layout}">
          <div class="${styles.frame}">
            <div class="${styles.stage} ${phone.stage}" id="${id("stage")}" data-gate="globe-stage">${zoom}</div>
          </div>
          ${drawer({
            id: id("drawer"),
            gate: "globe-drawer",
            label: "Zone finder",
            closeLabel: "Close zone list",
            className: `${styles.drawer} ${phone.sheet}`,
            closeClassName: `${styles.drawerClose} ${phone.sheetClose}`,
            children: side,
          })}
        </div>
      </div>`
    : html`<div class="${styles.root}">
        <h2 class="${styles.title}">${heading}</h2>
        <div class="${styles.layout}">
          <div class="${styles.frame}">
            <div class="${styles.stage}" id="${id("stage")}" data-gate="globe-stage">${lock}${zoom}${tooltip}</div>
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
  const lock = globe.part("lock");
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
  const slideOver = globalThis.matchMedia?.(HOME_LOCKED_QUERY);
  /* The hero's copy: on a wide screen the Earth keeps clear of wherever its words end. */
  const findCopy = (): HTMLElement | null =>
    surface
      .closest('[data-gate="hero-stage"]')
      ?.querySelector<HTMLElement>('[data-gate="hero-copy"]') ??
    root.querySelector<HTMLElement>('[data-gate="hero-copy"]');

  /* Every globe stops drawing while it is off screen, the tab is hidden, or the search dialog or
     the mobile menu covers it; the hero watches its whole stage, a framed globe its own. */
  const pause = {
    pauseWhenHidden: space ? stage : surface,
    pauseWhile: (hold: (held: boolean) => void) => watchCover(document, hold),
  };

  const host = await initGlobe(
    surface,
    clockPanel,
    globe.part<HTMLElement>("filters"),
    {
      tooltip,
      lock,
      zoom,
      engine: pause,
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
            /* Stacked, the card keeps between the intro above and the open sheet. */
            tooltipBand: () =>
              slideOver?.matches === true
                ? null
                : cardBand(stage, drawerEl, surface),
            engine: {
              ...pause,
              framing: (width: number, height: number) => {
                return frameSpace(
                  stage,
                  surface,
                  zoom,
                  findCopy(),
                  slideOver?.matches === true,
                  width,
                  height,
                );
              },
              framingWatch: [stage, zoom, surface, findCopy()].filter(
                (el): el is HTMLElement => el !== null,
              ),
              hitArea: globe.part<HTMLElement>("hit"),
              maxDpr: 1.5,
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
  /* The sky view (landing only) is off whenever the reader works on the globe; `wireSpace` fills this in. */
  let releaseView = (): void => {};
  host.onSelect((reading) => {
    if (search) search.value = reading?.id ?? "";
    chosen = !seeding && reading !== null;
    if (chosen) releaseView();
    /* A place the reader chose: a tap on the Earth, a pinned clock, a zone from the search. Its
       Sonar lock sounds as the rings ripple from its pin. */
    if (chosen) host.lockOn(() => cue("locate"));
    card?.changed();
  });
  /* Every zoom step the reader takes, by wheel, pinch, key or the buttons below, plays the Lens
     servo, rising going in and falling coming out, pitched by how close the camera is. The
     engine keeps steps 60 ms apart, so a trackpad's stream of wheel events is a run of whirrs, not
     a buzz. The buttons are `data-cue`, so their press plays the servo and not the press ping; a
     step at a limit changes nothing and plays nothing. */
  host.onZoom((dir, closeness) =>
    cue(dir > 0 ? "zoomIn" : "zoomOut", closeness),
  );
  /* A page globe coming into view plays the Steel horizon (`sound/appear.ts`). The landing's globe
     does not: its dawn has the entrance's own paint and glint sounds, and a swell under them would
     muddy both. */
  if (!space) cueOnAppear(stage, "appearGlobe", wiring.signal);

  for (const button of zoom.querySelectorAll<HTMLButtonElement>(
    "[data-globe-zoom]",
  )) {
    button.addEventListener(
      "click",
      () => {
        releaseView();
        const kind = button.dataset.globeZoom;
        if (kind === "in") host.zoomBy(1.4);
        else if (kind === "out") host.zoomBy(1 / 1.4);
        else host.setZoom(1);
      },
      { signal: wiring.signal },
    );
  }

  if (space)
    releaseView = wireSpace(globe.el, host, surface, clockPanel, wiring.signal);
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
): () => void {
  const panel = root.querySelector<HTMLElement>("[data-drawer]");
  const magnifier = root.querySelector<HTMLButtonElement>(
    "[data-globe-search]",
  );
  if (!panel || !magnifier) return () => {};
  followViewport(panel, signal);
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
        /* The search takes focus with its list shut (an open one would cover the zones), so one Escape closes the drawer. */
        panel.querySelector<GmtCombobox>("gmt-combobox")?.focusInput();
      }
    },
    { signal },
  );
  /* The Sky view row: a stacked phone closes its sheet first, so the body shows in the sky bay. */
  const hero = heroOf(root);
  let view: SkyView | undefined;
  if (hero)
    void loadClock().then(({ getUnixNow }) => {
      if (signal.aborted) return;
      view = mountSkyView({
        engine: host,
        host: hero,
        avoid: () =>
          heroAimFrame(
            hero,
            surface,
            magnifier.closest('[data-gate="globe-zoom"]'),
          ),
        now: getUnixNow,
        reducedMotion: () =>
          globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ??
          false,
        onPress: () => {
          if (globalThis.matchMedia?.(HOME_LOCKED_QUERY).matches === false)
            drawerHandle.close();
        },
        signal,
      });
    });
  host.onInteract((kind) => {
    view?.release();
    /* Stacked, only the magnifier opens the sheet; a tap still picks its zone and shows the card. */
    if (globalThis.matchMedia?.(HOME_LOCKED_QUERY).matches === false) return;
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
  return () => view?.release();
}
