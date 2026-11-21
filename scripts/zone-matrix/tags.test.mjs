import assert from "node:assert/strict";
import test from "node:test";
import { TAGS, matchTags, staleTags, tagKey, tagProblems } from "./tags.mjs";

const suite = { id: "moment", version: "2.31.0" };
const evidence = {
  input: "2021-01-01",
  zone: "Pacific/Apia",
  temporal: "2021-01-01",
  library: "2020-12-31",
};
const tags = {
  [tagKey("moment", "2.31.0", "a.js › one")]: {
    kind: "one-zone",
    reason: "hard-coded offset",
  },
  [tagKey("moment", "2.31.0", "a.js › scoped")]: {
    kind: "wrong-answer",
    reason: "week year",
    zones: ["Pacific/Apia"],
    evidence,
  },
  [tagKey("moment", "2.31.0", "a.js › unused")]: {
    kind: "one-zone",
    reason: "unused",
  },
};

test("the shipped tag map is valid", () => {
  assert.deepEqual(tagProblems(TAGS), []);
});

test("matchTags tags by key, respects the zone scope and lists the rest as untagged", () => {
  const apia = matchTags(
    suite,
    ["a.js › one", "a.js › scoped", "a.js › new"],
    "Pacific/Apia",
    tags,
  );
  assert.deepEqual(Object.keys(apia.tagged).sort(), [
    "moment@2.31.0 | a.js › one",
    "moment@2.31.0 | a.js › scoped",
  ]);
  assert.deepEqual(apia.untagged, ["moment@2.31.0 | a.js › new"]);
  const niue = matchTags(suite, ["a.js › scoped"], "Pacific/Niue", tags);
  assert.deepEqual(niue.untagged, ["moment@2.31.0 | a.js › scoped"]);
});

test("a tag for another version does not match", () => {
  const next = matchTags(
    { id: "moment", version: "2.32.0" },
    ["a.js › one"],
    "UTC",
    tags,
  );
  assert.equal(next.untagged.length, 1);
});

test("staleTags names tags no failure used", () => {
  const { used } = matchTags(
    suite,
    ["a.js › one", "a.js › scoped"],
    "Pacific/Apia",
    tags,
  );
  assert.deepEqual(staleTags(tags, used), ["moment@2.31.0 | a.js › unused"]);
});

test("tagProblems flags a bad kind, a missing reason and missing evidence", () => {
  const problems = tagProblems({
    a: { kind: "bug", reason: "x" },
    b: { kind: "one-zone", reason: "" },
    c: { kind: "wrong-answer", reason: "x", evidence: { input: "1" } },
  });
  assert.equal(problems.length, 1 + 1 + 3);
});
