import { rfc3339DateTime } from "../../regex";
import { localeZonedDateTimeInputByLocale, MustTestLocales } from "../../test";
import { formatRfc3339 } from "./formatRfc3339";

describe("formatRfc3339", () => {
  it.each`
    value                                              | expected
    ${"2024-03-15T14:30:00-04:00[America/New_York]"}   | ${"2024-03-15T14:30:00-04:00"}
    ${"2024-03-15T14:30:00Z[UTC]"}                     | ${"2024-03-15T14:30:00+00:00"}
    ${"2024-03-05T09:00:05+05:30[Asia/Kolkata]"}       | ${"2024-03-05T09:00:05+05:30"}
    ${"2024-07-01T00:00:00-11:00[Pacific/Niue]"}       | ${"2024-07-01T00:00:00-11:00"}
    ${"2024-07-01T00:00:00+13:00[Pacific/Apia]"}       | ${"2024-07-01T00:00:00+13:00"}
    ${"2024-03-15T14:30:00.5-04:00[America/New_York]"} | ${"2024-03-15T14:30:00.5-04:00"}
  `(
    "strips the bracketed zone annotation from $value to $expected",
    ({ value, expected }: { value: string; expected: string }) => {
      expect(formatRfc3339(value)).toBe(expected);
    },
  );

  it("differs from the input's own toString() by the bracket alone", () => {
    const value = "2024-03-15T14:30:00-04:00[America/New_York]";
    expect(formatRfc3339(value)).toBe(value.replace("[America/New_York]", ""));
  });

  it.each`
    value
    ${"invalid"}
    ${""}
    ${"2024-03-15T14:30:00"}
    ${"2024-02-30T14:30:00+00:00[UTC]"}
  `("returns '' for invalid input $value", ({ value }: { value: string }) => {
    expect(formatRfc3339(value)).toBe("");
  });

  describe("sub-minute offsets are converted to UTC (RFC 3339 §4.2 NOTE)", () => {
    // time-numoffset holds whole minutes only; "applications must convert
    // them to a representable time zone". The instant is kept exactly and
    // written with the UTC offset +00:00. Monrovia -00:44:30: 23:15:30 local
    // = 00:00:00Z. Dublin -00:25:21: 11:34:39 local = 12:00:00Z.
    it.each`
      value                                                   | expected
      ${"1969-12-31T23:15:30-00:45[Africa/Monrovia]"}         | ${"1970-01-01T00:00:00+00:00"}
      ${"1900-06-01T11:34:39-00:25[Europe/Dublin]"}           | ${"1900-06-01T12:00:00+00:00"}
      ${"1900-06-01T11:34:39.123456789-00:25[Europe/Dublin]"} | ${"1900-06-01T12:00:00.123456789+00:00"}
    `(
      "$value → $expected",
      ({ value, expected }: { value: string; expected: string }) => {
        expect(formatRfc3339(value)).toBe(expected);
      },
    );
  });

  describe("date-fullyear = 4DIGIT (RFC 3339 §5.6)", () => {
    it.each`
      value                                  | expected
      ${"-000001-06-15T12:00:00+00:00[UTC]"} | ${""}
      ${"+010000-01-01T00:00:00+00:00[UTC]"} | ${""}
      ${"0000-01-01T00:00:00+00:00[UTC]"}    | ${"0000-01-01T00:00:00+00:00"}
      ${"9999-12-31T23:59:59+00:00[UTC]"}    | ${"9999-12-31T23:59:59+00:00"}
    `(
      "$value → '$expected'",
      ({ value, expected }: { value: string; expected: string }) => {
        expect(formatRfc3339(value)).toBe(expected);
      },
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
      "matches the strict RFC 3339 grammar for $locale",
      ({ locale }: { locale: keyof typeof valueByLocale }) => {
        const result = formatRfc3339(valueByLocale[locale]);
        expect(rfc3339DateTime.test(result)).toBe(true);
      },
    );
  });
});
