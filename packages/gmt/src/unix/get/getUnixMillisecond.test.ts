import { getUnixMillisecond } from "./getUnixMillisecond";

describe("getUnixMillisecond", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime("2024-02-29T12:30:45.123Z");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns current millisecond", () => {
    expect(getUnixMillisecond()).toBe("123");
  });
});
