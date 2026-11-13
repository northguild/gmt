/**
 * usMap: the wide map section of the Sunshine Protection Act page (CORE-90).
 *
 * Each view is one section: the map and its legend, with the pin panel beside it from 62rem
 * (below it when narrower). Once the map is drawn, its shapes are the keyboard path
 * (`keyboard: "shapes"`), so the place list is shown only where no map is drawn: below 520px, or
 * when the boundary file failed. The drawing's height is reserved from the composite
 * projection's aspect before the boundary file arrives.
 *
 * It reuses the checker's map CSS Module (`zone-map.module.css`) for the stage, the list rows, the
 * pin shell and the swatches, and adds the classes the US page needs. The checkers' own builder
 * (`zone-map.ts`) is not touched, so their markup is unchanged. The drawing and the labels are
 * `mapDrawing` and `labelLayer`, written by `wireFeatureMap` once the file has arrived.
 *
 * Part ids (`findWidget`-style, within a view's scope): `section`, `map`, `zone-list`,
 * `zone-scroll`, `pin`, `pin-announce`, `pin-name`, `pin-swatch`, `pin-class`, `pin-<field>`,
 * `row-<i>-swatch`, `row-<i>-kind`, `legend-<kind>`.
 */
import { gateAttr } from "../../builders/gate";
import { html, type HtmlValue, type SafeHtml } from "../../builders/html";
import { idScope } from "../../builders/ids";
import { zoneId } from "./marks";
import { classSwatch, EMPTY } from "./zone-map";
import styles from "./zone-map.module.css";

/** One row of a view's list: the feature it pins and the words it shows. */
export interface UsListItem {
  /** A zone id or a postal code. */
  id: string;
  /** The words of the row. A zone shows its id as code; a state its name. */
  name: string;
  /** The class the row starts in. */
  kind: string;
  /** The class words the row starts with. */
  words: string;
}

/** The part names of a row's fields, for the mount. */
export const usRowParts = (index: number) => ({
  swatch: `row-${index}-swatch`,
  kind: `row-${index}-kind`,
});

export interface UsLegendItem {
  kind: string;
  text: string;
  /** The count the legend states, or `null` until the answer has one. */
  count: number | null;
  /** A line with no count: it names a part of the map, not a class of its places. */
  uncounted?: boolean;
}

/** The legend: a swatch, the class words and a count. The count's part is `legend-<kind>`. */
export function usLegend(
  scope: string,
  items: readonly UsLegendItem[],
): SafeHtml {
  const id = idScope(scope);
  return html`<ul class="${styles.legend}" id="${id("legend")}" aria-label="Map classes">
    ${items.map(
      (item) =>
        html`<li class="${styles.legendItem}">${classSwatch(item.kind)}${
          item.uncounted === true
            ? html`<span>${item.text}</span>`
            : html`<span
            >${item.text} (<span class="${styles.usCount}" id="${id(`legend-${item.kind}`)}"
              >${item.count === null ? EMPTY : String(item.count)}</span
            >)</span
          >`
        }</li>`,
    )}
  </ul>`;
}

/** How tall a readout of the pin panel holds: one line, two, or the long ones' reserve. */
export type PinSize = "row" | "wide" | "long";

export interface UsPinField {
  key: string;
  label: string;
  size: PinSize;
}

interface UsPinOptions {
  scope: string;
  /** Names the head's first readout (`Place`, `State`). */
  nameLabel: string;
  placeholder: string;
  fields: readonly UsPinField[];
  /** The class a pin starts in (before anything is pinned). */
  startKind: string;
}

const SIZE_CLASS: Record<PinSize, string> = {
  row: styles.usRow!,
  wide: styles.usRowWide!,
  long: styles.usRowLong!,
};

