/**
 * `exactOffsetText` against the real library: every string it writes must read
 * back, through gmt's instant reader, as the instant it was given.
 */
import { Temporal } from "@js-temporal/polyfill";
import { toOffsetInstant } from "@northguild/gmt/instant/convert";
import { describe, expect, it } from "vitest";
import { exactOffsetText } from "./exact-offset";

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
