import { Temporal } from "@js-temporal/polyfill";
import { MustTestLocales, expectOneOfIcu, oneOfIcu } from "../../test";
import { formatTimeZoneName } from "./formatTimeZoneName";

// A fixed standard-time instant for America/New_York (mid-January), so
// season-dependent styles ("short"/"long"/"shortOffset"/"longOffset") are
// deterministic across test runs regardless of the real wall-clock date.
const JANUARY_INSTANT = Temporal.Instant.from("2024-01-15T12:00:00Z");
const JULY_INSTANT = Temporal.Instant.from("2024-07-15T12:00:00Z");

function mockNow(instant: Temporal.Instant): () => void {
  const spy = vi.spyOn(Temporal.Now, "instant").mockReturnValue(instant);
  return () => spy.mockRestore();
}

describe("formatTimeZoneName", () => {
  describe("season-independent styles (shortGeneric/longGeneric)", () => {
    it.each`
      locale                  | shortGeneric             | longGeneric
      ${MustTestLocales.enUS} | ${"ET"}                  | ${"Eastern Time"}
      ${MustTestLocales.enGB} | ${"New York Time"}       | ${"Eastern Time"}
      ${MustTestLocales.deDE} | ${"New York (Ortszeit)"} | ${"Nordamerikanische Ostküstenzeit"}
      ${MustTestLocales.frFR} | ${"heure : New York"}    | ${"heure de l’Est nord-américain"}
      ${MustTestLocales.esES} | ${"hora de Nueva York"}  | ${"hora oriental"}
      ${MustTestLocales.itIT} | ${"Ora New York"}        | ${"Ora orientale USA"}
      ${MustTestLocales.ptPT} | ${"Hora de Nova Iorque"} | ${"Hora oriental norte-americana"}
      ${MustTestLocales.svSE} | ${"New Yorktid"}         | ${"östnordamerikansk tid"}
      ${MustTestLocales.isIS} | ${"New York"}            | ${"Tími í austurhluta Bandaríkjanna og Kanada"}
      ${MustTestLocales.zhCN} | ${"纽约时间"}            | ${"北美东部时间"}
      ${MustTestLocales.zhTW} | ${"ET"}                  | ${"東部時間"}
      ${MustTestLocales.jaJP} | ${"ニューヨーク時間"}    | ${oneOfIcu("アメリカ東部時間", "米国東部時間")}
      ${MustTestLocales.koKR} | ${"뉴욕 시간"}           | ${"미 동부 시간"}
      ${MustTestLocales.arSA} | ${"توقيت نيويورك"}       | ${"التوقيت الشرقي لأمريكا الشمالية"}
      ${MustTestLocales.heIL} | ${"שעון ניו יורק"}       | ${"שעון החוף המזרחי"}
      ${MustTestLocales.ruRU} | ${"Нью-Йорк"}            | ${"Восточная Америка"}
      ${MustTestLocales.trTR} | ${"New York Saati"}      | ${"Kuzey Amerika Doğu Saati"}
    `(
      "returns the same name in January and July for $locale",
      ({ locale, shortGeneric, longGeneric }) => {
        // `longGeneric` may be a plain string or, for a locale/style pair
        // known to vary by ICU/CLDR version (see icuVariants.ts), an
        // `oneOfIcu(...)` set of acceptable strings.
        const expectLongGeneric = (actual: string) => {
          if (longGeneric instanceof Set) {
            expectOneOfIcu(actual, longGeneric);
          } else {
            expect(actual).toBe(longGeneric);
          }
        };

        const restoreJan = mockNow(JANUARY_INSTANT);
        expect(
          formatTimeZoneName("America/New_York", locale, {
            style: "shortGeneric",
          }),
        ).toBe(shortGeneric);
        expectLongGeneric(
          formatTimeZoneName("America/New_York", locale, {
            style: "longGeneric",
          }),
        );
        restoreJan();

        const restoreJul = mockNow(JULY_INSTANT);
        expect(
          formatTimeZoneName("America/New_York", locale, {
            style: "shortGeneric",
          }),
        ).toBe(shortGeneric);
        expectLongGeneric(
          formatTimeZoneName("America/New_York", locale, {
            style: "longGeneric",
          }),
        );
        restoreJul();
      },
    );
  });

  describe("season-dependent styles (short/long/shortOffset/longOffset)", () => {
    it("returns the standard-time name in January and the daylight name in July", () => {
      const restoreJan = mockNow(JANUARY_INSTANT);
      expect(
        formatTimeZoneName("America/New_York", "en-US", { style: "short" }),
      ).toBe("EST");
      expect(
        formatTimeZoneName("America/New_York", "en-US", { style: "long" }),
      ).toBe("Eastern Standard Time");
      expect(
        formatTimeZoneName("America/New_York", "en-US", {
          style: "shortOffset",
        }),
      ).toBe("GMT-5");
      expect(
        formatTimeZoneName("America/New_York", "en-US", {
          style: "longOffset",
        }),
      ).toBe("GMT-05:00");
      restoreJan();

      const restoreJul = mockNow(JULY_INSTANT);
      expect(
        formatTimeZoneName("America/New_York", "en-US", { style: "short" }),
      ).toBe("EDT");
      expect(
        formatTimeZoneName("America/New_York", "en-US", { style: "long" }),
      ).toBe("Eastern Daylight Time");
      expect(
        formatTimeZoneName("America/New_York", "en-US", {
          style: "shortOffset",
        }),
      ).toBe("GMT-4");
      restoreJul();
    });
  });

  it("defaults to the long style when options are omitted", () => {
    const restore = mockNow(JANUARY_INSTANT);
    expect(formatTimeZoneName("America/New_York", "en-US")).toBe(
      "Eastern Standard Time",
    );
    restore();
  });

  it("formats a zone with no DST identically regardless of the current instant", () => {
    const restoreJan = mockNow(JANUARY_INSTANT);
    expect(formatTimeZoneName("Asia/Tokyo", "en-US", { style: "long" })).toBe(
      "Japan Standard Time",
    );
    restoreJan();

    const restoreJul = mockNow(JULY_INSTANT);
    expect(formatTimeZoneName("Asia/Tokyo", "en-US", { style: "long" })).toBe(
      "Japan Standard Time",
    );
    restoreJul();
  });

  it.each`
    timeZone
    ${"Not/AZone"}
    ${""}
    ${null}
    ${undefined}
    ${123}
  `("returns '' for invalid timeZone $timeZone", ({ timeZone }) => {
    expect(formatTimeZoneName(timeZone as never, "en-US")).toBe("");
  });

  it.each`
    locale
    ${"!!!"}
    ${""}
    ${null}
    ${undefined}
  `("returns '' for invalid locale $locale", ({ locale }) => {
    expect(formatTimeZoneName("America/New_York", locale as never)).toBe("");
  });
});
