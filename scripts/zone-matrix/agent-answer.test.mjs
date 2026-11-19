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
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
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
  runAll,
  runAnswer,
  SHOWN_ZONE,
  spawnBounded,
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
  assert.equal(record.values.flat().length, 4);
  assert.deepEqual(record.nodes[0], {
    node: "24",
    version: "v24.0.0",
    tzdata: "2026b",
  });
  assert.equal(record.zones[0], "Europe/Helsinki");
  assert.equal(record.values[0][0], "24:Europe/Helsinki");
});

test("runs the zone the slide shows on every Node major, when the CI matrix lacks it", async () => {
  const record = await runAnswer({
    ...base,
    matrix: { zones: ["UTC", "Pacific/Niue"], node: ["24", "26"] },
    run: fakeCell((node, zone) => `${node}:${zone}`),
    workDir: workDir(),
  });
  assert.deepEqual(
    record.nodes.map((n) => n.node),
    ["24", "26"],
  );
  assert.deepEqual(record.zones, ["UTC", "Pacific/Niue", SHOWN_ZONE]);
  assert.deepEqual(record.values, [
    ["24:UTC", "24:Pacific/Niue", `24:${SHOWN_ZONE}`],
    ["26:UTC", "26:Pacific/Niue", `26:${SHOWN_ZONE}`],
  ]);
});

test("does not run the shown zone twice when the CI matrix has it", async () => {
  const record = await runAnswer({
    ...base,
    run: fakeCell((node, zone) => `${node}:${zone}`),
    workDir: workDir(),
  });
  assert.equal(record.zones.filter((z) => z === SHOWN_ZONE).length, 1);
  assert.equal(record.values.flat().length, 4);
});

test("a Node major whose version or tzdata changes between zones stops the run", async () => {
  let cell = 0;
  await assert.rejects(
    runAnswer({
      ...base,
      run: async (node, _args, env) => ({
        code: 0,
        stderr: "",
        stdout: `@@agent-answer@@ ${JSON.stringify({
          node: `v${node}.0.0`,
          tzdata: cell++ === 1 ? "2026c" : "2026b",
          zone: env.TZ,
          value: "v",
        })}\n`,
      }),
      workDir: workDir(),
    }),
    (error) =>
      error instanceof Stop &&
      error.code === 1 &&
      /with tzdata 2026c, not v24\.0\.0 with 2026b/.test(error.message),
  );
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

/** Runs the real runner once, on this Node, in one zone. A runner that does not exit fails the test, not hangs it. */
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
        timeout: 10_000,
      });
      return { code: r.status, stdout: r.stdout, stderr: r.stderr };
    },
    workDir: workDir(),
  });

test("the runner exits once it has the value, even with the code's timer still pending", async () => {
  const r = await runHere({
    code: "export const f = () => { setTimeout(() => {}, 2 ** 31 - 1); return 'armed'; };",
    call: "f()",
  });
  assert.equal(r.values[0][0], "armed");
});

test("a cell that does not finish in time is killed with everything it started", async () => {
  const dir = workDir();
  const pidFile = join(dir, "grandchild.pid");
  // The child starts a grandchild that never ends, as `fnm exec` starts `node`.
  const script = `const { spawn } = require("node:child_process");
const g = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { stdio: "inherit" });
require("node:fs").writeFileSync(${JSON.stringify(pidFile)}, String(g.pid));
setInterval(() => {}, 1000);`;
  const started = performance.now();
  const r = await spawnBounded(process.execPath, ["-e", script], {}, 1_000);
  assert.equal(r.timedOut, true);
  assert.ok(performance.now() - started < 8_000);
  const grandchild = Number(readFileSync(pidFile, "utf8"));
  assert.throws(() => process.kill(grandchild, 0), { code: "ESRCH" });
});

test("a cell that timed out stops the run and says so", async () => {
  await assert.rejects(
    runAnswer({
      ...base,
      run: async () => ({ code: null, stdout: "", stderr: "", timedOut: true }),
      workDir: workDir(),
    }),
    (error) =>
      error instanceof Stop &&
      error.code === 1 &&
      /did not finish within/.test(error.message),
  );
});

const transcript = {
  question: "q",
  quoted: "two",
  answers: [
    {
      id: "one",
      model: "m1",
      date: "d",
      answer: "a",
      code: "export const f = () => 'one';",
      call: "f()",
    },
    {
      id: "two",
      model: "m2",
      date: "d",
      answer: "a",
      code: "export const g = () => 'two';",
      call: "g()",
    },
  ],
};

