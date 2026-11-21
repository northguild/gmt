import assert from "node:assert/strict";
import { test } from "node:test";
import { compactRecord, expandRecord, tagKey } from "./record-shape.mjs";

const cell = (node, zone, extra = {}) => ({
  node,
  nodeVersion: `v${node}.1.0`,
  tzdata: "2026e",
  tz: zone,
  zone,
  ranOn: "2026-11-18",
  tests: 10,
  failed: [],
  alsoFailsAtReference: [],
  unstable: [],
  ...extra,
});

const suite = {
  id: "lib",
  name: "Lib",
  version: "1.0.0",
  repository: "https://example.test/lib",
  commit: "a".repeat(40),
  command: "TZ=<zone> run",
  ownCommand: "npm test",
  reference: {
    zone: "UTC",
    source: "none",
    runs: [
      {
        node: "22",
        nodeVersion: "v22.1.0",
        tzdata: "2026e",
        tests: 10,
        failed: ["b"],
        unstable: [],
      },
    ],
  },
  pins: [],
  cells: [
    cell("22", "Asia/Kolkata", { failed: ["a"], alsoFailsAtReference: ["b"] }),
    cell("22", "UTC", { tests: 9, ranOn: "2026-11-19", unstable: ["c"] }),
    cell("22", "Europe/London", { couldNotRun: "no" }),
  ],
};

const tag = { kind: "one-zone", reason: "r", zones: ["Asia/Kolkata"] };
const full = {
  matrix: {
    ci: "ci.yml",
    zones: ["UTC", "Asia/Kolkata", "Europe/London"],
    node: ["22"],
  },
  tags: { [tagKey(suite, "a")]: tag },
  untagged: [],
  causes: {
    [tagKey(suite, "b")]: { cause: "c" },
    [tagKey(suite, "c")]: { cause: "c" },
  },
  uncaused: [],
  suites: [suite],
};

const sorted = (v) =>
  JSON.parse(
    JSON.stringify(v, (_k, x) =>
      x && typeof x === "object" && !Array.isArray(x)
        ? Object.fromEntries(
            Object.entries(x).sort(([a], [b]) => (a < b ? -1 : 1)),
          )
        : x,
    ),
  );

test("a record keeps every figure through compact and expand, per-cell differences included", () => {
  const stored = JSON.parse(JSON.stringify(compactRecord(full)));
  const back = expandRecord(stored);
  const order = (r) => ({
    ...r,
    suites: r.suites.map((s) => ({
      ...s,
      cells: [...s.cells].sort((a, b) => a.zone.localeCompare(b.zone)),
    })),
  });
  assert.deepEqual(sorted(order(back)), sorted(order(full)));
});

test("each distinct tag and cause is stored once, and the Node release once per major", () => {
  const stored = compactRecord(full);
  assert.equal(stored.tagDefs.length, 1);
  assert.equal(stored.causeDefs.length, 1);
  assert.deepEqual(stored.nodes, {
    22: { nodeVersion: "v22.1.0", tzdata: "2026e" },
  });
});

test("two releases of one Node major cannot be stored", () => {
  const mixed = structuredClone(full);
  mixed.suites[0].cells[1].nodeVersion = "v22.2.0";
  assert.throws(() => compactRecord(mixed), /Node 22/);
});
