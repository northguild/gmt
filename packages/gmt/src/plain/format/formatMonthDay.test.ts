import { clearFormatterCache } from "../../internal/formatterCache";
import { MustTestLocales } from "../../test";
import { expectOneOfIcu, oneOfIcu } from "../../test/icuVariants";
import { countIntlConstructions } from "../../test/countIntlConstructions";
import { mockTemporalPlainMonthDayFromThrow } from "../../test/mocks";
import { formatMonthDay } from "./formatMonthDay";

// A row cell is the one string every engine prints, or the set of strings engines print.
type Expected = string | Set<string>;

function expectText(actual: string, expected: Expected): void {
  if (typeof expected === "string") {
    expect(actual).toEqual(expected);
  } else {
    expectOneOfIcu(actual, expected);
  }
}

describe("formatMonthDay", () => {
  // 17 locales, --12-25. A dateStyle takes the month and day widths from the locale's own date
  // pattern (ECMA-402 AdjustDateTimeStyleFormat), so medium and long are the locale's: de-DE medium
  // "25.12.", ja-JP long "12/25". Every dateStyle cell is what native
  // PlainMonthDay#toLocaleString prints with calendar gregory in Chromium 153 and WebKit 26.6; on
  // Node the Temporal is polyfill 0.5.1, which maps the style to fixed widths instead. full gives
  // the long cell in all 17. monthLong is { month: "long", day: "numeric" }: zh and ja write the
  // month as a name there and as a number in every dateStyle. tr-TR short: "25/12" on ICU 78.3
  // (Node 24.22.1, Chromium 153), "25.12" on WebKit 26.6.
  it.each`
    locale                  | short                         | medium        | long                 | monthLong
    ${MustTestLocales.enUS} | ${"12/25"}                    | ${"Dec 25"}   | ${"December 25"}     | ${"December 25"}
    ${MustTestLocales.enGB} | ${"25/12"}                    | ${"25 Dec"}   | ${"25 December"}     | ${"25 December"}
    ${MustTestLocales.deDE} | ${"25.12."}                   | ${"25.12."}   | ${"25. Dezember"}    | ${"25. Dezember"}
    ${MustTestLocales.frFR} | ${"25/12"}                    | ${"25 déc."}  | ${"25 décembre"}     | ${"25 décembre"}
    ${MustTestLocales.esES} | ${"25/12"}                    | ${"25 dic"}   | ${"25 de diciembre"} | ${"25 de diciembre"}
    ${MustTestLocales.itIT} | ${"25/12"}                    | ${"25 dic"}   | ${"25 dicembre"}     | ${"25 dicembre"}
    ${MustTestLocales.ptPT} | ${"25/12"}                    | ${"25/12"}    | ${"25 de dezembro"}  | ${"25 de dezembro"}
    ${MustTestLocales.svSE} | ${"25/12"}                    | ${"25 dec."}  | ${"25 december"}     | ${"25 december"}
    ${MustTestLocales.isIS} | ${"25.12."}                   | ${"25. des."} | ${"25. desember"}    | ${"25. desember"}
    ${MustTestLocales.zhCN} | ${"12/25"}                    | ${"12/25"}    | ${"12/25"}           | ${"12月25日"}
    ${MustTestLocales.zhTW} | ${"12/25"}                    | ${"12/25"}    | ${"12/25"}           | ${"12月25日"}
    ${MustTestLocales.jaJP} | ${"12/25"}                    | ${"12/25"}    | ${"12/25"}           | ${"12月25日"}
    ${MustTestLocales.koKR} | ${"12. 25."}                  | ${"12. 25."}  | ${"12월 25일"}       | ${"12월 25일"}
    ${MustTestLocales.arSA} | ${"٢٥/١٢"}                    | ${"٢٥/١٢"}    | ${"٢٥ ديسمبر"}       | ${"٢٥ ديسمبر"}
    ${MustTestLocales.heIL} | ${"25.12"}                    | ${"25 בדצמ׳"} | ${"25 בדצמבר"}       | ${"25 בדצמבר"}
    ${MustTestLocales.ruRU} | ${"25.12"}                    | ${"25 дек."}  | ${"25 декабря"}      | ${"25 декабря"}
    ${MustTestLocales.trTR} | ${oneOfIcu("25/12", "25.12")} | ${"25 Ara"}   | ${"25 Aralık"}       | ${"25 Aralık"}
  `(
    "formats --12-25 for $locale as $short with no options and short, $medium for medium, $long for full and long and $monthLong for month long",
    ({ locale, short, medium, long, monthLong }) => {
      expectText(formatMonthDay("--12-25", locale), short);
      expectText(
        formatMonthDay("--12-25", locale, { dateStyle: "short" }),
        short,
      );
      expectText(
        formatMonthDay("--12-25", locale, { dateStyle: "medium" }),
        medium,
      );
      expectText(
        formatMonthDay("--12-25", locale, { dateStyle: "long" }),
        long,
      );
      expectText(
        formatMonthDay("--12-25", locale, { dateStyle: "full" }),
        long,
      );
      expectText(
        formatMonthDay("--12-25", locale, { month: "long", day: "numeric" }),
        monthLong,
      );
    },
  );

  // Rules, en-US.
  it.each`
    value                      | options                                                                                     | expected         | rule
    ${"--02-29"}               | ${{ month: "long", day: "numeric" }}                                                        | ${"February 29"} | ${"1972 reference year"}
    ${"12-25"}                 | ${undefined}                                                                                | ${"12/25"}       | ${"input form MM-DD"}
    ${"--12-25[u-ca=ISO8601]"} | ${undefined}                                                                                | ${"12/25"}       | ${"D20 calendar annotation"}
    ${"--12-25"}               | ${{ month: "long" }}                                                                        | ${"December"}    | ${"month alone"}
    ${"--12-25"}               | ${{ day: "numeric" }}                                                                       | ${"25"}          | ${"day alone"}
    ${"--12-25"}               | ${{ year: "numeric", month: "long", day: "numeric" }}                                       | ${"December 25"} | ${"year dropped"}
    ${"--12-25"}               | ${{ weekday: "long", month: "long", day: "numeric" }}                                       | ${"December 25"} | ${"weekday dropped"}
    ${"--12-25"}               | ${{ year: "numeric" }}                                                                      | ${""}            | ${"year only"}
    ${"--12-25"}               | ${{ hour: "numeric" }}                                                                      | ${""}            | ${"hour only"}
    ${"--12-25"}               | ${{ weekday: "long" }}                                                                      | ${""}            | ${"weekday only"}
    ${"--12-25"}               | ${{ dayPeriod: "short" }}                                                                   | ${""}            | ${"dayPeriod only"}
    ${"--12-25"}               | ${{ minute: "numeric" }}                                                                    | ${""}            | ${"minute only"}
    ${"--12-25"}               | ${{ second: "numeric" }}                                                                    | ${""}            | ${"second only"}
    ${"--12-25"}               | ${{ fractionalSecondDigits: 3 }}                                                            | ${""}            | ${"fractionalSecondDigits only"}
    ${"--12-25"}               | ${{ month: "long", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" }} | ${"December 25"} | ${"time fields dropped beside month and day"}
    ${"--12-25"}               | ${{ era: "short" }}                                                                         | ${"12/25"}       | ${"era only is not inherited"}
    ${"--12-25"}               | ${{ timeZoneName: "short" }}                                                                | ${"12/25"}       | ${"timeZoneName only is not inherited"}
    ${"--12-25"}               | ${{ timeStyle: "short" }}                                                                   | ${""}            | ${"timeStyle"}
    ${"--12-25"}               | ${{ dateStyle: "short", timeStyle: "short" }}                                               | ${""}            | ${"dateStyle and timeStyle"}
    ${"--12-25"}               | ${{ calendar: "gregory" }}                                                                  | ${"12/25"}       | ${"calendar gregory"}
    ${"--12-25"}               | ${{ calendar: "iso8601" }}                                                                  | ${"12/25"}       | ${"calendar iso8601"}
    ${"--12-25"}               | ${{ calendar: "hebrew" }}                                                                   | ${""}            | ${"calendar hebrew"}
    ${"--12-25"}               | ${{ calendar: "japanese" }}                                                                 | ${""}            | ${"calendar japanese"}
    ${"--12-25"}               | ${{ calendar: "foo" }}                                                                      | ${"12/25"}       | ${"unsupported calendar falls back to en-US gregory"}
    ${"--12-25"}               | ${{ calendar: "gregorian" }}                                                                | ${""}            | ${"calendar gregorian is a RangeError"}
    ${"--12-25"}               | ${{ numberingSystem: "arab" }}                                                              | ${"١٢/٢٥"}       | ${"numberingSystem kept"}
    ${"--12-25"}               | ${{ hour12: true }}                                                                         | ${"12/25"}       | ${"hour12 is accepted and has no effect"}
    ${"--12-25"}               | ${{ hourCycle: "h23" }}                                                                     | ${"12/25"}       | ${"hourCycle is accepted and has no effect"}
    ${"--12-25"}               | ${{ hourCycle: "h99" }}                                                                     | ${""}            | ${"invalid hourCycle is a RangeError"}
    ${"--12-25"}               | ${{ timeZone: "Pacific/Auckland" }}                                                         | ${"12/25"}       | ${"timeZone ignored: noon UTC in 1972 is already 12/26 in Auckland"}
    ${"--12-25"}               | ${{ timeZone: "Not/AZone" }}                                                                | ${""}            | ${"invalid timeZone is a RangeError"}
    ${"--12-25"}               | ${{ dateStyle: "huge" }}                                                                    | ${""}            | ${"invalid dateStyle"}
    ${"--12-25"}               | ${{ dateStyle: "long", month: "short" }}                                                    | ${""}            | ${"dateStyle with a field is a TypeError"}
    ${"--12-25"}               | ${{ month: "wide" }}                                                                        | ${""}            | ${"invalid month"}
    ${"--12-25"}               | ${null}                                                                                     | ${""}            | ${"null options"}
    ${"--02-30"}               | ${undefined}                                                                                | ${""}            | ${"day out of range"}
    ${"2024-12-25"}            | ${undefined}                                                                                | ${""}            | ${"a date"}
    ${"--1225"}                | ${undefined}                                                                                | ${""}            | ${"basic form"}
    ${""}                      | ${undefined}                                                                                | ${""}            | ${"empty string"}
    ${"1225"}                  | ${undefined}                                                                                | ${""}            | ${"basic form without dashes"}
  `(
    "formats '$value' with options $options for en-US to '$expected' ($rule)",
    ({ value, options, expected }) => {
      expect(formatMonthDay(value, MustTestLocales.enUS, options)).toEqual(
        expected,
      );
    },
  );

  it("overrides a -u-ca- subtag of the locale with the Gregorian calendar", () => {
    expect(
      formatMonthDay("--12-25", "ja-JP-u-ca-japanese", {
        month: "long",
        day: "numeric",
      }),
    ).toEqual("12月25日");
  });

  it.each`
    locale               | options                        | expected   | label
    ${"en-US-u-nu-arab"} | ${undefined}                   | ${"١٢/٢٥"} | ${"the -u-nu- extension picks the numbering system"}
    ${"en-US-u-nu-arab"} | ${{ numberingSystem: "latn" }} | ${"12/25"} | ${"the numberingSystem option overrides the -u-nu- extension"}
  `(
    "formats --12-25 for $locale with $options as '$expected' ($label)",
    ({ locale, options, expected }) => {
      expect(formatMonthDay("--12-25", locale, options)).toEqual(expected);
    },
  );

  it("returns '' when an unsupported calendar falls back to a locale's non-Gregorian default", () => {
    expect(formatMonthDay("--12-25", "th-TH", { calendar: "foo" })).toEqual("");
  });

  it("returns '' for an ill-formed locale tag", () => {
    expect(formatMonthDay("--12-25", "not-a-locale-!!")).toEqual("");
  });

  it("returns '' for a non-string value", () => {
    expect(formatMonthDay(null as unknown as string)).toEqual("");
  });

  it("formats with the first tag of a locale list", () => {
    expect(
      formatMonthDay("--12-25", [MustTestLocales.frFR, MustTestLocales.enUS]),
    ).toEqual("25/12");
  });

  it("returns '' when Temporal.PlainMonthDay.from throws", () => {
    mockTemporalPlainMonthDayFromThrow();
    expect(formatMonthDay("--12-25", MustTestLocales.enUS)).toEqual("");
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
            formatMonthDay("--12-25", MustTestLocales.enGB, {
              dateStyle: "long",
            }),
          ).toEqual(first);
        },
        () => {
          first = formatMonthDay("--12-25", MustTestLocales.enGB, {
            dateStyle: "long",
          });
        },
      );
      expect(first).toEqual("25 December");
      expect(built).toEqual(0);
    });
  });
});
