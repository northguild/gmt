/**
 * The Zone Planner's chrome, and the few constants and words it shares with its mount.
 *
 * This module imports no polyfill and no coordinate table. The planner's page shell and the
 * `/dox` chat both render the template from here, and the heavy half (`lib/multi-zone-scrubber`)
 * loads only when a planner is on screen, so neither pays for the Temporal polyfill or the
 * zone list up front. The add field starts with no choices; the mount fills them.
 */
import {
  button,
  buttonRow,
  field,
  fieldGrid,
  html,
  idScope,
  section,
  widget,
  type SafeHtml,
} from "~/widgets/builders";
import { combobox } from "~/widgets/primitives/combobox/combobox";
import { copy } from "~/widgets/primitives/copy/copy";
import { grow } from "~/widgets/primitives/grow/grow";
import { range } from "~/widgets/primitives/range/range";
import { readout } from "~/widgets/primitives/readout/readout";
import styles from "~/widgets/tools/multi-zone-scrubber.module.css";
import { utcDatetimeInput } from "./utc-datetime-input";

const SCRUBBER_WIDGET_NAME = "multi-zone-scrubber";

/** The slider spans this many minutes either side of the reference time (36 h). */
export const SLIDER_RANGE_MIN = 36 * 60;

/** The granularity of everything the reader can move: the slider's step, the reference-time
 *  field's own step, and what a seeded or restored anchor is rounded to. Named once and
 *  derived everywhere, so two steppers cannot disagree. */
export const SLIDER_STEP_MIN = 5;

/** The slider's shift as a signed, worded offset: `+1 h 15 min`, `−45 min`, `0 min`. */
export function formatShift(minutes: number): string {
  if (minutes === 0) return "0 min";
  const sign = minutes < 0 ? "−" : "+";
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${sign}${[h ? `${h} h` : "", m ? `${m} min` : ""].filter(Boolean).join(" ")}`;
}

export const SHIFT_LABEL = `Shift every pinned clock, in ${SLIDER_STEP_MIN}-minute steps`;

/** A reading as wide as the planner's longest, so the box is that wide from the first paint. */
const READOUT_SAMPLE = "Wed 30 Dec 2026, 23:55 UTC";

/** The widget's chrome. The tiles, the marks and every value are drawn by the mount. */
export function renderScrubberTemplate(idPrefix: string): SafeHtml {
  const id = idScope(idPrefix);

  const pick = section(
    { id: id("pick"), heading: "1. Pin the zones and pick a time", level: 4 },
    html`${fieldGrid(
      html`${field({
        id: id("anchor"),
        label: "Reference time (UTC)",
        control: ({ id: cid, describedBy }) =>
          utcDatetimeInput({
            id: cid,
            describedBy,
            step: SLIDER_STEP_MIN * 60,
            gate: "live",
          }),
      })}${field({
        id: id("add"),
        label: "Add a zone",
        control: ({ id: cid, describedBy }) =>
          combobox({
            id: cid,
            describedBy,
            label: "Add a zone",
            items: [],
            placeholder: "e.g. Australia/Sydney",
            browseLabel: "Browse every zone",
          }),
      })}`,
    )}${buttonRow(
      html`${button({ id: id("jump"), label: "Jump to the next DST transition" })}${button(
        {
          id: id("reset"),
          label: "Reset to today",
          describedBy: id("reset-hint"),
        },
      )}<span class="gmt-sr-only" id="${id("reset-hint")}">Set the reference time to now, rounded forward to the next ${String(SLIDER_STEP_MIN)} minutes</span>`,
    )}<p class="${styles.jumpStatus}" id="${id("jump-status")}" data-gate="live"></p
    ><p class="gmt-sr-only" role="status" aria-label="Zone Planner announcements" id="${id("live")}"></p
    ><div class="${styles.slider}"
      ><span class="${styles.marks}" id="${id("marks")}" data-gate="live" aria-hidden="true"></span
      >${range({
        id: id("shift"),
        label: SHIFT_LABEL,
        min: -SLIDER_RANGE_MIN,
        max: SLIDER_RANGE_MIN,
        step: SLIDER_STEP_MIN,
        value: 0,
        valueText: formatShift(0),
        ends: [formatShift(-SLIDER_RANGE_MIN), formatShift(SLIDER_RANGE_MIN)],
      })}</div
    >${readout({
      label: "Reference time plus the shift",
      value: " ",
      samples: [READOUT_SAMPLE],
      gate: "live",
    })}<div class="${styles.share}"
      ><span aria-hidden="true">Copy shareable link</span>${copy({
        label: "Copy shareable link",
        text: "",
        reveal: true,
      })}</div
    >`,
  );

  const clocks = section(
    { id: id("clocks"), heading: "2. Every pinned clock", level: 4 },
    grow(
      html`<div class="${styles.rows}" id="${id("rows")}" role="group" aria-label="Pinned zones"></div>`,
      {
        gate: "grow",
      },
    ),
  );

  return widget(
    { name: SCRUBBER_WIDGET_NAME, label: "Zone Planner", scope: idPrefix },
    html`${pick}${clocks}`,
  );
}
