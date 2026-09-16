import { expectDateTimeEqual, MustTestLocales } from "../../test";
import { formatDateTimeToParts } from "./formatDateTimeToParts";

const OPTIONS = { dateStyle: "medium", timeStyle: "short" } as const;

describe("formatDateTimeToParts", () => {
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
      const actual = formatDateTimeToParts(
        "2024-02-03T14:30:00",
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

  describe("no options — ECMA-402 GetDateTimeFormat(~any~, ~all~) defaults", () => {
    // With no required field and no dateStyle/timeStyle, ECMA-402 (as amended
    // by Temporal) formats a PlainDateTime with year, month, day, hour, minute
    // and second all "numeric" — the output PlainDateTime#toLocaleString gives.
    // Expected values: runtime Intl.DateTimeFormat given those six fields
    // explicitly (timeZone "UTC"), cross-checked against the polyfill's
    // Intl.DateTimeFormat#formatToParts(plainDateTime).
    it.each`
      locale                  | expected
      ${MustTestLocales.enUS} | ${[{ type: "month", value: "3" }, { type: "literal", value: "/" }, { type: "day", value: "15" }, { type: "literal", value: "/" }, { type: "year", value: "2024" }, { type: "literal", value: ", " }, { type: "hour", value: "2" }, { type: "literal", value: ":" }, { type: "minute", value: "30" }, { type: "literal", value: ":" }, { type: "second", value: "00" }, { type: "literal", value: " " }, { type: "dayPeriod", value: "PM" }]}
      ${MustTestLocales.deDE} | ${[{ type: "day", value: "15" }, { type: "literal", value: "." }, { type: "month", value: "3" }, { type: "literal", value: "." }, { type: "year", value: "2024" }, { type: "literal", value: ", " }, { type: "hour", value: "14" }, { type: "literal", value: ":" }, { type: "minute", value: "30" }, { type: "literal", value: ":" }, { type: "second", value: "00" }]}
    `(
      "no options for $locale formats date and time to the second",
      ({ locale, expected }) => {
        const actual = formatDateTimeToParts("2024-03-15T14:30:00", locale);
        expectDateTimeEqual(JSON.stringify(actual), JSON.stringify(expected));
      },
    );

    it("era-only options still get the date and time defaults (era is not a required field)", () => {
      const actual = formatDateTimeToParts(
        "2024-03-15T14:30:00",
        MustTestLocales.enUS,
        { era: "short" },
      );
      const expected = [
        { type: "month", value: "3" },
        { type: "literal", value: "/" },
        { type: "day", value: "15" },
        { type: "literal", value: "/" },
        { type: "year", value: "2024" },
        { type: "literal", value: " " },
        { type: "era", value: "AD" },
        { type: "literal", value: ", " },
        { type: "hour", value: "2" },
        { type: "literal", value: ":" },
        { type: "minute", value: "30" },
        { type: "literal", value: ":" },
        { type: "second", value: "00" },
        { type: "literal", value: " " },
        { type: "dayPeriod", value: "PM" },
      ];
      expectDateTimeEqual(JSON.stringify(actual), JSON.stringify(expected));
    });

    it("an explicit field set is not given defaults", () => {
      const actual = formatDateTimeToParts(
        "2024-03-15T14:30:00",
        MustTestLocales.enUS,
        { hour: "numeric", minute: "numeric" },
      );
      const expected = [
        { type: "hour", value: "2" },
        { type: "literal", value: ":" },
        { type: "minute", value: "30" },
        { type: "literal", value: " " },
        { type: "dayPeriod", value: "PM" },
      ];
      expectDateTimeEqual(JSON.stringify(actual), JSON.stringify(expected));
    });
  });

  describe("a zoneless value never prints a zone name", () => {
    // timeZoneName is not a field a PlainDateTime format inherits
    // (GetDateTimeFormat inherit ~relevant~), so the internal UTC anchor
    // must never surface as "UTC".
    it.each`
      description                                    | options                                      | expected
      ${"timeZoneName short alone (defaults apply)"} | ${{ timeZoneName: "short" }}                 | ${[{ type: "month", value: "3" }, { type: "literal", value: "/" }, { type: "day", value: "15" }, { type: "literal", value: "/" }, { type: "year", value: "2024" }, { type: "literal", value: ", " }, { type: "hour", value: "2" }, { type: "literal", value: ":" }, { type: "minute", value: "30" }, { type: "literal", value: ":" }, { type: "second", value: "00" }, { type: "literal", value: " " }, { type: "dayPeriod", value: "PM" }]}
      ${"hour with timeZoneName long"}               | ${{ hour: "numeric", timeZoneName: "long" }} | ${[{ type: "hour", value: "2" }, { type: "literal", value: " " }, { type: "dayPeriod", value: "PM" }]}
    `("$description produces no timeZoneName part", ({ options, expected }) => {
      const actual = formatDateTimeToParts(
        "2024-03-15T14:30:00",
        MustTestLocales.enUS,
        options,
      );
      expectDateTimeEqual(JSON.stringify(actual), JSON.stringify(expected));
    });
  });

  describe("a timeStyle never brings a zone name (AdjustDateTimeStyleFormat)", () => {
    // [[TemporalPlainDateTimeFormat]] = AdjustDateTimeStyleFormat(…,
    // « weekday, era, year, month, day, dayPeriod, hour, minute, second,
    // fractionalSecondDigits »): the long/full time formats' timeZoneName is
    // removed and the remaining hour, minute and second are kept. The expected
    // parts are the runtime Intl.DateTimeFormat medium time format at the UTC
    // anchor — the same fields, no zone.
    const EN_US_NOON = [
      { type: "hour", value: "12" },
      { type: "literal", value: ":" },
      { type: "minute", value: "00" },
      { type: "literal", value: ":" },
      { type: "second", value: "00" },
      { type: "literal", value: "\u202f" },
      { type: "dayPeriod", value: "PM" },
    ];
    const EN_US_FULL_DATE = [
      { type: "weekday", value: "Thursday" },
      { type: "literal", value: ", " },
      { type: "month", value: "February" },
      { type: "literal", value: " " },
      { type: "day", value: "29" },
      { type: "literal", value: ", " },
      { type: "year", value: "2024" },
      { type: "literal", value: " at " },
    ];
    const DE_DE_MEDIUM = [
      { type: "day", value: "29" },
      { type: "literal", value: "." },
      { type: "month", value: "02" },
      { type: "literal", value: "." },
      { type: "year", value: "2024" },
      { type: "literal", value: ", " },
      { type: "hour", value: "12" },
      { type: "literal", value: ":" },
      { type: "minute", value: "00" },
      { type: "literal", value: ":" },
      { type: "second", value: "00" },
    ];

    it.each`
      locale                  | options                                       | expected
      ${MustTestLocales.enUS} | ${{ timeStyle: "long" }}                      | ${EN_US_NOON}
      ${MustTestLocales.enUS} | ${{ timeStyle: "full" }}                      | ${EN_US_NOON}
      ${MustTestLocales.enUS} | ${{ dateStyle: "full", timeStyle: "full" }}   | ${[...EN_US_FULL_DATE, ...EN_US_NOON]}
      ${MustTestLocales.deDE} | ${{ dateStyle: "medium", timeStyle: "long" }} | ${DE_DE_MEDIUM}
    `(
      "$locale with $options has no timeZoneName part",
      ({ locale, options, expected }) => {
        const actual = formatDateTimeToParts(
          "2024-02-29T12:00",
          locale,
          options,
        );
        expectDateTimeEqual(JSON.stringify(actual), JSON.stringify(expected));
      },
    );

    it("dateStyle with an explicit timeZoneName is a TypeError in CreateDateTimeFormat, so []", () => {
      expect(
        formatDateTimeToParts("2024-02-29T12:00", MustTestLocales.enUS, {
          dateStyle: "full",
          timeZoneName: "short",
        }),
      ).toEqual([]);
    });
  });

  describe("part order differs between locales", () => {
    it("en-US puts month before day; fr-FR puts day before month", () => {
      const enParts = formatDateTimeToParts(
        "2024-03-15T14:30:00",
        MustTestLocales.enUS,
      );
      const frParts = formatDateTimeToParts(
        "2024-03-15T14:30:00",
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
        const parts = formatDateTimeToParts(
          "2024-03-15T14:30:00",
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

  describe("options producing every part type", () => {
    it("second/fractionalSecond options add those parts", () => {
      const parts = formatDateTimeToParts(
        "2024-03-15T14:30:00.123",
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

    it("dayPeriod (hour12) adds a dayPeriod part", () => {
      const parts = formatDateTimeToParts(
        "2024-03-15T14:30:00",
        MustTestLocales.enUS,
        { hour: "numeric", minute: "numeric", hour12: true },
      );
      expect(parts.map((p) => p.type)).toContain("dayPeriod");
    });

    it("weekday and era options add those parts", () => {
      const parts = formatDateTimeToParts(
        "2024-03-15T14:30:00",
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

    it("no options and empty options object produce the same parts", () => {
      const noOpts = formatDateTimeToParts(
        "2024-03-15T14:30:00",
        MustTestLocales.enUS,
      );
      const emptyOpts = formatDateTimeToParts(
        "2024-03-15T14:30:00",
        MustTestLocales.enUS,
        {},
      );
      expect(emptyOpts).toEqual(noOpts);
    });

    it("an option present as undefined is read as absent (ECMA-402 GetOption), so defaults still fill it", () => {
      const noOpts = formatDateTimeToParts(
        "2024-03-15T14:30:00",
        MustTestLocales.enUS,
      );
      const undefinedYear = formatDateTimeToParts(
        "2024-03-15T14:30:00",
        MustTestLocales.enUS,
        { year: undefined },
      );
      expect(undefinedYear).toEqual(noOpts);
    });
  });

  describe("invalid input", () => {
    it.each`
      value
      ${"not-a-datetime"}
      ${"2024-13-01T00:00:00"}
      ${"2024-02-30T00:00:00"}
      ${""}
      ${null}
      ${undefined}
      ${false}
      ${[]}
    `("returns [] for invalid input: $value", ({ value }) => {
      expect(formatDateTimeToParts(value as never)).toEqual([]);
    });
  });
});
