/**
 * Tests of the Moment.js download recorder. Run: `node --test` in `scripts/zone-matrix`.
 * Nothing here reaches npm: `recordDownloads` takes the function that asks.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { FIRST_YEAR, recordDownloads, yearRanges } from "./npm-downloads.mjs";

test("each year runs in full, and the current one to today", () => {
  const years = yearRanges("2026-11-20");
  assert.deepEqual(years[0], {
    year: FIRST_YEAR,
    from: "2019-01-01",
    to: "2019-12-31",
    partial: false,
  });
  assert.deepEqual(years.at(-1), {
    year: 2026,
    from: "2026-01-01",
    to: "2026-11-20",
    partial: true,
  });
  assert.equal(years.length, 8);
});

test("it asks npm for each range and keeps its count", async () => {
  const asked = [];
  const record = await recordDownloads("2020-02-03", async (url) => {
    asked.push(url);
    return { downloads: asked.length * 10 };
  });
  assert.deepEqual(asked, [
    "https://api.npmjs.org/downloads/point/2019-01-01:2019-12-31/moment",
    "https://api.npmjs.org/downloads/point/2020-01-01:2020-02-03/moment",
  ]);
  assert.deepEqual(
    record.years.map((y) => y.downloads),
    [10, 20],
  );
  assert.deepEqual(
    record.years.map((y) => y.partial),
    [false, true],
  );
});

test("it fails when npm gives no count", async () => {
  await assert.rejects(
    recordDownloads("2019-05-05", async () => ({ error: "nope" })),
    /no download count for 2019/,
  );
});
