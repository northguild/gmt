/**
 * Tests of the agent-answer runner. Run: `node --test` in `scripts/zone-matrix`.
 *
 * Every transcript here is a throwaway fixture written for the test. None of them is the owner's
 * real answer, and nothing here writes `agent-run.json`.
 *
 * - the cases that stop a run (an empty field, an unpinned package) and what they print;
 * - how imports are found and how the module system is chosen;
 * - the run itself over fixtures (ESM, CJS, async, a throw, a function that is not exported), with
 *   a fake `run` for the whole matrix and the real runner on this Node for one zone.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  COMMAND,
  Stop,
  emptyFields,
  hashOf,
  kindOf,
  packageOf,
  packagesOf,
  pinCommand,
  resultOf,
  runAnswer,
  specifiersOf,
} from "./agent-answer.mjs";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const WORK_ROOT = join(HERE, ".work");
const dirs = [];
const workDir = () => {
  mkdirSync(WORK_ROOT, { recursive: true });
  const dir = mkdtempSync(join(WORK_ROOT, "agent-answer-test-"));
  dirs.push(dir);
  return dir;
};
after(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
});

const full = {
  question: "q",
  model: "m",
  date: "d",
  answer: "a",
  code: "export const f = () => 'x';",
  call: "f()",
};
const matrix = {
  zones: ["Europe/Helsinki", "Pacific/Niue"],
  node: ["24", "26"],
};
const base = {
  record: full,
  pinned: { luxon: "3.7.2" },
  matrix,
  now: () => "2026-11-19T00:00:00Z",
  version: (name) => `v-${name}`,
};

/** A fake cell: the runner's own marked line, as a Node of that major and tzdata would print it. */
const fakeCell = (value) => async (node, _args, env) => ({
  code: 0,
  stderr: "",
  stdout: `noise from the code\n@@agent-answer@@ ${JSON.stringify({
    node: `v${node}.0.0`,
    tzdata: "2026b",
    zone: env.TZ,
    value: typeof value === "function" ? value(node, env.TZ) : value,
  })}\n`,
});

test("an empty field stops the run with exit 2 and names the file", async () => {
  for (const field of ["question", "model", "date", "answer", "code", "call"]) {
    await assert.rejects(
      runAnswer({
        ...base,
        record: { ...full, [field]: "  " },
        run: () => assert.fail("no cell may run"),
        workDir: workDir(),
      }),
      (error) =>
        error instanceof Stop &&
        error.code === 2 &&
        error.message.includes("agent-answer.json") &&
        error.message.includes(field),
    );
  }
  assert.deepEqual(emptyFields({ ...full, model: "" }), ["model"]);
  assert.deepEqual(emptyFields({}), [
    "question",
    "model",
    "date",
    "answer",
    "code",
    "call",
  ]);
});

test("a package that is not pinned stops the run with the pin command", async () => {
  await assert.rejects(
    runAnswer({
      ...base,
      record: {
        ...full,
        code: "import { DateTime } from 'luxon';\nimport dayjs from 'dayjs/plugin/utc';\n",
      },
      run: () => assert.fail("no cell may run"),
      workDir: workDir(),
    }),
    (error) =>
      error instanceof Stop &&
      error.code === 2 &&
      error.message.includes('"dayjs"') &&
      error.message.includes(pinCommand("dayjs")) &&
      error.message.includes("--save-exact"),
  );
});

test("imports are found in every form and mapped to package names", () => {
  const code = `
import a from "pkg-a";
import { b } from '@scope/pkg-b/sub';
import * as c from "node:fs";
import "side-effect";
export { d } from "pkg-d";
const e = require("pkg-e");
const f = await import("pkg-f/deep");
import g from "./local.js";
import h from "node:path";
import i from "fs/promises";
`;
  assert.deepEqual(specifiersOf(code), [
    "pkg-a",
    "@scope/pkg-b/sub",
    "node:fs",
    "side-effect",
    "pkg-d",
    "pkg-e",
    "pkg-f/deep",
    "./local.js",
    "node:path",
    "fs/promises",
  ]);
  assert.deepEqual(packagesOf(code), [
    "pkg-a",
    "@scope/pkg-b",
    "side-effect",
    "pkg-d",
    "pkg-e",
    "pkg-f",
  ]);
  assert.equal(packageOf("node:test"), null);
  assert.equal(packageOf("path"), null);
  assert.equal(packageOf("../x"), null);
});

test("the module system follows how the code is written", () => {
  assert.equal(kindOf("import x from 'y';\nexport const a = 1;"), "esm");
  assert.equal(
    kindOf("const x = require('y');\nmodule.exports = { a };"),
    "cjs",
  );
  assert.equal(kindOf("function a() { return 1; }"), "esm");
  assert.equal(kindOf("const x = await import('y');"), "esm");
});

test("the hash joins code and call with a NUL, as the slide's does", () => {
  assert.equal(
    hashOf("a", "b"),
    "59b271ae1bbcb1d31d41929817f4b16fb439eb4f31520b5ad1d5ce98920a7138",
  );
  assert.equal(hashOf("a", "b"), hashOf("a", "b"));
  assert.notEqual(hashOf("a", "b"), hashOf("ab", ""));
  assert.match(hashOf("a", "b"), /^[0-9a-f]{64}$/);
});

