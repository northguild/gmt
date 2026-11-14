import { formatDate } from "../plain/format/formatDate";
import { formatDateRange } from "../plain/format/formatDateRange";
import { formatDateTime } from "../plain/format/formatDateTime";
import { formatDateTimeRange } from "../plain/format/formatDateTimeRange";
import { formatDateToParts } from "../plain/format/formatDateToParts";
import { formatZonedDateTime } from "../zoned/format/formatZonedDateTime";
import { formatZonedRange } from "../zoned/format/formatZonedRange";
import { formatZonedToParts } from "../zoned/format/formatZonedToParts";

/*
 * CORE-112 slice 7 (D25 to D28): the years an engine prints wrongly outside the week-year.
 *
 * Every expected value comes from a specification, never from the engine's text:
 * - D25: Intl era/monthCode Table 2 as amended by tc39/proposal-intl-era-monthcode#86 (test262
 *   tc39/test262#4877): the japanese calendar uses Gregorian eras up to and including 1872-12-31
 *   and the solar Japanese eras from 1873-01-01. ISO -0001-07-10 is 2 BC, 1872-12-31 is 1872 AD,
 *   1873-01-01 is Meiji 6 (Meiji 1 is 1868 as a year count).
 * - D26: Table 2 and § 4.1.12 give `bh`; an engine with no `bh` name gives the house empty value.
 * - D27: ECMA-402 FormatDateTimePattern, "2-digit": FormatNumeric with minimumIntegerDigits 2, so
 *   Reiwa 6 is 06; CLDR's ja data keeps 元年 for year 1 (owner decision).
 * - D28: ECMA-402 FormatDateTimePattern, `relatedYear`: FormatNumeric at full width, no 2-digit
 *   form, so related year 5 is 5 and -1 is -1.
 * Each value holds on an engine that has the defect and on one that does not.
 */

const eraYear = { era: "short", year: "numeric" } as const;

describe("D25: japanese dates before 1873-01-01 print Gregorian eras", () => {
  it.each`
    locale                | iso                | expected
    ${"en-u-ca-japanese"} | ${"-000001-07-10"} | ${"2 BC"}
    ${"ja-u-ca-japanese"} | ${"-000001-07-10"} | ${"紀元前2年"}
    ${"en-u-ca-japanese"} | ${"1872-12-31"}    | ${"1872 AD"}
    ${"ja-u-ca-japanese"} | ${"1872-12-31"}    | ${"西暦1872年"}
    ${"en-u-ca-japanese"} | ${"1868-10-23"}    | ${"1868 AD"}
    ${"ja-u-ca-japanese"} | ${"1868-10-23"}    | ${"西暦1868年"}
    ${"en-u-ca-japanese"} | ${"1873-01-01"}    | ${"6 Meiji"}
    ${"ja-u-ca-japanese"} | ${"1873-01-01"}    | ${"明治6年"}
  `(
    "formatDate prints '$expected' for '$locale' at $iso",
    ({ locale, iso, expected }) => {
      expect(formatDate(iso, locale, eraYear)).toBe(expected);
    },
  );

  it("splits the Gregorian era and year of a pre-1873 date into era and year parts", () => {
    expect(
      formatDateToParts("1872-12-31", "en-u-ca-japanese", eraYear),
    ).toEqual([
      { type: "year", value: "1872" },
      { type: "literal", value: " " },
      { type: "era", value: "AD" },
    ]);
  });

  it("prints a zoned date before 1873 with the Gregorian era", () => {
    expect(
      formatZonedDateTime(
        "-000001-07-10T12:00:00+00:00[UTC]",
        "en-u-ca-japanese",
        eraYear,
      ),
    ).toBe("2 BC");
    expect(
      formatZonedToParts(
        "-000001-07-10T12:00:00+00:00[UTC]",
        "en-u-ca-japanese",
        eraYear,
      )
        .map((part) => part.value)
        .join(""),
    ).toBe("2 BC");
  });

  it("prints a range inside the Gregorian eras and one inside the Meiji era", () => {
    expect(
      formatDateRange("1870-01-01", "1872-12-31", "en-u-ca-japanese", eraYear),
    ).toMatch(/^1870\D+1872 AD$/);
    expect(
      formatDateRange("1873-01-01", "1875-06-01", "en-u-ca-japanese", eraYear),
    ).toMatch(/^6\D+8 Meiji$/);
  });
});

