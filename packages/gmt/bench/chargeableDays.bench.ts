import { bench, describe } from "vitest";
import { chargeableDays } from "../src/intermodal";
import { clearTransitionMemo } from "../src/internal/zonedTransitionSearch";
import {
  businessCalendar,
  freeTimeStart,
  holidays480,
  utcMidnight,
} from "./fixtures";

const rows: Array<[string, number]> = [
  ["2 weeks", 14],
  ["1 year", 365],
  ["10 years", 3652],
];

// 10 years stays under MAX_WALKED_DAYS.
describe("chargeableDays, calendar basis", () => {
  for (const timeZone of ["America/Port_of_Spain", "Europe/London"]) {
    for (const [name, days] of rows) {
      const end = utcMidnight("2024-06-14", days);
      bench(
        `${timeZone}, ${name}`,
        () => {
          chargeableDays(freeTimeStart, end, 3, {
            basis: "calendar",
            chargeBasis: "calendar",
            timeZone,
            firstDay: "eventDay",
          });
        },
        { time: 500 },
      );
    }
  }
});

describe("chargeableDays, working basis, 480 holidays", () => {
  const calendar = businessCalendar(holidays480);
  for (const [name, days] of rows) {
    const end = utcMidnight("2024-06-14", days);
    bench(
      `Europe/London, ${name}`,
      () => {
        chargeableDays(freeTimeStart, end, 3, {
          basis: "working",
          chargeBasis: "working",
          timeZone: "Europe/London",
          firstDay: "eventDay",
          calendar,
        });
      },
      { time: 500 },
    );
  }
});

// chargedDates returns one ISO string per charged day, so the rows above grow with their output.
// With 3,640 free days a 10-year dwell charges about a dozen, which times the walk alone.
describe("chargeableDays, near-empty output", () => {
  const end = utcMidnight("2024-06-14", 3652);
  bench(
    "Europe/London, 10 years, 3,640 free days",
    () => {
      chargeableDays(freeTimeStart, end, 3640, {
        basis: "calendar",
        chargeBasis: "calendar",
        timeZone: "Europe/London",
        firstDay: "eventDay",
      });
    },
    { time: 500 },
  );
});

describe("chargeableDays, cold", () => {
  const end = utcMidnight("2024-06-14", 3652);
  bench(
    "Europe/London, 10 years cold",
    () => {
      clearTransitionMemo();
      chargeableDays(freeTimeStart, end, 3, {
        basis: "calendar",
        chargeBasis: "calendar",
        timeZone: "Europe/London",
        firstDay: "eventDay",
      });
    },
    { time: 500 },
  );
});
