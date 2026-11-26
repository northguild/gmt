import assert from "node:assert/strict";
import test from "node:test";
import { buildCell, combineRuns, mergeCells, needsRerun } from "./cells.mjs";

const base = {
  node: "24",
  nodeVersion: "v24.21.0",
  tzdata: "2026c",
  zone: "Pacific/Apia",
  ranOn: "2026-11-18",
};

test("failures that also fail at the reference zone are known, not counted", () => {
  const cell = buildCell({
    ...base,
    result: { tests: 10, failed: ["b", "a", "a", "k"] },
    reference: ["k"],
    override: null,
  });
  assert.deepEqual(cell.failed, ["a", "b"]);
  assert.deepEqual(cell.alsoFailsAtReference, ["k"]);
  assert.equal(cell.tz, "Pacific/Apia");
  assert.equal(cell.tzdata, "2026c");
});

test("an overridden cell records the override and no failures", () => {
  const override = { file: "t.js", line: 3, zone: "Asia/Tokyo" };
  const cell = buildCell({
    ...base,
    result: { tests: 10, failed: ["a"] },
    reference: [],
    override,
  });
  assert.deepEqual(cell.failed, []);
  assert.deepEqual(cell.overriddenBy, override);
});

test("a run that could not start records why and no failures", () => {
  const cell = buildCell({
    ...base,
    result: { tests: 0, failed: [], couldNotRun: "the report holds no tests" },
    reference: [],
    override: null,
  });
  assert.equal(cell.couldNotRun, "the report holds no tests");
  assert.deepEqual(cell.failed, []);
});

test("mergeCells replaces a cell with the same node and zone and orders the rest", () => {
  const cell = (node, zone, tests) => ({ node, zone, tests });
  const merged = mergeCells(
    [cell("26", "UTC", 1), cell("22", "UTC", 1)],
    [cell("26", "UTC", 2), cell("24", "Asia/Kolkata", 3)],
  );
  assert.deepEqual(
    merged.map((c) => [c.node, c.zone, c.tests]),
    [
      ["22", "UTC", 1],
      ["24", "Asia/Kolkata", 3],
      ["26", "UTC", 2],
    ],
  );
});

const run = (failed, extra = {}) => ({
  result: { tests: 10, failed, ...extra },
  seen: ['{"start":"UTC","end":"UTC"}'],
});

test("a failing run is run again; a clean or unrunnable one is not", () => {
  assert.equal(needsRerun(run(["a"])), true);
  assert.equal(needsRerun(run([])), false);
  assert.equal(needsRerun(run([], { couldNotRun: "x" })), false);
});

test("a test failing in both runs fails; in one run only, it is unstable", () => {
  const joined = combineRuns(run(["a", "b"]), run(["b", "c"]));
  assert.deepEqual(joined.result.failed, ["b"]);
  assert.deepEqual(joined.result.unstable, ["a", "c"]);
  assert.equal(joined.seen.length, 2);
});

test("the joined run keeps each failure's message from the run it failed in", () => {
  const joined = combineRuns(
    run(["a"], { messages: { a: "Error: Test timed out in 5000ms." } }),
    run(["c"], { messages: { c: "AssertionError: expected 1 to be 2" } }),
  );
  assert.deepEqual(joined.result.messages, {
    a: "Error: Test timed out in 5000ms.",
    c: "AssertionError: expected 1 to be 2",
  });
});

test("a second run that could not run is the result, so the pair runs again", () => {
  const second = run([], { couldNotRun: "boom" });
  assert.equal(combineRuns(run(["a"]), second), second);
});

test("an unstable test is recorded on the cell and counts as neither kind", () => {
  const cell = buildCell({
    ...base,
    result: { tests: 10, failed: ["b"], unstable: ["Add Add", "k"] },
    reference: ["k"],
    override: null,
  });
  assert.deepEqual(cell.failed, ["b"]);
  assert.deepEqual(cell.unstable, ["Add Add"]);
  assert.deepEqual(cell.alsoFailsAtReference, ["k"]);
});