describe("D25: more dates, locales and functions", () => {
  it.each`
    locale                        | iso                | suffix
    ${"en-u-ca-japanese-nu-arab"} | ${"-000001-07-10"} | ${"٢ BC"}
    ${"en-u-ca-japanese-nu-arab"} | ${"1872-12-31"}    | ${"١٨٧٢ AD"}
    ${"en-u-ca-japanese-nu-arab"} | ${"1873-01-01"}    | ${"٦ Meiji"}
    ${"th-u-ca-japanese-nu-thai"} | ${"-000001-07-10"} | ${"๒"}
    ${"th-u-ca-japanese-nu-thai"} | ${"1872-12-31"}    | ${"๑๘๗๒"}
    ${"th-u-ca-japanese-nu-thai"} | ${"1873-01-01"}    | ${"๖"}
  `(
    "formatDate ends with '$suffix' for '$locale' at $iso (digits of the numbering system)",
    ({ locale, iso, suffix }) => {
      expect(formatDate(iso, locale, eraYear).endsWith(suffix)).toBe(true);
    },
  );

  it.each`
    locale                | iso                | expected
    ${"ja-u-ca-japanese"} | ${"-000001-07-10"} | ${[{ type: "era", value: "紀元前" }, { type: "year", value: "2" }, { type: "literal", value: "年" }]}
    ${"ja-u-ca-japanese"} | ${"1873-01-01"}    | ${[{ type: "era", value: "明治" }, { type: "year", value: "6" }, { type: "literal", value: "年" }]}
  `(
    "formatDateToParts splits '$locale' at $iso into era, year and literal",
    ({ locale, iso, expected }) => {
      expect(formatDateToParts(iso, locale, eraYear)).toEqual(expected);
    },
  );

  it("types the year part of a pre-1873 date in a non-Latin numbering system as year", () => {
    expect(
      formatDateToParts("1872-12-31", "en-u-ca-japanese-nu-arab", eraYear),
    ).toEqual([
      { type: "year", value: "١٨٧٢" },
      { type: "literal", value: " " },
      { type: "era", value: "AD" },
    ]);
  });

  it("prints a plain date-time before 1873 with the Gregorian era", () => {
    expect(
      formatDateTime("1872-12-31T23:59:59", "en-u-ca-japanese", eraYear),
    ).toBe("1872 AD");
    expect(
      formatDateTime("1873-01-01T00:00:00", "en-u-ca-japanese", eraYear),
    ).toBe("6 Meiji");
  });

  // ISO -0100 is 101 BC and ISO -0001 is 2 BC (astronomical year numbering, year 0 is 1 BC).
  it.each`
    start              | end                | locale                | expected
    ${"-000100-01-01"} | ${"-000001-07-10"} | ${"en-u-ca-japanese"} | ${/^101\D+2 BC$/}
    ${"-000100-01-01"} | ${"-000001-07-10"} | ${"ja-u-ca-japanese"} | ${/^紀元前101年\D+2年$/}
    ${"1868-10-23"}    | ${"1872-12-31"}    | ${"en-u-ca-japanese"} | ${/^1868\D+1872 AD$/}
    ${"1873-01-01"}    | ${"1872-12-31"}    | ${"en-u-ca-japanese"} | ${/^1873\D+1872 AD$/}
    ${"1872-12-31"}    | ${"1873-01-01"}    | ${"en-u-ca-japanese"} | ${/^1872\D+1873 AD$/}
    ${"1872-12-31"}    | ${"1873-01-01"}    | ${"ja-u-ca-japanese"} | ${/^西暦1872年\D+1873年$/}
  `(
    "the three range functions print '$locale' $start to $end in one calendar, the Gregorian one",
    ({ start, end, locale, expected }) => {
      expect(formatDateRange(start, end, locale, eraYear)).toMatch(expected);
      expect(
        formatDateTimeRange(
          `${start}T00:00:00`,
          `${end}T00:00:00`,
          locale,
          eraYear,
        ),
      ).toMatch(expected);
      expect(
        formatZonedRange(
          `${start}T00:00:00+00:00[UTC]`,
          `${end}T00:00:00+00:00[UTC]`,
          locale,
          eraYear,
        ),
      ).toMatch(expected);
    },
  );

  it("leaves a range inside the Meiji era in the japanese calendar, in every function", () => {
    expect(
      formatZonedRange(
        "1873-01-01T00:00:00+00:00[UTC]",
        "1875-06-01T00:00:00+00:00[UTC]",
        "en-u-ca-japanese",
        eraYear,
      ),
    ).toMatch(/^6\D+8 Meiji$/);
  });
});

