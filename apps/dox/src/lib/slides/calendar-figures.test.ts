import { describe, expect, it } from "vitest";
import { flapRows, leaf, monthGrid } from "./calendar-figures";

describe("monthGrid", () => {
  it("lays February 2027 out Monday first, starting on its Monday", () => {
    const g = monthGrid("2027-02");
    expect(g.title).toBe("February 2027");
    expect(g.month).toBe("February");
    expect(g.weekdays.map((w) => w.short)).toEqual([
      "Mon",
      "Tue",
      "Wed",
      "Thu",
      "Fri",
      "Sat",
      "Sun",
    ]);
    expect(g.weeks).toHaveLength(4);
    expect(g.weeks[0]).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(g.weeks[3]).toEqual([22, 23, 24, 25, 26, 27, 28]);
  });

  it("pads a month that starts mid-week and ends mid-week", () => {
    const g = monthGrid("2024-02");
    expect(g.weeks[0]).toEqual([null, null, null, 1, 2, 3, 4]);
    expect(g.weeks.at(-1)).toEqual([26, 27, 28, 29, null, null, null]);
  });

  it("refuses a month that is not one", () => {
    expect(() => monthGrid("2027-13")).toThrow("2027-13 is not a month");
  });
});

describe("leaf", () => {
  it("reads the month, day and weekday of a date", () => {
    expect(leaf("1844-12-30")).toEqual({
      head: "Dec 1844",
      day: "30",
      weekday: "Monday",
    });
  });
});

describe("flapRows", () => {
  it("marks only the characters that differ", () => {
    const [a, b] = flapRows("2124-03-20", "2124-03-21");
    expect(a.map((t) => t.ch).join("")).toBe("2124-03-20");
    expect(b.filter((t) => t.diff).map((t) => t.ch)).toEqual(["1"]);
    expect(a.filter((t) => t.diff).map((t) => t.ch)).toEqual(["0"]);
  });

  it("pads the shorter value on the left so the last digits line up", () => {
    const [a, b] = flapRows("1870", "3");
    expect(b.map((t) => t.ch).join("")).toBe("   3");
    expect(a.every((t) => t.diff)).toBe(true);
  });
});
