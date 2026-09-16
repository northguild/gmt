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

  describe('zone = ("+" / "-") 4DIGIT: whole minutes only (RFC 5322 §3.3)', () => {
    // Local mean time offsets are not whole minutes, so no ±hhmm exists for
    // them. Africa/Monrovia was -00:44:30 until 1972 (23:15:30 local is
    // 1970-01-01T00:00:00Z); Europe/Dublin was -00:25:21 in 1900.
    it.each`
      value                                           | reason
      ${"1969-12-31T23:15:30-00:45[Africa/Monrovia]"} | ${"offset -00:44:30"}
      ${"1900-06-01T11:34:39-00:25[Europe/Dublin]"}   | ${"offset -00:25:21"}
    `("returns '' for $value ($reason)", ({ value }: { value: string }) => {
      expect(formatRfc2822(value)).toBe("");
    });

    it.each`
      value                                  | expected
      ${"2024-01-01T12:00:00-00:30[-00:30]"} | ${"Mon, 01 Jan 2024 12:00:00 -0030"}
      ${"2024-01-01T12:00:00+00:30[+00:30]"} | ${"Mon, 01 Jan 2024 12:00:00 +0030"}
    `(
      "pads a sub-hour offset: $value → $expected",
      ({ value, expected }: { value: string; expected: string }) => {
        expect(formatRfc2822(value)).toBe(expected);
      },
    );
  });

  describe("year = 4*DIGIT, unsigned (RFC 5322 §3.3)", () => {
    // 0000-01-01 and 10000-01-01 are Saturdays: 0001-01-01 is a Monday and
    // year 0 has 366 days; 8000 years are 20 whole 400-year cycles from
    // 2000-01-01, a Saturday.
    it.each`
      value                                  | expected
      ${"-000001-06-15T12:00:00+00:00[UTC]"} | ${""}
      ${"-271821-04-20T00:00:00+00:00[UTC]"} | ${""}
      ${"0000-01-01T00:00:00+00:00[UTC]"}    | ${"Sat, 01 Jan 0000 00:00:00 +0000"}
      ${"+010000-01-01T00:00:00+00:00[UTC]"} | ${"Sat, 01 Jan 10000 00:00:00 +0000"}
    `(
      "$value → '$expected'",
      ({ value, expected }: { value: string; expected: string }) => {
        expect(formatRfc2822(value)).toBe(expected);
      },
    );
  });

  it("drops fractional seconds: second = 2DIGIT has no fraction", () => {
    expect(formatRfc2822("2024-03-15T14:30:00.999+00:00[UTC]")).toBe(
      "Fri, 15 Mar 2024 14:30:00 +0000",
    );
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
