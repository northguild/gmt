import { Temporal } from "@js-temporal/polyfill";
import { MustTestLocales } from "../../test";
import { mockTemporalPlainDateFromThrow } from "../../test/mocks";
import { runtimeWeekInfo } from "../../test/runtimeWeekInfo";
import { getWeeksInLocaleWeekYear } from "./getWeeksInLocaleWeekYear";

// Week 1 is the week starting on the locale's first day of week that holds at least `minimalDays`
// days of January (UTS #35 Part 4, Week Data), so it starts on that weekday on or before January
// `minimalDays`. `firstDay` is read from the runtime's own week data without importing GMT;
// `minimalDays` is always passed explicitly, because ECMA-402 no longer exposes it
// (tc39/proposal-intl-locale-info#86) and GMT defaults it to the ISO value on every runtime.
function week1Start(
  year: number,
  firstDay: number,
  minimalDays: number,
): Temporal.PlainDate {
  const anchor = Temporal.PlainDate.from({ year, month: 1, day: minimalDays });
  return anchor.subtract({ days: (anchor.dayOfWeek - firstDay + 7) % 7 });
}

function referenceWeekYear(
  value: string,
  firstDay: number,
  minimalDays: number,
): number {
  const date = Temporal.PlainDate.from(value);
  if (
    Temporal.PlainDate.compare(
      date,
      week1Start(date.year, firstDay, minimalDays),
    ) < 0
  ) {
    return date.year - 1;
  }
  if (
    Temporal.PlainDate.compare(
      date,
      week1Start(date.year + 1, firstDay, minimalDays),
    ) >= 0
  ) {
    return date.year + 1;
  }
  return date.year;
}

function referenceWeeks(
  value: string,
  firstDay: number,
  minimalDays: number,
): number {
  const weekYear = referenceWeekYear(value, firstDay, minimalDays);
  return (
    week1Start(weekYear, firstDay, minimalDays).until(
      week1Start(weekYear + 1, firstDay, minimalDays),
      { largestUnit: "days" },
    ).days / 7
  );
}

describe("getWeeksInLocaleWeekYear", () => {
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
    "matches the reference for 2022-06-15 in $locale, under the ISO default and minimalDays 1",
    ({ locale }) => {
      const { firstDay } = runtimeWeekInfo(locale);
      expect(getWeeksInLocaleWeekYear("2022-06-15", locale)).toBe(
        referenceWeeks("2022-06-15", firstDay, 4),
      );
      expect(
        getWeeksInLocaleWeekYear("2022-06-15", locale, { minimalDays: 1 }),
      ).toBe(referenceWeeks("2022-06-15", firstDay, 1));
    },
  );

  // Derived by hand, en-US weeks starting on Sunday. minimalDays 1: 2022's week 1 starts
  // 2021-12-26 and 2023's starts 2023-01-01, 371 days. minimalDays 4: 2022-01-02 to 2023-01-01,
  // 364 days. The undefined row is the cross-runtime pin (Node 22 reports minimalDays 1 for en-US).
  it.each`
    value           | locale                  | options               | expected
    ${"2022-06-15"} | ${MustTestLocales.enUS} | ${undefined}          | ${52}
    ${"2022-06-15"} | ${MustTestLocales.enUS} | ${{ minimalDays: 1 }} | ${53}
    ${"2020-06-15"} | ${MustTestLocales.enUS} | ${{ minimalDays: 1 }} | ${52}
    ${"2020-06-15"} | ${MustTestLocales.enUS} | ${undefined}          | ${53}
    ${"2020-06-15"} | ${MustTestLocales.deDE} | ${undefined}          | ${53}
    ${"2024-06-15"} | ${MustTestLocales.deDE} | ${undefined}          | ${52}
  `(
    "returns $expected for $value in $locale with $options",
    ({ value, locale, options, expected }) => {
      expect(getWeeksInLocaleWeekYear(value, locale, options)).toBe(expected);
    },
  );

  it.each`
    minimalDays
    ${0}
    ${8}
    ${1.5}
    ${Number.NaN}
    ${"4"}
  `("returns null for minimalDays $minimalDays", ({ minimalDays }) => {
    expect(
      getWeeksInLocaleWeekYear("2024-06-15", MustTestLocales.enUS, {
        minimalDays,
      }),
    ).toBeNull();
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
    expect(getWeeksInLocaleWeekYear(value, MustTestLocales.enUS)).toBeNull();
  });

  it.each`
    locale
    ${"not-a-locale-!!"}
    ${""}
    ${null}
    ${undefined}
  `("returns null for invalid locale $locale", ({ locale }) => {
    expect(getWeeksInLocaleWeekYear("2024-06-15", locale)).toBeNull();
  });

  // Range edges, from proleptic Gregorian day arithmetic (days-from-civil), not GMT. Week-year
  // +275760 under a Sunday-first, minimalDays 4 rule runs from epoch day 99,999,742 to 100,000,113:
  // 371 days, 53 weeks, though its end lies past the last PlainDate. Week-year -271820 (reached from
  // -271821-12-31 with minimalDays 1) starts on that Sunday and spans 53 weeks.
  it.each`
    value              | locale                  | minimalDays | expected
    ${"-271821-04-19"} | ${MustTestLocales.enUS} | ${4}        | ${52}
    ${"-271821-06-01"} | ${MustTestLocales.deDE} | ${4}        | ${52}
    ${"-271821-12-31"} | ${MustTestLocales.enUS} | ${1}        | ${53}
    ${"+275760-01-01"} | ${MustTestLocales.enUS} | ${4}        | ${53}
    ${"+275760-09-13"} | ${MustTestLocales.enUS} | ${4}        | ${53}
    ${"+275760-06-01"} | ${MustTestLocales.enUS} | ${1}        | ${52}
    ${"+275760-09-13"} | ${MustTestLocales.deDE} | ${4}        | ${52}
  `(
    "returns $expected weeks for the range-edge date $value in $locale with minimalDays $minimalDays",
    ({ value, locale, minimalDays, expected }) => {
      expect(getWeeksInLocaleWeekYear(value, locale, { minimalDays })).toBe(
        expected,
      );
    },
  );

  it("returns null when Temporal.PlainDate.from throws", () => {
    mockTemporalPlainDateFromThrow();
    expect(
      getWeeksInLocaleWeekYear("2024-06-15", MustTestLocales.enUS),
    ).toBeNull();
  });

  // ECMA-402 CanonicalizeLocaleList: `locale` may be a preference list; the first tag with locale
  // data is read (en-US weeks start on Sunday, fr-FR on Monday, ar-EG weekends are Friday and
  // Saturday: Intl.Locale#getWeekInfo), and a malformed tag anywhere in the list is invalid input.
  it.each`
    locale                                          | expected
    ${[MustTestLocales.enUS, MustTestLocales.frFR]} | ${53}
    ${[MustTestLocales.frFR, MustTestLocales.enUS]} | ${52}
    ${[MustTestLocales.frFR, "not a locale!!"]}     | ${null}
  `(
    "returns $expected for Sunday 2024-12-29 (en-US week-year 2025 runs 2024-12-29 to 2026-01-03, 371 days) with locale list $locale",
    ({ locale, expected }) => {
      expect(getWeeksInLocaleWeekYear("2024-12-29", locale)).toBe(expected);
    },
  );
});