test("the last marked line is the result, whatever else the code printed", () => {
  assert.deepEqual(
    resultOf(
      'x\n@@agent-answer@@ {"value":"1"}\nmore\n@@agent-answer@@ {"value":"2"}\n',
    ),
    { value: "2" },
  );
  assert.equal(resultOf("nothing here"), null);
  assert.equal(resultOf("@@agent-answer@@ {broken"), null);
});

test("every zone and Node of the matrix gets a run record", async () => {
  const code = "import { DateTime } from 'luxon';\nexport const f = () => 'x';";
  const record = await runAnswer({
    ...base,
    record: { ...full, code },
    run: fakeCell((node, zone) => `${node}:${zone}`),
    workDir: workDir(),
  });
  assert.equal(record.sha256, hashOf(code, "f()"));
  assert.equal(record.command, COMMAND);
  assert.equal(record.instant, "2026-11-19T00:00:00Z");
  assert.deepEqual(record.libraries, { luxon: "v-luxon" });
  assert.equal(record.runs.length, 4);
  assert.deepEqual(record.runs[0], {
    node: "24",
    nodeVersion: "v24.0.0",
    tzdata: "2026b",
    zone: "Europe/Helsinki",
    value: "24:Europe/Helsinki",
  });
});

test("a cell that ran in another zone stops the run", async () => {
  await assert.rejects(
    runAnswer({
      ...base,
      run: async (node) => ({
        code: 0,
        stderr: "",
        stdout: `@@agent-answer@@ ${JSON.stringify({ node, tzdata: "x", zone: "UTC", value: "v" })}\n`,
      }),
      workDir: workDir(),
    }),
    (error) =>
      error instanceof Stop &&
      error.code === 1 &&
      /not Europe\/Helsinki/.test(error.message),
  );
});

test("a cell with no result stops the run with its error output", async () => {
  await assert.rejects(
    runAnswer({
      ...base,
      run: async () => ({ code: 1, stdout: "", stderr: "boom" }),
      workDir: workDir(),
    }),
    (error) =>
      error instanceof Stop &&
      error.code === 1 &&
      error.message.includes("boom"),
  );
});

/** Runs the real runner once, on this Node, in one zone. */
const runHere = (record, zone = "Europe/Helsinki") =>
  runAnswer({
    ...base,
    record: { ...full, ...record },
    matrix: { zones: [zone], node: ["here"] },
    run: async (_node, args, env) => {
      const r = spawnSync(process.execPath, args, {
        cwd: HERE,
        env: { ...process.env, ...env },
        encoding: "utf8",
      });
      return { code: r.status, stdout: r.stdout, stderr: r.stderr };
    },
    workDir: workDir(),
  });

test("ES module code runs, with a function that is not exported", async () => {
  const r = await runHere({
    code: "function reminder() { return new Date(Date.UTC(2027, 2, 28, 1, 30)).toISOString(); }\nconsole.log('chatter');",
    call: "reminder()",
  });
  assert.equal(r.runs[0].value, "2027-03-28T01:30:00.000Z");
  assert.equal(r.runs[0].zone, "Europe/Helsinki");
});

test("CommonJS code runs, and its own requires resolve", async () => {
  const r = await runHere({
    code: "const { join } = require('node:path');\nmodule.exports = { f: () => join('a', 'b') };",
    call: "module.exports.f()",
  });
  assert.equal(r.runs[0].value, join("a", "b"));
});

test("a promise is awaited", async () => {
  const r = await runHere({
    code: "export const f = () => new Promise((done) => setTimeout(() => done('late'), 5));",
    call: "f()",
  });
  assert.equal(r.runs[0].value, "late");
});

test("a throw is recorded, and so is a load error", async () => {
  const thrown = await runHere({
    code: "export const f = () => { throw new RangeError('no such time'); };",
    call: "f()",
  });
  assert.deepEqual(thrown.runs[0].value, { threw: "RangeError: no such time" });
  const broken = await runHere({
    code: "throw new TypeError('at load');",
    call: "1",
  });
  assert.deepEqual(broken.runs[0].value, { threw: "TypeError: at load" });
});

test("a value that is not a string is written as JSON, a date as an ISO string", async () => {
  const obj = await runHere({
    code: "export const f = () => ({ a: 1 });",
    call: "f()",
  });
  assert.equal(obj.runs[0].value, '{"a":1}');
  const date = await runHere({
    code: "export const f = () => new Date(0);",
    call: "f()",
  });
  assert.equal(date.runs[0].value, "1970-01-01T00:00:00.000Z");
});

test("the zone of the cell is the zone the code sees", async () => {
  const code =
    "export const f = () => Intl.DateTimeFormat().resolvedOptions().timeZone;";
  const r = await runHere({ code, call: "f()" }, "Pacific/Niue");
  assert.equal(r.runs[0].value, "Pacific/Niue");
});

test("a pinned library resolves from this folder's node_modules", async () => {
  const r = await runHere({
    code: "import { DateTime } from 'luxon';\nexport const f = () => DateTime.fromISO('2027-03-28T03:30:00', { zone: 'Europe/Helsinki' }).toUTC().toISO();",
    call: "f()",
  });
  assert.equal(typeof r.runs[0].value, "string");
  assert.deepEqual(r.libraries, { luxon: "v-luxon" });
});
