import {
  anchorZoned,
  fromUtc,
  roundToStep,
  roundUpToStep,
  toUtc,
} from "./zone-anchor";

const MS = 1772952300000; // 2026-03-08T06:45:00Z

describe("zone-anchor", () => {
  it("writes epoch-ms as a UTC instant without fractions and reads it back", () => {
    expect(toUtc(MS)).toBe("2026-03-08T06:45:00Z");
    expect(fromUtc("2026-03-08T06:45:00Z")).toBe(MS);
  });

  it("reads an invalid instant as null", () => {
    expect(fromUtc("not an instant")).toBeNull();
  });

  it("builds the zoned anchor in UTC", () => {
    expect(anchorZoned(MS)).toBe("2026-03-08T06:45:00+00:00[UTC]");
  });

  it("rounds to the nearest step and forward to the next", () => {
    expect(roundToStep(MS + 2 * 60_000)).toBe(MS);
    expect(roundToStep(MS + 3 * 60_000)).toBe(MS + 5 * 60_000);
    expect(roundUpToStep(MS)).toBe(MS);
    expect(roundUpToStep(MS + 1)).toBe(MS + 5 * 60_000);
  });
});
