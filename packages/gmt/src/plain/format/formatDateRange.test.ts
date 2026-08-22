import { normalizeDateTime } from "../../internal";
import {
  expectOneOfIcu,
  localeDateRangeInputByLocale,
  MustTestLocales,
  oneOfIcu,
} from "../../test";
import { formatDateRange } from "./formatDateRange";

describe("formatDateRange", () => {
  const rangeByLocale = localeDateRangeInputByLocale;

  it.each`
    locale                  | options                   | expected
    ${MustTestLocales.enUS} | ${{ dateStyle: "long" }}  | ${"February 3 – 5, 2024"}
    ${MustTestLocales.enUS} | ${{ dateStyle: "short" }} | ${"2/3/24 – 2/5/24"}
    ${MustTestLocales.enGB} | ${{ dateStyle: "short" }} | ${"03/02/2024 – 05/02/2024"}
    ${MustTestLocales.deDE} | ${{ dateStyle: "long" }}  | ${"3.–5. Februar 2024"}
    ${MustTestLocales.deDE} | ${{ dateStyle: "short" }} | ${"03.–05.02.24"}
    ${MustTestLocales.frFR} | ${{ dateStyle: "long" }}  | ${"3–5 février 2024"}
    ${MustTestLocales.frFR} | ${{ dateStyle: "short" }} | ${"03/02/2024 – 05/02/2024"}
    ${MustTestLocales.esES} | ${{ dateStyle: "long" }}  | ${"3–5 de febrero de 2024"}
    ${MustTestLocales.esES} | ${{ dateStyle: "short" }} | ${"3/2/24 – 5/2/24"}
    ${MustTestLocales.itIT} | ${{ dateStyle: "long" }}  | ${"03–05 febbraio 2024"}
    ${MustTestLocales.itIT} | ${{ dateStyle: "short" }} | ${"03/02/24 – 05/02/24"}
    ${MustTestLocales.ptPT} | ${{ dateStyle: "long" }}  | ${"3–5 de fevereiro de 2024"}
    ${MustTestLocales.ptPT} | ${{ dateStyle: "short" }} | ${"03/02/24 – 05/02/24"}
    ${MustTestLocales.svSE} | ${{ dateStyle: "long" }}  | ${"3–5 februari 2024"}
    ${MustTestLocales.isIS} | ${{ dateStyle: "long" }}  | ${"3.–5. febrúar 2024"}
    ${MustTestLocales.isIS} | ${{ dateStyle: "short" }} | ${"3.2.2024 – 5.2.2024"}
    ${MustTestLocales.zhCN} | ${{ dateStyle: "long" }}  | ${"2024/2/3 – 2024/2/5"}
    ${MustTestLocales.zhCN} | ${{ dateStyle: "short" }} | ${"2024/2/3 – 2024/2/5"}
    ${MustTestLocales.zhTW} | ${{ dateStyle: "long" }}  | ${"2024/2/3至2024/2/5"}
    ${MustTestLocales.zhTW} | ${{ dateStyle: "short" }} | ${"2024/2/3至2024/2/5"}
    ${MustTestLocales.jaJP} | ${{ dateStyle: "long" }}  | ${"2024/02/03～2024/02/05"}
    ${MustTestLocales.jaJP} | ${{ dateStyle: "short" }} | ${"2024/02/03～2024/02/05"}
    ${MustTestLocales.koKR} | ${{ dateStyle: "long" }}  | ${"2024년 2월 3일~5일"}
    ${MustTestLocales.koKR} | ${{ dateStyle: "short" }} | ${"24. 2. 3. ~ 24. 2. 5."}
    ${MustTestLocales.arSA} | ${{ dateStyle: "long" }}  | ${"٣–٥ فبراير ٢٠٢٤"}
    ${MustTestLocales.arSA} | ${{ dateStyle: "short" }} | ${"٣‏/٢‏/٢٠٢٤ – ٥‏/٢‏/٢٠٢٤"}
    ${MustTestLocales.heIL} | ${{ dateStyle: "long" }}  | ${"3–5 בפברואר 2024"}
    ${MustTestLocales.heIL} | ${{ dateStyle: "short" }} | ${"03.2.2024 – 05.2.2024"}
    ${MustTestLocales.ruRU} | ${{ dateStyle: "long" }}  | ${"3–5 февраля 2024 г."}
    ${MustTestLocales.ruRU} | ${{ dateStyle: "short" }} | ${"03.02.2024–05.02.2024"}
    ${MustTestLocales.trTR} | ${{ dateStyle: "long" }}  | ${"3–5 Şubat 2024"}
    ${MustTestLocales.trTR} | ${{ dateStyle: "short" }} | ${"03.02.2024 – 05.02.2024"}
  `(
    "formats a valid date range for locale $locale with options $options",
    ({ locale, options, expected }) => {
      const { start, end } =
        rangeByLocale[locale as keyof typeof rangeByLocale];
      expect(formatDateRange(start, end, locale, options)).toBe(
        normalizeDateTime(expected),
      );
    },
  );

  // en-GB long and sv-SE short — ICU 77 (Node 20) renders the digit-adjacent
  // en dash with no surrounding space ("3-5"/"...03-05"); ICU 78 (Node
  // 22/24) inserts a space around it ("3 - 5"/"...03 - 05"). Both are the
  // same range, just a CLDR range-separator spacing revision.
  it("formats a valid date range for en-GB with dateStyle long as one of the known ICU variants", () => {
    const { start, end } = rangeByLocale[MustTestLocales.enGB];
    expectOneOfIcu(
      formatDateRange(start, end, MustTestLocales.enGB, { dateStyle: "long" }),
      oneOfIcu(
        normalizeDateTime("3-5 February 2024"),
        normalizeDateTime("3 - 5 February 2024"),
      ),
    );
  });

  it("formats a valid date range for sv-SE with dateStyle short as one of the known ICU variants", () => {
    const { start, end } = rangeByLocale[MustTestLocales.svSE];
    expectOneOfIcu(
      formatDateRange(start, end, MustTestLocales.svSE, {
        dateStyle: "short",
      }),
      oneOfIcu(
        normalizeDateTime("2024-02-03-05"),
        normalizeDateTime("2024-02-03 - 05"),
      ),
    );
  });

  it.each`
    scenario        | start           | end             | expected
    ${"same-day"}   | ${"2024-02-03"} | ${"2024-02-03"} | ${"February 3, 2024"}
    ${"same-month"} | ${"2024-02-03"} | ${"2024-02-10"} | ${"February 3 – 10, 2024"}
    ${"same-year"}  | ${"2024-02-03"} | ${"2024-06-10"} | ${"February 3 – June 10, 2024"}
    ${"cross-year"} | ${"2024-11-03"} | ${"2025-02-10"} | ${"November 3, 2024 – February 10, 2025"}
    ${"reversed"}   | ${"2024-02-10"} | ${"2024-02-03"} | ${"February 10 – 3, 2024"}
    ${"identical"}  | ${"2024-02-03"} | ${"2024-02-03"} | ${"February 3, 2024"}
  `(
    "collapses/elides correctly for a $scenario range ($start -> $end)",
    ({ start, end, expected }) => {
      expect(
        formatDateRange(start, end, MustTestLocales.enUS, {
          dateStyle: "long",
        }),
      ).toBe(normalizeDateTime(expected));
    },
  );

  it.each`
    start           | end
    ${"invalid"}    | ${"2024-02-05"}
    ${"2024-02-03"} | ${"invalid"}
    ${"invalid"}    | ${"invalid"}
    ${"2024-02-30"} | ${"2024-02-05"}
    ${""}           | ${"2024-02-05"}
    ${null}         | ${"2024-02-05"}
    ${undefined}    | ${"2024-02-05"}
    ${123}          | ${"2024-02-05"}
  `(
    "returns empty string when either endpoint is invalid or non-string: $start -> $end",
    ({ start, end }) => {
      expect(formatDateRange(start as never, end, MustTestLocales.enUS)).toBe(
        "",
      );
    },
  );
});
