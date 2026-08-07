import { isValidTimeZone } from "../validate";
import { getTimeZones } from "./getTimeZones";

describe("getTimeZones", () => {
  it("returns an array of strings", () => {
    const timeZones = getTimeZones();
    expect(Array.isArray(timeZones)).toBe(true);
    expect(timeZones.length).toBeGreaterThan(0);
    expect(typeof timeZones[0]).toBe("string");
  });

  it("all returned timezones are valid", () => {
    const timeZones = getTimeZones();
    const invalid = timeZones.filter((tz) => !isValidTimeZone(tz));
    expect(invalid).toHaveLength(0);
  });

  it("returns an empty array when Intl.supportedValuesOf throws", () => {
    const supportedValuesOfSpy = vi
      .spyOn(Intl, "supportedValuesOf")
      .mockImplementation(() => {
        throw new Error("Not supported");
      });

    try {
      const timeZones = getTimeZones();
      expect(timeZones).toEqual([]);
    } finally {
      supportedValuesOfSpy.mockRestore();
    }
  });

  it("returns an empty array when Intl.supportedValuesOf returns null", () => {
    const supportedValuesOfSpy = vi
      .spyOn(Intl, "supportedValuesOf")
      // @ts-expect-error — forcing null for error-path test
      .mockReturnValue(null);

    try {
      const timeZones = getTimeZones();
      expect(timeZones).toEqual([]);
    } finally {
      supportedValuesOfSpy.mockRestore();
    }
  });
});
