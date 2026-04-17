import { mockTemporalNowZonedDateTimeISOThrow } from "../../test/mocks";
import { getZonedMillisecond } from "./getZonedMillisecond";

describe("getZonedMillisecond", () => {
  const systemTime = "2024-02-29T00:00:00.000Z";

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(systemTime);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns current millisecond", () => {
    const result = getZonedMillisecond("UTC");
    expect(result).toBe("000");
  });

  it("returns empty string for invalid timeZone", () => {
    expect(getZonedMillisecond("invalid")).toBe("");
  });

  it("returns empty string on failure", () => {
    vi.useRealTimers();
    mockTemporalNowZonedDateTimeISOThrow();
    const result = getZonedMillisecond("America/New_York");
    expect(result).toBe("");
  });
});
