/**
 * changeGroups: the clock-change lists of a dated checker, one card for each zone and a line for
 * each year.
 *
 * The server writes every card with NO SIGNAL for each year, so the page does not grow when the
 * answer arrives. `changeEntries` writes what the mount puts in a card's list once it has the
 * answer: a change row (the wall time just before the change, the shift and the UTC instant), a
 * "No clock change in <year>" line for a year with none, or NO SIGNAL for a wall time the library
 * could not write.
 */
import { html, type HtmlValue, type SafeHtml } from "../../builders/html";
import { idScope } from "../../builders/ids";
import { section } from "../../builders/layout";
import { clockSlug } from "./clocks";
import { noSignal, zoneId } from "./marks";
import styles from "./change-list.module.css";

/** The local part name of a zone's list, as `findWidget(...).part(name)` takes it. */
export const changeListPart = (zone: string): string =>
  `changes-${clockSlug(zone)}`;

/** The list of the groups (`findWidget(...).part(...)`). */
const CHANGE_GROUPS_PART = "change-groups";

export function changeGroups(
  idPrefix: string,
  zones: readonly string[],
  years: readonly number[],
): SafeHtml {
  const id = idScope(idPrefix);
  return html`<ul class="${styles.groups}" id="${id(CHANGE_GROUPS_PART)}">${zones.map(
    (zone) =>
      html`<li class="${styles.group}">
        <h5 class="${styles.title}"><code>${zoneId(zone)}</code></h5>
        <ul class="${styles.changes}" id="${id(changeListPart(zone))}">${years.map(
          () => html`<li>${noSignal()}</li>`,
        )}</ul>
      </li>`,
  )}</ul>`;
}

/** One change: the wall time just before it, what the offset did, and the instant. */
interface ChangeLine {
  /** `YYYY-MM-DD HH:mm`, or `""` when the library could not write it. */
  when: string;
  shift: string;
  utc: string;
}

interface YearChanges {
  year: number;
  lines: readonly ChangeLine[];
}

function line(entry: ChangeLine): SafeHtml {
  if (entry.when === "") return html`<li>${noSignal()}</li>`;
  return html`<li class="${styles.change}">
    <span class="${styles.when}">${entry.when}</span>
    <span class="${styles.shift}">${entry.shift}</span>
    <span class="${styles.utc}">${entry.utc}</span>
  </li>`;
}

/** What a zone's list holds once the answer is in. */
export function changeEntries(years: readonly YearChanges[]): SafeHtml {
  return html`${years.map((entry) =>
    entry.lines.length === 0
      ? html`<li class="${styles.none}">No clock change in ${String(entry.year)}</li>`
      : html`${entry.lines.map(line)}`,
  )}`;
}

interface ListSectionOptions {
  /** The section's id: its heading's id derives from it. */
  id: string;
  heading: string;
  gate: string;
  /** A line under the heading that says how to read the list. */
  note?: HtmlValue;
}

/** A section of the page that holds a list of clock changes: a heading, a note and the list. */
export function listSection(o: ListSectionOptions, list: SafeHtml): SafeHtml {
  return section(
    { id: o.id, heading: o.heading, level: 4, gate: o.gate },
    html`${o.note === undefined ? "" : html`<p class="${styles.note}">${o.note}</p>`}${list}`,
  );
}
