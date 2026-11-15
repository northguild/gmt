import { formatDateRange } from "../plain/format/formatDateRange";
import { formatDateTimeRange } from "../plain/format/formatDateTimeRange";
import { formatZonedRange } from "../zoned/format/formatZonedRange";
import { expectOneOfIcu, oneOfIcu } from "../test/icuVariants";

/*
 * CORE-112 slice 7, D29: a range that drops, repeats or garbles a field of one date.
 *
 * ECMA-402 PartitionDateTimeRangePattern formats a range with the range pattern, and UTS #35 Part 4
 * (Interval Formats) builds that pattern so that each date's part holds every field its single
 * `format` prints. Where the CLDR interval data or ICU breaks that, the range is the locale's
 * fallback: `P + format(start) + J + format(end) + S` (UTS #35 `intervalFormatFallback`, `{0} – {1}`
 * in root), with the library's dashes written as ASCII. Every expected text below is written out
 * from the single texts and range texts Node 26.12.1 (ICU 78) prints, never from a library
 * function. The rows of the first two groups hold on an engine that has the defect and on one that
 * does not, as a fixed engine prints a range that already holds every field.
 */

describe("D29: a broken range prints as the two single dates joined by the locale's fallback", () => {
  it.each`
    locale               | options                                                                    | from            | to              | expected                                                  | cause
    ${"en-u-ca-chinese"} | ${{ year: "numeric", month: "long" }}                                      | ${"2024-07-10"} | ${"2025-07-10"} | ${"Sixth Month 2024(jia-chen) - Sixth Month 2025(yi-si)"} | ${"chinese drops the related year"}
    ${"fur-u-ca-hebrew"} | ${{ year: "numeric", month: "narrow" }}                                    | ${"2024-07-10"} | ${"2025-07-10"} | ${"11 5784 - 11 5785"}                                    | ${"hebrew prints the end's month with another value"}
    ${"yo"}              | ${{ year: "numeric", month: "numeric", day: "numeric", weekday: "short" }} | ${"2024-07-10"} | ${"2024-07-11"} | ${"10/7/2024, Ọjọ́rú - 11/7/2024, Ọjọ́bọ"}                  | ${"the end's weekday is printed twice"}
  `(
    "formatDateRange of '$locale' with $options holds both dates whole ($cause)",
    ({ locale, options, from, to, expected }) => {
      expect(formatDateRange(from, to, locale, options)).toBe(expected);
    },
  );

  it("formatDateTimeRange of 'hi' keeps the day period of both times", () => {
    expect(
      formatDateTimeRange("2024-05-15T13:25:00", "2024-05-15T16:40:00", "hi", {
        hour: "numeric",
        minute: "numeric",
        dayPeriod: "long",
      }),
    ).toBe("दोपहर 1:25 - शाम 4:40");
  });

  it("formatZonedRange of 'yo' is the same text from the same two dates", () => {
    expect(
      formatZonedRange(
        "2024-07-10T12:00:00+00:00[UTC]",
        "2024-07-11T12:00:00+00:00[UTC]",
        "yo",
        { year: "numeric", month: "numeric", day: "numeric", weekday: "short" },
      ),
    ).toBe("10/7/2024, Ọjọ́rú - 11/7/2024, Ọjọ́bọ");
  });

  it("formatZonedRange of 'yo' with a zone name and a day period is that text too", () => {
    // ICU 77 (Node 22) writes the hour of 'yo' as `12h`, ICU 78 as `12`: the single's own text.
    expectOneOfIcu(
      formatZonedRange(
        "2024-07-10T12:00:00+00:00[UTC]",
        "2024-07-11T12:00:00+00:00[UTC]",
        "yo",
        {
          weekday: "short",
          day: "numeric",
          month: "numeric",
          year: "numeric",
          hour: "numeric",
          dayPeriod: "long",
          timeZoneName: "long",
        },
      ),
      oneOfIcu(
        "10/7/2024, Ọjọ́rú, 12h Àpapọ̀ Àkókò Àgbáyé - 11/7/2024, Ọjọ́bọ, 12h Àpapọ̀ Àkókò Àgbáyé",
        "10/7/2024, Ọjọ́rú, 12 Àpapọ̀ Àkókò Àgbáyé - 11/7/2024, Ọjọ́bọ, 12 Àpapọ̀ Àkókò Àgbáyé",
      ),
    );
  });

  // The same pattern, a month apart: the range drops the related year of both dates on every
  // engine (native `Sixth Month jia-chen – Seventh Month jia-chen`), the class `M`, not `y`.
  it.each`
    label                    | call
    ${"formatDateRange"}     | ${() => formatDateRange("2024-07-10", "2024-08-10", "en-u-ca-chinese", { year: "numeric", month: "long" })}
    ${"formatDateTimeRange"} | ${() => formatDateTimeRange("2024-07-10T00:00:00", "2024-08-10T00:00:00", "en-u-ca-chinese", { year: "numeric", month: "long" })}
    ${"formatZonedRange"}    | ${() => formatZonedRange("2024-07-10T00:00:00+00:00[UTC]", "2024-08-10T00:00:00+00:00[UTC]", "en-u-ca-chinese", { year: "numeric", month: "long" })}
  `(
    "$label of chinese months apart holds the related year of both dates",
    ({ call }) => {
      expect(call()).toBe(
        "Sixth Month 2024(jia-chen) - Seventh Month 2024(jia-chen)",
      );
    },
  );

  it("formatDateRange of chinese inside one month is the one single (the dates print alike)", () => {
    expect(
      formatDateRange("2024-07-10", "2024-07-12", "en-u-ca-chinese", {
        year: "numeric",
        month: "long",
      }),
    ).toBe("Sixth Month 2024(jia-chen)");
  });

  it("formatDateRange of fur-hebrew months apart keeps the year written once", () => {
    // The two dates share the year, which the engine writes once after both months (UTS #35 Part 4).
    expect(
      formatDateRange("2024-07-10", "2024-08-20", "fur-u-ca-hebrew", {
        year: "numeric",
        month: "narrow",
      }),
    ).toBe("11 - 12/5784");
  });
});

