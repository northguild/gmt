/**
 * The two tables the EDI tools share: the members a parser returned (a name and its value, one
 * row each) and the zone strip (the same local time in up to four zones).
 *
 * Both are the kit's `table`, built once with every row present, so a change writes into cells
 * and moves nothing. A cell holds one `<span>` with an id, which the mount writes to, and a
 * reserved width in `ch` so a longer value does not widen its column. The strip's third column
 * has a name that depends on the value (`As 205`, `End instant`, `With offset`); the mount
 * rebuilds the strip, with the current zones, only when that name changes.
 */
import { EDI_ZONES } from "~/lib/edi-widgets";
import { gateAttr } from "../../builders/gate";
import { html, setHtml, type SafeHtml } from "../../builders/html";
import { instant } from "../../builders/instant";
import { select } from "../../builders/select";
import { srOnly } from "../../builders/sr-only";
import { valueText } from "../../builders/value-text";
import { swatch, type SwatchSeries } from "../../builders/swatch";
import { table } from "../../builders/table";
import styles from "./edi-table.module.css";

type IdOf = (local: string) => string;

/** What a strip cell holds before a value is written: a no-break space, so the cell keeps its line. */
const NBSP = "\u00a0";

interface MemberRowSpec {
  key: string;
  label: string;
}

/** The text a member cell starts with: nothing has been read. */
export const NO_MEMBER = "no result";

/** What a member cell is: a value, a member the value does not state, or no result at all. */
type MemberState = "value" | "absent" | "none";

/** The members a parser returned: every row is always present. */
export function memberTable(o: {
  id: IdOf;
  caption: string;
  /** Prefix for each row's cell id, such as `member`; the cell is `member-<key>`. */
  prefix: string;
  rows: readonly MemberRowSpec[];
  /** True when a value can run to a second line in a narrow column: each cell then keeps both. */
  wraps?: boolean;
}): SafeHtml {
  return table({
    caption: o.caption,
    rowHeader: "name",
    layout: "fixed",
    widths: ["34%", null],
    columns: [
      { key: "name", header: "Member", align: "start", numeric: false },
      { key: "value", header: "Value", align: "start", numeric: false },
    ],
    rows: o.rows.map((r) => ({
      name: r.label,
      value: html`<span class="${styles.member}" ${gateAttr("drawn")} ${o.wraps ? html`data-wraps` : ""} id="${o.id(`${o.prefix}-${r.key}`)}" data-state="none">${NO_MEMBER}</span>`,
    })),
  });
}

/** Writes one member cell: its dates stay whole and a long value breaks only at its seams. */
export function setMember(
  cell: HTMLElement,
  text: string,
  state: MemberState,
): void {
  setHtml(cell, valueText(text));
  cell.dataset["state"] = state;
}

interface ZoneStripOptions {
  id: IdOf;
  /** The table's name. */
  caption: string;
  /** The third column's header: `As 205`, `End instant` or `With offset`. */
  third: string;
  /** The four chosen zones, `""` for none. */
  zones: readonly string[];
  disabled: boolean;
  /**
   * The widths, in characters, the instant and third cells reserve. `thirdLines` is set when the
   * third column can hold a value wider than `third`: the cell then keeps that width and that many
   * lines, and the value breaks between the pieces of an `instant`, so a longer one never moves it.
   */
  widths: {
    instant: number;
    third: number;
    thirdLines?: number;
    /** The offset cell's width: 6 (`-04:00`) unless a zone's local mean time shows seconds. */
    offset?: number;
  };
}

const SERIES: readonly SwatchSeries[] = [1, 2, 3, 4];

/** The zone options: the list, the chosen zone when it is not on it, and "No zone" first. */
function zoneOptions(selected: string): { value: string; label: string }[] {
  const list =
    selected === "" || EDI_ZONES.includes(selected)
      ? EDI_ZONES
      : [...EDI_ZONES, selected];
  return [
    { value: "", label: "No zone" },
    ...list.map((z) => ({ value: z, label: z })),
  ];
}

function cell(id: string, width: number, lines = 1): SafeHtml {
  const wraps = lines > 1 ? html`data-wraps` : "";
  const held = lines > 1 ? instant(NBSP) : NBSP;
  return html`<span class="${styles.cell}" id="${id}" ${wraps} ${gateAttr("drawn")} style="--w:${width}ch;--lines:${lines}">${held}</span>`;
}

/** The strip: row number, zone choice, the instant, its offset and the third column. */
export function zoneStrip(o: ZoneStripOptions): SafeHtml {
  return table({
    caption: o.caption,
    rowHeader: "n",
    columns: [
      { key: "n", header: "Row", align: "start", numeric: true },
      { key: "zone", header: "Zone", align: "start", numeric: false },
      { key: "instant", header: "Instant", align: "start", numeric: true },
      { key: "offset", header: "Offset", align: "start", numeric: true },
      { key: "third", header: o.third, align: "start", numeric: true },
    ],
    rows: SERIES.map((n) => {
      const zone = o.zones[n - 1] ?? "";
      return {
        n: html`${swatch({ series: n })}<span class="${styles.number}">${n}</span>`,
        zone: html`<label class="${styles.zoneLabel}" for="${o.id(`zone-${n}`)}">${srOnly(`Zone ${n}`)}</label>${select(
          {
            id: o.id(`zone-${n}`),
            value: zone,
            options: zoneOptions(zone),
          },
        )}`,
        instant: cell(o.id(`instant-${n}`), o.widths.instant),
        offset: cell(o.id(`offset-${n}`), o.widths.offset ?? 6),
        third: cell(o.id(`third-${n}`), o.widths.third, o.widths.thirdLines),
      };
    }),
  });
}

/** Writes a strip cell: plain text, or the sentinel in words. An empty text leaves the line held. */
export function setStripCell(
  cellEl: HTMLElement,
  text: string,
  lost = false,
): void {
  if (lost) {
    setHtml(cellEl, html`<span class="${styles.lost}">${text}</span>`);
    return;
  }
  const shown = text === "" ? NBSP : text;
  if (cellEl.hasAttribute("data-wraps")) setHtml(cellEl, instant(shown));
  else cellEl.textContent = shown;
}
