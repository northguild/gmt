/**
 * One classed map, keyed by any feature property (CORE-88, generalised in CORE-90): one shape per
 * feature in a class the page chooses, a list that pins the same feature by keyboard, and a pin
 * panel the page fills. The tz-change checkers (`zone-map.ts`, features keyed by `tzid`) and the
 * Sunshine Protection Act page (zones by `tzid`, states by `postal`) draw with it.
 *
 * Plain DOM, no React. The page's template (`zoneMap`, `widgets/families/clockcheck/zone-map.ts`)
 * writes the list and the panel, so both exist before this script runs; `wireFeatureMap` draws the
 * shapes when the section is wide enough and wires the pin. Everything that belongs to one page
 * (its ids, the boundary file, the projection, the class of a feature, the words) comes in as a
 * `FeatureMapConfig`. Every tag the script writes comes from a builder.
 *
 * **The keyboard path is the list, or the drawing (`keyboard`).** One roving tab stop (`roving`)
 * over one `<button>` per feature, or over the drawn shapes themselves: the arrow keys move (and
 * wrap), Home and End jump; Enter or Space pins. Either way the Tab key enters once and does not
 * walk dozens of features. On `"list"` the shapes are `role="button"` with `tabindex="-1"`, so only a
 * pointer reaches them. On `"shapes"` the page shows its list only where no map is drawn (narrow,
 * or the file failed), and the section's `data-map` (`drawn` or `failed`) says which.
 *
 * **The map is drawn at every width.** Below 520 px of section width the page also shows its list
 * under the map, as the easy tap and keyboard path, and a pin made there brings the panel into
 * view. The data-credits button belongs to the drawing, so it is added when the map is drawn. A
 * label's type stays 12px, so on a small frame the permanent labels that would meet one of higher
 * priority are hidden, and thinned again on every resize.
 *
 * Every timer, observer and listener is bound to the mount's `signal`, and `destroy()` aborts a
 * child of it. Nothing is drawn after an abort.
 */
import { geoPath } from "d3-geo";
import type { GeoPath, GeoProjection, GeoStreamWrapper } from "d3-geo";
import {
  renderDataCreditsHtml,
  type DataCredit,
  type DataCreditsPlacement,
  watchDataCredits,
} from "./data-credits";
import { enter } from "./enter";
import {
  clearLabels,
  nudgeInto,
  LABEL_HEIGHT_PX,
  labelSize,
  poleOfInaccessibility,
} from "./zone-map-labels";
import { html, setHtml, type FoundWidget } from "~/widgets/builders";
import {
  labelLayer,
  labelMarkup,
  framePath,
  mapDrawing,
  type FeatureIdKey,
} from "~/widgets/families/clockcheck/zone-map";
import { roving } from "~/widgets/primitives/roving";

/** The drawing's own coordinate box; the SVG scales to its container with `viewBox`. */
export const MAP_WIDTH = 800;
/** Below this width of the section the list shows under the map (CSS switches at the same width). */
export const NARROW_PX = 520;

// ---------------------------------------------------------------------------
// The boundary file
// ---------------------------------------------------------------------------

/**
 * A feature's shape, keyed by `tzid` (a zone) or `postal` (a state), or the one land feature
 * (`land: "other"`): the coastline's land that no feature covers, written first and drawn under
 * the rest.
 */
export interface BoundaryFeature {
  type: "Feature";
  properties: { tzid?: string; postal?: string; land?: string };
  geometry: { type: string; coordinates: unknown };
}

export interface BoundaryCollection {
  type: "FeatureCollection";
  features: BoundaryFeature[];
}

/** The id a feature carries under `key`, or `null` for the land feature and any without one. */
export function featureIdOf(
  feature: BoundaryFeature,
  key: string,
): string | null {
  const value = (feature.properties as Record<string, unknown>)[key];
  return typeof value === "string" ? value : null;
}

/** A boundary feature that has the property `key`. The land feature has none. */
export function isKeyedFeature<K extends "tzid" | "postal">(
  feature: BoundaryFeature,
  key: K,
): feature is BoundaryFeature & { properties: Record<K, string> } {
  return typeof feature.properties[key] === "string";
}

