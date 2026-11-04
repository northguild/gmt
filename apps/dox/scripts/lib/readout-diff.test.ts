import {
  diffCells,
  diffSnapshots,
  dragKey,
  explainStep,
  groupDragProblems,
  scrollProblems,
} from "./readout-diff.mjs";

type Box = {
  kind: string;
  key: string;
  name: string;
  left: number;
  top: number;
  width: number;
  height: number;
};
const el = (
  name: string,
  left: number,
  top: number,
  width: number,
  height: number,
): Box => ({
  kind: "el",
  key: name,
  name,
  left,
  top,
  width,
  height,
});

describe("dragKey", () => {
  it("drops the drag step from the key and the target", () => {
    const a = dragKey('drag out 3/20: chip:five: {"top":1} -> {"top":2}');
    const b = dragKey('drag back 17/20: chip:five: {"top":1} -> {"top":9}');
    expect(a.key).toBe("chip:five");
    expect(b.key).toBe(a.key);
    expect(a.target).toBe("five");
  });
});

describe("groupDragProblems", () => {
  it("makes one finding from 40 drag messages for one element, with the range", () => {
    const problems: string[] = [];
    for (const way of ["out", "back"])
      for (let i = 1; i <= 20; i++)
        problems.push(`drag ${way} ${i}/20: chip:five: {"top":1} -> {"top":2}`);
    const found = groupDragProblems(problems);
    expect(found).toHaveLength(1);
    expect(found[0].rule).toBe("readout-moved");
    expect(found[0].message).toContain("drag out 1–20, back 1–20");
  });

  it("keeps the first and last step it saw per direction", () => {
    const found = groupDragProblems([
      'drag out 3/20: chip:five: {"top":1} -> {"top":2}',
      'drag out 20/20: chip:five: {"top":1} -> {"top":2}',
      'drag back 1/20: chip:five: {"top":1} -> {"top":2}',
    ]);
    expect(found[0].message).toContain("drag out 3–20, back 1–1");
  });

  it("keeps different elements apart and a stuck value on the widget", () => {
    const found = groupDragProblems([
      'drag out 1/20: chip:a: {"top":1} -> {"top":2}',
      'drag out 1/20: chip:b: {"top":1} -> {"top":2}',
      "ArrowUp never moved the value off 3",
    ]);
    expect(found.map((f) => f.rule)).toEqual([
      "readout-moved",
      "readout-moved",
      "value-not-moved",
    ]);
  });

  it("keeps the keyboard step in the message", () => {
    const found = groupDragProblems([
      'PageUp #3 (value 5): chip:a: {"top":1} -> {"top":2}',
    ]);
    expect(found[0].key).toBe("chip:a");
    expect(found[0].message).toContain("PageUp #3 (value 5)");
  });

  it("names the scroll as the cause", () => {
    const found = groupDragProblems(
      scrollProblems(
        [el("chip:a", 0, 10, 50, 20)],
        [el("chip:a", 0, 11, 50, 20)],
        false,
      ),
    );
    expect(found).toHaveLength(1);
    expect(found[0].message).toMatch(/^scroll moved chip:a/);
  });
});

describe("raw compare", () => {
  it("does not read 10.49 -> 10.51 as a change", () => {
    expect(
      diffSnapshots(
        [el("a", 0, 10.49, 5, 5)],
        [el("a", 0, 10.51, 5, 5)],
        false,
      ),
    ).toEqual([]);
  });

  it("reads 10.6 -> 11.4 as a change, though both round to 11", () => {
    const problems = diffSnapshots(
      [el("a", 0, 10.6, 5, 5)],
      [el("a", 0, 11.4, 5, 5)],
      false,
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("a: ");
    expect(problems[0]).toContain("10.60");
    expect(problems[0]).toContain("11.40");
  });

  it("applies the same compare to cell widths", () => {
    const cell = (w: number) => ({
      kind: "cell",
      key: "c",
      name: "cell:x",
      width: w,
    });
    expect(diffCells([cell(10.49)], [cell(10.51)])).toEqual([]);
    expect(diffCells([cell(10)], [cell(11)])).toHaveLength(1);
  });
});

describe("scrollProblems", () => {
  it("fires on a 1 px drift between the two baselines", () => {
    expect(
      scrollProblems([el("a", 0, 10, 5, 5)], [el("a", 0, 11, 5, 5)], false),
    ).toHaveLength(1);
  });
  it("ignores a drift of half a pixel or less", () => {
    expect(
      scrollProblems([el("a", 0, 10, 5, 5)], [el("a", 0, 10.4, 5, 5)], false),
    ).toEqual([]);
  });
});

describe("explainStep", () => {
  const base = [
    el("frame", 0, 0, 300, 1315),
    el("list", 0, 100, 300, 262),
    el("chip:5", 0, 120, 100, 46),
    ...Array.from({ length: 12 }, (_, i) =>
      el(`below:${i}`, 0, 400 + i * 30, 100, 20),
    ),
  ];
  const now = [
    el("frame", 0, 0, 300, 1333),
    el("list", 0, 100, 300, 280),
    el("chip:5", 0, 120, 100, 64),
    ...Array.from({ length: 12 }, (_, i) =>
      el(`below:${i}`, 0, 418 + i * 30, 100, 20),
    ),
  ];

  it("reports the GNSS cascade once, at the innermost element", () => {
    const problems = diffSnapshots(base, now, false);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/^chip:5: /);
    expect(problems[0].endsWith("+2 grew around it, +12 below moved")).toBe(
      true,
    );
  });

  it("reports a lone move with nothing resized above it", () => {
    const problems = diffSnapshots(
      [el("a", 0, 10, 5, 5), el("b", 0, 40, 5, 5)],
      [el("a", 0, 10, 5, 5), el("b", 0, 44, 5, 5)],
      false,
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/^b: /);
  });

  it("reports a moved element above the resized one on its own", () => {
    const problems = diffSnapshots(
      [el("above", 0, 0, 5, 5), el("grow", 0, 40, 5, 5)],
      [el("above", 0, 3, 5, 5), el("grow", 0, 40, 5, 9)],
      false,
    );
    expect(problems.map((p) => p.split(":")[0]).sort()).toEqual([
      "above",
      "grow",
    ]);
  });

  it("takes the changed elements with their boxes", () => {
    const out = explainStep([
      { name: "a", before: el("a", 0, 0, 5, 5), after: el("a", 0, 0, 5, 9) },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatch(/^a: /);
  });
});
