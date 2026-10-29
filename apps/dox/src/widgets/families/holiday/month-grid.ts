/**
 * monthGrid: months as ISO weeks, Monday first, with six week rows in every month so a
 * month never changes height. Each day sits where `PlainDate#dayOfWeek` puts it.
 *
 * The grid is `role="img"` with a label that names the span and the weekend, and a list of
 * every marked date follows it, one sentence each, because the image hides the cells from a
 * screen reader. A month with no marks carries `data-empty` and a "No holidays in <month>"
 * line, which the module shows in the one-column layout; every month reserves that line, so
 * no month changes height with the marks.
 *
 * A mark is a pattern and a word, never a colour alone: the state lives in `data-*`
 * attributes the builder sets and the module styles.
 */
import { Temporal } from "@js-temporal/polyfill";
import { gateAttr } from "../../builders/gate";
import { html, type SafeHtml } from "../../builders/html";
import {
  cellKinds,
  isMarked,
  markSentence,
  monthName,
  weekdayList,
  weekdayShort,
  type MonthGridOptions,
} from "~/lib/holiday-widgets";
import styles from "./month-grid.module.css";

export type { MonthGridOptions };

const WEEKDAY_NAMES = [
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
  "Sun",
] as const;

export function weekdayHeader(): SafeHtml {
  return html`<div class="${styles.weekdays}" aria-hidden="true"
    >${WEEKDAY_NAMES.map(
      (name) =>
        html`<span class="${styles.wd}"
          ><span class="${styles.long}">${name}</span
          ><span class="${styles.short}">${name.slice(0, 1)}</span></span
        >`,
    )}</div
  >`;
}

const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/** How a week strip's cell differs from a month's: it names its month, and may lie outside. */
export interface CellExtras {
  withMonth?: boolean;
  outside?: boolean;
}

export function cell(
  date: Temporal.PlainDate,
  o: MonthGridOptions,
  extras: CellExtras = {},
): SafeHtml {
  const key = date.toString();
  const mark = o.marks[key];
  const isWeekend = o.weekend.includes(date.dayOfWeek);
  const kinds = cellKinds(mark, isWeekend);
  const chips = [
    ...(mark?.rules ?? []).map(
      (n) =>
        html`<span class="${styles.chip}" data-chip="rule">${String(n)}</span>`,
    ),
    ...(mark?.chips ?? []).map(
      (text) =>
        html`<span class="${styles.chip}" data-chip="tag">${text}</span>`,
    ),
    mark?.movedTo === undefined
      ? html``
      : html`<span class="${styles.chip}" data-chip="from">↩ ${weekdayShort(mark.movedTo)}</span>`,
  ];
  return html`<div
    class="${styles.cell}"
    data-date="${key}"
    data-kinds="${kinds.join(" ")}"
    ${isWeekend ? html`data-weekend` : ""}
    ${o.today === key ? html`data-today` : ""}
    ${extras.outside === true ? html`data-outside` : ""}
    ${mark?.pick === undefined ? "" : html`data-series="${String(mark.pick)}"`}
  >
    <span class="${styles.day}">${extras.withMonth === true ? `${date.day} ${MONTH_SHORT[date.month - 1]}` : String(date.day)}</span>${
      chips.length === 0
        ? ""
        : html`<span class="${styles.chips}">${chips}</span>`
    }
  </div>`;
}

/** The list of every marked date, in a list a reader can step through. */
export function markedList(dates: readonly string[], o: MonthGridOptions): SafeHtml {
  const items = dates.flatMap((date) => {
    const mark = o.marks[date];
    if (!isMarked(mark)) return [];
    const isWeekend = o.weekend.includes(
      Temporal.PlainDate.from(date).dayOfWeek,
    );
    return [html`<li>${markSentence(date, mark!, isWeekend)}</li>`];
  });
  return html`<ul class="${styles.marked}" aria-label="Marked dates">${items}</ul>`;
}

export function monthGrid(
  o: MonthGridOptions,
  gate: string | undefined = "grid",
): SafeHtml {
  const from = Math.max(1, Math.min(12, o.months.from));
  const to = Math.max(from, Math.min(12, o.months.to));
  const dates: string[] = [];
  const months: SafeHtml[] = [];
  for (let month = from; month <= to; month++) {
    const first = Temporal.PlainDate.from({ year: o.year, month, day: 1 });
    const lead = first.dayOfWeek - 1;
    const monthDates: string[] = [];
    const weeks: SafeHtml[] = [];
    for (let week = 0; week < 6; week++) {
      const cells: SafeHtml[] = [];
      for (let col = 0; col < 7; col++) {
        const dayNumber = week * 7 + col - lead + 1;
        if (dayNumber < 1 || dayNumber > first.daysInMonth) {
          cells.push(html`<div class="${styles.cell}" data-blank></div>`);
        } else {
          const date = first.with({ day: dayNumber });
          monthDates.push(date.toString());
          cells.push(cell(date, o));
        }
      }
      weeks.push(html`<div class="${styles.week}">${cells}</div>`);
    }
    dates.push(...monthDates);
    const empty = !monthDates.some((date) => isMarked(o.marks[date]));
    months.push(
      html`<section
        class="${styles.month}"
        data-month="${String(month)}"
        ${empty ? html`data-empty="true"` : ""}
      >
        <h4 class="${styles.name}">${monthName(month)}</h4>
        ${weekdayHeader()}${weeks}
        <p class="${styles.none}">No holidays in ${monthName(month)}</p>
      </section>`,
    );
  }
  const span =
    from === to
      ? `${monthName(from)} ${o.year}`
      : `${monthName(from)} to ${monthName(to)} ${o.year}`;
  const label = `Calendar, ${span}. Weekend: ${weekdayList(o.weekend)}. The marked dates follow in the list.`;
  return html`<div class="${styles.grid}" ${gateAttr(gate)} data-year="${String(o.year)}">
    <div class="${styles.months}" role="img" aria-label="${label}">${months}</div>
    ${markedList(dates, o)}
  </div>`;
}
