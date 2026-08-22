import { rfc2822DateTime } from "../../regex";
import { localeZonedDateTimeInputByLocale, MustTestLocales } from "../../test";
import { formatRfc2822 } from "./formatRfc2822";

describe("formatRfc2822", () => {
  it.each`
    value                                            | expected
    ${"2024-03-15T14:30:00-04:00[America/New_York]"} | ${"Fri, 15 Mar 2024 14:30:00 -0400"}
    ${"2024-01-05T09:00:00+00:00[UTC]"}              | ${"Fri, 05 Jan 2024 09:00:00 +0000"}
    ${"2024-03-05T09:00:05+05:30[Asia/Kolkata]"}     | ${"Tue, 05 Mar 2024 09:00:05 +0530"}
    ${"2024-07-01T00:00:00-11:00[Pacific/Niue]"}     | ${"Mon, 01 Jul 2024 00:00:00 -1100"}
    ${"2024-07-01T00:00:00+13:00[Pacific/Apia]"}     | ${"Mon, 01 Jul 2024 00:00:00 +1300"}
  `(
    "formats $value as $expected",
    ({ value, expected }: { value: string; expected: string }) => {
      expect(formatRfc2822(value)).toBe(expected);
    },
  );

  it("zero-pads a single-digit day to 2 digits", () => {
    expect(formatRfc2822("2024-03-05T09:00:00+00:00[UTC]")).toBe(
      "Tue, 05 Mar 2024 09:00:00 +0000",
    );
  });

  it.each`
    value
    ${"invalid"}
    ${""}
    ${"2024-03-15T14:30:00"}
    ${"2024-02-30T14:30:00+00:00[UTC]"}
  `("returns '' for invalid input $value", ({ value }: { value: string }) => {
    expect(formatRfc2822(value)).toBe("");
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
      "matches the fixed English RFC 5322 grammar for $locale",
      ({ locale }: { locale: keyof typeof valueByLocale }) => {
        const result = formatRfc2822(valueByLocale[locale]);
        expect(rfc2822DateTime.test(result)).toBe(true);
      },
    );
  });
});
