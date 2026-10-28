import rehypeTableScroll from "./rehype-table-scroll";

type Node = {
  type: string;
  tagName?: string;
  properties?: Record<string, unknown>;
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
