/**
 * storedSection: "Did your saved events move?", the saved-events section of a dated checker.
 *
 * A title, one plain line and three steps say what it is for; then the form and the answers. The
 * form is native controls (a textarea, a select, buttons), and the answers are `storedTable`
 * rows under a summary bar that holds the count, the stale-data note and the All / Only moved
 * toggle. The textarea starts with the example and the check runs once on load.
 *
 * The ids a mount reaches by `findWidget(...).part()` are `stored-lines`, `stored-zone-row`,
 * `stored-zone`, `stored-check`, `stored-example`, `stored-status`, `stored-summary`,
 * `stored-show-all`, `stored-show-moved`, `stored-stale`, `stored-truncated`, `stored-results`
 * and `stored-none`. The gates find the section, steps, head, toggle, form and table by
 * `data-gate`.
 */
import {
  STORED_MAX_BYTES,
  STORED_MAX_LINES,
} from "~/lib/clock-change-stored-lines";
import { presetRows, type StoredConfig } from "~/lib/clock-change-stored";
import { signedOffset } from "~/lib/clock-change-common";
import { button, buttonRow } from "../../builders/button";
import { disclosure } from "../../builders/disclosure";
import { gateAttr } from "../../builders/gate";
import { html, type SafeHtml } from "../../builders/html";
import { idScope } from "../../builders/ids";
import { field, hint, section } from "../../builders/layout";
import { select } from "../../builders/select";
import { grow } from "../../primitives/grow/grow";
import { markBad } from "./marks";
import styles from "./stored-section.module.css";

const STORED_BYTES_TEXT = STORED_MAX_BYTES.toLocaleString("en-US");

function steps(ex: StoredConfig["example"]): SafeHtml {
  const at = (offset: string) => `${ex.wallHm} ${signedOffset(offset)}`;
  const chip = (text: string) => html`<code>${text}</code>`;
  return html`<ol class="${styles.steps}" ${gateAttr("stored-steps")} aria-label="An example"
    ><li class="${styles.step}"
      ><span class="${styles.stepHead}">Booked before the change</span
      ><span>${`${Number(ex.wallHm.slice(0, 2))}:${ex.wallHm.slice(3)}, ${ex.dateText}, ${ex.city}`}, saved as ${chip(at(ex.savedOffset))}</span></li
    ><li class="${styles.step} ${styles.rule}"
      ><span class="${styles.stepHead}">New rule</span
      ><span>${ex.city} stays on ${chip(signedOffset(ex.newOffset))}</span></li
    ><li class="${styles.step} ${styles.now}"
      ><span class="${styles.stepHead}">Result</span
      ><span>The saved event shows as ${chip(ex.shownHm)}. ${markBad()} Fix: store ${chip(at(ex.newOffset))}</span></li
  ></ol>`;
}

/** The textarea of a saved-events form: native, named by the field's label. */
function savedLines(
  id: string,
  value: string,
  describedBy: string | undefined,
): SafeHtml {
  return html`<textarea
    class="${styles.lines}"
    id="${id}"
    rows="8"
    spellcheck="false"
    autocomplete="off"
    autocapitalize="off"
    ${describedBy === undefined ? "" : html`aria-describedby="${describedBy}"`}
    >${value}</textarea
  >`;
}

/** The All / Only moved filter: two native buttons, the pressed one is the filter. */
function showToggle(id: (local: string) => string): SafeHtml {
  return html`<div class="${styles.toggle}" ${gateAttr("stored-toggle")} role="group" aria-label="Show"
    ><button class="${styles.toggleButton}" type="button" id="${id("stored-show-all")}" aria-pressed="true">All</button
    ><button class="${styles.toggleButton}" type="button" id="${id("stored-show-moved")}" aria-pressed="false">Only moved</button
  ></div
  >`;
}

export function storedSection(config: StoredConfig): SafeHtml {
  const id = idScope(config.idPrefix);
  const example = config.example;
  const linesHint = hint(
    id("stored-lines-hint"),
    `Paste values like ${example.saved}. Up to ${STORED_MAX_LINES} lines.`,
  );
  const form = html`<div class="${styles.form}" ${gateAttr("stored-form")}
    >${field({
      id: id("stored-lines"),
      label: "Saved events, one per line",
      hint: linesHint,
      control: ({ id: controlId, describedBy }) =>
        savedLines(controlId, config.preset, describedBy),
    })}${disclosure({
      id: id("stored-formats"),
      label: "Accepted formats",
      className: styles.formats ?? "",
      children: html`<p class="${styles.formatsText}"
        >Up to ${STORED_MAX_LINES} lines and ${STORED_BYTES_TEXT} bytes. Forms: <code>${example.saved}</code>, <code>&lt;time&gt; &lt;zone&gt;</code>, or <code>&lt;time&gt;</code> with the zone picked below.</p
      >`,
    })}<div class="${styles.zoneRow}" id="${id("stored-zone-row")}" hidden
      >${field({
        id: id("stored-zone"),
        label: "Lines without a zone use",
        control: ({ id: controlId, describedBy }) =>
          select({
            id: controlId,
            describedBy,
            options: config.zones.map((zone) => ({ value: zone, label: zone })),
          }),
      })}</div
    >${buttonRow(
      html`${button({ id: id("stored-check"), label: "Check" })}${button({ id: id("stored-example"), label: "Reset example" })}`,
    )}<p class="${styles.status}" id="${id("stored-status")}" role="status"></p></div
  >`;
  const out = html`<div class="${styles.out}"
    ><div class="${styles.head}" ${gateAttr("stored-head")}
      ><p class="${styles.summary}" id="${id("stored-summary")}" role="status">Checking&hellip;</p
      >${showToggle(id)}<p class="${styles.stale}" id="${id("stored-stale")}" role="note" hidden></p></div
    ><p class="${styles.status}" id="${id("stored-truncated")}"></p
    >${grow(
      html`<div class="${styles.results}" id="${id("stored-results")}" style="--stored-rows: ${String(presetRows(config.preset))}"
        ><p class="${styles.placeholder}">Checking&hellip;</p></div
      >`,
    )}<p class="${styles.placeholder}" id="${id("stored-none")}" hidden>No line is left with this filter.</p></div
  >`;
  return section(
    {
      id: id("stored"),
      heading: "Did your saved events move?",
      level: 4,
      gate: "stored",
    },
    html`<p class="${styles.lead}">Apps often save a future event with the UTC offset that applied when it was booked. Where the rules changed, that saved offset is wrong, and the app shows the event an hour off.</p
      >${steps(example)}<div class="${styles.body}">${form}${out}</div>`,
  );
}
