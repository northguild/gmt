import { normalizeDateTime } from "../../internal";
import {
  expectDateTimeEqual,
  expectOneOfIcu,
  localeZonedRangeInputByLocale,
  MustTestLocales,
  oneOfIcu,
} from "../../test";
import { formatZonedRange } from "./formatZonedRange";

describe("formatZonedRange", () => {
  const rangeByLocale = localeZonedRangeInputByLocale;

  // en-US
  it.each`
    from                                             | to                                               | locale     | options                                                                 | expected                                                  | label
    ${"2024-02-29T10:00:00-05:00[America/New_York]"} | ${"2024-02-29T12:00:00-05:00[America/New_York]"} | ${"en-US"} | ${{ dateStyle: "long", timeStyle: "long" }}                             | ${"February 29, 2024, 10:00:00 AM EST – 12:00:00 PM EST"} | ${"dateStyle long, timeStyle long"}
    ${"2024-02-29T10:00:00-05:00[America/New_York]"} | ${"2024-02-29T12:00:00-05:00[America/New_York]"} | ${"en-US"} | ${{ dateStyle: "long", timeStyle: "short" }}                            | ${"February 29, 2024, 10:00 AM – 12:00 PM"}               | ${"dateStyle long, timeStyle short"}
    ${"2024-02-29T10:00:00-05:00[America/New_York]"} | ${"2024-02-29T12:00:00-05:00[America/New_York]"} | ${"en-US"} | ${{ dateStyle: "short", timeStyle: "short" }}                           | ${"2/29/24, 10:00 AM – 12:00 PM"}                         | ${"dateStyle short, timeStyle short"}
    ${"2024-02-29T10:00:00-05:00[America/New_York]"} | ${"2024-02-29T12:00:00-05:00[America/New_York]"} | ${"en-US"} | ${{ hour: "numeric", minute: "numeric", timeZoneName: "short" }}        | ${"10:00 AM – 12:00 PM EST"}                              | ${"timeZoneName short"}
    ${"2024-02-29T10:00:00-05:00[America/New_York]"} | ${"2024-02-29T12:00:00-05:00[America/New_York]"} | ${"en-US"} | ${{ hour: "numeric", minute: "numeric", timeZoneName: "long" }}         | ${"10:00 AM – 12:00 PM Eastern Standard Time"}            | ${"timeZoneName long"}
    ${"2024-02-29T10:00:00-05:00[America/New_York]"} | ${"2024-02-29T12:00:00-05:00[America/New_York]"} | ${"en-US"} | ${{ hour: "numeric", minute: "numeric", timeZoneName: "shortGeneric" }} | ${"10:00 AM – 12:00 PM ET"}                               | ${"timeZoneName shortGeneric"}
    ${"2024-02-29T10:00:00-05:00[America/New_York]"} | ${"2024-02-29T12:00:00-05:00[America/New_York]"} | ${"en-US"} | ${{ hour: "numeric", minute: "numeric", timeZoneName: "longGeneric" }}  | ${"10:00 AM – 12:00 PM Eastern Time"}                     | ${"timeZoneName longGeneric"}
    ${"2024-02-29T10:00:00-05:00[America/New_York]"} | ${"2024-02-29T12:00:00-05:00[America/New_York]"} | ${"en-US"} | ${{ hour: "numeric", minute: "numeric", timeZoneName: "shortOffset" }}  | ${"10:00 AM – 12:00 PM GMT-5"}                            | ${"timeZoneName shortOffset"}
    ${"2024-02-29T10:00:00-05:00[America/New_York]"} | ${"2024-02-29T12:00:00-05:00[America/New_York]"} | ${"en-US"} | ${{ hour: "numeric", minute: "numeric", timeZoneName: "longOffset" }}   | ${"10:00 AM – 12:00 PM GMT-05:00"}                        | ${"timeZoneName longOffset"}
    ${"2024-02-29T10:00:00-05:00[America/New_York]"} | ${"2024-02-29T12:00:00-05:00[America/New_York]"} | ${"en-US"} | ${{ dayPeriod: "narrow" }}                                              | ${"in the morning"}                                       | ${"dayPeriod narrow"}
    ${"2024-02-29T10:00:00-05:00[America/New_York]"} | ${"2024-02-29T12:00:00-05:00[America/New_York]"} | ${"en-US"} | ${{ dayPeriod: "short" }}                                               | ${"in the morning"}                                       | ${"dayPeriod short"}
    ${"2024-02-29T10:00:00-05:00[America/New_York]"} | ${"2024-02-29T12:00:00-05:00[America/New_York]"} | ${"en-US"} | ${{ dayPeriod: "long" }}                                                | ${"in the morning"}                                       | ${"dayPeriod long"}
    ${"2024-02-29T10:00:00-05:00[America/New_York]"} | ${"2024-02-29T12:00:00-05:00[America/New_York]"} | ${"en-US"} | ${{ formatMatcher: "basic" }}                                           | ${"2/29/2024, 10:00:00 AM – 12:00:00 PM"}                 | ${"formatMatcher basic"}
    ${"2024-02-29T10:00:00-05:00[America/New_York]"} | ${"2024-02-29T12:00:00-05:00[America/New_York]"} | ${"en-US"} | ${{ formatMatcher: "best fit" }}                                        | ${"2/29/2024, 10:00:00 AM – 12:00:00 PM"}                 | ${"formatMatcher best fit"}
  `(
    "formats a valid zoned datetime range correctly for locale $locale with $label",
    ({ from, to, locale, options, expected }) => {
      expect(formatZonedRange(from, to, locale, options)).toBe(
        normalizeDateTime(expected),
      );
    },
  );

  it.each`
    from                                             | to
    ${"2024-02-29T10:00:00-05:00[America/New_York]"} | ${"2024-02-29T12:00:00+01:00[Europe/Paris]"}
    ${"2024-02-29T10:00:00+00:00[UTC]"}              | ${"2024-02-29T12:00:00+09:00[Asia/Tokyo]"}
  `(
    "returns empty string when range endpoints use different timeZones: $from -> $to",
    ({ from, to }) => {
      expect(
        formatZonedRange(from, to, "en-US", {
          dateStyle: "long",
          timeStyle: "short",
        }),
      ).toBe("");
    },
  );

  // A ZonedDateTime is formatted in its own zone; a `timeZone` option is a
  // TypeError in Temporal (CreateDateTimeFormat with toLocaleStringTimeZone),
  // so it returns the sentinel rather than being silently overridden.
  it.each`
    options                                                                           | expected                     | reason
    ${{ hour: "numeric", minute: "numeric", timeZoneName: "short", timeZone: "UTC" }} | ${""}                        | ${"a timeZone option is rejected"}
    ${{ hour: "numeric", minute: "numeric", timeZoneName: "short" }}                  | ${"10:00 AM - 12:00 PM EST"} | ${"without it the endpoints' zone applies"}
  `(
    "formats a New York range with $options to '$expected' ($reason)",
    ({ options, expected }) => {
      expect(
        formatZonedRange(
          "2024-02-29T10:00:00-05:00[America/New_York]",
          "2024-02-29T12:00:00-05:00[America/New_York]",
          "en-US",
          options,
        ),
      ).toBe(expected);
    },
  );

  // en-GB
  it.each`
    from                                         | to                                         | options                                       | expected
    ${rangeByLocale[MustTestLocales.enGB].start} | ${rangeByLocale[MustTestLocales.enGB].end} | ${{ dateStyle: "long", timeStyle: "long" }}   | ${"3 February 2024, 14:30:45 GMT – 16:46:15 GMT"}
    ${rangeByLocale[MustTestLocales.enGB].start} | ${rangeByLocale[MustTestLocales.enGB].end} | ${{ dateStyle: "short", timeStyle: "short" }} | ${"03/02/2024, 14:30–16:46"}
  `(
    "formats valid zoned datetime range for en-GB with $options",
    ({ from, to, options, expected }) => {
      expect(formatZonedRange(from, to, MustTestLocales.enGB, options)).toBe(
        normalizeDateTime(expected),
      );
    },
  );

  // London in winter is "GMT+0" in CLDR 48 (ICU 78 on V8) and "GMT" on Firefox 155, whose single
  // format agrees with its range; a CLDR wording difference, not a range defect.
  it("formats en-GB shortOffset London as one of the known ICU variants", () => {
    expectOneOfIcu(
      formatZonedRange(
        rangeByLocale[MustTestLocales.enGB].start,
        rangeByLocale[MustTestLocales.enGB].end,
        MustTestLocales.enGB,
        { hour: "numeric", minute: "numeric", timeZoneName: "shortOffset" },
      ),
      oneOfIcu(
        normalizeDateTime("14:30–16:46 GMT+0"),
        normalizeDateTime("14:30–16:46 GMT"),
      ),
    );
  });

  // de-DE
  it.each`
    from                                         | to                                         | options                                                                | expected
    ${rangeByLocale[MustTestLocales.deDE].start} | ${rangeByLocale[MustTestLocales.deDE].end} | ${{ dateStyle: "long", timeStyle: "long" }}                            | ${"3. Februar 2024, 14:30:45 MEZ – 16:46:15 MEZ"}
    ${rangeByLocale[MustTestLocales.deDE].start} | ${rangeByLocale[MustTestLocales.deDE].end} | ${{ dateStyle: "short", timeStyle: "short" }}                          | ${"03.02.24, 14:30–16:46 Uhr"}
    ${rangeByLocale[MustTestLocales.deDE].start} | ${rangeByLocale[MustTestLocales.deDE].end} | ${{ hour: "numeric", minute: "numeric", timeZoneName: "shortOffset" }} | ${"14:30–16:46 Uhr GMT+1"}
  `(
    "formats valid zoned datetime range for de-DE with $options",
    ({ from, to, options, expected }) => {
      expect(formatZonedRange(from, to, MustTestLocales.deDE, options)).toBe(
        normalizeDateTime(expected),
      );
    },
  );

  // fr-FR
  it.each`
    from                                         | to                                         | options                                                                | expected
    ${rangeByLocale[MustTestLocales.frFR].start} | ${rangeByLocale[MustTestLocales.frFR].end} | ${{ dateStyle: "long", timeStyle: "long" }}                            | ${"3 février 2024, 14:30:45 UTC+1 – 16:46:15 UTC+1"}
    ${rangeByLocale[MustTestLocales.frFR].start} | ${rangeByLocale[MustTestLocales.frFR].end} | ${{ dateStyle: "short", timeStyle: "short" }}                          | ${"03/02/2024, 14:30 – 16:46"}
    ${rangeByLocale[MustTestLocales.frFR].start} | ${rangeByLocale[MustTestLocales.frFR].end} | ${{ hour: "numeric", minute: "numeric", timeZoneName: "shortOffset" }} | ${"14:30 – 16:46 UTC+1"}
  `(
    "formats valid zoned datetime range for fr-FR with $options",
    ({ from, to, options, expected }) => {
      expect(formatZonedRange(from, to, MustTestLocales.frFR, options)).toBe(
        normalizeDateTime(expected),
      );
    },
  );

  // es-ES
  it.each`
    from                                         | to                                         | options                                                                | expected
    ${rangeByLocale[MustTestLocales.esES].start} | ${rangeByLocale[MustTestLocales.esES].end} | ${{ dateStyle: "long", timeStyle: "long" }}                            | ${"3 de febrero de 2024, 14:30:45 CET – 16:46:15 CET"}
    ${rangeByLocale[MustTestLocales.esES].start} | ${rangeByLocale[MustTestLocales.esES].end} | ${{ dateStyle: "short", timeStyle: "short" }}                          | ${"3/2/24, 14:30–16:46"}
    ${rangeByLocale[MustTestLocales.esES].start} | ${rangeByLocale[MustTestLocales.esES].end} | ${{ hour: "numeric", minute: "numeric", timeZoneName: "shortOffset" }} | ${"14:30–16:46 GMT+1"}
  `(
    "formats valid zoned datetime range for es-ES with $options",
    ({ from, to, options, expected }) => {
      expect(formatZonedRange(from, to, MustTestLocales.esES, options)).toBe(
        normalizeDateTime(expected),
      );
    },
  );

  // it-IT
  it.each`
    from                                         | to                                         | options                                                                | expected
    ${rangeByLocale[MustTestLocales.itIT].start} | ${rangeByLocale[MustTestLocales.itIT].end} | ${{ dateStyle: "long", timeStyle: "long" }}                            | ${"3 febbraio 2024, 14:30:45 CET – 16:46:15 CET"}
    ${rangeByLocale[MustTestLocales.itIT].start} | ${rangeByLocale[MustTestLocales.itIT].end} | ${{ dateStyle: "short", timeStyle: "short" }}                          | ${"03/02/24, 14:30–16:46"}
    ${rangeByLocale[MustTestLocales.itIT].start} | ${rangeByLocale[MustTestLocales.itIT].end} | ${{ hour: "numeric", minute: "numeric", timeZoneName: "shortOffset" }} | ${"14:30–16:46 GMT+1"}
  `(
    "formats valid zoned datetime range for it-IT with $options",
    ({ from, to, options, expected }) => {
      expect(formatZonedRange(from, to, MustTestLocales.itIT, options)).toBe(
        normalizeDateTime(expected),
      );
    },
  );

  // pt-PT
  it.each`
    from                                         | to                                         | options                                                                | expected
    ${rangeByLocale[MustTestLocales.ptPT].start} | ${rangeByLocale[MustTestLocales.ptPT].end} | ${{ dateStyle: "long", timeStyle: "long" }}                            | ${"3 de fevereiro de 2024, 14:30:45 WET – 16:46:15 WET"}
    ${rangeByLocale[MustTestLocales.ptPT].start} | ${rangeByLocale[MustTestLocales.ptPT].end} | ${{ dateStyle: "short", timeStyle: "short" }}                          | ${"03/02/24, 14:30 – 16:46"}
    ${rangeByLocale[MustTestLocales.ptPT].start} | ${rangeByLocale[MustTestLocales.ptPT].end} | ${{ hour: "numeric", minute: "numeric", timeZoneName: "shortOffset" }} | ${"14:30 – 16:46 GMT+0"}
  `(
    "formats valid zoned datetime range for pt-PT with $options",
    ({ from, to, options, expected }) => {
      expect(formatZonedRange(from, to, MustTestLocales.ptPT, options)).toBe(
        normalizeDateTime(expected),
      );
    },
  );

  // sv-SE
  it.each`
    from                                         | to                                         | options                                                                | expected
    ${rangeByLocale[MustTestLocales.svSE].start} | ${rangeByLocale[MustTestLocales.svSE].end} | ${{ dateStyle: "long", timeStyle: "long" }}                            | ${"3 februari 2024 14:30:45 CET - 16:46:15 CET"}
    ${rangeByLocale[MustTestLocales.svSE].start} | ${rangeByLocale[MustTestLocales.svSE].end} | ${{ dateStyle: "short", timeStyle: "short" }}                          | ${"2024-02-03 14:30–16:46"}
    ${rangeByLocale[MustTestLocales.svSE].start} | ${rangeByLocale[MustTestLocales.svSE].end} | ${{ hour: "numeric", minute: "numeric", timeZoneName: "shortOffset" }} | ${"14:30–16:46 GMT+1"}
  `(
    "formats valid zoned datetime range for sv-SE with $options",
    ({ from, to, options, expected }) => {
      expect(formatZonedRange(from, to, MustTestLocales.svSE, options)).toBe(
        normalizeDateTime(expected),
      );
    },
  );

  // is-IS
  it.each`
    from                                         | to                                         | options                                                                | expected
    ${rangeByLocale[MustTestLocales.isIS].start} | ${rangeByLocale[MustTestLocales.isIS].end} | ${{ dateStyle: "short", timeStyle: "short" }}                          | ${"3.2.2024, 14:30–16:46"}
    ${rangeByLocale[MustTestLocales.isIS].start} | ${rangeByLocale[MustTestLocales.isIS].end} | ${{ hour: "numeric", minute: "numeric", timeZoneName: "shortOffset" }} | ${"14:30–16:46 GMT+0"}
  `(
    "formats valid zoned datetime range for is-IS with $options",
    ({ from, to, options, expected }) => {
      expect(formatZonedRange(from, to, MustTestLocales.isIS, options)).toBe(
        normalizeDateTime(expected),
      );
    },
  );

  // is-IS long/long GMT offset display — CLDR changed the UTC time zone
  // name from "GMT" (ICU 77 / Node 22.16–22.22) to "GMT+0" (ICU 78 / Node 22.23+, 24, 26).
  it("formats valid zoned datetime range for is-IS with dateStyle/timeStyle long as one of the known ICU variants", () => {
    expectOneOfIcu(
      formatZonedRange(
        rangeByLocale[MustTestLocales.isIS].start,
        rangeByLocale[MustTestLocales.isIS].end,
        MustTestLocales.isIS,
        { dateStyle: "long", timeStyle: "long" },
      ),
      oneOfIcu(
        normalizeDateTime("3. febrúar 2024, 14:30:45 GMT – 16:46:15 GMT"),
        normalizeDateTime("3. febrúar 2024, 14:30:45 GMT+0 – 16:46:15 GMT+0"),
      ),
    );
  });

  // zh-CN
  it.each`
    from                                         | to                                         | options                                                                | expected
    ${rangeByLocale[MustTestLocales.zhCN].start} | ${rangeByLocale[MustTestLocales.zhCN].end} | ${{ dateStyle: "long", timeStyle: "long" }}                            | ${"2024/2/3 GMT+8 14:30:45 – GMT+8 16:46:15"}
    ${rangeByLocale[MustTestLocales.zhCN].start} | ${rangeByLocale[MustTestLocales.zhCN].end} | ${{ dateStyle: "short", timeStyle: "short" }}                          | ${"2024/2/3 14:30–16:46"}
    ${rangeByLocale[MustTestLocales.zhCN].start} | ${rangeByLocale[MustTestLocales.zhCN].end} | ${{ hour: "numeric", minute: "numeric", timeZoneName: "shortOffset" }} | ${"GMT+8 14:30–16:46"}
  `(
    "formats valid zoned datetime range for zh-CN with $options",
    ({ from, to, options, expected }) => {
      expect(formatZonedRange(from, to, MustTestLocales.zhCN, options)).toBe(
        normalizeDateTime(expected),
      );
    },
  );

  // zh-TW
  it.each`
    from                                         | to                                         | options                                                                | expected
    ${rangeByLocale[MustTestLocales.zhTW].start} | ${rangeByLocale[MustTestLocales.zhTW].end} | ${{ dateStyle: "long", timeStyle: "long" }}                            | ${"2024/2/3 下午2:30:45 [GMT+8] – 下午4:46:15 [GMT+8]"}
    ${rangeByLocale[MustTestLocales.zhTW].start} | ${rangeByLocale[MustTestLocales.zhTW].end} | ${{ dateStyle: "short", timeStyle: "short" }}                          | ${"2024/2/3 下午2:30–4:46"}
    ${rangeByLocale[MustTestLocales.zhTW].start} | ${rangeByLocale[MustTestLocales.zhTW].end} | ${{ hour: "numeric", minute: "numeric", timeZoneName: "shortOffset" }} | ${"下午2:30至4:46 [GMT+8]"}
  `(
    "formats valid zoned datetime range for zh-TW with $options",
    ({ from, to, options, expected }) => {
      expectDateTimeEqual(
        formatZonedRange(from, to, MustTestLocales.zhTW, options),
        normalizeDateTime(expected),
      );
    },
  );

  // ja-JP
  it.each`
    from                                         | to                                         | options                                                                | expected
    ${rangeByLocale[MustTestLocales.jaJP].start} | ${rangeByLocale[MustTestLocales.jaJP].end} | ${{ dateStyle: "long", timeStyle: "long" }}                            | ${"2024/2/3 14:30:45 JST～16:46:15 JST"}
    ${rangeByLocale[MustTestLocales.jaJP].start} | ${rangeByLocale[MustTestLocales.jaJP].end} | ${{ dateStyle: "short", timeStyle: "short" }}                          | ${"2024/02/03 14時30分～16時46分"}
    ${rangeByLocale[MustTestLocales.jaJP].start} | ${rangeByLocale[MustTestLocales.jaJP].end} | ${{ hour: "numeric", minute: "numeric", timeZoneName: "shortOffset" }} | ${"14時30分～16時46分(GMT+9)"}
  `(
    "formats valid zoned datetime range for ja-JP with $options",
    ({ from, to, options, expected }) => {
      expect(formatZonedRange(from, to, MustTestLocales.jaJP, options)).toBe(
        normalizeDateTime(expected),
      );
    },
  );

  // ko-KR
  it.each`
    from                                         | to                                         | options                                                                | expected
    ${rangeByLocale[MustTestLocales.koKR].start} | ${rangeByLocale[MustTestLocales.koKR].end} | ${{ dateStyle: "long", timeStyle: "long" }}                            | ${"2024년 2월 3일 오후 2시 30분 45초 GMT+9 ~ 오후 4시 46분 15초 GMT+9"}
    ${rangeByLocale[MustTestLocales.koKR].start} | ${rangeByLocale[MustTestLocales.koKR].end} | ${{ dateStyle: "short", timeStyle: "short" }}                          | ${"24. 2. 3. 오후 2:30~4:46"}
    ${rangeByLocale[MustTestLocales.koKR].start} | ${rangeByLocale[MustTestLocales.koKR].end} | ${{ hour: "numeric", minute: "numeric", timeZoneName: "shortOffset" }} | ${"오후 2:30~4:46 GMT+9"}
  `(
    "formats valid zoned datetime range for ko-KR with $options",
    ({ from, to, options, expected }) => {
      expectDateTimeEqual(
        formatZonedRange(from, to, MustTestLocales.koKR, options),
        normalizeDateTime(expected),
      );
    },
  );

  // ar-SA
  it.each`
    from                                         | to                                         | options                                                                | expected
    ${rangeByLocale[MustTestLocales.arSA].start} | ${rangeByLocale[MustTestLocales.arSA].end} | ${{ dateStyle: "long", timeStyle: "long" }}                            | ${"٣ فبراير ٢٠٢٤، ٢:٣٠:٤٥ م غرينتش+٣ – ٤:٤٦:١٥ م غرينتش+٣"}
    ${rangeByLocale[MustTestLocales.arSA].start} | ${rangeByLocale[MustTestLocales.arSA].end} | ${{ dateStyle: "short", timeStyle: "short" }}                          | ${"٣/٢/٢٠٢٤، ٢:٣٠–٤:٤٦ م"}
    ${rangeByLocale[MustTestLocales.arSA].start} | ${rangeByLocale[MustTestLocales.arSA].end} | ${{ hour: "numeric", minute: "numeric", timeZoneName: "shortOffset" }} | ${"٢:٣٠–٤:٤٦ م غرينتش+٣"}
  `(
    "formats valid zoned datetime range for ar-SA with $options",
    ({ from, to, options, expected }) => {
      expect(formatZonedRange(from, to, MustTestLocales.arSA, options)).toBe(
        normalizeDateTime(expected),
      );
    },
  );

  // he-IL
  it.each`
    from                                         | to                                         | options                                                                | expected
    ${rangeByLocale[MustTestLocales.heIL].start} | ${rangeByLocale[MustTestLocales.heIL].end} | ${{ dateStyle: "long", timeStyle: "long" }}                            | ${"3 בפברואר 2024, 14:30:45 GMT\u200E+2\u200E – 16:46:15 GMT\u200E+2\u200E"}
    ${rangeByLocale[MustTestLocales.heIL].start} | ${rangeByLocale[MustTestLocales.heIL].end} | ${{ dateStyle: "short", timeStyle: "short" }}                          | ${"3.2.2024, 14:30–16:46"}
    ${rangeByLocale[MustTestLocales.heIL].start} | ${rangeByLocale[MustTestLocales.heIL].end} | ${{ hour: "numeric", minute: "numeric", timeZoneName: "shortOffset" }} | ${"14:30–16:46 GMT\u200E+2\u200E"}
  `(
    "formats valid zoned datetime range for he-IL with $options",
    ({ from, to, options, expected }) => {
      expect(formatZonedRange(from, to, MustTestLocales.heIL, options)).toBe(
        normalizeDateTime(expected),
      );
    },
  );

  // ru-RU
  it.each`
    from                                         | to                                         | options                                                                | expected
    ${rangeByLocale[MustTestLocales.ruRU].start} | ${rangeByLocale[MustTestLocales.ruRU].end} | ${{ dateStyle: "long", timeStyle: "long" }}                            | ${"3 февраля 2024 г., 14:30:45 GMT+3 – 16:46:15 GMT+3"}
    ${rangeByLocale[MustTestLocales.ruRU].start} | ${rangeByLocale[MustTestLocales.ruRU].end} | ${{ dateStyle: "short", timeStyle: "short" }}                          | ${"03.02.2024, 14:30–16:46"}
    ${rangeByLocale[MustTestLocales.ruRU].start} | ${rangeByLocale[MustTestLocales.ruRU].end} | ${{ hour: "numeric", minute: "numeric", timeZoneName: "shortOffset" }} | ${"14:30–16:46 GMT+3"}
  `(
    "formats valid zoned datetime range for ru-RU with $options",
    ({ from, to, options, expected }) => {
      expect(formatZonedRange(from, to, MustTestLocales.ruRU, options)).toBe(
        normalizeDateTime(expected),
      );
    },
  );

  // tr-TR
  it.each`
    from                                         | to                                         | options                                                                | expected
    ${rangeByLocale[MustTestLocales.trTR].start} | ${rangeByLocale[MustTestLocales.trTR].end} | ${{ dateStyle: "long", timeStyle: "long" }}                            | ${"3 Şubat 2024 14:30:45 GMT+3 – 16:46:15 GMT+3"}
    ${rangeByLocale[MustTestLocales.trTR].start} | ${rangeByLocale[MustTestLocales.trTR].end} | ${{ dateStyle: "short", timeStyle: "short" }}                          | ${"3.02.2024 14:30–16:46"}
    ${rangeByLocale[MustTestLocales.trTR].start} | ${rangeByLocale[MustTestLocales.trTR].end} | ${{ hour: "numeric", minute: "numeric", timeZoneName: "shortOffset" }} | ${"14:30–16:46 GMT+3"}
  `(
    "formats valid zoned datetime range for tr-TR with $options",
    ({ from, to, options, expected }) => {
      expect(formatZonedRange(from, to, MustTestLocales.trTR, options)).toBe(
        normalizeDateTime(expected),
      );
    },
  );

  // Temporal ECMA-402 Instant format (GetDateTimeFormat ~any~, ~all~, ~all~)
  // in the endpoints' own zone: requested widths are kept and `era` alone
  // still gets the date and time defaults. Expected values: native
  // Intl.DateTimeFormat#formatRange in America/New_York with the adjusted
  // options.
  it.each`
    locale                  | options                               | expected                                           | reason
    ${MustTestLocales.zhCN} | ${{ year: "numeric", month: "long" }} | ${"2024年2月"}                                     | ${"requested long month kept"}
    ${MustTestLocales.enUS} | ${{ era: "long" }}                    | ${"2/3/2024 Anno Domini, 2:30:45 PM - 3:30:45 PM"} | ${"era alone gets the date and time defaults"}
  `(
    "formats 14:30:45 to 15:30:45 in America/New_York in $locale with $options to $expected ($reason)",
    ({ locale, options, expected }) => {
      expect(
        formatZonedRange(
          "2024-02-03T14:30:45-05:00[America/New_York]",
          "2024-02-03T15:30:45-05:00[America/New_York]",
          locale,
          options,
        ),
      ).toBe(expected);
    },
  );

  // ECMA-402 CanonicalizeLocaleList: `locale` may be a preference list; the first tag with locale data
  // is used, and a malformed tag anywhere in the list is invalid input. Expected strings from native
  // Intl with the same list.
  it.each`
    locale                                          | expected
    ${[MustTestLocales.frFR, MustTestLocales.enUS]} | ${"03/02/2024, 14:30 – 16:46"}
    ${[MustTestLocales.frFR, "not a locale!!"]}     | ${""}
  `("returns '$expected' for locale list $locale", ({ locale, expected }) => {
    expect(
      formatZonedRange(
        "2024-02-03T14:30:45+01:00[Europe/Paris]",
        "2024-02-03T16:46:15+01:00[Europe/Paris]",
        locale,
        { dateStyle: "short", timeStyle: "short" },
      ),
    ).toBe(normalizeDateTime(expected));
  });
  // Flexible day periods in a non-English locale, read from the engine: es with an h12 hour cycle
  // keeps each endpoint whole, zh-TW with the default cycle puts the period before the hour.
  it.each`
    locale     | from                                             | to                                               | options                                                                                   | expected
    ${"es"}    | ${"2024-02-29T05:00:00-05:00[America/New_York]"} | ${"2024-02-29T10:00:00-05:00[America/New_York]"} | ${{ hour: "numeric", dayPeriod: "short", timeZoneName: "shortOffset", hourCycle: "h12" }} | ${"5 de la madrugada GMT-5 - 10 de la mañana GMT-5"}
    ${"zh-TW"} | ${"2024-02-29T05:00:00-05:00[America/New_York]"} | ${"2024-02-29T15:00:00-05:00[America/New_York]"} | ${{ hour: "numeric", dayPeriod: "short", timeZoneName: "shortOffset" }}                   | ${"清晨5 GMT-5 - 下午3 GMT-5"}
  `(
    "formats $locale with $options to $expected",
    ({ locale, from, to, options, expected }) => {
      expectDateTimeEqual(
        formatZonedRange(from, to, locale, options),
        normalizeDateTime(expected),
      );
    },
  );

  // A formatter the engine rejects is invalid input, also when the repair is the code that asks:
  // dateStyle with a zone name, and an hour that is not a width, are TypeError and RangeError.
  it.each`
    options
    ${{ hour: "numeric", minute: "numeric", timeZoneName: "long", dateStyle: "short" }}
    ${{ timeZoneName: "long", hour: "bogus" }}
  `("returns an empty string for $options", ({ options }) => {
    expect(
      formatZonedRange(
        "2024-02-29T10:00:00-05:00[America/New_York]",
        "2024-02-29T12:00:00-05:00[America/New_York]",
        "en-US",
        options,
      ),
    ).toBe("");
  });
});

