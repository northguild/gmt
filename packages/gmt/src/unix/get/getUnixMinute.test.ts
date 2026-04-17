import { mockTemporalNowInstantThrow } from "../../test/mocks";
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

  it("returns empty string on failure", () => {
    vi.useRealTimers();
    mockTemporalNowInstantThrow();
    const result = getUnixMinute();
    expect(result).toBe("");
  });
});
