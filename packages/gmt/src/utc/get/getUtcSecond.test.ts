import { getUtcSecond } from "./getUtcSecond";

describe("getUtcSecond", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime("2024-02-29T12:30:45.123Z");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns current second", () => {
    expect(getUtcSecond()).toBe("45");
  });
});
