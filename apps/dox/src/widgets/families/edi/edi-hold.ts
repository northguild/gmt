/**
 * hold: a region whose content changes with the preset or the typed value, in a box that keeps
 * the size of the largest thing it can show.
 *
 * The live element is the one the mount writes to. It stays in the page for the widget's whole
 * life, so a live-region role on it still announces. Every thing the region can show (`ghosts`)
 * is also written into the same grid cell, hidden and `aria-hidden`, so the cell is as large as
 * the largest at whatever width it has and nothing below it moves when the content changes. The
 * ghosts never change, so the template writes them once and the mount never touches them.
 */
import { gateAttr } from "../../builders/gate";
import { html, type SafeHtml } from "../../builders/html";
import styles from "./edi-hold.module.css";

interface HoldOptions {
  /** The live element's id; the mount finds it by this. */
  id: string;
  /**
   * What the live element is: `status` for an answer a reader should hear change, `note` for a
   * sentence that changes quietly, none when its content names itself (a frame, a figure).
   */
  role?: "status" | "note";
  /** The live element's name; required with a `role`. */
  label?: string;
  /** What is shown now; may be empty. */
  content: SafeHtml;
  /** Every thing the region can show, so the box is as large as the largest. */
  ghosts: readonly SafeHtml[];
}

export function hold(o: HoldOptions): SafeHtml {
  const role =
    o.role === undefined
      ? ""
      : html`role="${o.role}" aria-label="${o.label ?? ""}"`;
  return html`<div class="${styles.hold}" ${gateAttr("hold")}
    ><div class="${styles.live}" id="${o.id}" ${role}>${o.content}</div
    >${o.ghosts.map(
      (ghost) =>
        html`<div class="${styles.ghost}" aria-hidden="true" data-pagefind-ignore>${ghost}</div>`,
    )}</div
  >`;
}

interface HoldTextOptions {
  id: string;
  role: "status" | "note";
  label: string;
  text: string;
  /** Every sentence the region can show. */
  samples: readonly string[];
}

/** A sentence in a hold. The mount sets the live element's `textContent`. */
export function holdText(o: HoldTextOptions): SafeHtml {
  return html`<div class="${styles.text}"
    >${hold({
      id: o.id,
      role: o.role,
      label: o.label,
      content: html`${o.text}`,
      ghosts: [...new Set(o.samples)].map((s) => html`${s}`),
    })}</div
  >`;
}
