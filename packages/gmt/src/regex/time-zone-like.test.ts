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
    ${"+05:00"}            | ${"an offset identifier is a separate grammar (UTCOffset)"}
    ${"UTC+05:00"}         | ${"colon is not a TZChar"}
    ${"5Zone"}             | ${"leading digit"}
    ${"America/"}          | ${"empty trailing component"}
    ${"/America"}          | ${"empty leading component"}
    ${"America//New_York"} | ${"empty middle component"}
    ${"America/New York"}  | ${"space is not a TZChar"}
  `("does not match $value ($reason)", ({ value }) => {
    expect(timeZoneLike.test(value)).toBe(false);
  });
});
