import { battleTestTimeZones, mockSystemTimeZone } from "../test";
import { normalizeTimeZone } from "./normalizeTimeZone";

describe("normalizeTimeZone", () => {
  // Omitted → UTC (the unix/ and utc/ default); "local" → the system zone.
  it("returns UTC for an omitted zone whatever the system zone is", () => {
    const restore = mockSystemTimeZone("Asia/Tokyo");
    expect(normalizeTimeZone(undefined)).toBe("UTC");
    restore();
  });

  it.each`
    systemTimeZone
    ${"Asia/Tokyo"}
    ${"America/New_York"}
  `(
    "returns the system zone $systemTimeZone for local",
    ({ systemTimeZone }) => {
      const restore = mockSystemTimeZone(systemTimeZone);
      expect(normalizeTimeZone("local")).toBe(systemTimeZone);
      restore();
    },
  );

  it("returns empty string for local when the system zone is not valid", () => {
    const restore = mockSystemTimeZone("not-a-timezone");
    expect(normalizeTimeZone("local")).toBe("");
    restore();
  });

  // ECMA-402 CreateDateTimeFormat / Temporal ToTemporalTimeZoneIdentifier throw RangeError for an
  // unknown zone, so a typo is the sentinel, never a silent UTC.
  it.each`
    input                 | reason
    ${""}                 | ${"empty string"}
    ${"   "}              | ${"whitespace"}
    ${"Invalid/Timezone"} | ${"unknown IANA name"}
    ${"America/New_Yrok"} | ${"typo"}
    ${"null"}             | ${"the string null"}
    ${"123"}              | ${"digits"}
    ${"America"}          | ${"area only"}
    ${"America/New/York"} | ${"extra segment"}
    ${"America/New@York"} | ${"illegal character"}
    ${"UTC+5"}            | ${"POSIX-style offset"}
    ${null}               | ${"null is not omitted"}
    ${5}                  | ${"a number"}
  `("returns empty string for $input ($reason)", ({ input }) => {
    expect(normalizeTimeZone(input as never)).toBe("");
  });

  it.each(battleTestTimeZones.map((timeZone) => ({ timeZone })))(
    "returns valid zone $timeZone unchanged",
    ({ timeZone }) => {
      expect(normalizeTimeZone(timeZone)).toBe(timeZone);
    },
  );

  it.each`
    input                 | expected
    ${"GMT"}              | ${"GMT"}
    ${"Etc/GMT+0"}        | ${"Etc/GMT+0"}
    ${"america/new_york"} | ${"america/new_york"}
  `(
    "returns $expected for accepted identifier $input",
    ({ input, expected }) => {
      expect(normalizeTimeZone(input)).toBe(expected);
    },
  );

  // Temporal's `TimeZoneIdentifier ::: UTCOffset[~SubMinutePrecision] | TimeZoneIANAName`
  // (proposal-temporal spec/abstractops.html): `±HH`, `±HHMM` or `±HH:MM`, hour 00–23, no seconds.
  // Native Temporal and Intl.DateTimeFormat (Chromium 153) accept and reject the same rows.
  it.each`
    input       | expected
    ${"+05:00"} | ${"+05:00"}
    ${"-0800"}  | ${"-0800"}
    ${"+24:00"} | ${""}
  `(
    "returns $expected for the offset identifier $input",
    ({ input, expected }) => {
      expect(normalizeTimeZone(input)).toBe(expected);
    },
  );
});
