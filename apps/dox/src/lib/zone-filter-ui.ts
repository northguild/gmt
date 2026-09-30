/**
 * The globe's filter panel — nine switches over three axes (day, DST, sky),
 * behind a settings gear that is shut until asked for.
 *
 * A button disclosure over a plain `<div>`, not a `<details>`. That was the
 * first shape and it fought the layout: as an addon on the search field, the
 * element brought a marker box that ate the button's width and a
 * `::details-content` box that changed the row's height the moment it opened.
 * A `<details>` only ever supplied click-to-toggle here — the dismissal a popup
 * needs is hand-written either way — so this keeps `aria-expanded` /
 * `aria-controls`, which is the standard disclosure pairing, and nothing else.
 *
 * Shut by default on purpose: the filters answer a question most readers never
 * ask, and the panel beside a globe is not where to spend nine controls' worth
 * of attention up front. It is also what keeps them free — `globe.ts` only
 * scans all ~420 zones while this is open or a filter is on.
 *
 * Each switch is a real `<input type="checkbox" role="switch">` with the track
 * and knob drawn around it, rather than a `div` pretending: the checkbox keeps
 * the label association, the space-to-toggle, the focus ring and the
 * announcement, and only the paint is ours. Each carries the glyph of the thing
 * it filters — an arrow for the day shift, a clock for DST, the tooltip's own
 * sun and moon for the sky — so the control and the data it hides look like
 * the same idea.
 *
 * Every switch is built once, here, and afterwards only shown, hidden or
 * relabelled. Re-rendering the group on each refresh would have been shorter
 * and would have thrown away focus and checked state a keyboard user was in the
 * middle of — availability changes roughly once a minute as zones cross
 * midnight, so that would not have been a rare accident.
 */

import type { SkyState } from "./zone-sky";
import {
  DAY_SHIFTS,
  DST_STATES,
  SKY_STATES,
  FILTER_SETTINGS_ICON,
  type BucketCounts,
  type ZoneFilter,
  dayFilterLabel,
  defaultZoneFilter,
  dstFilterLabel,
  filterIconPath,
  showToggle,
  skyFilterLabel,
  type FilterAxis,
} from "./zone-filter";
import type { DayShift, DstState } from "./zone-readout";

export interface ZoneFilterUi {
  /** The current filter — a copy, so a caller cannot mutate the UI's state. */
  get(): ZoneFilter;
  /**
   * Refresh the switch labels, which switches are on screen, and the summary
   * line. `shown`/`total` are zone counts after and before filtering.
   */
  update(counts: BucketCounts, shown: number, total: number): void;
  /** Whether the panel is open — `globe.ts` uses it to decide whether the
   *  bucket scan is worth running at all. */
  isOpen(): boolean;
  destroy(): void;
}

interface Toggle {
  label: HTMLLabelElement;
  input: HTMLInputElement;
  count: HTMLElement;
}

function icon(inner: string, className: string): string {
  return (
    `<svg class="${className}" viewBox="0 0 24 24" width="14" height="14" ` +
    `aria-hidden="true">${inner}</svg>`
  );
}

function buildToggle(axis: FilterAxis, key: string, text: string): Toggle {
  const label = document.createElement("label");
  label.className = "gmt-globe-filter-toggle";
  label.dataset.filterKey = key;
  label.innerHTML =
    `<input type="checkbox" role="switch" data-filter-axis="${axis}" data-filter-key="${key}" checked>` +
    `<span class="gmt-globe-filter-track" aria-hidden="true"></span>` +
    icon(filterIconPath(axis, key), "gmt-globe-filter-icon") +
    `<span class="gmt-globe-filter-name"></span>` +
    `<span class="gmt-globe-filter-count" aria-hidden="true"></span>`;
  const name = label.querySelector<HTMLElement>(".gmt-globe-filter-name");
  if (name) name.textContent = text;
  return {
    label,
    input: label.querySelector("input") as HTMLInputElement,
    count: label.querySelector(".gmt-globe-filter-count") as HTMLElement,
  };
}

