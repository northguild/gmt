import { Temporal } from "@js-temporal/polyfill";
import { MustTestLocales } from "../../test";
import { mockTemporalPlainDateFromThrow } from "../../test/mocks";
import { getWeeksInLocaleWeekYear } from "./getWeeksInLocaleWeekYear";

// Independent reference implementation, driven by the runtime's own
// weekInfo rather than a hardcoded golden value — see
// getLocaleWeekYear.test.ts for why `minimalDays` specifically can't be
// pinned per-locale across ICU builds.
function referenceWeeksInLocaleWeekYear(value: string, locale: string): number {
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

  const bounds = week1Start(weekYear);
  const nextBounds = week1Start(weekYear + 1);
  return bounds.until(nextBounds, { largestUnit: "days" }).days / 7;
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
    "matches the reference computation for 2020-06-15 in $locale",
    ({ locale }) => {
      expect(getWeeksInLocaleWeekYear("2020-06-15", locale)).toBe(
        referenceWeeksInLocaleWeekYear("2020-06-15", locale),
      );
    },
  );

  it("returns 53 for a 53-week locale week-year, agreeing with the ISO rule in de-DE", () => {
    expect(getWeeksInLocaleWeekYear("2020-06-15", MustTestLocales.deDE)).toBe(
      53,
    );
  });

  it("returns 52 for a common locale week-year", () => {
    expect(getWeeksInLocaleWeekYear("2024-06-15", MustTestLocales.deDE)).toBe(
      52,
    );
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

  it("returns null when Temporal.PlainDate.from throws", () => {
    mockTemporalPlainDateFromThrow();
    expect(
      getWeeksInLocaleWeekYear("2024-06-15", MustTestLocales.enUS),
    ).toBeNull();
  });
});
