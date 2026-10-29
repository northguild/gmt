/**
 * zoneMap: the map section of a dated tz-change checker (CORE-88).
 *
 * One grid of three cards: the map (a stage with its legend), the zone list (a scroll region of
 * one `<button>` per zone) and the live clocks, with the pin panel across the row below. The
 * server writes the list and the panel; `wireZoneMap` (`lib/zone-map.ts`) fills them from the
 * Worker's answer, draws the shapes when the section is wide enough, and wires the pin.
 *
 * The drawing builders (`mapDrawing`, `labelLayer`, `labelMarkup`) write the SVG and the labels
 * the mount draws once the boundary file has arrived, so the mount never types a tag.
 *
 * State the mount sets is a `data-*` attribute: `data-active` (hovered or focused, mirrored
 * between the list and the shapes), `data-pinned` (on the pin panel and a pinned shape) and
 * `data-passing` (a label shown for a moment). A zone's class is `data-kind`.
 */
import { gateAttr } from "../../builders/gate";
import { html, type HtmlValue, type SafeHtml } from "../../builders/html";
import { idScope } from "../../builders/ids";
import { noSignal, zoneId } from "./marks";
import styles from "./zone-map.module.css";

/** What the pin panel says before a zone is pinned. */
export const PIN_PLACEHOLDER = "Press a zone to pin it.";
/** What an empty readout shows before a zone is pinned: a dash, never a blank. */
export const EMPTY = "—";
/** The words a zone with no row from the server carries. */
export const NO_ANSWER = "no answer yet";

export type ZoneClass = "stopped" | "changes-after" | "none";

/** The three classes, in the order the legend lists them. */
export const ZONE_CLASSES: readonly ZoneClass[] = [
  "stopped",
  "changes-after",
  "none",
];

// ---------------------------------------------------------------------------
// The pieces of the lists and the panel
// ---------------------------------------------------------------------------

/**
 * The swatch of a class: the same flat fill and stroke the map draws, on a dark island so it reads
 * the same in both themes. It is a picture; the class is always said in words beside it.
 */
export function classSwatch(kind: string, id?: string): SafeHtml {
  return html`<span
    class="${styles.swatch} gmt-theme-dark"
    ${id === undefined ? "" : html`id="${id}"`}
    data-kind="${kind}"
    aria-hidden="true"
  ></span>`;
}

/** The count a legend line states for a class. One per form of a two-form phrase. */
export function legendCount(kind: ZoneClass): SafeHtml {
  return html`<span data-legend-count="${kind}">${EMPTY}</span>`;
}

export interface LegendItem {
  kind: ZoneClass;
  /** The class words, the count already inside them (`legendCount`). */
  text: HtmlValue;
}

/** The legend: a swatch and the words of each class. */
export function zoneLegend(
  idPrefix: string,
  items: readonly LegendItem[],
): SafeHtml {
  const id = idScope(idPrefix);
  return html`<ul class="${styles.legend}" id="${id("legend")}" aria-label="Map classes">
    ${items.map(
      (item) =>
        html`<li class="${styles.legendItem}">${classSwatch(item.kind)}<span>${item.text}</span></li>`,
    )}
  </ul>`;
}

export interface ZoneListItemOptions {
  idPrefix: string;
  /** Position in the list: the ids of the fields the mount fills. */
  index: number;
  zone: string;
}

/** One list item: the zone id, its offset and its class, in a button that pins the zone. */
export function zoneListItem(options: ZoneListItemOptions): SafeHtml {
  const id = idScope(options.idPrefix);
  const parts = zoneListParts(options.index);
  return html`<li class="${styles.zone}">
    <button
      type="button"
      class="${styles.zoneButton}"
      data-tz-id="${options.zone}"
      aria-pressed="false"
    >
      <span class="${styles.zoneId}"><code>${zoneId(options.zone)}</code></span>
      <span class="${styles.zoneKind}"
        >${classSwatch("no-data", id(parts.swatch))}<span id="${id(parts.kind)}">${NO_ANSWER}</span></span
      >
      <span class="${styles.zoneOffset}" id="${id(parts.offset)}">${noSignal()}</span>
    </button>
  </li>`;
}

/** The local part names of a list item's fields (`findWidget(...).id(name)`), for the mount. */
export function zoneListParts(index: number): {
  swatch: string;
  kind: string;
  offset: string;
} {
  return {
    swatch: `zone-${index}-swatch`,
    kind: `zone-${index}-kind`,
    offset: `zone-${index}-offset`,
  };
}

