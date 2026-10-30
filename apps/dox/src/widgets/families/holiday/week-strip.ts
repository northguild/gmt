/**
 * weekStrip: whole ISO weeks, Monday first, from the week of `from` to the week of `to`,
 * under one weekday header. A day outside `from` to `to` is drawn dimmed, so the strip always
 * starts and ends on a week; each day names its month ("15 Jun").
 *
 * Like the month grid, the strip is `role="img"` with a label that names its span and the
 * weekend, and a list of every marked date follows it, one sentence each.
 */
import { Temporal } from "@js-temporal/polyfill";
import { gateAttr } from "../../builders/gate";
import { html, type SafeHtml } from "../../builders/html";
import { weekdayList, type CellMark } from "~/lib/holiday-widgets";
import { cell, markedList, weekdayHeader } from "./month-grid";
import styles from "./week-strip.module.css";

export interface WeekStripOptions {
  /** The first and last day to show, as `YYYY-MM-DD`. */
  from: string;
  to: string;
  marks: Readonly<Record<string, CellMark | undefined>>;
  /** ISO weekdays that are closed every week. */
  weekend: readonly number[];
  today?: string;
  /** A `data-gate` hook the gates read. */
  gate?: string;
}

export function weekStrip(o: WeekStripOptions): SafeHtml {
  const start = Temporal.PlainDate.from(o.from);
  const end = Temporal.PlainDate.from(o.to);
  const first = start.subtract({ days: start.dayOfWeek - 1 });
  const last = end.add({ days: 7 - end.dayOfWeek });
  const grid = {
    year: start.year,
    months: { from: 1, to: 12 },
    marks: o.marks,
    weekend: o.weekend,
    ...(o.today === undefined ? {} : { today: o.today }),
  };
  const dates: string[] = [];
  const weeks: SafeHtml[] = [];
  for (
    let monday = first;
    Temporal.PlainDate.compare(monday, last) <= 0;
    monday = monday.add({ days: 7 })
  ) {
    const cells: SafeHtml[] = [];
    for (let col = 0; col < 7; col++) {
      const day = monday.add({ days: col });
      dates.push(day.toString());
      cells.push(
        cell(day, grid, {
          withMonth: true,
          outside:
            Temporal.PlainDate.compare(day, start) < 0 ||
            Temporal.PlainDate.compare(day, end) > 0,
        }),
      );
    }
    weeks.push(html`<div class="${styles.week}">${cells}</div>`);
  }
  const label = `Weeks from ${first.toString()} to ${last.toString()}. Weekend: ${weekdayList(o.weekend)}. The marked dates follow in the list.`;
  return html`<div class="${styles.strip}" ${gateAttr(o.gate)}
    >${weekdayHeader()}<div class="${styles.weeks}" role="img" aria-label="${label}">${weeks}</div
    >${markedList(dates, grid)}</div
  >`;
}
