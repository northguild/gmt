/// <reference types="vitest/globals" />

import { describe, expect, it } from "vitest";
import { gmtStats } from "../data/gmt-stats";
import { formatOffset, zoneOffsetRange } from "./timezone-offset-range";

describe("zoneOffsetRange", () => {
  it("throws on an empty zone list", () => {
    expect(() => zoneOffsetRange([])).toThrow(/must not be empty/);
  });

  it("finds the widest possible offset spread across a year", () => {
    // A DST zone (Pacific/Chatham, standard +12:45 / daylight +13:45)
    // reaches further than a fixed-offset one (UTC) ever could.
    const range = zoneOffsetRange(["UTC", "Pacific/Chatham"]);
    expect(range.min).toEqual({ zoneId: "UTC", minutes: 0 });
    expect(range.max).toEqual({ zoneId: "Pacific/Chatham", minutes: 825 });
  });

  // Pacific/Apia is NOT the zone that sets the maximum: Samoa abolished DST
  // after 2021 and sits at a flat +13:00 (780) year round, so
  // Pacific/Chatham's daylight +13:45 (825) is the true published maximum.
  it("pins the published CI matrix's extremes to Niue and Chatham", () => {
    const range = zoneOffsetRange(gmtStats.timezoneList);
    expect(range.min).toEqual({ zoneId: "Pacific/Niue", minutes: -660 });
    expect(range.max).toEqual({ zoneId: "Pacific/Chatham", minutes: 825 });
  });
});

describe("formatOffset", () => {
  it("formats a whole-hour negative offset with the minus sign", () => {
    expect(formatOffset(-660)).toBe("UTC−11");
  });

  it("formats a whole-hour positive offset", () => {
    expect(formatOffset(660)).toBe("UTC+11");
  });

  it("formats zero as UTC+0", () => {
    expect(formatOffset(0)).toBe("UTC+0");
  });

  it("formats a fractional-hour offset", () => {
    expect(formatOffset(345)).toBe("UTC+5:45");
  });
});
