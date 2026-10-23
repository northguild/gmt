/**
 * The zone map of a dated tz-change checker (CORE-88): one shape per IANA zone in one of three
 * classes, a zone list that pins the same zone by keyboard, and the pin panel.
 *
 * Plain DOM, no React. The server renders the list and the panel (the checker's mount module), so
 * both exist before this script runs; this module fills them from the Worker's `zones`, draws the
 * shapes when the section is wide enough, and wires the pin. Everything that belongs to one
 * checker (its ids, the boundary file, the projection, the stated classes) comes in as a
 * `ZoneMapConfig`.
 *
 * **The list is the keyboard path.** One `<button>` per zone, a roving tab stop, arrow keys,
 * Home and End to move; Enter or Space pins. The shapes are `role="button"` with `tabindex="-1"`,
 * so a pointer reaches them and the Tab key does not walk 23 of them.
 *
 * **Below 520 px of section width the map is not drawn and its file is not fetched.** The list
 * stays, and the pin panel opens below it, scrolled into view when a reader pins. The data-credits button belongs to the
 * drawing, so it is added when the map is drawn and a narrow section has none.
 */
import { geoPath } from "d3-geo";
import type { GeoPath, GeoProjection } from "d3-geo";
import { NO_SIGNAL, changeText, wallHms } from "./clock-change-common";
import type { Change } from "./clock-change-common";
import { updateCrystalClock } from "./crystal-clock";
import {
  renderDataCreditsHtml,
  COASTLINES,
  type DataCreditsPlacement,
  TZ_BOUNDARIES,
  watchDataCredits,
} from "./data-credits";
import { spokenOffset } from "./crossing-clock";
import { enter } from "./enter";
import { escapeAttr, escapeHtml, zoneIdHtml } from "./widget-ui";
import { plainText, tensedHtml, tensedPlain } from "./clock-change-tense";
import type { Tensed, TenseView } from "./clock-change-tense";
import {
  LABEL_HEIGHT_PX,
  cityOf,
  labelSize,
  poleOfInaccessibility,
} from "./zone-map-labels";

const SVG_NS = "http://www.w3.org/2000/svg";
/** The drawing's own coordinate box; the SVG scales to its container with `viewBox`. */
export const MAP_WIDTH = 800;
/** Below this width of the section the map is not drawn (CSS hides it at the same width). */
export const NARROW_PX = 520;

// ---------------------------------------------------------------------------
// Projection
// ---------------------------------------------------------------------------

/**
 * A zone's shape (`tzid`), or the one land feature (`land: "other"`): the coastline's land that no
 * zone of the region covers, written first and drawn under the zones.
 */
export interface BoundaryFeature {
  type: "Feature";
  properties: { tzid?: string; land?: string };
  geometry: { type: string; coordinates: unknown };
}

export interface BoundaryCollection {
  type: "FeatureCollection";
  features: BoundaryFeature[];
}

/** A boundary feature that is a zone: it has a `tzid`. The land feature has none. */
export function isZoneFeature(
  feature: BoundaryFeature,
): feature is BoundaryFeature & { properties: { tzid: string } } {
  return typeof feature.properties.tzid === "string";
}

/** The collection without its land feature: what a projection fits to. */
export function zonesOnly(boundaries: BoundaryCollection): BoundaryCollection {
  return { ...boundaries, features: boundaries.features.filter(isZoneFeature) };
}

/** One zone's row in the Worker's answer. */
export interface MapZone {
  zone: string;
  offset: string;
  last: Change | null;
  next: Change | null;
  kind: "stopped" | "changes-after" | "none";
}

export type ZoneRow = MapZone;