/** The readouts of the pin panel, by the local id the mount reads them by. */
export const PIN_FIELDS = [
  "zone",
  "class",
  "time",
  "offset",
  "last",
  "next",
  "release",
] as const;
export type PinField = (typeof PIN_FIELDS)[number];

/**
 * The pin panel: the clock beside the zone and its class, and five readouts. One announcement says
 * the pin (a polite status); the ticking time is plain text outside any live region.
 */
export function pinPanel(idPrefix: string): SafeHtml {
  const id = idScope(`${idPrefix}-pin`);
  const title = (
    field: PinField,
    label: string,
    text: HtmlValue,
    className: string,
    gate: string,
  ) =>
    html`<div class="${styles.pinTitleRow}">
      <dt class="gmt-sr-only">${label}</dt>
      <dd id="${id(field)}" class="${className}" ${gateAttr(gate)}>${text}</dd>
    </div>`;
  const row = (field: PinField, label: string, wide = false) =>
    html`<div class="${wide ? styles.pinRowWide : styles.pinRow}">
      <dt>${label}</dt>
      <dd id="${id(field)}" ${gateAttr("pin-cell")}>${EMPTY}</dd>
    </div>`;
  return html`<p class="gmt-sr-only" id="${id("announce")}" role="status"></p>
    <div class="${styles.pinHead}">
      <div class="${styles.pinClock}" id="${id("clock")}" aria-hidden="true"></div>
      <dl class="${styles.pinTitle}">
        ${title("zone", "Zone", PIN_PLACEHOLDER, styles.pinZone, "pin-cell pin-zone")}
        ${title("class", "Class", EMPTY, styles.pinClass, "pin-cell")}
      </dl>
    </div>
    <dl class="${styles.pinRows}">
      ${row("time", "Local time")} ${row("offset", "UTC offset")}
      ${row("last", "Last change", true)} ${row("next", "Next change", true)}
      ${row("release", "Recorded in", true)}
    </dl>`;
}

// ---------------------------------------------------------------------------
// The section
// ---------------------------------------------------------------------------

export interface ZoneMapOptions {
  idPrefix: string;
  /** The zones of the list, in reading order. */
  zones: readonly string[];
  /** The scroll region's accessible name: `Canada time zones, scrollable list`. */
  listLabel: string;
  /** The drawing's box is 800 by this; the stage reserves it before the map draws. */
  mapHeight: number;
  /** The legend (`zoneLegend`), under the map. */
  legend: SafeHtml;
  /** The live-clocks card, placed beside the zone list. */
  clocks: SafeHtml;
}

/**
 * The map section. Ids: `<prefix>-map` (the frame the drawing goes in), `-zone-list`, `-pin-*`,
 * and the card titles `-map-title` and `-pick-title`. The clocks card brings its own.
 */
export function zoneMap(options: ZoneMapOptions): SafeHtml {
  const id = idScope(options.idPrefix);
  const items = options.zones.map((zone, index) =>
    zoneListItem({ idPrefix: options.idPrefix, index, zone }),
  );
  return html`<div
    class="${styles.section}"
    id="${id("section")}"
    ${gateAttr("map-section")}
    style="--zonemap-map-height: ${options.mapHeight}"
  >
    <section class="${styles.stage}" ${gateAttr("map-stage")}>
      <div
        class="${styles.block}"
        ${gateAttr("map-block")}
        role="group"
        aria-labelledby="${id("map-title")}"
      >
        <h4 id="${id("map-title")}">Zones on the map</h4>
        <div class="${styles.map} gmt-theme-dark" id="${id("map")}" ${gateAttr("map-frame")}></div>
        ${options.legend}
      </div>
    </section>
    <section
      class="${styles.pickCard}"
      ${gateAttr("pickcard")}
      aria-labelledby="${id("pick-title")}"
    >
      <h4 id="${id("pick-title")}">Pick a zone</h4>
      <p class="${styles.hint}">
        Each zone is in one class. Press a zone, on the map or in the list, to pin its clock and its
        last and next change.
      </p>
      <div class="${styles.pick}">
        <div class="${styles.zoneFrame}">
          <div
            class="${styles.zoneScroll}"
            id="${id("zone-scroll")}"
            role="region"
            aria-label="${options.listLabel}"
            tabindex="0"
          >
            <ul class="${styles.zoneList}" id="${id("zone-list")}" aria-label="Zones">
              ${items}
            </ul>
          </div>
        </div>
      </div>
    </section>
    <div
      class="${styles.pin}"
      id="${id("pin")}"
      data-pinned="false"
      ${gateAttr("map-pin")}
    >
      ${pinPanel(options.idPrefix)}
    </div>
    <div class="${styles.clocksSlot}">${options.clocks}</div>
  </div>`;
}

