import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  parseDemitasse,
  parseJson,
  parseQunit,
  parseReport,
  parseTap,
} from "./parsers.mjs";

const fixture = (name) =>
  readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");

test("Jest JSON: ids are file › full name, load failures count, files are relative", () => {
  const result = parseJson(fixture("jest-sample.json"), "/work/luxon");
  assert.ok(result.tests > 0);
  assert.ok(result.failed.length >= 2);
  assert.ok(result.failed.every((id) => !id.startsWith("/")));
  assert.ok(
    result.failed.includes("test/broken.test.js › (file did not load)"),
  );
  assert.equal(result.couldNotRun, undefined);
});

test("Vitest JSON: each failure keeps the first line of its message, without colour", () => {
  const report = JSON.stringify({
    testResults: [
      {
        name: "/w/a.test.ts",
        status: "failed",
        assertionResults: [
          {
            status: "failed",
            fullName: "slow",
            failureMessages: [
              "\n\u001b[31mError: Test timed out in 5000ms.\u001b[39m\n    at x (a.ts:1:1)",
            ],
          },
          { status: "failed", fullName: "silent", failureMessages: [] },
        ],
      },
    ],
  });
  const result = parseJson(report, "/w");
  assert.deepEqual(result.messages, {
    "a.test.ts › slow": "Error: Test timed out in 5000ms.",
  });
});

test("Vitest JSON: a file that loads nothing is a failure even when marked passed", () => {
  const report = JSON.stringify({
    testResults: [
      {
        name: "/w/a.test.ts",
        status: "passed",
        message: "Failed to load url",
        assertionResults: [],
      },
      {
        name: "/w/b.test.ts",
        status: "passed",
        assertionResults: [{ status: "passed", fullName: "ok" }],
      },
    ],
  });
  const result = parseJson(report, "/w");
  assert.deepEqual(result.failed, ["a.test.ts › (file did not load)"]);
  assert.equal(result.tests, 1);
});

test("a report with no tests, or no JSON, is couldNotRun", () => {
  assert.match(
    parseJson(JSON.stringify({ testResults: [] }), "/w").couldNotRun,
    /no tests/,
  );
  assert.match(parseJson("", "/w").couldNotRun, /JSON/);
});

test("QUnit: the summary gives the count; stack lines name the file of each failure", () => {
  const result = parseQunit(
    fixture("moment-apia.out"),
    fixture("moment-apia.err"),
  );
  assert.equal(result.tests, 3943);
  assert.ok(result.failed.length > 0);
  assert.ok(
    result.failed.includes(
      "locale/ar-ly.js › locale:ar-ly > weeks year starting sunday formatted",
    ),
  );
});

test("QUnit: no summary line means the run did not finish", () => {
  assert.match(parseQunit("", "").couldNotRun, /summary/);
});

test("TAP: each assertion is a test; ids carry the section", () => {
  const result = parseTap(fixture("tap-sample.txt"));
  assert.equal(result.tests, 7);
  assert.deepEqual(result.failed, [
    "tape › diff › .diff() across the date line",
  ]);
});

test("demitasse: markers, nesting and detail lines", () => {
  const result = parseDemitasse(fixture("demitasse-sample.txt"));
  assert.equal(result.tests, 4);
  assert.deepEqual(result.failed, [
    "demitasse › Date.since(simple, simple) › Before Leap Day › < 2020-01-03 : 2020-02-15 (years)> › (2020-02-15).add(P1M12D) => 2020-03-27",
  ]);
});

test("demitasse: skipped and to-do leaves are not tests", () => {
  const result = parseDemitasse("group\n  ☑ a\n  ❀ b\n  ☐ c\n");
  assert.equal(result.tests, 1);
});

test("parseReport dispatches and rejects an unknown kind", () => {
  assert.equal(parseReport("tap", { stdout: "ok 1 a\n" }).tests, 1);
  assert.throws(() => parseReport("xml", {}), /unknown report kind/);
});