/** Everything the map takes from the checker that mounts it. */
export interface ZoneMapConfig {
  /** Ids, and the credits button's id `<idPrefix>-data-credits` unless the markup names one. */
  idPrefix: string;
  /** The drawing's box is `MAP_WIDTH` by this. */
  height: number;
  /** The boundary file, already through `withBase`. */
  boundariesUrl: string;
  /** Fits the boundaries to the box. */
  projection: (
    boundaries: BoundaryCollection,
    width: number,
    height: number,
  ) => GeoProjection;
  /** The zones the page states as the first class, from its own facts and never from a runtime's data. */
  stopped: ReadonlySet<string>;
  /**
   * The words of each class in both tenses. `id` is the zone the words are for, or `null` for the
   * legend. The tense view says which form is true now and writes the dates.
   */
  classText: (
    kind: MapZone["kind"],
    id: string | null,
    view: TenseView,
  ) => Tensed;
  /** The release that recorded the change of a stopped zone, for the "Recorded in" line. */
  releaseOf: (id: string) => string | null;
  /** The releases the "no change recorded" line names: `2026b to 2026e`. */
  releaseRange: string;
  /** The map's accessible name. */
  mapLabel: string;
  /**
   * A zone whose largest drawn part is under this many drawing px (both ways) also gets a ring
   * at its `markers` coordinate, so a pointer can reach a shape a few pixels wide. The ring is
   * `tabindex="-1"` like the shapes; the zone list stays the keyboard path. Unset: no rings.
   */
  markerMinPx?: number;
  /** The `zone.tab` coordinate of each zone that may get a ring, `[lon, lat]`. */
  markers?: Readonly<Record<string, readonly [lon: number, lat: number]>>;
  /**
   * The zones that carry a permanent place label: the ones with a live clock beside the map, taken
   * from the clocks' own zone list. Every other zone shows its label while it is hovered, focused
   * or pinned.
   */
  labelled: readonly string[];
  /**
   * Where each permanent label sits, `[lon, lat]`, chosen inside the zone's land. Stated, not
   * computed: a centroid can fall outside a concave shape, and a computed point could land two
   * labels on top of each other. A zone with no anchor takes the point of its largest part that is
   * farthest from the edge.
   */
  anchors: Readonly<Record<string, readonly [lon: number, lat: number]>>;
  /** The corner the credits button sits in: one the region's land leaves empty. */
  creditsCorner: Extract<DataCreditsPlacement, "corner" | "corner-start">;
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/** The offset in force at `at`: the next change's offset once `at` has reached it. */
export function offsetAt(
  zone: MapZone,
  at: string,
  isBefore: (a: string, b: string) => boolean,
): string {
  const next = zone.next;
  if (next !== null && !isBefore(at, next.instant)) return next.offsetAfter;
  return zone.offset;
}

/**
 * The class a zone is drawn in. The zones that stop changing their clocks come from the page's
 * own facts (`config.stopped`), so the map looks the same whatever runtime serves it. Every other
 * zone keeps the class its row carries: no other zone changed in the releases the page names, so
 * every runtime agrees on them. No row is "no-data".
 */
export function displayKind(
  config: ZoneMapConfig,
  id: string,
  zone: MapZone | undefined,
): string {
  if (config.stopped.has(id)) return "stopped";
  return zone?.kind ?? "no-data";
}

/** The class words of a zone in both tenses, or "no data" when the server sent no row. */
export function classPhraseOf(
  config: ZoneMapConfig,
  id: string,
  zone: MapZone | undefined,
  view: TenseView,
): Tensed {
  const kind = displayKind(config, id, zone);
  return kind === "no-data"
    ? plainText("no data")
    : config.classText(kind as MapZone["kind"], id, view);
}

/** The class words of a zone in the form that is true now. */
export function classWords(
  config: ZoneMapConfig,
  id: string,
  zone: MapZone | undefined,
  view: TenseView,
): string {
  return tensedPlain(classPhraseOf(config, id, zone, view), view);
}

/**
 * True when the serving runtime's data is older than the page's facts: a zone that stops changing
 * its clocks still comes back as one that changes. The page uses it for one line above the clocks.
 */
export function isDataStale(
  stopped: ReadonlySet<string>,
  zones: readonly MapZone[],
): boolean {
  return zones.some(
    (zone) => stopped.has(zone.zone) && zone.kind !== "stopped",
  );
}

/**
 * The zones this runtime has wrong: those that stop changing their clocks in 2026 and still come back
 * as ones that change. A check run on this data cannot judge a saved event in any of them.
 */
export function staleZoneIds(
  stopped: ReadonlySet<string>,
  zones: readonly MapZone[],
): string[] {
  return zones
    .filter((zone) => stopped.has(zone.zone) && zone.kind !== "stopped")
    .map((zone) => zone.zone);
}

/** How many of `ids` fall in each of the three classes. */
export function classCounts(
  config: ZoneMapConfig,
  ids: readonly string[],
  rows: ReadonlyMap<string, MapZone>,
): Record<MapZone["kind"], number> {
  const counts = { stopped: 0, "changes-after": 0, none: 0 };
  for (const id of ids) {
    const kind = displayKind(config, id, rows.get(id));
    if (kind in counts) counts[kind as MapZone["kind"]] += 1;
  }
  return counts;
}

/** The pin panel's last-change line. `nowInstant` is the response's `now`. */
export function lastText(zone: MapZone, nowInstant: string): string {
  const year = Number(nowInstant.slice(0, 4));
  return changeText(zone.last, `${year - 1} or ${year}`);
}

/** The pin panel's next-change line. */
export function nextText(zone: MapZone, nowInstant: string): string {
  const year = Number(nowInstant.slice(0, 4));
  return changeText(zone.next, `${year} or ${year + 1}`);
}

/**
 * The panel's "Recorded in" line. A stopped zone names its release. Every other zone says why
 * there is none, never a blank.
 */
export function releaseWords(config: ZoneMapConfig, id: string): string {
  const release = config.releaseOf(id);
  if (release !== null && config.stopped.has(id)) return `tzdb ${release}`;
  return `\u2014 no change recorded in tzdb ${config.releaseRange}`;
}

/** `-07:00` as `UTC-07:00`, so the offset is not read as a time. */
export function offsetWords(offset: string): string {
  return `UTC${offset}`;
}

// ---------------------------------------------------------------------------
// The panel's markup (server-rendered, filled here)
// ---------------------------------------------------------------------------

export const PIN_PLACEHOLDER = "Press a zone to pin it.";
/** What an empty row shows before a zone is pinned: a dash, never a blank. */
const EMPTY = "\u2014";

export function renderPinPanelHtml(): string {
  const row = (role: string, label: string, text = EMPTY, extra = "") =>
    `<div class="gmt-zonemap-pin-row${extra}"><dt>${label}</dt><dd data-role="${role}">${text}</dd></div>`;
  const title = (role: string, label: string, text: string) =>
    `<div class="gmt-zonemap-pin-titlerow"><dt class="gmt-zonemap-sr">${label}</dt><dd data-role="${role}">${text}</dd></div>`;
  return (
    // The one announcement: the pinned zone and its class, said when a zone is pinned. The ticking
    // time below is plain text outside any live region.
    `<p class="gmt-zonemap-sr" data-role="pin-announce" role="status"></p>` +
    `<div class="gmt-zonemap-pin-head">` +
    `<div class="gmt-zonemap-pin-clock" data-role="pin-clock" aria-hidden="true"></div>` +
    `<dl class="gmt-zonemap-pin-title">` +
    title("pin-zone", "Zone", PIN_PLACEHOLDER) +
    title("pin-class", "Class", EMPTY) +
    `</dl></div>` +
    `<dl class="gmt-zonemap-pin-rows">` +
    row("pin-time", "Local time") +
    row("pin-offset", "UTC offset") +
    row("pin-last", "Last change", EMPTY, " gmt-zonemap-pin-row--wide") +
    row("pin-next", "Next change", EMPTY, " gmt-zonemap-pin-row--wide") +
    row("pin-release", "Recorded in", EMPTY, " gmt-zonemap-pin-row--wide") +
    `</dl>`
  );
}

// ---------------------------------------------------------------------------
// Mount
// ---------------------------------------------------------------------------

export interface ZoneMapDeps {
  /** Which tense is true now, and the dates in words. Read again at each redraw. */
  tense: () => TenseView;
  /** The response's `now`: the year of the empty-change sentences. */
  responseNow: string;
  /** The client's now as a UTC instant. */
  now: () => string;
  /** The wall time `YYYY-MM-DDTHH:mm...` of a UTC instant at a fixed offset, or `""`. */
  wall: (at: string, offset: string) => string;
  isBefore: (a: string, b: string) => boolean;
  /** Milliseconds to the next whole second. */
  msToNextSecond: (now: string) => number;
  /** The fetch for the boundary file. */
  fetch?: typeof fetch;
  /** The section's width in px. Defaults to a layout measure. */
  measure?: () => number;
  /** Where `?zone=` is read and written. Defaults to the window's. */
  location?: Pick<Location, "href">;
  history?: Pick<History, "replaceState">;
}

export interface ZoneMapHandle {
  /** Redraws the words that hold a tense in text (labels, the announcement) after a moment passed. */
  retense(): void;
  /** Pins `id`; false when it is not in the list. */
  pin(id: string): boolean;
  /** The pinned zone id, or null. */
  pinned(): string | null;
  /** Resolves once the map's file has been fetched and drawn, or at once when it never will be. */
  ready: Promise<void>;
}

export function mountZoneMap(
  root: HTMLElement,
  zones: MapZone[],
  signal: AbortSignal,
  deps: ZoneMapDeps,
  config: ZoneMapConfig,
): ZoneMapHandle {
  const q = <T extends HTMLElement>(
    selector: string,
    within: ParentNode = root,
  ) => within.querySelector<T>(selector);
  const section = q<HTMLElement>('[data-role="map-section"]') ?? root;
  const frame = q<HTMLElement>('[data-role="map"]');
  const list = q<HTMLElement>('[data-role="zone-list"]');
  const scroller = q<HTMLElement>('[data-role="zone-scroll"]');
  const panel = q<HTMLElement>('[data-role="pin"]');
  const rows = new Map(zones.map((zone) => [zone.zone, zone]));
  const buttons = list
    ? [...list.querySelectorAll<HTMLButtonElement>("button[data-tz-id]")]
    : [];
  const byId = new Map(
    buttons.map((button) => [button.dataset.tzId ?? "", button]),
  );
  const measure = deps.measure ?? (() => section.getBoundingClientRect().width);
  let pinnedId: string | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let shapes = new Map<string, SVGPathElement>();
  let rings = new Map<string, SVGCircleElement>();
  let drawn = false;
  let fetching = false;
  // The place labels: an overlay on the drawing, one element per zone shown so far.
  let hoverId: string | null = null;
  let labelLayer: HTMLElement | undefined;
  let labelAnchor: (id: string) => readonly [number, number] | null = () =>
    null;
  const labels = new Map<string, HTMLElement>();
  let observer: IntersectionObserver | undefined;
  let resolveReady: () => void = () => {};
  const ready = new Promise<void>((resolve) => {
    resolveReady = resolve;
  });

  // --- the list ------------------------------------------------------------
  for (const button of buttons) {
    const id = button.dataset.tzId ?? "";
    const zone = rows.get(id);
    const kind = q<HTMLElement>('[data-role="kind"]', button);
    const offset = q<HTMLElement>('[data-role="offset"]', button);
    if (kind) {
      kind.innerHTML = tensedHtml(
        classPhraseOf(config, id, zone, deps.tense()),
        deps.tense(),
      );
    }
    if (offset) {
      if (zone && zone.offset !== "") offset.textContent = zone.offset;
      else offset.innerHTML = NO_SIGNAL;
    }
    button.dataset.kind = displayKind(config, id, zone);
    const swatch = q<HTMLElement>('[data-role="swatch"]', button);
    if (swatch) swatch.dataset.kind = displayKind(config, id, zone);
  }

  // The legend's counts, from the zones the list holds.
  const counts = classCounts(config, [...byId.keys()], rows);
  for (const [kind, count] of Object.entries(counts)) {
    // One copy per form of a two-form legend phrase.
    for (const el of root.querySelectorAll<HTMLElement>(
      `[data-role="legend-count"][data-kind="${kind}"]`,
    ))
      el.textContent = String(count);
  }
  // One line above the live clocks when the server's data is older than tzdb 2026e.
  const notice = q<HTMLElement>('[data-role="clocks-notice"]');
  if (notice) notice.hidden = !isDataStale(config.stopped, zones);

  function setRoving(active: HTMLButtonElement | undefined): void {
    for (const button of buttons) button.tabIndex = button === active ? 0 : -1;
  }
  setRoving(buttons[0]);

  /**
   * Scrolls the list's own box, never the page, until `el` is in view. An element taller than the
   * box lines its top edge up with the box's.
   */
  function reveal(el: HTMLElement | null | undefined): void {
    if (!scroller || !el) return;
    const box = scroller.getBoundingClientRect();
    const rect = el.getBoundingClientRect();
    // A margin so the focus outline (2px, offset 2px) is never cut by the box's edge.
    const margin = 6;
    if (rect.height + 2 * margin >= box.height || rect.top - margin < box.top) {
      scroller.scrollTop += rect.top - margin - box.top;
    } else if (rect.bottom + margin > box.bottom) {
      scroller.scrollTop += rect.bottom + margin - box.bottom;
    }
  }

  list?.addEventListener(
    "keydown",
    (event) => {
      const target = (event.target as HTMLElement).closest<HTMLButtonElement>(
        "button[data-tz-id]",
      );
      if (!target) return;
      const index = buttons.indexOf(target);
      let next = -1;
      if (event.key === "ArrowDown" || event.key === "ArrowRight")
        next = Math.min(index + 1, buttons.length - 1);
      else if (event.key === "ArrowUp" || event.key === "ArrowLeft")
        next = Math.max(index - 1, 0);
      else if (event.key === "Home") next = 0;
      else if (event.key === "End") next = buttons.length - 1;
      if (next < 0) return;
      event.preventDefault();
      setRoving(buttons[next]);
      buttons[next]!.focus({ preventScroll: true });
      reveal(buttons[next]);
    },
    { signal },
  );
  list?.addEventListener(
    "click",
    (event) => {
      const target = (event.target as HTMLElement).closest<HTMLButtonElement>(
        "button[data-tz-id]",
      );
      if (target) {
        setRoving(target);
        pin(target.dataset.tzId ?? "");
      }
    },
    { signal },
  );

  // --- hover and focus mirror between the list and the shapes ---------------
  function mirror(id: string | null): void {
    hoverId = id;
    refreshLabels();
    for (const [key, shape] of shapes)
      shape.classList.toggle("is-active", key === id);
    for (const [key, marker] of rings)
      marker.classList.toggle("is-active", key === id);
    drawRing(hoverRing, id);
    for (const [key, button] of byId)
      button.classList.toggle("is-active", key === id);
  }
  const idOf = (target: EventTarget | null): string | null =>
    (target as HTMLElement | null)?.closest?.<HTMLElement>("[data-tz-id]")
      ?.dataset.tzId ?? null;
  for (const host of [list, frame]) {
    host?.addEventListener("pointerover", (e) => mirror(idOf(e.target)), {
      signal,
    });
    host?.addEventListener("pointerout", () => mirror(null), { signal });
    host?.addEventListener("focusin", (e) => mirror(idOf(e.target)), {
      signal,
    });
    host?.addEventListener("focusout", () => mirror(null), { signal });
  }

  // --- the panel -----------------------------------------------------------
  const field = (role: string) =>
    q<HTMLElement>(`[data-role="${role}"]`, panel ?? root);

  function drawPanel(): void {
    if (!panel) return;
    const zone = pinnedId === null ? undefined : rows.get(pinnedId);
    const set = (role: string, value: string) => {
      const el = field(role);
      if (el) el.textContent = value;
    };
    const clock = field("pin-clock");
    const announce = field("pin-announce");
    if (announce) {
      announce.textContent =
        pinnedId === null
          ? ""
          : `Pinned ${pinnedId}. ${classWords(config, pinnedId, rows.get(pinnedId), deps.tense())}.`;
    }
    const rest = [
      "pin-time",
      "pin-offset",
      "pin-last",
      "pin-next",
      "pin-release",
    ];
    const classEl = field("pin-class");
    if (pinnedId === null) {
      set("pin-zone", PIN_PLACEHOLDER);
      if (classEl) classEl.textContent = EMPTY;
      for (const role of rest) set(role, EMPTY);
      if (clock) clock.innerHTML = "";
      return;
    }
    const zoneEl = field("pin-zone");
    if (zoneEl) zoneEl.innerHTML = zoneIdHtml(pinnedId);
    if (classEl) {
      classEl.innerHTML =
        `<span class="gmt-zonemap-swatch gmt-theme-dark" data-kind="${displayKind(config, pinnedId, zone)}" aria-hidden="true"></span>` +
        tensedHtml(
          classPhraseOf(config, pinnedId, zone, deps.tense()),
          deps.tense(),
        );
    }
    if (!zone) {
      for (const role of rest) set(role, EMPTY);
      if (clock) clock.innerHTML = "";
      return;
    }
    const at = deps.now();
    const offset = offsetAt(zone, at, deps.isBefore);
    const wall = offset === "" ? "" : deps.wall(at, offset);
    if (wall === "") {
      for (const role of ["pin-time", "pin-offset"]) {
        const el = field(role);
        if (el) el.innerHTML = NO_SIGNAL;
      }
      if (clock) clock.innerHTML = "";
    } else {
      drawTime(wall, offset);
    }
    set("pin-last", lastText(zone, deps.responseNow));
    set("pin-next", nextText(zone, deps.responseNow));
    set("pin-release", releaseWords(config, pinnedId!));
  }

  /** The time and the face: the only parts that change every second. */
  function drawTime(wall: string, offset: string): void {
    const timeEl = field("pin-time");
    if (timeEl) timeEl.textContent = wallHms(wall);
    const offsetEl = field("pin-offset");
    if (offsetEl) offsetEl.textContent = offsetWords(offset);
    const clock = field("pin-clock");
    if (clock && pinnedId !== null) {
      updateCrystalClock(clock, {
        id: `${config.idPrefix}-pin`,
        hour: Number(wall.slice(11, 13)),
        minute: Number(wall.slice(14, 16)),
        second: Number(wallHms(wall).slice(6, 8)),
        label: pinnedId,
        sublabel: `${wall.slice(11, 16)}, ${spokenOffset(offset)}`,
        size: 80,
        glowable: false,
      });
    }
  }

  function tick(): void {
    clearTimeout(timer);
    if (signal.aborted || pinnedId === null) return;
    const zone = rows.get(pinnedId);
    if (zone) {
      const at = deps.now();
      const offset = offsetAt(zone, at, deps.isBefore);
      const wall = offset === "" ? "" : deps.wall(at, offset);
      if (wall !== "") drawTime(wall, offset);
    }
    timer = setTimeout(tick, deps.msToNextSecond(deps.now()));
  }
  signal.addEventListener("abort", () => clearTimeout(timer), { once: true });

  /**
   * The panel stays in its own place, below the list's box, at every width: inside the box it
   * would be taller than the box and scroll with the list. Narrow, the style sheet hides it until
   * a zone is pinned (`data-pinned`); the section has no map to fill that space.
   */
  function placePanel(): void {
    if (panel) panel.dataset.pinned = String(pinnedId !== null);
  }

  function writeUrl(id: string): void {
    try {
      const url = new URL((deps.location ?? window.location).href);
      url.searchParams.set("zone", id);
      (deps.history ?? window.history).replaceState(null, "", url.toString());
    } catch {
      // A sandboxed frame may refuse replaceState; the pin still works.
    }
  }

  function pin(id: string, write = true): boolean {
    if (!byId.has(id)) return false;
    pinnedId = id;
    for (const [key, button] of byId)
      button.setAttribute("aria-pressed", String(key === id));
    for (const [key, shape] of shapes) {
      shape.setAttribute("aria-pressed", String(key === id));
      shape.classList.toggle("is-pinned", key === id);
    }
    for (const [key, marker] of rings) {
      marker.setAttribute("aria-pressed", String(key === id));
      marker.classList.toggle("is-pinned", key === id);
    }
    drawRing(pinRing, id);
    refreshLabels();
    drawPanel();
    placePanel();
    tick();
    const button = byId.get(id);
    reveal(button);
    // Narrow, the panel opens below the list, which may be off screen: bring it into view when the
    // reader pins (not when the page loads on a `?zone=` link).
    if (write && measure() < NARROW_PX)
      panel?.scrollIntoView?.({ block: "nearest" });
    if (write) writeUrl(id);
    return true;
  }

  // --- the rings -----------------------------------------------------------
  // Hover and pin are drawn as paths on top of every shape, so a neighbour never paints over half
  // of the line. Each ring is a night casing under an ink line, the globe's own overlay rule: the
  // ink only has to clear the casing, whatever fill lies beneath.
  let hoverRing: SVGGElement | undefined;
  let pinRing: SVGGElement | undefined;
  function makeRing(kind: "hover" | "pin"): SVGGElement {
    const group = document.createElementNS(SVG_NS, "g");
    group.setAttribute("class", `gmt-zonemap-ring gmt-zonemap-ring--${kind}`);
    group.setAttribute("aria-hidden", "true");
    for (const part of ["casing", "ink"]) {
      const path = document.createElementNS(SVG_NS, "path");
      path.setAttribute("class", `gmt-zonemap-ring-${part}`);
      group.append(path);
    }
    group.setAttribute("visibility", "hidden");
    return group;
  }
  function drawRing(ring: SVGGElement | undefined, id: string | null): void {
    if (!ring) return;
    const shape = id === null ? undefined : shapes.get(id);
    const d = shape?.getAttribute("d") ?? null;
    if (d === null) {
      ring.setAttribute("visibility", "hidden");
      return;
    }
    for (const path of ring.children) path.setAttribute("d", d);
    ring.setAttribute("visibility", "visible");
  }

  // --- the small-shape rings -------------------------------------------------
  /**
   * A ring at the `zone.tab` coordinate of each zone whose largest drawn part is under
   * `markerMinPx`. The test is on the largest part, not the whole shape: `Africa/Ceuta` is two
   * specks (Ceuta and Melilla) that span far more than the threshold together.
   */
  function drawMarkers(
    svg: SVGSVGElement,
    boundaries: BoundaryCollection,
    path: GeoPath,
    projection: GeoProjection,
  ): Map<string, SVGCircleElement> {
    const made = new Map<string, SVGCircleElement>();
    const minPx = config.markerMinPx;
    if (minPx === undefined || !config.markers) return made;
    for (const feature of boundaries.features) {
      if (!isZoneFeature(feature)) continue;
      const id = feature.properties.tzid;
      const at = config.markers[id];
      if (!byId.has(id) || !at || !shapes.has(id)) continue;
      if (largestPartPx(feature, path) >= minPx) continue;
      const point = projection([at[0], at[1]]);
      if (!point) continue;
      const zone = rows.get(id);
      const ring = document.createElementNS(SVG_NS, "circle");
      ring.setAttribute("class", "gmt-zonemap-marker");
      ring.setAttribute("cx", point[0].toFixed(1));
      ring.setAttribute("cy", point[1].toFixed(1));
      ring.setAttribute("r", String(minPx / 2));
      ring.setAttribute("data-kind", displayKind(config, id, zone));
      ring.setAttribute("data-tz-id", id);
      ring.setAttribute("role", "button");
      ring.setAttribute("tabindex", "-1");
      ring.setAttribute("aria-pressed", "false");
      ring.setAttribute(
        "aria-label",
        `${id}, ${classWords(config, id, zone, deps.tense())}`,
      );
      svg.append(ring);
      made.set(id, ring);
    }
    return made;
  }

  // --- the labels ------------------------------------------------------------
  /**
   * One label: the city, and under it the offset the zone list shows (`offsetAt` at the response's
   * own `now`, so the map and the list never disagree), or the list's NO SIGNAL mark. The text is
   * `aria-hidden`: each shape already has its `aria-label`.
   */
  function makeLabel(id: string, at: readonly [number, number]): HTMLElement {
    const zone = rows.get(id);
    const offset = zone ? offsetAt(zone, deps.responseNow, deps.isBefore) : "";
    const city = cityOf(id);
    const size = labelSize(city, offset === "" ? null : offset);
    const label = document.createElement("div");
    label.className = "gmt-zonemap-label";
    label.dataset.labelFor = id;
    label.setAttribute("aria-hidden", "true");
    label.style.setProperty(
      "--ax",
      `${((at[0] / MAP_WIDTH) * 100).toFixed(2)}%`,
    );
    label.style.setProperty(
      "--ay",
      `${((at[1] / config.height) * 100).toFixed(2)}%`,
    );
    label.style.setProperty("--lw", `${size.width}px`);
    label.style.setProperty("--lh", `${LABEL_HEIGHT_PX}px`);
    label.innerHTML =
      `<span class="gmt-zonemap-label-city">${escapeHtml(city)}</span>` +
      `<span class="gmt-zonemap-label-offset">${offset === "" ? NO_SIGNAL : escapeHtml(offset)}</span>`;
    return label;
  }

  /** Shows the permanent labels, the hovered or focused zone's, and the pinned zone's. */
  function refreshLabels(): void {
    if (!labelLayer) return;
    const permanent = new Set(config.labelled);
    const want = new Set(permanent);
    if (hoverId !== null) want.add(hoverId);
    if (pinnedId !== null) want.add(pinnedId);
    for (const id of want) {
      if (!shapes.has(id)) continue;
      let label = labels.get(id);
      if (!label) {
        const at = labelAnchor(id);
        if (!at) continue;
        label = makeLabel(id, at);
        labels.set(id, label);
        labelLayer.append(label);
      }
      label.hidden = false;
      label.classList.toggle("is-passing", !permanent.has(id));
    }
    for (const [id, label] of labels) if (!want.has(id)) label.hidden = true;
  }

  // --- the shapes ----------------------------------------------------------
  function drawShapes(boundaries: BoundaryCollection): void {
    if (!frame || drawn) return;
    drawn = true;
    const projection = config.projection(boundaries, MAP_WIDTH, config.height);
    const path = geoPath(projection);
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("class", "gmt-zonemap-svg");
    svg.setAttribute("viewBox", `0 0 ${MAP_WIDTH} ${config.height}`);
    svg.setAttribute("role", "group");
    svg.setAttribute("aria-label", config.mapLabel);
    svg.setAttribute("focusable", "false");
    const next = new Map<string, SVGPathElement>();
    const stopped: SVGPathElement[] = [];
    // The land no zone covers is drawn first, under every shape: a decoration, not a zone. It is
    // not in `shapes`, takes no pointer and is hidden from assistive technology.
    for (const feature of boundaries.features) {
      if (feature.properties.land === undefined) continue;
      const d = path(feature as unknown as Parameters<typeof path>[0]);
      if (d === null) continue;
      const land = document.createElementNS(SVG_NS, "path");
      land.setAttribute("d", d);
      land.setAttribute("class", "gmt-zonemap-land");
      land.setAttribute("aria-hidden", "true");
      svg.append(land);
    }
    for (const feature of boundaries.features) {
      if (!isZoneFeature(feature)) continue;
      const id = feature.properties.tzid;
      if (!byId.has(id)) continue;
      const d = path(feature as unknown as Parameters<typeof path>[0]);
      if (d === null) continue;
      const zone = rows.get(id);
      const shape = document.createElementNS(SVG_NS, "path");
      shape.setAttribute("d", d);
      shape.setAttribute("class", "gmt-zonemap-shape");
      shape.setAttribute("data-kind", displayKind(config, id, zone));
      shape.setAttribute("data-tz-id", id);
      shape.setAttribute("role", "button");
      shape.setAttribute("tabindex", "-1");
      shape.setAttribute("aria-pressed", "false");
      shape.setAttribute(
        "aria-label",
        `${id}, ${classWords(config, id, zone, deps.tense())}`,
      );
      next.set(id, shape);
      if (config.stopped.has(id)) stopped.push(shape);
      else svg.append(shape);
    }
    // The zones that stop are drawn last, so no neighbour paints over any of their border.
    for (const shape of stopped) svg.append(shape);
    shapes = next;
    rings = drawMarkers(svg, boundaries, path, projection);
    hoverRing = makeRing("hover");
    pinRing = makeRing("pin");
    svg.append(hoverRing, pinRing);
    svg.addEventListener(
      "click",
      (event) => {
        const id = idOf(event.target);
        if (id !== null) pin(id);
      },
      { signal },
    );
    svg.addEventListener(
      "keydown",
      (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        const id = idOf(event.target);
        if (id === null) return;
        event.preventDefault();
        pin(id);
      },
      { signal },
    );
    frame.append(svg);
    // The labels sit over the drawing in their own layer, so they take no pointer and move nothing.
    labelLayer = document.createElement("div");
    labelLayer.className = "gmt-zonemap-labels";
    labelLayer.setAttribute("aria-hidden", "true");
    frame.append(labelLayer);
    const features = new Map(
      boundaries.features
        .filter(isZoneFeature)
        .map((f) => [f.properties.tzid, f]),
    );
    const poles = new Map<string, readonly [number, number] | null>();
    labelAnchor = (id) => {
      const stated = config.anchors[id];
      if (stated) {
        const point = projection([stated[0], stated[1]]);
        if (point) return point;
      }
      if (!poles.has(id)) {
        const feature = features.get(id);
        poles.set(
          id,
          feature
            ? poleOfInaccessibility(
                largestProjectedPart(feature, projection, config.height),
                { width: MAP_WIDTH, height: config.height },
              )
            : null,
        );
      }
      return poles.get(id) ?? null;
    };
    refreshLabels();
    // The boundaries are the one third-party datum the map draws; the button sits on the drawing.
    watchDataCredits();
    frame.insertAdjacentHTML(
      "beforeend",
      renderDataCreditsHtml([TZ_BOUNDARIES, COASTLINES], {
        id: frame.dataset.creditsId ?? `${config.idPrefix}-data-credits`,
        placement: config.creditsCorner,
      }),
    );
    if (pinnedId !== null) pin(pinnedId, false);
    // The site's arrival gesture, as the globe plays it. The stage keeps its own aspect-ratio box
    // and its sea fill, so only the drawing fades in; nothing around it moves. Last, so a pinned
    // zone's panel is placed from the drawing at rest.
    enter(svg);
  }

  async function loadShapes(): Promise<void> {
    if (drawn || fetching || signal.aborted || measure() < NARROW_PX) return;
    fetching = true;
    try {
      const response = await (deps.fetch ?? fetch)(config.boundariesUrl, {
        signal,
      });
      if (!response.ok) return;
      const boundaries = (await response.json()) as BoundaryCollection;
      if (!signal.aborted && measure() >= NARROW_PX) drawShapes(boundaries);
    } catch {
      // The list is the complete path; a missing map is not an error to show.
    } finally {
      fetching = false;
      resolveReady();
    }
  }

  // --- lazy load and resize ------------------------------------------------
  function arm(): void {
    if (drawn || fetching) return;
    if (measure() < NARROW_PX) {
      resolveReady();
      return;
    }
    if (typeof IntersectionObserver === "undefined") {
      void loadShapes();
      return;
    }
    observer ??= new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer?.disconnect();
          observer = undefined;
          void loadShapes();
        }
      },
      { rootMargin: "300px" },
    );
    observer.observe(frame ?? section);
  }
  signal.addEventListener("abort", () => observer?.disconnect(), {
    once: true,
  });

  if (typeof ResizeObserver !== "undefined") {
    let frameId = 0;
    const resize = new ResizeObserver(() => {
      cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(() => {
        placePanel();
        arm();
      });
    });
    resize.observe(section);
    signal.addEventListener("abort", () => resize.disconnect(), { once: true });
  }

  // --- start ---------------------------------------------------------------
  drawPanel();
  let fromUrl: string | null = null;
  try {
    fromUrl = new URL((deps.location ?? window.location).href).searchParams.get(
      "zone",
    );
  } catch {
    fromUrl = null;
  }
  if (fromUrl !== null && byId.has(fromUrl)) {
    pin(fromUrl, false);
    setRoving(byId.get(fromUrl));
  } else {
    placePanel();
  }
  arm();

  /** Rewrites the words that hold a tense as text: the shapes' and rings' labels, the announcement. */
  function retense(): void {
    const view = deps.tense();
    for (const group of [shapes, rings]) {
      for (const [id, el] of group) {
        el.setAttribute(
          "aria-label",
          `${id}, ${classWords(config, id, rows.get(id), view)}`,
        );
      }
    }
    const announce = field("pin-announce");
    if (announce && pinnedId !== null) {
      announce.textContent = `Pinned ${pinnedId}. ${classWords(config, pinnedId, rows.get(pinnedId), view)}.`;
    }
  }

  return { pin: (id) => pin(id), pinned: () => pinnedId, ready, retense };
}

