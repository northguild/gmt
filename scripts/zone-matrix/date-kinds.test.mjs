/**
 * Tests of the date-kinds runner. Run: `node --test` in `scripts/zone-matrix`.
 *
 * The kinds files here are throwaway fixtures; nothing here writes `date-kinds-run.json`.
 *
 * - the cases that stop a run (no code, no kinds, a malformed or repeated id, a kind with no call);
 * - one record per kind id, each hashed with its own call, with a fake `run` for the whole matrix;
 * - the committed `date-kinds.json` passes the same checks.
 */
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";
import { hashOf, Stop } from "./agent-answer.mjs";
import { COMMAND, KINDS_FILE, kindsOf, runKinds } from "./date-kinds.mjs";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const WORK_ROOT = join(HERE, ".work");
const dirs = [];
const workDir = () => {
  mkdirSync(WORK_ROOT, { recursive: true });
  const dir = mkdtempSync(join(WORK_ROOT, "date-kinds-test-"));
  dirs.push(dir);
  return dir;
};
after(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
});

const file = {
  code: "export const f = (x) => x;",
  want: "a",
  kinds: [
    { id: "one", kind: "One", call: 'f("a")' },
    { id: "two", kind: "Two", call: 'f("b")' },
  ],
};

/** A fake cell: the runner's own marked line, as a Node of that major and tzdata would print it. */
const fakeCell = (value) => async (node, _args, env) => ({
  code: 0,
  stderr: "",
  stdout: `@@agent-answer@@ ${JSON.stringify({
    node: `v${node}.0.0`,
    tzdata: "2026b",
    zone: env.TZ,
    value: value(node, env.TZ),
  })}\n`,
});

test("a file that cannot be run stops with exit 2 and names the file and the fault", () => {
  const cases = [
    [{ ...file, code: " " }, "the code is empty"],
    [{ ...file, kinds: [] }, "there are no kinds"],
    [{ ...file, kinds: [{ id: "Bad Id", call: "f()" }] }, '"Bad Id"'],
    [{ ...file, kinds: [file.kinds[0], file.kinds[0]] }, '"one" is used twice'],
    [{ ...file, kinds: [{ id: "one", call: "" }] }, '"one" has no call'],
  ];
  for (const [bad, says] of cases)
    assert.throws(
      () => kindsOf(bad),
      (error) =>
        error instanceof Stop &&
        error.code === 2 &&
        error.message.includes("date-kinds.json") &&
        error.message.includes(says),
    );
});

test("each kind is run in every zone and Node of the matrix and recorded by its id, hashed with its own call", async () => {
  const records = await runKinds({
    file,
    matrix: { zones: ["Europe/Helsinki", "Pacific/Niue"], node: ["24", "26"] },
    pinned: {},
    run: fakeCell((node, zone) => `${node}:${zone}`),
    now: () => "2026-11-20T00:00:00Z",
    version: (name) => `v-${name}`,
    workDir: workDir(),
  });
  assert.deepEqual(Object.keys(records), ["one", "two"]);
  assert.equal(records.one.sha256, hashOf(file.code, 'f("a")'));
  assert.equal(records.two.sha256, hashOf(file.code, 'f("b")'));
  assert.equal(records.one.command, COMMAND);
  assert.equal(records.two.values.flat().length, 4);
});

test("the committed kinds file can be run", () => {
  const kinds = kindsOf(JSON.parse(readFileSync(KINDS_FILE, "utf8")));
  assert.ok(kinds.length > 1);
});
