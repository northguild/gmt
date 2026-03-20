import { leapSecond } from "./leap-second";

describe("leapSecond regex", () => {
  it("matches valid leap second datetimes", () => {
    expect(leapSecond.test("2024-12-31T23:59:60Z")).toBe(true);
    expect(leapSecond.test("2024-12-31T23:59:60.123Z")).toBe(true);
    expect(leapSecond.test("2024-12-31T23:59:60+00:00")).toBe(true);
    expect(leapSecond.test("2024-12-31T23:59:60.123+00:00")).toBe(true);
  });

  it("does not match non-leap second datetimes", () => {
    expect(leapSecond.test("2024-12-31T23:59:59Z")).toBe(false);
    expect(leapSecond.test("2024-12-31T23:59:61Z")).toBe(false);
    expect(leapSecond.test("2024-12-31T23:59:60")).toBe(false);
    expect(leapSecond.test("2024-12-31T23:59:60.123")).toBe(false);
  });
});