/** Every `islamic*` calendar id the engine accepts (`islamicc` resolves to `islamic-civil`). */
const islamicCalendars = [
  "islamic",
  "islamic-civil",
  "islamic-rgsa",
  "islamic-tbla",
  "islamic-umalqura",
] as const;

describe("D26: islamic dates before the Hijra give the empty value", () => {
  it.each(islamicCalendars.map((calendar) => ({ calendar })))(
    "gives the empty value for '$calendar'",
    ({ calendar }) => {
      const locale = `en-u-ca-${calendar}`;
      expect(formatDate("-000001-07-10", locale, eraYear)).toBe("");
      expect(formatDate("0600-07-10", locale, eraYear)).toBe("");
      expect(formatDateToParts("-000001-07-10", locale, eraYear)).toEqual([]);
      expect(formatDateTime("0600-07-10T12:00:00", locale, eraYear)).toBe("");
      expect(
        formatDateRange("-000001-07-10", "2025-07-10", locale, eraYear),
      ).toBe("");
      expect(formatDateRange("2025-07-10", "0600-07-10", locale, eraYear)).toBe(
        "",
      );
      expect(
        formatDateTimeRange(
          "0600-07-10T00:00:00",
          "2025-07-10T00:00:00",
          locale,
          eraYear,
        ),
      ).toBe("");
      expect(
        formatZonedDateTime("0600-07-10T12:00:00+00:00[UTC]", locale, eraYear),
      ).toBe("");
      expect(
        formatZonedToParts("0600-07-10T12:00:00+00:00[UTC]", locale, eraYear),
      ).toEqual([]);
      expect(
        formatZonedRange(
          "0600-07-10T12:00:00+00:00[UTC]",
          "2025-07-10T12:00:00+00:00[UTC]",
          locale,
          eraYear,
        ),
      ).toBe("");
    },
  );

  // Last day before the Hijra and the first day of AH 1, as native Temporal computes them
  // (`bh` era / year 0, then `ah` year 1). The `islamic` and `islamic-rgsa` calendars are not in
  // Temporal, so the epoch cannot be derived there and only dates far before it are tested.
  it.each`
    calendar              | lastBefore      | firstDay
    ${"islamic-civil"}    | ${"0622-07-18"} | ${"0622-07-19"}
    ${"islamic-tbla"}     | ${"0622-07-17"} | ${"0622-07-18"}
    ${"islamic-umalqura"} | ${"0622-07-18"} | ${"0622-07-19"}
  `(
    "'$calendar' gives the empty value for the last day before the Hijra and 1 AH for $firstDay",
    ({ calendar, lastBefore, firstDay }) => {
      const locale = `en-u-ca-${calendar}`;
      expect(formatDate(lastBefore, locale, eraYear)).toBe("");
      expect(formatDateToParts(lastBefore, locale, eraYear)).toEqual([]);
      expect(formatDate(firstDay, locale, eraYear)).toBe("1 AH");
      expect(
        formatDateToParts(firstDay, locale, eraYear).find(
          (part) => part.type === "year",
        ),
      ).toEqual({ type: "year", value: "1" });
      expect(formatDateRange(lastBefore, firstDay, locale, eraYear)).toBe("");
      expect(formatDateRange(firstDay, "0623-07-10", locale, eraYear)).toMatch(
        /^1\D+2 AH$/,
      );
      expect(
        formatZonedRange(
          `${lastBefore}T23:59:59+00:00[UTC]`,
          `${firstDay}T12:00:00+00:00[UTC]`,
          locale,
          eraYear,
        ),
      ).toBe("");
    },
  );

  it.each`
    locale
    ${"ja-u-ca-islamic-civil"}
    ${"ar-u-ca-islamic-umalqura-nu-arab"}
    ${"th-u-ca-islamic-tbla-nu-thai"}
  `("gives the empty value before the Hijra for '$locale'", ({ locale }) => {
    expect(formatDate("0600-07-10", locale, eraYear)).toBe("");
    expect(formatDateToParts("0600-07-10", locale, eraYear)).toEqual([]);
    expect(formatDateRange("0600-07-10", "0601-07-10", locale, eraYear)).toBe(
      "",
    );
  });

  it.each(islamicCalendars.map((calendar) => ({ calendar })))(
    "leaves a date after the Hijra alone for '$calendar'",
    ({ calendar }) => {
      const locale = `en-u-ca-${calendar}`;
      expect(formatDate("2025-07-10", locale, eraYear)).toBe("1447 AH");
      expect(formatDate("2026-07-10", locale, eraYear)).toBe("1448 AH");
      expect(
        formatDateToParts("2025-07-10", locale, eraYear)
          .map((part) => part.value)
          .join(""),
      ).toBe("1447 AH");
      expect(
        formatDateRange("2025-07-10", "2026-07-10", locale, eraYear),
      ).toMatch(/1447.*1448/);
    },
  );

  it("leaves a pre-Hijra date alone in a gregory formatter", () => {
    expect(formatDate("0600-07-10", "en-u-ca-gregory", eraYear)).toBe("600 AD");
  });

  it("leaves a pre-Hijra date alone when no era or year is printed", () => {
    expect(
      formatDate("0600-07-10", "en-u-ca-islamic-civil", { month: "long" }),
    ).not.toBe("");
  });
});

