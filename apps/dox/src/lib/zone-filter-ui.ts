/**
 * The globe's filter panel: nine switches over three axes (day, DST, sky), behind a settings
 * gear that is shut until asked for. The markup is `zoneFilters` in the zones family; this
 * file is the mount.
 *
 * Shut by default on purpose: the filters answer a question most readers never ask. It is
 * also what keeps them free: `globe.ts` only scans all ~420 zones while this is open or a
 * filter is on.
 *
 * Every switch is built once and afterwards only shown, hidden or relabelled. Re-rendering
 * the group on each refresh would throw away focus and checked state a keyboard user was in
 * the middle of; availability changes about once a minute as zones cross midnight.
 */

import { setHtml, setSwitchDetail, wireDisclosure } from "~/widgets/builders";
import { zoneFilters } from "~/widgets/families/zones/zone-filters";
import type { GmtReadout } from "~/widgets/primitives/readout/readout";
import type { SkyState } from "./zone-sky";
import {
  DAY_SHIFTS,
  DST_STATES,
  SKY_STATES,
  type BucketCounts,
  type ZoneFilter,
  defaultZoneFilter,
  showToggle,
} from "./zone-filter";
import type { DayShift, DstState } from "./zone-readout";

export interface ZoneFilterUi {
  /** The current filter, as a copy, so a caller cannot mutate the UI's state. */
  get(): ZoneFilter;
  /**
   * Refresh the switch counts, which switches are on screen, and the summary line.
   * `shown`/`total` are zone counts after and before filtering.
   */
  update(counts: BucketCounts, shown: number, total: number): void;
  /** Whether the panel is open; `globe.ts` uses it to decide whether the bucket scan is worth running. */
  isOpen(): boolean;
  destroy(): void;
}

export function mountZoneFilters(
  host: HTMLElement,
  onChange: (filter: ZoneFilter) => void,
  onToggleOpen?: () => void,
): ZoneFilterUi {
  const filter = defaultZoneFilter();
  const abort = new AbortController();
  setHtml(host, zoneFilters({ id: `${host.id || "gmt-globe"}-filters-gear` }));
  const root = host.querySelector<HTMLElement>("[data-disclosure]");
  if (!root) throw new Error("the filter panel did not render");
  const gear = root.querySelector<HTMLButtonElement>("button");
  const disclosure = wireDisclosure(root, {
    signal: abort.signal,
    light: true,
    onToggle: (open) => {
      if (open) onToggleOpen?.();
    },
  });

  const input = (axis: string, key: string): HTMLInputElement => {
    const found = root.querySelector<HTMLInputElement>(
      `input[name="${axis}"][value="${key}"]`,
    );
    if (!found) throw new Error(`no filter switch for ${axis}:${key}`);
    return found;
  };
  const status = root.querySelector<GmtReadout>("gmt-readout");

  root.addEventListener(
    "change",
    (event) => {
      const box = event.target;
      if (!(box instanceof HTMLInputElement)) return;
      const { name: axis, value: key } = box;
      if (axis === "day") filter.days[key as DayShift] = box.checked;
      else if (axis === "dst") filter.dst[key as DstState] = box.checked;
      else if (axis === "sky") filter.sky[key as SkyState] = box.checked;
      else return;
      onChange(get());
    },
    { signal: abort.signal },
  );

  function get(): ZoneFilter {
    return {
      days: { ...filter.days },
      dst: { ...filter.dst },
      sky: { ...filter.sky },
    };
  }

  function paint(box: HTMLInputElement, count: number, checked: boolean): void {
    setSwitchDetail(box, String(count));
    const row = box.labels?.[0];
    if (!row) return;
    const hide = !showToggle(count, checked);
    if (row.hidden === hide) return;
    /* Hiding the control a keyboard user is standing on drops focus to `<body>`, so the next
       Tab restarts from the top of the document. Rare, but the same loss of place the
       switches are built once to avoid. */
    if (hide && row.contains(document.activeElement)) gear?.focus();
    row.hidden = hide;
  }

  return {
    get,
    isOpen: () => disclosure.open,
    update(counts, shown, total) {
      for (const day of DAY_SHIFTS)
        paint(input("day", day), counts.days[day], filter.days[day]);
      for (const state of DST_STATES)
        paint(input("dst", state), counts.dst[state], filter.dst[state]);
      for (const state of SKY_STATES)
        paint(input("sky", state), counts.sky[state], filter.sky[state]);
      const text =
        shown === total
          ? `Showing all ${total} zones`
          : `Showing ${shown} of ${total} zones`;
      if (status && status.value !== text) {
        status.value = text;
        if (disclosure.open) status.announce();
      }
    },
    destroy() {
      abort.abort();
      host.replaceChildren();
    },
  };
}
