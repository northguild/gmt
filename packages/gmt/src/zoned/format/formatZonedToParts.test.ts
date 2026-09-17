import {
  expectDateTimeEqual,
  localeZonedDateTimeInputByLocale,
  MustTestLocales,
} from "../../test";
import { formatZonedToParts } from "./formatZonedToParts";

const OPTIONS = { dateStyle: "medium", timeStyle: "short" } as const;

describe("formatZonedToParts", () => {
  const valueByLocale = localeZonedDateTimeInputByLocale;

  describe("17-locale matrix — dateStyle/timeStyle", () => {
    it.each`
      locale                  | expected
      ${MustTestLocales.enUS} | ${[{ type: "month", value: "Feb" }, { type: "literal", value: " " }, { type: "day", value: "3" }, { type: "literal", value: ", " }, { type: "year", value: "2024" }, { type: "literal", value: ", " }, { type: "hour", value: "2" }, { type: "literal", value: ":" }, { type: "minute", value: "30" }, { type: "literal", value: " " }, { type: "dayPeriod", value: "PM" }]}
      ${MustTestLocales.enGB} | ${[{ type: "day", value: "3" }, { type: "literal", value: " " }, { type: "month", value: "Feb" }, { type: "literal", value: " " }, { type: "year", value: "2024" }, { type: "literal", value: ", " }, { type: "hour", value: "14" }, { type: "literal", value: ":" }, { type: "minute", value: "30" }]}
      ${MustTestLocales.deDE} | ${[{ type: "day", value: "03" }, { type: "literal", value: "." }, { type: "month", value: "02" }, { type: "literal", value: "." }, { type: "year", value: "2024" }, { type: "literal", value: ", " }, { type: "hour", value: "14" }, { type: "literal", value: ":" }, { type: "minute", value: "30" }]}
      ${MustTestLocales.frFR} | ${[{ type: "day", value: "3" }, { type: "literal", value: " " }, { type: "month", value: "févr." }, { type: "literal", value: " " }, { type: "year", value: "2024" }, { type: "literal", value: ", " }, { type: "hour", value: "14" }, { type: "literal", value: ":" }, { type: "minute", value: "30" }]}
      ${MustTestLocales.esES} | ${[{ type: "day", value: "3" }, { type: "literal", value: " " }, { type: "month", value: "feb" }, { type: "literal", value: " " }, { type: "year", value: "2024" }, { type: "literal", value: ", " }, { type: "hour", value: "14" }, { type: "literal", value: ":" }, { type: "minute", value: "30" }]}
      ${MustTestLocales.itIT} | ${[{ type: "day", value: "3" }, { type: "literal", value: " " }, { type: "month", value: "feb" }, { type: "literal", value: " " }, { type: "year", value: "2024" }, { type: "literal", value: ", " }, { type: "hour", value: "14" }, { type: "literal", value: ":" }, { type: "minute", value: "30" }]}
      ${MustTestLocales.ptPT} | ${[{ type: "day", value: "03" }, { type: "literal", value: "/" }, { type: "month", value: "02" }, { type: "literal", value: "/" }, { type: "year", value: "2024" }, { type: "literal", value: ", " }, { type: "hour", value: "14" }, { type: "literal", value: ":" }, { type: "minute", value: "30" }]}
      ${MustTestLocales.svSE} | ${[{ type: "day", value: "3" }, { type: "literal", value: " " }, { type: "month", value: "feb." }, { type: "literal", value: " " }, { type: "year", value: "2024" }, { type: "literal", value: " " }, { type: "hour", value: "14" }, { type: "literal", value: ":" }, { type: "minute", value: "30" }]}
      ${MustTestLocales.isIS} | ${[{ type: "day", value: "3" }, { type: "literal", value: ". " }, { type: "month", value: "feb." }, { type: "literal", value: " " }, { type: "year", value: "2024" }, { type: "literal", value: ", " }, { type: "hour", value: "14" }, { type: "literal", value: ":" }, { type: "minute", value: "30" }]}
      ${MustTestLocales.zhCN} | ${[{ type: "year", value: "2024" }, { type: "literal", value: "年" }, { type: "month", value: "2" }, { type: "literal", value: "月" }, { type: "day", value: "3" }, { type: "literal", value: "日 " }, { type: "hour", value: "14" }, { type: "literal", value: ":" }, { type: "minute", value: "30" }]}
      ${MustTestLocales.zhTW} | ${[{ type: "year", value: "2024" }, { type: "literal", value: "年" }, { type: "month", value: "2" }, { type: "literal", value: "月" }, { type: "day", value: "3" }, { type: "literal", value: "日 " }, { type: "dayPeriod", value: "下午" }, { type: "hour", value: "2" }, { type: "literal", value: ":" }, { type: "minute", value: "30" }]}
      ${MustTestLocales.jaJP} | ${[{ type: "year", value: "2024" }, { type: "literal", value: "/" }, { type: "month", value: "02" }, { type: "literal", value: "/" }, { type: "day", value: "03" }, { type: "literal", value: " " }, { type: "hour", value: "14" }, { type: "literal", value: ":" }, { type: "minute", value: "30" }]}
      ${MustTestLocales.koKR} | ${[{ type: "year", value: "2024" }, { type: "literal", value: ". " }, { type: "month", value: "2" }, { type: "literal", value: ". " }, { type: "day", value: "3" }, { type: "literal", value: ". " }, { type: "dayPeriod", value: "오후" }, { type: "literal", value: " " }, { type: "hour", value: "2" }, { type: "literal", value: ":" }, { type: "minute", value: "30" }]}
      ${MustTestLocales.arSA} | ${[{ type: "day", value: "٠٣" }, { type: "literal", value: "‏/" }, { type: "month", value: "٠٢" }, { type: "literal", value: "‏/" }, { type: "year", value: "٢٠٢٤" }, { type: "literal", value: "، " }, { type: "hour", value: "٢" }, { type: "literal", value: ":" }, { type: "minute", value: "٣٠" }, { type: "literal", value: " " }, { type: "dayPeriod", value: "م" }]}
      ${MustTestLocales.heIL} | ${[{ type: "day", value: "3" }, { type: "literal", value: " ב" }, { type: "month", value: "פבר׳" }, { type: "literal", value: " " }, { type: "year", value: "2024" }, { type: "literal", value: ", " }, { type: "hour", value: "14" }, { type: "literal", value: ":" }, { type: "minute", value: "30" }]}
      ${MustTestLocales.ruRU} | ${[{ type: "day", value: "3" }, { type: "literal", value: " " }, { type: "month", value: "февр." }, { type: "literal", value: " " }, { type: "year", value: "2024" }, { type: "literal", value: " г., " }, { type: "hour", value: "14" }, { type: "literal", value: ":" }, { type: "minute", value: "30" }]}
      ${MustTestLocales.trTR} | ${[{ type: "day", value: "3" }, { type: "literal", value: " " }, { type: "month", value: "Şub" }, { type: "literal", value: " " }, { type: "year", value: "2024" }, { type: "literal", value: " " }, { type: "hour", value: "14" }, { type: "literal", value: ":" }, { type: "minute", value: "30" }]}
    `("returns exact parts for $locale", ({ locale, expected }) => {
      const actual = formatZonedToParts(
        valueByLocale[locale as keyof typeof valueByLocale],
        locale,
        OPTIONS,
      );
      // Some CI runners' ICU/CLDR data renders CJK day-period markers as
      // ASCII "AM"/"PM" instead of the native-script word (see
      // test/icuVariants.ts) — compare through expectDateTimeEqual, which
      // canonicalizes that variance, instead of a strict deep-equal.
      expectDateTimeEqual(JSON.stringify(actual), JSON.stringify(expected));
    });
  });

  describe("no options — ECMA-402 GetDateTimeFormat(~any~, ~zoned-date-time~) defaults", () => {
    // With no required field and no dateStyle/timeStyle, ECMA-402 (as amended
    // by Temporal) formats a ZonedDateTime with year, month, day, hour, minute
    // and second "numeric" plus timeZoneName "short" when not given — the
    // output ZonedDateTime#toLocaleString gives. Expected values: runtime
    // Intl.DateTimeFormat given those fields explicitly in the value's own
    // zone, cross-checked against the polyfill's toLocaleString.
    it.each`
      locale                  | expected
      ${MustTestLocales.enUS} | ${[{ type: "month", value: "3" }, { type: "literal", value: "/" }, { type: "day", value: "15" }, { type: "literal", value: "/" }, { type: "year", value: "2024" }, { type: "literal", value: ", " }, { type: "hour", value: "2" }, { type: "literal", value: ":" }, { type: "minute", value: "30" }, { type: "literal", value: ":" }, { type: "second", value: "00" }, { type: "literal", value: " " }, { type: "dayPeriod", value: "PM" }, { type: "literal", value: " " }, { type: "timeZoneName", value: "EDT" }]}
      ${MustTestLocales.deDE} | ${[{ type: "day", value: "15" }, { type: "literal", value: "." }, { type: "month", value: "3" }, { type: "literal", value: "." }, { type: "year", value: "2024" }, { type: "literal", value: ", " }, { type: "hour", value: "14" }, { type: "literal", value: ":" }, { type: "minute", value: "30" }, { type: "literal", value: ":" }, { type: "second", value: "00" }, { type: "literal", value: " " }, { type: "timeZoneName", value: "GMT-4" }]}
    `(
      "no options for $locale formats date, time to the second and short zone name",
      ({ locale, expected }) => {
        const actual = formatZonedToParts(
          "2024-03-15T14:30:00.000-04:00[America/New_York]",
          locale,
        );
        expectDateTimeEqual(JSON.stringify(actual), JSON.stringify(expected));
      },
    );

    it.each`
      style           | zoneName
      ${"long"}       | ${"Eastern Daylight Time"}
      ${"longOffset"} | ${"GMT-04:00"}
    `(
      "timeZoneName $style alone keeps that style ($zoneName) and still gets date and time defaults",
      ({ style, zoneName }) => {
        const actual = formatZonedToParts(
          "2024-03-15T14:30:00.000-04:00[America/New_York]",
          MustTestLocales.enUS,
          { timeZoneName: style },
        );
        const expected = [
          { type: "month", value: "3" },
          { type: "literal", value: "/" },
          { type: "day", value: "15" },
          { type: "literal", value: "/" },
          { type: "year", value: "2024" },
          { type: "literal", value: ", " },
          { type: "hour", value: "2" },
          { type: "literal", value: ":" },
          { type: "minute", value: "30" },
          { type: "literal", value: ":" },
          { type: "second", value: "00" },
          { type: "literal", value: " " },
          { type: "dayPeriod", value: "PM" },
          { type: "literal", value: " " },
          { type: "timeZoneName", value: zoneName },
        ];
        expectDateTimeEqual(JSON.stringify(actual), JSON.stringify(expected));
      },
    );
  });

  describe("part order differs between locales", () => {
    it("en-US puts month before day; fr-FR puts day before month", () => {
      const enParts = formatZonedToParts(
        valueByLocale[MustTestLocales.enUS],
        MustTestLocales.enUS,
      );
      const frParts = formatZonedToParts(
        valueByLocale[MustTestLocales.frFR],
        MustTestLocales.frFR,
      );

      const enMonthIdx = enParts.findIndex((p) => p.type === "month");
      const enDayIdx = enParts.findIndex((p) => p.type === "day");
      const frDayIdx = frParts.findIndex((p) => p.type === "day");
      const frMonthIdx = frParts.findIndex((p) => p.type === "month");

      expect(enMonthIdx).toBeLessThan(enDayIdx);
      expect(frDayIdx).toBeLessThan(frMonthIdx);
    });
  });

  describe("RTL locales", () => {
    it.each`
      locale                  | description
      ${MustTestLocales.arSA} | ${"ar-SA"}
      ${MustTestLocales.heIL} | ${"he-IL"}
    `(
      "returns string-valued parts for RTL locale $description",
      ({ locale }) => {
        const parts = formatZonedToParts(
          valueByLocale[locale as keyof typeof valueByLocale],
          locale,
          OPTIONS,
        );
        expect(parts.length).toBeGreaterThan(0);
        expect(
          parts.every(
            (p) => typeof p.type === "string" && typeof p.value === "string",
          ),
        ).toBe(true);
      },
    );
  });

  describe("timeZoneName parts", () => {
    it.each`
      style            | expected
      ${"short"}       | ${"EST"}
      ${"long"}        | ${"Eastern Standard Time"}
      ${"shortOffset"} | ${"GMT-5"}
      ${"longOffset"}  | ${"GMT-05:00"}
    `(
      "timeZoneName style $style produces the expected part",
      ({ style, expected }) => {
        const parts = formatZonedToParts(
          valueByLocale[MustTestLocales.enUS],
          MustTestLocales.enUS,
          { hour: "numeric", minute: "numeric", timeZoneName: style },
        );
        const tzPart = parts.find((p) => p.type === "timeZoneName");
        expect(tzPart?.value).toBe(expected);
      },
    );

    it("omits timeZoneName part when the option isn't set", () => {
      const parts = formatZonedToParts(
        valueByLocale[MustTestLocales.enUS],
        MustTestLocales.enUS,
        { hour: "numeric", minute: "numeric" },
      );
      expect(parts.map((p) => p.type)).not.toContain("timeZoneName");
    });
  });

  describe("options producing every part type", () => {
    it("weekday and era options add those parts", () => {
      const parts = formatZonedToParts(
        valueByLocale[MustTestLocales.enUS],
        MustTestLocales.enUS,
        {
          weekday: "long",
          era: "short",
          year: "numeric",
          month: "numeric",
          day: "numeric",
        },
      );
      const types = parts.map((p) => p.type);
      expect(types).toContain("weekday");
      expect(types).toContain("era");
    });

    it("second/fractionalSecond options add those parts", () => {
      const parts = formatZonedToParts(
        "2024-03-15T14:30:00.123-04:00[America/New_York]",
        MustTestLocales.enUS,
        {
          hour: "numeric",
          minute: "numeric",
          second: "numeric",
          fractionalSecondDigits: 3,
        },
      );
      const types = parts.map((p) => p.type);
      expect(types).toContain("second");
      expect(types).toContain("fractionalSecond");
    });

    it("no options and empty options object produce the same parts", () => {
      const value = valueByLocale[MustTestLocales.enUS];
      const noOpts = formatZonedToParts(value, MustTestLocales.enUS);
      const emptyOpts = formatZonedToParts(value, MustTestLocales.enUS, {});
      expect(emptyOpts).toEqual(noOpts);
    });

    it.each`
      description                            | options
      ${"year present as undefined"}         | ${{ year: undefined }}
      ${"timeZoneName present as undefined"} | ${{ timeZoneName: undefined }}
      ${"timeZone present as undefined"}     | ${{ timeZone: undefined }}
    `(
      "$description is read as absent (ECMA-402 GetOption), so defaults still fill it",
      ({ options }) => {
        const value = valueByLocale[MustTestLocales.enUS];
        const noOpts = formatZonedToParts(value, MustTestLocales.enUS);
        expect(
          formatZonedToParts(value, MustTestLocales.enUS, options),
        ).toEqual(noOpts);
      },
    );
  });

  describe("timeZone option", () => {
    // A ZonedDateTime is formatted in its own zone: Temporal's toLocaleString
    // throws a TypeError for a timeZone option (CreateDateTimeFormat with
    // toLocaleStringTimeZone; test262 intl402/Temporal/ZonedDateTime/
    // prototype/toLocaleString/options-timeZone.js), so the parts are [].
    it.each`
      timeZone
      ${"Asia/Tokyo"}
      ${"America/New_York"}
    `(
      "returns [] when a timeZone option $timeZone is passed",
      ({ timeZone }) => {
        expect(
          formatZonedToParts(
            "2024-02-03T14:30:45-05:00[America/New_York]",
            MustTestLocales.enUS,
            { timeZone },
          ),
        ).toEqual([]);
      },
    );
  });

  describe("invalid input", () => {
    it.each`
      value
      ${"not-a-zoned-datetime"}
      ${"2024-02-03T14:30:45-05:00"}
      ${"2024-13-01T00:00:00-05:00[America/New_York]"}
      ${""}
      ${null}
      ${undefined}
      ${false}
      ${[]}
    `("returns [] for invalid input: $value", ({ value }) => {
      expect(formatZonedToParts(value as never)).toEqual([]);
    });
  });

  // ECMA-402 CanonicalizeLocaleList: `locale` may be a preference list; the first tag with locale data
  // is used, and a malformed tag anywhere in the list is invalid input. Expected strings from native
  // Intl with the same list.
  it.each`
    locale                                          | expected
    ${[MustTestLocales.frFR, MustTestLocales.enUS]} | ${"3 févr. 2024, 14:30"}
    ${[MustTestLocales.frFR, "not a locale!!"]}     | ${""}
  `(
    "returns $expected (parts joined) for locale list $locale",
    ({ locale, expected }) => {
      const actual = formatZonedToParts(
        "2024-02-03T14:30:45+01:00[Europe/Paris]",
        locale,
        { dateStyle: "medium", timeStyle: "short" },
      );
      expect(
        Array.isArray(actual)
          ? actual.map((part) => part.value).join("")
          : actual,
      ).toEqual(expected);
    },
  );
});

// Plan #14: ECMA-402 CoerceOptionsToObject throws TypeError for null options and wraps any other
// primitive with ToObject, which carries no formatting fields, so a string or number formats with
// the defaults. Expected strings from native Chromium 153 (`toLocaleString("en-US", 1)` and
// `new Intl.DateTimeFormat("en-US", null)`, which throws).
describe("formatZonedToParts with primitive options", () => {
  it.each`
    options   | expected
    ${null}   | ${""}
    ${"long"} | ${"2/3/2024, 2:30:00 PM EST"}
    ${1}      | ${"2/3/2024, 2:30:00 PM EST"}
  `("returns $expected for options $options", ({ options, expected }) => {
    expectDateTimeEqual(
      formatZonedToParts(
        "2024-02-03T14:30:00-05:00[America/New_York]",
        MustTestLocales.enUS,
        options as never,
      )
        .map((part) => part.value)
        .join(""),
      expected,
    );
  });
});