// ---------------------------------------------------------------------------
// The drawing
// ---------------------------------------------------------------------------

export interface DrawnShape {
  id: string;
  /** The path's `d`. */
  d: string;
  kind: string;
  /** `<id>, <class words>`: the shape's accessible name. */
  label: string;
}

export interface DrawnMarker {
  id: string;
  cx: number;
  cy: number;
  r: number;
  kind: string;
  label: string;
}

export interface MapDrawingOptions {
  /** The svg's id, so the mount finds it. */
  id: string;
  width: number;
  height: number;
  /** The map's accessible name. */
  label: string;
  /** The land no zone covers, as path data, drawn first. */
  land: readonly string[];
  /** Every shape, with the stopped ones last so no neighbour paints over any of their border. */
  shapes: readonly DrawnShape[];
  markers: readonly DrawnMarker[];
}

const ring = (kind: "hover" | "pin"): SafeHtml =>
  html`<g class="${styles.ring}" data-ring="${kind}" aria-hidden="true" visibility="hidden">
    <path class="${styles.ringCasing}"></path>
    <path class="${styles.ringInk}"></path>
  </g>`;

/**
 * The SVG: the land, one `role="button"` path per zone (`tabindex="-1"`, so a pointer reaches it and
 * the Tab key does not walk 23 of them), a ring for each small zone, and the hover and pin rings on
 * top. The zone list is the keyboard path.
 */
export function mapDrawing(options: MapDrawingOptions): SafeHtml {
  return html`<svg
    class="${styles.svg}"
    id="${options.id}"
    ${gateAttr("map-svg")}
    viewBox="0 0 ${options.width} ${options.height}"
    role="group"
    aria-label="${options.label}"
    focusable="false"
  >
    ${options.land.map(
      (d) =>
        html`<path class="${styles.land}" d="${d}" aria-hidden="true"></path>`,
    )}
    ${options.shapes.map(
      (shape) =>
        html`<path
          class="${styles.shape}"
          ${gateAttr("map-shape")}
          d="${shape.d}"
          data-kind="${shape.kind}"
          data-tz-id="${shape.id}"
          role="button"
          tabindex="-1"
          aria-pressed="false"
          aria-label="${shape.label}"
        ></path>`,
    )}
    ${options.markers.map(
      (marker) =>
        html`<circle
          class="${styles.marker}"
          cx="${marker.cx.toFixed(1)}"
          cy="${marker.cy.toFixed(1)}"
          r="${marker.r}"
          data-kind="${marker.kind}"
          data-tz-id="${marker.id}"
          role="button"
          tabindex="-1"
          aria-pressed="false"
          aria-label="${marker.label}"
        ></circle>`,
    )}
    ${ring("hover")} ${ring("pin")}
  </svg>`;
}

/** The layer the place labels sit in: over the drawing, taking no pointer. */
export function labelLayer(id: string): SafeHtml {
  return html`<div class="${styles.labels}" id="${id}" aria-hidden="true"></div>`;
}

export interface LabelOptions {
  zone: string;
  city: string;
  /** The offset the list shows, or `null` for the NO SIGNAL mark. */
  offset: string | null;
  /** The anchor as a share of the frame, in percent. */
  ax: string;
  ay: string;
  /** The reserved size, in CSS px. */
  width: number;
  height: number;
}

/**
 * One label: the city, and under it the offset the zone list shows. It is `aria-hidden`: each
 * shape already has its name.
 */
export function labelMarkup(options: LabelOptions): SafeHtml {
  return html`<div
    class="${styles.label}"
    ${gateAttr("map-label")}
    data-label-for="${options.zone}"
    aria-hidden="true"
    style="--ax: ${options.ax}; --ay: ${options.ay}; --lw: ${options.width}px; --lh: ${options.height}px"
  >
    <span class="${styles.labelCity}">${options.city}</span>
    <span class="${styles.labelOffset}"
      >${options.offset === null ? noSignal() : options.offset}</span
    >
  </div>`;
}
