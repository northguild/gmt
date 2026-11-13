/**
 * The zone map of a dated tz-change checker (CORE-88): one shape per IANA zone in one of three
 * classes, a zone list that pins the same zone by keyboard, and the pin panel.
 *
 * The drawing, the list's keys, the pin, the labels and the narrow fallback are `feature-map.ts`,
 * the one classed map the Sunshine Protection Act page draws with too. What is left here is the
 * checker: the stated classes, the stale rows, the tense view, the live clock and the release
 * words. `wireZoneMap` reads the zone list the page's template (`zoneMap`,
 * `widgets/families/clockcheck/zone-map.ts`) wrote, fills it from the Worker's `zones`, and hands
 * the rest to `wireFeatureMap` as a `FeatureMapConfig` keyed by `tzid`. Everything that belongs to
 * one checker (its ids, the boundary file, the projection, the stated classes) comes in as a
 * `ZoneMapConfig`. Every tag the script writes comes from a builder.
 */
import type { GeoProjection } from "d3-geo";
import { changeText, wallHms } from "./clock-change-common";
import type { Change } from "./clock-change-common";
import { updateCrystalClock } from "./crystal-clock";
import {
  COASTLINES,
  type DataCreditsPlacement,
  TZ_BOUNDARIES,
} from "./data-credits";
import { spokenOffset } from "./crossing-clock";
import type { TenseView } from "./clock-change-tense";
import { cityOf } from "./zone-map-labels";
import {
  MAP_WIDTH,
  isKeyedFeature,
  keyedOnly,
  largestPartPx,
  wireFeatureMap,
  type BoundaryCollection,
  type BoundaryFeature,
} from "./feature-map";
import { html, setHtml, type FoundWidget } from "~/widgets/builders";
import { noSignal, zoneId } from "~/widgets/families/clockcheck/marks";
import {
  EMPTY,
  PIN_PLACEHOLDER,
  classSwatch,
  zoneListParts,
  type PinField,
} from "~/widgets/families/clockcheck/zone-map";

export { MAP_WIDTH, PIN_PLACEHOLDER, largestPartPx };
export type { BoundaryCollection };

/** A boundary feature that is a zone: it has a `tzid`. The land feature has none. */
export function isZoneFeature(
  feature: BoundaryFeature,
): feature is BoundaryFeature & { properties: { tzid: string } } {
  return isKeyedFeature(feature, "tzid");
}

/** The collection without its land feature: what a projection fits to. */
export function zonesOnly(boundaries: BoundaryCollection): BoundaryCollection {
  return keyedOnly(boundaries, "tzid");
}

/** One zone's row in the Worker's answer. */
export interface MapZone {
  zone: string;
  offset: string;
  last: Change | null;
  next: Change | null;
  kind: "stopped" | "changes-after" | "none";
}

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
   * The words of each class. `id` is the zone the words are for, or `null` for the legend. The
   * view writes the dates.
   */
  classText: (
    kind: MapZone["kind"],
    id: string | null,
    view: TenseView,
  ) => string;
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

