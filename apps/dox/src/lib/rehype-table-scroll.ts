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
 * A table already in the box (one the generator wrote) is left alone.
 */

interface HastNode {
  type: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
}

const BOX_CLASS = "gmt-ref-table";

function isBox(node: HastNode): boolean {
  const className = node.properties?.className;
  const classes = Array.isArray(className)
    ? className.map(String)
    : typeof className === "string"
      ? className.split(/\s+/)
      : [];
  return node.type === "element" && classes.includes(BOX_CLASS);
}

function box(table: HastNode): HastNode {
  return {
    type: "element",
    tagName: "div",
    properties: { className: [BOX_CLASS], dataKind: "content" },
    children: [table],
  };
}

function visit(node: HastNode): void {
  if (isBox(node)) return;
  const children = node.children;
  if (children === undefined) return;
  for (let i = 0; i < children.length; i += 1) {
    const child = children[i];
    if (child.type === "element" && child.tagName === "table") {
      children[i] = box(child);
    } else {
      visit(child);
    }
  }
}

export default function rehypeTableScroll() {
  return (tree: HastNode) => visit(tree);
}
