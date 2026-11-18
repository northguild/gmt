import assert from "node:assert/strict";
import test from "node:test";
import { CAUSES, causeProblems, matchCauses } from "./causes.mjs";

const suite = { id: "luxon", version: "3.7.2" };
const causes = {
  "luxon@3.7.2 | a": { cause: "every Node" },
  "luxon@3.7.2 | b": { cause: "Node 26 only", nodes: ["26"] },
};

test("the shipped cause map is valid", () => {
  assert.deepEqual(causeProblems(CAUSES), []);
});

test("matchCauses respects the Node scope and lists the rest as uncaused", () => {
  const on24 = matchCauses(suite, ["a", "b", "c"], "24", causes);
  assert.deepEqual(Object.keys(on24.caused), ["luxon@3.7.2 | a"]);
  assert.deepEqual(on24.uncaused, [
    "luxon@3.7.2 | b (Node 24)",
    "luxon@3.7.2 | c (Node 24)",
  ]);
  const on26 = matchCauses(suite, ["b"], "26", causes);
  assert.deepEqual(on26.uncaused, []);
  assert.ok(on26.used.has("luxon@3.7.2 | b"));
});

test("causeProblems flags a missing cause and a bad Node list", () => {
  assert.deepEqual(
    causeProblems({ x: { cause: "" }, y: { cause: "c", nodes: ["v26"] } }),
    ["x: no cause", "y: nodes must list Node majors"],
  );
});
