import { mockTemporalNowInstantThrow } from "../../test/mocks";
import { getUtcDay } from "./getUtcDay";

describe("getUtcDay", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime("2024-02-29T00:00:00.000Z");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns current day", () => {
    expect(getUtcDay()).toBe("29");
  });

  it("returns empty string on failure", () => {
    vi.useRealTimers();
    mockTemporalNowInstantThrow();
    const result = getUtcDay();
    expect(result).toBe("");
  });
});
