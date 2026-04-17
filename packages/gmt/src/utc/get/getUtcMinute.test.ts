import { mockTemporalNowInstantThrow } from "../../test/mocks";
import { getUtcMinute } from "./getUtcMinute";

describe("getUtcMinute", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime("2024-02-29T12:30:45.123Z");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns current minute", () => {
    expect(getUtcMinute()).toBe("30");
  });

  it("returns empty string on failure", () => {
    vi.useRealTimers();
    mockTemporalNowInstantThrow();
    const result = getUtcMinute();
    expect(result).toBe("");
  });
});
