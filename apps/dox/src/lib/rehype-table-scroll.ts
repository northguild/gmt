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
 * wraps at a space or after a `/` and never inside a word, and every cell is labelled.
 *
 * A table opts into the entries layout (gmt-content.css) with an MDX comment that reads
 * `table: entries`, on its own line directly above it. The comment reaches this plugin as an
 * `mdxFlowExpression` node beside the table; the plugin sets `data-layout="entries"` on the box and
 * removes the comment. Every cell of every table names its column in `data-col`. A paragraph between the
 * comment and the table cancels it.
 */
import {
  CODE_BREAK_CLASS,
  codeBreakHast,
  codeBreakPieces,
  type CodeBreakOptions,
} from "./code-break";

interface HastNode {
  type: string;
  tagName?: string;
  value?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
}

/** The class on the scroll box a table sits in. */
export const BOX_CLASS = "gmt-ref-table";
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

/**
 * Names each cell's column on `data-col`: the text of its column's header. A stylesheet prints it
 * as a label (entries layout, reference tables on a phone) or selects a column by it.
 */
function labelCells(table: HastNode): void {
  const names = headers(table);
  const visitRows = (node: HastNode): void => {
    for (const child of node.children ?? []) {
      if (isElement(child, "thead", "tbody", "tfoot")) visitRows(child);
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
function breakCode(
  node: HastNode,
  inCell: boolean,
  options: CodeBreakOptions,
): void {
  for (const child of node.children ?? []) {
    if (child.type !== "element") continue;
    if (inCell && child.tagName === "code") {
      const kids = child.children ?? [];
      if (kids.length === 0 || !kids.every((kid) => kid.type === "text"))
        continue;
      const text = kids.map((kid) => kid.value ?? "").join("");
      if (codeBreakPieces(text, options).length < 2) continue;
      const existing = child.properties?.className;
      const classes = Array.isArray(existing) ? existing.map(String) : [];
      child.properties = {
        ...child.properties,
        className: [...classes, CODE_BREAK_CLASS],
      };
      child.children = codeBreakHast(text, options) as HastNode[];
    } else {
      breakCode(child, inCell || isElement(child, "th", "td"), options);
    }
  }
}

/** The generated changelog pages wrap their body in this, see scripts/lib/changelog.mjs. */
export const CHANGELOG_CLASS = "gmt-changelog";

const hasClass = (node: HastNode, name: string): boolean => {
  const classes = node.properties?.className;
  return Array.isArray(classes) && classes.includes(name);
};

/**
 * True for the raw-HTML node that opens the wrapper (`<div class="gmt-changelog">`): Markdown's
 * raw HTML reaches this plugin as flat sibling nodes, with no element around the tables.
 */
const opensChangelog = (node: HastNode): boolean =>
  (node.type === "raw" || node.type === "html") &&
  (node.value ?? "").includes(CHANGELOG_CLASS);

const closesChangelog = (node: HastNode): boolean =>
  (node.type === "raw" || node.type === "html") &&
  (node.value ?? "").trim() === "</div>";

function breakTables(node: HastNode, options: CodeBreakOptions = {}): void {
  // Release notes hold calls too wide for any column; their code may also break at a call.
  let current = hasClass(node, CHANGELOG_CLASS)
    ? { ...options, calls: true }
    : options;
  for (const child of node.children ?? []) {
    if (opensChangelog(child)) current = { ...current, calls: true };
    else if (closesChangelog(child)) current = options;
    else if (isElement(child, "table")) {
      labelCells(child);
      breakCode(child, false, current);
    } else breakTables(child, current);
  }
}

export default function rehypeTableScroll() {
  return (tree: HastNode) => {
    boxTables(tree);
    breakTables(tree);
  };
}
