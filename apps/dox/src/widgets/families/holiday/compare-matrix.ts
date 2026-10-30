/**
 * compareMatrix: a native table of observed dates, a row per year and a column per policy,
 * always `rows` body rows. A shorter span is padded with hidden, inert rows of the same
 * structure, so stepping the last year never changes the table's height.
 *
 * Each column header is a toggle button naming the column; each row header holds a year
 * toggle and a word ("policies agree", "policies disagree"); each cell is a toggle button
 * that holds one block per holiday, two lines each, the second line always there. A cell's
 * accessible name says its year, its column and its dates, so it reads without its headers.
 * A block the library could not place reads NO SIGNAL (amber, bracketed, in words).
 *
 * The selected row, column and cell are `aria-pressed` and a `data-selected` the builder
 * sets, so a mount redraws the matrix and puts focus back on the button by id.
 * Ids: `${id}-col-${j}`, `${id}-year-${year}` and `${id}-cell-${year}-${j}`.
 * A row that disagrees is marked by its word and by a hatch, never by colour alone. Under
 * 34rem of table width each year stacks into a labelled card.
 */
import { html, type SafeHtml } from "../../builders/html";
import styles from "./compare-matrix.module.css";

/** What a block says when the library could not place it. */
const MATRIX_SIGNAL_LINES = ["⟨ NO SIGNAL —", "invalid input ⟩"] as const;

export interface MatrixBlock {
  /** The holiday's name, for the cell's accessible name. */
  name: string;
  state: "date" | "none" | "sentinel";
  line1: string;
  line2: string;
  /** Said when the observed date is in another year; becomes a tooltip and a hidden word. */
  note: string;
}

export interface MatrixColumn {
  label: string;
  /** Why the column is NO SIGNAL, as a sentence; blank when it is not. */
  reason: string;
}

export interface MatrixRow {
  year: number;
  disagree: boolean;
  /** "policies agree", "policies disagree" or "nothing to compare". */
  word: string;
  /** `cells[column][holiday]`. */
  cells: readonly (readonly MatrixBlock[])[];
}

interface CompareMatrixOptions {
  id: string;
  caption: string;
  columns: readonly MatrixColumn[];
  rows: readonly MatrixRow[];
  /** The body always has this many rows. */
  bodyRows: number;
  /** How many holidays a placeholder row reserves. */
  holidays: number;
  selectedYear: number | null;
  selectedColumn: number;
  /** The label of the column header's corner. */
  corner?: string;
}

function block(b: MatrixBlock): SafeHtml {
  if (b.state === "sentinel") {
    return html`<span class="${styles.hol}" data-state="sentinel"
      ><span class="${styles.line1}">${MATRIX_SIGNAL_LINES[0]}</span
      > <span class="${styles.line2}">${MATRIX_SIGNAL_LINES[1]}</span></span
    >`;
  }
  return html`<span class="${styles.hol}" data-state="${b.state}" ${b.note === "" ? "" : html`title="${b.note}"`}
    ><span class="${styles.line1}">${b.line1}</span
    > <span class="${styles.line2}">${b.line2 === "" ? " " : b.line2}</span></span
  >`;
}

function blockWords(b: MatrixBlock): string {
  if (b.state === "sentinel") return `${b.name}: no signal, invalid input`;
  return `${b.name}: ${[b.line1, b.line2, b.note].filter((t) => t !== "").join(", ")}`;
}

function cellName(
  year: number,
  column: string,
  blocks: readonly MatrixBlock[],
): string {
  return `${year}, ${column}: ${blocks.map(blockWords).join("; ")}`;
}

function blankBlock(): SafeHtml {
  return html`<span class="${styles.hol}" data-state="blank"
    ><span class="${styles.line1}"> </span> <span class="${styles.line2}"> </span></span
  >`;
}

export function compareMatrix(o: CompareMatrixOptions): SafeHtml {
  const pad = Math.max(0, o.bodyRows - o.rows.length);
  return html`<table class="${styles.table}"
    ><caption class="${styles.caption}">${o.caption}</caption
    ><thead
      ><tr
        ><th class="${styles.corner}" scope="col">${o.corner ?? "Year"}</th
        >${o.columns.map(
          (c, j) =>
            html`<th scope="col"
              ><button
                class="${styles.colButton}"
                type="button"
                id="${o.id}-col-${String(j)}"
                data-col="${String(j)}"
                aria-pressed="${String(j === o.selectedColumn)}"
                >${c.label}</button
              >${c.reason === "" ? "" : html`<span class="${styles.reason}">${c.reason}</span>`}</th
            >`,
        )}</tr
      ></thead
    ><tbody
      >${o.rows.map((row) => {
        const on = row.year === o.selectedYear;
        return html`<tr ${row.disagree ? html`data-disagree` : ""} ${on ? html`data-selected` : ""}
          ><th class="${styles.year}" scope="row"
            ><button
              class="${styles.yearButton}"
              type="button"
              id="${o.id}-year-${String(row.year)}"
              data-year="${String(row.year)}"
              aria-pressed="${String(on)}"
              >${String(row.year)}</button
            ><span class="${styles.agree}">${row.word}</span></th
          >${o.columns.map(
            (c, j) =>
              html`<td data-label="${c.label}"
                ><button
                  class="${styles.cell}"
                  type="button"
                  id="${o.id}-cell-${String(row.year)}-${String(j)}"
                  data-year="${String(row.year)}"
                  data-col="${String(j)}"
                  aria-pressed="${String(on && j === o.selectedColumn)}"
                  aria-label="${cellName(row.year, c.label, row.cells[j] ?? [])}"
                  >${(row.cells[j] ?? []).map(block)}</button
                ></td
              >`,
          )}</tr
        >`;
      })}${Array.from(
        { length: pad },
        () =>
          html`<tr data-placeholder aria-hidden="true" inert
            ><th class="${styles.year}" scope="row"
              ><span class="${styles.yearButton}"> </span><span class="${styles.agree}"> </span></th
            >${o.columns.map(
              (c) =>
                html`<td data-label="${c.label}"
                  ><span class="${styles.cell}"
                    >${Array.from({ length: o.holidays }, blankBlock)}</span
                  ></td
                >`,
            )}</tr
          >`,
      )}</tbody
    ></table
  >`;
}
