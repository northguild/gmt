import { Temporal } from "@js-temporal/polyfill";
import { MustTestLocales } from "../../test";
import { mockTemporalPlainDateFromThrow } from "../../test/mocks";
import { getLocaleWeekYear } from "./getLocaleWeekYear";

// Independent reference implementation of the "week 1 always contains
// January's minimalDays-th day" rule (see getLocaleWeekYearBounds.ts for
// the derivation), driven by the runtime's own weekInfo rather than a
// hardcoded golden value — `minimalDays` in particular is CLDR/ICU
// build-dependent, and on some V8 builds (Node 24/ICU 78) `weekInfo`
// doesn't expose it at all for any locale, unlike Node 20/22 (ICU 77).
// This keeps the matrix meaningful across ICU builds instead of pinning
// one snapshot's numbers.
function referenceLocaleWeekYear(value: string, locale: string): number {
  const weekInfo = new Intl.Locale(locale).weekInfo;
  const firstDay = weekInfo.firstDay;
  const minimalDays =
    typeof weekInfo.minimalDays === "number" ? weekInfo.minimalDays : 4;

  const week1Start = (year: number): Temporal.PlainDate => {
    const anchor = Temporal.PlainDate.from({
      year,
      month: 1,
      day: minimalDays,
    });
    const offset = (anchor.dayOfWeek - firstDay + 7) % 7;
    return anchor.subtract({ days: offset });
  };

  const date = Temporal.PlainDate.from(value);
  let weekYear = date.year;
  const start = week1Start(weekYear);
  if (Temporal.PlainDate.compare(date, start) < 0) {
    weekYear -= 1;
  } else {
    const nextStart = week1Start(weekYear + 1);
    if (Temporal.PlainDate.compare(date, nextStart) >= 0) {
      weekYear += 1;
    }
  }
  return weekYear;
}

describe("getLocaleWeekYear", () => {
  // 2022-01-01 is a Saturday, right at a year boundary where locales
  // whose week-numbering rule requires several January days (minimalDays
  // 4, ISO-style) disagree with locales where Jan 1 always counts
  // (minimalDays 1) — exercising exactly the case this function exists
  // for, across the full 17-locale matrix.
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
    ${MustTestLocales.zhCN}
    ${MustTestLocales.zhTW}
    ${MustTestLocales.jaJP}
    ${MustTestLocales.koKR}
    ${MustTestLocales.arSA}
    ${MustTestLocales.heIL}
    ${MustTestLocales.ruRU}
    ${MustTestLocales.trTR}
  `(
    "matches the reference computation for 2022-01-01 in $locale",
    ({ locale }) => {
      expect(getLocaleWeekYear("2022-01-01", locale)).toBe(
        referenceLocaleWeekYear("2022-01-01", locale),
      );
    },
  );

  // en-GB/de-DE (minimalDays 4, ISO-style) has been stable across every
  // observed ICU build — pinned directly as a regression check.
  it("returns 2021 for 2022-01-01 in de-DE, agreeing with the ISO rule", () => {
    expect(getLocaleWeekYear("2022-01-01", MustTestLocales.deDE)).toBe(2021);
  });

  it("returns 2020 for a date belonging to the previous locale week-year, symmetric to the year-forward case", () => {
    expect(getLocaleWeekYear("2020-12-27", MustTestLocales.deDE)).toBe(2020);
    expect(getLocaleWeekYear("2020-12-28", MustTestLocales.deDE)).toBe(2020);
  });

  it.each`
    value
    ${"invalid-date"}
    ${"2024-02-30"}
    ${"2024-02-29T00:00:00"}
    ${null}
    ${undefined}
    ${12}
    ${true}
    ${false}
  `("returns null for invalid value $value", ({ value }) => {
    expect(getLocaleWeekYear(value, MustTestLocales.enUS)).toBeNull();
  });

  it.each`
    locale
    ${"not-a-locale-!!"}
    ${""}
    ${null}
    ${undefined}
  `("returns null for invalid locale $locale", ({ locale }) => {
    expect(getLocaleWeekYear("2024-06-15", locale)).toBeNull();
  });

  it("returns null when Temporal.PlainDate.from throws", () => {
    mockTemporalPlainDateFromThrow();
    expect(getLocaleWeekYear("2024-06-15", MustTestLocales.enUS)).toBeNull();
  });
});
