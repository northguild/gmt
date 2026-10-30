/**
 * zoneChoices: the options of a time-zone `<select>` for a cut-off tool.
 *
 * The curated list, plus the selected zone when a seed names one outside it (a link may carry
 * any zone the library knows), so a seeded value is never silently dropped.
 */
import { TRANSPORT_ZONES } from "~/lib/cutoff-widgets";

interface ZoneChoice {
  value: string;
  label: string;
}

export function zoneChoices(selected: string): ZoneChoice[] {
  const list =
    selected === "" || TRANSPORT_ZONES.includes(selected)
      ? TRANSPORT_ZONES
      : [...TRANSPORT_ZONES, selected];
  return list.map((z) => ({ value: z, label: z }));
}

/**
 * Set a select to `value`, adding the option first when the list does not carry it, so a seed
 * naming a zone outside the curated list survives the mount.
 */
export function setSelectValue(el: HTMLSelectElement, value: string): void {
  if (value !== "" && ![...el.options].some((o) => o.value === value)) {
    el.add(new Option(value, value));
  }
  el.value = value;
}
