import {
  ianaSingleComponentTimeZones,
  utcMs,
  validOnlyBattleTestTimeZones,
} from "../../test";
import { formatUtc } from "../../utc/format/formatUtc";
import { isValidTimeZone } from ".";

describe("isValidTimeZone", () => {
  it.each(
    validOnlyBattleTestTimeZones.map((timeZone) => ({
      timeZone,
      expected: true,
    })),
  )("validates $timeZone as $expected", ({ timeZone, expected }) => {
    expect(isValidTimeZone(timeZone)).toBe(expected);
  });

  // Temporal §14.6.2: every IANA Zone and Link name, including single-component ones (tzdb 2026d
  // `backward`). Each is also accepted by this runtime's Intl.DateTimeFormat.
  it.each(ianaSingleComponentTimeZones.map((timeZone) => ({ timeZone })))(
    "returns true for the single-component IANA name $timeZone",
    ({ timeZone }) => {
      expect(
        () => new Intl.DateTimeFormat("en-US", { timeZone }),
      ).not.toThrow();
      expect(isValidTimeZone(timeZone)).toBe(true);
    },
  );

  // ECMA-402 GetAvailableNamedTimeZoneIdentifier matches ASCII-case-insensitively.
  it.each`
    timeZone
    ${"utc"}
    ${"Utc"}
    ${"gmt"}
    ${"japan"}
    ${"zulu"}
    ${"america/new_york"}
  `("returns true for $timeZone in any letter case", ({ timeZone }) => {
    expect(isValidTimeZone(timeZone)).toBe(true);
  });

  it.each`
    timeZone      | reason
    ${"-foo/bar"} | ${"a leading - is outside TimeZoneIANAName"}
    ${"America"}  | ${"shape-legal, but not a zone"}
    ${"UTC+1"}    | ${"shape-legal, but not a zone"}
  `("returns false for $timeZone ($reason)", ({ timeZone }) => {
    expect(isValidTimeZone(timeZone)).toBe(false);
  });

  // Temporal's `TimeZoneIdentifier ::: UTCOffset[~SubMinutePrecision] | TimeZoneIANAName`
  // (proposal-temporal spec/abstractops.html): `±HH`, `±HHMM` or `±HH:MM`, hour 00–23, no seconds.
  // Native Temporal and Intl.DateTimeFormat (Chromium 153) accept and reject the same rows.
  it.each`
    timeZone         | expected | reason
    ${"+05:00"}      | ${true}  | ${"extended offset identifier"}
    ${"-05:00"}      | ${true}  | ${"negative offset identifier"}
    ${"+0530"}       | ${true}  | ${"basic offset identifier"}
    ${"+05"}         | ${true}  | ${"hour-only offset identifier"}
    ${"-00:00"}      | ${true}  | ${"negative zero"}
    ${"+23:59"}      | ${true}  | ${"largest offset"}
    ${"+24:00"}      | ${false} | ${"hour 24"}
    ${"+05:00:00"}   | ${false} | ${"seconds"}
    ${"+5:00"}       | ${false} | ${"one hour digit"}
    ${"05:00"}       | ${false} | ${"no sign"}
    ${"\u221205:00"} | ${false} | ${"U+2212 minus sign"}
  `(
    "returns $expected for the offset identifier $timeZone ($reason)",
    ({ timeZone, expected }) => {
      expect(isValidTimeZone(timeZone)).toBe(expected);
    },
  );

  // The silent wrong value N5 found: a rejected single-component zone made the UTC formatter fall
  // back to UTC wall time. Expected value from the runtime's own Intl, never from GMT.
  // formatUtc drops the zone name from its output, so the runtime rendering it is compared with
  // is the wall time alone: 09:00 in Tokyo (Japan links to Asia/Tokyo), not 00:00 UTC.
  it("lets formatUtc render a single-component zone in that zone, not UTC", () => {
    const instant = "2024-01-01T00:00:00Z";
    const wallTime = (timeZone: string) =>
      new Intl.DateTimeFormat("en-US", {
        timeZone,
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
      }).format(utcMs(instant));
    const actual = formatUtc(instant, "en-US", {
      timeZone: "Japan",
      timeStyle: "long",
    });
    expect(actual).toBe(wallTime("Asia/Tokyo"));
    expect(actual).not.toBe(wallTime("UTC"));
  });

  it.each`
    timeZone
    ${"Not/AZone"}
    ${""}
    ${null}
    ${undefined}
    ${123}
    ${true}
  `("returns false for invalid timeZone $timeZone", ({ timeZone }) => {
    expect(isValidTimeZone(timeZone as never)).toBe(false);
  });
});