/*
 * A pattern the detector flags is wrong for some classes of range only: an engine's interval data is
 * per greatest differing field. A range of another class, or one whose two dates print alike, is the
 * engine's own text and is never replaced by the two singles (UTS #35 Part 4: each class has its own
 * interval pattern; ECMA-402 PartitionDateTimeRangePattern: dates that print alike are one single).
 * Each expected text is the engine's range on Node 26.12.1 with the library's dash and space rules.
 */
describe("D29: a flagged pattern keeps the engine's range for a class it prints right", () => {
  const yo = {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    weekday: "short",
  } as const;
  const hi = { hour: "numeric", minute: "numeric", dayPeriod: "long" } as const;

  it.each`
    locale  | options | from            | to              | expected                                     | shape
    ${"yo"} | ${yo}   | ${"2024-07-10"} | ${"2024-07-10"} | ${"10/7/2024, Ọjọ́rú"}                        | ${"one date twice prints one single"}
    ${"yo"} | ${yo}   | ${"2024-07-10"} | ${"2025-07-10"} | ${"2024-07-10, Ọjọ́rú - 2025-07-10, Ọjọ́bọ"}   | ${"years apart"}
    ${"yo"} | ${yo}   | ${"2024-07-10"} | ${"2024-08-10"} | ${"2024-07-10, Ọjọ́rú - 2024-08-10, Àbámẹ́ta"} | ${"months apart"}
  `(
    "formatDateRange of '$locale' $shape is '$expected'",
    ({ locale, options, from, to, expected }) => {
      expect(formatDateRange(from, to, locale, options)).toBe(expected);
    },
  );

  it.each`
    from                     | to                       | expected                 | shape
    ${"2024-05-15T13:25:00"} | ${"2024-05-15T13:25:00"} | ${"दोपहर 1:25"}          | ${"one time twice prints one single"}
    ${"2024-05-15T13:25:00"} | ${"2024-05-15T13:40:00"} | ${"दोपहर 1:25-1:40"}     | ${"minutes apart"}
    ${"2024-05-15T09:25:00"} | ${"2024-05-15T16:40:00"} | ${"सुबह 9:25 - शाम 4:40"} | ${"day periods apart"}
  `(
    "formatDateTimeRange of 'hi' $shape is '$expected'",
    ({ from, to, expected }) => {
      expect(formatDateTimeRange(from, to, "hi", hi)).toBe(expected);
    },
  );
});

