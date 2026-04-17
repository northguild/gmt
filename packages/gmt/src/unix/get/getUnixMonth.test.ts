import { mockTemporalNowInstantThrow } from "../../test/mocks";
import { getUnixMonth } from "./getUnixMonth";

describe("getUnixMonth", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime("2024-02-29T00:00:00.000Z");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns current month", () => {
    expect(getUnixMonth()).toBe("02");
  });

  it("returns empty string on failure", () => {
    vi.useRealTimers();
    mockTemporalNowInstantThrow();
    const result = getUnixMonth();
    expect(result).toBe("");
  });
});
