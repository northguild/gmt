import { normalizeDateTime } from "../../internal";
import {
  expectDateTimeEqual,
  expectOneOfIcu,
  localeDateTimeRangeInputByLocale,
  MustTestLocales,
  oneOfIcu,
} from "../../test";
import { formatDateTimeRange } from "./formatDateTimeRange";

describe("formatDateTimeRange", () => {
  const rangeByLocale = localeDateTimeRangeInputByLocale;

  it.each`
    locale                  | options                                       | expected
    ${MustTestLocales.enUS} | ${{ dateStyle: "long", timeStyle: "long" }}   | ${"February 3, 2024, 2:30:45 PM – 4:46:15 PM"}
    ${MustTestLocales.enUS} | ${{ dateStyle: "short", timeStyle: "short" }} | ${"2/3/24, 2:30 – 4:46 PM"}
    ${MustTestLocales.enUS} | ${{ hour: "numeric", minute: "numeric" }}     | ${"2:30 – 4:46 PM"}
    ${MustTestLocales.enGB} | ${{ dateStyle: "long", timeStyle: "long" }}   | ${"3 February 2024, 14:30:45 – 16:46:15"}
    ${MustTestLocales.enGB} | ${{ dateStyle: "short", timeStyle: "short" }} | ${"03/02/2024, 14:30–16:46"}
    ${MustTestLocales.enGB} | ${{ hour: "numeric", minute: "numeric" }}     | ${"14:30–16:46"}
    ${MustTestLocales.deDE} | ${{ dateStyle: "long", timeStyle: "long" }}   | ${"3. Februar 2024, 14:30:45 – 16:46:15"}
    ${MustTestLocales.deDE} | ${{ dateStyle: "short", timeStyle: "short" }} | ${"03.02.24, 14:30–16:46 Uhr"}
    ${MustTestLocales.deDE} | ${{ hour: "numeric", minute: "numeric" }}     | ${"14:30–16:46 Uhr"}
    ${MustTestLocales.frFR} | ${{ dateStyle: "long", timeStyle: "long" }}   | ${"3 février 2024, 14:30:45 – 16:46:15"}
    ${MustTestLocales.frFR} | ${{ dateStyle: "short", timeStyle: "short" }} | ${"03/02/2024, 14:30 – 16:46"}
    ${MustTestLocales.frFR} | ${{ hour: "numeric", minute: "numeric" }}     | ${"14:30 – 16:46"}
    ${MustTestLocales.esES} | ${{ dateStyle: "long", timeStyle: "long" }}   | ${"3 de febrero de 2024, 14:30:45 – 16:46:15"}
    ${MustTestLocales.esES} | ${{ dateStyle: "short", timeStyle: "short" }} | ${"3/2/24, 14:30–16:46"}
    ${MustTestLocales.esES} | ${{ hour: "numeric", minute: "numeric" }}     | ${"14:30–16:46"}
    ${MustTestLocales.itIT} | ${{ dateStyle: "long", timeStyle: "long" }}   | ${"3 febbraio 2024, 14:30:45 – 16:46:15"}
    ${MustTestLocales.itIT} | ${{ dateStyle: "short", timeStyle: "short" }} | ${"03/02/24, 14:30–16:46"}
    ${MustTestLocales.itIT} | ${{ hour: "numeric", minute: "numeric" }}     | ${"14:30–16:46"}
    ${MustTestLocales.ptPT} | ${{ dateStyle: "long", timeStyle: "long" }}   | ${"3 de fevereiro de 2024, 14:30:45 – 16:46:15"}
    ${MustTestLocales.ptPT} | ${{ dateStyle: "short", timeStyle: "short" }} | ${"03/02/24, 14:30 – 16:46"}
    ${MustTestLocales.ptPT} | ${{ hour: "numeric", minute: "numeric" }}     | ${"14:30 – 16:46"}
    ${MustTestLocales.svSE} | ${{ dateStyle: "short", timeStyle: "short" }} | ${"2024-02-03 14:30–16:46"}
    ${MustTestLocales.svSE} | ${{ hour: "numeric", minute: "numeric" }}     | ${"14:30–16:46"}
    ${MustTestLocales.isIS} | ${{ dateStyle: "long", timeStyle: "long" }}   | ${"3. febrúar 2024, 14:30:45 – 16:46:15"}
    ${MustTestLocales.isIS} | ${{ dateStyle: "short", timeStyle: "short" }} | ${"3.2.2024, 14:30–16:46"}
    ${MustTestLocales.isIS} | ${{ hour: "numeric", minute: "numeric" }}     | ${"14:30–16:46"}
    ${MustTestLocales.zhCN} | ${{ dateStyle: "long", timeStyle: "long" }}   | ${"2024/2/3 14:30:45 – 16:46:15"}
    ${MustTestLocales.zhCN} | ${{ dateStyle: "short", timeStyle: "short" }} | ${"2024/2/3 14:30–16:46"}
    ${MustTestLocales.zhCN} | ${{ hour: "numeric", minute: "numeric" }}     | ${"14:30–16:46"}
    ${MustTestLocales.jaJP} | ${{ dateStyle: "long", timeStyle: "long" }}   | ${"2024/2/3 14:30:45～16:46:15"}
    ${MustTestLocales.jaJP} | ${{ dateStyle: "short", timeStyle: "short" }} | ${"2024/02/03 14時30分～16時46分"}
    ${MustTestLocales.jaJP} | ${{ hour: "numeric", minute: "numeric" }}     | ${"14時30分～16時46分"}
    ${MustTestLocales.arSA} | ${{ dateStyle: "long", timeStyle: "long" }}   | ${"٣ فبراير ٢٠٢٤، ٢:٣٠:٤٥ م – ٤:٤٦:١٥ م"}
    ${MustTestLocales.arSA} | ${{ dateStyle: "short", timeStyle: "short" }} | ${"٣‏/٢‏/٢٠٢٤، ٢:٣٠–٤:٤٦ م"}
    ${MustTestLocales.arSA} | ${{ hour: "numeric", minute: "numeric" }}     | ${"٢:٣٠–٤:٤٦ م"}
    ${MustTestLocales.heIL} | ${{ dateStyle: "long", timeStyle: "long" }}   | ${"3 בפברואר 2024, 14:30:45 – 16:46:15"}
    ${MustTestLocales.heIL} | ${{ dateStyle: "short", timeStyle: "short" }} | ${"3.2.2024, 14:30–16:46"}
    ${MustTestLocales.heIL} | ${{ hour: "numeric", minute: "numeric" }}     | ${"14:30–16:46"}
    ${MustTestLocales.ruRU} | ${{ dateStyle: "long", timeStyle: "long" }}   | ${"3 февраля 2024 г., 14:30:45 – 16:46:15"}
    ${MustTestLocales.ruRU} | ${{ dateStyle: "short", timeStyle: "short" }} | ${"03.02.2024, 14:30–16:46"}
    ${MustTestLocales.ruRU} | ${{ hour: "numeric", minute: "numeric" }}     | ${"14:30–16:46"}
    ${MustTestLocales.trTR} | ${{ dateStyle: "long", timeStyle: "long" }}   | ${"3 Şubat 2024 14:30:45 – 16:46:15"}
    ${MustTestLocales.trTR} | ${{ dateStyle: "short", timeStyle: "short" }} | ${"3.02.2024 14:30–16:46"}
    ${MustTestLocales.trTR} | ${{ hour: "numeric", minute: "numeric" }}     | ${"14:30–16:46"}
  `(
    "formats a valid datetime range for locale $locale with options $options",
    ({ locale, options, expected }) => {
      const { start, end } =
        rangeByLocale[locale as keyof typeof rangeByLocale];
      expect(formatDateTimeRange(start, end, locale, options)).toBe(
        normalizeDateTime(expected),
      );
    },
  );

  // sv-SE long/long — ICU 77 (Node 20) renders the digit-adjacent en dash
  // with no surrounding space; ICU 78 (Node 22/24) inserts a space around
  // it. Same CLDR range-separator spacing revision as formatDateRange's
  // en-GB/sv-SE cases.
  it("formats a valid datetime range for sv-SE with dateStyle/timeStyle long as one of the known ICU variants", () => {
    const { start, end } = rangeByLocale[MustTestLocales.svSE];
    expectOneOfIcu(
      formatDateTimeRange(start, end, MustTestLocales.svSE, {
        dateStyle: "long",
        timeStyle: "long",
      }),
      oneOfIcu(
        normalizeDateTime("3 februari 2024 14:30:45-16:46:15"),
        normalizeDateTime("3 februari 2024 14:30:45 - 16:46:15"),
      ),
    );
  });

  // zh-TW and ko-KR render a day-period marker (下午/오후) that some ICU
  // builds render as ASCII "PM" instead — see icuVariants.ts.
  it.each`
    locale                  | options                                       | expected
    ${MustTestLocales.zhTW} | ${{ dateStyle: "long", timeStyle: "long" }}   | ${"2024/2/3 下午2:30:45 – 下午4:46:15"}
    ${MustTestLocales.zhTW} | ${{ dateStyle: "short", timeStyle: "short" }} | ${"2024/2/3 下午2:30–4:46"}
    ${MustTestLocales.zhTW} | ${{ hour: "numeric", minute: "numeric" }}     | ${"下午2:30至4:46"}
    ${MustTestLocales.koKR} | ${{ dateStyle: "long", timeStyle: "long" }}   | ${"2024년 2월 3일 오후 2:30:45 ~ 오후 4:46:15"}
    ${MustTestLocales.koKR} | ${{ dateStyle: "short", timeStyle: "short" }} | ${"24. 2. 3. 오후 2:30~4:46"}
    ${MustTestLocales.koKR} | ${{ hour: "numeric", minute: "numeric" }}     | ${"오후 2:30~4:46"}
  `(
    "formats a valid datetime range for locale $locale with options $options (day-period tolerant)",
    ({ locale, options, expected }) => {
      const { start, end } =
        rangeByLocale[locale as keyof typeof rangeByLocale];
      expectDateTimeEqual(
        formatDateTimeRange(start, end, locale, options),
        normalizeDateTime(expected),
      );
    },
  );

  it.each`
    scenario        | start                    | end                      | expected
    ${"same-day"}   | ${"2024-02-03T09:00:00"} | ${"2024-02-03T17:00:00"} | ${"February 3, 2024, 9:00 AM – 5:00 PM"}
    ${"same-month"} | ${"2024-02-03T09:00:00"} | ${"2024-02-10T17:00:00"} | ${"February 3, 2024 at 9:00 AM – February 10, 2024 at 5:00 PM"}
    ${"same-year"}  | ${"2024-02-03T09:00:00"} | ${"2024-06-10T17:00:00"} | ${"February 3, 2024 at 9:00 AM – June 10, 2024 at 5:00 PM"}
    ${"cross-year"} | ${"2024-11-03T09:00:00"} | ${"2025-02-10T17:00:00"} | ${"November 3, 2024 at 9:00 AM – February 10, 2025 at 5:00 PM"}
    ${"reversed"}   | ${"2024-02-10T17:00:00"} | ${"2024-02-03T09:00:00"} | ${"February 10, 2024 at 5:00 PM – February 3, 2024 at 9:00 AM"}
    ${"identical"}  | ${"2024-02-03T09:00:00"} | ${"2024-02-03T09:00:00"} | ${"February 3, 2024 at 9:00 AM"}
  `(
    "collapses/elides correctly for a $scenario range ($start -> $end)",
    ({ start, end, expected }) => {
      expect(
        formatDateTimeRange(start, end, MustTestLocales.enUS, {
          dateStyle: "long",
          timeStyle: "short",
        }),
      ).toBe(normalizeDateTime(expected));
    },
  );

  it.each`
    start                    | end
    ${"invalid"}             | ${"2024-02-05T17:00:00"}
    ${"2024-02-03T09:00:00"} | ${"invalid"}
    ${"invalid"}             | ${"invalid"}
    ${"2024-02-30T09:00:00"} | ${"2024-02-05T17:00:00"}
    ${""}                    | ${"2024-02-05T17:00:00"}
    ${null}                  | ${"2024-02-05T17:00:00"}
    ${undefined}             | ${"2024-02-05T17:00:00"}
    ${123}                   | ${"2024-02-05T17:00:00"}
  `(
    "returns empty string when either endpoint is invalid or non-string: $start -> $end",
    ({ start, end }) => {
      expect(
        formatDateTimeRange(start as never, end, MustTestLocales.enUS),
      ).toBe("");
    },
  );
});