/*
 * The flexible day period is its own field class between AM/PM and the hour (ECMA-402 Table 6:
 * [[AmPm]], [[DayPeriod]], [[Hour]]). Two times inside one AM/PM half whose day periods differ are
 * a DayPeriod-class range; two that print the same day period are an Hour-class range. Each
 * expected text is the engine's own on Node 22.22.2, 24.21.0 and 26.12.1 (same on all three) with
 * the library's dash and space rules.
 */
describe("D29: the flexible day period is its own class of range", () => {
  const long = {
    hour: "numeric",
    minute: "numeric",
    dayPeriod: "long",
  } as const;
  const short = {
    hour: "numeric",
    minute: "numeric",
    dayPeriod: "short",
  } as const;

  it.each`
    locale  | options  | from                     | to                       | expected                                         | shape
    ${"hi"} | ${long}  | ${"2024-05-15T13:25:00"} | ${"2024-05-15T14:40:00"} | ${"दोपहर 1:25-2:40"}                             | ${"one day period, Hour pattern kept (native `दोपहर 1:25–2:40`)"}
    ${"bn"} | ${long}  | ${"2024-05-15T13:25:00"} | ${"2024-05-15T14:40:00"} | ${"১:২৫ - ২:৪০ দুপুর"}                             | ${"one day period, Hour pattern kept (native `১:২৫–২:৪০ দুপুর`)"}
    ${"en"} | ${short} | ${"2024-05-15T13:25:00"} | ${"2024-05-15T14:40:00"} | ${"1:25 - 2:40 in the afternoon"}                | ${"one day period, Hour pattern kept"}
    ${"en"} | ${short} | ${"2024-05-15T13:25:00"} | ${"2024-05-15T18:40:00"} | ${"1:25 in the afternoon - 6:40 in the evening"} | ${"afternoon to evening in one PM half drops the start's period natively"}
    ${"am"} | ${long}  | ${"2024-05-15T12:10:00"} | ${"2024-05-15T18:45:00"} | ${"ከሰዓት 12:10 - በምሽት 6:45"}                      | ${"two periods in one PM half"}
    ${"am"} | ${short} | ${"2024-05-15T00:10:00"} | ${"2024-05-15T06:45:00"} | ${"በሌሊት 12:10 - ጥዋት 6:45"}                       | ${"two periods in one AM half"}
  `(
    "formatDateTimeRange of '$locale' with $options from '$from' to '$to' has $shape",
    ({ locale, options, from, to, expected }) => {
      expect(formatDateTimeRange(from, to, locale, options)).toBe(expected);
    },
  );
});

describe("D29: a range the engine prints whole is left as it is", () => {
  it.each`
    locale  | options                               | from            | to              | expected
    ${"en"} | ${{ dateStyle: "medium" }}            | ${"2024-07-10"} | ${"2024-07-12"} | ${"Jul 10 - 12, 2024"}
    ${"en"} | ${{ year: "numeric", month: "long" }} | ${"2024-07-10"} | ${"2025-07-10"} | ${"July 2024 - July 2025"}
    ${"de"} | ${{ dateStyle: "medium" }}            | ${"2024-07-10"} | ${"2024-07-12"} | ${"10. - 12.07.2024"}
  `(
    "formatDateRange of '$locale' with $options is '$expected'",
    ({ locale, options, from, to, expected }) => {
      expect(formatDateRange(from, to, locale, options)).toBe(expected);
    },
  );

  it("keeps a shared day period written once: zh-TW 下午2:30-4:46 is not rebuilt from its singles", () => {
    // UTS #35 Part 4: an interval pattern writes a field both dates share once.
    expect(
      formatDateTimeRange(
        "2024-02-03T14:30:00",
        "2024-02-03T16:46:00",
        "zh-TW",
        { dateStyle: "short", timeStyle: "short" },
      ),
    ).toBe("2024/2/3 下午2:30-4:46");
  });
});

/*
 * The run-together flags: the engine fuses two adjacent numeric fields of one date into one digit
 * run (ja chinese `5月10日` printed `510日`, brx `15/6/2025` printed `15/62025`, zh `6月15日` printed
 * `615日`), so the date reads as another number. The range pattern's separator holds the field
 * boundary the single format keeps (UTS #35 Part 4, interval formats: each side is the date's own
 * pattern). The two dates are a year apart, so a correct range has nothing to merge and is the two
 * single dates around the fallback joiner.
 */
