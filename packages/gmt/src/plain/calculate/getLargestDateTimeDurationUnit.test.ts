import { getLargestDateTimeDurationUnit } from "./getLargestDateTimeDurationUnit";

describe("getLargestDateTimeDurationUnit", () => {
  it("should return the largest unit from the array", () => {
    expect(
      getLargestDateTimeDurationUnit(["seconds", "minutes", "hours"]),
    ).toBe("hours");
    expect(getLargestDateTimeDurationUnit(["milliseconds", "seconds"])).toBe(
      "seconds",
    );
    expect(
      getLargestDateTimeDurationUnit(["microseconds", "milliseconds"]),
    ).toBe("milliseconds");
    expect(getLargestDateTimeDurationUnit(["days", "months", "years"])).toBe(
      "years",
    );
    expect(getLargestDateTimeDurationUnit(["weeks", "days"])).toBe("weeks");
    expect(getLargestDateTimeDurationUnit(["months", "days"])).toBe("months");
  });

  it("should default to seconds if no valid unit is found", () => {
    expect(getLargestDateTimeDurationUnit([])).toBe("seconds");
  });
});
