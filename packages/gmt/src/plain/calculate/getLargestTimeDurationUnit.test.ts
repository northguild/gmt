import { getLargestTimeDurationUnit } from "./getLargestTimeDurationUnit";

describe("getLargestTimeDurationUnit", () => {
  it("should return the largest unit from the array", () => {
    expect(getLargestTimeDurationUnit(["seconds", "minutes", "hours"])).toBe(
      "hours",
    );
    expect(getLargestTimeDurationUnit(["milliseconds", "seconds"])).toBe(
      "seconds",
    );
    expect(getLargestTimeDurationUnit(["microseconds", "milliseconds"])).toBe(
      "milliseconds",
    );
  });

  it("should default to seconds if no valid unit is found", () => {
    expect(getLargestTimeDurationUnit([])).toBe("seconds");
  });
});
