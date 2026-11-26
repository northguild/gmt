/**
 * `exactOffsetText` against the real library: every string it writes must read
 * back, through gmt's instant reader, as the instant it was given.
 */
import { Temporal } from "@northguild/gmt";
import { toOffsetInstant } from "@northguild/gmt/instant/convert";
import {
  exactOffsetText,
  instantAtOffset,
  offsetMinutes,
  offsetNanoseconds,
  offsetShift,
  OFFSET_SOURCE,
  wallReader,
} from "./exact-offset";

const readBack = (text: string) => toOffsetInstant(text)?.instant;

describe("exactOffsetText", () => {
  it.each([
    // Monrovia kept -00:44:30 until 1972; Temporal's own toString writes -00:45.
    ["1960-06-01T12:00:00Z", "Africa/Monrovia", "1960-06-01T11:15:30-00:44:30"],
    // New York local mean time before 18 November 1883.
    [
      "1880-01-01T16:56:02Z",
      "America/New_York",
      "1880-01-01T12:00:00-04:56:02",
    ],
    ["2024-06-15T12:00:00Z", "Europe/London", "2024-06-15T13:00:00+01:00"],
    [
      "2024-06-15T12:00:00.25Z",
      "Europe/London",
      "2024-06-15T13:00:00.25+01:00",
    ],
    ["2024-06-15T12:00:00Z", "UTC", "2024-06-15T12:00:00+00:00"],
  ])("writes %s in %s as %s, which reads back", (utc, zone, expected) => {
    const text = exactOffsetText(Temporal.Instant.from(utc), zone);
    expect(text).toBe(expected);
    expect(readBack(text)).toBe(utc);
  });

  it("throws on an unknown zone", () => {
    expect(() =>
      exactOffsetText(
        Temporal.Instant.from("2024-06-15T12:00:00Z"),
        "Not/AZone",
      ),
    ).toThrow(RangeError);
  });
});

describe("offsetNanoseconds and offsetMinutes", () => {
  it.each([
    ["+00:00", 0, 0],
    ["-04:00", -14_400e9, -240],
    ["+05:45", 20_700e9, 345],
    ["-00:44:30", -2_670e9, -44.5],
    ["-04:56:02", -17_762e9, -296 - 2 / 60],
    ["+05:30:15.25", 19_815.25e9, 330 + 15.25 / 60],
  ])("reads %s", (offset, ns, minutes) => {
    expect(offsetNanoseconds(offset)).toBe(ns);
    expect(offsetMinutes(offset)).toBeCloseTo(minutes, 12);
  });

  it.each(["Z", "", "+0530", "-4:00", "+05:30[UTC]", " +05:30"])(
    "refuses %j",
    (offset) => {
      expect(offsetNanoseconds(offset)).toBeNull();
      expect(offsetMinutes(offset)).toBeNull();
    },
  );

  it("OFFSET_SOURCE matches every offset the zone reports", () => {
    const re = new RegExp(`^${OFFSET_SOURCE}$`);
    for (const offset of ["+01:00", "-00:44:30", "-04:56:02", "+05:30:15.25"])
      expect(re.test(offset)).toBe(true);
  });
});

describe("offsetShift", () => {
  it.each([
    ["-05:00", "-04:00", "PT1H"],
    ["+01:00", "+00:00", "-PT1H"],
    // New York's 1883 change from local mean time to Eastern standard time.
    ["-04:56:02", "-05:00", "-PT3M58S"],
    // Monrovia's 1972 change to UTC.
    ["-00:44:30", "+00:00", "PT44M30S"],
  ])("from %s to %s is %s", (before, after, expected) => {
    expect(offsetShift(before, after)?.toString()).toBe(expected);
  });

  it("is null for a non-offset", () => {
    expect(offsetShift("Z", "+01:00")).toBeNull();
  });
});

describe("instantAtOffset", () => {
  it.each([
    ["1960-06-01T12:00:00Z", "-00:44:30", "1960-06-01T11:15:30-00:44:30"],
    ["1880-01-01T16:56:02Z", "-04:56:02", "1880-01-01T12:00:00-04:56:02"],
    ["2024-06-15T12:00:00Z", "+05:45", "2024-06-15T17:45:00+05:45"],
    ["2024-06-15T00:10:00Z", "-04:00", "2024-06-14T20:10:00-04:00"],
  ])("writes %s at %s as %s, which reads back", (utc, offset, expected) => {
    const text = instantAtOffset(Temporal.Instant.from(utc), offset);
    expect(text).toBe(expected);
    expect(readBack(text ?? "")).toBe(utc);
  });

  it("is null for a non-offset", () => {
    expect(
      instantAtOffset(Temporal.Instant.from("2024-06-15T12:00:00Z"), "Z"),
    ).toBeNull();
  });
});

describe("wallReader", () => {
  const at = (iso: string) => Temporal.Instant.from(iso).epochMilliseconds;

  it.each([
    ["Africa/Monrovia", "1960-06-01T12:00:00Z", "11:15:30"],
    ["-00:44:30", "1960-06-01T12:00:00Z", "11:15:30"],
    ["-04:56:02", "1880-01-01T16:56:02Z", "12:00:00"],
    ["+05:45", "2024-06-15T12:00:00Z", "17:45:00"],
  ])("reads the wall clock in %s and maps it back", (zone, utc, wall) => {
    const read = wallReader(zone);
    const z = read(at(utc));
    expect(z.toPlainTime().toString()).toBe(wall);
    expect(read.msOf(z)).toBe(at(utc));
  });
});
