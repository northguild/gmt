import { getUnixHour } from "./getUnixHour";

describe("getUnixHour", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime("2024-02-29T12:30:45.123Z");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns current hour", () => {
    expect(getUnixHour()).toBe("12");
  });
});
