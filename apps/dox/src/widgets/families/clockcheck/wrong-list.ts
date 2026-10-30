/**
 * wrongList: the clock changes a stale runtime gets wrong, one row for each stated change and zone.
 *
 * Everything but the server's answer is known when the page is built, so a row is complete except
 * its last cell, which holds NO SIGNAL until the answer arrives (`wrongPresentPart` names it, for
 * the mount). No colour carries a verdict; the words do.
 */
import { html, type SafeHtml } from "../../builders/html";
import { idScope } from "../../builders/ids";
import { clockSlug } from "./clocks";
import { noSignal, zoneId } from "./marks";
import styles from "./wrong-list.module.css";

export interface WrongRow {
  zone: string;
  /** The change's UTC instant: with the zone, the row's key. */
  at: string;
  /** The wall time just before the change, with "local". */
  when: string;
  shift: string;
  by: string;
}

/** The local part name of a row's last cell, as `findWidget(...).part(name)` takes it. */
export const wrongPresentPart = (zone: string, at: string): string =>
  `wrong-${clockSlug(zone)}-${clockSlug(at)}-present`;

export function wrongList(
  idPrefix: string,
  rows: readonly WrongRow[],
): SafeHtml {
  const id = idScope(idPrefix);
  return html`<ul class="${styles.list}">${rows.map(
    (row) =>
      html`<li class="${styles.row}">
        <span class="${styles.zone}"><code>${zoneId(row.zone)}</code></span>
        <span class="${styles.when}">${row.when}</span>
        <span class="${styles.shift}">${row.shift}</span>
        <span class="${styles.utc}">${row.at}</span>
        <span class="${styles.by}">${row.by}</span>
        <span class="${styles.present}" id="${id(wrongPresentPart(row.zone, row.at))}">${noSignal()}</span>
      </li>`,
  )}</ul>`;
}