/** The class words of a zone, or "no data" when the server sent no row. */
export function classWords(
  config: ZoneMapConfig,
  id: string,
  zone: MapZone | undefined,
  view: TenseView,
): string {
  const kind = displayKind(config, id, zone);
  return kind === "no-data"
    ? "no data"
    : config.classText(kind as MapZone["kind"], id, view);
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
// Mount
// ---------------------------------------------------------------------------

export interface ZoneMapDeps {
  /** The dates in words. */
  tense: TenseView;
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
  /** Pins `id`; false when it is not in the list. */
  pin(id: string): boolean;
  /** The pinned zone id, or null. */
  pinned(): string | null;
  /** Resolves once the map's file has been fetched and drawn, or at once when it never will be. */
  ready: Promise<void>;
}

/** The fields of one list item the script fills. */
interface ZoneMapFields {
  kind: HTMLElement | null;
  offset: HTMLElement | null;
  swatch: HTMLElement | null;
}

/** The pin panel's readouts, and the announcement and the clock face's host. */
type PinPart = PinField | "announce" | "clock";

/**
 * Wires the zone map `zoneMap` wrote. `widget` is the page's widget (`findWidget`); the ids of the
 * map's parts come from its scope.
 */
export function wireZoneMap(
  widget: FoundWidget,
  zones: MapZone[],
  signal: AbortSignal,
  deps: ZoneMapDeps,
  config: ZoneMapConfig,
): ZoneMapHandle {
  const find = (local: string): HTMLElement | null =>
    widget.el.querySelector<HTMLElement>(
      `[id="${CSS.escape(widget.id(local))}"]`,
    );
  const list = widget.part<HTMLElement>("zone-list");
  const panel = widget.part<HTMLElement>("pin");
  const notice = find("clocks-notice");
  const clockId = `${config.idPrefix}-pin`;
  const buttons = [...list.querySelectorAll<HTMLButtonElement>("button")];
  const ids = buttons.map((button) => button.dataset["tzId"] ?? "");
  const fieldsOf = (index: number): ZoneMapFields => {
    const names = zoneListParts(index);
    return {
      kind: find(names.kind),
      offset: find(names.offset),
      swatch: find(names.swatch),
    };
  };
  const pinPart = (part: PinPart): HTMLElement | null => find(`pin-${part}`);
  const legendCounts = (kind: string): readonly HTMLElement[] => [
    ...widget.el.querySelectorAll<HTMLElement>(`[data-legend-count="${kind}"]`),
  ];

  const rows = new Map(zones.map((zone) => [zone.zone, zone]));
  let pinnedId: string | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;

  // --- the list ------------------------------------------------------------
  buttons.forEach((button, index) => {
    const id = button.dataset["tzId"] ?? "";
    const zone = rows.get(id);
    const kind = displayKind(config, id, zone);
    const fields = fieldsOf(index);
    if (fields.kind) {
      setHtml(fields.kind, html`${classWords(config, id, zone, deps.tense)}`);
    }
    if (fields.offset) {
      if (zone && zone.offset !== "") fields.offset.textContent = zone.offset;
      else setHtml(fields.offset, noSignal());
    }
    if (fields.swatch) fields.swatch.dataset["kind"] = kind;
  });

  // The legend's counts, from the zones the list holds.
  const counts = classCounts(config, ids, rows);
  for (const [kind, count] of Object.entries(counts)) {
    // One copy per form of a two-form legend phrase.
    for (const el of legendCounts(kind)) el.textContent = String(count);
  }
  // One line above the live clocks when the server's data is older than tzdb 2026e.
  if (notice) notice.hidden = !isDataStale(config.stopped, zones);

  // --- the panel -----------------------------------------------------------
  const rest: PinPart[] = ["time", "offset", "last", "next", "release"];
  const setText = (part: PinPart, value: string): void => {
    const el = pinPart(part);
    if (el) el.textContent = value;
  };
  const setMarkup = (part: PinPart, value: ReturnType<typeof html>): void => {
    const el = pinPart(part);
    if (el) setHtml(el, value);
  };

  function drawPanel(): void {
    if (!panel) return;
    const zone = pinnedId === null ? undefined : rows.get(pinnedId);
    const clock = pinPart("clock");
    setText(
      "announce",
      pinnedId === null
        ? ""
        : `Pinned ${pinnedId}. ${classWords(config, pinnedId, rows.get(pinnedId), deps.tense)}.`,
    );
    if (pinnedId === null) {
      setText("zone", PIN_PLACEHOLDER);
      setText("class", EMPTY);
      for (const part of rest) setText(part, EMPTY);
      if (clock) clock.replaceChildren();
      return;
    }
    setMarkup("zone", zoneId(pinnedId));
    setMarkup(
      "class",
      html`${classSwatch(displayKind(config, pinnedId, zone))}${classWords(config, pinnedId, zone, deps.tense)}`,
    );
    if (!zone) {
      for (const part of rest) setText(part, EMPTY);
      if (clock) clock.replaceChildren();
      return;
    }
    const at = deps.now();
    const offset = offsetAt(zone, at, deps.isBefore);
    const wall = offset === "" ? "" : deps.wall(at, offset);
    if (wall === "") {
      setMarkup("time", noSignal());
      setMarkup("offset", noSignal());
      if (clock) clock.replaceChildren();
    } else {
      drawTime(wall, offset);
    }
    setText("last", lastText(zone, deps.responseNow));
    setText("next", nextText(zone, deps.responseNow));
    setText("release", releaseWords(config, pinnedId));
  }

  /** The time and the face: the only parts that change every second. */
  function drawTime(wall: string, offset: string): void {
    setText("time", wallHms(wall));
    setText("offset", offsetWords(offset));
    const clock = pinPart("clock");
    if (clock && pinnedId !== null) {
      updateCrystalClock(clock, {
        id: clockId,
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

  function writeUrl(id: string): void {
    try {
      const url = new URL((deps.location ?? window.location).href);
      url.searchParams.set("zone", id);
      (deps.history ?? window.history).replaceState(null, "", url.toString());
    } catch {
      // A sandboxed frame may refuse replaceState; the pin still works.
    }
  }

  // --- the map: the shared core, configured as this checker ------------------
  const core = wireFeatureMap(widget, ids, signal, deps, {
    idPrefix: config.idPrefix,
    height: config.height,
    boundariesUrl: config.boundariesUrl,
    featureKey: "tzid",
    idKey: "tz",
    keyboard: "list",
    projection: config.projection,
    classOf: (id) => displayKind(config, id, rows.get(id)),
    nameOf: (id) => id,
    shapeLabel: (id) =>
      `${id}, ${classWords(config, id, rows.get(id), deps.tense)}`,
    labelOf: (id) => {
      const zone = rows.get(id);
      const offset = zone
        ? offsetAt(zone, deps.responseNow, deps.isBefore)
        : "";
      return { city: cityOf(id), offset: offset === "" ? null : offset };
    },
    // The zones that stop are drawn last, so no neighbour paints over any of their border.
    onTop: (id) => config.stopped.has(id),
    onPin: (id, user) => {
      pinnedId = id;
      drawPanel();
      tick();
      if (user && id !== null) writeUrl(id);
    },
    mapLabel: config.mapLabel,
    labelled: config.labelled,
    anchors: config.anchors,
    credits: [TZ_BOUNDARIES, COASTLINES],
    creditsCorner: config.creditsCorner,
    ...(config.markerMinPx === undefined
      ? {}
      : { markerMinPx: config.markerMinPx }),
    ...(config.markers === undefined ? {} : { markers: config.markers }),
  });

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
  if (fromUrl !== null) core.pin(fromUrl, { user: false });

  return {
    pin: (id) => core.pin(id),
    pinned: () => core.pinned(),
    ready: core.ready,
  };
}
