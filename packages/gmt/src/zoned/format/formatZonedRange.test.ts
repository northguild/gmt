import { MustTestLocales } from "../../test/localeMatrix";
import { localeZonedRangeInputByLocale } from "../test/localeZonedFixtures";
import { formatZonedRange } from "./formatZonedRange";

describe("formatZonedRange", () => {
  const rangeByLocale = localeZonedRangeInputByLocale;

  // en-US
  it.each`
    from                                             | to                                               | locale     | options                                                                 | expected
    ${"2024-02-29T10:00:00-05:00[America/New_York]"} | ${"2024-02-29T12:00:00-05:00[America/New_York]"} | ${"en-US"} | ${{ dateStyle: "long", timeStyle: "long" }}                             | ${"February 29, 2024, 10:00:00 AM EST – 12:00:00 PM EST"}
    ${"2024-02-29T10:00:00-05:00[America/New_York]"} | ${"2024-02-29T12:00:00-05:00[America/New_York]"} | ${"en-US"} | ${{ dateStyle: "long", timeStyle: "short" }}                            | ${"February 29, 2024, 10:00 AM – 12:00 PM"}
    ${"2024-02-29T10:00:00-05:00[America/New_York]"} | ${"2024-02-29T12:00:00-05:00[America/New_York]"} | ${"en-US"} | ${{ dateStyle: "short", timeStyle: "short" }}                           | ${"2/29/24, 10:00 AM – 12:00 PM"}
    ${"2024-02-29T10:00:00-05:00[America/New_York]"} | ${"2024-02-29T12:00:00-05:00[America/New_York]"} | ${"en-US"} | ${{ hour: "numeric", minute: "numeric", timeZoneName: "short" }}        | ${"10:00 AM – 12:00 PM EST"}
    ${"2024-02-29T10:00:00-05:00[America/New_York]"} | ${"2024-02-29T12:00:00-05:00[America/New_York]"} | ${"en-US"} | ${{ hour: "numeric", minute: "numeric", timeZoneName: "long" }}         | ${"10:00 AM – 12:00 PM EST"}
    ${"2024-02-29T10:00:00-05:00[America/New_York]"} | ${"2024-02-29T12:00:00-05:00[America/New_York]"} | ${"en-US"} | ${{ hour: "numeric", minute: "numeric", timeZoneName: "shortGeneric" }} | ${"10:00 AM – 12:00 PM ET"}
    ${"2024-02-29T10:00:00-05:00[America/New_York]"} | ${"2024-02-29T12:00:00-05:00[America/New_York]"} | ${"en-US"} | ${{ hour: "numeric", minute: "numeric", timeZoneName: "longGeneric" }}  | ${"10:00 AM – 12:00 PM ET"}
    ${"2024-02-29T10:00:00-05:00[America/New_York]"} | ${"2024-02-29T12:00:00-05:00[America/New_York]"} | ${"en-US"} | ${{ hour: "numeric", minute: "numeric", timeZoneName: "shortOffset" }}  | ${"10:00 AM – 12:00 PM"}
    ${"2024-02-29T10:00:00-05:00[America/New_York]"} | ${"2024-02-29T12:00:00-05:00[America/New_York]"} | ${"en-US"} | ${{ hour: "numeric", minute: "numeric", timeZoneName: "longOffset" }}   | ${"10:00 AM – 12:00 PM"}
    ${"2024-02-29T10:00:00-05:00[America/New_York]"} | ${"2024-02-29T12:00:00-05:00[America/New_York]"} | ${"en-US"} | ${{ dayPeriod: "narrow" }}                                              | ${"in the morning"}
    ${"2024-02-29T10:00:00-05:00[America/New_York]"} | ${"2024-02-29T12:00:00-05:00[America/New_York]"} | ${"en-US"} | ${{ dayPeriod: "short" }}                                               | ${"in the morning"}
    ${"2024-02-29T10:00:00-05:00[America/New_York]"} | ${"2024-02-29T12:00:00-05:00[America/New_York]"} | ${"en-US"} | ${{ dayPeriod: "long" }}                                                | ${"in the morning"}
    ${"2024-02-29T10:00:00-05:00[America/New_York]"} | ${"2024-02-29T12:00:00-05:00[America/New_York]"} | ${"en-US"} | ${{ formatMatcher: "basic" }}                                           | ${"2/29/2024, 10:00:00 AM – 12:00:00 PM"}
    ${"2024-02-29T10:00:00-05:00[America/New_York]"} | ${"2024-02-29T12:00:00-05:00[America/New_York]"} | ${"en-US"} | ${{ formatMatcher: "best fit" }}                                        | ${"2/29/2024, 10:00:00 AM – 12:00:00 PM"}
  `(
    "formats a valid zoned datetime range correctly for locale $locale",
    ({ from, to, locale, options, expected }) => {
      expect(formatZonedRange(from, to, locale, options)).toBe(expected);
    },
  );

  it.each`
    from                                             | to
    ${"2024-02-29T10:00:00-05:00[America/New_York]"} | ${"2024-02-29T12:00:00+01:00[Europe/Paris]"}
    ${"2024-02-29T10:00:00+00:00[UTC]"}              | ${"2024-02-29T12:00:00+09:00[Asia/Tokyo]"}
  `(
    "returns empty string when range endpoints use different timezones: $from -> $to",
    ({ from, to }) => {
      expect(
        formatZonedRange(from, to, "en-US", {
          dateStyle: "long",
          timeStyle: "short",
        }),
      ).toBe("");
    },
  );

  it("forces formatting to use endpoint timezone even when options.timeZone is provided", () => {
    const from = "2024-02-29T10:00:00-05:00[America/New_York]";
    const to = "2024-02-29T12:00:00-05:00[America/New_York]";

    expect(
      formatZonedRange(from, to, "en-US", {
        hour: "numeric",
        minute: "numeric",
        timeZoneName: "short",
        timeZone: "UTC",
      }),
    ).toBe("10:00 AM – 12:00 PM EST");
  });

  // en-GB
  it.each`
    from                                         | to                                         | options                                                                | expected
    ${rangeByLocale[MustTestLocales.enGB].start} | ${rangeByLocale[MustTestLocales.enGB].end} | ${{ dateStyle: "long", timeStyle: "long" }}                            | ${"3 February 2024, 14:30:45 GMT – 16:46:15 GMT"}
    ${rangeByLocale[MustTestLocales.enGB].start} | ${rangeByLocale[MustTestLocales.enGB].end} | ${{ dateStyle: "short", timeStyle: "short" }}                          | ${"03/02/2024, 14:30–16:46"}
    ${rangeByLocale[MustTestLocales.enGB].start} | ${rangeByLocale[MustTestLocales.enGB].end} | ${{ hour: "numeric", minute: "numeric", timeZoneName: "shortOffset" }} | ${"14:30–16:46"}
  `(
    "formats valid zoned datetime range for en-GB",
    ({ from, to, options, expected }) => {
      expect(formatZonedRange(from, to, MustTestLocales.enGB, options)).toBe(
        expected,
      );
    },
  );

  // de-DE
  it.each`
    from                                         | to                                         | options                                                                | expected
    ${rangeByLocale[MustTestLocales.deDE].start} | ${rangeByLocale[MustTestLocales.deDE].end} | ${{ dateStyle: "long", timeStyle: "long" }}                            | ${"3. Februar 2024, 14:30:45 MEZ – 16:46:15 MEZ"}
    ${rangeByLocale[MustTestLocales.deDE].start} | ${rangeByLocale[MustTestLocales.deDE].end} | ${{ dateStyle: "short", timeStyle: "short" }}                          | ${"03.02.24, 14:30–16:46 Uhr"}
    ${rangeByLocale[MustTestLocales.deDE].start} | ${rangeByLocale[MustTestLocales.deDE].end} | ${{ hour: "numeric", minute: "numeric", timeZoneName: "shortOffset" }} | ${"14:30–16:46 Uhr"}
  `(
    "formats valid zoned datetime range for de-DE",
    ({ from, to, options, expected }) => {
      expect(formatZonedRange(from, to, MustTestLocales.deDE, options)).toBe(
        expected,
      );
    },
  );

  // fr-FR
  it.each`
    from                                         | to                                         | options                                                                | expected
    ${rangeByLocale[MustTestLocales.frFR].start} | ${rangeByLocale[MustTestLocales.frFR].end} | ${{ dateStyle: "long", timeStyle: "long" }}                            | ${"3 février 2024, 14:30:45 UTC+1 – 16:46:15 UTC+1"}
    ${rangeByLocale[MustTestLocales.frFR].start} | ${rangeByLocale[MustTestLocales.frFR].end} | ${{ dateStyle: "short", timeStyle: "short" }}                          | ${"03/02/2024, 14:30 – 16:46"}
    ${rangeByLocale[MustTestLocales.frFR].start} | ${rangeByLocale[MustTestLocales.frFR].end} | ${{ hour: "numeric", minute: "numeric", timeZoneName: "shortOffset" }} | ${"14:30 – 16:46"}
  `(
    "formats valid zoned datetime range for fr-FR",
    ({ from, to, options, expected }) => {
      expect(formatZonedRange(from, to, MustTestLocales.frFR, options)).toBe(
        expected,
      );
    },
  );

  // es-ES
  it.each`
    from                                         | to                                         | options                                                                | expected
    ${rangeByLocale[MustTestLocales.esES].start} | ${rangeByLocale[MustTestLocales.esES].end} | ${{ dateStyle: "long", timeStyle: "long" }}                            | ${"3 de febrero de 2024, 14:30:45 CET – 16:46:15 CET"}
    ${rangeByLocale[MustTestLocales.esES].start} | ${rangeByLocale[MustTestLocales.esES].end} | ${{ dateStyle: "short", timeStyle: "short" }}                          | ${"3/2/24, 14:30–16:46"}
    ${rangeByLocale[MustTestLocales.esES].start} | ${rangeByLocale[MustTestLocales.esES].end} | ${{ hour: "numeric", minute: "numeric", timeZoneName: "shortOffset" }} | ${"14:30–16:46"}
  `(
    "formats valid zoned datetime range for es-ES",
    ({ from, to, options, expected }) => {
      expect(formatZonedRange(from, to, MustTestLocales.esES, options)).toBe(
        expected,
      );
    },
  );

  // it-IT
  it.each`
    from                                         | to                                         | options                                                                | expected
    ${rangeByLocale[MustTestLocales.itIT].start} | ${rangeByLocale[MustTestLocales.itIT].end} | ${{ dateStyle: "long", timeStyle: "long" }}                            | ${"3 febbraio 2024, 14:30:45 CET – 16:46:15 CET"}
    ${rangeByLocale[MustTestLocales.itIT].start} | ${rangeByLocale[MustTestLocales.itIT].end} | ${{ dateStyle: "short", timeStyle: "short" }}                          | ${"03/02/24, 14:30–16:46"}
    ${rangeByLocale[MustTestLocales.itIT].start} | ${rangeByLocale[MustTestLocales.itIT].end} | ${{ hour: "numeric", minute: "numeric", timeZoneName: "shortOffset" }} | ${"14:30–16:46"}
  `(
    "formats valid zoned datetime range for it-IT",
    ({ from, to, options, expected }) => {
      expect(formatZonedRange(from, to, MustTestLocales.itIT, options)).toBe(
        expected,
      );
    },
  );

  // pt-PT
  it.each`
    from                                         | to                                         | options                                                                | expected
    ${rangeByLocale[MustTestLocales.ptPT].start} | ${rangeByLocale[MustTestLocales.ptPT].end} | ${{ dateStyle: "long", timeStyle: "long" }}                            | ${"3 de fevereiro de 2024, 14:30:45 WET – 16:46:15 WET"}
    ${rangeByLocale[MustTestLocales.ptPT].start} | ${rangeByLocale[MustTestLocales.ptPT].end} | ${{ dateStyle: "short", timeStyle: "short" }}                          | ${"03/02/24, 14:30 – 16:46"}
    ${rangeByLocale[MustTestLocales.ptPT].start} | ${rangeByLocale[MustTestLocales.ptPT].end} | ${{ hour: "numeric", minute: "numeric", timeZoneName: "shortOffset" }} | ${"14:30 – 16:46"}
  `(
    "formats valid zoned datetime range for pt-PT",
    ({ from, to, options, expected }) => {
      expect(formatZonedRange(from, to, MustTestLocales.ptPT, options)).toBe(
        expected,
      );
    },
  );

  // sv-SE
  it.each`
    from                                         | to                                         | options                                                                | expected
    ${rangeByLocale[MustTestLocales.svSE].start} | ${rangeByLocale[MustTestLocales.svSE].end} | ${{ dateStyle: "long", timeStyle: "long" }}                            | ${"3 februari 2024 14:30:45 CET–16:46:15 CET"}
    ${rangeByLocale[MustTestLocales.svSE].start} | ${rangeByLocale[MustTestLocales.svSE].end} | ${{ dateStyle: "short", timeStyle: "short" }}                          | ${"2024-02-03 14:30–16:46"}
    ${rangeByLocale[MustTestLocales.svSE].start} | ${rangeByLocale[MustTestLocales.svSE].end} | ${{ hour: "numeric", minute: "numeric", timeZoneName: "shortOffset" }} | ${"14:30–16:46"}
  `(
    "formats valid zoned datetime range for sv-SE",
    ({ from, to, options, expected }) => {
      expect(formatZonedRange(from, to, MustTestLocales.svSE, options)).toBe(
        expected,
      );
    },
  );

  // is-IS
  it.each`
    from                                         | to                                         | options                                                                | expected
    ${rangeByLocale[MustTestLocales.isIS].start} | ${rangeByLocale[MustTestLocales.isIS].end} | ${{ dateStyle: "long", timeStyle: "long" }}                            | ${"3. febrúar 2024, 14:30:45 GMT+0 – 16:46:15 GMT+0"}
    ${rangeByLocale[MustTestLocales.isIS].start} | ${rangeByLocale[MustTestLocales.isIS].end} | ${{ dateStyle: "short", timeStyle: "short" }}                          | ${"3.2.2024, 14:30–16:46"}
    ${rangeByLocale[MustTestLocales.isIS].start} | ${rangeByLocale[MustTestLocales.isIS].end} | ${{ hour: "numeric", minute: "numeric", timeZoneName: "shortOffset" }} | ${"14:30–16:46"}
  `(
    "formats valid zoned datetime range for is-IS",
    ({ from, to, options, expected }) => {
      expect(formatZonedRange(from, to, MustTestLocales.isIS, options)).toBe(
        expected,
      );
    },
  );

  // zh-CN
  it.each`
    from                                         | to                                         | options                                                                | expected
    ${rangeByLocale[MustTestLocales.zhCN].start} | ${rangeByLocale[MustTestLocales.zhCN].end} | ${{ dateStyle: "long", timeStyle: "long" }}                            | ${"2024/2/3 GMT+8 14:30:45 – GMT+8 16:46:15"}
    ${rangeByLocale[MustTestLocales.zhCN].start} | ${rangeByLocale[MustTestLocales.zhCN].end} | ${{ dateStyle: "short", timeStyle: "short" }}                          | ${"2024/2/3 14:30–16:46"}
    ${rangeByLocale[MustTestLocales.zhCN].start} | ${rangeByLocale[MustTestLocales.zhCN].end} | ${{ hour: "numeric", minute: "numeric", timeZoneName: "shortOffset" }} | ${"14:30–16:46"}
  `(
    "formats valid zoned datetime range for zh-CN",
    ({ from, to, options, expected }) => {
      expect(formatZonedRange(from, to, MustTestLocales.zhCN, options)).toBe(
        expected,
      );
    },
  );

  // zh-TW
  it.each`
    from                                         | to                                         | options                                                                | expected
    ${rangeByLocale[MustTestLocales.zhTW].start} | ${rangeByLocale[MustTestLocales.zhTW].end} | ${{ dateStyle: "long", timeStyle: "long" }}                            | ${"2024/2/3 下午2:30:45 [GMT+8] – 下午4:46:15 [GMT+8]"}
    ${rangeByLocale[MustTestLocales.zhTW].start} | ${rangeByLocale[MustTestLocales.zhTW].end} | ${{ dateStyle: "short", timeStyle: "short" }}                          | ${"2024/2/3 下午2:30–4:46"}
    ${rangeByLocale[MustTestLocales.zhTW].start} | ${rangeByLocale[MustTestLocales.zhTW].end} | ${{ hour: "numeric", minute: "numeric", timeZoneName: "shortOffset" }} | ${"下午2:30至4:46"}
  `(
    "formats valid zoned datetime range for zh-TW",
    ({ from, to, options, expected }) => {
      expect(formatZonedRange(from, to, MustTestLocales.zhTW, options)).toBe(
        expected,
      );
    },
  );

  // ja-JP
  it.each`
    from                                         | to                                         | options                                                                | expected
    ${rangeByLocale[MustTestLocales.jaJP].start} | ${rangeByLocale[MustTestLocales.jaJP].end} | ${{ dateStyle: "long", timeStyle: "long" }}                            | ${"2024/2/3 14:30:45 JST～16:46:15 JST"}
    ${rangeByLocale[MustTestLocales.jaJP].start} | ${rangeByLocale[MustTestLocales.jaJP].end} | ${{ dateStyle: "short", timeStyle: "short" }}                          | ${"2024/02/03 14時30分～16時46分"}
    ${rangeByLocale[MustTestLocales.jaJP].start} | ${rangeByLocale[MustTestLocales.jaJP].end} | ${{ hour: "numeric", minute: "numeric", timeZoneName: "shortOffset" }} | ${"14時30分～16時46分"}
  `(
    "formats valid zoned datetime range for ja-JP",
    ({ from, to, options, expected }) => {
      expect(formatZonedRange(from, to, MustTestLocales.jaJP, options)).toBe(
        expected,
      );
    },
  );

  // ko-KR
  it.each`
    from                                         | to                                         | options                                                                | expected
    ${rangeByLocale[MustTestLocales.koKR].start} | ${rangeByLocale[MustTestLocales.koKR].end} | ${{ dateStyle: "long", timeStyle: "long" }}                            | ${"2024년 2월 3일 PM 2시 30분 45초 GMT+9 ~ PM 4시 46분 15초 GMT+9"}
    ${rangeByLocale[MustTestLocales.koKR].start} | ${rangeByLocale[MustTestLocales.koKR].end} | ${{ dateStyle: "short", timeStyle: "short" }}                          | ${"24. 2. 3. PM 2:30~4:46"}
    ${rangeByLocale[MustTestLocales.koKR].start} | ${rangeByLocale[MustTestLocales.koKR].end} | ${{ hour: "numeric", minute: "numeric", timeZoneName: "shortOffset" }} | ${"PM 2:30~4:46"}
  `(
    "formats valid zoned datetime range for ko-KR",
    ({ from, to, options, expected }) => {
      expect(formatZonedRange(from, to, MustTestLocales.koKR, options)).toBe(
        expected,
      );
    },
  );

  // ar-SA
  it.each`
    from                                         | to                                         | options                                                                | expected
    ${rangeByLocale[MustTestLocales.arSA].start} | ${rangeByLocale[MustTestLocales.arSA].end} | ${{ dateStyle: "long", timeStyle: "long" }}                            | ${"٣ فبراير ٢٠٢٤، ٢:٣٠:٤٥ م غرينتش+٣ – ٤:٤٦:١٥ م غرينتش+٣"}
    ${rangeByLocale[MustTestLocales.arSA].start} | ${rangeByLocale[MustTestLocales.arSA].end} | ${{ dateStyle: "short", timeStyle: "short" }}                          | ${"٣‏/٢‏/٢٠٢٤، ٢:٣٠–٤:٤٦ م"}
    ${rangeByLocale[MustTestLocales.arSA].start} | ${rangeByLocale[MustTestLocales.arSA].end} | ${{ hour: "numeric", minute: "numeric", timeZoneName: "shortOffset" }} | ${"٢:٣٠–٤:٤٦ م"}
  `(
    "formats valid zoned datetime range for ar-SA",
    ({ from, to, options, expected }) => {
      expect(formatZonedRange(from, to, MustTestLocales.arSA, options)).toBe(
        expected,
      );
    },
  );

  // he-IL
  it.each`
    from                                         | to                                         | options                                                                | expected
    ${rangeByLocale[MustTestLocales.heIL].start} | ${rangeByLocale[MustTestLocales.heIL].end} | ${{ dateStyle: "long", timeStyle: "long" }}                            | ${"3 בפברואר 2024, 14:30:45 GMT‎+2‎ – 16:46:15 GMT‎+2‎"}
    ${rangeByLocale[MustTestLocales.heIL].start} | ${rangeByLocale[MustTestLocales.heIL].end} | ${{ dateStyle: "short", timeStyle: "short" }}                          | ${"3.2.2024, 14:30–16:46"}
    ${rangeByLocale[MustTestLocales.heIL].start} | ${rangeByLocale[MustTestLocales.heIL].end} | ${{ hour: "numeric", minute: "numeric", timeZoneName: "shortOffset" }} | ${"14:30–16:46"}
  `(
    "formats valid zoned datetime range for he-IL",
    ({ from, to, options, expected }) => {
      expect(formatZonedRange(from, to, MustTestLocales.heIL, options)).toBe(
        expected,
      );
    },
  );

  // ru-RU
  it.each`
    from                                         | to                                         | options                                                                | expected
    ${rangeByLocale[MustTestLocales.ruRU].start} | ${rangeByLocale[MustTestLocales.ruRU].end} | ${{ dateStyle: "long", timeStyle: "long" }}                            | ${"3 февраля 2024 г., 14:30:45 GMT+3 – 16:46:15 GMT+3"}
    ${rangeByLocale[MustTestLocales.ruRU].start} | ${rangeByLocale[MustTestLocales.ruRU].end} | ${{ dateStyle: "short", timeStyle: "short" }}                          | ${"03.02.2024, 14:30–16:46"}
    ${rangeByLocale[MustTestLocales.ruRU].start} | ${rangeByLocale[MustTestLocales.ruRU].end} | ${{ hour: "numeric", minute: "numeric", timeZoneName: "shortOffset" }} | ${"14:30–16:46"}
  `(
    "formats valid zoned datetime range for ru-RU",
    ({ from, to, options, expected }) => {
      expect(formatZonedRange(from, to, MustTestLocales.ruRU, options)).toBe(
        expected,
      );
    },
  );

  // tr-TR
  it.each`
    from                                         | to                                         | options                                                                | expected
    ${rangeByLocale[MustTestLocales.trTR].start} | ${rangeByLocale[MustTestLocales.trTR].end} | ${{ dateStyle: "long", timeStyle: "long" }}                            | ${"3 Şubat 2024 14:30:45 GMT+3 – 16:46:15 GMT+3"}
    ${rangeByLocale[MustTestLocales.trTR].start} | ${rangeByLocale[MustTestLocales.trTR].end} | ${{ dateStyle: "short", timeStyle: "short" }}                          | ${"3.02.2024 14:30–16:46"}
    ${rangeByLocale[MustTestLocales.trTR].start} | ${rangeByLocale[MustTestLocales.trTR].end} | ${{ hour: "numeric", minute: "numeric", timeZoneName: "shortOffset" }} | ${"14:30–16:46"}
  `(
    "formats valid zoned datetime range for tr-TR",
    ({ from, to, options, expected }) => {
      expect(formatZonedRange(from, to, MustTestLocales.trTR, options)).toBe(
        expected,
      );
    },
  );
});
