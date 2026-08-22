import { Temporal } from "@js-temporal/polyfill";
import { httpDate } from "../../regex";
import { localeZonedDateTimeInputByLocale, MustTestLocales } from "../../test";
import { formatHttp } from "./formatHttp";

describe("formatHttp", () => {
  it.each`
    value                     | expected
    ${"2024-03-15T14:30:00Z"} | ${"Fri, 15 Mar 2024 14:30:00 GMT"}
    ${"2024-01-05T09:00:00Z"} | ${"Fri, 05 Jan 2024 09:00:00 GMT"}
    ${"2024-03-05T09:00:05Z"} | ${"Tue, 05 Mar 2024 09:00:05 GMT"}
  `(
    "formats $value as $expected",
    ({ value, expected }: { value: string; expected: string }) => {
      expect(formatHttp(value)).toBe(expected);
    },
  );

  it("zero-pads a single-digit day to 2 digits", () => {
    expect(formatHttp("2024-03-05T09:00:00Z")).toBe(
      "Tue, 05 Mar 2024 09:00:00 GMT",
    );
  });

  it("truncates fractional seconds — IMF-fixdate has no sub-second field", () => {
    expect(formatHttp("2024-03-15T14:30:00.987654321Z")).toBe(
      "Fri, 15 Mar 2024 14:30:00 GMT",
    );
  });

  it.each`
    value
    ${"invalid"}
    ${""}
    ${"2024-03-15T14:30:00"}
    ${"2024-03-15"}
    ${"2024-02-30T14:30:00Z"}
  `("returns '' for invalid input $value", ({ value }: { value: string }) => {
    expect(formatHttp(value)).toBe("");
  });

  describe("output is identical across all 17 locales", () => {
    const valueByLocale = localeZonedDateTimeInputByLocale;

    it.each`
      locale
      ${MustTestLocales.enUS}
      ${MustTestLocales.enGB}
      ${MustTestLocales.deDE}
      ${MustTestLocales.frFR}
      ${MustTestLocales.esES}
      ${MustTestLocales.itIT}
      ${MustTestLocales.ptPT}
      ${MustTestLocales.svSE}
      ${MustTestLocales.isIS}
      ${MustTestLocales.zhCN}
      ${MustTestLocales.zhTW}
      ${MustTestLocales.jaJP}
      ${MustTestLocales.koKR}
      ${MustTestLocales.arSA}
      ${MustTestLocales.heIL}
      ${MustTestLocales.ruRU}
      ${MustTestLocales.trTR}
    `(
      "matches the fixed English IMF-fixdate grammar for $locale",
      ({ locale }: { locale: keyof typeof valueByLocale }) => {
        const utcValue = Temporal.ZonedDateTime.from(valueByLocale[locale])
          .toInstant()
          .toString();
        const result = formatHttp(utcValue);
        expect(httpDate.test(result)).toBe(true);
      },
    );
  });
});