describe("D27: ja japanese with year 2-digit pads the era year", () => {
  it.each`
    iso             | options                                                  | expected             | label
    ${"2024-07-10"} | ${{ year: "2-digit" }}                                   | ${"令和06年"}        | ${"Reiwa 6"}
    ${"2019-05-01"} | ${{ year: "2-digit" }}                                   | ${"令和元年"}        | ${"Reiwa 1 keeps 元"}
    ${"2019-05-01"} | ${{ year: "numeric" }}                                   | ${"令和元年"}        | ${"Reiwa 1 numeric"}
    ${"2024-07-10"} | ${{ year: "numeric" }}                                   | ${"令和6年"}         | ${"numeric is unpadded"}
    ${"2024-07-10"} | ${{ year: "2-digit", month: "numeric", day: "numeric" }} | ${"R06/7/10"}        | ${"numeric-only pattern"}
    ${"1990-06-10"} | ${{ year: "2-digit", month: "long", day: "numeric" }}    | ${"平成02年6月10日"} | ${"Heisei 2, month 6 stays"}
    ${"1989-01-08"} | ${{ year: "2-digit", month: "long", day: "numeric" }}    | ${"平成元年1月8日"}  | ${"Heisei 1, month 1 stays"}
    ${"2018-06-10"} | ${{ year: "2-digit", month: "long", day: "numeric" }}    | ${"平成30年6月10日"} | ${"two digits stay"}
  `(
    "formatDate prints '$expected' for $label ($iso)",
    ({ iso, options, expected }) => {
      expect(formatDate(iso, "ja-u-ca-japanese", options)).toBe(expected);
    },
  );

  it("pads in the year part and in the joined parts", () => {
    const parts = formatDateToParts("2024-07-10", "ja-u-ca-japanese", {
      year: "2-digit",
    });
    expect(parts.find((part) => part.type === "year")).toEqual({
      type: "year",
      value: "06",
    });
    expect(parts.map((part) => part.value).join("")).toBe("令和06年");
  });

  it("pads in a zoned date and keeps 元 there", () => {
    expect(
      formatZonedDateTime(
        "2024-07-10T12:00:00+00:00[UTC]",
        "ja-u-ca-japanese",
        {
          year: "2-digit",
        },
      ),
    ).toBe("令和06年");
    expect(
      formatZonedDateTime(
        "2019-05-01T12:00:00+00:00[UTC]",
        "ja-u-ca-japanese",
        {
          year: "2-digit",
        },
      ),
    ).toBe("令和元年");
  });
});

