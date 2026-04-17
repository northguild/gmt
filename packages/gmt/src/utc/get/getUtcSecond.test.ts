import { mockTemporalNowInstantThrow } from "../../test/mocks";
import { getUtcSecond } from "./getUtcSecond";

describe("getUtcSecond", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime("2024-02-29T12:30:45.123Z");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns current second", () => {
    expect(getUtcSecond()).toBe("45");
  });

  it("returns empty string on failure", () => {
    vi.useRealTimers();
    mockTemporalNowInstantThrow();
    const result = getUtcSecond();
    expect(result).toBe("");
  });
});
