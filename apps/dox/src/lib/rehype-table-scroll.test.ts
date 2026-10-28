import rehypeTableScroll from "./rehype-table-scroll";

type Node = {
  type: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  value?: string;
  children?: Node[];
};

const table = (): Node => ({
  type: "element",
  tagName: "table",
  properties: {},
  children: [],
});

function run(tree: Node): Node {
  rehypeTableScroll()(tree);
  return tree;
}

describe("rehypeTableScroll", () => {
  it("puts a top-level table in the scroll box", () => {
    const t = table();
    const tree = run({ type: "root", children: [t] });
    expect(tree.children).toEqual([
      {
        type: "element",
        tagName: "div",
        properties: { className: ["gmt-ref-table"], dataKind: "content" },
        children: [t],
      },
    ]);
  });

  it("puts a nested table in the box and leaves its siblings in place", () => {
    const t = table();
    const p: Node = { type: "element", tagName: "p", children: [] };
    const aside: Node = {
      type: "element",
      tagName: "aside",
      children: [p, t],
    };
    run({ type: "root", children: [aside] });
    expect(aside.children?.[0]).toBe(p);
    expect(aside.children?.[1]).toMatchObject({
      tagName: "div",
      properties: { className: ["gmt-ref-table"] },
      children: [t],
    });
  });

  it("leaves a table that is already in the box alone", () => {
    const t = table();
    const existing: Node = {
      type: "element",
      tagName: "div",
      properties: { className: ["gmt-ref-table"], dataKind: "notes" },
      children: [t],
    };
    run({ type: "root", children: [existing] });
    expect(existing.children).toEqual([t]);
  });

  it("boxes each of two tables once", () => {
    const tree = run({ type: "root", children: [table(), table()] });
    expect(tree.children?.map((c) => c.tagName)).toEqual(["div", "div"]);
    expect(tree.children?.map((c) => c.children?.[0].tagName)).toEqual([
      "table",
      "table",
    ]);
  });
});

const text = (value: string): Node & { value: string } => ({
  type: "text",
  value,
});
const el = (
  tagName: string,
  children: Node[] = [],
  properties: Record<string, unknown> = {},
): Node => ({ type: "element", tagName, properties, children });
const cellTable = (code: string): Node =>
  el("table", [
    el("thead", [
      el("tr", [el("th", [text("Call")]), el("th", [text("Result")])]),
    ]),
    el("tbody", [
      el("tr", [
        el("td", [el("code", [text(code)])]),
        el("td", [text("plain")]),
      ]),
    ]),
  ]);
const firstCode = (table: Node): Node =>
  table.children![1].children![0].children![0].children![0];
const entriesMarker = (): Node => ({
  type: "mdxFlowExpression",
  value: "/* table: entries */",
});

describe("rehypeTableScroll code break points", () => {
  it("splits a long cell code and tags it", () => {
    const t = cellTable("import { a } from");
    run({ type: "root", children: [t] });
    const code = firstCode(t);
    expect(code.properties?.className).toEqual(["gmt-codebreak"]);
    expect(code.children?.filter((c) => c.tagName === "span")).toHaveLength(5);
  });

  it("leaves a one-piece cell code alone", () => {
    const t = cellTable("2024-03-10");
    run({ type: "root", children: [t] });
    expect(firstCode(t).properties).toEqual({});
    expect(firstCode(t).children).toEqual([text("2024-03-10")]);
  });

  it("leaves code outside a table alone", () => {
    const code = el("code", [text("a b c")]);
    const p = el("p", [code]);
    run({ type: "root", children: [p] });
    expect(code.children).toEqual([text("a b c")]);
    expect(code.properties).toEqual({});
  });

  it("processes a table that is already in a box", () => {
    const t = cellTable("a b");
    const existing = el("div", [t], { className: ["gmt-ref-table"] });
    run({ type: "root", children: [existing] });
    expect(firstCode(t).properties?.className).toEqual(["gmt-codebreak"]);
  });

  it("processes a table inside an MDX element", () => {
    const t = cellTable("a b");
    const jsx: Node = { type: "mdxJsxFlowElement", children: [t] };
    run({ type: "root", children: [jsx] });
    expect(firstCode(t).properties?.className).toEqual(["gmt-codebreak"]);
  });
});

describe("rehypeTableScroll entries marker", () => {
  it("sets the layout and names the columns, and prints no marker", () => {
    const t = cellTable("x");
    const tree = run({
      type: "root",
      children: [entriesMarker(), text("\n"), t],
    });
    expect(tree.children!.map((c) => c.type)).toEqual(["text", "element"]);
    expect(tree.children![1].properties).toMatchObject({
      dataKind: "content",
      dataLayout: "entries",
    });
    const cells = t.children![1].children![0].children!;
    expect(cells.map((c) => c.properties?.dataCol)).toEqual(["Call", "Result"]);
  });

  it("does nothing when a paragraph sits between the marker and the table", () => {
    const t = cellTable("x");
    const m = entriesMarker();
    const tree = run({
      type: "root",
      children: [m, el("p", [text("between")]), t],
    });
    expect(tree.children![2].properties).toEqual({
      className: ["gmt-ref-table"],
      dataKind: "content",
    });
    expect(tree.children![0]).toBe(m);
  });

  it("ignores a comment that is not the marker", () => {
    const t = cellTable("x");
    const tree = run({
      type: "root",
      children: [{ type: "mdxFlowExpression", value: "/* other */" }, t],
    });
    expect(tree.children![1].properties).not.toHaveProperty("dataLayout");
  });

  it("does not label a table without the marker", () => {
    const t = cellTable("x");
    run({ type: "root", children: [t] });
    expect(t.children![1].children![0].children![0].properties).toEqual({});
  });
});
