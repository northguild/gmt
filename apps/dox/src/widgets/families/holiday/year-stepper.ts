/**
 * yearStepper: a year as a native text field with a step button either side, so a year moves
 * by one without a drag. The label names the field; the buttons name what they do
 * ("Previous year", "Next year"). The buttons' ids are `${id}-prev` and `${id}-next`.
 */
import { html, type SafeHtml } from "../../builders/html";
import styles from "./year-stepper.module.css";

export interface YearStepperOptions {
  id: string;
  label: string;
  value: string;
  /** The lowest and highest year the field offers to its arrow keys. */
  min: number;
  max: number;
  prevLabel: string;
  nextLabel: string;
  /** The id of a hint that describes the field. */
  describedBy?: string;
}

export function yearStepper(o: YearStepperOptions): SafeHtml {
  return html`<div class="${styles.stepper}"
    ><label class="${styles.label}" for="${o.id}">${o.label}</label
    ><div class="${styles.row}"
      ><button class="${styles.step}" type="button" id="${o.id}-prev" aria-label="${o.prevLabel}">−</button
      ><span class="${styles.field}"><input
          class="${styles.input}"
          type="number"
          id="${o.id}"
          value="${o.value}"
          min="${String(o.min)}"
          max="${String(o.max)}"
          step="1"
          inputmode="numeric"
          autocomplete="off"
          ${o.describedBy === undefined ? "" : html`aria-describedby="${o.describedBy}"`}
        /></span
      ><button class="${styles.step}" type="button" id="${o.id}-next" aria-label="${o.nextLabel}">+</button
      ></div
    ></div
  >`;
}
