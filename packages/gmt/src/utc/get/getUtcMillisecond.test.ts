import { mockTemporalNowInstantThrow } from "../../test/mocks";
import { getUtcMillisecond } from "./getUtcMillisecond";

describe("getUtcMillisecond", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime("2024-02-29T12:30:45.123Z");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns current millisecond", () => {
    expect(getUtcMillisecond()).toBe("123");
  });

  it("returns empty string on failure", () => {
    vi.useRealTimers();
    mockTemporalNowInstantThrow();
    const result = getUtcMillisecond();
    expect(result).toBe("");
  });
});
