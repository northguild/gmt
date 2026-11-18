/**
 * Tests of the zone probe. Run: `node --test` in `scripts/zone-matrix`.
 *
 * - the case file: both Temporals give the stored answer for every case, and nothing was dropped;
 * - `summarise`: how wrong, everywhere, some-zones, unsupported and Node agreement are counted;
 * - a sample of adapters, run under the machine zone of this process;
 * - the cache key: it changes each time a dirty `packages/gmt` file is edited again.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { Temporal as Polyfill } from "@js-temporal/polyfill";
import { summarise } from "./aggregate.mjs";
import { buildCases } from "./build-cases.mjs";
import { gmtFingerprint } from "./fingerprint.mjs";
import { temporalOps } from "./temporal-ops.mjs";

const stored = JSON.parse(
  readFileSync(new URL("./cases.json", import.meta.url), "utf8"),
);
const allCases = stored.experiments.flatMap((e) => e.cases);

test("cases.json: nothing dropped, ids unique, every experiment has cases", () => {
  assert.deepEqual(stored.dropped, []);
  assert.equal(new Set(allCases.map((c) => c.id)).size, allCases.length);
  assert.ok(stored.experiments.length >= 3 && stored.experiments.length <= 4);
  for (const e of stored.experiments) assert.ok(e.cases.length > 0, e.id);
});

test("cases.json: the polyfill and native Temporal both give every stored answer", () => {
  for (const [name, T] of [
    ["polyfill", Polyfill],
    ["native", globalThis.Temporal],
  ]) {
    if (!T) continue; // Node before 26 has no Temporal; the polyfill run still covers the file.
    const ops = temporalOps(T);
    for (const c of allCases)
      assert.equal(ops[c.op](c.args), c.expected, `${name} ${c.id}`);
  }
});

test(
  "cases.json is what build-cases computes now",
  { skip: !globalThis.Temporal },
  () => {
    const rebuilt = buildCases(globalThis.Temporal);
    assert.deepEqual(rebuilt.dropped, []);
    assert.deepEqual(
      rebuilt.experiments.map((e) => [e.id, e.cases.length]),
      stored.experiments.map((e) => [e.id, e.cases.length]),
    );
  },
);

const cell = (broken = {}, unsupported = {}) => ({ broken, unsupported });
test("summarise counts wrong, everywhere, some zones, unsupported and node agreement", () => {
  const cases = {
    experiments: [
      {
        id: "x",
        number: 1,
        title: "t",
        question: "q?",
        fed: "f",
        cases: [1, 2, 3, 4].map((n) => ({
          id: `c${n}`,
          input: `in${n}`,
          expected: `right${n}`,
        })),
      },
    ],
  };
  const zones = ["A", "B"];
  const lib = (c1, c2) => ({ A: c1, B: c2 });
  const runs = {
    22: {
      good: lib(cell(), cell()),
      bad: lib(cell({ c1: "w1", c2: "w2" }, { c4: "no" }), cell({ c1: "w1" })),
    },
    26: {
      good: lib(cell(), cell()),
      bad: lib(cell({ c1: "w1", c2: "w2" }, { c4: "no" }), cell({ c1: "w1" })),
    },
  };
  const out = summarise({
    cases,
    libraries: [{ id: "good" }, { id: "bad" }],
    runs,
    nodes: [22, 26],
    zones,
  });
  const [good, bad] = out[0].perLibrary;
  assert.deepEqual(
    [good.wrong, good.example, good.nodesAgree],
    [0, null, true],
  );
  assert.deepEqual(
    [
      bad.total,
      bad.wrong,
      bad.wrongEverywhere,
      bad.wrongSomeZones,
      bad.unsupported,
    ],
    [4, 2, 1, 1, 1],
  );
  assert.deepEqual(bad.example, {
    input: "in1",
    answer: "w1",
    expected: "right1",
    zones: "every",
  });

  runs[22].bad.A = cell({ c1: "w1" });
  const split = summarise({
    cases,
    libraries: [{ id: "bad" }],
    runs,
    nodes: [22, 26],
    zones,
  });
  assert.equal(split[0].perLibrary[0].nodesAgree, false);
  assert.deepEqual(split[0].perLibrary[0].nodeCounts, { 22: 1, 26: 2 });
});

async function runAdapter(id) {
  const adapter = (await import(`./adapters/${id}.mjs`)).default;
  const failed = [];
  for (const c of allCases) {
    try {
      if (adapter.ops[c.op](c.args) !== c.expected) failed.push(c.id);
    } catch {
      failed.push(c.id);
    }
  }
  return failed;
}

test("adapters: GMT and both Temporal libraries answer every case right", async () => {
  for (const id of ["gmt", "js-temporal", "temporal-polyfill"])
    assert.deepEqual(await runAdapter(id), [], id);
});

test("adapters: Luxon reads the repeated hour as the later one, and is wrong on the overlap cases", async () => {
  const failed = await runAdapter("luxon");
  assert.ok(failed.some((id) => id.startsWith("overlaps")));
  assert.ok(
    !failed.some((id) => id.startsWith("gaps")),
    "Luxon moves a skipped time forward like Temporal",
  );
});

test("adapters: Moment answers the localAt cases right", async () => {
  const adapter = (await import("./adapters/moment.mjs")).default;
  for (const c of allCases.filter((x) => x.op === "localAt"))
    assert.equal(adapter.ops.localAt(c.args), c.expected, c.id);
});

test("fingerprint changes every time a dirty packages/gmt file is edited", () => {
  const root = mkdtempSync(join(tmpdir(), "probe-fp-"));
  try {
    const git = (...a) => spawnSync("git", a, { cwd: root, encoding: "utf8" });
    git("init", "-q");
    git("config", "user.email", "t@example.com");
    git("config", "user.name", "t");
    mkdirSync(join(root, "packages/gmt"), { recursive: true });
    const file = join(root, "packages/gmt/a.txt");
    writeFileSync(file, "one\n");
    git("add", "-A");
    git("commit", "-q", "-m", "init");
    const keys = [gmtFingerprint(root)];
    writeFileSync(file, "two\n");
    keys.push(gmtFingerprint(root));
    writeFileSync(file, "three\n");
    keys.push(gmtFingerprint(root));
    writeFileSync(join(root, "packages/gmt/new.txt"), "x\n");
    keys.push(gmtFingerprint(root));
    assert.equal(new Set(keys).size, 4);
    assert.equal(gmtFingerprint(root), keys[3]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
