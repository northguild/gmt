import { getUnixMinute } from "./getUnixMinute";

describe("getUnixMinute", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime("2024-02-29T12:30:45.123Z");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns current minute", () => {
    expect(getUnixMinute()).toBe("30");
  });
});
