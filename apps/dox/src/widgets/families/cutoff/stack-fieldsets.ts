/**
 * cutoffFieldset and closedDaysFieldset: the two kinds of group in the Cut-off Stack's form.
 *
 * `cutoffFieldset` is one cut-off of the stack: a group named "Cut-off 1" holding its name,
 * its offset and, optionally, the local time it is pinned to. `closedDaysFieldset` is the
 * calendar: a switch to use one, the weekend as a set of day chips, the holidays as ISO
 * dates, and the roll that moves a cut-off off a closed day. Every control is native and sits
 * behind a `<label for>`; a roll the list lacks is added by the caller's seed, never dropped.
 */
import { WEEKDAYS, ROLL_OPTIONS } from "~/lib/cutoff-widgets";
import { html, type SafeHtml } from "../../builders/html";
import { field, fieldGrid, hint } from "../../builders/layout";
import { select } from "../../builders/select";
import { switchField } from "../../builders/switch-field";
import { textInput } from "../../builders/text-input";
import { chips } from "../../primitives/chips/chips";
import styles from "./stack-fieldsets.module.css";

export interface CutoffFieldValues {
  name: string;
  offset: string;
  atLocalTime: string;
}

export interface CutoffFieldsetOptions {
  /** The widget's id scope; the parts take `name-1`, `offset-1`, `at-1` from it. */
  id: (local: string) => string;
  /** The cut-off's number, from 1. */
  n: number;
  values: CutoffFieldValues;
}

export function cutoffFieldset(o: CutoffFieldsetOptions): SafeHtml {
  const { id, n, values } = o;
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
  return html`<fieldset class="${styles.group}" id="${id(`cutoff-${n}`)}" data-series="${n}">
    <legend>Cut-off ${n}</legend>
    ${fieldGrid(
      html`${typed("name", "Name", values.name)}${typed("offset", "Offset", values.offset)}${typed("at", "At local time (optional)", values.atLocalTime)}`,
    )}
  </fieldset>`;
}

export interface ClosedDaysValues {
  calendar: boolean;
  /** ISO weekday numbers, 1 (Monday) to 7 (Sunday). */
  weekend: readonly number[];
  holidays: string;
  roll: string;
}

export interface ClosedDaysOptions {
  id: (local: string) => string;
  values: ClosedDaysValues;
}

const ROLL_HINT =
  "A roll moves a cut-off off a closed day: preceding back to the last open day, following on to the next. The two modified forms turn round when that would leave the month. none leaves it where it is. There is no default: a calendar without a roll, or a roll without a calendar, returns [].";

/** The roll select's options: "(not given)", the rolls the library knows, and the selected one when none of them. */
export function rollChoices(
  selected: string,
): { value: string; label: string }[] {
  const list =
    selected === "" || ROLL_OPTIONS.includes(selected)
      ? ROLL_OPTIONS
      : [...ROLL_OPTIONS, selected];
  return [
    { value: "", label: "(not given)" },
    ...list.map((r) => ({ value: r, label: r })),
  ];
}

export function closedDaysFieldset(o: ClosedDaysOptions): SafeHtml {
  const { id, values } = o;
  return html`<fieldset class="${styles.group}" id="${id("closed-days")}">
    <legend>Closed days</legend>
    ${switchField({
      id: id("calendar"),
      label: "Use a business calendar",
      checked: values.calendar,
    })}
    ${chips({
      legend: "Weekend",
      kind: "checkbox",
      name: id("weekend"),
      items: WEEKDAYS.map((w) => ({
        value: String(w.value),
        label: w.label,
        checked: values.weekend.includes(w.value),
      })),
    })}
    ${fieldGrid(
      html`<div class="${styles.wide}">${field({
        id: id("holidays"),
        label: "Holidays",
        hint: hint(id("holidays-hint"), "ISO dates, separated by commas"),
        control: ({ id: cid, describedBy }) =>
          textInput({
            id: cid,
            value: values.holidays,
            autocomplete: "off",
            spellcheck: false,
            placeholder: "2024-05-09, 2024-12-25",
            describedBy,
          }),
      })}</div>${field({
        id: id("roll"),
        label: "Roll a closed-day cut-off",
        hint: hint(id("roll-hint"), ROLL_HINT),
        control: ({ id: cid, describedBy }) =>
          select({
            id: cid,
            value: values.roll,
            options: rollChoices(values.roll),
            describedBy,
          }),
      })}`,
    )}
  </fieldset>`;
}
