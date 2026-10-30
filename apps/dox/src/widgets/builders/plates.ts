/**
 * plates: a row of captioned results.
 *
 * A `<dl>`: each plate is a `<div>` holding a term (the caption) and its
 * definitions (the value, then the sub lines), so every number is read with its
 * name. The old row was `aria-hidden` with a hidden sentence beside it; this one
 * is the sentence.
 *
 * Two states, and they differ on purpose (invariant 7). `value: null` is the
 * library returning nothing for this plate: it keeps its box and reads
 * "no result" in the muted ink, with its lines blank. That is a plain empty
 * answer, not a signal-lost one, so it is never amber.
 *
 * A plate holds still: the caption and value reserve the widest text they can show
 * (`captions`, `samples`) in one grid cell, hidden, and the lines keep their height
 * when blank (invariant 14).
 */
import { gateAttr, type GateOption } from "./gate";
import { html, type SafeHtml } from "./html";
import styles from "./plates.module.css";

/** What a plate reads when the library returned nothing for it. */
export const NO_RESULT = "no result";

export interface Plate {
  /** The term. Required. */
  caption: string;
  /** The answer in words, or `null` for no result. */
  value: string | null;
  /** Sub lines, one definition each. They stay (blank) when the plate is empty. */
  lines: readonly string[];
  /** The colour bar along the plate's bottom edge, never the text. */
  series?: 1 | 2 | 3 | 4;
  /** A secondary result, at the smaller value size. */
  quiet?: boolean;
  /** Every caption this plate can show, when the caption follows a choice. */
  captions?: readonly string[];
  /** The widest values it can show, to reserve their width. */
  samples?: readonly string[];
  /**
   * For each line, the longest texts it can show, to reserve their wrap. A line whose words
   * change with the reading (`read from GAL` against `as typed`) would otherwise wrap in a
   * narrow plate for one reading and not for the next. A line with nothing listed is not held.
   */
  lineSamples?: readonly (readonly string[] | undefined)[];
}

function ghosts(list: readonly string[], cls: string): SafeHtml[] {
  return [...new Set(list)].map(
    (text) => html`<span class="${cls}" aria-hidden="true">${text}</span>`,
  );
}

function plate(p: Plate): SafeHtml {
  const empty = p.value === null;
  return html`<div
    class="${styles.plate}"
    data-state="${empty ? "empty" : "live"}"
    data-series="${p.series ?? 1}"
    data-quiet="${String(p.quiet === true)}"
    ><dt class="${styles.caption}"
      ><span class="${styles.shown}">${p.caption}</span
      >${ghosts(p.captions ?? [], styles.ghost!)}</dt
    ><dd class="${styles.value}"
      ><span class="${styles.shown}">${empty ? NO_RESULT : p.value}</span
      >${ghosts(p.samples ?? [], styles.ghost!)}</dd
    >${p.lines.map(
      (text, i) =>
        html`<dd class="${styles.line}"><span class="${styles.shown}">${empty ? "" : text}</span
          >${ghosts(p.lineSamples?.[i] ?? [], styles.ghost!)}</dd>`,
    )}</div
  >`;
}

export function plates(list: readonly Plate[], o: GateOption = {}): SafeHtml {
  return html`<dl class="${styles.root}" ${gateAttr(o.gate)}>${list.map(plate)}</dl>`;
}
