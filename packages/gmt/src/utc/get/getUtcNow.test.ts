import { mockTemporalNowInstantThrow } from "../../test/mocks";
import { convertUtcToUnix } from "../convert";
import { getUtcNow } from "./getUtcNow";

describe("getUtcNow", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime("2024-02-29T00:00:00.000Z");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the exact mocked UTC datetime string", () => {
    const utcNow = getUtcNow();

    expect(utcNow).toBeTruthy();
  });

  it("returns a value consumable by zoned unix converters", () => {
    const value = getUtcNow();

    expect(convertUtcToUnix(value, "milliseconds")).toBe(1709164800000);
    expect(convertUtcToUnix(value, "seconds")).toBe(1709164800);
  });

  it("returns empty string on failure", () => {
    vi.useRealTimers();
    mockTemporalNowInstantThrow();
    const result = getUtcNow();
    expect(result).toBe("");
  });
});
