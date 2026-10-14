/**
 * The leg form the Delivery Scheduler and the Journey Split share: one
 * fieldset for each of up to four legs, with the mode, the duration, the zone
 * the leg lands in, a scheduled departure and the handling time after the leg.
 *
 * The markup and the control helpers live here so the two tools cannot drift.
 * The roles are `mode-n`, `duration-n`, `zone-n`, `departure-n` and `dwell-n`,
 * and each fieldset is `leg-n`. The handling field is named `dwell-n` in the
 * DOM because the library's key is `dwellAfter`; its label is "Handling after".
 *
 * No gmt import. This module reaches no chart library, so a tool that only
 * needs the form never loads one.
 */

import { shortZoneLabel } from "./delivery-scheduler";
import type { DeliveryState } from "./delivery-scheduler";
import { TRANSPORT_MODES, transportIcon } from "./transport-icons";
import { TRANSPORT_ZONES, zoneOptionsHtml } from "./transport-widgets";
import { escapeAttr, escapeHtml, labelTextHtml } from "./widget-ui";

function modeDisplayLabel(mode: string): string {
  return mode.length === 0 ? mode : mode[0]!.toUpperCase() + mode.slice(1);
}

/** `<option>`s for a mode `<select>`, mirroring `zoneOptionsHtml`: a selected
 *  value the known list lacks (a caller's own free-text `mode` tag, which
 *  `scheduleDelivery` never validates) is appended rather than dropped. */
export function modeOptionsHtml(selected: string): string {
  const known: readonly string[] = TRANSPORT_MODES;
  const list =
    selected === "" || known.includes(selected) ? known : [...known, selected];
  return (
    `<option value=""${selected === "" ? " selected" : ""}>(none)</option>` +
    list
      .map(
        (m) =>
          `<option value="${escapeAttr(m)}"${m === selected ? " selected" : ""}>${escapeHtml(modeDisplayLabel(m))}</option>`,
      )
      .join("")
  );
}

/** Sets a mode `<select>`'s value, inserting a matching `<option>` first when
 *  `mode` is a custom tag the list does not already offer, so a permalink or
 *  chat seed's mode is never silently dropped. */
export function setModeSelect(
  el: HTMLSelectElement | null,
  mode: string,
): void {
  if (!el) return;
  if (mode !== "" && ![...el.options].some((o) => o.value === mode)) {
    const opt = document.createElement("option");
    opt.value = mode;
    opt.textContent = modeDisplayLabel(mode);
    el.append(opt);
  }
  el.value = mode;
}

/** `①②③④`: a leg's own number badge, plain Unicode circled digits so no
 *  image or extra markup is needed. */
const LEG_NUMERALS = ["①", "②", "③", "④"];

/** `data-leg="N"` (1-4, cycling past 4): the attribute every leg-coloured
 *  element carries. `legIndex` is 0-based. */
export function legAccentAttr(legIndex: number): string {
  return ` data-leg="${(legIndex % LEG_NUMERALS.length) + 1}"`;
}

export interface LegHeaderFields {
  mode: string;
  duration: string;
  timeZone: string;
}

/** `① Truck · PT46H → Los Angeles`: the leg's own header, refreshed whenever
 *  its mode, duration or arrival zone changes. The mode falls back to "Leg"
 *  when blank, and the duration and the arrival city are each dropped when not
 *  yet typed, so a fresh leg reads as `① Leg`. */
export function legHeaderHtml(n: number, leg: LegHeaderFields): string {
  const trimmedMode = leg.mode.trim();
  const modeLabel = trimmedMode === "" ? "Leg" : modeDisplayLabel(trimmedMode);
  const duration = leg.duration.trim();
  const city = leg.timeZone.trim();
  const tail = [
    duration !== "" ? escapeHtml(duration) : "",
    city !== "" ? `→ ${escapeHtml(shortZoneLabel(city))}` : "",
  ]
    .filter((s) => s !== "")
    .join(" ");
  return (
    `<span class="gmt-delivery-leg-number"${legAccentAttr(n - 1)}>${LEG_NUMERALS[n - 1]}</span> ` +
    transportIcon(trimmedMode, { className: "gmt-delivery-leg-icon" }) +
    escapeHtml(modeLabel) +
    (tail !== "" ? ` · ${tail}` : "")
  );
}

/** The fieldset for leg `n` (1-based); hidden when `n` is past `count`. */
export function legFieldset(
  n: number,
  state: DeliveryState,
  count: number,
): string {
  const leg = state.legs[n - 1]!;
  const hidden = n > count ? " hidden" : "";
  const departureLabel = n === 1 ? "Departs" : "Scheduled departure";

  const textField = (
    role: string,
    wide: boolean,
    label: string,
    value: string,
    optional: boolean,
  ) =>
    `<label class="gmt-label${wide ? " gmt-field-wide" : ""}">${labelTextHtml(label, { optional })}` +
    `<input class="gmt-input" data-role="${role}-${n}" type="text" spellcheck="false" autocomplete="off" value="${escapeAttr(value)}"></label>`;

  const modeField =
    `<label class="gmt-label">${labelTextHtml("Mode", { optional: true })}` +
    `<select class="gmt-select" data-role="mode-${n}">${modeOptionsHtml(leg.mode)}</select></label>`;

  const arrivesField =
    `<label class="gmt-label">${labelTextHtml("Arrives in")}` +
    `<select class="gmt-select" data-role="zone-${n}">${zoneOptionsHtml(TRANSPORT_ZONES, leg.timeZone)}</select></label>`;

  return (
    `<fieldset class="gmt-transport-leg gmt-delivery-leg-fieldset" data-role="leg-${n}"${legAccentAttr(n - 1)}${hidden}>` +
    `<legend><span data-role="leg-legend-${n}">${legHeaderHtml(n, leg)}</span></legend>` +
    `<div class="gmt-field-grid">` +
    modeField +
    textField("duration", false, "Duration", leg.duration, false) +
    arrivesField +
    textField("departure", true, departureLabel, leg.departure, n !== 1) +
    textField("dwell", false, "Handling after", leg.dwellAfter, true) +
    `</div>` +
    `</fieldset>`
  );
}
