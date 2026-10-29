/**
 * zoneFilters: the globe's filter panel. A gear button that opens a panel of nine switches
 * in three fieldsets (local day, daylight saving, local sky) and a count of what is showing.
 *
 * The switches are built once; `zone-filter-ui.ts` only shows, hides and relabels them, so a
 * keyboard user's place and the checked state survive a refresh. Each switch is named by its
 * axis (`name`) and bucket (`value`), which is how the mount finds it again.
 */
import {
  disclosure,
  html,
  raw,
  switchField,
  type SafeHtml,
  type SwitchTone,
} from "~/widgets/builders";
import { readout } from "~/widgets/primitives/readout/readout";
import {
  DAY_SHIFTS,
  DST_STATES,
  FILTER_SETTINGS_ICON,
  SKY_STATES,
  dayFilterLabel,
  dstFilterLabel,
  filterIconPath,
  skyFilterLabel,
  type FilterAxis,
} from "~/lib/zone-filter";
import styles from "./zone-filters.module.css";

function svg(inner: string): SafeHtml {
  return raw(
    `<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">${inner}</svg>`,
  );
}

function tone(axis: FilterAxis, key: string): SwitchTone {
  if (axis === "day") return key === "same" ? "cyan" : "purple";
  if (axis === "dst") return key === "dst" ? "gold" : "cyan";
  return "cyan";
}

function toggle(axis: FilterAxis, key: string, label: string): SafeHtml {
  return switchField({
    label,
    name: axis,
    value: key,
    checked: true,
    detail: "0",
    icon: svg(filterIconPath(axis, key)),
    tone: tone(axis, key),
  });
}

function group(legend: string, switches: SafeHtml[]): SafeHtml {
  return html`<fieldset class="${styles.group}">
    <legend class="${styles.legend}">${legend}</legend>
    ${switches}
  </fieldset>`;
}

export function zoneFilters(o: { id: string }): SafeHtml {
  return disclosure({
    id: o.id,
    label: "Filters",
    icon: svg(FILTER_SETTINGS_ICON),
    className: styles.root ?? "",
    buttonClassName: styles.gear ?? "",
    children: html`<div class="${styles.body}">
      ${group(
        "Local day",
        DAY_SHIFTS.map((d) => toggle("day", d, dayFilterLabel(d))),
      )}
      ${group(
        "Daylight saving",
        DST_STATES.map((d) => toggle("dst", d, dstFilterLabel(d))),
      )}
      ${group(
        "Local sky",
        SKY_STATES.map((d) => toggle("sky", d, skyFilterLabel(d))),
      )}
      ${readout({
        label: "Zones showing",
        value: "Showing all zones",
        samples: ["Showing 999 of 999 zones"],
      })}
    </div>`,
  });
}