/**
 * The larger side of the drawn box of the feature's largest part (a polygon of a MultiPolygon),
 * in drawing px. A feature the projection drops gives 0.
 */
export function largestPartPx(feature: BoundaryFeature, path: GeoPath): number {
  const { type, coordinates } = feature.geometry;
  const polygons =
    type === "MultiPolygon"
      ? (coordinates as unknown[])
      : type === "Polygon"
        ? [coordinates]
        : [];
  let largest = 0;
  let largestArea = -1;
  for (const rings of polygons) {
    const [[x0, y0], [x1, y1]] = path.bounds({
      type: "Polygon",
      coordinates: rings,
    } as unknown as Parameters<typeof path.bounds>[0]);
    const width = x1 - x0;
    const height = y1 - y0;
    if (!Number.isFinite(width) || !Number.isFinite(height)) continue;
    if (width * height > largestArea) {
      largestArea = width * height;
      largest = Math.max(width, height);
    }
  }
  return largest;
}

/**
 * The rings of the feature's largest part (the polygon whose projected box takes the most of the
 * drawing's box), projected to drawing px. Empty when nothing of it lies in the box.
 */
export function largestProjectedPart(
  feature: BoundaryFeature,
  projection: GeoProjection,
  height: number,
): [number, number][][] {
  const { type, coordinates } = feature.geometry;
  const polygons =
    type === "MultiPolygon"
      ? (coordinates as [number, number][][][])
      : type === "Polygon"
        ? [coordinates as [number, number][][]]
        : [];
  let best: [number, number][][] = [];
  let bestArea = 0;
  for (const rings of polygons) {
    const projected = rings.map((ring) =>
      ring
        .map((point) => projection(point))
        .filter((point): point is [number, number] => point !== null),
    );
    const outer = projected[0] ?? [];
    if (outer.length < 3) continue;
    const xs = outer.map((point) => point[0]);
    const ys = outer.map((point) => point[1]);
    const width =
      Math.min(Math.max(...xs), MAP_WIDTH) - Math.max(Math.min(...xs), 0);
    const tall =
      Math.min(Math.max(...ys), height) - Math.max(Math.min(...ys), 0);
    if (width > 0 && tall > 0 && width * tall > bestArea) {
      bestArea = width * tall;
      best = projected;
    }
  }
  return best;
}

/** One list item, server-rendered from the checker's zone list. */
export function zoneListItemHtml(zone: string): string {
  const id = escapeAttr(zone);
  return (
    `<li class="gmt-zonemap-zone"><button type="button" class="gmt-zonemap-zone-btn" data-tz-id="${id}" aria-pressed="false">` +
    `<span class="gmt-zonemap-zone-id"><code>${zoneIdHtml(zone)}</code></span>` +
    `<span class="gmt-zonemap-zone-kind"><span class="gmt-zonemap-swatch gmt-theme-dark" data-role="swatch" data-kind="no-data" aria-hidden="true"></span><span data-role="kind">no answer yet</span></span>` +
    `<span class="gmt-zonemap-zone-offset" data-role="offset">${NO_SIGNAL}</span>` +
    `</button></li>`
  );
}
