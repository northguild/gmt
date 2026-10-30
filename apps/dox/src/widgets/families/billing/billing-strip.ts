/**
 * The Billing Deadlines strip: a calendar of days wrapped by ISO week, with the three windows
 * drawn as numbered, patterned lanes under the day's date.
 *
 * - `billingCalendar(id)` is the weekday header (drawn text, `aria-hidden`) and the strip's own
 *   element, a named list that the mount fills with `billingCells`.
 * - `billingCells(items)` is the strip's items. A real day is a `listitem` named by its date and
 *   everything the day holds, in words (`dayCellLabel`); its drawn date, marks and lanes are
 *   `aria-hidden`, because the name already says them. A padding cell (outside the real span, in
 *   the first or last drawn week) and nothing else is hidden from the tree. A gap row stands for
 *   the weeks left out and says how many days it skips.
 * - `billingLegend()` is the key. Colour is never the only signal: lane 1 is solid, lane 2
 *   dashed and lane 3 dotted, a deadline day carries its lane's number, and a mark is a letter.
 *
 * A verdict colour never appears here: a date comparison is not a finding, and amber is the
 * sentinel's alone.
 */
import { html, type SafeHtml } from "../../builders/html";
import {
  MARK_LETTER,
  WEEKDAY_NAMES,
  dayCellLabel,
  dayParts,
  gapLabel,
  type DayStripDay,
  type DayStripItem,
  type DayStripResult,
} from "~/lib/billing-deadlines";
import styles from "./billing-strip.module.css";

const LANES = [1, 2, 3] as const;

export function billingCalendar(id: string): SafeHtml {
  return html`<div class="${styles.calendar}"
    ><div class="${styles.weekdays}" aria-hidden="true"
      >${WEEKDAY_NAMES.map((w) => html`<span>${w}</span>`)}</div
    ><div class="${styles.strip}" id="${id}" role="list" aria-label="Day strip"></div
  ></div>`;
}

function dayCell(item: DayStripDay, showMonth: boolean): SafeHtml {
  if (item.padding) {
    return html`<div class="${styles.cell}" data-padding role="listitem" aria-hidden="true"></div>`;
  }
  const { day, month } = dayParts(item.date);
  const text = showMonth ? `${day} ${month}` : String(day);
  const deadlines = item.lanes.filter((l) => l.state === "deadline");
  return html`<div class="${styles.cell}" role="listitem" aria-label="${dayCellLabel(item)}"
    ><span class="${styles.date}" aria-hidden="true">${text}</span
    >${
      item.marks.length === 0
        ? ""
        : html`<span class="${styles.badges}" aria-hidden="true"
            >${item.marks.map((m) => html`<span class="${styles.badge}" data-kind="mark">${MARK_LETTER[m]}</span>`)}</span
          >`
    }${
      deadlines.length === 0
        ? ""
        : html`<span class="${styles.badges}" aria-hidden="true"
            >${deadlines.map((l) => html`<span class="${styles.badge}" data-kind="deadline" data-lane="${String(l.lane)}">${String(l.lane)}</span>`)}</span
          >`
    }<span class="${styles.lanes}" aria-hidden="true"
      >${LANES.map((n) => {
        const lane = item.lanes.find((l) => l.lane === n);
        return html`<span class="${styles.lane}" data-lane="${String(n)}" data-state="${lane?.state ?? "none"}"></span>`;
      })}</span
    ></div
  >`;
}

function gapRow(item: Extract<DayStripItem, { kind: "gap" }>): SafeHtml {
  return html`<div class="${styles.gap}" role="listitem" aria-label="${gapLabel(item)}"
    ><span aria-hidden="true">… ${String(item.days)} days not drawn …</span></div
  >`;
}

/** The items of the strip's list. A date shows its month on the first drawn day and on the 1st. */
export function billingCells(strip: DayStripResult | null): SafeHtml {
  if (strip === null) return html``;
  let firstDrawn = true;
  return html`${strip.items.map((item) => {
    if (item.kind === "gap") return gapRow(item);
    if (item.padding) return dayCell(item, false);
    const showMonth = firstDrawn || dayParts(item.date).day === 1;
    firstDrawn = false;
    return dayCell(item, showMonth);
  })}`;
}

/** The key under the strip. Drawn for the eye; the words say each pattern. */
export function billingLegend(): SafeHtml {
  const mark = (letter: string, text: string) =>
    html`<li class="${styles.legendItem}"><i class="${styles.badge}" data-kind="mark" aria-hidden="true">${letter}</i>${text}</li>`;
  const lane = (n: number, text: string) =>
    html`<li class="${styles.legendItem}"><i class="${styles.lane}" data-lane="${String(n)}" data-state="in" data-key aria-hidden="true"></i>${text}</li>`;
  return html`<ul class="${styles.legend}" aria-label="Legend"
    >${mark("A", "anchor, day zero")}${mark("I", "invoice issued")}${mark("R", "dispute request received")}${lane(1, "1 issue window, solid")}${lane(2, "2 dispute window, dashed")}${lane(3, "3 resolution window, dotted")}</ul
  >`;
}
