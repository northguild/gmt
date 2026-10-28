import { MustTestLocales } from "../../test";
import { mockTemporalPlainYearMonthFromThrow } from "../../test/mocks";
import { hostileProxy, revokedProxy } from "../../test/hostileValues";
import { isValidYearMonth } from "../validate";
import { parseYearMonthWithPattern } from "./parseYearMonthWithPattern";

describe("parseYearMonthWithPattern", () => {
  describe("numeric tokens and rules", () => {
    it.each`
      label                              | value                       | pattern              | locale                   | expected
      ${"no locale"}                     | ${"10/2026"}                | ${"MM/yyyy"}         | ${undefined}             | ${"2026-10"}
      ${"no locale"}                     | ${"2026-10"}                | ${"yyyy-MM"}         | ${undefined}             | ${"2026-10"}
      ${"no locale"}                     | ${"10.2026"}                | ${"MM.yyyy"}         | ${undefined}             | ${"2026-10"}
      ${"no locale"}                     | ${"1/2026"}                 | ${"M/yyyy"}          | ${undefined}             | ${"2026-01"}
      ${"no locale"}                     | ${"13/2026"}                | ${"MM/yyyy"}         | ${undefined}             | ${""}
      ${"no locale"}                     | ${"00/2026"}                | ${"MM/yyyy"}         | ${undefined}             | ${""}
      ${"no locale"}                     | ${"10/2026"}                | ${"LL/yyyy"}         | ${undefined}             | ${"2026-10"}
      ${"no locale"}                     | ${"10/0000"}                | ${"MM/yyyy"}         | ${undefined}             | ${"0000-10"}
      ${"no locale"}                     | ${"October 2026"}           | ${"MMMM yyyy"}       | ${undefined}             | ${"2026-10"}
      ${"locale fr"}                     | ${"octobre 2026"}           | ${"MMMM yyyy"}       | ${"fr"}                  | ${"2026-10"}
      ${"a preference list"}             | ${"octobre 2026"}           | ${"MMMM yyyy"}       | ${["fr-FR", "en-US"]}    | ${"2026-10"}
      ${"locale ru-RU"}                  | ${"октябрь 2026"}           | ${"LLLL yyyy"}       | ${"ru-RU"}               | ${"2026-10"}
      ${"locale ru-RU"}                  | ${"октября 2026"}           | ${"MMMM yyyy"}       | ${"ru-RU"}               | ${"2026-10"}
      ${"locale ru-RU"}                  | ${"октябрь 2026"}           | ${"MMMM yyyy"}       | ${"ru-RU"}               | ${"2026-10"}
      ${"locale en-US, BC"}              | ${"October 0001 BC"}        | ${"MMMM yyyy GG"}    | ${"en-US"}               | ${"0000-10"}
      ${"locale en-US, BC"}              | ${"October 0002 BC"}        | ${"MMMM yyyy GG"}    | ${"en-US"}               | ${"-000001-10"}
      ${"locale en-US, y alone"}         | ${"October 2026"}           | ${"MMMM y"}          | ${"en-US"}               | ${""}
      ${"locale fr-FR, day"}             | ${"1 octobre 2026"}         | ${"d MMMM yyyy"}     | ${"fr-FR"}               | ${""}
      ${"locale en-US, weekday"}         | ${"Thursday, October 2026"} | ${"EEEE, MMMM yyyy"} | ${"en-US"}               | ${""}
      ${"no locale, time"}               | ${"10:30 10/2026"}          | ${"HH:mm MM/yyyy"}   | ${undefined}             | ${""}
      ${"no locale, no year"}            | ${"10"}                     | ${"MM"}              | ${undefined}             | ${""}
      ${"no locale, no month"}           | ${"2026"}                   | ${"yyyy"}            | ${undefined}             | ${""}
      ${"locale en-US"}                  | ${"octobre 2026"}           | ${"MMMM yyyy"}       | ${"en-US"}               | ${""}
      ${"locale not-a-locale-!!"}        | ${"Oct 2026"}               | ${"MMM yyyy"}        | ${"not-a-locale-!!"}     | ${""}
      ${"locale es-ES, open quote"}      | ${"octubre de 2026"}        | ${"MMMM 'de yyyy"}   | ${"es-ES"}               | ${""}
      ${"no locale, empty value"}        | ${""}                       | ${"MM/yyyy"}         | ${undefined}             | ${""}
      ${"no locale, empty pattern"}      | ${"10/2026"}                | ${""}                | ${undefined}             | ${""}
      ${"islamic extension overridden"}  | ${"October 2026"}           | ${"MMMM yyyy"}       | ${"en-u-ca-islamic"}     | ${"2026-10"}
      ${"islamic month name"}            | ${"Ramadan 2026"}           | ${"MMMM yyyy"}       | ${"en-u-ca-islamic"}     | ${""}
      ${"japanese extension overridden"} | ${"2026年10月"}             | ${"yyyy年M月"}       | ${"ja-JP-u-ca-japanese"} | ${"2026-10"}
      ${"mixed-case name"}               | ${"OCTOBER 2026"}           | ${"MMMM yyyy"}       | ${undefined}             | ${"2026-10"}
    `(
      "parses '$value' against '$pattern' ($label) to '$expected'",
      ({ value, pattern, locale, expected }) => {
        expect(parseYearMonthWithPattern(value, pattern, locale)).toBe(
          expected,
        );
        if (expected !== "") {
          expect(isValidYearMonth(expected)).toBe(true);
        }
      },
    );

    // A two-digit year reads the caller's window: exactly one year in the window ends in yy.
    it.each`
      label                | value      | options                 | expected
      ${"window 1950"}     | ${"10/26"} | ${{ yearWindow: 1950 }} | ${"2026-10"}
      ${"window 2000"}     | ${"10/26"} | ${{ yearWindow: 2000 }} | ${"2026-10"}
      ${"window 1950, 49"} | ${"10/49"} | ${{ yearWindow: 1950 }} | ${"2049-10"}
      ${"window 1950, 50"} | ${"10/50"} | ${{ yearWindow: 1950 }} | ${"1950-10"}
      ${"no options"}      | ${"10/26"} | ${undefined}            | ${""}
      ${"empty options"}   | ${"10/26"} | ${{}}                   | ${""}
      ${"null options"}    | ${"10/26"} | ${null}                 | ${""}
      ${"string options"}  | ${"10/26"} | ${"x"}                  | ${""}
    `(
      "parses $value against MM/yy with $label to '$expected'",
      ({ value, options, expected }) => {
        expect(
          parseYearMonthWithPattern(value, "MM/yy", undefined, options),
        ).toBe(expected);
      },
    );

    it.each`
      label       | options
      ${"null"}   | ${null}
      ${"string"} | ${"x"}
    `(
      "returns '' for the full-year pattern when options is the non-object $label",
      ({ options }) => {
        expect(
          parseYearMonthWithPattern("10/2026", "MM/yyyy", undefined, options),
        ).toBe("");
      },
    );

    it.each`
      label          | value
      ${"number"}    | ${102026}
      ${"null"}      | ${null}
      ${"undefined"} | ${undefined}
    `("returns '' for the non-string value $label", ({ value }) => {
      expect(parseYearMonthWithPattern(value, "MM/yyyy")).toBe("");
    });

    it.each`
      label          | pattern
      ${"number"}    | ${102026}
      ${"null"}      | ${null}
      ${"undefined"} | ${undefined}
    `("returns '' for the non-string pattern $label", ({ pattern }) => {
      expect(parseYearMonthWithPattern("10/2026", pattern)).toBe("");
    });

    it.each`
      label                | locale            | expected
      ${"a revoked proxy"} | ${revokedProxy()} | ${""}
      ${"a hostile proxy"} | ${hostileProxy()} | ${""}
      ${"an empty list"}   | ${[]}             | ${"2026-10"}
    `(
      "reads 'October 2026' in the locale $label as '$expected'",
      ({ locale, expected }) => {
        expect(
          parseYearMonthWithPattern("October 2026", "MMMM yyyy", locale),
        ).toBe(expected);
      },
    );

    it("returns '' when Temporal throws", () => {
      mockTemporalPlainYearMonthFromThrow();
      expect(parseYearMonthWithPattern("10/2026", "MM/yyyy")).toBe("");
    });
  });

  describe("the 17-locale matrix, long names", () => {
    it.each`
      locale                  | value                | pattern
      ${MustTestLocales.enUS} | ${"October 2026"}    | ${"MMMM yyyy"}
      ${MustTestLocales.enGB} | ${"October 2026"}    | ${"MMMM yyyy"}
      ${MustTestLocales.deDE} | ${"Oktober 2026"}    | ${"MMMM yyyy"}
      ${MustTestLocales.frFR} | ${"octobre 2026"}    | ${"MMMM yyyy"}
      ${MustTestLocales.esES} | ${"octubre de 2026"} | ${"MMMM 'de' yyyy"}
      ${MustTestLocales.itIT} | ${"ottobre 2026"}    | ${"MMMM yyyy"}
      ${MustTestLocales.ptPT} | ${"outubro de 2026"} | ${"MMMM 'de' yyyy"}
      ${MustTestLocales.svSE} | ${"oktober 2026"}    | ${"MMMM yyyy"}
      ${MustTestLocales.isIS} | ${"október 2026"}    | ${"MMMM yyyy"}
      ${MustTestLocales.zhCN} | ${"2026年10月"}      | ${"yyyy年M月"}
      ${MustTestLocales.zhTW} | ${"2026年10月"}      | ${"yyyy年M月"}
      ${MustTestLocales.jaJP} | ${"2026年10月"}      | ${"yyyy年M月"}
      ${MustTestLocales.koKR} | ${"2026년 10월"}     | ${"yyyy년 M월"}
      ${MustTestLocales.arSA} | ${"أكتوبر 2026"}     | ${"MMMM yyyy"}
      ${MustTestLocales.heIL} | ${"אוקטובר 2026"}    | ${"MMMM yyyy"}
      ${MustTestLocales.ruRU} | ${"октябрь 2026 г."} | ${"MMMM yyyy 'г.'"}
      ${MustTestLocales.trTR} | ${"Ekim 2026"}       | ${"MMMM yyyy"}
    `(
      "reads the long October '$value' against '$pattern' in '$locale'",
      ({ value, pattern, locale }) => {
        const result = parseYearMonthWithPattern(value, pattern, locale);
        expect(result).toBe("2026-10");
        expect(isValidYearMonth(result)).toBe(true);
      },
    );
  });

  describe("the 17-locale matrix, short names", () => {
    it.each`
      locale                  | value             | pattern
      ${MustTestLocales.enUS} | ${"Oct 2026"}     | ${"MMM yyyy"}
      ${MustTestLocales.enGB} | ${"Oct 2026"}     | ${"MMM yyyy"}
      ${MustTestLocales.deDE} | ${"Okt. 2026"}    | ${"MMM yyyy"}
      ${MustTestLocales.deDE} | ${"Okt 2026"}     | ${"MMM yyyy"}
      ${MustTestLocales.frFR} | ${"oct. 2026"}    | ${"MMM yyyy"}
      ${MustTestLocales.esES} | ${"oct 2026"}     | ${"MMM yyyy"}
      ${MustTestLocales.itIT} | ${"ott 2026"}     | ${"MMM yyyy"}
      ${MustTestLocales.ptPT} | ${"out. 2026"}    | ${"MMM yyyy"}
      ${MustTestLocales.svSE} | ${"okt. 2026"}    | ${"MMM yyyy"}
      ${MustTestLocales.isIS} | ${"okt. 2026"}    | ${"MMM yyyy"}
      ${MustTestLocales.zhCN} | ${"2026年10月"}   | ${"yyyy年MMM"}
      ${MustTestLocales.zhTW} | ${"2026年10月"}   | ${"yyyy年MMM"}
      ${MustTestLocales.jaJP} | ${"2026年10月"}   | ${"yyyy年MMM"}
      ${MustTestLocales.koKR} | ${"2026년 10월"}  | ${"yyyy년 MMM"}
      ${MustTestLocales.arSA} | ${"أكتوبر 2026"}  | ${"MMM yyyy"}
      ${MustTestLocales.heIL} | ${"אוק׳ 2026"}    | ${"MMM yyyy"}
      ${MustTestLocales.ruRU} | ${"окт. 2026 г."} | ${"MMM yyyy 'г.'"}
      ${MustTestLocales.trTR} | ${"Eki 2026"}     | ${"MMM yyyy"}
    `(
      "reads the short October '$value' against '$pattern' in '$locale'",
      ({ value, pattern, locale }) => {
        const result = parseYearMonthWithPattern(value, pattern, locale);
        expect(result).toBe("2026-10");
        expect(isValidYearMonth(result)).toBe(true);
      },
    );
  });

  describe("months whose format and stand-alone names differ", () => {
    // ru-RU long: genitive (format) and nominative (stand-alone), UTS #35 Part 4.
    it.each`
      locale     | value           | pattern        | expected
      ${"ru-RU"} | ${"марта 2026"} | ${"MMMM yyyy"} | ${"2026-03"}
      ${"ru-RU"} | ${"март 2026"}  | ${"MMMM yyyy"} | ${"2026-03"}
      ${"ru-RU"} | ${"мая 2026"}   | ${"MMMM yyyy"} | ${"2026-05"}
      ${"ru-RU"} | ${"май 2026"}   | ${"MMMM yyyy"} | ${"2026-05"}
      ${"ru-RU"} | ${"июня 2026"}  | ${"MMMM yyyy"} | ${"2026-06"}
      ${"ru-RU"} | ${"июнь 2026"}  | ${"MMMM yyyy"} | ${"2026-06"}
      ${"ru-RU"} | ${"июля 2026"}  | ${"MMMM yyyy"} | ${"2026-07"}
      ${"ru-RU"} | ${"июль 2026"}  | ${"MMMM yyyy"} | ${"2026-07"}
      ${"ru-RU"} | ${"марта 2026"} | ${"LLLL yyyy"} | ${"2026-03"}
      ${"ru-RU"} | ${"март 2026"}  | ${"LLLL yyyy"} | ${"2026-03"}
      ${"de-DE"} | ${"März 2026"}  | ${"MMM yyyy"}  | ${"2026-03"}
      ${"de-DE"} | ${"Mär 2026"}   | ${"MMM yyyy"}  | ${"2026-03"}
      ${"de-DE"} | ${"März 2026"}  | ${"MMMM yyyy"} | ${"2026-03"}
    `(
      "reads '$value' against '$pattern' in $locale to '$expected'",
      ({ value, pattern, locale, expected }) => {
        const result = parseYearMonthWithPattern(value, pattern, locale);
        expect(result).toBe(expected);
        expect(isValidYearMonth(result)).toBe(true);
      },
    );
  });

  describe("era and two-digit year with names", () => {
    it.each`
      value                           | pattern             | options                 | expected
      ${"October 2026 AD"}            | ${"MMMM yyyy GG"}   | ${undefined}            | ${"2026-10"}
      ${"October 2026 Anno Domini"}   | ${"MMMM yyyy GGGG"} | ${undefined}            | ${"2026-10"}
      ${"October 0001 Before Christ"} | ${"MMMM yyyy GGGG"} | ${undefined}            | ${"0000-10"}
      ${"Oct 26"}                     | ${"MMM yy"}         | ${{ yearWindow: 1950 }} | ${"2026-10"}
      ${"Oct 50"}                     | ${"MMM yy"}         | ${{ yearWindow: 1950 }} | ${"1950-10"}
      ${"Oct 26"}                     | ${"MMM yy"}         | ${undefined}            | ${""}
    `(
      "reads '$value' against '$pattern' in en-US with $options to '$expected'",
      ({ value, pattern, options, expected }) => {
        expect(
          parseYearMonthWithPattern(value, pattern, "en-US", options),
        ).toBe(expected);
      },
    );
  });
});
