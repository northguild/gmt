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
 * wraps at a space or after a `/` and never inside a word, every cell is labelled, and runs of rows
 * with the same first cell are marked (`data-group`).
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
  name?: string | null;
  attributes?: { type: string; name?: string; value?: unknown }[];
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

/**
 * True for the generator's own box as MDX reads it: a `<div class="gmt-ref-table">` JSX element
 * that holds the table (build-utils/render-table.ts writes it into the page's `.mdx`).
 */
function isJsxBox(node: HastNode): boolean {
  if (
    (node.type !== "mdxJsxFlowElement" && node.type !== "mdxJsxTextElement") ||
    node.name !== "div"
  ) {
    return false;
  }
  const value = node.attributes?.find(
    (attribute) => attribute.name === "class" || attribute.name === "className",
  )?.value;
  return typeof value === "string" && value.split(/\s+/).includes(BOX_CLASS);
}

/**
 * True when the nearest node above `children[index]` is the raw HTML that opens the generator's own
 * box (`<div class="gmt-ref-table" data-kind="...">`, build-utils/render-table.ts). That box is the
 * table's scroll box already, so the table is not boxed a second time.
 */
function inGeneratorBox(children: HastNode[], index: number): boolean {
  for (let i = index - 1; i >= 0; i -= 1) {
    if (isBlank(children[i])) continue;
    const node = children[i];
    return (
      (node.type === "raw" || node.type === "html") &&
      /^<div\b[^>]*\bclass="[^"]*\bgmt-ref-table\b[^"]*"[^>]*>$/.test(
        (node.value ?? "").trim(),
      )
    );
  }
  return false;
}

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

/** A cell's text, trimmed with its whitespace collapsed: what two rows are compared by. */
const labelOf = (cell: HastNode | undefined): string =>
  cell === undefined ? "" : textOf(cell).replace(/\s+/g, " ").trim();

/**
 * Marks runs of body rows whose first cell reads the same: `data-group="start"` on the first row
 * of a run of two or more, `"continue"` on the rest. A row alone, a row with an empty first cell
 * and every `thead` row get nothing. The stylesheet draws a rule above a start and dims the
 * repeated label of a continue; the text stays in every row.
 */
function groupRows(table: HastNode): void {
  for (const section of table.children ?? []) {
    if (!isElement(section, "tbody")) continue;
    const rows = (section.children ?? []).filter((row) => isElement(row, "tr"));
    let previous = "";
    rows.forEach((row, index) => {
      const first = (row.children ?? []).find((cell) =>
        isElement(cell, "th", "td"),
      );
      const label = labelOf(first);
      if (label !== "" && label === previous) {
        row.properties = { ...row.properties, dataGroup: "continue" };
        const start = rows[index - 1];
        if (start.properties?.dataGroup === undefined) {
          start.properties = { ...start.properties, dataGroup: "start" };
        }
      }
      previous = label;
    });
  }
}

/** Boxes each table not yet in a box; a marker above one sets its entries layout. */
function boxTables(node: HastNode): void {
  if (isBox(node)) return;
  const children = node.children;
  if (children === undefined) return;
  const boxed = isJsxBox(node);
  for (let i = 0; i < children.length; i += 1) {
    const child = children[i];
    if (isElement(child, "table")) {
      if (boxed || inGeneratorBox(children, i)) continue;
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
      groupRows(child);
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
