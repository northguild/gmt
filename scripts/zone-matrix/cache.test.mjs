import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { cacheKey, readCached, writeCached } from "./cache.mjs";

const parts = {
  suite: "moment",
  commit: "abc",
  nodeVersion: "v24.22.3",
  tzdata: "2026e",
  zone: "UTC",
  command: "x",
  install: "[]",
  probe: "p1",
  attempt: 1,
};
const run = {
  result: { tests: 3, failed: ["a"] },
  seen: ['{"start":"UTC","end":"UTC"}'],
};

test("a finished run is reused", () => {
  const dir = mkdtempSync(join(tmpdir(), "zm-"));
  try {
    assert.equal(readCached(dir, parts), null);
    assert.equal(writeCached(dir, parts, run), true);
    assert.deepEqual(readCached(dir, parts), run);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test("every part of the key matters", () => {
  const base = cacheKey(parts);
  for (const [k, v] of Object.entries({
    suite: "luxon",
    commit: "d",
    nodeVersion: "v22",
    tzdata: "2025c",
    zone: "Asia/Kolkata",
    command: "y",
    install: '[{"cmd":"pnpm"}]',
    probe: "p2",
    attempt: 2,
  }))
    assert.notEqual(cacheKey({ ...parts, [k]: v }), base, k);
});

test("a serial suite has its own key; a key without serial is the key it had before", () => {
  assert.notEqual(cacheKey({ ...parts, serial: true }), cacheKey(parts));
  assert.equal(cacheKey({ ...parts, serial: false }), cacheKey(parts));
  assert.equal(
    cacheKey(parts),
    createHash("sha256")
      .update(JSON.stringify(Object.values(parts)))
      .digest("hex")
      .slice(0, 32),
  );
});

test("a run that could not run is not kept, so a rerun tries it again", () => {
  const dir = mkdtempSync(join(tmpdir(), "zm-"));
  try {
    const bad = {
      result: { tests: 0, failed: [], couldNotRun: "boom" },
      seen: [],
    };
    assert.equal(writeCached(dir, parts, bad), false);
    assert.equal(readCached(dir, parts), null);
  } finally {
    rmSync(dir, { recursive: true });
  }
});