export function mountZoneFilters(
  host: HTMLElement,
  onChange: (filter: ZoneFilter) => void,
  onToggleOpen?: () => void,
): ZoneFilterUi {
  const filter = defaultZoneFilter();
  const panelId = `${host.id || "gmt-globe"}-filter-panel`;

  /* Icon-only, so it carries its name in text only assistive tech reads. A
     bare gear would otherwise announce as an unlabelled button.
     Composes `.gmt-button` (gmt-primitives.css) so the addon carries the same
     bevelled surface as the field it is attached to; gmt-globe.css squares off
     only the edge the two share. */
  const summary = document.createElement("button");
  summary.type = "button";
  summary.className = "gmt-globe-filter-summary gmt-button";
  summary.setAttribute("aria-expanded", "false");
  summary.setAttribute("aria-controls", panelId);
  summary.innerHTML =
    icon(FILTER_SETTINGS_ICON, "gmt-globe-filter-gear") +
    `<span class="gmt-globe-filter-summary-text">Filters</span>`;
  host.appendChild(summary);

  /* Composes `.gmt-popover` (gmt-primitives.css) for the floating surface —
     background, border, radius and shadow — leaving only this panel's own
     layout and placement in gmt-globe.css. */
  const body = document.createElement("div");
  body.className = "gmt-globe-filter-body gmt-popover";
  body.id = panelId;
  body.hidden = true;
  host.appendChild(body);

  function isOpen(): boolean {
    return !body.hidden;
  }

  function setOpen(open: boolean): void {
    if (isOpen() === open) return;
    body.hidden = !open;
    summary.setAttribute("aria-expanded", String(open));
    if (open) onToggleOpen?.();
  }

  const dayToggles = new Map<DayShift, Toggle>();
  const dstToggles = new Map<DstState, Toggle>();
  const skyToggles = new Map<SkyState, Toggle>();

  function group(legendText: string): HTMLFieldSetElement {
    const fieldset = document.createElement("fieldset");
    fieldset.className = "gmt-globe-filter-group";
    const legend = document.createElement("legend");
    legend.textContent = legendText;
    fieldset.appendChild(legend);
    body.appendChild(fieldset);
    return fieldset;
  }

  const dayGroup = group("Local day");
  for (const day of DAY_SHIFTS) {
    const toggle = buildToggle("day", day, dayFilterLabel(day));
    dayToggles.set(day, toggle);
    dayGroup.appendChild(toggle.label);
  }

  const dstGroup = group("Daylight saving");
  for (const state of DST_STATES) {
    const toggle = buildToggle("dst", state, dstFilterLabel(state));
    dstToggles.set(state, toggle);
    dstGroup.appendChild(toggle.label);
  }

  /* Distinct from the group above, and the naming has to keep them apart:
     daylight *saving* is a clock rule, this is whether the sun is actually up.
     A zone can be in DST in the middle of its night. */
  const skyGroup = group("Local sky");
  for (const state of SKY_STATES) {
    const toggle = buildToggle("sky", state, skyFilterLabel(state));
    skyToggles.set(state, toggle);
    skyGroup.appendChild(toggle.label);
  }

  /* role="status": the count changes as a result of the reader's own click, and
     a filter that silently removes rows they cannot see is the case this exists
     for — "showing 43 of 418" is the confirmation that anything happened. */
  const status = document.createElement("p");
  status.className = "gmt-globe-filter-status";
  status.setAttribute("role", "status");
  body.appendChild(status);

  function onInput(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const axis = input?.dataset.filterAxis;
    const key = input?.dataset.filterKey;
    if (!input || !axis || !key) return;
    if (axis === "day") filter.days[key as DayShift] = input.checked;
    else if (axis === "dst") filter.dst[key as DstState] = input.checked;
    else filter.sky[key as SkyState] = input.checked;
    onChange(get());
  }
  body.addEventListener("change", onInput);

  function onSummaryClick(): void {
    setOpen(!isOpen());
  }
  summary.addEventListener("click", onSummaryClick);

  function close(refocus: boolean): void {
    if (!isOpen()) return;
    setOpen(false);
    /* Focus goes back to the gear, not to wherever it was before: the panel
       that had it is gone, and a keyboard user would otherwise be dropped at
       the top of the document. */
    if (refocus) summary.focus();
  }

  /* A popup, so it light-dismisses.
     `pointerdown` rather than `click`: a press that starts outside and ends
     inside should still dismiss, and it fires before focus moves. */
  function onDocumentPointerDown(event: PointerEvent): void {
    const target = event.target as Node | null;
    if (target && host.contains(target)) return;
    close(false);
  }
  document.addEventListener("pointerdown", onDocumentPointerDown);

  /* Tabbing past the last switch left the popup open behind the reader, which
     a popup should not do — but only a *keyboard* exit is a dismissal here.
     The panel is otherwise locked: clicking a switch, its label or anywhere
     else inside must never close it, and only a press outside does (see the
     document handler above).
     `relatedTarget` is the whole test. Tab always names where focus is going,
     so an exit lands here with a real element. A pointer press inside does not:
     clicking a label blurs the gear and the browser reports `relatedTarget:
     null`, because a <label> is not itself focusable and focus has gone
     nowhere it can name. Treating that null as "left the panel" is what shut
     the popup on every click. So null is ignored, and only focus that has
     demonstrably landed on some element outside closes it.
     No refocus — focus has already gone where the reader sent it. */
  function onFocusOut(event: FocusEvent): void {
    const next = event.relatedTarget as Node | null;
    if (!next || host.contains(next)) return;
    close(false);
  }
  host.addEventListener("focusout", onFocusOut);

  function onKeyDown(event: KeyboardEvent): void {
    if (event.key !== "Escape" || !isOpen()) return;
    event.stopPropagation();
    close(true);
  }
  host.addEventListener("keydown", onKeyDown);

  function get(): ZoneFilter {
    return {
      days: { ...filter.days },
      dst: { ...filter.dst },
      sky: { ...filter.sky },
    };
  }

  function paint(toggle: Toggle, count: number, checked: boolean): void {
    const text = String(count);
    if (toggle.count.textContent !== text) toggle.count.textContent = text;
    const hide = !showToggle(count, checked);
    if (toggle.label.hidden === hide) return;
    /* Hiding the control a keyboard user is standing on drops focus to
       `<body>`, so the next Tab restarts from the top of the document. Rare —
       it needs the last zone in a bucket to roll over while that switch is
       focused — but it is the same loss of place the switches are built once
       to avoid, so it gets the same care. */
    if (hide && toggle.label.contains(document.activeElement)) summary.focus();
    toggle.label.hidden = hide;
  }

  return {
    get,
    isOpen,
    update(counts, shown, total) {
      for (const day of DAY_SHIFTS) {
        const toggle = dayToggles.get(day);
        if (toggle) paint(toggle, counts.days[day], filter.days[day]);
      }
      for (const state of DST_STATES) {
        const toggle = dstToggles.get(state);
        if (toggle) paint(toggle, counts.dst[state], filter.dst[state]);
      }
      for (const state of SKY_STATES) {
        const toggle = skyToggles.get(state);
        if (toggle) paint(toggle, counts.sky[state], filter.sky[state]);
      }
      const text =
        shown === total
          ? `Showing all ${total} zones`
          : `Showing ${shown} of ${total} zones`;
      if (status.textContent !== text) status.textContent = text;
    },
    destroy() {
      body.removeEventListener("change", onInput);
      summary.removeEventListener("click", onSummaryClick);
      host.removeEventListener("keydown", onKeyDown);
      host.removeEventListener("focusout", onFocusOut);
      document.removeEventListener("pointerdown", onDocumentPointerDown);
      host.replaceChildren();
    },
  };
}
