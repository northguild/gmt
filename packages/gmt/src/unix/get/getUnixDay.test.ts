import { mockTemporalNowInstantThrow } from "../../test/mocks";
import { getUnixDay } from "./getUnixDay";

describe("getUnixDay", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime("2024-02-29T00:00:00.000Z");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns current day", () => {
    expect(getUnixDay()).toBe("29");
  });

  it("returns empty string on failure", () => {
    vi.useRealTimers();
    mockTemporalNowInstantThrow();
    const result = getUnixDay();
    expect(result).toBe("");
  });
});
