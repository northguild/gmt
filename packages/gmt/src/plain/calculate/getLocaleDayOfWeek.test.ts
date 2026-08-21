import { Temporal } from "@js-temporal/polyfill";
import { MustTestLocales } from "../../test";
import { mockTemporalPlainDateFromThrow } from "../../test/mocks";
import { getLocaleDayOfWeek } from "./getLocaleDayOfWeek";

describe("getLocaleDayOfWeek", () => {
  // Full week boundary coverage for en-US: compute expected dynamically so
  // the test stays correct regardless of the runtime's weekInfo data.
  it.each`
    value           | expected
    ${"2024-02-25"} | ${0}
    ${"2024-02-26"} | ${1}
    ${"2024-02-27"} | ${2}
    ${"2024-02-28"} | ${3}
    ${"2024-02-29"} | ${4}
    ${"2024-03-01"} | ${5}
    ${"2024-03-02"} | ${6}
  `(
    "returns $expected for $value in en-US (full week boundary)",
    ({ value, _expected }) => {
      const firstDay = new Intl.Locale(MustTestLocales.enUS).weekInfo.firstDay;
      const date = Temporal.PlainDate.from(value);
      const computed = (date.dayOfWeek - firstDay + 7) % 7;
      expect(getLocaleDayOfWeek(value, MustTestLocales.enUS)).toBe(computed);
    },
  );

  // Full week boundary coverage for fr-FR.
  it.each`
    value           | expected
    ${"2024-02-26"} | ${0}
    ${"2024-02-27"} | ${1}
    ${"2024-02-28"} | ${2}
    ${"2024-02-29"} | ${3}
    ${"2024-03-01"} | ${4}
    ${"2024-03-02"} | ${5}
    ${"2024-03-03"} | ${6}
  `(
    "returns $expected for $value in fr-FR (full week boundary)",
    ({ value, _expected }) => {
      const firstDay = new Intl.Locale(MustTestLocales.frFR).weekInfo.firstDay;
      const date = Temporal.PlainDate.from(value);
      const computed = (date.dayOfWeek - firstDay + 7) % 7;
      expect(getLocaleDayOfWeek(value, MustTestLocales.frFR)).toBe(computed);
    },
  );

  // Full week boundary coverage for he-IL.
  it.each`
    value           | expected
    ${"2024-02-23"} | ${6}
    ${"2024-02-24"} | ${0}
    ${"2024-02-25"} | ${1}
    ${"2024-02-26"} | ${2}
    ${"2024-02-27"} | ${3}
    ${"2024-02-28"} | ${4}
    ${"2024-02-29"} | ${5}
  `(
    "returns $expected for $value in he-IL (full week boundary)",
    ({ value, _expected }) => {
      const firstDay = new Intl.Locale(MustTestLocales.heIL).weekInfo.firstDay;
      const date = Temporal.PlainDate.from(value);
      const computed = (date.dayOfWeek - firstDay + 7) % 7;
      expect(getLocaleDayOfWeek(value, MustTestLocales.heIL)).toBe(computed);
    },
  );

  // One representative Monday check per must-test locale.
  // 2024-02-26 is Monday (ISO day 1). Expected is computed dynamically from
  // the locale's first day of week so the table stays correct regardless of
  // CLDR shifts.
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
    ${MustTestLocales.isIS}
    ${MustTestLocales.zhCN}
    ${MustTestLocales.zhTW}
    ${MustTestLocales.jaJP}
    ${MustTestLocales.koKR}
    ${MustTestLocales.arSA}
    ${MustTestLocales.heIL}
    ${MustTestLocales.ruRU}
    ${MustTestLocales.trTR}
  `(
    "returns the computed locale-relative day-of-week for Monday 2024-02-26 in $locale",
    ({ locale }) => {
      const firstDay = new Intl.Locale(locale).weekInfo.firstDay;
      const date = Temporal.PlainDate.from("2024-02-26");
      const expected = (date.dayOfWeek - firstDay + 7) % 7;
      expect(getLocaleDayOfWeek("2024-02-26", locale)).toBe(expected);
    },
  );

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
    expect(getLocaleDayOfWeek(value, MustTestLocales.enUS)).toBeNull();
  });

  it.each`
    locale
    ${"not-a-locale-!!"}
    ${""}
    ${null}
    ${undefined}
  `("returns null for invalid locale $locale", ({ locale }) => {
    expect(getLocaleDayOfWeek("2024-02-26", locale)).toBeNull();
  });

  it("returns null when Temporal.PlainDate.from throws", () => {
    mockTemporalPlainDateFromThrow();
    expect(getLocaleDayOfWeek("2024-02-26", MustTestLocales.enUS)).toBeNull();
  });
});
