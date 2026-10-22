/**
 * The Canada map of the clock-change checker (CORE-88): one shape per IANA zone in one of three
 * classes, a zone list that pins the same zone by keyboard, and the pin panel.
 *
 * Plain DOM, no React. The server renders the list and the panel (`canada-clock-change-mount.ts`),
 * so both exist before this script runs; this module fills them from the Worker's `zones`, draws
 * the shapes when the section is wide enough, and wires the pin.
 *
 * **The list is the keyboard path.** One `<button>` per zone, a roving tab stop, arrow keys,
 * Home and End to move; Enter or Space pins. The shapes are `role="button"` with `tabindex="-1"`,
 * so a pointer reaches them and the Tab key does not walk 23 of them.
 *
 * **Below 520 px of section width the map is not drawn and its file is not fetched.** The list
 * stays, and the pin panel opens under the pressed button. The data-credits button belongs to the
 * drawing, so it is added when the map is drawn and a narrow section has none.
 */
import { geoConicConformal, geoPath } from "d3-geo";
import type { GeoProjection } from "d3-geo";
import { PROBE_ZONES, STOPPED_ZONES, changeText, mapKindLabel, wallHms } from "./canada-clock-change";
import type { MapZone } from "./canada-clock-change";
import { updateCrystalClock } from "./crystal-clock";
import { renderDataCreditsHtml, TZ_BOUNDARIES, watchDataCredits } from "./data-credits";
import { spokenOffset } from "./crossing-clock";
import { withBase } from "./site";
import { escapeAttr, escapeHtml } from "./widget-ui";

const SVG_NS = "http://www.w3.org/2000/svg";
/** The drawing's own coordinate box; the SVG scales to its container with `viewBox`. */
export const MAP_WIDTH = 800;
export const MAP_HEIGHT = 640;
const INSET = 16;
/** Below this width of the section the map is not drawn (CSS hides it at the same width). */
export const NARROW_PX = 520;
const NO_SIGNAL = `<span class="gmt-playground-sentinel">NO SIGNAL</span>`;

// ---------------------------------------------------------------------------
// Projection
// ---------------------------------------------------------------------------

export interface BoundaryFeature {
  type: "Feature";
  properties: { tzid: string };
  geometry: { type: string; coordinates: unknown };
}

export interface BoundaryCollection {
  type: "FeatureCollection";
  features: BoundaryFeature[];
}

/**
 * Lambert conformal conic with the parameters of EPSG:3347 ("NAD83 / Statistics Canada Lambert"):
 * standard parallels 49 and 77 degrees north, central meridian 91.866667 degrees west, latitude
 * of origin 63.390675 degrees north. Source: the IOGP EPSG Geodetic Parameter Registry
 * (<https://epsg.org/crs_3347/>); Statistics Canada publishes the same projection for its
 * boundary files. The result is fitted to the drawing's box with an inset on every side.
 */
