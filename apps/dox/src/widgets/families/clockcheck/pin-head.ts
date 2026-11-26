/**
 * The head of a pin panel, shared by the checkers' map and the US page: the pinned place's name
 * over a note (its class), with a crystal clock beside them when `clockId` is given. The name and
 * the note are each a one-entry `dl`, so a screen reader hears what each value is. The block owns
 * the layout and the held lines (`pin-head.module.css`); `className` on a part sets only its type.
 */
import { gateAttr } from "../../builders/gate";
import { html, type HtmlValue, type SafeHtml } from "../../builders/html";
import styles from "./pin-head.module.css";

export interface PinHeadPart {
  /** The term a screen reader hears before the value (shown to no one). */
  label: string;
  /** The value's id, for the mount to fill. */
  id?: string;
  /** The page's type for the value: font, colour, wrapping. */
  className?: string;
  /** The value's `data-gate`. */
  gate?: string;
  content: HtmlValue;
}

export interface PinHeadOptions {
  /** The clock face's id; leave it out for a head without a clock. */
  clockId?: string;
  name: PinHeadPart;
  note: PinHeadPart;
}

function part(slot: string, value: string, p: PinHeadPart): SafeHtml {
  return html`<dl class="${slot}">
    <div>
      <dt class="gmt-sr-only">${p.label}</dt>
      <dd
        class="${styles.value} ${value} ${p.className ?? ""}"
        ${p.id === undefined ? "" : html`id="${p.id}"`}
        ${gateAttr(p.gate)}
      >${p.content}</dd>
    </div>
  </dl>`;
}

export function pinHead(o: PinHeadOptions): SafeHtml {
  const withClock = o.clockId !== undefined;
  return html`<div class="${styles.head} ${withClock ? styles.headClock : ""}">
    ${
      withClock
        ? html`<div class="${styles.clock}" id="${o.clockId}" aria-hidden="true"></div>`
        : ""
    }
    ${part(styles.name!, styles.nameValue!, o.name)}
    ${part(styles.note!, styles.noteValue!, o.note)}
  </div>`;
}
