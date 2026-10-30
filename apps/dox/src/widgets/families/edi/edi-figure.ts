/**
 * The value taken apart (INT-15): a segment's parts, then each half of the value as boxes with
 * the standard's mask letters beneath and a bracket under each group.
 *
 * The fields and halves come from `~/lib/edi-picture` (a code's layout is read off the
 * formatter's own output, and the site holds no table of codes). This file only draws them.
 * Colour is the module's: a field names its group (`date`, `time`, `offset`), and no text is
 * coloured by it. A refused value is drawn in neutral boxes, never amber.
 */
import {
  type PicField,
  type PicGroup,
  type PicHalf,
  type PicPart,
} from "~/lib/edi-picture";
import { html, type SafeHtml } from "../../builders/html";
import { hold } from "./edi-hold";
import styles from "./edi-figure.module.css";

/** One picture's worth of fields. */
export interface FigureValue {
  /** The row of parts the value arrived in, above the breakdown. */
  parts?: readonly PicPart[];
  halves: readonly PicHalf[];
  /** What the standard sends between a period's halves. */
  separator: string;
  /** The words for a half's end when the code states no offset, `""` when it does. */
  closing: string;
}

/** What the figure draws: words when there is nothing to take apart, or a value. */
type FigureSpec =
  | { kind: "empty"; text: string }
  | ({ kind: "value"; aria: string } & FigureValue);

/** A space is shown as a middle dot so an empty-looking box is never empty. */
const boxText = (text: string): string => (text === "" ? "·" : text);

/** The characters a field's box reserves: its text or its mask. */
const fieldChars = (f: PicField): number =>
  Math.max(f.text.length, f.mask.length, 1);

function field(f: PicField): SafeHtml {
  return html`<span class="${styles.field}" data-group="${f.group}" style="--n:${fieldChars(f)}"
    ><span class="${styles.box}" data-none="${String(f.group === "none")}">${boxText(f.text)}</span
    ><span class="${styles.mask}">${f.mask === "" ? " " : f.mask}</span></span
  >`;
}

/** The bracket's words under a run of same-group fields. */
function groupLabel(group: PicGroup, fields: readonly PicField[]): string {
  const given = fields.find((f) => f.bracket !== undefined)?.bracket;
  if (given !== undefined) return given;
  if (group === "neutral" || group === "none") return "";
  if (group === "offset") {
    return fields.some((f) => f.mask === "ZZZ") ? "zone" : "offset";
  }
  return group;
}

/** Splits a half's fields into runs of one group. */
function runsOf(fields: readonly PicField[]): PicField[][] {
  const runs: PicField[][] = [];
  for (const f of fields) {
    const last = runs[runs.length - 1];
    if (last !== undefined && last[0]!.group === f.group) last.push(f);
    else runs.push([f]);
  }
  return runs;
}

function group(fields: readonly PicField[]): SafeHtml {
  const first = fields[0]!.group;
  const label = groupLabel(first, fields);
  return html`<span class="${styles.group}" data-group="${first}"
    ><span class="${styles.fields}">${fields.map(field)}</span
    ><span class="${styles.bracket}"
      ><span class="${styles.bracketLabel}">${label === "" ? " " : label}</span></span
    ></span
  >`;
}

/** The dashed group that says the code states no offset. */
function none(closing: string): SafeHtml {
  return html`<span class="${styles.group}" data-group="none"
    ><span class="${styles.fields}"
      ><span class="${styles.field}" data-group="none" style="--n:${closing.length}"
        ><span class="${styles.box}" data-none="true">${closing}</span
        ><span class="${styles.mask}"> </span></span
      ></span
    ><span class="${styles.bracket}"
      ><span class="${styles.bracketLabel}"> </span></span
    ></span
  >`;
}

/** The segment's parts as boxes with their captions beneath and the service characters between. */
function partsRow(parts: readonly PicPart[]): SafeHtml {
  return html`<span class="${styles.parts}"
    >${parts.map(
      (p) =>
        html`<span class="${styles.part}" data-kind="${p.kind}"
          ><span class="${styles.box}" data-none="false">${boxText(p.text)}</span
          ><span class="${styles.caption}">${p.caption}</span></span
        >${p.after === "" ? "" : html`<span class="${styles.punct}" aria-hidden="true">${p.after}</span>`}`,
    )}</span
  >`;
}

/**
 * The value taken apart: each half a row of groups. `closing` draws an empty group so the row
 * holds the same shape every time; `separator` is what the standard sends between a period's
 * halves.
 */
function takenApart(
  halves: readonly PicHalf[],
  separator: string,
  closing: string,
): SafeHtml {
  return html`<span class="${styles.taken}"
    >${halves.map((half, i) => {
      const last = i === halves.length - 1;
      return html`<span class="${styles.half}"
          >${half.label === "" ? "" : html`<span class="${styles.halfLabel}">${half.label}</span>`}<span class="${styles.groups}"
            >${runsOf(half.fields).map(group)}${last && closing !== "" ? none(closing) : ""}</span
          ></span
        >${!last && separator !== "" ? html`<span class="${styles.sep}" aria-hidden="true">${separator}</span>` : ""}`;
    })}</span
  >`;
}

const scaleOf = (v: FigureValue): "lg" | "md" =>
  v.halves.length === 1 ? "lg" : "md";

function valueBody(v: FigureValue): SafeHtml {
  return html`${v.parts === undefined ? "" : partsRow(v.parts)}${takenApart(v.halves, v.separator, v.closing)}`;
}

/** What the mount writes into the figure's live element. */
export function figureContent(spec: FigureSpec): SafeHtml {
  if (spec.kind === "empty") {
    return html`<p class="${styles.empty}" data-state="empty">${spec.text}</p>`;
  }
  return html`<div class="${styles.figure}" role="img" aria-label="${spec.aria}" data-state="value" data-scale="${scaleOf(spec)}"
    >${valueBody(spec)}</div
  >`;
}

interface EdiFigureOptions {
  id: string;
  spec: FigureSpec;
  /** The tallest pictures the region draws, built from literal fields (a layout reservation). */
  reserve: readonly FigureValue[];
}

/** The figure's box, with the pictures it can draw reserved in it. */
export function ediFigure(o: EdiFigureOptions): SafeHtml {
  return html`<div class="${styles.slot}"
    >${hold({
      id: o.id,
      content: figureContent(o.spec),
      ghosts: o.reserve.map(
        (v) =>
          html`<div class="${styles.figure}" data-scale="${scaleOf(v)}">${valueBody(v)}</div>`,
      ),
    })}</div
  >`;
}
