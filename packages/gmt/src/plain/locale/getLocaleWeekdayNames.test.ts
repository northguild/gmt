import { MustTestLocales } from "../../test";
import { getLocaleWeekdayNames } from "./getLocaleWeekdayNames";
import { utcMs } from "../../test/utcMs";

describe("getLocaleWeekdayNames", () => {
  // The order is CLDR's first day (UTS #35 Part 4 § 4: Sunday for en-US, pt-PT, zh-TW, ja-JP, ko-KR,
  // ar-SA and he-IL, Monday for the rest) and the length is 7. The wording is the host's own
  // `Intl.DateTimeFormat` weekday text, because runtimes carry different CLDR releases and the
  // names (`Пн` or `пн`) are theirs to spell.
  const hostNames = (
    locale: string,
    weekday: "long" | "short" | "narrow",
    firstDay: number,
  ): string[] => {
    const format = new Intl.DateTimeFormat(locale, {
      weekday,
      timeZone: "UTC",
    });
    // 2024-01-01 is a Monday.
    return Array.from({ length: 7 }, (_, index) =>
      format.format(
        utcMs(`2024-01-0${1 + ((firstDay - 1 + index) % 7)}T00:00:00Z`),
      ),
    );
  };

  it.each`
    locale                  | firstDay
    ${MustTestLocales.enUS} | ${7}
    ${MustTestLocales.enGB} | ${1}
    ${MustTestLocales.deDE} | ${1}
    ${MustTestLocales.frFR} | ${1}
    ${MustTestLocales.esES} | ${1}
    ${MustTestLocales.itIT} | ${1}
    ${MustTestLocales.ptPT} | ${7}
    ${MustTestLocales.svSE} | ${1}
    ${MustTestLocales.zhTW} | ${7}
    ${MustTestLocales.jaJP} | ${7}
    ${MustTestLocales.koKR} | ${7}
    ${MustTestLocales.arSA} | ${7}
    ${MustTestLocales.heIL} | ${7}
    ${MustTestLocales.ruRU} | ${1}
    ${MustTestLocales.trTR} | ${1}
  `(
    "returns 7 weekday names (long/short/narrow) for $locale starting on ISO weekday $firstDay",
    ({ locale, firstDay }) => {
      expect(getLocaleWeekdayNames(locale)).toEqual(
        hostNames(locale, "long", firstDay),
      );
      expect(getLocaleWeekdayNames(locale, "long")).toEqual(
        hostNames(locale, "long", firstDay),
      );
      expect(getLocaleWeekdayNames(locale, "short")).toEqual(
        hostNames(locale, "short", firstDay),
      );
      expect(getLocaleWeekdayNames(locale, "narrow")).toEqual(
        hostNames(locale, "narrow", firstDay),
      );
    },
  );

  // The names are listed from the locale's first day, and zh-CN and is-IS name a region whose
  // first day some runtime does not read as CLDR does (compat D36), so every runtime returns [].
  it.each`
    locale
    ${MustTestLocales.zhCN}
    ${MustTestLocales.isIS}
  `(
    "returns [] for $locale, whose first day runtimes dispute",
    ({ locale }) => {
      expect(getLocaleWeekdayNames(locale)).toEqual([]);
    },
  );

  // `-u-fw-` names the first day (UTS #35 key fw), so the list needs no runtime data.
  it.each`
    locale              | first
    ${"zh-CN-u-fw-mon"} | ${"星期一"}
    ${"zh-CN-u-fw-sun"} | ${"星期日"}
    ${"de-DE-u-fw-sun"} | ${"Sonntag"}
    ${"de-DE-u-fw-mon"} | ${"Montag"}
  `("starts with $first for $locale", ({ locale, first }) => {
    expect(getLocaleWeekdayNames(locale)[0]).toBe(first);
  });

  it("starts with the locale's first day of the week", () => {
    expect(getLocaleWeekdayNames(MustTestLocales.enUS)[0]).toBe("Sunday");
    expect(getLocaleWeekdayNames(MustTestLocales.frFR)[0]).toBe("lundi");
    expect(getLocaleWeekdayNames(MustTestLocales.arSA)[0]).toBe("الأحد");
  });

  it("returns an empty array for invalid locales", () => {
    expect(getLocaleWeekdayNames("")).toEqual([]);
    expect(getLocaleWeekdayNames("!!!")).toEqual([]);
    expect(getLocaleWeekdayNames(123 as unknown as string)).toEqual([]);
  });

  it("always returns exactly 7 names that are a permutation of the locale's ISO weekday set", () => {
    for (const locale of Object.values(MustTestLocales)) {
      if (getLocaleWeekdayNames(locale).length === 0) continue;
      const names = getLocaleWeekdayNames(locale);
      expect(names).toHaveLength(7);
      const iso = getLocaleWeekdayNames(locale, "long");
      expect(new Set(names)).toEqual(new Set(iso));
    }
  });

  // A well-formed tag with no locale data is not invalid input: ECMA-402 `ResolveLocale` falls
  // back to the host's default locale instead of throwing, so the sentinel would be wrong here.
  // Only the length is asserted, because the labels depend on the host locale.
  it("falls back for a well-formed tag with no locale data instead of returning []", () => {
    expect(getLocaleWeekdayNames("not-a-locale")).toHaveLength(7);
  });

  // ECMA-402 CanonicalizeLocaleList: `locale` may be a preference list; the first tag with locale
  // data is read (en-US weeks start on Sunday, fr-FR on Monday, ar-EG weekends are Friday and
  // Saturday: Intl.Locale#getWeekInfo), and a malformed tag anywhere in the list is invalid input.
  it.each`
    locale                                          | expected
    ${[MustTestLocales.frFR, MustTestLocales.enUS]} | ${["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"]}
    ${[MustTestLocales.frFR, "not a locale!!"]}     | ${[]}
    ${[42]}                                         | ${[]}
  `("returns $expected for locale list $locale", ({ locale, expected }) => {
    expect(getLocaleWeekdayNames(locale)).toEqual(expected);
  });
});