/** The collection without its land feature: what a projection fits to. */
export function keyedOnly(
  boundaries: BoundaryCollection,
  key: string,
): BoundaryCollection {
  return {
    ...boundaries,
    features: boundaries.features.filter((f) => featureIdOf(f, key) !== null),
  };
}

/** What a map needs of a projection: a point in, a point out, and a stream for `geoPath`. */
export type FeatureProjection = GeoStreamWrapper &
  ((coordinates: [number, number]) => [number, number] | null);

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface FeatureMapConfig {
  /** Ids, and the credits button's id `<idPrefix>-data-credits` unless the markup names one. */
  idPrefix: string;
  /** The drawing's box is `MAP_WIDTH` by this. */
  height: number;
  /** The boundary file, already through `withBase`. */
  boundariesUrl: string;
  /** The feature property that keys a shape: "tzid" or "postal". */
  featureKey: "tzid" | "postal";
  /** The attribute rows and shapes carry their id in: `feature` (`data-feature-id`) when unset. */
  idKey?: FeatureIdKey;
  /** Fits the boundaries to the box. */
  projection: (
    boundaries: BoundaryCollection,
    width: number,
    height: number,
  ) => GeoProjection | FeatureProjection;
  /** A second file drawn over the shapes, `aria-hidden` and not interactive (zone lines). */
  overlayUrl?: string;
  /**
   * Boxes to outline with a thin bevelled frame (inset frames), in drawing px, from the projection
   * the page fits, each with the features it holds. A press anywhere in a frame pins its first
   * feature, and the frame lights up while any of them is pinned. Each is `aria-hidden` and not
   * focusable: the list and the shapes are the keyboard path.
   */
  frames?: (projection: GeoProjection | FeatureProjection) => readonly {
    box: readonly [readonly [number, number], readonly [number, number]];
    ids: readonly string[];
  }[];
  /**
   * A part of one shape drawn over it in a hatch: the `overlayUrl` feature `feature` (a zone id),
   * clipped to the shape `within`. `aria-hidden` and not interactive.
   */
  hatch?: { feature: string; within: string };
  /** The class a feature is drawn in: a `data-kind` value the page's module styles. */
  classOf: (id: string) => string;
  /** Words for the list row and the pin title. */
  nameOf: (id: string) => string;
  /** The accessible name of a shape; `nameOf` when unset. */
  shapeLabel?: (id: string) => string;
  /**
   * What a place label says: its first line, and the second (`null` for the NO SIGNAL mark,
   * `undefined` for no second line). `nameOf` with no second line when unset.
   */
  labelOf?: (id: string) => {
    city: string;
    offset: string | null | undefined;
  };
  /** The features drawn last, so no neighbour paints over any of their border. */
  onTop?: (id: string) => boolean;
  /**
   * Called when a feature is pinned (`id`) or the pin is cleared (`null`). `user` is false for the
   * pin a page restores from its own link, so it need not write the link back.
   */
  onPin: (id: string | null, user: boolean) => void;
  /** Pressing the pinned feature's button or shape clears the pin. Off: it stays pinned. */
  toggle?: boolean;
  /**
   * The keyboard path once the map is drawn: the `list` of buttons, or the drawn `shapes`, one tab
   * stop over them in the list's order. The list stays the path wherever no map is drawn.
   */
  keyboard: "list" | "shapes";
  /** The map's accessible name. */
  mapLabel: string;
  /** The features that carry a permanent place label. */
  labelled: readonly string[];
  /** Where each permanent label sits, `[lon, lat]`, chosen inside the feature's land. */
  anchors: Readonly<Record<string, readonly [lon: number, lat: number]>>;
  /**
   * A label's own place in the drawing, in px, ahead of its `anchors` entry: a page whose cards
   * keep a band for their labels says where each sits. Unset or `null`: the anchor, or the pole.
   */
  labelAt?: (
    projection: GeoProjection | FeatureProjection,
    id: string,
  ) => readonly [number, number] | null;
  /** The data the drawing shows, credited on the button the drawing carries. */
  credits: readonly DataCredit[];
  /** The corner the credits button sits in: one the region's land leaves empty. */
  creditsCorner: Extract<DataCreditsPlacement, "corner" | "corner-start">;
  /**
   * A feature whose largest drawn part is under this many drawing px (both ways) also gets a ring
   * at its `markers` coordinate, so a pointer can reach a shape a few pixels wide. Unset: no rings.
   */
  markerMinPx?: number;
  /** The coordinate of each feature that may get a ring, `[lon, lat]`. */
  markers?: Readonly<Record<string, readonly [lon: number, lat: number]>>;
}

