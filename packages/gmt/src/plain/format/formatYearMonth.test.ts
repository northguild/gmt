import { clearFormatterCache } from "../../internal/formatterCache";
import { MustTestLocales } from "../../test";
import { expectOneOfIcu, oneOfIcu } from "../../test/icuVariants";
import { countIntlConstructions } from "../../test/countIntlConstructions";
import { mockTemporalPlainYearMonthFromThrow } from "../../test/mocks";
import { formatYearMonth } from "./formatYearMonth";

// A row cell is the one string every engine prints, or the set of strings engines print.
type Expected = string | Set<string>;

function expectText(actual: string, expected: Expected): void {
  if (typeof expected === "string") {
    expect(actual).toEqual(expected);
  } else {
    expectOneOfIcu(actual, expected);
  }
}

describe("formatYearMonth", () => {
  // is-IS: Chromium ships no Icelandic data; those failures are tagged chromium-icelandic-locale-data
  // in scripts/lib/native-suite-tags.mjs by the "is-IS" in the title, as for formatMonthDay.
  // 17 locales, 2026-10 (ICU 78.3). full and long are { year: "numeric", month: "long" }; medium
  // is { year: "numeric", month: "short" }; short is { year: "2-digit", month: "numeric" }.
  it.each`
    locale                  | none                              | short                         | medium            | long
    ${MustTestLocales.enUS} | ${"10/2026"}                      | ${"10/26"}                    | ${"Oct 2026"}     | ${"October 2026"}
    ${MustTestLocales.enGB} | ${"10/2026"}                      | ${"10/26"}                    | ${"Oct 2026"}     | ${"October 2026"}
    ${MustTestLocales.deDE} | ${oneOfIcu("10/2026", "10.2026")} | ${oneOfIcu("10/26", "10.26")} | ${"Okt. 2026"}    | ${"Oktober 2026"}
    ${MustTestLocales.frFR} | ${"10/2026"}                      | ${"10/26"}                    | ${"oct. 2026"}    | ${"octobre 2026"}
    ${MustTestLocales.esES} | ${"10/2026"}                      | ${"10/26"}                    | ${"oct 2026"}     | ${"octubre de 2026"}
    ${MustTestLocales.itIT} | ${"10/2026"}                      | ${"10/26"}                    | ${"ott 2026"}     | ${"ottobre 2026"}
    ${MustTestLocales.ptPT} | ${"10/2026"}                      | ${"10/26"}                    | ${"10/2026"}      | ${"outubro de 2026"}
    ${MustTestLocales.svSE} | ${"2026-10"}                      | ${"26-10"}                    | ${"okt. 2026"}    | ${"oktober 2026"}
    ${MustTestLocales.isIS} | ${"10. 2026"}                     | ${"10. 26"}                   | ${"okt. 2026"}    | ${"október 2026"}
    ${MustTestLocales.zhCN} | ${"2026/10"}                      | ${"26/10"}                    | ${"2026年10月"}   | ${"2026年10月"}
    ${MustTestLocales.zhTW} | ${"2026/10"}                      | ${"26/10"}                    | ${"2026年10月"}   | ${"2026年10月"}
    ${MustTestLocales.jaJP} | ${"2026/10"}                      | ${"26/10"}                    | ${"2026年10月"}   | ${"2026年10月"}
    ${MustTestLocales.koKR} | ${"2026. 10."}                    | ${"26. 10."}                  | ${"2026년 10월"}  | ${"2026년 10월"}
    ${MustTestLocales.arSA} | ${"١٠/٢٠٢٦"}                      | ${"١٠/٢٦"}                    | ${"أكتوبر ٢٠٢٦"}  | ${"أكتوبر ٢٠٢٦"}
    ${MustTestLocales.heIL} | ${"10.2026"}                      | ${"10.26"}                    | ${"אוק׳ 2026"}    | ${"אוקטובר 2026"}
    ${MustTestLocales.ruRU} | ${"10.2026"}                      | ${"10.26"}                    | ${"окт. 2026 г."} | ${"октябрь 2026 г."}
    ${MustTestLocales.trTR} | ${oneOfIcu("10/2026", "10.2026")} | ${oneOfIcu("10/26", "10.26")} | ${"Eki 2026"}     | ${"Ekim 2026"}
  `(
    "formats 2026-10 for $locale as $none with no options, $short for short, $medium for medium and $long for full, long and month long",
    ({ locale, none, short, medium, long }) => {
      expectText(formatYearMonth("2026-10", locale), none);
      expectText(
        formatYearMonth("2026-10", locale, { dateStyle: "short" }),
        short,
      );
      expectText(
        formatYearMonth("2026-10", locale, { dateStyle: "medium" }),
        medium,
      );
      expectText(
        formatYearMonth("2026-10", locale, { year: "numeric", month: "long" }),
        long,
      );
      expectText(
        formatYearMonth("2026-10", locale, { dateStyle: "full" }),
        long,
      );
      expectText(
        formatYearMonth("2026-10", locale, { dateStyle: "long" }),
        long,
      );
    },
  );

  // No PlainYearMonth#toLocaleString oracle rows: on Node the oracle is polyfill 0.5.1's mapping on
  // the same ICU, and native engines differ by design (they take the widths from the locale's date
  // pattern), so the matrix pins GMT's own output on every engine.

  // Rules, en-US.
  it.each`
    value                      | options                                                                       | expected              | rule
    ${"2026-10"}               | ${{ month: "long" }}                                                          | ${"October"}          | ${"month alone"}
    ${"2026-10"}               | ${{ year: "numeric" }}                                                        | ${"2026"}             | ${"year alone"}
    ${"2026-10"}               | ${{ year: "numeric", month: "long", day: "numeric" }}                         | ${"October 2026"}     | ${"day dropped"}
    ${"2026-10"}               | ${{ weekday: "long", year: "numeric", month: "long" }}                        | ${"October 2026"}     | ${"weekday dropped"}
    ${"2026-10"}               | ${{ year: "numeric", month: "long", hour: "numeric", timeZoneName: "short" }} | ${"October 2026"}     | ${"time fields dropped"}
    ${"2026-10"}               | ${{ day: "numeric" }}                                                         | ${""}                 | ${"day only"}
    ${"2026-10"}               | ${{ weekday: "long" }}                                                        | ${""}                 | ${"weekday only"}
    ${"2026-10"}               | ${{ hour: "numeric" }}                                                        | ${""}                 | ${"hour only"}
    ${"2026-10"}               | ${{ dayPeriod: "short" }}                                                     | ${""}                 | ${"dayPeriod only"}
    ${"2026-10"}               | ${{ minute: "numeric" }}                                                      | ${""}                 | ${"minute only"}
    ${"2026-10"}               | ${{ second: "numeric" }}                                                      | ${""}                 | ${"second only"}
    ${"2026-10"}               | ${{ fractionalSecondDigits: 3 }}                                              | ${""}                 | ${"fractionalSecondDigits only"}
    ${"2026-10"}               | ${{ era: "short" }}                                                           | ${"10/2026 AD"}       | ${"era only: defaults, era inherited"}
    ${"2026-10"}               | ${{ era: "short", year: "numeric", month: "long" }}                           | ${"October 2026 AD"}  | ${"era kept"}
    ${"2026-10"}               | ${{ timeZoneName: "short" }}                                                  | ${"10/2026"}          | ${"timeZoneName only is not inherited"}
    ${"2026-10"}               | ${{ timeStyle: "short" }}                                                     | ${""}                 | ${"timeStyle"}
    ${"2026-10"}               | ${{ dateStyle: "short", timeStyle: "short" }}                                 | ${""}                 | ${"dateStyle and timeStyle"}
    ${"2026-10"}               | ${{ calendar: "gregory" }}                                                    | ${"10/2026"}          | ${"calendar gregory"}
    ${"2026-10"}               | ${{ calendar: "iso8601" }}                                                    | ${"10/2026"}          | ${"calendar iso8601"}
    ${"2026-10"}               | ${{ calendar: "hebrew" }}                                                     | ${""}                 | ${"calendar hebrew"}
    ${"2026-10"}               | ${{ calendar: "japanese" }}                                                   | ${""}                 | ${"calendar japanese"}
    ${"2026-10"}               | ${{ calendar: "gregorian" }}                                                  | ${""}                 | ${"calendar gregorian is a RangeError"}
    ${"2026-10"}               | ${{ numberingSystem: "arab" }}                                                | ${"١٠/٢٠٢٦"}          | ${"numberingSystem kept"}
    ${"2026-10[u-ca=ISO8601]"} | ${undefined}                                                                  | ${"10/2026"}          | ${"D20 calendar annotation"}
    ${"+002026-10"}            | ${undefined}                                                                  | ${"10/2026"}          | ${"six-digit year form"}
    ${"0000-10"}               | ${{ year: "numeric", month: "long" }}                                         | ${"October 1"}        | ${"year 0 prints era year 1, no era"}
    ${"-000001-10"}            | ${{ year: "numeric", month: "long" }}                                         | ${"October 2"}        | ${"year -1 prints era year 2"}
    ${"0000-10"}               | ${{ era: "short", year: "numeric", month: "long" }}                           | ${"October 1 BC"}     | ${"year 0 with era"}
    ${"-271821-04"}            | ${{ year: "numeric", month: "long" }}                                         | ${"April 271822"}     | ${"lower limit, day-20 rule"}
    ${"-271821-04"}            | ${{ era: "short", year: "numeric", month: "long" }}                           | ${"April 271822 BC"}  | ${"lower limit with era"}
    ${"+275760-09"}            | ${{ year: "numeric", month: "long" }}                                         | ${"September 275760"} | ${"upper limit"}
    ${"2026-10"}               | ${{ month: "wide" }}                                                          | ${""}                 | ${"invalid month"}
    ${"2026-10"}               | ${{ dateStyle: "long", month: "short" }}                                      | ${""}                 | ${"dateStyle with a field is a TypeError"}
    ${"2026-10"}               | ${null}                                                                       | ${""}                 | ${"null options"}
    ${"2026-10"}               | ${"x"}                                                                        | ${"10/2026"}          | ${"string options go through ToObject, as formatDate does"}
    ${"2026-13"}               | ${undefined}                                                                  | ${""}                 | ${"month 13"}
    ${"202610"}                | ${undefined}                                                                  | ${""}                 | ${"basic form"}
    ${"2026-10-01"}            | ${undefined}                                                                  | ${""}                 | ${"a date"}
    ${""}                      | ${undefined}                                                                  | ${""}                 | ${"empty string"}
  `(
    "formats '$value' with options $options for en-US to '$expected' ($rule)",
    ({ value, options, expected }) => {
      expect(formatYearMonth(value, MustTestLocales.enUS, options)).toEqual(
        expected,
      );
    },
  );

  it("overrides a -u-ca- subtag of the locale with the Gregorian calendar", () => {
    expect(
      formatYearMonth("2026-10", "ja-JP-u-ca-japanese", {
        year: "numeric",
        month: "long",
      }),
    ).toEqual("2026年10月");
  });

  it("ignores an unsupported calendar and formats Gregorian in en-US", () => {
    expect(formatYearMonth("2026-10", "en-US", { calendar: "foo" })).toEqual(
      "10/2026",
    );
  });

  it("returns '' when an unsupported calendar falls back to a locale's non-Gregorian default", () => {
    expect(formatYearMonth("2026-10", "th-TH", { calendar: "foo" })).toEqual(
      "",
    );
  });

  it("returns '' for an ill-formed locale tag", () => {
    expect(formatYearMonth("2026-10", "not-a-locale-!!")).toEqual("");
  });

  it("formats with the first tag of a locale list", () => {
    expect(
      formatYearMonth("2026-10", [MustTestLocales.svSE, MustTestLocales.enUS]),
    ).toEqual("2026-10");
  });

  it("returns '' for a non-string value", () => {
    expect(formatYearMonth(202610 as unknown as string)).toEqual("");
  });

  it("returns '' when Temporal.PlainYearMonth.from throws", () => {
    mockTemporalPlainYearMonthFromThrow();
    expect(formatYearMonth("2026-10", MustTestLocales.enUS)).toEqual("");
  });

  describe("formatter cache", () => {
    beforeEach(() => {
      clearFormatterCache();
    });

    it("builds no DateTimeFormat the second time for the same locale and options", () => {
      let first = "";
      const built = countIntlConstructions(
        ["DateTimeFormat"],
        () => {
          expect(
            formatYearMonth("2026-10", MustTestLocales.enGB, {
              dateStyle: "long",
            }),
          ).toEqual(first);
        },
        () => {
          first = formatYearMonth("2026-10", MustTestLocales.enGB, {
            dateStyle: "long",
          });
        },
      );
      expect(first).toEqual("October 2026");
      expect(built).toEqual(0);
    });
  });
});
