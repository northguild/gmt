import { Temporal } from "@js-temporal/polyfill";
import { CONVERTER_LOCALES, CURATED_TIMEZONES } from "./curated-timezones";

/** One northern-winter instant: the three southern zones read one hour above
 * their standard offset, which does not change the order. */
const WINTER_INSTANT = Temporal.Instant.from("2024-01-15T12:00:00Z");

function offsetMinutes(zone: string): number {
  return (
    WINTER_INSTANT.toZonedDateTimeISO(zone).offsetNanoseconds / 60_000_000_000
  );
}

describe("CURATED_TIMEZONES", () => {
  it("runs west to east by UTC offset on a winter instant", () => {
    const offsets = CURATED_TIMEZONES.map(offsetMinutes);
    expect(offsets).toEqual([...offsets].sort((a, b) => a - b));
  });

  it("puts UTC at its own offset, between the Americas and Europe", () => {
    const utc = CURATED_TIMEZONES.indexOf("UTC");
    expect(offsetMinutes("UTC")).toBe(0);
    expect(offsetMinutes(CURATED_TIMEZONES[utc - 1])).toBeLessThan(0);
    expect(offsetMinutes(CURATED_TIMEZONES[utc + 1])).toBe(0);
  });

  it("lists each zone once", () => {
    expect(new Set(CURATED_TIMEZONES).size).toBe(CURATED_TIMEZONES.length);
  });
});

describe("CONVERTER_LOCALES", () => {
  it("offers the regionless English the converter bench opens on", () => {
    expect(CONVERTER_LOCALES).toContain("en");
  });
});
