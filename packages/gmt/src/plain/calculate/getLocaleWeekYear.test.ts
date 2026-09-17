import { Temporal } from "@js-temporal/polyfill";
import { MustTestLocales } from "../../test";
import { mockTemporalPlainDateFromThrow } from "../../test/mocks";
import { runtimeWeekInfo } from "../../test/runtimeWeekInfo";
import { getLocaleWeekYear } from "./getLocaleWeekYear";

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

describe("getLocaleWeekYear", () => {
  // 2022-01-01 is a Saturday: the week-year boundary where minimalDays 1 and 4 disagree.
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
    "matches the reference for 2022-01-01 in $locale, under the ISO default and minimalDays 1",
    ({ locale }) => {
      const { firstDay } = runtimeWeekInfo(locale);
      expect(getLocaleWeekYear("2022-01-01", locale)).toBe(
        referenceWeekYear("2022-01-01", firstDay, 4),
      );
      expect(getLocaleWeekYear("2022-01-01", locale, { minimalDays: 1 })).toBe(
        referenceWeekYear("2022-01-01", firstDay, 1),
      );
    },
  );

  // Derived by hand. en-US weeks start on Sunday; the week of Sunday 2021-12-26 holds one day of
  // 2022. With minimalDays 1 that is enough, so it is week 1 of 2022; with 4 it is not.
  // This row is the cross-runtime pin: Node 22 still reports minimalDays 1 for en-US, and the
  // default must ignore it.
  it.each`
    value           | locale                  | options               | expected
    ${"2022-01-01"} | ${MustTestLocales.enUS} | ${undefined}          | ${2021}
    ${"2022-01-01"} | ${MustTestLocales.enUS} | ${{ minimalDays: 1 }} | ${2022}
    ${"2022-01-01"} | ${MustTestLocales.enUS} | ${{ minimalDays: 4 }} | ${2021}
    ${"2021-12-26"} | ${MustTestLocales.enUS} | ${{ minimalDays: 1 }} | ${2022}
    ${"2021-12-25"} | ${MustTestLocales.enUS} | ${{ minimalDays: 1 }} | ${2021}
    ${"2022-01-01"} | ${MustTestLocales.deDE} | ${undefined}          | ${2021}
    ${"2020-12-28"} | ${MustTestLocales.deDE} | ${undefined}          | ${2020}
    ${"2024-06-15"} | ${MustTestLocales.enUS} | ${undefined}          | ${2024}
  `(
    "returns $expected for $value in $locale with $options",
    ({ value, locale, options, expected }) => {
      expect(getLocaleWeekYear(value, locale, options)).toBe(expected);
    },
  );

  it.each`
    minimalDays
    ${0}
    ${8}
    ${-1}
    ${1.5}
    ${Number.NaN}
    ${"1"}
    ${null}
  `("returns null for minimalDays $minimalDays", ({ minimalDays }) => {
    expect(
      getLocaleWeekYear("2022-01-01", MustTestLocales.enUS, { minimalDays }),
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

  // Range edges, from proleptic Gregorian day arithmetic (days-from-civil), not GMT: week 1 of
  // -271821 starts before the range and week 1 of +275761 after it, yet the dates between still
  // have a week-year. -271821-12-31 is a Sunday, so with minimalDays 1 its Sunday-first week holds
  // January 1 of -271820 and belongs to that week-year.
  it.each`
    value              | locale                  | minimalDays | expected
    ${"-271821-04-19"} | ${MustTestLocales.enUS} | ${4}        | ${-271821}
    ${"-271821-06-01"} | ${MustTestLocales.deDE} | ${4}        | ${-271821}
    ${"-271821-12-31"} | ${MustTestLocales.enUS} | ${4}        | ${-271821}
    ${"-271821-12-31"} | ${MustTestLocales.enUS} | ${1}        | ${-271820}
    ${"+275760-01-01"} | ${MustTestLocales.enUS} | ${4}        | ${275760}
    ${"+275760-06-01"} | ${MustTestLocales.enUS} | ${1}        | ${275760}
    ${"+275760-09-13"} | ${MustTestLocales.deDE} | ${4}        | ${275760}
  `(
    "returns week-year $expected for the range-edge date $value in $locale with minimalDays $minimalDays",
    ({ value, locale, minimalDays, expected }) => {
      expect(getLocaleWeekYear(value, locale, { minimalDays })).toBe(expected);
    },
  );

  it("returns null when Temporal.PlainDate.from throws", () => {
    mockTemporalPlainDateFromThrow();
    expect(getLocaleWeekYear("2024-06-15", MustTestLocales.enUS)).toBeNull();
  });

  // ECMA-402 CanonicalizeLocaleList: `locale` may be a preference list; the first tag with locale
  // data is read (en-US weeks start on Sunday, fr-FR on Monday, ar-EG weekends are Friday and
  // Saturday: Intl.Locale#getWeekInfo), and a malformed tag anywhere in the list is invalid input.
  it.each`
    locale                                          | expected
    ${[MustTestLocales.enUS, MustTestLocales.frFR]} | ${2025}
    ${[MustTestLocales.frFR, MustTestLocales.enUS]} | ${2024}
    ${[MustTestLocales.frFR, "not a locale!!"]}     | ${null}
  `(
    "returns $expected for Sunday 2024-12-29 (minimalDays 4) with locale list $locale",
    ({ locale, expected }) => {
      expect(getLocaleWeekYear("2024-12-29", locale)).toBe(expected);
    },
  );
});
