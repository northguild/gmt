import { getUtcMonth } from "./getUtcMonth";

describe("getUtcMonth", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime("2024-02-29T00:00:00.000Z");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns current month", () => {
    expect(getUtcMonth()).toBe("02");
  });
});
