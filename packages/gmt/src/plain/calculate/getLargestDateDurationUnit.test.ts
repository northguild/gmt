import { getLargestDateDurationUnit } from "./getLargestDateDurationUnit";

describe("getLargestDateDurationUnit", () => {
  it("should return the largest unit from the array", () => {
    expect(getLargestDateDurationUnit(["days", "months", "years"])).toBe(
      "years",
    );
    expect(getLargestDateDurationUnit(["weeks", "days"])).toBe("weeks");
    expect(getLargestDateDurationUnit(["months", "days"])).toBe("months");
  });

  it("should default to days if no valid unit is found", () => {
    expect(getLargestDateDurationUnit([])).toBe("days");
  });
});
