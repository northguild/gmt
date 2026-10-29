/**
 * The Duration Parser Bench's own small builders: the text box with a length cap, the Try
 * buttons, the ten-field strip, the facts list and the cell a result sits in.
 *
 * Each is a native element with its own name and state. A result that is missing is the
 * amber, bracketed `⟨ NO SIGNAL ⟩` chip and never a blank; a result that is simply not there
 * because its call was not made says `not called` in dim text, so the two read differently.
 */
import { html, raw, type SafeHtml } from "../../builders/html";
import { textInput } from "../../builders/text-input";
import styles from "./bench-parts.module.css";

/** The sentinel a missing answer shows: the library gave `""` or `null`. */
export const CELL_NO_SIGNAL = "⟨ NO SIGNAL ⟩";
/** The whole-result sentinel for a string neither parser reads. */
export const RESULT_NO_SIGNAL = "⟨ NO SIGNAL — invalid input ⟩";
/** What a line reads when the call behind it was not made. */
export const NOT_CALLED_TEXT = "not called";
export const SAME_DURATION_TEXT = "returns the same duration";
export const DIFFERENT_DURATION_TEXT = "returns a different duration";

export interface BoundedTextInputOptions {
  /** The id `field()` hands the control. */
  id: string;
  value: string;
  /** The longest string the box takes. */
  max: number;
  describedBy?: string | undefined;
}

/**
 * The kit's text input with a `maxlength`. The kit's input has no length option, so the
 * attribute is written onto its markup; the number is typed, never read from text.
 */
export function boundedTextInput(o: BoundedTextInputOptions): SafeHtml {
  const input = textInput({
    id: o.id,
    value: o.value,
    autocomplete: "off",
    spellcheck: false,
    describedBy: o.describedBy,
  }).toString();
  return raw(
    input.replace("<input", `<input maxlength="${Math.trunc(o.max)}"`),
  );
}

export interface TryButtonsOptions {
  /** The group's visible name. */
  label: string;
  /** What each button writes into the box; also what it says. */
  values: readonly string[];
}

/**
 * A group of plain buttons that each fill a text box. A button's `value` is the string it
 * writes, so the mount reads it from the button that was clicked.
 */
export function tryButtons(o: TryButtonsOptions): SafeHtml {
  return html`<fieldset class="${styles.tryGroup}"
    ><legend class="${styles.legend}">${o.label}</legend
    >${o.values.map(
      (v) =>
        html`<button class="${styles.tryButton}" type="button" value="${v}">${v}</button>`,
    )}</fieldset
  >`;
}

export interface StripCell {
  field: string;
  /** The grammar's shortest written symbol, or `null` for a unit with no spelling. */
  symbol: string | null;
  /** The field's value, or `null` when there was no duration to read. */
  value: number | null;
  lit: boolean;
  /** What the cell's title says. */
  title: string;
}

export interface UnitStripOptions {
  /** The list's name. */
  label: string;
  /** What a unit with no spelling shows in place of a symbol. */
  noSpelling: string;
  cells: readonly StripCell[];
}

/** The ten fields of a duration, in order. A lit field holds a non-zero value. */
export function unitStrip(o: UnitStripOptions): SafeHtml {
  return html`<ol class="${styles.strip}" aria-label="${o.label}"
    >${o.cells.map(
      (c) =>
        html`<li class="${styles.cell}" data-lit="${String(c.lit)}" title="${c.title}"
          ><span class="${styles.symbol}">${c.symbol ?? o.noSpelling}</span
          ><span class="${styles.value}">${c.value === null ? "–" : String(c.value)}</span
          ><span class="${styles.fieldName}">${c.field}</span></li
        >`,
    )}</ol
  >`;
}

export interface Fact {
  label: string;
  value: SafeHtml;
}

/** A term and its value on each line. */
export function factList(facts: readonly Fact[]): SafeHtml {
  return html`<dl class="${styles.facts}"
    >${facts.map(
      (f) =>
        html`<div class="${styles.fact}"><dt class="${styles.term}">${f.label}</dt><dd class="${styles.detail}">${f.value}</dd></div>`,
    )}</dl
  >`;
}

/** A result string as a cell: the string, or the sentinel chip for `""` and `null`. */
export function resultCell(value: string | null): SafeHtml {
  return value === null || value === ""
    ? html`<span class="${styles.noSignal}">${CELL_NO_SIGNAL}</span>`
    : html`<code class="${styles.result}">${value}</code>`;
}

/** A line whose call was not made. Dim, and in words. */
export function notCalled(): SafeHtml {
  return html`<span class="${styles.dim}">${NOT_CALLED_TEXT}</span>`;
}

/** The round trip's verdict. A different duration is the bracketed chip's sentinel-free twin: in words. */
export function roundTripCell(same: boolean | null): SafeHtml {
  if (same === null) return notCalled();
  return same
    ? html`<span class="${styles.same}">${SAME_DURATION_TEXT}</span>`
    : html`<span class="${styles.different}">${DIFFERENT_DURATION_TEXT}</span>`;
}

/** The text of a written string, in a code box. `text` is escaped. */
export function writtenCell(text: string, note?: string): SafeHtml {
  return html`<code class="${styles.written}">${text}</code
    >${note === undefined ? "" : html`<p class="${styles.rowNote}">${raw(note)}</p>`}`;
}

/** A box with a name a mount can find and refill without touching its neighbours. */
export function slotBox(id: string, content: SafeHtml): SafeHtml {
  return html`<span id="${id}">${content}</span>`;
}

export interface ResultOutputOptions {
  id: string;
  /** The output's accessible name. */
  label: string;
  /** The tool module's class: the one place the amber sentinel look lives. */
  className: string;
}

/** The live result a mount fills in: empty until the library has answered. */
export function resultOutput(o: ResultOutputOptions): SafeHtml {
  return html`<output class="${o.className}" id="${o.id}" aria-label="${o.label}"></output>`;
}
