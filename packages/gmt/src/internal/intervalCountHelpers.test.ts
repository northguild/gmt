import { Temporal } from "@js-temporal/polyfill";
import { getUnitSpan } from "./intervalCountHelpers";

describe("getUnitSpan", () => {
  it("returns the whole-unit field of a calendar-unit duration", () => {
    const duration = Temporal.PlainDate.from("2024-01-01").until(
      Temporal.PlainDate.from("2024-03-01"),
      { largestUnit: "month" },
    );

    expect(getUnitSpan(duration, "month")).toBe(2);
  });

  it("floors a partial trailing amount instead of rounding it up", () => {
    const duration = Temporal.PlainTime.from("12:00:00").until(
      Temporal.PlainTime.from("14:30:00"),
      { largestUnit: "hour" },
    );

    expect(getUnitSpan(duration, "hour")).toBe(2);
  });

  it("returns 0 for a zero duration", () => {
    const duration = Temporal.PlainDate.from("2024-01-01").until(
      Temporal.PlainDate.from("2024-01-01"),
      { largestUnit: "day" },
    );

    expect(getUnitSpan(duration, "day")).toBe(0);
  });
});
