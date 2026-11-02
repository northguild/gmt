import { hostileProxy } from "../../test/hostileValues";
import { setFakeSystemTime } from "../../test/setFakeSystemTime";
import { getUtcIn } from "../get/getUtcIn";
import { parseHttpDate } from "../parse/parseHttpDate";
import { formatHttpDate } from "./formatHttpDate";
import { formatHttpDateFromNow } from "./formatHttpDateFromNow";

// The fake clock is 2027-06-15T12:00:00Z. The polyfill adds a nanosecond tail under it, so every
// string below holds only because IMF-fixdate has no sub-second field.
const NOW = "2027-06-15T12:00:00Z";

describe("formatHttpDateFromNow", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setFakeSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Weekdays checked against Date#toUTCString, an oracle outside GMT.
  it.each`
    units           | expected
    ${{ years: 1 }} | ${"Thu, 15 Jun 2028 12:00:00 GMT"}
    ${{ days: 3 }}  | ${"Fri, 18 Jun 2027 12:00:00 GMT"}
    ${{ days: 0 }}  | ${"Tue, 15 Jun 2027 12:00:00 GMT"}
    ${{ days: -0 }} | ${"Tue, 15 Jun 2027 12:00:00 GMT"}
    ${{ hours: 1 }} | ${"Tue, 15 Jun 2027 13:00:00 GMT"}
  `("returns $expected for $units", ({ units, expected }) => {
    expect(formatHttpDateFromNow(units)).toBe(expected);
  });

  // 2027-01-31 plus a month has no 02-31: it clamps to 02-28 (TC39 constrain).
  it("clamps a missing day to the end of the month", () => {
    setFakeSystemTime("2027-01-31T12:00:00Z");
    expect(formatHttpDateFromNow({ months: 1 })).toBe(
      "Sun, 28 Feb 2027 12:00:00 GMT",
    );
  });

  // Year 10027 has no four-digit form (RFC 9110 §5.6.7 year = 4DIGIT).
  it("returns '' for a year past 9999", () => {
    expect(formatHttpDateFromNow({ years: 8000 })).toBe("");
  });

  it.each`
    units                     | label
    ${{}}                     | ${"{}"}
    ${{ fortnights: 1 }}      | ${"{ fortnights: 1 }"}
    ${"P1Y"}                  | ${"'P1Y'"}
    ${null}                   | ${"null"}
    ${undefined}              | ${"undefined"}
    ${{ days: 1.5 }}          | ${"{ days: 1.5 }"}
    ${{ days: -1 }}           | ${"{ days: -1 }"}
    ${{ years: 1, days: -1 }} | ${"{ years: 1, days: -1 }"}
    ${{ years: 300000 }}      | ${"{ years: 300000 }"}
  `("returns '' for units $label", ({ units }) => {
    expect(formatHttpDateFromNow(units)).toBe("");
  });

  it("returns '' for units that throw on any trap", () => {
    expect(formatHttpDateFromNow(hostileProxy() as never)).toBe("");
  });

  it.each`
    units
    ${{ days: 90 }}
    ${{ years: 1 }}
    ${{ months: 1, days: 3 }}
    ${{ seconds: 3600 }}
  `("equals formatHttpDate(getUtcIn($units))", ({ units }) => {
    expect(formatHttpDateFromNow(units)).toBe(formatHttpDate(getUtcIn(units)));
  });

  it.each`
    units
    ${{ days: 90 }}
    ${{ months: 1 }}
    ${{ hours: 5, minutes: 7 }}
  `("names the same second as getUtcIn($units)", ({ units }) => {
    expect(parseHttpDate(formatHttpDateFromNow(units))).toBe(getUtcIn(units));
  });
});
