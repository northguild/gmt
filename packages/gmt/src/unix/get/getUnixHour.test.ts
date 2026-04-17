import { mockTemporalNowInstantThrow } from "../../test/mocks";
import { getUnixHour } from "./getUnixHour";

describe("getUnixHour", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime("2024-02-29T12:30:45.123Z");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns current hour", () => {
    expect(getUnixHour()).toBe("12");
  });

  it("returns empty string on failure", () => {
    vi.useRealTimers();
    mockTemporalNowInstantThrow();
    const result = getUnixHour();
    expect(result).toBe("");
  });
});