describe("D27: ranges across eras, ja japanese, year 2-digit", () => {
  // Heisei 31 ends on 2019-04-30, Reiwa 1 starts on 2019-05-01, Showa 64 ends on 1989-01-07.
  it.each`
    start           | end             | first         | second
    ${"2019-04-30"} | ${"2020-05-01"} | ${"平成31年"} | ${"令和02年"}
    ${"2019-05-01"} | ${"2020-05-01"} | ${"令和元年"} | ${"02年"}
    ${"2019-04-30"} | ${"2019-05-01"} | ${"平成31年"} | ${"令和元年"}
    ${"1989-01-07"} | ${"1990-01-07"} | ${"昭和64年"} | ${"平成02年"}
    ${"1989-01-08"} | ${"1990-01-08"} | ${"平成元年"} | ${"02年"}
    ${"2018-06-10"} | ${"2019-04-30"} | ${"平成30年"} | ${"31年"}
    ${"2024-07-10"} | ${"2034-07-10"} | ${"令和06年"} | ${"16年"}
  `(
    "the three range functions print '$first' and '$second' for $start to $end",
    ({ start, end, first, second }) => {
      const expected = new RegExp(`^${first}\\D+${second}$`);
      const options = { year: "2-digit" } as const;
      expect(formatDateRange(start, end, "ja-u-ca-japanese", options)).toMatch(
        expected,
      );
      expect(
        formatDateTimeRange(
          `${start}T00:00:00`,
          `${end}T00:00:00`,
          "ja-u-ca-japanese",
          options,
        ),
      ).toMatch(expected);
      expect(
        formatZonedRange(
          `${start}T00:00:00+00:00[UTC]`,
          `${end}T00:00:00+00:00[UTC]`,
          "ja-u-ca-japanese",
          options,
        ),
      ).toMatch(expected);
    },
  );

  it.each`
    start           | end             | expected
    ${"2019-04-30"} | ${"2020-05-01"} | ${/^平成31年\D+令和2年$/}
    ${"2019-05-01"} | ${"2020-05-01"} | ${/^令和元年\D+2年$/}
    ${"2024-07-10"} | ${"2034-07-10"} | ${/^令和6年\D+16年$/}
  `(
    "year numeric keeps the era year unpadded for $start to $end",
    ({ start, end, expected }) => {
      expect(
        formatDateRange(start, end, "ja-u-ca-japanese", { year: "numeric" }),
      ).toMatch(expected);
    },
  );

  it("pads a year of a range inside a numeric-only pattern as the engine does", () => {
    expect(
      formatDateRange("2024-07-10", "2025-07-10", "ja-u-ca-japanese", {
        year: "2-digit",
        month: "numeric",
        day: "numeric",
      }),
    ).toMatch(/^R06\/\d+\/10\D+07\/\d+\/10$/);
  });

  it("pads the year parts of a plain date-time and a zoned date in the joined parts", () => {
    expect(
      formatDateTime("2024-07-10T12:00:00", "ja-u-ca-japanese", {
        year: "2-digit",
      }),
    ).toBe("令和06年");
    expect(
      formatZonedToParts("2024-07-10T12:00:00+00:00[UTC]", "ja-u-ca-japanese", {
        year: "2-digit",
      }).find((part) => part.type === "year"),
    ).toEqual({ type: "year", value: "06" });
  });

  it("leaves a locale other than ja alone", () => {
    expect(
      formatDate("2024-07-10", "en-u-ca-japanese", {
        year: "2-digit",
        era: "short",
      }),
    ).toBe("06 Reiwa");
  });
});