/** What the core takes from the page that mounts it. */
export interface FeatureMapDeps {
  /** The fetch for the boundary files. */
  fetch?: typeof fetch;
  /** The section's width in px. Defaults to a layout measure. */
  measure?: () => number;
}

export interface FeatureMapHandle {
  /**
   * Pins `id`, or clears the pin with `null`; false when `id` is not in the list. `user: false`
   * restores a pin from the page's own link: the page is told, and writes nothing back.
   */
  pin(id: string | null, options?: { user?: boolean }): boolean;
  /** The pinned feature id, or null. */
  pinned(): string | null;
  /** Resolves once the map's file has been fetched and drawn, or at once when it never will be. */
  ready: Promise<void>;
  /** Aborts every timer, observer and listener the map holds. */
  destroy(): void;
}

// ---------------------------------------------------------------------------
// Mount
// ---------------------------------------------------------------------------

const flag = (el: Element, on: boolean): void => {
  (el as HTMLElement | SVGElement).dataset["active"] = String(on);
};

/** The one element a builder writes. */
function elementOf(markup: ReturnType<typeof html>): HTMLElement {
  const host = document.createElement("div");
  setHtml(host, markup);
  return host.firstElementChild as HTMLElement;
}

/**
 * Wires the map `zoneMap` wrote. `widget` is the page's widget (`findWidget`); the ids of the map's
 * parts come from its scope. `ids` are the features of the list.
 */
