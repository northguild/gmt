/**
 * Tests of the `@internationalized/date` calendar probe. Run: `node --test` in `scripts/zone-matrix`.
 *
 * - the checks against fake libraries, so each count and each first difference is known;
 * - the committed record is the probe's own current output on the installed library.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  INDIAN_YEARS,
  PERSIAN_YEARS,
  probeCalendars,
  RECORD_FILE,
  recordCalendars,
  sourceHash,
} from "./intl-date-calendars.mjs";

/** A library whose every calendar answers as the reference does, except where a test says. */
const fakes = ({ persianLate = [], meijiFrom = null, chinese = "chinese" }) => {
  const reference = {
    PlainDate: {
      from(arg) {
        if (typeof arg === "string") return fakeDay(arg);
        if (arg.calendar === "persian")
          return { toString: () => `${2000 + arg.year}-03-20` };
        return { toString: () => `${arg.year}-${arg.month}-01` };
      },
      compare: (a, b) => (a.iso < b.iso ? -1 : a.iso > b.iso ? 1 : 0),
    },
  };
  function fakeDay(text) {
    const [year, month, day] = text.split("-").map(Number);
    return {
      iso: text,
      year,
      month,
      day,
      toString: () => text,
      add: () => {
        return fakeDay(
          Temporal.PlainDate.from(text).add({ days: 1 }).toString(),
        );
      },
      withCalendar: () => ({ era: "ce", eraYear: year }),
    };
  }
  class Plain {
    constructor(calendar, year, month, day) {
      this.args = [calendar, year, month, day];
    }
  }
  const lib = {
    CalendarDate: class {
      constructor(...args) {
        if (typeof args[0] === "number") {
          [this.year, this.month, this.day] = args;
        } else this.plain = new Plain(...args);
      }
    },
    GregorianCalendar: class {},
    IndianCalendar: class {},
    JapaneseCalendar: class {},
    PersianCalendar: class {},
    createCalendar: () => ({ identifier: chinese }),
    toCalendar(date, calendar) {
      if (calendar.constructor.name === "JapaneseCalendar") {
        const meiji = meijiFrom !== null && date.year >= meijiFrom;
        return { era: meiji ? "meiji" : "ce", year: date.year };
      }
      const [cal, year, month] = date.plain.args;
      if (cal.constructor.name === "PersianCalendar")
        return {
          toString: () =>
            `${2000 + year}-03-${persianLate.includes(year) ? 21 : 20}`,
        };
      return { toString: () => `${year}-${month}-01` };
    },
  };
  return { lib, Temporal: reference };
};

test("counts the years Nowruz is a day late, and names the first", () => {
  const { persian } = probeCalendars(fakes({ persianLate: [5, 9] }));
  assert.equal(persian.years, PERSIAN_YEARS);
  assert.equal(persian.differ, 2);
  assert.deepEqual(persian.first, {
    year: 5,
    gives: "2005-03-21",
    expected: "2005-03-20",
  });
});

test("counts every day whose era or era year differs", () => {
  const { japanese } = probeCalendars(fakes({ meijiFrom: 1870 }));
  assert.equal(japanese.days, 2192);
  assert.equal(japanese.differ, 1461);
  assert.equal(japanese.first.date, "1870-01-01");
  assert.equal(japanese.last.date, "1873-12-31");
});

test("a library that agrees everywhere records no difference", () => {
  const out = probeCalendars(fakes({}));
  assert.equal(out.persian.differ, 0);
  assert.equal(out.persian.first, null);
  assert.equal(out.japanese.differ, 0);
  assert.equal(out.indian.years, INDIAN_YEARS);
});

test("records the calendar the library answers a Chinese request with", () => {
  assert.equal(
    probeCalendars(fakes({ chinese: "gregory" })).chinese.gotIdentifier,
    "gregory",
  );
});

test("the committed record is this probe's output on the installed library", async (t) => {
  if (!globalThis.Temporal)
    return t.skip("needs a Node with Temporal built in");
  const committed = JSON.parse(readFileSync(RECORD_FILE, "utf8"));
  assert.equal(committed.sourceSha256, sourceHash());
  // The Node patch release that measured it is not part of what it found.
  assert.deepEqual(
    { ...committed, node: null },
    { ...(await recordCalendars()), node: null },
  );
});
