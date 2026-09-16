import { MustTestLocales } from "../../test";
import { formatDateToParts } from "./formatDateToParts";

describe("formatDateToParts", () => {
  describe("17-locale matrix — default options", () => {
    it.each`
      locale                  | expected
      ${MustTestLocales.enUS} | ${[{ type: "month", value: "2" }, { type: "literal", value: "/" }, { type: "day", value: "3" }, { type: "literal", value: "/" }, { type: "year", value: "2024" }]}
      ${MustTestLocales.enGB} | ${[{ type: "day", value: "03" }, { type: "literal", value: "/" }, { type: "month", value: "02" }, { type: "literal", value: "/" }, { type: "year", value: "2024" }]}
      ${MustTestLocales.deDE} | ${[{ type: "day", value: "3" }, { type: "literal", value: "." }, { type: "month", value: "2" }, { type: "literal", value: "." }, { type: "year", value: "2024" }]}
      ${MustTestLocales.frFR} | ${[{ type: "day", value: "03" }, { type: "literal", value: "/" }, { type: "month", value: "02" }, { type: "literal", value: "/" }, { type: "year", value: "2024" }]}
      ${MustTestLocales.esES} | ${[{ type: "day", value: "3" }, { type: "literal", value: "/" }, { type: "month", value: "2" }, { type: "literal", value: "/" }, { type: "year", value: "2024" }]}
      ${MustTestLocales.itIT} | ${[{ type: "day", value: "03" }, { type: "literal", value: "/" }, { type: "month", value: "02" }, { type: "literal", value: "/" }, { type: "year", value: "2024" }]}
      ${MustTestLocales.ptPT} | ${[{ type: "day", value: "03" }, { type: "literal", value: "/" }, { type: "month", value: "02" }, { type: "literal", value: "/" }, { type: "year", value: "2024" }]}
      ${MustTestLocales.svSE} | ${[{ type: "year", value: "2024" }, { type: "literal", value: "-" }, { type: "month", value: "02" }, { type: "literal", value: "-" }, { type: "day", value: "03" }]}
      ${MustTestLocales.isIS} | ${[{ type: "day", value: "3" }, { type: "literal", value: "." }, { type: "month", value: "2" }, { type: "literal", value: "." }, { type: "year", value: "2024" }]}
      ${MustTestLocales.zhCN} | ${[{ type: "year", value: "2024" }, { type: "literal", value: "/" }, { type: "month", value: "2" }, { type: "literal", value: "/" }, { type: "day", value: "3" }]}
      ${MustTestLocales.zhTW} | ${[{ type: "year", value: "2024" }, { type: "literal", value: "/" }, { type: "month", value: "2" }, { type: "literal", value: "/" }, { type: "day", value: "3" }]}
      ${MustTestLocales.jaJP} | ${[{ type: "year", value: "2024" }, { type: "literal", value: "/" }, { type: "month", value: "2" }, { type: "literal", value: "/" }, { type: "day", value: "3" }]}
      ${MustTestLocales.koKR} | ${[{ type: "year", value: "2024" }, { type: "literal", value: ". " }, { type: "month", value: "2" }, { type: "literal", value: ". " }, { type: "day", value: "3" }, { type: "literal", value: "." }]}
      ${MustTestLocales.arSA} | ${[{ type: "day", value: "٣" }, { type: "literal", value: "‏/" }, { type: "month", value: "٢" }, { type: "literal", value: "‏/" }, { type: "year", value: "٢٠٢٤" }]}
      ${MustTestLocales.heIL} | ${[{ type: "day", value: "3" }, { type: "literal", value: "." }, { type: "month", value: "2" }, { type: "literal", value: "." }, { type: "year", value: "2024" }]}
      ${MustTestLocales.ruRU} | ${[{ type: "day", value: "03" }, { type: "literal", value: "." }, { type: "month", value: "02" }, { type: "literal", value: "." }, { type: "year", value: "2024" }]}
      ${MustTestLocales.trTR} | ${[{ type: "day", value: "03" }, { type: "literal", value: "." }, { type: "month", value: "02" }, { type: "literal", value: "." }, { type: "year", value: "2024" }]}
    `("returns exact parts for $locale", ({ locale, expected }) => {
      expect(formatDateToParts("2024-02-03", locale)).toEqual(expected);
    });
  });

  describe("part order differs between locales — the property formatToParts exists for", () => {
    it("en-US puts month before day; fr-FR puts day before month", () => {
      const enParts = formatDateToParts("2024-03-15", MustTestLocales.enUS);
      const frParts = formatDateToParts("2024-03-15", MustTestLocales.frFR);

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
        const parts = formatDateToParts("2024-03-15", locale);
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
    it("era option adds an era part", () => {
      const parts = formatDateToParts("2024-03-15", MustTestLocales.enUS, {
        era: "short",
        year: "numeric",
        month: "numeric",
        day: "numeric",
      });
      expect(parts.map((p) => p.type)).toContain("era");
    });

    it("weekday option adds a weekday part", () => {
      const parts = formatDateToParts("2024-03-15", MustTestLocales.enUS, {
        weekday: "long",
      });
      expect(parts.map((p) => p.type)).toContain("weekday");
    });

    it.each`
      style
      ${"full"}
      ${"long"}
      ${"medium"}
      ${"short"}
    `("dateStyle $style produces year/month/day parts", ({ style }) => {
      const parts = formatDateToParts("2024-03-15", MustTestLocales.enUS, {
        dateStyle: style,
      });
      const types = parts.map((p) => p.type);
      expect(types).toContain("year");
      expect(types).toContain("month");
      expect(types).toContain("day");
    });

    it("no options and empty options object produce the same parts", () => {
      const noOpts = formatDateToParts("2024-03-15", MustTestLocales.enUS);
      const emptyOpts = formatDateToParts(
        "2024-03-15",
        MustTestLocales.enUS,
        {},
      );
      expect(emptyOpts).toEqual(noOpts);
    });
  });

  describe("a PlainDate yields only date fields (Temporal ECMA-402 amendments)", () => {
    // [[TemporalPlainDateFormat]] is null when dateStyle is undefined and
    // timeStyle is set, and GetDateTimeFormat(~date~, ~date~, ~relevant~)
    // returns null when only non-date fields are given: both throw a
    // TypeError, so there is nothing to format. timeZoneName is never
    // inherited (~relevant~). With dateStyle, AdjustDateTimeStyleFormat keeps
    // only « weekday, era, year, month, day ».
    const THURSDAY_FEB_29 = [
      { type: "weekday", value: "Thursday" },
      { type: "literal", value: ", " },
      { type: "month", value: "February" },
      { type: "literal", value: " " },
      { type: "day", value: "29" },
      { type: "literal", value: ", " },
      { type: "year", value: "2024" },
    ];
    const NUMERIC_FEB_29 = [
      { type: "month", value: "2" },
      { type: "literal", value: "/" },
      { type: "day", value: "29" },
      { type: "literal", value: "/" },
      { type: "year", value: "2024" },
    ];

    it.each`
      description                                         | options                                                                        | expected
      ${"timeStyle long alone (no PlainDate format)"}     | ${{ timeStyle: "long" }}                                                       | ${[]}
      ${"timeStyle short alone (no PlainDate format)"}    | ${{ timeStyle: "short" }}                                                      | ${[]}
      ${"hour alone (only a non-date field)"}             | ${{ hour: "numeric" }}                                                         | ${[]}
      ${"minute and second alone"}                        | ${{ minute: "2-digit", second: "2-digit" }}                                    | ${[]}
      ${"dateStyle full + timeStyle full drops the time"} | ${{ dateStyle: "full", timeStyle: "full" }}                                    | ${THURSDAY_FEB_29}
      ${"date fields + hour drops the hour"}              | ${{ year: "numeric", month: "numeric", day: "numeric", hour: "numeric" }}      | ${NUMERIC_FEB_29}
      ${"timeZoneName alone is not inherited (defaults)"} | ${{ timeZoneName: "short" }}                                                   | ${NUMERIC_FEB_29}
      ${"date fields + timeZoneName long"}                | ${{ year: "numeric", month: "numeric", day: "numeric", timeZoneName: "long" }} | ${NUMERIC_FEB_29}
    `("en-US $description", ({ options, expected }) => {
      expect(
        formatDateToParts("2024-02-29", MustTestLocales.enUS, options),
      ).toEqual(expected);
    });

    it("dateStyle with an explicit timeZoneName is a TypeError in CreateDateTimeFormat, so []", () => {
      expect(
        formatDateToParts("2024-02-29", MustTestLocales.enUS, {
          dateStyle: "full",
          timeZoneName: "short",
        }),
      ).toEqual([]);
    });
  });

  describe("invalid input", () => {
    it.each`
      value
      ${"not-a-date"}
      ${"2024-13-01"}
      ${"2024-02-30"}
      ${""}
      ${null}
      ${undefined}
      ${false}
      ${[]}
    `("returns [] for invalid input: $value", ({ value }) => {
      expect(formatDateToParts(value as never)).toEqual([]);
    });
  });
});
