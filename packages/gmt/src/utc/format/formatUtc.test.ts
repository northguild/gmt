import { MustTestLocales } from "../../test";
import * as getSystemTimeZoneModule from "../../zoned/get/getSystemTimeZone";
import { formatUtc } from "./formatUtc";

describe("formatUtc", () => {
  // keep focused en-US behavior tests
  it.each`
    value                     | options                                         | expected
    ${"2024-02-03T14:30:45Z"} | ${{ dateStyle: "full", timeStyle: "full" }}     | ${"Saturday, February 3, 2024 at 2:30:45 PM"}
    ${"2024-02-03T14:30:45Z"} | ${{ dateStyle: "long", timeStyle: "long" }}     | ${"February 3, 2024 at 2:30:45 PM"}
    ${"2024-02-03T14:30:45Z"} | ${{ dateStyle: "medium", timeStyle: "medium" }} | ${"Feb 3, 2024, 2:30:45 PM"}
    ${"2024-02-03T14:30:45Z"} | ${{ dateStyle: "short", timeStyle: "short" }}   | ${"2/3/24, 2:30 PM"}
  `(
    "formats valid utc $value for en-US with options $options to $expected",
    ({ value, options, expected }) => {
      expect(formatUtc(value, MustTestLocales.enUS, options)).toEqual(expected);
    },
  );

  // timezone conversion checks (use en-US for stability)
  it("formats instant in UTC by default when timeZone is undefined", () => {
    expect(
      formatUtc("2024-02-03T14:30:45Z", MustTestLocales.enUS, {
        dateStyle: "long",
        timeStyle: "long",
      }),
    ).toEqual("February 3, 2024 at 2:30:45 PM");
  });

  it("converts instant to explicit timezone (Europe/Paris)", () => {
    expect(
      formatUtc("2024-02-03T14:30:45Z", MustTestLocales.enUS, {
        dateStyle: "long",
        timeStyle: "long",
        timeZone: "Europe/Paris",
      }),
    ).toEqual("February 3, 2024 at 3:30:45 PM");
  });

  it("uses getSystemTimeZone() when timeZone is 'local'", () => {
    const spy = vi
      .spyOn(getSystemTimeZoneModule, "getSystemTimeZone")
      .mockReturnValue("Europe/Paris");

    expect(
      formatUtc("2024-02-03T14:30:45Z", MustTestLocales.enUS, {
        dateStyle: "long",
        timeStyle: "long",
        timeZone: "local",
      }),
    ).toEqual("February 3, 2024 at 3:30:45 PM");

    spy.mockRestore();
  });

  // ECMA-402 and Temporal throw RangeError for an unknown zone, so a typo is the sentinel, never UTC.
  it.each`
    timeZone
    ${"Invalid/Zone"}
    ${"Europe/Londn"}
    ${""}
    ${null}
  `("returns '' for invalid timeZone $timeZone", ({ timeZone }) => {
    expect(
      formatUtc("2024-02-03T14:30:45Z", MustTestLocales.enUS, {
        dateStyle: "long",
        timeStyle: "long",
        timeZone,
      }),
    ).toEqual("");
  });

  it("formats in UTC when timeZone is omitted", () => {
    expect(
      formatUtc("2024-02-03T14:30:45Z", MustTestLocales.enUS, {
        dateStyle: "long",
        timeStyle: "long",
      }),
    ).toEqual("February 3, 2024 at 2:30:45 PM");
  });

  it("does not include localized timezone name by default (ru-RU)", () => {
    const out = formatUtc("2024-02-03T14:30:45Z", "ru-RU", {
      dateStyle: "full",
      timeStyle: "full",
    });
    expect(out).toEqual("суббота, 3 февраля 2024 г. в 14:30:45");
  });

  it("includes localized timezone name when includeTimeZoneName is true (ru-RU)", () => {
    const out = formatUtc("2024-02-03T14:30:45Z", "ru-RU", {
      dateStyle: "full",
      timeStyle: "full",
      includeTimeZoneName: true,
    });
    expect(out).toContain("Всемирное координированное время");
  });

  it.each`
    invalidValue
    ${"not-a-datetime"}
    ${"2024-02-29"}
    ${"2024-02-29Z"}
    ${"2024-02-29T00:00:00"}
    ${"2024-02-29T24:00:00"}
    ${"2024-02-29T24:00:00Z"}
    ${""}
    ${null}
    ${undefined}
    ${true}
  `(
    "returns an empty string for invalid datetime $invalidValue",
    ({ invalidValue }) => {
      expect(formatUtc(invalidValue as never)).toBe("");
    },
  );

  // The plain path formats the wall clock as a PlainDateTime (GetDateTimeFormat
  // ~any~, ~all~, ~relevant~); includeTimeZoneName formats it as a
  // ZonedDateTime (~any~, ~zoned-date-time~, ~all~). Requested widths are kept,
  // `era` alone gets the defaults, and `timeZoneName` on the plain path is not
  // inherited. Expected values: native Intl.DateTimeFormat with the adjusted
  // options.
  it.each`
    locale                   | options                                                                                        | expected                                  | reason
    ${"ja-JP-u-ca-japanese"} | ${{ year: "numeric", month: "long" }}                                                          | ${"令和6年2月"}                           | ${"requested long month kept"}
    ${"ja-JP-u-ca-japanese"} | ${{ year: "numeric", month: "long", timeZone: "America/New_York", includeTimeZoneName: true }} | ${"令和6年2月"}                           | ${"requested long month kept, zoned path"}
    ${"en-US"}               | ${{ dateStyle: "short", timeStyle: "full" }}                                                   | ${"2/3/24, 2:30:45 PM"}                   | ${"short date width kept, zone field removed"}
    ${"en-US"}               | ${{ era: "long" }}                                                                             | ${"2/3/2024 Anno Domini, 2:30:45 PM"}     | ${"era alone gets the date and time defaults"}
    ${"en-US"}               | ${{ era: "long", includeTimeZoneName: true }}                                                  | ${"2/3/2024 Anno Domini, 2:30:45 PM UTC"} | ${"era alone gets the zoned defaults"}
    ${"en-US"}               | ${{ timeZoneName: "short" }}                                                                   | ${"2/3/2024, 2:30:45 PM"}                 | ${"timeZoneName is not inherited on the plain path"}
  `(
    "formats 2024-02-03T14:30:45Z in $locale with $options to $expected ($reason)",
    ({ locale, options, expected }) => {
      expect(formatUtc("2024-02-03T14:30:45Z", locale, options)).toBe(expected);
    },
  );
});

// ECMA-402 CoerceOptionsToObject throws TypeError for null options (`new Intl.DateTimeFormat("en",
// null)`), so null is invalid input; undefined is the defaults.
describe("formatUtc with null options", () => {
  it("returns an empty string for 2024-02-03T14:30:45Z with options null", () => {
    expect(
      formatUtc("2024-02-03T14:30:45Z", MustTestLocales.enUS, null as never),
    ).toBe("");
  });
});

// ECMA-402 CanonicalizeLocaleList: `locale` may be a preference list; the first tag with locale data
// is used, and a malformed tag anywhere in the list is invalid input. Expected strings from native
// Intl with the same list (Chromium 153).
describe("formatUtc with a locale list", () => {
  it.each`
    locale                                          | expected
    ${[MustTestLocales.frFR, MustTestLocales.enUS]} | ${"3 février 2024"}
    ${[MustTestLocales.frFR, "not a locale!!"]}     | ${""}
  `("returns $expected for locale list $locale", ({ locale, expected }) => {
    expect(
      formatUtc("2024-02-03T14:30:45Z", locale as string[], {
        dateStyle: "long",
      }),
    ).toBe(expected);
  });
});
