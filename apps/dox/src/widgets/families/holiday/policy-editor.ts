/**
 * policyEditor: an observance policy as seven native `<select>`s, one per ISO weekday, in a
 * native `<details>` whose summary is the folded line ("Sat → Fri, Sun → Mon", or "No shift").
 *
 * Each select offers no shift, the previous and the next of every other weekday, and the next
 * working day; a weekday's own day is left out of its previous and next options. A policy a
 * select cannot offer (a shift onto its own weekday, read from a link) keeps its option, so
 * the editor never shows "no shift" for a policy that has one; the library judges it.
 *
 * The selects' ids are `${id}-${weekday}` (1 to 7), so the mount reads them by id. At 28rem
 * and up the controls are open and the summary is a plain line; under it the mount closes the
 * details and the summary is the control.
 */
import type { ObservancePolicy } from "@northguild/gmt";
import {
  policySummary,
  selectValueOf,
  weekdayShort,
} from "~/lib/holiday-widgets";
import { field } from "../../builders/layout";
import { html, type SafeHtml } from "../../builders/html";
import { select } from "../../builders/select";
import styles from "./policy-editor.module.css";

const ISO_WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;

export interface PolicyEditorOptions {
  /** The details' id; each select's id is `${id}-${weekday}`. */
  id: string;
  policy: ObservancePolicy;
  /** The visible, readable label of the editor (the details' name). Required. */
  label: string;
  /** Draw the details closed, on a narrow row. */
  folded?: boolean;
}

function optionLabel(value: string): string {
  if (value === "") return "no shift";
  if (value === "w") return "next working day";
  return `${value[0] === "<" ? "previous" : "next"} ${weekdayShort(Number(value.slice(1)))}`;
}

/** The select's id for a weekday. */
export const policySelectId = (id: string, weekday: number): string =>
  `${id}-${weekday}`;

export function policyEditor(o: PolicyEditorOptions): SafeHtml {
  const selects = ISO_WEEKDAYS.map((weekday) => {
    const current = selectValueOf(o.policy, weekday);
    const offered: string[] = [""];
    for (const other of ISO_WEEKDAYS)
      if (other !== weekday) offered.push(`<${other}`);
    for (const other of ISO_WEEKDAYS)
      if (other !== weekday) offered.push(`>${other}`);
    offered.push("w");
    if (!offered.includes(current)) offered.push(current);
    return field({
      id: policySelectId(o.id, weekday),
      label: weekdayShort(weekday),
      control: ({ id }) =>
        select({
          id,
          value: current,
          options: offered.map((value) => ({
            value,
            label: optionLabel(value),
          })),
        }),
    });
  });
  return html`<div class="${styles.policy}"
    ><details
      class="${styles.details}"
      id="${o.id}"
      aria-label="${o.label}"
      ${o.folded === true ? "" : html`open`}
      ><summary class="${styles.summary}">${policySummary(o.policy)}</summary
      ><div class="${styles.grid}">${selects}</div></details
    ></div
  >`;
}
