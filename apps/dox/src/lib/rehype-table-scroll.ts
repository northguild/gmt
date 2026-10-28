/**
 * Rehype plugin: every Markdown table sits in the site's table scroll box,
 * `<div class="gmt-ref-table" data-kind="content">`, the same box the generated reference tables
 * use (gmt-content.css § Generated reference tables; `src/lib/ref-table.ts` makes it focusable
 * and adds the scroll cue when it overflows).
 *
 * Starlight sets `display: block` on a content table so that the table itself scrolls. A block
 * table's rows then shrink to their content, so a short table stops partway across the column.
 * In the box, the table is a real table at the full width of the column, and the box scrolls.
 *
 * A table already in the box (one the generator wrote) is not boxed again, but it is processed:
 * every cell `code` that has break points gets them (src/lib/code-break.ts), so a long token
 * wraps at a space or after a `/` and never inside a word.
 *
 * A table opts into the entries layout (gmt-content.css) with an MDX comment that reads
 * `table: entries`, on its own line directly above it. The comment reaches this plugin as an
 * `mdxFlowExpression` node beside the table; the plugin sets `data-layout="entries"` on the box,
 * names each body cell's column in `data-col`, and removes the comment. A paragraph between the
 * comment and the table cancels it.
 */
import { CODE_BREAK_CLASS, codeBreakHast, codeBreakPieces } from "./code-break";

interface HastNode {
  type: string;
  tagName?: string;
  value?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
}

const BOX_CLASS = "gmt-ref-table";
const ENTRIES_MARKER = /^\/\*\s*table:\s*entries\s*\*\/$/;

function isBox(node: HastNode): boolean {
  const className = node.properties?.className;
  const classes = Array.isArray(className)
    ? className.map(String)
    : typeof className === "string"
      ? className.split(/\s+/)
      : [];
  return node.type === "element" && classes.includes(BOX_CLASS);
}

function box(table: HastNode, entries: boolean): HastNode {
  return {
    type: "element",
    tagName: "div",
    properties: {
      className: [BOX_CLASS],
      dataKind: "content",
      ...(entries ? { dataLayout: "entries" } : {}),
    },
    children: [table],
  };
}

const isElement = (node: HastNode | undefined, ...names: string[]): boolean =>
  node?.type === "element" && names.includes(node.tagName ?? "");

const textOf = (node: HastNode): string =>
  node.type === "text"
    ? (node.value ?? "")
    : (node.children ?? []).map(textOf).join("");

const isMarker = (node: HastNode): boolean =>
  node.type === "mdxFlowExpression" &&
  ENTRIES_MARKER.test((node.value ?? "").trim());

const isBlank = (node: HastNode): boolean =>
  node.type === "text" && (node.value ?? "").trim() === "";

/** The index of the entries marker directly above `children[index]`, or -1. */
function markerAbove(children: HastNode[], index: number): number {
  for (let i = index - 1; i >= 0; i -= 1) {
    if (isBlank(children[i])) continue;
    return isMarker(children[i]) ? i : -1;
  }
  return -1;
}

/** The text of each column header: the `thead` row, else the table's first row. */
function headers(table: HastNode): string[] {
  const rows: HastNode[] = [];
  const collect = (node: HastNode): void => {
    for (const child of node.children ?? []) {
      if (isElement(child, "tr")) rows.push(child);
      else if (isElement(child, "thead", "tbody", "tfoot")) collect(child);
    }
  };
  collect(table);
  const head = rows.find((row) =>
    (row.children ?? []).some((cell) => isElement(cell, "th")),
  );
  return (head?.children ?? [])
    .filter((cell) => isElement(cell, "th", "td"))
    .map((cell) => textOf(cell).trim());
}

/** Names each body cell's column on `data-col`, for the label the entries layout prints. */
function labelCells(table: HastNode): void {
  const names = headers(table);
  const visitRows = (node: HastNode): void => {
    for (const child of node.children ?? []) {
      if (isElement(child, "tbody")) visitRows(child);
      else if (isElement(child, "tr")) {
        let column = 0;
        for (const cell of child.children ?? []) {
          if (!isElement(cell, "th", "td")) continue;
          const name = names[column];
          column += 1;
          if (name && cell.properties?.dataCol === undefined) {
            cell.properties = { ...cell.properties, dataCol: name };
          }
        }
      }
    }
  };
  visitRows(table);
}

/** Boxes each table not yet in a box; a marker above one sets its entries layout. */
function boxTables(node: HastNode): void {
  if (isBox(node)) return;
  const children = node.children;
  if (children === undefined) return;
  for (let i = 0; i < children.length; i += 1) {
    const child = children[i];
    if (isElement(child, "table")) {
      const marker = markerAbove(children, i);
      if (marker >= 0) labelCells(child);
      children[i] = box(child, marker >= 0);
      if (marker >= 0) {
        children.splice(marker, 1);
        i -= 1;
      }
    } else {
      boxTables(child);
    }
  }
}

/** Gives a cell's code its break points when it is plain text with more than one piece. */
function breakCode(node: HastNode, inCell: boolean): void {
  for (const child of node.children ?? []) {
    if (child.type !== "element") continue;
    if (inCell && child.tagName === "code") {
      const kids = child.children ?? [];
      if (kids.length === 0 || !kids.every((kid) => kid.type === "text"))
        continue;
      const text = kids.map((kid) => kid.value ?? "").join("");
      if (codeBreakPieces(text).length < 2) continue;
      const existing = child.properties?.className;
      const classes = Array.isArray(existing) ? existing.map(String) : [];
      child.properties = {
        ...child.properties,
        className: [...classes, CODE_BREAK_CLASS],
      };
      child.children = codeBreakHast(text) as HastNode[];
    } else {
      breakCode(child, inCell || isElement(child, "th", "td"));
    }
  }
}

function breakTables(node: HastNode): void {
  for (const child of node.children ?? []) {
    if (isElement(child, "table")) breakCode(child, false);
    else breakTables(child);
  }
}

export default function rehypeTableScroll() {
  return (tree: HastNode) => {
    boxTables(tree);
    breakTables(tree);
  };
}
