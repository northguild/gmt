/**
 * legFieldset: one leg of a multi-leg journey as a named group of five typed fields.
 *
 * The mode, the duration, the zone the leg lands in, a scheduled departure and the handling
 * time after the leg. The group's name is its legend, a header such as `① Truck · PT46H →
 * Adelaide` that the mount refreshes with `legHeader` whenever a field it shows changes. The
 * handling field is `dwellAfter` in the library; on screen it is "Handling after".
 *
 * Every field is a native control behind a `<label for>`. A mode or zone the lists lack (a
 * caller's own free-text tag, or a zone from a permalink) is added to its select, never
 * dropped: `modeChoices` and `zoneChoices` do it for the first paint and `setChoice` for a
 * value set later.
 */
import { shortZoneLabel } from "~/lib/delivery-scheduler";
import type { LegFields } from "~/lib/transport-widgets";
import { TRANSPORT_MODES } from "~/lib/transport-icons";
import { html, type SafeHtml } from "../../builders/html";
import { field, fieldGrid } from "../../builders/layout";
import { select, type SelectOption } from "../../builders/select";
import { textInput } from "../../builders/text-input";
import { modeIcon } from "./transport-icon";
import styles from "./leg-fieldset.module.css";

/** A leg's own number as a circled digit: plain Unicode, so no image is needed. */
const NUMERALS = ["①", "②", "③", "④"] as const;

/** The name of a mode on screen: the tag with its first letter in capitals. */
export function modeLabel(mode: string): string {
  return mode.length === 0 ? mode : mode[0]!.toUpperCase() + mode.slice(1);
}

/** The mode select's options: "(none)", the known modes, and the selected tag when it is none of them. */
export function modeChoices(selected: string): SelectOption[] {
  const known: readonly string[] = TRANSPORT_MODES;
  const list =
    selected === "" || known.includes(selected) ? known : [...known, selected];
  return [
    { value: "", label: "(none)" },
    ...list.map((m) => ({ value: m, label: modeLabel(m) })),
  ];
}

/** A zone select's options: the list, with the selected zone added when the list lacks it. */
export function zoneChoices(
  zones: readonly string[],
  selected: string,
  noneLabel?: string,
): SelectOption[] {
  const list =
    selected === "" || zones.includes(selected) ? zones : [...zones, selected];
  return [
    ...(noneLabel === undefined ? [] : [{ value: "", label: noneLabel }]),
    ...list.map((z) => ({ value: z, label: z })),
  ];
}

/** Set a select's value, adding a matching option first (named `text`, else the value) when none offers it. */
export function setChoice(
  el: HTMLSelectElement,
  value: string,
  text: string = value,
): void {
  if (value !== "" && ![...el.options].some((o) => o.value === value)) {
    el.append(new Option(text, value));
  }
  el.value = value;
}

export interface LegHeaderFields {
  mode: string;
  duration: string;
  timeZone: string;
}

/**
 * `① Truck · PT46H → Los Angeles`. The mode reads "Leg" when blank, and the duration and the
 * arrival city are each left out until typed, so a fresh leg reads `① Leg`.
 */
export function legHeader(n: number, leg: LegHeaderFields): SafeHtml {
  const mode = leg.mode.trim();
  const duration = leg.duration.trim();
  const zone = leg.timeZone.trim();
  const tail = [
    duration,
    zone === "" ? "" : `→ ${shortZoneLabel(zone)}`,
  ].filter((s) => s !== "");
  return html`<span class="${styles.number}" data-leg="${n}">${NUMERALS[(n - 1) % NUMERALS.length]}</span> ${modeIcon(mode)}${mode === "" ? "Leg" : modeLabel(mode)}${tail.length === 0 ? "" : ` · ${tail.join(" ")}`}`;
}

export interface LegFieldsetOptions {
  /** The widget's id scope: the fieldset and its fields take ids from it. */
  id: (local: string) => string;
  /** The leg's number, from 1. */
  n: number;
  leg: LegFields;
  /** Hidden when the journey has fewer legs than this one. */
  hidden: boolean;
  /** The zones the arrival select offers. */
  zones: readonly string[];
}

/** The ids a leg's parts take: `leg-1`, `leg-legend-1`, `mode-1`, `duration-1`, `zone-1`, `departure-1`, `dwell-1`. */
export function legFieldset(o: LegFieldsetOptions): SafeHtml {
  const { id, n, leg } = o;
  const departure = n === 1 ? "Departs" : "Scheduled departure (optional)";
  const typed = (local: string, label: string, value: string): SafeHtml =>
    field({
      id: id(`${local}-${n}`),
      label,
      control: ({ id: cid }) =>
        textInput({
          id: cid,
          value,
          autocomplete: "off",
          spellcheck: false,
        }),
    });

  return html`<fieldset class="${styles.leg}" id="${id(`leg-${n}`)}" data-leg="${n}" ${o.hidden ? html`hidden` : ""}>
    <legend><span id="${id(`leg-legend-${n}`)}">${legHeader(n, leg)}</span></legend>
    ${fieldGrid(
      html`${field({
        id: id(`mode-${n}`),
        label: "Mode (optional)",
        control: ({ id: cid }) =>
          select({ id: cid, value: leg.mode, options: modeChoices(leg.mode) }),
      })}${typed("duration", "Duration", leg.duration)}${field({
        id: id(`zone-${n}`),
        label: "Arrives in",
        control: ({ id: cid }) =>
          select({
            id: cid,
            value: leg.timeZone,
            options: zoneChoices(o.zones, leg.timeZone),
          }),
      })}<div class="${styles.wide}">${typed("departure", departure, leg.departure)}</div>${typed("dwell", "Handling after (optional)", leg.dwellAfter)}`,
    )}
  </fieldset>`;
}
