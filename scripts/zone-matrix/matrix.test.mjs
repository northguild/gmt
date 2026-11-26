import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { matrixOf, readMatrix } from "./matrix.mjs";

test("matrixOf reads the zones and Node majors of the gmt-matrix job", () => {
  const yaml = `jobs:
  gmt-matrix:
    strategy:
      matrix:
        node-version: [22, 24]
        timezone: ["UTC", "Asia/Kolkata"]
`;
  assert.deepEqual(matrixOf(yaml), {
    zones: ["UTC", "Asia/Kolkata"],
    node: ["22", "24"],
  });
});

test("matrixOf stops when the job or its matrix is missing", () => {
  assert.throws(() => matrixOf("jobs:\n  other: {}\n"), /gmt-matrix/);
});

test("the repo's ci.yml gives ten zones and three Node majors", () => {
  const path = fileURLToPath(
    new URL("../../.github/workflows/ci.yml", import.meta.url),
  );
  assert.ok(existsSync(path));
  const { zones, node } = readMatrix(path);
  assert.equal(zones.length, 10);
  assert.deepEqual(node, ["22", "24", "26"]);
});
