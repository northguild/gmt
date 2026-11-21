/**
 * Runs each library shape on the Names-you-already-know slide against the versions pinned in this
 * folder, so no shape on stage is one the library rejects. Run: `node --test` in `scripts/zone-matrix`.
 *
 * Only the shape is shown on the slide, never its result, so this asserts the call runs and gives a
 * valid value (an invalid date, `NaN` and a throw each fail). The GMT call of each entry is
 * computed by the deck at build time.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import dayjs from "dayjs";
import { addMonths, differenceInCalendarDays, startOfMonth } from "date-fns";
import moment from "moment";

const entries = JSON.parse(
  readFileSync(
    new URL(
      "../../apps/dox/src/slides/give-me-temporal/familiar.json",
      import.meta.url,
    ),
    "utf8",
  ),
);

const scope = {
  moment,
  dayjs,
  addMonths,
  differenceInCalendarDays,
  startOfMonth,
};

/** Evaluates the code text of a shape with only the library names in scope. */
const evaluate = (shape) =>
  new Function(...Object.keys(scope), `"use strict"; return (${shape});`)(
    ...Object.values(scope),
  );

const isValid = (value) => {
  if (typeof value === "number") return Number.isFinite(value);
  if (value instanceof Date) return !Number.isNaN(value.getTime());
  return typeof value?.isValid === "function" && value.isValid();
};

test("familiar.json has entries, each with a job, three shapes and a GMT call", () => {
  assert.ok(entries.length >= 3);
  assert.equal(new Set(entries.map((e) => e.id)).size, entries.length);
  for (const e of entries) {
    for (const key of ["id", "job", "moment", "dateFns", "dayjs"])
      assert.ok(typeof e[key] === "string" && e[key].trim(), `${e.id} ${key}`);
    assert.match(e.gmt.module, /^plain\/calculate$/);
    assert.ok(e.gmt.name && Array.isArray(e.gmt.args), e.id);
  }
});

for (const e of entries) {
  for (const key of ["moment", "dateFns", "dayjs"]) {
    test(`${e.id}: the ${key} shape runs and gives a valid value`, () => {
      assert.ok(isValid(evaluate(e[key])), e[key]);
    });
  }
}

test("the shapes of one job agree on its answer", () => {
  const day = (d) => [d.getFullYear(), d.getMonth(), d.getDate()].join("-");
  const sameDay = (a, b) => day(a) === day(b);
  const add = entries.find((e) => e.id === "add-month");
  assert.ok(
    sameDay(evaluate(add.moment).toDate(), evaluate(add.dayjs).toDate()),
  );
  const days = entries.find((e) => e.id === "days-between");
  assert.equal(evaluate(days.moment), evaluate(days.dateFns));
  assert.equal(evaluate(days.dayjs), evaluate(days.dateFns));
});
