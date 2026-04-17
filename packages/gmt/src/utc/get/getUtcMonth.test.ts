import { mockTemporalNowInstantThrow } from "../../test/mocks";
import { getUtcMonth } from "./getUtcMonth";

describe("getUtcMonth", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime("2024-02-29T00:00:00.000Z");
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("returns current month", () => {
    expect(getUtcMonth()).toBe("02");
  });

  it("returns empty string on failure", () => {
    vi.useRealTimers();
    mockTemporalNowInstantThrow();
    const result = getUtcMonth();
    expect(result).toBe("");
  });
});