export function canadaProjection(
  boundaries: BoundaryCollection,
  width = MAP_WIDTH,
  height = MAP_HEIGHT,
): GeoProjection {
  const projection = geoConicConformal()
    .parallels([49, 77])
    .rotate([91.866667, 0])
    .center([0, 63.390675]);
  projection.fitExtent(
    [
      [INSET, INSET],
      [width - INSET, height - INSET],
    ],
    boundaries as unknown as Parameters<GeoProjection["fitExtent"]>[1],
  );
  return projection;
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
 * The class a zone is drawn in. The four zones that stop changing their clocks come from the
 * page's own tzdb 2026e facts (`STOPPED_ZONES`), so the map looks the same whatever runtime serves
 * it. Every other zone keeps the class its row carries: no other zone changed in tzdb 2026b to
 * 2026e, so every runtime agrees on them. No row is "none".
 */
export function displayKind(id: string, zone: MapZone | undefined): string {
  if (STOPPED_ZONES.has(id)) return "stopped-2026";
  return zone?.kind ?? "none";
}

/** The class words of a zone, or "no data" when the server sent no row. */
export function classWords(id: string, zone: MapZone | undefined): string {
  const kind = displayKind(id, zone);
  return kind === "none" ? "no data" : mapKindLabel(kind as MapZone["kind"]);
}

/**
 * True when the serving runtime's data is older than tzdb 2026e: a zone that stops changing its
 * clocks still comes back as one that changes. The page uses it for one line above the clocks.
 */
export function isDataStale(zones: readonly MapZone[]): boolean {
  return zones.some((zone) => STOPPED_ZONES.has(zone.zone) && zone.kind !== "stopped-2026");
}

/**
 * The zones this runtime has wrong: those that stop changing their clocks in 2026 and still come back
 * as ones that change. A check run on this data cannot judge a saved event in any of them.
 */
export function staleZoneIds(zones: readonly MapZone[]): string[] {
  return zones
    .filter((zone) => STOPPED_ZONES.has(zone.zone) && zone.kind !== "stopped-2026")
    .map((zone) => zone.zone);
}

/** How many of `ids` fall in each of the three classes. */
export function classCounts(
  ids: readonly string[],
  rows: ReadonlyMap<string, MapZone>,
): Record<MapZone["kind"], number> {
  const counts = { "stopped-2026": 0, "changes-2027": 0, "none-2026-2027": 0 };
  for (const id of ids) {
    const kind = displayKind(id, rows.get(id));
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

/** The tzdb release that recorded the change, for a zone that stops changing in 2026. */
export function releaseOf(id: string): string | null {
  return PROBE_ZONES.find((fact) => fact.zone === id)?.release ?? null;
}

/**
 * The panel's "Recorded in" line. A stopped zone names its release. Every other zone says why
 * there is none, never a blank: only four zones changed their clocks in tzdb 2026b to 2026e.
 */
export function releaseWords(id: string): string {
  const release = releaseOf(id);
  if (release !== null && STOPPED_ZONES.has(id)) return `tzdb ${release}`;
  return "\u2014 no change recorded in tzdb 2026b to 2026e";
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
    `<div class="gmt-canada-pin-row${extra}"><dt>${label}</dt><dd data-role="${role}">${text}</dd></div>`;
  const title = (role: string, label: string, text: string) =>
    `<div class="gmt-canada-pin-titlerow"><dt class="gmt-canada-sr">${label}</dt><dd data-role="${role}">${text}</dd></div>`;
  return (
    // The one announcement: the pinned zone and its class, said when a zone is pinned. The ticking
    // time below is plain text outside any live region.
    `<p class="gmt-canada-sr" data-role="pin-announce" role="status"></p>` +
    `<div class="gmt-canada-pin-head">` +
    `<div class="gmt-canada-pin-clock" data-role="pin-clock" aria-hidden="true"></div>` +
    `<dl class="gmt-canada-pin-title">` +
    title("pin-zone", "Zone", PIN_PLACEHOLDER) +
    title("pin-class", "Class", EMPTY) +
    `</dl></div>` +
    `<dl class="gmt-canada-pin-rows">` +
    row("pin-time", "Local time") +
    row("pin-offset", "UTC offset") +
    row("pin-last", "Last change", EMPTY, " gmt-canada-pin-row--wide") +
    row("pin-next", "Next change", EMPTY, " gmt-canada-pin-row--wide") +
    row("pin-release", "Recorded in", EMPTY, " gmt-canada-pin-row--wide") +
    `</dl>`
  );
}

// ---------------------------------------------------------------------------
// Mount
// ---------------------------------------------------------------------------

export interface CanadaMapDeps {
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

export interface CanadaMapHandle {
  /** Pins `id`; false when it is not in the list. */
  pin(id: string): boolean;
  /** The pinned zone id, or null. */
  pinned(): string | null;
  /** Resolves once the map's file has been fetched and drawn, or at once when it never will be. */
  ready: Promise<void>;
}

export function mountCanadaMap(
  root: HTMLElement,
  zones: MapZone[],
  signal: AbortSignal,
  deps: CanadaMapDeps,
): CanadaMapHandle {
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
  let drawn = false;
  let fetching = false;
  let observer: IntersectionObserver | undefined;
  let resolveReady: () => void = () => {};
  const ready = new Promise<void>((resolve) => {
    resolveReady = resolve;
  });
  const panelHome = panel?.parentElement ?? null;

  // --- the list ------------------------------------------------------------
  for (const button of buttons) {
    const id = button.dataset.tzId ?? "";
    const zone = rows.get(id);
    const kind = q<HTMLElement>('[data-role="kind"]', button);
    const offset = q<HTMLElement>('[data-role="offset"]', button);
    if (kind) kind.textContent = classWords(id, zone);
    if (offset) {
      if (zone && zone.offset !== "") offset.textContent = zone.offset;
      else offset.innerHTML = NO_SIGNAL;
    }
    button.dataset.kind = displayKind(id, zone);
    const swatch = q<HTMLElement>('[data-role="swatch"]', button);
    if (swatch) swatch.dataset.kind = displayKind(id, zone);
  }

  // The legend's counts, from the zones the list holds.
  const counts = classCounts([...byId.keys()], rows);
  for (const [kind, count] of Object.entries(counts)) {
    const el = q<HTMLElement>(`[data-role="legend-count"][data-kind="${kind}"]`);
    if (el) el.textContent = String(count);
  }
  // One line above the live clocks when the server's data is older than tzdb 2026e.
  const notice = q<HTMLElement>('[data-role="clocks-notice"]');
  if (notice) notice.hidden = !isDataStale(zones);

  function setRoving(active: HTMLButtonElement | undefined): void {
    for (const button of buttons) button.tabIndex = button === active ? 0 : -1;
  }
  setRoving(buttons[0]);

  /**
   * Scrolls the list's own box, never the page, until `el` is in view. An element taller than the
   * box (a button with the narrow panel under it) lines its top edge up with the box's.
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
    for (const [key, shape] of shapes)
      shape.classList.toggle("is-active", key === id);
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
          : `Pinned ${pinnedId}. ${classWords(pinnedId, rows.get(pinnedId))}.`;
    }
    const rest = ["pin-time", "pin-offset", "pin-last", "pin-next", "pin-release"];
    const classEl = field("pin-class");
    if (pinnedId === null) {
      set("pin-zone", PIN_PLACEHOLDER);
      if (classEl) classEl.textContent = EMPTY;
      for (const role of rest) set(role, EMPTY);
      if (clock) clock.innerHTML = "";
      return;
    }
    set("pin-zone", pinnedId);
    if (classEl) {
      classEl.innerHTML =
        `<span class="gmt-canada-swatch gmt-theme-dark" data-kind="${displayKind(pinnedId, zone)}" aria-hidden="true"></span>` +
        escapeHtml(classWords(pinnedId, zone));
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
    set("pin-release", releaseWords(pinnedId!));
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
        id: "canada-pin",
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

  /** Narrow: the panel sits under the pressed button. Wide: it returns to its fixed place. */
  function placePanel(): void {
    if (!panel || !panelHome) return;
    const narrow = measure() < NARROW_PX;
    const button = pinnedId === null ? undefined : byId.get(pinnedId);
    if (narrow && button?.parentElement) {
      button.parentElement.append(panel);
      panel.hidden = false;
    } else {
      if (panel.parentElement !== panelHome) panelHome.append(panel);
      panel.hidden = narrow && pinnedId === null;
    }
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
    drawRing(pinRing, id);
    drawPanel();
    placePanel();
    tick();
    const button = byId.get(id);
    reveal(measure() < NARROW_PX ? button?.parentElement : button);
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
    group.setAttribute("class", `gmt-canada-ring gmt-canada-ring--${kind}`);
    group.setAttribute("aria-hidden", "true");
    for (const part of ["casing", "ink"]) {
      const path = document.createElementNS(SVG_NS, "path");
      path.setAttribute("class", `gmt-canada-ring-${part}`);
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

  // --- the shapes ----------------------------------------------------------
  function drawShapes(boundaries: BoundaryCollection): void {
    if (!frame || drawn) return;
    drawn = true;
    const projection = canadaProjection(boundaries);
    const path = geoPath(projection);
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("class", "gmt-canada-svg");
    svg.setAttribute("viewBox", `0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`);
    svg.setAttribute("role", "group");
    svg.setAttribute(
      "aria-label",
      "Map of Canada's time zones. The zone list holds the same zones.",
    );
    svg.setAttribute("focusable", "false");
    const next = new Map<string, SVGPathElement>();
    const stopped: SVGPathElement[] = [];
    for (const feature of boundaries.features) {
      const id = feature.properties.tzid;
      if (!byId.has(id)) continue;
      const d = path(feature as unknown as Parameters<typeof path>[0]);
      if (d === null) continue;
      const zone = rows.get(id);
      const shape = document.createElementNS(SVG_NS, "path");
      shape.setAttribute("d", d);
      shape.setAttribute("class", "gmt-canada-shape");
      shape.setAttribute("data-kind", displayKind(id, zone));
      shape.setAttribute("data-tz-id", id);
      shape.setAttribute("role", "button");
      shape.setAttribute("tabindex", "-1");
      shape.setAttribute("aria-pressed", "false");
      shape.setAttribute("aria-label", `${id}, ${classWords(id, zone)}`);
      next.set(id, shape);
      if (STOPPED_ZONES.has(id)) stopped.push(shape);
      else svg.append(shape);
    }
    // The zones that stop are drawn last, so no neighbour paints over any of their border.
    for (const shape of stopped) svg.append(shape);
    shapes = next;
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
    // The boundaries are the one third-party datum the map draws; the button sits on the drawing.
    watchDataCredits();
    frame.insertAdjacentHTML(
      "beforeend",
      renderDataCreditsHtml([TZ_BOUNDARIES], {
        id: frame.dataset.creditsId ?? "canada-data-credits",
        placement: "corner",
      }),
    );
    if (pinnedId !== null) pin(pinnedId, false);
  }

  async function loadShapes(): Promise<void> {
    if (drawn || fetching || signal.aborted || measure() < NARROW_PX) return;
    fetching = true;
    try {
      const response = await (deps.fetch ?? fetch)(withBase("/timezone-boundaries-canada.json"), {
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

  return { pin: (id) => pin(id), pinned: () => pinnedId, ready };
}

/** One list item, server-rendered from `canada-zones.json`. */
export function zoneListItemHtml(zone: string): string {
  const id = escapeAttr(zone);
  return (
    `<li class="gmt-canada-zone"><button type="button" class="gmt-canada-zone-btn" data-tz-id="${id}" aria-pressed="false">` +
    `<span class="gmt-canada-zone-id"><code>${escapeHtml(zone)}</code></span>` +
    `<span class="gmt-canada-zone-kind"><span class="gmt-canada-swatch gmt-theme-dark" data-role="swatch" data-kind="none" aria-hidden="true"></span><span data-role="kind">no answer yet</span></span>` +
    `<span class="gmt-canada-zone-offset" data-role="offset">${NO_SIGNAL}</span>` +
    `</button></li>`
  );
}
