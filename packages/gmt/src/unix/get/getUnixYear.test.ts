import { mockTemporalNowInstantThrow } from "../../test/mocks";
import { getUnixYear } from "./getUnixYear";

describe("getUnixYear", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime("2024-02-29T00:00:00.000Z");
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("returns current year", () => {
    expect(getUnixYear()).toBe("2024");
  });

  it("returns empty string on failure", () => {
    vi.useRealTimers();
    mockTemporalNowInstantThrow();
    const result = getUnixYear();
    expect(result).toBe("");
  });
});
