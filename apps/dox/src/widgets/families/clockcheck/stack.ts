/**
 * stack: the frame of a dated clock-change checker's page.
 *
 * `stack` is the query container for the whole page (`gmt-clockcheck`, inline size): one column
 * below 48rem, and from there each `row` is two columns. `row` holds two cards that stretch to one
 * height. Prose in a card stops at 70ch. The zone map reads the same container for its own
 * breakpoints, so a card never asks the viewport.
 */
import { gateAttr } from "../../builders/gate";
import { html, type SafeHtml } from "../../builders/html";
import styles from "./stack.module.css";

export function stack(children: SafeHtml): SafeHtml {
  return html`<div class="${styles.stack}" ${gateAttr("stack")}>${children}</div>`;
}

interface RowOptions {
  /** The top row: its first card is the wider one, because the second holds a table. */
  top?: boolean;
}

export function row(children: SafeHtml, o: RowOptions = {}): SafeHtml {
  return html`<div class="${o.top === true ? styles.top : styles.row}">${children}</div>`;
}