/** The pin panel: a head (the place and its class) over the readouts. One polite status says the pin. */
function usPin(o: UsPinOptions): SafeHtml {
  const id = idScope(o.scope);
  return html`<div
    class="${styles.pin} ${styles.usPin}"
    id="${id("pin")}"
    data-pinned="false"
    ${gateAttr("us-pin")}
  >
    <p class="gmt-sr-only" id="${id("pin-announce")}" role="status"></p>
    <dl class="${styles.usPinHead}">
      <div>
        <dt class="gmt-sr-only">${o.nameLabel}</dt>
        <dd class="${styles.usPinName}" id="${id("pin-name")}">${o.placeholder}</dd>
      </div>
      <div>
        <dt class="gmt-sr-only">Class</dt>
        <dd class="${styles.usPinClass}">${classSwatch(o.startKind, id("pin-swatch"))}<span
            id="${id("pin-class")}"
            >${EMPTY}</span
          ></dd>
      </div>
    </dl>
    <dl class="${styles.usRows}">
      ${o.fields.map(
        (field) =>
          html`<div class="${SIZE_CLASS[field.size]}">
            <dt>${field.label}</dt>
            <dd id="${id(`pin-${field.key}`)}" ${gateAttr("us-pin-cell")}>${EMPTY}</dd>
          </div>`,
      )}
    </dl>
  </div>`;
}

export interface UsViewOptions {
  /** The view's id scope: `<page>-today`. */
  scope: string;
  /** The stage's heading and the list card's. */
  mapTitle: string;
  pickTitle: string;
  hint: string;
  listLabel: string;
  items: readonly UsListItem[];
  /** The drawing's box is 800 by this. */
  mapHeight: number;
  legend: SafeHtml;
  /** The line under the legend. */
  caption: string;
  pin: Omit<UsPinOptions, "scope">;
}

/** One view's section: the map and legend, the pin panel beside them, and the list for where no map is drawn. */
export function usView(o: UsViewOptions): SafeHtml {
  const id = idScope(o.scope);
  const rows = o.items.map((item, index) => {
    const parts = usRowParts(index);
    return html`<li class="${styles.zone}">
      <button
        type="button"
        class="${styles.zoneButton}"
        data-feature-id="${item.id}"
        aria-pressed="false"
      >
        <span class="${styles.zoneId}"
          >${item.name === item.id ? html`<code>${zoneId(item.id)}</code>` : item.name}</span
        >
        <span class="${styles.zoneKind}"
          >${classSwatch(item.kind, id(parts.swatch))}<span id="${id(parts.kind)}">${item.words}</span></span
        >
      </button>
    </li>`;
  });
  return html`<div
    class="${styles.usSection}"
    id="${id("section")}"
    ${gateAttr("us-section")}
    style="--zonemap-map-height: ${o.mapHeight}"
  >
    <section class="${styles.stage}" ${gateAttr("map-stage")}>
      <div
        class="${styles.block}"
        ${gateAttr("map-block")}
        role="group"
        aria-labelledby="${id("map-title")}"
      >
        <h4 id="${id("map-title")}">${o.mapTitle}</h4>
        <div class="${styles.map} gmt-theme-dark" id="${id("map")}" ${gateAttr("map-frame")}></div>
        ${o.legend}
        <p class="${styles.usCaption}">${o.caption}</p>
      </div>
    </section>
    <section
      class="${styles.pickCard}"
      ${gateAttr("pickcard")}
      aria-labelledby="${id("pick-title")}"
    >
      <h4 id="${id("pick-title")}">${o.pickTitle}</h4>
      <p class="${styles.hint}">${o.hint}</p>
      <div class="${styles.pick}">
        <div class="${styles.zoneFrame}">
          <div
            class="${styles.zoneScroll}"
            id="${id("zone-scroll")}"
            role="region"
            aria-label="${o.listLabel}"
            tabindex="0"
          >
            <ul class="${styles.zoneList}" id="${id("zone-list")}" aria-label="${o.pickTitle}">
              ${rows}
            </ul>
          </div>
        </div>
      </div>
    </section>
    ${usPin({ scope: o.scope, ...o.pin })}
  </div>`;
}

/**
 * The views, one `hidden` at a time (the mount toggles it): each `[id, markup]` is one view's own
 * wrapper.
 */
export function usViews(
  views: readonly { id: string; hidden: boolean; body: HtmlValue }[],
): SafeHtml {
  return html`<div class="${styles.usViews}">
    ${views.map(
      (view) =>
        html`<div id="${view.id}" ${view.hidden ? "hidden" : ""}>${view.body}</div>`,
    )}
  </div>`;
}

/** A status line that holds its height, so a Worker answer or failure moves nothing. */
export function usStatus(id: string): SafeHtml {
  return html`<p class="${styles.usStatus}" id="${id}" role="status"></p>`;
}
