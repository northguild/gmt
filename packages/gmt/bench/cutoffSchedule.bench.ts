import { bench, describe } from "vitest";
import { cutoffSchedule } from "../src/transport";

const cutoffs = Array.from({ length: 50 }, (_, index) => ({
  name: `cutoff-${index}`,
  offset: `P${index % 10}DT${index % 5}H`,
  atLocalTime: index % 2 === 0 ? "17:00" : undefined,
}));

// A rolling calendar with 50 entries: the zone and the calendar are the cost.
describe("cutoffSchedule", () => {
  bench(
    "cutoffSchedule, 50 entries, rolling calendar",
    () => {
      cutoffSchedule("2024-06-18T16:00:00Z", cutoffs, {
        timeZone: "Europe/Amsterdam",
        calendar: {
          weekend: [6, 7],
          holidays: ["2024-06-14", "2024-06-17"],
          timeZone: "Europe/Amsterdam",
        },
        roll: "preceding",
      });
    },
    { time: 500 },
  );
});