export function wireFeatureMap(
  widget: FoundWidget,
  ids: readonly string[],
  signal: AbortSignal,
  deps: FeatureMapDeps,
  config: FeatureMapConfig,
): FeatureMapHandle {
  // A child of the mount's signal: `destroy()` aborts the map without ending the page.
  const own = new AbortController();
  if (signal.aborted) own.abort();
  else signal.addEventListener("abort", () => own.abort(), { once: true });
  const life = own.signal;

  const find = (local: string): HTMLElement | null =>
    widget.el.querySelector<HTMLElement>(
      `[id="${CSS.escape(widget.id(local))}"]`,
    );
  const section = find("section") ?? widget.el;
  const frame = widget.part<HTMLElement>("map");
  const list = widget.part<HTMLElement>("zone-list");
  const scroller = widget.part<HTMLElement>("zone-scroll");
  const panel = widget.part<HTMLElement>("pin");
  const svgId = widget.id("map-svg");
  const labelsId = widget.id("map-labels");
  const creditsId = widget.id("data-credits");

  const idKey = config.idKey ?? "feature";
  const dataKey = idKey === "tz" ? "tzId" : "featureId";
  const attr = idKey === "tz" ? "data-tz-id" : "data-feature-id";
  const wanted = new Set(ids);
  const buttons = [...list.querySelectorAll<HTMLButtonElement>("button")];
  const byId = new Map(
    buttons
      .map((button) => [button.dataset[dataKey] ?? "", button] as const)
      .filter(([id]) => wanted.has(id)),
  );
  const measure = deps.measure ?? (() => section.getBoundingClientRect().width);
  const nameOf = config.shapeLabel ?? config.nameOf;

  let pinnedId: string | null = null;
  let shapes = new Map<string, SVGElement>();
  let rings = new Map<string, SVGElement>();
  let drawn = false;
  let fetching = false;
  // The place labels: an overlay on the drawing, one element per feature shown so far.
  let hoverId: string | null = null;
  // The roving stop over the drawn shapes, on `keyboard: "shapes"`, once they are drawn.
  let shapeStop: ReturnType<typeof roving> | null = null;
  /** The shape the keyboard reaches for `id`: its outline, or its marker when it has none. */
  const shapeOf = (id: string): SVGElement | undefined =>
    shapes.get(id) ?? rings.get(id);
  const keyShapes = (): HTMLElement[] =>
    ids.flatMap((id) => {
      const shape = shapeOf(id);
      return shape ? [shape as unknown as HTMLElement] : [];
    });
  let layer: HTMLElement | null = null;
  let labelAnchor: (id: string) => readonly [number, number] | null = () =>
    null;
  const labels = new Map<string, HTMLElement>();
  /** Thins the labels again when the frame or a label's text changes size (a font, an offset). */
  let labelWatch: ResizeObserver | undefined;
  let observer: IntersectionObserver | undefined;
  let resolveReady: () => void = () => {};
  const ready = new Promise<void>((resolve) => {
    resolveReady = resolve;
  });

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

  // --- the list ------------------------------------------------------------
  // The APG roving tab stop: arrows wrap, Home and End jump, the stop follows focus and a click.
  const stop = roving(list, { items: () => buttons, signal: life });
  list.addEventListener(
    "focusin",
    (event) => {
      reveal((event.target as HTMLElement).closest<HTMLElement>("button"));
    },
    { signal: life },
  );
  list.addEventListener(
    "click",
    (event) => {
      const target = (event.target as HTMLElement).closest<HTMLButtonElement>(
        "button",
      );
      if (target) {
        stop.set(target);
        press(target.dataset[dataKey] ?? "");
      }
    },
    { signal: life },
  );

  /** A press: pins the feature, or clears the pin when `toggle` and it is the pinned one. */
  function press(id: string): void {
    pin(config.toggle === true && id === pinnedId ? null : id);
  }

  // --- hover and focus mirror between the list and the shapes ---------------
  function mirror(id: string | null): void {
    hoverId = id;
    refreshLabels();
    for (const [key, marker] of rings) flag(marker, key === id);
    drawRing(hoverRing, id);
    for (const [key, button] of byId) flag(button, key === id);
  }
  const idOf = (target: EventTarget | null): string | null =>
    (target as HTMLElement | null)?.closest?.<HTMLElement>(`[${attr}]`)
      ?.dataset[dataKey] ?? null;
  for (const host of [list, frame]) {
    host?.addEventListener("pointerover", (e) => mirror(idOf(e.target)), {
      signal: life,
    });
    host?.addEventListener("pointerout", () => mirror(null), { signal: life });
    host?.addEventListener("focusin", (e) => mirror(idOf(e.target)), {
      signal: life,
    });
    host?.addEventListener("focusout", () => mirror(null), { signal: life });
  }

  // A press in an inset's frame, off its shapes, pins the frame's first feature: a pointer
  // convenience, for shapes too small to hit. The frame is not focusable.
  frame?.addEventListener(
    "click",
    (event) => {
      const target = event.target as Element;
      if (target.closest?.(`[${attr}]`)) return;
      const first = (
        target.closest?.<SVGElement>("[data-frame-ids]")?.dataset["frameIds"] ??
        ""
      ).split(" ")[0];
      if (first) press(first);
    },
    { signal: life },
  );

  /**
   * The panel stays in its own place, below the list's box, at every width: inside the box it
   * would be taller than the box and scroll with the list. Narrow, the style sheet hides it until
   * a feature is pinned (`data-pinned`); the section has no map to fill that space.
   */
  function placePanel(): void {
    if (panel) panel.dataset["pinned"] = String(pinnedId !== null);
  }

  function pin(id: string | null, user = true): boolean {
    if (id !== null && !byId.has(id)) return false;
    pinnedId = id;
    for (const [key, button] of byId)
      button.setAttribute("aria-pressed", String(key === id));
    for (const group of [shapes, rings]) {
      for (const [key, el] of group) {
        el.setAttribute("aria-pressed", String(key === id));
        (el as SVGElement).dataset["pinned"] = String(key === id);
      }
    }
    for (const inset of frame?.querySelectorAll<SVGElement>(
      "[data-frame-ids]",
    ) ?? [])
      inset.dataset["pinned"] = String(
        id !== null &&
          (inset.dataset["frameIds"] ?? "").split(" ").includes(id),
      );
    drawRing(pinRing, id);
    refreshLabels();
    placePanel();
    config.onPin(id, user);
    if (id === null) return true;
    const button = byId.get(id);
    stop.set(button!);
    reveal(button);
    const shape = shapeOf(id);
    if (shapeStop && shape) shapeStop.set(shape as unknown as HTMLElement);
    // Narrow, the panel may sit below the list, off screen: bring it into view when the reader pins
    // (not when the page loads on a link).
    if (user && measure() < NARROW_PX)
      panel?.scrollIntoView?.({ block: "nearest" });
    return true;
  }

  // --- the rings -----------------------------------------------------------
  // Hover and pin are drawn as paths on top of every shape, so a neighbour never paints over half
  // of the line. Each ring is a night casing under an ink line, the globe's own overlay rule: the
  // ink only has to clear the casing, whatever fill lies beneath.
  let hoverRing: SVGElement | null = null;
  let pinRing: SVGElement | null = null;
  function drawRing(ring: SVGElement | null, id: string | null): void {
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

  // --- the labels ------------------------------------------------------------
  /** One label. The text is `aria-hidden`: each shape already has its `aria-label`. */
  function makeLabel(id: string, at: readonly [number, number]): HTMLElement {
    const said = config.labelOf?.(id) ?? {
      city: config.nameOf(id),
      offset: undefined,
    };
    const size = labelSize(
      said.city,
      said.offset === undefined ? "" : said.offset,
    );
    return elementOf(
      labelMarkup({
        zone: id,
        city: said.city,
        offset: said.offset,
        ax: `${((at[0] / MAP_WIDTH) * 100).toFixed(2)}%`,
        ay: `${((at[1] / config.height) * 100).toFixed(2)}%`,
        width: size.width,
        height: LABEL_HEIGHT_PX,
      }),
    );
  }

  /** Shows the permanent labels, the hovered or focused feature's, and the pinned one's. */
  function refreshLabels(): void {
    if (!layer) return;
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
        layer.append(label);
        for (const part of label.children) labelWatch?.observe(part);
      }
      label.hidden = false;
      label.dataset["passing"] = String(!permanent.has(id));
    }
    for (const [id, label] of labels) if (!want.has(id)) label.hidden = true;
    thinLabels();
  }

  /**
   * On a frame too small for every label, hides the permanent ones that would meet a label of
   * higher priority (the pinned and the hovered first, then `labelled` in its order) or cross the
   * edge of their inset's card. A crowded label keeps its box (`visibility`), so the next measure
   * still finds it. A label with no parts measures as no size, and so hides nothing.
   */
  function thinLabels(): void {
    const order = [...new Set([pinnedId, hoverId, ...config.labelled])].flatMap(
      (id) => {
        const label = id === null ? undefined : labels.get(id);
        return label && !label.hidden ? [label] : [];
      },
    );
    const cards = [
      ...(frame?.querySelectorAll<SVGElement>("[data-frame-ids]") ?? []),
    ].map((card) => ({
      ids: (card.dataset["frameIds"] ?? "").split(" "),
      box: card.getBoundingClientRect(),
    }));
    // The text's own boxes, not the label's: the label reserves an upper bound of its width.
    const shown = clearLabels(
      order.map((label) => {
        const parts = [...label.children].map((part) =>
          part.getBoundingClientRect(),
        );
        const id = label.dataset["labelFor"] ?? "";
        // Where the text sits with no nudge: the last one is taken back out.
        const was = (name: string) =>
          Number.parseFloat(label.style.getPropertyValue(name)) || 0;
        const [px, py] = [was("--nx"), was("--ny")];
        const box = {
          left: Math.min(...parts.map((r) => r.left)) - px,
          top: Math.min(...parts.map((r) => r.top)) - py,
          right: Math.max(...parts.map((r) => r.right)) - px,
          bottom: Math.max(...parts.map((r) => r.bottom)) - py,
        };
        const within = cards.find((card) => card.ids.includes(id))?.box;
        // In an inset, the label is pushed inside its card when its text fits there.
        const sized = box.right > box.left && box.bottom > box.top;
        const { dx, dy } = (within && sized && nudgeInto(box, within)) || {
          dx: 0,
          dy: 0,
        };
        label.style.setProperty("--nx", `${dx}px`);
        label.style.setProperty("--ny", `${dy}px`);
        return {
          left: box.left + dx,
          top: box.top + dy,
          right: box.right + dx,
          bottom: box.bottom + dy,
          within,
        };
      }),
    );
    order.forEach((label, i) => {
      label.dataset["crowded"] = String(
        !shown[i] && label.dataset["passing"] !== "true",
      );
    });
  }

  // --- the shapes ----------------------------------------------------------
  /**
   * A ring at the coordinate of each feature whose largest drawn part is under `markerMinPx`. The
   * test is on the largest part, not the whole shape: `Africa/Ceuta` is two specks (Ceuta and
   * Melilla) that span far more than the threshold together.
   */
  function markersOf(
    boundaries: BoundaryCollection,
    path: GeoPath,
    projection: FeatureProjection,
    drawnIds: ReadonlySet<string>,
  ) {
    const made: Parameters<typeof mapDrawing>[0]["markers"][number][] = [];
    const minPx = config.markerMinPx;
    if (minPx === undefined || !config.markers) return made;
    for (const feature of boundaries.features) {
      const id = featureIdOf(feature, config.featureKey);
      if (id === null) continue;
      const at = config.markers[id];
      if (!byId.has(id) || !at || !drawnIds.has(id)) continue;
      if (largestPartPx(feature, path) >= minPx) continue;
      const point = projection([at[0], at[1]]);
      if (!point) continue;
      made.push({
        id,
        cx: point[0],
        cy: point[1],
        r: minPx / 2,
        kind: config.classOf(id),
        label: nameOf(id),
      });
    }
    return made;
  }

  function drawShapes(
    boundaries: BoundaryCollection,
    overlay: BoundaryCollection | null,
  ): void {
    if (!frame || drawn || life.aborted) return;
    drawn = true;
    const projection = config.projection(
      boundaries,
      MAP_WIDTH,
      config.height,
    ) as FeatureProjection;
    const path = geoPath(projection);
    const pathOf = (feature: BoundaryFeature): string | null =>
      path(feature as unknown as Parameters<typeof path>[0]);
    // The land no feature covers is drawn first, under every shape: a decoration, not a feature. It
    // is not a shape, takes no pointer and is hidden from assistive technology.
    const land: string[] = [];
    for (const feature of boundaries.features) {
      if (feature.properties.land === undefined) continue;
      const d = pathOf(feature);
      if (d !== null) land.push(d);
    }
    const plain: Parameters<typeof mapDrawing>[0]["shapes"][number][] = [];
    const top: typeof plain = [];
    for (const feature of boundaries.features) {
      const id = featureIdOf(feature, config.featureKey);
      if (id === null || !byId.has(id)) continue;
      const d = pathOf(feature);
      if (d === null) continue;
      const shape = { id, d, kind: config.classOf(id), label: nameOf(id) };
      (config.onTop?.(id) === true ? top : plain).push(shape);
    }
    // The features that stand out are drawn last, so no neighbour paints over any of their border.
    const ordered = [...plain, ...top];
    const lines: string[] = [];
    for (const feature of overlay?.features ?? []) {
      const d = pathOf(feature);
      if (d !== null) lines.push(d);
    }
    const within = ordered.find((shape) => shape.id === config.hatch?.within);
    const hatched = overlay?.features.find(
      (feature) => featureIdOf(feature, "tzid") === config.hatch?.feature,
    );
    const hatchD = hatched === undefined ? null : pathOf(hatched);
    setHtml(
      frame,
      html`${mapDrawing({
        id: svgId,
        frames: (config.frames?.(projection) ?? []).map((inset) => ({
          d: framePath(inset.box),
          ids: inset.ids.filter((id) => byId.has(id)),
        })),
        hatch:
          within === undefined || hatchD === null
            ? undefined
            : { d: hatchD, clipD: within.d },
        width: MAP_WIDTH,
        height: config.height,
        label: config.mapLabel,
        land,
        shapes: ordered,
        markers: markersOf(
          boundaries,
          path,
          projection,
          new Set(ordered.map((shape) => shape.id)),
        ),
        overlay: lines,
        idKey,
      })}${labelLayer(labelsId)}`,
    );
    const inFrame = (id: string): HTMLElement | null =>
      frame.querySelector<HTMLElement>(`[id="${CSS.escape(id)}"]`);
    const svg = inFrame(svgId) as SVGSVGElement | null;
    if (!svg) return;
    const next = new Map<string, SVGElement>();
    const markers = new Map<string, SVGElement>();
    for (const el of svg.querySelectorAll<SVGElement>(`[${attr}]`)) {
      const id = el.dataset[dataKey] ?? "";
      (el.tagName.toLowerCase() === "path" ? next : markers).set(id, el);
    }
    shapes = next;
    rings = markers;
    hoverRing = svg.querySelector<SVGElement>('[data-ring="hover"]');
    pinRing = svg.querySelector<SVGElement>('[data-ring="pin"]');
    svg.addEventListener(
      "click",
      (event) => {
        const id = idOf(event.target);
        if (id !== null) press(id);
      },
      { signal: life },
    );
    svg.addEventListener(
      "keydown",
      (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        const id = idOf(event.target);
        if (id === null) return;
        event.preventDefault();
        press(id);
      },
      { signal: life },
    );
    if (config.keyboard === "shapes")
      shapeStop = roving(svg as unknown as HTMLElement, {
        items: keyShapes,
        signal: life,
      });
    section.dataset["map"] = "drawn";
    // The labels sit over the drawing in their own layer, so they take no pointer and move nothing.
    layer = inFrame(labelsId);
    const features = new Map(
      boundaries.features.flatMap((f) => {
        const id = featureIdOf(f, config.featureKey);
        return id === null ? [] : [[id, f] as const];
      }),
    );
    const poles = new Map<string, readonly [number, number] | null>();
    labelAnchor = (id) => {
      const fixed = config.labelAt?.(projection, id);
      if (fixed) return fixed;
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
    // The frame scales with the page while a label's type does not, and a label's text changes
    // width when its face loads or its offset arrives: thin again on each.
    if (typeof ResizeObserver === "function") {
      const watch = new ResizeObserver(() => thinLabels());
      watch.observe(layer ?? frame);
      labelWatch = watch;
      life.addEventListener("abort", () => watch.disconnect(), { once: true });
    }
    refreshLabels();
    // The boundaries are the one third-party datum the map draws; the button sits on the drawing.
    watchDataCredits();
    frame.insertAdjacentHTML(
      "beforeend",
      renderDataCreditsHtml([...config.credits], {
        id: creditsId,
        placement: config.creditsCorner,
      }),
    );
    if (pinnedId !== null) pin(pinnedId, false);
    // The site's arrival gesture, as the globe plays it. The stage keeps its own aspect-ratio box
    // and its sea fill, so only the drawing fades in; nothing around it moves. Last, so a pinned
    // feature's panel is placed from the drawing at rest. The inset cards scale with the drawing
    // while the labels do not, and a transform resizes nothing: thin again once it is at rest.
    enter(svg, { signal: life, onEntered: () => thinLabels() });
  }

  /** One boundary file, or `null` when it is missing or not a collection. */
  async function fetchFile(url: string): Promise<BoundaryCollection | null> {
    const response = await (deps.fetch ?? fetch)(url, { signal: life });
    if (!response.ok) return null;
    return (await response.json()) as BoundaryCollection;
  }

  async function loadShapes(): Promise<void> {
    if (drawn || fetching || life.aborted) return;
    fetching = true;
    try {
      const [boundaries, overlay] = await Promise.all([
        fetchFile(config.boundariesUrl),
        config.overlayUrl === undefined
          ? Promise.resolve(null)
          : // A missing overlay is a missing decoration, never a missing map.
            fetchFile(config.overlayUrl).catch(() => null),
      ]);
      if (boundaries && !life.aborted) drawShapes(boundaries, overlay);
      else if (!boundaries) section.dataset["map"] = "failed";
    } catch {
      // The list is the complete path; a missing map is not an error to show.
      if (!life.aborted) section.dataset["map"] = "failed";
    } finally {
      fetching = false;
      resolveReady();
    }
  }

  // --- lazy load and resize ------------------------------------------------
  function arm(): void {
    if (drawn || fetching || life.aborted) return;
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
  life.addEventListener("abort", () => observer?.disconnect(), { once: true });
  life.addEventListener("abort", () => resolveReady(), { once: true });

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
    life.addEventListener(
      "abort",
      () => {
        cancelAnimationFrame(frameId);
        resize.disconnect();
      },
      { once: true },
    );
  }

  // --- start ---------------------------------------------------------------
  placePanel();
  arm();

  return {
    pin: (id, options) => pin(id, options?.user ?? true),
    pinned: () => pinnedId,
    ready,
    destroy: () => own.abort(),
  };
}

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

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
function largestProjectedPart(
  feature: BoundaryFeature,
  projection: FeatureProjection,
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
