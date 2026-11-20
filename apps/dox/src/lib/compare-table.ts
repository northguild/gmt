/**
 * The shape of a table on /compare and its two renderers: a cell, a table, `cellHtml` for the page
 * and `tableMarkdown` for the text twin (`.md`, `llms.txt`, retrieval chunks). The builders that
 * fill it live in `library-compare-tables.ts` and `zone-matrix-tables.ts`.
 */
import { raw } from "~/widgets/builders/html";
import { nobreak } from "~/widgets/builders/nobreak";
import { codeHtml } from "./code-break";
import { escapeHtml } from "./inline-code-html";
import { link } from "~/widgets/builders/link";

/** One table cell: plain text, optionally set in code or linked. */
export interface Cell {
  text: string;
  code?: boolean;
  href?: string;
  /** Never break inside the text (a date wraps after its hyphen otherwise). */
  nobreak?: boolean;
}

export interface CompareTable {
  head: string[];
  /** The first cell of every row is its row header. */
  rows: Cell[][];
}

/**
 * A cell's backtick-marked text as HTML, its code wrapping at spaces (`codeHtml`): a suite's test
 * name is a sentence in code, and held on one line it ran its table far past the column.
 */
const cellTextHtml = (text: string): string =>
  text
    .split(/(`[^`]*`)/)
    .map((part) =>
      part.length > 1 && part.startsWith("`") && part.endsWith("`")
        ? codeHtml(part.slice(1, -1))
        : escapeHtml(part),
    )
    .join("");

/** One table cell as HTML. */
export function cellHtml(cell: Cell): string {
  const inner = cell.code ? codeHtml(cell.text) : cellTextHtml(cell.text);
  const body = cell.nobreak ? nobreak(raw(inner)).toString() : inner;
  return cell.href ? link({ href: cell.href, body: raw(body) }).value : body;
}

export const plain = (text: string): Cell => ({ text });
export const code = (text: string): Cell => ({ text, code: true });
export const NOT_MEASURED = "not measured";

const escapeCell = (text: string): string => text.replace(/\|/g, "\\|");

function cellMarkdown(cell: Cell): string {
  const text = cell.code ? `\`${cell.text}\`` : escapeCell(cell.text);
  return cell.href ? `[${text}](${cell.href})` : text;
}

/** A table as a Markdown pipe table. */
export function tableMarkdown(table: CompareTable): string {
  return [
    "",
    `| ${table.head.join(" | ")} |`,
    `| ${table.head.map(() => "---").join(" | ")} |`,
    ...table.rows.map((row) => `| ${row.map(cellMarkdown).join(" | ")} |`),
    "",
  ].join("\n");
}
