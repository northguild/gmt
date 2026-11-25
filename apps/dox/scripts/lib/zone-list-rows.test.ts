import { activeProblem, listProblems, ROW_GAP } from "./zone-list-rows.mjs";

/** Rows `from` to `to`, 60 px tall with the virtualizer's gap, the first at `top`. */
const rows = (from: number, to: number, top: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => ({
    index: from + i,
    id: `zone-${from + i}`,
    top: top + i * (60 + ROW_GAP),
    bottom: top + i * (60 + ROW_GAP) + 60,
  }));
const panel = { top: 100, bottom: 500 };

describe("listProblems", () => {
  it("passes a full box of rows mid-list", () => {
    const snap = {
      count: 418,
      scrollTop: 2000,
      max: 26000,
      panel,
      rows: rows(30, 37, 90),
    };
    expect(listProblems(snap)).toEqual([]);
  });

  it("finds a hole, an overlap and a box left short with rows below", () => {
    const missing = rows(30, 37, 90).filter((row) => row.index !== 33);
    expect(
      listProblems({
        count: 418,
        scrollTop: 2000,
        max: 26000,
        panel,
        rows: missing,
      }),
    ).toEqual(["rows 32 and 34 are mounted with a row missing between"]);
    const lapped = rows(30, 37, 90).map((row, i) =>
      i === 3 ? { ...row, top: row.top - 10 } : row,
    );
    expect(
      listProblems({
        count: 418,
        scrollTop: 2000,
        max: 26000,
        panel,
        rows: lapped,
      }),
    ).toEqual(["rows 32 and 33 overlap by 6 px"]);
    const short = rows(30, 34, 90);
    expect(
      listProblems({
        count: 418,
        scrollTop: 2000,
        max: 26000,
        panel,
        rows: short,
      }),
    ).toEqual(["the list ends 94 px above its bottom with rows below it"]);
  });

  /* The Zoned Earth list at 1440 x 900, a step 4 px short of the end: the last zone is mounted and
     the 8.8 px under it is the panel's 12 px padding, with no row there to mount. */
  it("passes the padding past the last or before the first row", () => {
    const last = rows(410, 417, -16.8);
    expect(
      listProblems({
        count: 418,
        scrollTop: 25872,
        max: 25876,
        panel,
        rows: last,
      }),
    ).toEqual([]);
    const first = rows(0, 6, 112);
    expect(
      listProblems({
        count: 418,
        scrollTop: 4,
        max: 25876,
        panel,
        rows: first,
      }),
    ).toEqual([]);
  });
});

describe("activeProblem", () => {
  it("passes an active row inside the box and names one outside it", () => {
    const mounted = rows(30, 37, 90);
    expect(
      activeProblem({ panel, rows: mounted, active: "zone-32" }),
    ).toBeNull();
    expect(activeProblem({ panel, rows: mounted, active: "zone-37" })).toBe(
      "the active row 37 (538 to 598) is outside the list 100 to 500",
    );
    expect(activeProblem({ panel, rows: mounted, active: "zone-90" })).toBe(
      "the active option zone-90 is not a mounted row",
    );
  });
});
