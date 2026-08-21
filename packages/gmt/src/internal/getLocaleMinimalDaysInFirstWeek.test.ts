import { MustTestLocales } from "../test";
import { getLocaleMinimalDaysInFirstWeek } from "./getLocaleMinimalDaysInFirstWeek";

// `weekInfo.minimalDays` is itself CLDR/ICU-version-dependent — and on
// some V8 builds (observed on Node 24 / ICU 78) `weekInfo` doesn't expose
// `minimalDays` at all, for *any* locale, where Node 20/22 (ICU 77) does.
// Expectations are therefore derived from the runtime's own `weekInfo`
// (applying this function's own documented fallback-to-4 rule) rather
// than hardcoded per-locale numbers, so the test holds across ICU builds
// without masking an actual regression in the fallback logic itself.
function expectedMinimalDays(locale: string): number {
  const weekInfo = new Intl.Locale(locale).weekInfo;
  return typeof weekInfo.minimalDays === "number" ? weekInfo.minimalDays : 4;
}

describe("getLocaleMinimalDaysInFirstWeek", () => {
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
    "matches the runtime's own weekInfo (with the documented fallback) for $locale",
    ({ locale }) => {
      expect(getLocaleMinimalDaysInFirstWeek(locale)).toBe(
        expectedMinimalDays(locale),
      );
    },
  );

  // en-GB/de-DE/fr-FR's minimalDays=4 (the ISO 8601 value) has been
  // stable across every observed ICU build — pinned directly as a
  // regression check independent of the runtime-derived assertions above.
  it.each`
    locale
    ${MustTestLocales.enGB}
    ${MustTestLocales.deDE}
    ${MustTestLocales.frFR}
  `("returns 4 (ISO) for $locale", ({ locale }) => {
    expect(getLocaleMinimalDaysInFirstWeek(locale)).toBe(4);
  });

  it.each`
    locale
    ${"not-a-locale-!!"}
    ${""}
  `("returns null for invalid locale $locale", ({ locale }) => {
    expect(getLocaleMinimalDaysInFirstWeek(locale)).toBeNull();
  });
});
