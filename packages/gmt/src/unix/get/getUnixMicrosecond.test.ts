import { mockTemporalNowInstantThrow } from "../../test/mocks";
import { getUnixMicrosecond } from "./getUnixMicrosecond";

describe("getUnixMicrosecond", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime("2024-02-29T12:30:45.123456Z");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns current microsecond", () => {
    const result = getUnixMicrosecond();
    expect(result).toMatch(/^\d{3}$/);
  });

  it("returns empty string on failure", () => {
    vi.useRealTimers();
    mockTemporalNowInstantThrow();
    const result = getUnixMicrosecond();
    expect(result).toBe("");
  });
});