// Plan #14: ECMA-402 CoerceOptionsToObject throws TypeError for null options (native Chromium 153
// `new Intl.DateTimeFormat("en-US", null)`), so null is invalid input.
describe("formatZonedRange with null options", () => {
  it("returns an empty string for options null", () => {
    expect(
      formatZonedRange(
        "2024-02-03T14:30:00-05:00[America/New_York]",
        "2024-02-05T17:00:00-05:00[America/New_York]",
        MustTestLocales.enUS,
        null as never,
      ),
    ).toBe("");
  });
});

// ECMA-402 GetOption step 1 is Get(options, property), which follows the prototype chain, so an
// inherited option is read exactly as the same option held as an own property. Here the date is 15
// March 2024, a Friday, so dateStyle "full" in en-US names the weekday.
describe("formatZonedRange with inherited options", () => {
  it.each`
    label          | options
    ${"own"}       | ${{ dateStyle: "full" }}
    ${"inherited"} | ${Object.create({ dateStyle: "full" })}
  `(
    "formats with $label options { dateStyle: 'full' }, an inherited option being read like an own one (1.17 ignored an inherited option: 3/15/2024 - 3/17/2024)",
    ({ options }) => {
      expect(
        formatZonedRange(
          "2024-03-15T20:00:00+00:00[UTC]",
          "2024-03-17T20:00:00+00:00[UTC]",
          "en-US",
          options,
        ),
      ).toBe("Friday, March 15 - Sunday, March 17, 2024");
    },
  );
});