describe("D29: a range that runs two fields of one date together is the two singles", () => {
  const dateOptions = {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    weekday: "short",
  } as const;
  const from = "2024-06-15";
  const to = "2025-06-15";

  it.each`
    locale                    | options                                                                    | expected
    ${"ja-u-ca-chinese"}      | ${dateOptions}                                                             | ${"甲辰年5月10日(土)～乙巳年5月20日(日)"}
    ${"ja-u-ca-dangi"}        | ${dateOptions}                                                             | ${"甲辰年5月10日(土)～乙巳年5月20日(日)"}
    ${"ja-u-ca-chinese"}      | ${{ ...dateOptions, year: "2-digit" }}                                     | ${"甲辰年5月10日(土)～乙巳年5月20日(日)"}
    ${"brx"}                  | ${{ ...dateOptions, era: "short" }}                                        | ${"ए.दि 2024-06-15, सनि - ए.दि 2025-06-15, रबि"}
    ${"zh-u-ca-iso8601"}      | ${{ weekday: "narrow", year: "numeric", month: "narrow", day: "numeric" }} | ${"2024 6 15, 六 - 2025 6 15, 日"}
    ${"zh-Hans-u-ca-iso8601"} | ${{ weekday: "narrow", year: "numeric", month: "narrow", day: "numeric" }} | ${"2024 6 15, 六 - 2025 6 15, 日"}
  `(
    "formatDateRange of '$locale' with $options is '$expected'",
    ({ locale, options, expected }) => {
      expect(formatDateRange(from, to, locale, options)).toBe(expected);
    },
  );
});

describe("D29: the day period is read at the formatter's own hour and minute", () => {
  // Noon is the period of 12:00 exactly. A pattern with minutes prints `12:25 in the afternoon`,
  // so 12:00 to 12:25 are two periods (the engine's `12:00 – 12:25 in the afternoon` drops the
  // first), and 12:25 to 13:25 are one (the engine's text is right). Native Node 26.12.1 `format`.
  const time = { hour: "numeric", minute: "numeric" } as const;

  it.each`
    dayPeriod   | hourCycle    | from                     | to                       | expected
    ${"long"}   | ${undefined} | ${"2024-07-10T12:00:00"} | ${"2024-07-10T12:25:00"} | ${"12:00 noon - 12:25 in the afternoon"}
    ${"short"}  | ${undefined} | ${"2024-07-10T12:00:00"} | ${"2024-07-10T12:25:00"} | ${"12:00 noon - 12:25 in the afternoon"}
    ${"narrow"} | ${undefined} | ${"2024-07-10T12:00:00"} | ${"2024-07-10T12:25:00"} | ${"12:00 n - 12:25 in the afternoon"}
    ${"long"}   | ${"h12"}     | ${"2024-07-10T12:00:00"} | ${"2024-07-10T12:25:00"} | ${"12:00 noon - 12:25 in the afternoon"}
    ${"narrow"} | ${"h12"}     | ${"2024-07-10T12:00:00"} | ${"2024-07-10T12:25:00"} | ${"12:00 n - 12:25 in the afternoon"}
    ${"long"}   | ${undefined} | ${"2024-07-10T12:25:00"} | ${"2024-07-10T13:25:00"} | ${"12:25 - 1:25 in the afternoon"}
    ${"short"}  | ${"h12"}     | ${"2024-07-10T12:25:00"} | ${"2024-07-10T13:25:00"} | ${"12:25 - 1:25 in the afternoon"}
    ${"narrow"} | ${undefined} | ${"2024-07-10T12:25:00"} | ${"2024-07-10T13:25:00"} | ${"12:25 - 1:25 in the afternoon"}
  `(
    "formatDateTimeRange and formatZonedRange of 'en' dayPeriod '$dayPeriod' hourCycle $hourCycle from '$from' to '$to' is '$expected'",
    ({ dayPeriod, hourCycle, from, to, expected }) => {
      const options = {
        ...time,
        dayPeriod,
        ...(hourCycle === undefined ? {} : { hourCycle }),
      };
      expect(formatDateTimeRange(from, to, "en", options)).toBe(expected);
      expect(
        formatZonedRange(
          `${from}+00:00[UTC]`,
          `${to}+00:00[UTC]`,
          "en",
          options,
        ),
      ).toBe(expected);
    },
  );
});

