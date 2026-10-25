import { describe } from "vitest";
import { buildBusinessCalendar } from "../src/calendar/rules";
import type { BusinessCalendarSpec, HolidayRule } from "../src/types";
import { bench } from "./fixtures";

const SAT_FRI_SUN_MON = { 6: { previous: 5 }, 7: { next: 1 } } as const;
const NEXT_WORKING = { 6: "nextWorkingDay", 7: "nextWorkingDay" } as const;

/** Eleven rules, two of them with a `nextWorkingDay` shift. */
const elevenRules: HolidayRule[] = [
  { name: "a", kind: "fixed", month: 1, day: 1, observed: SAT_FRI_SUN_MON },
  { name: "b", kind: "nthWeekday", month: 1, weekday: 1, n: 3 },
  { name: "c", kind: "easterRelative", offsetDays: -2 },
  { name: "d", kind: "easterRelative", offsetDays: 1 },
  { name: "e", kind: "nthWeekday", month: 5, weekday: 1, n: "last" },
  { name: "f", kind: "fixed", month: 7, day: 4, observed: SAT_FRI_SUN_MON },
  { name: "g", kind: "nthWeekday", month: 9, weekday: 1, n: 1 },
  { name: "h", kind: "fixed", month: 8, day: 15, observed: { 6: { next: 1 } } },
  { name: "i", kind: "fixed", month: 11, day: 1, observed: { 7: { next: 1 } } },
  { name: "j", kind: "fixed", month: 12, day: 25, observed: NEXT_WORKING },
  { name: "k", kind: "fixed", month: 12, day: 26, observed: NEXT_WORKING },
];

const sixRules: HolidayRule[] = [
  { name: "a", kind: "fixed", month: 1, day: 1 },
  { name: "b", kind: "easterRelative", offsetDays: -2 },
  { name: "c", kind: "easterRelative", offsetDays: 1 },
  { name: "d", kind: "fixed", month: 5, day: 1 },
  { name: "e", kind: "fixed", month: 12, day: 25 },
  { name: "f", kind: "fixed", month: 12, day: 26 },
];

function specFor(rules: HolidayRule[], years: number): BusinessCalendarSpec {
  return {
    timeZone: "UTC",
    weekend: [6, 7],
    rules,
    years: { from: 2000, to: 1999 + years },
  };
}

describe("buildBusinessCalendar", () => {
  for (const years of [1, 10, 400]) {
    const spec = specFor(elevenRules, years);
    bench(
      `eleven rules, ${years} years`,
      () => {
        buildBusinessCalendar(spec);
      },
      { time: 500 },
    );
  }

  const six = specFor(sixRules, 10);
  bench(
    "six rules, 10 years",
    () => {
      buildBusinessCalendar(six);
    },
    { time: 500 },
  );

  const hebrew = specFor(
    [
      {
        name: "h",
        kind: "calendarFixed",
        calendar: "hebrew",
        monthCode: "M07",
        day: 15,
      },
    ],
    10,
  );
  bench(
    "one calendarFixed hebrew rule, 10 years",
    () => {
      buildBusinessCalendar(hebrew);
    },
    { time: 500 },
  );
});