test("every answer is run, under the shared question, and recorded by its id", async () => {
  const seen = [];
  const file = await runAll({
    ...base,
    transcript,
    run: fakeCell((node, zone) => `${node}:${zone}`),
    workDir: workDir(),
    onAnswer: (id) => seen.push(id),
  });
  assert.deepEqual(Object.keys(file), ["one", "two"]);
  assert.deepEqual(seen, ["one", "two"]);
  assert.equal(file.one.sha256, hashOf(transcript.answers[0].code, "f()"));
  assert.equal(file.two.sha256, hashOf(transcript.answers[1].code, "g()"));
  assert.equal(file.two.values.flat().length, 4);
});

test("a transcript whose answers cannot be told apart, or whose quoted answer is missing, stops with exit 2", async () => {
  const bad = [
    [{ ...transcript, question: " " }, /question/],
    [{ ...transcript, answers: [] }, /no answers/],
    [
      {
        ...transcript,
        answers: [
          transcript.answers[0],
          { ...transcript.answers[1], id: "one" },
        ],
      },
      /"one" is used twice/,
    ],
    [
      {
        ...transcript,
        answers: [{ ...transcript.answers[0], id: "Not An Id" }],
        quoted: "Not An Id",
      },
      /id/,
    ],
    [{ ...transcript, quoted: "three" }, /quoted.*"three"/],
    [
      {
        ...transcript,
        answers: [
          transcript.answers[0],
          { ...transcript.answers[1], call: "" },
        ],
      },
      /"two".*call/,
    ],
  ];
  for (const [t, message] of bad)
    await assert.rejects(
      runAll({
        ...base,
        transcript: t,
        run: () => assert.fail("no cell may run"),
        workDir: workDir(),
      }),
      (error) =>
        error instanceof Stop &&
        error.code === 2 &&
        error.message.includes("agent-answer.json") &&
        message.test(error.message),
    );
});

test("ES module code runs, with a function that is not exported", async () => {
  const r = await runHere({
    code: "function reminder() { return new Date(Date.UTC(2027, 2, 28, 1, 30)).toISOString(); }\nconsole.log('chatter');", // date-ban: an agent's code under test, as text
    call: "reminder()",
  });
  assert.equal(r.values[0][0], "2027-03-28T01:30:00.000Z");
  assert.equal(r.zones[0], "Europe/Helsinki");
});

test("CommonJS code runs, and its own requires resolve", async () => {
  const r = await runHere({
    code: "const { join } = require('node:path');\nmodule.exports = { f: () => join('a', 'b') };",
    call: "module.exports.f()",
  });
  assert.equal(r.values[0][0], join("a", "b"));
});

test("a promise is awaited", async () => {
  const r = await runHere({
    code: "export const f = () => new Promise((done) => setTimeout(() => done('late'), 5));",
    call: "f()",
  });
  assert.equal(r.values[0][0], "late");
});

test("a throw is recorded, and so is a load error", async () => {
  const thrown = await runHere({
    code: "export const f = () => { throw new RangeError('no such time'); };",
    call: "f()",
  });
  assert.deepEqual(thrown.values[0][0], { threw: "RangeError: no such time" });
  const broken = await runHere({
    code: "throw new TypeError('at load');",
    call: "1",
  });
  assert.deepEqual(broken.values[0][0], { threw: "TypeError: at load" });
});

test("a value that is not a string is written as JSON, a date as an ISO string", async () => {
  const obj = await runHere({
    code: "export const f = () => ({ a: 1 });",
    call: "f()",
  });
  assert.equal(obj.values[0][0], '{"a":1}');
  const date = await runHere({
    code: "export const f = () => new Date(0);", // date-ban: an agent's code under test, as text
    call: "f()",
  });
  assert.equal(date.values[0][0], "1970-01-01T00:00:00.000Z");
});

test("the zone of the cell is the zone the code sees", async () => {
  const code =
    "export const f = () => Intl.DateTimeFormat().resolvedOptions().timeZone;";
  const r = await runHere({ code, call: "f()" }, "Pacific/Niue");
  assert.equal(r.values[0][0], "Pacific/Niue");
});

test("a pinned library resolves from this folder's node_modules", async () => {
  const r = await runHere({
    code: "import { DateTime } from 'luxon';\nexport const f = () => DateTime.fromISO('2027-03-28T03:30:00', { zone: 'Europe/Helsinki' }).toUTC().toISO();",
    call: "f()",
  });
  assert.equal(typeof r.values[0][0], "string");
  assert.deepEqual(r.libraries, { luxon: "v-luxon" });
});
