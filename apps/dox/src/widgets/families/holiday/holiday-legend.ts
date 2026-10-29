/**
 * holidayLegend: a swatch in the pattern of each mark, with its word beside it. A mark is a
 * pattern and a word, never a colour alone, so the swatch is decorative (`aria-hidden`) and
 * the name is the text next to it.
 *
 * An item is either a mark kind (closed, weekend, moved-from, moved-to, pick) or a series
 * (1 to 3) for a picked date, such as Moving Feasts' Gregorian and Julian Easters.
 */
import { html, type SafeHtml } from "../../builders/html";
import {
  MARK_KINDS,
  MARK_WORDS,
  type MarkKind,
  type SeriesNumber,
} from "~/lib/holiday-widgets";
import styles from "./holiday-legend.module.css";

export interface LegendItem {
  /** A mark kind, drawn in that mark's pattern. */
  kind: MarkKind;
  /** The series of a picked date; only a `pick` has one. */
  series?: SeriesNumber;
  /** Replaces the kind's word. */
  label?: string;
}

export interface HolidayLegendOptions {
  /** The list's accessible name. Required. */
  label: string;
  items: readonly LegendItem[];
}

/** The legend of the given kinds, each with its own word. */
export function kindItems(
  kinds: readonly MarkKind[] = MARK_KINDS,
): LegendItem[] {
  return kinds.map((kind) => ({ kind, label: MARK_WORDS[kind] }));
}

export function holidayLegend(o: HolidayLegendOptions): SafeHtml {
  return html`<ul class="${styles.legend}" aria-label="${o.label}"
    >${o.items.map(
      (item) =>
        html`<li class="${styles.item}"
          ><span
            class="${styles.swatch}"
            data-kind="${item.kind}"
            ${item.series === undefined ? "" : html`data-series="${item.series}"`}
            aria-hidden="true"
          ></span
          >${item.label ?? MARK_WORDS[item.kind]}</li
        >`,
    )}</ul
  >`;
}
