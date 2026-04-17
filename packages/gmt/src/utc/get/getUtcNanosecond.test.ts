import { mockTemporalNowInstantThrow } from "../../test/mocks";
import { getUtcNanosecond } from "./getUtcNanosecond";

describe("getUtcNanosecond", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime("2024-02-29T12:30:45.123456789Z");
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("returns current nanosecond", () => {
    const result = getUtcNanosecond();
    expect(result).toMatch(/^\d{3}$/);
  });

  it("returns empty string on failure", () => {
    vi.useRealTimers();
    mockTemporalNowInstantThrow();
    const result = getUtcNanosecond();
    expect(result).toBe("");
  });
});
