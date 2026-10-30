/**
 * holidayFrame: the holiday family's chart surface, a bordered panel that holds the plates,
 * the month grid, the legend and the notes. It is an inline-size container, so the pieces
 * inside it lay out by its width (the docs column and the chat rail alike).
 */
import { gateAttr, type GateOption } from "../../builders/gate";
import { html, type SafeHtml } from "../../builders/html";
import { grow } from "../../primitives/grow/grow";
import styles from "./holiday-frame.module.css";

/** In a `<gmt-grow>`: the mount fills the plates and the grid, so the frame eases to its height. */
export function holidayFrame(children: SafeHtml, o: GateOption = {}): SafeHtml {
  return grow(
    html`<div class="${styles.frame}" ${gateAttr(o.gate)}>${children}</div>`,
  );
}
