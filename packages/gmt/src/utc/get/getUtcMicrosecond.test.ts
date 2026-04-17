import { mockTemporalNowInstantThrow } from "../../test/mocks";
import { getUtcMicrosecond } from "./getUtcMicrosecond";

describe("getUtcMicrosecond", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime("2024-02-29T12:30:45.123456Z");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns current microsecond", () => {
    const result = getUtcMicrosecond();
    expect(result).toMatch(/^\d{3}$/);
  });

  it("returns empty string on failure", () => {
    vi.useRealTimers();
    mockTemporalNowInstantThrow();
    const result = getUtcMicrosecond();
    expect(result).toBe("");
  });
});
