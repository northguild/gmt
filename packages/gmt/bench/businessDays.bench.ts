import { describe } from "vitest";
import { addBusinessDays, businessDaysBetween } from "../src/calendar";
import { addDaysTo, bench, businessCalendar, holidays480 } from "./fixtures";

const START = "2024-01-01";
const spans: Array<[string, number]> = [
  ["10 days", 10],
  ["1 year", 365],
  ["30 years", 10_957],
];
const holidaySets: Array<[string, string[]]> = [
  ["0 holidays", []],
  ["480 holidays", holidays480],
];

describe("businessDaysBetween", () => {
  for (const [setName, holidays] of holidaySets) {
    const calendar = businessCalendar(holidays);
    for (const [name, days] of spans) {
      const end = addDaysTo(START, days);
      bench(
        `${setName}, ${name}`,
        () => {
          businessDaysBetween(START, end, calendar);
        },
        { time: 500 },
      );
    }
  }
});

describe("addBusinessDays", () => {
  for (const [setName, holidays] of holidaySets) {
    const calendar = businessCalendar(holidays);
    for (const [name, days] of spans) {
      // About five business days in seven.
      const amount = Math.round((days * 5) / 7);
      bench(
        `${setName}, ${name}`,
        () => {
          addBusinessDays(START, amount, calendar);
        },
        { time: 500 },
      );
    }
  }
});