describe("a range collapses on equal field values, never on equal printed text (ECMA-402 PartitionDateTimeRangePattern)", () => {
  const twoDigit = {
    year: "2-digit",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    dayPeriod: "long",
  } as const;

  it("formatDateTimeRange keeps both ends of two dates a century apart that print the same two-digit year", () => {
    // 1924 and 2024 print `24`; the years differ, so the range is not the single (native `7/10/24, 1:25 in the afternoon – 7/10/24, 1:25 in the afternoon`).
    expect(
      formatDateTimeRange(
        "1924-07-10T13:25:00",
        "2024-07-10T13:25:00",
        "en",
        twoDigit,
      ),
    ).toBe("7/10/24, 1:25 in the afternoon - 7/10/24, 1:25 in the afternoon");
  });

  it("formatDateRange keeps both ends of two months that print the same narrow letter", () => {
    expect(
      formatDateRange("2024-01-10", "2024-06-10", "en", { month: "narrow" }),
    ).toBe("J - J");
  });

  it("formatDateRange of one instant is the single date", () => {
    expect(
      formatDateRange("2024-01-10", "2024-01-10", "en", { month: "narrow" }),
    ).toBe("J");
  });

  it("formatDateRange of japanese-calendar years before 1873 that print the same short year keeps both ends", () => {
    // The Gregorian twin prints `1/1/00 AD` for 1600 and for 1700: the years differ.
    expect(
      formatDateRange("1600-01-01", "1700-01-01", "en-u-ca-japanese", {
        dateStyle: "short",
      }),
    ).toBe("1/1/00 - 1/1/00 AD");
  });
});

describe("D29: a range whose pattern drops the day period both singles print", () => {
  // Node 26.12.1: af-NA narrow prints `12:00 in die middag` and `12:25 in die middag`, and its
  // range `12:00–12:25`, with no period at all. A pattern that prints the period once for both
  // times (en `1:25 – 1:40 in the afternoon`) holds it.
  const narrow = {
    hour: "numeric",
    minute: "numeric",
    dayPeriod: "narrow",
  } as const;

  it("formatDateTimeRange and formatZonedRange of 'af-NA' keep the period of both times", () => {
    const expected = "12:00 in die middag - 12:25 in die middag";
    expect(
      formatDateTimeRange(
        "2024-07-10T12:00:00",
        "2024-07-10T12:25:00",
        "af-NA",
        narrow,
      ),
    ).toBe(expected);
    expect(
      formatZonedRange(
        "2024-07-10T12:00:00+00:00[UTC]",
        "2024-07-10T12:25:00+00:00[UTC]",
        "af-NA",
        narrow,
      ),
    ).toBe(expected);
  });

  it("formatDateTimeRange of 'en' keeps the one period an en range prints for both times", () => {
    expect(
      formatDateTimeRange(
        "2024-07-10T13:25:00",
        "2024-07-10T13:40:00",
        "en",
        narrow,
      ),
    ).toBe("1:25 - 1:40 in the afternoon");
  });
});

describe("D29: a 12-hour range prints the hour value the single prints", () => {
  // Node 26.12.1: ja with hourCycle h12 prints `午前12:10` and `午前2:40`, and its range
  // `午前0時10分～2時40分`: hour 0 where the single has 12 (the range pattern is a 0-11 hour).
  it.each`
    options                                                                        | from                     | to                       | expected
    ${{ hour: "numeric", minute: "numeric", hourCycle: "h12" }}                    | ${"2024-07-10T00:10:00"} | ${"2024-07-10T02:40:00"} | ${"午前12:10～午前2:40"}
    ${{ hour: "numeric", minute: "numeric", hourCycle: "h12" }}                    | ${"2024-07-10T12:10:00"} | ${"2024-07-10T14:40:00"} | ${"午後12:10～午後2:40"}
    ${{ hour: "numeric", minute: "numeric", dayPeriod: "long", hourCycle: "h12" }} | ${"2024-07-10T00:10:00"} | ${"2024-07-10T02:40:00"} | ${"夜中12:10～夜中2:40"}
  `(
    "formatDateTimeRange of 'ja' $options from '$from' to '$to' is '$expected'",
    ({ options, from, to, expected }) => {
      expect(formatDateTimeRange(from, to, "ja", options)).toBe(expected);
    },
  );
});