// ECMA-402 GetOption converts an option to a string once (ToString, step 2 after the one Get), so
// an object option is asked for its value once and that answer is both checked and used: a long
// month and a numeric day in en-US are "March 15"; a second ToString would answer "narrow" and
// print "M 15".
describe("formatZonedRange with an option that is an object", () => {
  it("calls month.toString() once and formats with its first answer, long", () => {
    let coercions = 0;
    const month = {
      toString() {
        coercions += 1;
        return coercions === 1 ? "long" : "narrow";
      },
    };
    const out = formatZonedRange(
      "2024-03-15T20:00:00+00:00[UTC]",
      "2024-03-17T20:00:00+00:00[UTC]",
      "en-US",
      { month, day: "numeric" } as never,
    );
    expect({ out, coercions }).toEqual({ out: "March 15 - 17", coercions: 1 });
  });
});

// The requested timeZoneName style is kept in a range (UTS #35 Matching Skeletons expects skeleton
// and pattern fields adjusted in parallel; ECMA-402 §11.5.8 prints a range part with the range
// pattern's own fields). V8 and JSC cut long/longGeneric to short and drop the offset styles
// (ICU-20548). When the offsets differ the shared zone part names the endpoint the engine printed:
// the end in en and de, the start in zh-CN. Expected values are real engine output (Firefox 155,
// which carries the ICU-20548 patch, and Node 22/24/26 once repaired).
describe("formatZonedRange keeps the requested timeZoneName style", () => {
  const hm = { hour: "numeric", minute: "numeric" } as const;

  it.each`
    from                                                | to                                                  | locale     | extra                                         | expected
    ${"2024-03-10T01:00:00-05:00[America/New_York]"}    | ${"2024-03-10T03:30:00-04:00[America/New_York]"}    | ${"en-US"} | ${{ timeZoneName: "long" }}                   | ${"1:00 – 3:30 AM Eastern Daylight Time"}
    ${"2024-03-10T01:00:00-05:00[America/New_York]"}    | ${"2024-03-10T03:30:00-04:00[America/New_York]"}    | ${"en-US"} | ${{ timeZoneName: "longGeneric" }}            | ${"1:00 – 3:30 AM Eastern Time"}
    ${"2024-03-10T01:00:00-05:00[America/New_York]"}    | ${"2024-03-10T03:30:00-04:00[America/New_York]"}    | ${"en-US"} | ${{ timeZoneName: "shortOffset" }}            | ${"1:00 – 3:30 AM GMT-4"}
    ${"2024-03-10T01:00:00-05:00[America/New_York]"}    | ${"2024-03-10T03:30:00-04:00[America/New_York]"}    | ${"en-US"} | ${{ timeZoneName: "longOffset" }}             | ${"1:00 – 3:30 AM GMT-04:00"}
    ${"2024-03-31T01:30:00+01:00[Europe/Berlin]"}       | ${"2024-03-31T03:30:00+02:00[Europe/Berlin]"}       | ${"de"}    | ${{ timeZoneName: "long" }}                   | ${"01:30–03:30 Uhr Mitteleuropäische Sommerzeit"}
    ${"2024-03-31T01:30:00+01:00[Europe/Berlin]"}       | ${"2024-03-31T03:30:00+02:00[Europe/Berlin]"}       | ${"de"}    | ${{ timeZoneName: "longGeneric" }}            | ${"01:30–03:30 Uhr Mitteleuropäische Zeit"}
    ${"2024-03-31T01:30:00+01:00[Europe/Berlin]"}       | ${"2024-03-31T03:30:00+02:00[Europe/Berlin]"}       | ${"de"}    | ${{ timeZoneName: "shortOffset" }}            | ${"01:30–03:30 Uhr GMT+2"}
    ${"2024-03-31T01:30:00+01:00[Europe/Berlin]"}       | ${"2024-03-31T03:30:00+02:00[Europe/Berlin]"}       | ${"de"}    | ${{ timeZoneName: "longOffset" }}             | ${"01:30–03:30 Uhr GMT+02:00"}
    ${"2024-03-31T01:30:00+01:00[Europe/Berlin]"}       | ${"2024-03-31T03:30:00+02:00[Europe/Berlin]"}       | ${"zh-CN"} | ${{ timeZoneName: "long" }}                   | ${"中欧标准时间 01:30–03:30"}
    ${"2024-03-31T01:30:00+01:00[Europe/Berlin]"}       | ${"2024-03-31T03:30:00+02:00[Europe/Berlin]"}       | ${"zh-CN"} | ${{ timeZoneName: "longGeneric" }}            | ${"中欧时间 01:30–03:30"}
    ${"2024-03-31T01:30:00+01:00[Europe/Berlin]"}       | ${"2024-03-31T03:30:00+02:00[Europe/Berlin]"}       | ${"zh-CN"} | ${{ timeZoneName: "shortOffset" }}            | ${"GMT+1 01:30–03:30"}
    ${"2024-04-07T01:00:00+11:00[Australia/Lord_Howe]"} | ${"2024-04-07T02:30:00+10:30[Australia/Lord_Howe]"} | ${"en-AU"} | ${{ timeZoneName: "long" }}                   | ${"1:00 – 2:30 am Lord Howe Standard Time"}
    ${"2024-02-29T10:00:00-05:00[America/New_York]"}    | ${"2024-02-29T14:00:00-05:00[America/New_York]"}    | ${"en-US"} | ${{ timeZoneName: "shortOffset" }}            | ${"10:00 AM – 2:00 PM GMT-5"}
    ${"2024-02-29T10:00:00-05:00[America/New_York]"}    | ${"2024-02-29T12:00:00-05:00[America/New_York]"}    | ${"en-US"} | ${{ timeZoneName: "long", hourCycle: "h23" }} | ${"10:00 – 12:00 Eastern Standard Time"}
    ${"2024-02-29T10:30:00+05:30[Asia/Kolkata]"}        | ${"2024-02-29T12:30:00+05:30[Asia/Kolkata]"}        | ${"en-IN"} | ${{ timeZoneName: "long" }}                   | ${"10:30 am – 12:30 pm India Standard Time"}
    ${"2024-02-29T10:30:00+05:30[Asia/Kolkata]"}        | ${"2024-02-29T12:30:00+05:30[Asia/Kolkata]"}        | ${"en-IN"} | ${{ timeZoneName: "shortOffset" }}            | ${"10:30 am – 12:30 pm GMT+5:30"}
    ${"2024-02-29T10:00:00+00:00[UTC]"}                 | ${"2024-02-29T12:00:00+00:00[UTC]"}                 | ${"en-US"} | ${{ timeZoneName: "long" }}                   | ${"10:00 AM – 12:00 PM Coordinated Universal Time"}
    ${"2024-02-29T10:00:00+00:00[UTC]"}                 | ${"2024-02-29T12:00:00+00:00[UTC]"}                 | ${"en-US"} | ${{ timeZoneName: "longGeneric" }}            | ${"10:00 AM – 12:00 PM GMT+00:00"}
    ${"2024-02-29T10:00:00+00:00[UTC]"}                 | ${"2024-02-29T12:00:00+00:00[UTC]"}                 | ${"en-US"} | ${{ timeZoneName: "shortOffset" }}            | ${"10:00 AM – 12:00 PM GMT+0"}
    ${"2024-02-29T10:00:00+05:30[+05:30]"}              | ${"2024-02-29T12:00:00+05:30[+05:30]"}              | ${"en-US"} | ${{ timeZoneName: "long" }}                   | ${"10:00 AM – 12:00 PM GMT+05:30"}
    ${"2024-02-29T10:00:00+05:30[+05:30]"}              | ${"2024-02-29T12:00:00+05:30[+05:30]"}              | ${"en-US"} | ${{ timeZoneName: "shortOffset" }}            | ${"10:00 AM – 12:00 PM GMT+5:30"}
    ${"2024-03-09T10:00:00-05:00[America/New_York]"}    | ${"2024-03-11T12:00:00-04:00[America/New_York]"}    | ${"en-US"} | ${{ timeZoneName: "long" }}                   | ${"3/9/2024, 10:00 AM Eastern Standard Time - 3/11/2024, 12:00 PM Eastern Daylight Time"}
    ${"2024-03-09T10:00:00-05:00[America/New_York]"}    | ${"2024-03-11T12:00:00-04:00[America/New_York]"}    | ${"en-US"} | ${{ timeZoneName: "shortOffset" }}            | ${"3/9/2024, 10:00 AM GMT-5 - 3/11/2024, 12:00 PM GMT-4"}
    ${"2024-03-09T10:00:00-05:00[America/New_York]"}    | ${"2024-03-11T12:00:00-04:00[America/New_York]"}    | ${"en-US"} | ${{ timeZoneName: "longOffset" }}             | ${"3/9/2024, 10:00 AM GMT-05:00 - 3/11/2024, 12:00 PM GMT-04:00"}
    ${"2024-03-09T10:00:00-05:00[America/New_York]"}    | ${"2024-03-11T12:00:00-04:00[America/New_York]"}    | ${"en-US"} | ${{ timeZoneName: "shortGeneric" }}           | ${"3/9/2024, 10:00 AM ET - 3/11/2024, 12:00 PM ET"}
    ${"2024-02-29T10:00:00-05:00[America/New_York]"}    | ${"2024-02-29T12:00:00-05:00[America/New_York]"}    | ${"en-US"} | ${{ timeZoneName: "shortGeneric" }}           | ${"10:00 AM - 12:00 PM ET"}
  `(
    "formats $from to $to in $locale with $extra to $expected",
    ({ from, to, locale, extra, expected }) => {
      expectDateTimeEqual(
        formatZonedRange(from, to, locale, { ...hm, ...extra }),
        normalizeDateTime(expected),
      );
    },
  );

  it.each`
    from                                             | to                                               | options                                                                                    | expected
    ${"2024-02-29T10:00:00-05:00[America/New_York]"} | ${"2024-02-29T10:00:00-05:00[America/New_York]"} | ${{ hour: "numeric", minute: "numeric", timeZoneName: "long" }}                            | ${"10:00 AM Eastern Standard Time"}
    ${"2024-02-29T10:00:00-05:00[America/New_York]"} | ${"2024-02-29T10:00:00-05:00[America/New_York]"} | ${{ hour: "numeric", minute: "numeric", timeZoneName: "shortOffset" }}                     | ${"10:00 AM GMT-5"}
    ${"2024-02-03T10:00:00-05:00[America/New_York]"} | ${"2024-02-05T10:00:00-05:00[America/New_York]"} | ${{ year: "numeric", month: "long", day: "numeric", timeZoneName: "shortOffset" }}         | ${"February 3, 2024 at GMT-5 – February 5, 2024 at GMT-5"}
    ${"2024-02-03T10:00:00-05:00[America/New_York]"} | ${"2024-02-05T10:00:00-05:00[America/New_York]"} | ${{ year: "numeric", month: "long", day: "numeric", timeZoneName: "long" }}                | ${"February 3, 2024 at Eastern Standard Time – February 5, 2024 at Eastern Standard Time"}
    ${"2024-02-29T10:00:00-05:00[America/New_York]"} | ${"2024-02-29T12:00:00-05:00[America/New_York]"} | ${{ hour: "numeric", dayPeriod: "short", timeZoneName: "shortOffset" }}                    | ${"10 in the morning GMT-5 – 12 noon GMT-5"}
    ${"2024-02-29T10:00:00-05:00[America/New_York]"} | ${"2024-02-29T12:00:00-05:00[America/New_York]"} | ${{ hour: "numeric", dayPeriod: "short", timeZoneName: "short" }}                          | ${"10 in the morning EST – 12 noon EST"}
    ${"2024-02-29T10:00:00-05:00[America/New_York]"} | ${"2024-02-29T12:00:00-05:00[America/New_York]"} | ${{ hour: "numeric", dayPeriod: "short", timeZoneName: "long" }}                           | ${"10 in the morning Eastern Standard Time – 12 noon Eastern Standard Time"}
    ${"2024-02-29T10:00:00-05:00[America/New_York]"} | ${"2024-02-29T12:00:00-05:00[America/New_York]"} | ${{ hour: "numeric", minute: "numeric", dayPeriod: "short", timeZoneName: "shortOffset" }} | ${"10:00 in the morning GMT-5 – 12:00 noon GMT-5"}
    ${"2024-02-29T10:00:00-05:00[America/New_York]"} | ${"2024-02-29T12:00:00-05:00[America/New_York]"} | ${{ hour: "numeric", dayPeriod: "short", timeZoneName: "shortOffset", hourCycle: "h12" }}  | ${"10 in the morning GMT-5 – 12 noon GMT-5"}
    ${"2024-02-28T10:00:00-05:00[America/New_York]"} | ${"2024-02-29T12:00:00-05:00[America/New_York]"} | ${{ hour: "numeric", dayPeriod: "short", timeZoneName: "shortOffset" }}                    | ${"2/28/2024, 10 in the morning GMT-5 – 2/29/2024, 12 noon GMT-5"}
  `(
    "formats $from to $to with $options to $expected",
    ({ from, to, options, expected }) => {
      expect(formatZonedRange(from, to, "en-US", options)).toBe(
        normalizeDateTime(expected),
      );
    },
  );

  // Output without a width to repair stays what the engine prints.
  it.each`
    from                                             | to                                               | options                                                                            | expected
    ${"2024-02-29T10:00:00-05:00[America/New_York]"} | ${"2024-02-29T12:00:00-05:00[America/New_York]"} | ${{ hour: "numeric", minute: "numeric", second: "numeric", timeZoneName: "long" }} | ${"10:00:00 AM Eastern Standard Time – 12:00:00 PM Eastern Standard Time"}
    ${"2024-02-29T10:00:00-05:00[America/New_York]"} | ${"2024-03-02T12:00:00-05:00[America/New_York]"} | ${{ hour: "numeric", minute: "numeric", timeZoneName: "short" }}                   | ${"2/29/2024, 10:00 AM EST – 3/2/2024, 12:00 PM EST"}
    ${"2024-02-29T10:00:00-05:00[America/New_York]"} | ${"2024-02-29T12:00:00-05:00[America/New_York]"} | ${{ hour: "numeric", minute: "numeric" }}                                          | ${"10:00 AM – 12:00 PM"}
    ${"2024-02-29T10:00:00-05:00[America/New_York]"} | ${"2024-02-29T12:00:00-05:00[America/New_York]"} | ${{ dateStyle: "short", timeStyle: "short" }}                                      | ${"2/29/24, 10:00 AM – 12:00 PM"}
  `(
    "keeps $options for $from to $to as $expected",
    ({ from, to, options, expected }) => {
      expect(formatZonedRange(from, to, "en-US", options)).toBe(
        normalizeDateTime(expected),
      );
    },
  );
});
