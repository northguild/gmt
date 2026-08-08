import { MustTestLocales } from "../../test/localeMatrix";
import { formatDuration } from "./formatDuration";

describe("formatDuration", () => {
  it.each`
    locale                  | expected
    ${MustTestLocales.enUS} | ${"1 day, 2 hours, and 30 minutes"}
    ${MustTestLocales.enGB} | ${"1 day, 2 hours and 30 minutes"}
    ${MustTestLocales.deDE} | ${"1 Tag, 2 Stunden und 30 Minuten"}
    ${MustTestLocales.frFR} | ${"1 jour, 2 heures et 30 minutes"}
    ${MustTestLocales.esES} | ${"1 día, 2 horas y 30 minutos"}
    ${MustTestLocales.itIT} | ${"1 giorno, 2 ore e 30 minuti"}
    ${MustTestLocales.ptPT} | ${"1 dia, 2 horas e 30 minutos"}
    ${MustTestLocales.svSE} | ${"1 dygn, 2 timmar och 30 minuter"}
    ${MustTestLocales.isIS} | ${"1 dagur, 2 klukkustundir og 30 mínútur"}
    ${MustTestLocales.zhCN} | ${"1天、2小时和30分钟"}
    ${MustTestLocales.zhTW} | ${"1 天、2 小時和30 分鐘"}
    ${MustTestLocales.jaJP} | ${"1 日、2 時間、30 分"}
    ${MustTestLocales.koKR} | ${"1일, 2시간 및 30분"}
    ${MustTestLocales.arSA} | ${"يوم وساعتان و٣٠ دقيقة"}
    ${MustTestLocales.heIL} | ${"1 יום, שעתיים ו-30 דקות"}
    ${MustTestLocales.ruRU} | ${"1 день, 2 часа и 30 минут"}
    ${MustTestLocales.trTR} | ${"1 gün, 2 saat ve 30 dakika"}
  `("renders P1DT2H30M for locale $locale", ({ locale, expected }) => {
    expect(formatDuration("P1DT2H30M", locale)).toBe(expected);
  });

  it.each`
    style       | expected
    ${"long"}   | ${"1 day, 2 hours, and 30 minutes"}
    ${"short"}  | ${"1 day, 2 hr, & 30 min"}
    ${"narrow"} | ${"1d, 2h, & 30m"}
  `(
    "renders P1DT2H30M with style $style as $expected",
    ({ style, expected }) => {
      expect(formatDuration("P1DT2H30M", "en-US", { style })).toBe(expected);
    },
  );

  it.each`
    value          | expected
    ${"P1Y2M3D"}   | ${"1 year, 2 months, and 3 days"}
    ${"P2W"}       | ${"2 weeks"}
    ${"PT5M"}      | ${"5 minutes"}
    ${"PT1.5S"}    | ${"1.5 seconds"}
    ${"P1DT0H30M"} | ${"1 day and 30 minutes"}
  `("renders $value as $expected", ({ value, expected }) => {
    expect(formatDuration(value, "en-US")).toBe(expected);
  });

  it("omits zero-valued components by default", () => {
    expect(formatDuration("P1DT0H30M", "en-US")).toBe("1 day and 30 minutes");
  });

  it("includes zero-valued components when zero: true", () => {
    expect(formatDuration("P1DT0H30M", "en-US", { zero: true })).toBe(
      "0 years, 0 months, 0 weeks, 1 day, 0 hours, 30 minutes, and 0 seconds",
    );
  });

  it("renders a zero-length duration as '0 seconds' even with the default zero-omitting behavior", () => {
    expect(formatDuration("PT0S", "en-US")).toBe("0 seconds");
  });

  it("renders negative durations with a leading '-' on each component", () => {
    expect(formatDuration("-P1DT2H", "en-US")).toBe("-1 day and -2 hours");
  });

  it.each`
    invalidValue
    ${"not a duration"}
    ${""}
  `(
    "returns an empty string for invalid value $invalidValue",
    ({ invalidValue }) => {
      expect(formatDuration(invalidValue)).toBe("");
    },
  );

  it.each`
    value
    ${null}
    ${undefined}
    ${5}
    ${true}
    ${false}
    ${["PT1H"]}
    ${{}}
    ${{ days: 1 }}
  `("returns an empty string for non-string input $value", ({ value }) => {
    expect(formatDuration(value as never)).toBe("");
  });
});
