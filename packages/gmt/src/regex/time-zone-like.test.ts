import { ianaSingleComponentTimeZones } from "../test";
import { timeZoneLike } from "./time-zone-like";

describe("regex/timeZoneLike", () => {
  it.each`
    value                 | expected
    ${"UTC"}              | ${true}
    ${"GMT"}              | ${true}
    ${"America/New_York"} | ${true}
    ${"Europe/London"}    | ${true}
    ${"Asia/Kathmandu"}   | ${true}
    ${"Not/AZone"}        | ${true}
    ${""}                 | ${false}
  `("timeZone pattern matches $value as $expected", ({ value, expected }) => {
    expect(timeZoneLike.test(value)).toBe(expected);
  });

  // Temporal §14.6.2 TimeZoneIANAName: one or more `/`-separated components, each a
  // TZLeadingChar (Alpha . _) followed by TZChars (TZLeadingChar, DecimalDigit, - +).
  it.each(ianaSingleComponentTimeZones.map((value) => ({ value })))(
    "matches the single-component IANA name $value",
    ({ value }) => {
      expect(timeZoneLike.test(value)).toBe(true);
    },
  );

  it.each`
    value                               | reason
    ${"utc"}                            | ${"lower case (identifiers are ASCII-case-insensitive)"}
    ${"america/new_york"}               | ${"lower case, two components"}
    ${"Etc/GMT+5"}                      | ${"+ and a digit after the leading character"}
    ${"America/Argentina/Buenos_Aires"} | ${"three components"}
    ${"UTC+1"}                          | ${"shape-legal name that is not a zone (Temporal decides existence)"}
    ${"America"}                        | ${"shape-legal single component that is not a zone"}
    ${"_x/.y"}                          | ${"_ and . are leading characters"}
  `("matches $value ($reason)", ({ value }) => {
    expect(timeZoneLike.test(value)).toBe(true);
  });

  it.each`
    value                  | reason
    ${"-foo/bar"}          | ${"leading - (not a TZLeadingChar)"}
    ${"+Japan"}            | ${"leading +"}
    ${"America/-New_York"} | ${"component with a leading -"}
    ${"UTC+05:00"}         | ${"colon is not a TZChar"}
    ${"5Zone"}             | ${"leading digit"}
    ${"America/"}          | ${"empty trailing component"}
    ${"/America"}          | ${"empty leading component"}
    ${"America//New_York"} | ${"empty middle component"}
    ${"America/New York"}  | ${"space is not a TZChar"}
  `("does not match $value ($reason)", ({ value }) => {
    expect(timeZoneLike.test(value)).toBe(false);
  });

  // Temporal's `TimeZoneIdentifier ::: UTCOffset[~SubMinutePrecision] | TimeZoneIANAName`
  // (proposal-temporal spec/abstractops.html): `±HH`, `±HHMM` or `±HH:MM`, hour 00–23, no seconds.
  // Native Temporal and Intl.DateTimeFormat (Chromium 153) accept and reject the same rows.
  it.each`
    value            | expected | reason
    ${"+05:00"}      | ${true}  | ${"extended offset"}
    ${"-08:00"}      | ${true}  | ${"negative extended offset"}
    ${"+0530"}       | ${true}  | ${"basic offset"}
    ${"-08"}         | ${true}  | ${"hour-only offset"}
    ${"-00:00"}      | ${true}  | ${"negative zero"}
    ${"+23:59"}      | ${true}  | ${"largest offset"}
    ${"+24:00"}      | ${false} | ${"hour 24"}
    ${"+05:60"}      | ${false} | ${"minute 60"}
    ${"+05:00:00"}   | ${false} | ${"seconds (SubMinutePrecision is off)"}
    ${"+05:0"}       | ${false} | ${"one minute digit"}
    ${"+5:00"}       | ${false} | ${"one hour digit"}
    ${"05:00"}       | ${false} | ${"no sign"}
    ${"\u221205:00"} | ${false} | ${"U+2212 minus sign (not ASCIISign)"}
    ${"+05:"}        | ${false} | ${"separator with no minutes"}
  `(
    "matches the offset identifier $value as $expected ($reason)",
    ({ value, expected }) => {
      expect(timeZoneLike.test(value)).toBe(expected);
    },
  );
});
