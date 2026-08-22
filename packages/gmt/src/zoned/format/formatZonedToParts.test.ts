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
});
