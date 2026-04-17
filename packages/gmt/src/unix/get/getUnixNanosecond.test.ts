import { mockTemporalNowInstantThrow } from "../../test/mocks";
import { getUnixNanosecond } from "./getUnixNanosecond";

describe("getUnixNanosecond", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime("2024-02-29T12:30:45.123456789Z");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns current nanosecond", () => {
    const result = getUnixNanosecond();
    expect(result).toMatch(/^\d{3}$/);
  });

  it("returns empty string on failure", () => {
    vi.useRealTimers();
    mockTemporalNowInstantThrow();
    const result = getUnixNanosecond();
    expect(result).toBe("");
  });
});
