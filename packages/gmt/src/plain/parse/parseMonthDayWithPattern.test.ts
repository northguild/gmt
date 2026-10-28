import { MustTestLocales } from "../../test";
import { mockTemporalPlainMonthDayFromThrow } from "../../test/mocks";
import { hostileProxy, revokedProxy } from "../../test/hostileValues";
import { utcMs } from "../../test/utcMs";
import { isValidMonthDay } from "../validate";
import { parseMonthDayWithPattern } from "./parseMonthDayWithPattern";

describe("parseMonthDayWithPattern", () => {
  describe("numeric tokens and rules", () => {
    it.each`
      label                             | value                       | pattern           | locale                  | expected
      ${"no locale"}                    | ${"12-25"}                  | ${"MM-dd"}        | ${undefined}            | ${"--12-25"}
      ${"no locale"}                    | ${"25/12"}                  | ${"dd/MM"}        | ${undefined}            | ${"--12-25"}
      ${"no locale"}                    | ${"2/29"}                   | ${"M/d"}          | ${undefined}            | ${"--02-29"}
      ${"no locale"}                    | ${"2/30"}                   | ${"M/d"}          | ${undefined}            | ${""}
      ${"no locale"}                    | ${"4/31"}                   | ${"M/d"}          | ${undefined}            | ${""}
      ${"no locale"}                    | ${"11/31"}                  | ${"M/d"}          | ${undefined}            | ${""}
      ${"no locale"}                    | ${"13/01"}                  | ${"MM/dd"}        | ${undefined}            | ${""}
      ${"no locale"}                    | ${"12-25"}                  | ${"LL-dd"}        | ${undefined}            | ${"--12-25"}
      ${"no locale"}                    | ${"December 25"}            | ${"MMMM d"}       | ${undefined}            | ${"--12-25"}
      ${"a preference list"}            | ${"25 décembre"}            | ${"d MMMM"}       | ${["fr-FR", "en-US"]}   | ${"--12-25"}
      ${"locale ru-RU"}                 | ${"25 декабрь"}             | ${"d MMMM"}       | ${"ru-RU"}              | ${"--12-25"}
      ${"locale ru-RU"}                 | ${"25 декабря"}             | ${"d LLLL"}       | ${"ru-RU"}              | ${"--12-25"}
      ${"locale ru-RU"}                 | ${"29 февраля"}             | ${"d MMMM"}       | ${"ru-RU"}              | ${"--02-29"}
      ${"locale ru-RU"}                 | ${"30 февраля"}             | ${"d MMMM"}       | ${"ru-RU"}              | ${""}
      ${"locale ru-RU"}                 | ${"31 апреля"}              | ${"d MMMM"}       | ${"ru-RU"}              | ${""}
      ${"locale zh-CN"}                 | ${"十二月25日"}             | ${"MMMMd日"}      | ${"zh-CN"}              | ${"--12-25"}
      ${"locale fr-FR"}                 | ${"25 décembre 2024"}       | ${"d MMMM yyyy"}  | ${"fr-FR"}              | ${""}
      ${"locale en-US"}                 | ${"Wednesday, December 25"} | ${"EEEE, MMMM d"} | ${"en-US"}              | ${""}
      ${"locale en-US"}                 | ${"AD 12-25"}               | ${"GG MM-dd"}     | ${"en-US"}              | ${""}
      ${"no locale"}                    | ${"10:30 12-25"}            | ${"HH:mm MM-dd"}  | ${undefined}            | ${""}
      ${"no locale"}                    | ${"12"}                     | ${"MM"}           | ${undefined}            | ${""}
      ${"no locale"}                    | ${"25"}                     | ${"dd"}           | ${undefined}            | ${""}
      ${"locale en-US"}                 | ${"25 décembre"}            | ${"d MMMM"}       | ${"en-US"}              | ${""}
      ${"locale fr-FR"}                 | ${"25 decembre"}            | ${"d MMMM"}       | ${"fr-FR"}              | ${""}
      ${"locale not-a-locale-!!"}       | ${"Dec 25"}                 | ${"MMM d"}        | ${"not-a-locale-!!"}    | ${""}
      ${"locale es-ES"}                 | ${"25 de diciembre"}        | ${"d 'de MMMM"}   | ${"es-ES"}              | ${""}
      ${"no locale"}                    | ${""}                       | ${"MM-dd"}        | ${undefined}            | ${""}
      ${"mixed-case month name"}        | ${"december 25"}            | ${"MMMM d"}       | ${undefined}            | ${"--12-25"}
      ${"upper-case Cyrillic name"}     | ${"25 МАРТА"}               | ${"d MMMM"}       | ${"ru-RU"}              | ${"--03-25"}
      ${"upper-case German name"}       | ${"25. MÄRZ"}               | ${"d. MMM"}       | ${"de-DE"}              | ${"--03-25"}
      ${"islamic extension overridden"} | ${"September 1"}            | ${"MMMM d"}       | ${"en-u-ca-islamic"}    | ${"--09-01"}
      ${"islamic month name"}           | ${"Ramadan 1"}              | ${"MMMM d"}       | ${"en-u-ca-islamic"}    | ${""}
      ${"hanidec digits"}               | ${"一二25日"}               | ${"MMMd日"}       | ${"zh-CN-u-nu-hanidec"} | ${""}
      ${"hanidec month as printed"}     | ${"一二月25日"}             | ${"MMMMd日"}      | ${"ja-JP-u-nu-hanidec"} | ${"--12-25"}
      ${"hanidec month in latn"}        | ${"12月25日"}               | ${"MMMMd日"}      | ${"ja-JP-u-nu-hanidec"} | ${""}
      ${"no locale"}                    | ${"12-25"}                  | ${""}             | ${undefined}            | ${""}
    `(
      "parses '$value' against '$pattern' ($label) to '$expected'",
      ({ value, pattern, locale, expected }) => {
        expect(parseMonthDayWithPattern(value, pattern, locale)).toBe(expected);
        if (expected !== "") {
          expect(isValidMonthDay(expected)).toBe(true);
        }
      },
    );

    it.each`
      label            | value
      ${"number 1225"} | ${1225}
      ${"null"}        | ${null}
      ${"undefined"}   | ${undefined}
    `("returns '' for the non-string value $label", ({ value }) => {
      expect(parseMonthDayWithPattern(value, "MM-dd")).toBe("");
    });

    it.each`
      label            | pattern
      ${"number 1225"} | ${1225}
      ${"null"}        | ${null}
      ${"undefined"}   | ${undefined}
    `("returns '' for the non-string pattern $label", ({ pattern }) => {
      expect(parseMonthDayWithPattern("12-25", pattern)).toBe("");
    });

    it.each`
      label                | locale            | expected
      ${"a revoked proxy"} | ${revokedProxy()} | ${""}
      ${"a hostile proxy"} | ${hostileProxy()} | ${""}
      ${"an empty list"}   | ${[]}             | ${"--12-25"}
    `(
      "reads 'December 25' in the locale $label as '$expected'",
      ({ locale, expected }) => {
        expect(parseMonthDayWithPattern("December 25", "MMMM d", locale)).toBe(
          expected,
        );
      },
    );

    it("returns '' when Temporal throws", () => {
      mockTemporalPlainMonthDayFromThrow();
      expect(parseMonthDayWithPattern("12-25", "MM-dd")).toBe("");
    });
  });

  describe("the 17-locale matrix, long names", () => {
    it.each`
      locale                  | value                | pattern
      ${MustTestLocales.enUS} | ${"December 25"}     | ${"MMMM d"}
      ${MustTestLocales.enGB} | ${"25 December"}     | ${"d MMMM"}
      ${MustTestLocales.deDE} | ${"25. Dezember"}    | ${"d. MMMM"}
      ${MustTestLocales.frFR} | ${"25 décembre"}     | ${"d MMMM"}
      ${MustTestLocales.esES} | ${"25 de diciembre"} | ${"d 'de' MMMM"}
      ${MustTestLocales.itIT} | ${"25 dicembre"}     | ${"d MMMM"}
      ${MustTestLocales.ptPT} | ${"25 de dezembro"}  | ${"d 'de' MMMM"}
      ${MustTestLocales.svSE} | ${"25 december"}     | ${"d MMMM"}
      ${MustTestLocales.isIS} | ${"25. desember"}    | ${"d. MMMM"}
      ${MustTestLocales.zhCN} | ${"12月25日"}        | ${"M月d日"}
      ${MustTestLocales.zhTW} | ${"12月25日"}        | ${"M月d日"}
      ${MustTestLocales.jaJP} | ${"12月25日"}        | ${"M月d日"}
      ${MustTestLocales.koKR} | ${"12월 25일"}       | ${"M월 d일"}
      ${MustTestLocales.arSA} | ${"25 ديسمبر"}       | ${"d MMMM"}
      ${MustTestLocales.heIL} | ${"25 בדצמבר"}       | ${"d בMMMM"}
      ${MustTestLocales.ruRU} | ${"25 декабря"}      | ${"d MMMM"}
      ${MustTestLocales.trTR} | ${"25 Aralık"}       | ${"d MMMM"}
    `(
      "reads the long December '$value' against '$pattern' in '$locale'",
      ({ value, pattern, locale }) => {
        const result = parseMonthDayWithPattern(value, pattern, locale);
        expect(result).toBe("--12-25");
        expect(isValidMonthDay(result)).toBe(true);
      },
    );
  });

  describe("the 17-locale matrix, short names", () => {
    it.each`
      locale                  | value          | pattern
      ${MustTestLocales.enUS} | ${"Dec 25"}    | ${"MMM d"}
      ${MustTestLocales.enGB} | ${"25 Dec"}    | ${"d MMM"}
      ${MustTestLocales.deDE} | ${"25. Dez."}  | ${"d. MMM"}
      ${MustTestLocales.frFR} | ${"25 déc."}   | ${"d MMM"}
      ${MustTestLocales.esES} | ${"25 dic"}    | ${"d MMM"}
      ${MustTestLocales.itIT} | ${"25 dic"}    | ${"d MMM"}
      ${MustTestLocales.ptPT} | ${"25 dez."}   | ${"d MMM"}
      ${MustTestLocales.svSE} | ${"25 dec."}   | ${"d MMM"}
      ${MustTestLocales.isIS} | ${"25. des."}  | ${"d. MMM"}
      ${MustTestLocales.zhCN} | ${"12月25日"}  | ${"MMMd日"}
      ${MustTestLocales.zhTW} | ${"12月25日"}  | ${"MMMd日"}
      ${MustTestLocales.jaJP} | ${"12月25日"}  | ${"MMMd日"}
      ${MustTestLocales.koKR} | ${"12월 25일"} | ${"MMM d일"}
      ${MustTestLocales.arSA} | ${"25 ديسمبر"} | ${"d MMM"}
      ${MustTestLocales.heIL} | ${"25 בדצמ׳"}  | ${"d בMMM"}
      ${MustTestLocales.ruRU} | ${"25 дек."}   | ${"d MMM"}
      ${MustTestLocales.trTR} | ${"25 Ara"}    | ${"d MMM"}
    `(
      "reads the short December '$value' against '$pattern' in '$locale'",
      ({ value, pattern, locale }) => {
        const result = parseMonthDayWithPattern(value, pattern, locale);
        expect(result).toBe("--12-25");
        expect(isValidMonthDay(result)).toBe(true);
      },
    );
  });

  describe("months whose format and stand-alone names differ", () => {
    // ru-RU long: genitive (format) and nominative (stand-alone), UTS #35 Part 4.
    it.each`
      locale     | value         | pattern      | expected
      ${"ru-RU"} | ${"25 марта"} | ${"d MMMM"}  | ${"--03-25"}
      ${"ru-RU"} | ${"25 март"}  | ${"d MMMM"}  | ${"--03-25"}
      ${"ru-RU"} | ${"9 мая"}    | ${"d MMMM"}  | ${"--05-09"}
      ${"ru-RU"} | ${"9 май"}    | ${"d MMMM"}  | ${"--05-09"}
      ${"ru-RU"} | ${"9 июня"}   | ${"d MMMM"}  | ${"--06-09"}
      ${"ru-RU"} | ${"9 июнь"}   | ${"d MMMM"}  | ${"--06-09"}
      ${"ru-RU"} | ${"9 июля"}   | ${"d MMMM"}  | ${"--07-09"}
      ${"ru-RU"} | ${"9 июль"}   | ${"d MMMM"}  | ${"--07-09"}
      ${"ru-RU"} | ${"25 марта"} | ${"d LLLL"}  | ${"--03-25"}
      ${"ru-RU"} | ${"25 март"}  | ${"d LLLL"}  | ${"--03-25"}
      ${"de-DE"} | ${"25. März"} | ${"d. MMM"}  | ${"--03-25"}
      ${"de-DE"} | ${"25. Mär"}  | ${"d. MMM"}  | ${"--03-25"}
      ${"de-DE"} | ${"25. März"} | ${"d. MMMM"} | ${"--03-25"}
    `(
      "reads '$value' against '$pattern' in $locale to '$expected'",
      ({ value, pattern, locale, expected }) => {
        const result = parseMonthDayWithPattern(value, pattern, locale);
        expect(result).toBe(expected);
        expect(isValidMonthDay(result)).toBe(true);
      },
    );

    // The short format name is whatever the engine prints: WebKit prints the genitive
    // (марта) where Node and Chromium print мар.
    it.each`
      month | day
      ${3}  | ${25}
      ${5}  | ${9}
      ${6}  | ${9}
      ${7}  | ${9}
    `(
      "reads the engine's own ru-RU short name for month $month",
      ({ month, day }) => {
        const mm = String(month).padStart(2, "0");
        const dd = String(day).padStart(2, "0");
        const printed = new Intl.DateTimeFormat("ru-RU", {
          month: "short",
          day: "numeric",
          timeZone: "UTC",
        }).format(utcMs(`2024-${mm}-${dd}T00:00:00Z`));
        const result = parseMonthDayWithPattern(printed, "d MMM", "ru-RU");
        expect(result).toBe(`--${mm}-${dd}`);
        expect(isValidMonthDay(result)).toBe(true);
      },
    );

    it.each`
      value        | month
      ${"25 март"} | ${"03"}
      ${"9 июнь"}  | ${"06"}
      ${"9 июль"}  | ${"07"}
    `(
      "reads the ru-RU stand-alone short name '$value' as month $month",
      ({ value, month }) => {
        const day = value.split(" ")[0].padStart(2, "0");
        const result = parseMonthDayWithPattern(value, "d MMM", "ru-RU");
        expect(result).toBe(`--${month}-${day}`);
        expect(isValidMonthDay(result)).toBe(true);
      },
    );
  });
});