describe("D28: chinese and dangi related year at full width under year 2-digit", () => {
  // The related year is the Temporal `year` of the date in that calendar (native Temporal:
  // ISO 0005-07-10 is 5, -0001-07-10 is -1, 0099 is 99, 0100 is 100, 2024-07-10 is 2024).
  it.each`
    calendar     | iso                | expected
    ${"chinese"} | ${"0005-07-10"}    | ${"5"}
    ${"chinese"} | ${"-000001-07-10"} | ${"-1"}
    ${"chinese"} | ${"0099-07-10"}    | ${"99"}
    ${"chinese"} | ${"0100-07-10"}    | ${"100"}
    ${"chinese"} | ${"2024-07-10"}    | ${"2024"}
    ${"dangi"}   | ${"0005-07-10"}    | ${"5"}
    ${"dangi"}   | ${"-000001-07-10"} | ${"-1"}
    ${"dangi"}   | ${"0099-07-10"}    | ${"99"}
    ${"dangi"}   | ${"0100-07-10"}    | ${"100"}
    ${"dangi"}   | ${"2024-07-10"}    | ${"2024"}
  `(
    "prints related year '$expected' for '$calendar' at $iso, year 2-digit",
    ({ calendar, iso, expected }) => {
      const locale = `en-u-ca-${calendar}`;
      const options = { year: "2-digit" } as const;
      const text = formatDate(iso, locale, options);
      const parts = formatDateToParts(iso, locale, options);
      expect(parts.find((part) => part.type === "relatedYear")?.value).toBe(
        expected,
      );
      expect(text.startsWith(`${expected}(`)).toBe(true);
      expect(parts.map((part) => part.value).join("")).toBe(text);
      expect(
        formatZonedDateTime(`${iso}T12:00:00+00:00[UTC]`, locale, options),
      ).toBe(text);
      expect(formatDateTime(`${iso}T12:00:00`, locale, options)).toBe(text);
      expect(
        formatDate(iso, locale, { year: "numeric" }).startsWith(`${expected}(`),
      ).toBe(true);
    },
  );

  it.each`
    calendar     | iso                | expected
    ${"chinese"} | ${"-000001-07-10"} | ${"-1"}
    ${"chinese"} | ${"0005-07-10"}    | ${"5"}
    ${"dangi"}   | ${"-000001-07-10"} | ${"-1"}
    ${"dangi"}   | ${"0005-07-10"}    | ${"5"}
  `(
    "keeps month 2-digit and prints related year '$expected' for '$calendar' at $iso",
    ({ calendar, iso, expected }) => {
      const locale = `en-u-ca-${calendar}`;
      const options = { year: "2-digit", month: "2-digit" } as const;
      const text = formatDate(iso, locale, options);
      expect(text.endsWith(`/${expected}`)).toBe(true);
      expect(text.startsWith("0")).toBe(true);
      const parts = formatDateToParts(iso, locale, options);
      expect(parts.map((part) => part.type)).toEqual([
        "month",
        "literal",
        "relatedYear",
      ]);
      expect(parts.map((part) => part.value).join("")).toBe(text);
    },
  );

  it.each`
    locale                          | iso                | expected
    ${"en-u-ca-chinese-nu-arab"}    | ${"0005-07-10"}    | ${"٥"}
    ${"en-u-ca-chinese-nu-arab"}    | ${"-000001-07-10"} | ${"\u061C-١"}
    ${"en-u-ca-chinese-nu-arab"}    | ${"2024-07-10"}    | ${"٢٠٢٤"}
    ${"en-u-ca-dangi-nu-arab"}      | ${"0005-07-10"}    | ${"٥"}
    ${"zh-u-ca-chinese-nu-hanidec"} | ${"0005-07-10"}    | ${"五"}
    ${"zh-u-ca-chinese-nu-hanidec"} | ${"-000001-07-10"} | ${"-一"}
  `(
    "prints related year '$expected' in the numbering system of '$locale' at $iso",
    ({ locale, iso, expected }) => {
      expect(
        formatDateToParts(iso, locale, { year: "2-digit" }).find(
          (part) => part.type === "relatedYear",
        )?.value,
      ).toBe(expected);
    },
  );

  it("leaves a gregory year 2-digit and a chinese year numeric untouched", () => {
    expect(
      formatDate("2024-07-10", "en-u-ca-gregory", { year: "2-digit" }),
    ).toBe("24");
    expect(
      formatDate("0005-07-10", "en-u-ca-chinese", { year: "numeric" }),
    ).toMatch(/^5\(/);
  });

  it.each`
    calendar
    ${"chinese"}
    ${"dangi"}
  `(
    "prints every related year of a '$calendar' range unpadded, in all three functions",
    ({ calendar }) => {
      const locale = `en-u-ca-${calendar}`;
      const options = { year: "2-digit", month: "2-digit" } as const;
      const related = (text: string): string[] =>
        [...text.matchAll(/\/(-?\d+)/g)].map((match) => match[1] ?? "");
      expect(
        related(formatDateRange("0005-07-10", "0006-07-10", locale, options)),
      ).toEqual(["5", "6"]);
      expect(
        related(
          formatDateTimeRange(
            "0005-07-10T00:00:00",
            "0006-07-10T00:00:00",
            locale,
            options,
          ),
        ),
      ).toEqual(["5", "6"]);
      expect(
        related(
          formatZonedRange(
            "0005-07-10T00:00:00+00:00[UTC]",
            "0006-07-10T00:00:00+00:00[UTC]",
            locale,
            options,
          ),
        ),
      ).toEqual(["5", "6"]);
      expect(
        related(
          formatDateRange("-000001-07-10", "0005-07-10", locale, options),
        ),
      ).toEqual(["-1", "5"]);
      expect(
        related(formatDateRange("0005-07-10", "0005-08-10", locale, options)),
      ).toEqual(["5", "5"]);
    },
  );

  it.each`
    locale
    ${"en-u-ca-chinese"}
    ${"en-u-ca-dangi"}
  `(
    "leaves a 4-digit related year of a '$locale' range alone",
    ({ locale }) => {
      const text = formatDateRange("2024-07-10", "2025-07-10", locale, {
        year: "2-digit",
        month: "2-digit",
      });
      expect([...text.matchAll(/\/(-?\d+)/g)].map((match) => match[1])).toEqual(
        ["2024", "2025"],
      );
    },
  );

  it("prints a range that crosses from a 1-digit to a 3-digit related year at full width", () => {
    const text = formatDateRange(
      "0099-07-10",
      "0100-07-10",
      "en-u-ca-chinese",
      {
        year: "2-digit",
        month: "2-digit",
      },
    );
    expect([...text.matchAll(/\/(-?\d+)/g)].map((match) => match[1])).toEqual([
      "99",
      "100",
    ]);
  });
});
