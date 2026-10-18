import { bench, describe } from "vitest";
import { dutyViolations } from "../src/workforce";
import { drivingCap, dutyLog, dutyRange } from "./fixtures";

describe("dutyViolations", () => {
  for (const days of [7, 90, 365]) {
    const log = dutyLog(days);
    const range = dutyRange(days);
    bench(
      `${days} d log`,
      () => {
        dutyViolations(log, range, drivingCap, { timeZone: "UTC" });
      },
      { time: 500 },
    );
  }
});
