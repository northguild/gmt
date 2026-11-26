import { hashOf, type AgentRunRecord, type RunValue } from "./agent-quote";
import {
  cellLabel,
  runGrid,
  type RunGridConfig,
  type RunGridFile,
} from "./run-grid";

const FILE: RunGridFile = {
  code: "export const f = (x) => x;",
  want: "a",
  kinds: [
    { id: "one", kind: "One", call: "f(1)" },
    { id: "two", kind: "Two", call: "f(2)" },
  ],
};
const CONFIG: RunGridConfig = {
  node: "26",
  zones: ["Pacific/Niue", "Europe/Helsinki"],
  path: "kinds.json",
  command: "node kinds.mjs",
};

/** A record of `call` whose rows are Node 24 and 26, its columns Helsinki, Niue and New York. */
const runOf = (
  call: string,
  row26: RunValue[],
  row24 = row26,
): AgentRunRecord => ({
  sha256: hashOf(FILE.code, call),
  command: "c",
  instant: "2026-11-20T00:00:00Z",
  libraries: {},
  nodes: [
    { node: "24", version: "v24.0.0", tzdata: "t" },
    { node: "26", version: "v26.0.0", tzdata: "t" },
  ],
  zones: ["Europe/Helsinki", "Pacific/Niue", "America/New_York"],
  values: [row24, row26],
});

const RUNS = {
  one: runOf("f(1)", ["a", "b", "a"]),
  two: runOf(
    "f(2)",
    [{ threw: "RangeError: Invalid time value" }, "a", "a"],
    ["a", "a", "c"],
  ),
};

describe("the run grid", () => {
  it("shows each call's value on the Node asked for, in the zones asked for, held to the want", () => {
    const grid = runGrid(FILE, RUNS, CONFIG);
    expect(grid).toMatchObject({
      ready: true,
      places: ["Niue", "Helsinki"],
      nodes: ["24", "26"],
      zones: 3,
    });
    if (!grid.ready) return;
    expect(grid.rows.map((r) => [r.id, r.kind, r.call])).toEqual([
      ["one", "One", "f(1)"],
      ["two", "Two", "f(2)"],
    ]);
    expect(
      grid.rows.map((r) => r.cells.map((c) => [c.label, c.outcome])),
    ).toEqual([
      [
        ["b", "wrong"],
        ["a", "right"],
      ],
      [
        ["a", "right"],
        ["RangeError", "wrong"],
      ],
    ]);
  });

  it("counts the different values of every run, on every Node and in every zone, not only those shown", () => {
    const grid = runGrid(FILE, RUNS, CONFIG);
    expect(grid.ready && grid.distinct).toBe(4);
  });

  it("is not ready, naming the call, the file and the command, while a record is missing, stale, or lacks a Node or zone", () => {
    const cases: [
      Partial<Record<string, AgentRunRecord>>,
      RunGridConfig,
      string,
    ][] = [
      [{ one: RUNS.one }, CONFIG, "is missing"],
      [
        { ...RUNS, two: runOf("f(9)", ["a", "a", "a"]) },
        CONFIG,
        "is out of date",
      ],
      [RUNS, { ...CONFIG, node: "22" }, "has no run on Node 22"],
      [
        RUNS,
        { ...CONFIG, zones: ["Asia/Kolkata"] },
        "has no run in Asia/Kolkata",
      ],
    ];
    for (const [runs, config, says] of cases) {
      const grid = runGrid(FILE, runs, config);
      expect(grid.ready).toBe(false);
      if (grid.ready) continue;
      expect(grid.problem).toContain(says);
      expect(grid.problem).toContain("kinds.json");
      expect(grid.problem).toContain("Run: node kinds.mjs");
    }
  });
});

describe("cellLabel", () => {
  it("is the value, or the name of the error thrown", () => {
    expect(cellLabel("2027-03-28")).toBe("2027-03-28");
    expect(cellLabel({ threw: "RangeError: Invalid time value" })).toBe(
      "RangeError",
    );
  });
});
