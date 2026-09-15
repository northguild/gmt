import { mockTemporalPlainDateFromThrow } from "../../test/mocks";
import { convertDateToCalendar } from "./convertDateToCalendar";

describe("convertDateToCalendar", () => {
  it.each`
    value                        | calendar       | expected
    ${"2024-02-29"}              | ${"hebrew"}    | ${"5784-06-20[u-ca=hebrew]"}
    ${"2023-02-28"}              | ${"hebrew"}    | ${"5783-06-07[u-ca=hebrew]"}
    ${"2024-01-01"}              | ${"hebrew"}    | ${"5784-04-20[u-ca=hebrew]"}
    ${"2024-12-31"}              | ${"hebrew"}    | ${"5785-03-30[u-ca=hebrew]"}
    ${"2024-03-01"}              | ${"hebrew"}    | ${"5784-06-21[u-ca=hebrew]"}
    ${"2024-03-31"}              | ${"hebrew"}    | ${"5784-07-21[u-ca=hebrew]"}
    ${"2024-01-01"}              | ${"gregorian"} | ${"2024-01-01"}
    ${"5785-01-01[u-ca=hebrew]"} | ${"gregorian"} | ${"2024-10-03"}
    ${"5784-06-01[u-ca=hebrew]"} | ${"gregorian"} | ${"2024-02-10"}
    ${"5784-06-01[u-ca=hebrew]"} | ${"hebrew"}    | ${"5784-06-01[u-ca=hebrew]"}
  `(
    "converts $value to $calendar as $expected",
    ({
      value,
      calendar,
      expected,
    }: {
      value: string;
      calendar: "gregorian" | "hebrew";
      expected: string;
    }) => {
      expect(convertDateToCalendar(value, calendar)).toBe(expected);
    },
  );

  // All 12 month boundaries of non-leap year 5783 (2022-09-26..2023-09-15).
  it.each`
    lastIsoOfMonth  | expectedLast                 | firstIsoOfNextMonth | expectedNext
    ${"2022-10-25"} | ${"5783-01-30[u-ca=hebrew]"} | ${"2022-10-26"}     | ${"5783-02-01[u-ca=hebrew]"}
    ${"2022-11-24"} | ${"5783-02-30[u-ca=hebrew]"} | ${"2022-11-25"}     | ${"5783-03-01[u-ca=hebrew]"}
    ${"2022-12-24"} | ${"5783-03-30[u-ca=hebrew]"} | ${"2022-12-25"}     | ${"5783-04-01[u-ca=hebrew]"}
    ${"2023-01-22"} | ${"5783-04-29[u-ca=hebrew]"} | ${"2023-01-23"}     | ${"5783-05-01[u-ca=hebrew]"}
    ${"2023-02-21"} | ${"5783-05-30[u-ca=hebrew]"} | ${"2023-02-22"}     | ${"5783-06-01[u-ca=hebrew]"}
    ${"2023-03-22"} | ${"5783-06-29[u-ca=hebrew]"} | ${"2023-03-23"}     | ${"5783-07-01[u-ca=hebrew]"}
    ${"2023-04-21"} | ${"5783-07-30[u-ca=hebrew]"} | ${"2023-04-22"}     | ${"5783-08-01[u-ca=hebrew]"}
    ${"2023-05-20"} | ${"5783-08-29[u-ca=hebrew]"} | ${"2023-05-21"}     | ${"5783-09-01[u-ca=hebrew]"}
    ${"2023-06-19"} | ${"5783-09-30[u-ca=hebrew]"} | ${"2023-06-20"}     | ${"5783-10-01[u-ca=hebrew]"}
    ${"2023-07-18"} | ${"5783-10-29[u-ca=hebrew]"} | ${"2023-07-19"}     | ${"5783-11-01[u-ca=hebrew]"}
    ${"2023-08-17"} | ${"5783-11-30[u-ca=hebrew]"} | ${"2023-08-18"}     | ${"5783-12-01[u-ca=hebrew]"}
    ${"2023-09-15"} | ${"5783-12-29[u-ca=hebrew]"} | ${"2023-09-16"}     | ${"5784-01-01[u-ca=hebrew]"}
  `(
    "non-leap year 5783: $lastIsoOfMonth -> $expectedLast, $firstIsoOfNextMonth -> $expectedNext",
    ({
      lastIsoOfMonth,
      expectedLast,
      firstIsoOfNextMonth,
      expectedNext,
    }: {
      lastIsoOfMonth: string;
      expectedLast: string;
      firstIsoOfNextMonth: string;
      expectedNext: string;
    }) => {
      expect(convertDateToCalendar(lastIsoOfMonth, "hebrew")).toBe(
        expectedLast,
      );
      expect(convertDateToCalendar(firstIsoOfNextMonth, "hebrew")).toBe(
        expectedNext,
      );
    },
  );

  // All 13 month boundaries of leap year 5784 (2023-09-16..2024-10-02), including the
  // Adar I -> Adar II leap-month boundary (month 6 -> 7, at 2024-03-10 -> 2024-03-11).
  it.each`
    lastIsoOfMonth  | expectedLast                 | firstIsoOfNextMonth | expectedNext
    ${"2023-10-15"} | ${"5784-01-30[u-ca=hebrew]"} | ${"2023-10-16"}     | ${"5784-02-01[u-ca=hebrew]"}
    ${"2023-11-13"} | ${"5784-02-29[u-ca=hebrew]"} | ${"2023-11-14"}     | ${"5784-03-01[u-ca=hebrew]"}
    ${"2023-12-12"} | ${"5784-03-29[u-ca=hebrew]"} | ${"2023-12-13"}     | ${"5784-04-01[u-ca=hebrew]"}
    ${"2024-01-10"} | ${"5784-04-29[u-ca=hebrew]"} | ${"2024-01-11"}     | ${"5784-05-01[u-ca=hebrew]"}
    ${"2024-02-09"} | ${"5784-05-30[u-ca=hebrew]"} | ${"2024-02-10"}     | ${"5784-06-01[u-ca=hebrew]"}
    ${"2024-03-10"} | ${"5784-06-30[u-ca=hebrew]"} | ${"2024-03-11"}     | ${"5784-07-01[u-ca=hebrew]"}
    ${"2024-04-08"} | ${"5784-07-29[u-ca=hebrew]"} | ${"2024-04-09"}     | ${"5784-08-01[u-ca=hebrew]"}
    ${"2024-05-08"} | ${"5784-08-30[u-ca=hebrew]"} | ${"2024-05-09"}     | ${"5784-09-01[u-ca=hebrew]"}
    ${"2024-06-06"} | ${"5784-09-29[u-ca=hebrew]"} | ${"2024-06-07"}     | ${"5784-10-01[u-ca=hebrew]"}
    ${"2024-07-06"} | ${"5784-10-30[u-ca=hebrew]"} | ${"2024-07-07"}     | ${"5784-11-01[u-ca=hebrew]"}
    ${"2024-08-04"} | ${"5784-11-29[u-ca=hebrew]"} | ${"2024-08-05"}     | ${"5784-12-01[u-ca=hebrew]"}
    ${"2024-09-03"} | ${"5784-12-30[u-ca=hebrew]"} | ${"2024-09-04"}     | ${"5784-13-01[u-ca=hebrew]"}
    ${"2024-10-02"} | ${"5784-13-29[u-ca=hebrew]"} | ${"2024-10-03"}     | ${"5785-01-01[u-ca=hebrew]"}
  `(
    "leap year 5784: $lastIsoOfMonth -> $expectedLast, $firstIsoOfNextMonth -> $expectedNext",
    ({
      lastIsoOfMonth,
      expectedLast,
      firstIsoOfNextMonth,
      expectedNext,
    }: {
      lastIsoOfMonth: string;
      expectedLast: string;
      firstIsoOfNextMonth: string;
      expectedNext: string;
    }) => {
      expect(convertDateToCalendar(lastIsoOfMonth, "hebrew")).toBe(
        expectedLast,
      );
      expect(convertDateToCalendar(firstIsoOfNextMonth, "hebrew")).toBe(
        expectedNext,
      );
    },
  );

  it("round-trips a leap-year (13-month) date through hebrew and back to gregorian", () => {
    const converted = convertDateToCalendar("2024-02-10", "hebrew");
    expect(converted).toBe("5784-06-01[u-ca=hebrew]");
    expect(convertDateToCalendar(converted, "gregorian")).toBe("2024-02-10");
  });

  it("round-trips a non-leap-year (12-month) date through hebrew and back to gregorian", () => {
    const converted = convertDateToCalendar("2023-02-22", "hebrew");
    expect(converted).toBe("5783-06-01[u-ca=hebrew]");
    expect(convertDateToCalendar(converted, "gregorian")).toBe("2023-02-22");
  });

  it("round-trips an epoch-adjacent hebrew year 1 date to gregorian", () => {
    const converted = convertDateToCalendar("-003760-09-07", "hebrew");
    expect(converted).toBe("0001-01-01[u-ca=hebrew]");
    expect(convertDateToCalendar(converted, "gregorian")).toBe("-003760-09-07");
  });

  // CORE-6 D1: the TC39 PlainDate maximum (+275760-09-13) in every calendar, both directions.
  // Values: test262 intl402/Temporal/PlainDate/from/extreme-dates.js (ordinal months).
  it.each`
    calendar                 | expected
    ${"hebrew"}              | ${"279517-10-11[u-ca=hebrew]"}
    ${"buddhist"}            | ${"276303-09-13[u-ca=buddhist]"}
    ${"islamic-civil"}       | ${"283583-05-23[u-ca=islamic-civil]"}
    ${"islamic-tabular"}     | ${"283583-05-24[u-ca=islamic-tabular]"}
    ${"islamic-umalqura"}    | ${"283583-05-23[u-ca=islamic-umalqura]"}
    ${"persian"}             | ${"275139-07-12[u-ca=persian]"}
    ${"indian"}              | ${"275682-06-22[u-ca=indian]"}
    ${"japanese"}            | ${"273742-09-13[u-ca=japanese;era=reiwa]"}
    ${"taiwan"}              | ${"273849-09-13[u-ca=taiwan]"}
    ${"ethiopic-amete-alem"} | ${"281247-05-22[u-ca=ethiopic-amete-alem]"}
    ${"coptic"}              | ${"275471-05-22[u-ca=coptic]"}
    ${"ethiopic"}            | ${"275747-05-22[u-ca=ethiopic;era=ethiopic]"}
  `(
    "converts the maximum +275760-09-13 to $calendar as $expected and back",
    ({ calendar, expected }) => {
      expect(convertDateToCalendar("+275760-09-13", calendar)).toBe(expected);
      expect(convertDateToCalendar(expected, "gregorian")).toBe(
        "+275760-09-13",
      );
    },
  );

  // CORE-6 G1: a negative calendar year is written like Temporal's PadISOYear, a sign plus six
  // digits (owner decision). Taiwan year = ISO year - 1911 (1000 -> -911, 1868 -> -43); the
  // islamic-civil and persian rows are Chromium 152 reads (spec §4.2).
  it.each`
    iso                | calendar           | expected
    ${"1000-01-01"}    | ${"taiwan"}        | ${"-000911-01-01[u-ca=taiwan]"}
    ${"1868-09-07"}    | ${"taiwan"}        | ${"-000043-09-07[u-ca=taiwan]"}
    ${"1910-12-31"}    | ${"taiwan"}        | ${"-000001-12-31[u-ca=taiwan]"}
    ${"-000500-06-15"} | ${"islamic-civil"} | ${"-001156-06-19[u-ca=islamic-civil]"}
    ${"-000500-06-15"} | ${"persian"}       | ${"-001121-03-25[u-ca=persian]"}
  `(
    "converts $iso to $calendar with a signed six-digit year as $expected and back",
    ({ iso, calendar, expected }) => {
      expect(convertDateToCalendar(iso, calendar)).toBe(expected);
      expect(convertDateToCalendar(expected, "gregorian")).toBe(iso);
    },
  );

  // CORE-6 D1 + G1: the TC39 PlainDate minimum (-271821-04-19), both directions. Values: test262
  // extreme-dates.js min rows (ethiopic: era "aa", eraYear = the ethioaa year).
  it.each`
    calendar                 | expected
    ${"islamic-civil"}       | ${"-280804-03-21[u-ca=islamic-civil]"}
    ${"islamic-tabular"}     | ${"-280804-03-22[u-ca=islamic-tabular]"}
    ${"islamic-umalqura"}    | ${"-280804-03-21[u-ca=islamic-umalqura]"}
    ${"persian"}             | ${"-272442-01-09[u-ca=persian]"}
    ${"taiwan"}              | ${"-273732-04-19[u-ca=taiwan]"}
    ${"ethiopic-amete-alem"} | ${"-266323-03-23[u-ca=ethiopic-amete-alem]"}
    ${"coptic"}              | ${"-272099-03-23[u-ca=coptic]"}
    ${"ethiopic"}            | ${"-266323-03-23[u-ca=ethiopic;era=ethioaa]"}
  `(
    "converts the minimum -271821-04-19 to $calendar as $expected and back",
    ({ calendar, expected }) => {
      expect(convertDateToCalendar("-271821-04-19", calendar)).toBe(expected);
      expect(convertDateToCalendar(expected, "gregorian")).toBe(
        "-271821-04-19",
      );
    },
  );

  // CORE-6 D1 windows near the minimum: the last failing day and the control after it
  // (Chromium 152 reads, spec §4.2).
  it.each`
    iso                | calendar             | expected                                 | note
    ${"-271820-01-19"} | ${"islamic-civil"}   | ${"-280804-12-30[u-ca=islamic-civil]"}   | ${"last day of the 276-day window"}
    ${"-271820-01-20"} | ${"islamic-civil"}   | ${"-280803-01-01[u-ca=islamic-civil]"}   | ${"control"}
    ${"-271820-01-18"} | ${"islamic-tabular"} | ${"-280804-12-30[u-ca=islamic-tabular]"} | ${"last day of the 275-day window"}
    ${"-271820-04-09"} | ${"persian"}         | ${"-272442-12-29[u-ca=persian]"}         | ${"last day of the 357-day window"}
    ${"-271820-04-10"} | ${"persian"}         | ${"-272441-01-01[u-ca=persian]"}         | ${"control"}
  `(
    "converts $iso to $calendar as $expected and back ($note)",
    ({ iso, calendar, expected }) => {
      expect(convertDateToCalendar(iso, calendar)).toBe(expected);
      expect(convertDateToCalendar(expected, "gregorian")).toBe(iso);
    },
  );

  // CORE-6 D1 windows near the maximum, where the polyfill's fields -> ISO throws. Each window's
  // first failing day and the control day just outside it (Chromium 152 reads, spec §4.2).
  it.each`
    iso                | calendar              | expected                                 | note
    ${"+275760-09-08"} | ${"hebrew"}           | ${"279517-10-06[u-ca=hebrew]"}           | ${"first day of the 6-day window"}
    ${"+275760-09-07"} | ${"hebrew"}           | ${"279517-10-05[u-ca=hebrew]"}           | ${"control"}
    ${"+275760-05-16"} | ${"hebrew"}           | ${"279517-06-09[u-ca=hebrew]"}           | ${"leap month M05L near the maximum"}
    ${"+275760-08-13"} | ${"buddhist"}         | ${"276303-08-13[u-ca=buddhist]"}         | ${"first day of the 32-day window"}
    ${"+275760-08-12"} | ${"buddhist"}         | ${"276303-08-12[u-ca=buddhist]"}         | ${"control"}
    ${"+275760-09-05"} | ${"islamic-civil"}    | ${"283583-05-15[u-ca=islamic-civil]"}    | ${"first day of the 9-day window"}
    ${"+275760-09-04"} | ${"islamic-civil"}    | ${"283583-05-14[u-ca=islamic-civil]"}    | ${"control"}
    ${"+275760-09-05"} | ${"islamic-tabular"}  | ${"283583-05-16[u-ca=islamic-tabular]"}  | ${"window"}
    ${"+275760-09-05"} | ${"islamic-umalqura"} | ${"283583-05-15[u-ca=islamic-umalqura]"} | ${"window"}
  `(
    "converts $iso to $calendar as $expected and back ($note)",
    ({ iso, calendar, expected }) => {
      expect(convertDateToCalendar(iso, calendar)).toBe(expected);
      expect(convertDateToCalendar(expected, "gregorian")).toBe(iso);
    },
  );

  it.each`
    value           | calendar
    ${"invalid"}    | ${"hebrew"}
    ${"2024-02-30"} | ${"hebrew"}
    ${""}           | ${"hebrew"}
    ${null}         | ${"hebrew"}
    ${123}          | ${"hebrew"}
  `(
    "returns empty string for invalid input: $value",
    ({ value, calendar }: { value: unknown; calendar: "hebrew" }) => {
      expect(convertDateToCalendar(value as string, calendar)).toBe("");
    },
  );

  it.each`
    value                                  | calendar              | expected
    ${"2024-10-03"}                        | ${"islamic-civil"}    | ${"1446-03-29[u-ca=islamic-civil]"}
    ${"2024-10-03"}                        | ${"islamic-tabular"}  | ${"1446-03-30[u-ca=islamic-tabular]"}
    ${"2024-10-03"}                        | ${"islamic-umalqura"} | ${"1446-03-30[u-ca=islamic-umalqura]"}
    ${"1446-03-30[u-ca=islamic-civil]"}    | ${"gregorian"}        | ${"2024-10-04"}
    ${"1446-03-30[u-ca=islamic-tabular]"}  | ${"gregorian"}        | ${"2024-10-03"}
    ${"1446-03-30[u-ca=islamic-umalqura]"} | ${"gregorian"}        | ${"2024-10-03"}
  `(
    "converts $value to $calendar as $expected",
    ({
      value,
      calendar,
      expected,
    }: {
      value: string;
      calendar:
        | "gregorian"
        | "islamic-civil"
        | "islamic-tabular"
        | "islamic-umalqura";
      expected: string;
    }) => {
      expect(convertDateToCalendar(value, calendar)).toBe(expected);
    },
  );

  // Islamic civil/tabular share a 12-lunar-month, 354/355-day-year structure but differ
  // in epoch alignment and leap-year cycle, so the two calendars land on different
  // calendar-native digits for the same Gregorian day.
  it.each`
    calendar             | expected
    ${"islamic-civil"}   | ${"1446-01-01[u-ca=islamic-civil]"}
    ${"islamic-tabular"} | ${"1446-01-01[u-ca=islamic-tabular]"}
  `(
    "epoch of Islamic year 1446 differs by one day between $calendar and its sibling",
    ({
      calendar,
      expected,
    }: {
      calendar: "islamic-civil" | "islamic-tabular";
      expected: string;
    }) => {
      const iso = calendar === "islamic-civil" ? "2024-07-08" : "2024-07-07";
      expect(convertDateToCalendar(iso, calendar)).toBe(expected);
    },
  );

  // 1445 AH is a leap year (355 days / 12 months, extra day in month 12) for both civil
  // and tabular; 1446 AH is a non-leap year (354 days) for both.
  it.each`
    lastIsoOfYear   | calendar             | expectedLast                          | firstIsoOfNextYear | expectedNext
    ${"2024-07-07"} | ${"islamic-civil"}   | ${"1445-12-30[u-ca=islamic-civil]"}   | ${"2024-07-08"}    | ${"1446-01-01[u-ca=islamic-civil]"}
    ${"2024-07-06"} | ${"islamic-tabular"} | ${"1445-12-30[u-ca=islamic-tabular]"} | ${"2024-07-07"}    | ${"1446-01-01[u-ca=islamic-tabular]"}
  `(
    "leap year 1445 -> non-leap year 1446 boundary for $calendar",
    ({
      lastIsoOfYear,
      calendar,
      expectedLast,
      firstIsoOfNextYear,
      expectedNext,
    }: {
      lastIsoOfYear: string;
      calendar: "islamic-civil" | "islamic-tabular";
      expectedLast: string;
      firstIsoOfNextYear: string;
      expectedNext: string;
    }) => {
      expect(convertDateToCalendar(lastIsoOfYear, calendar)).toBe(expectedLast);
      expect(convertDateToCalendar(firstIsoOfNextYear, calendar)).toBe(
        expectedNext,
      );
    },
  );

  it("round-trips epoch-adjacent Islamic year 1 dates to gregorian for each variant", () => {
    expect(convertDateToCalendar("0622-07-19", "islamic-civil")).toBe(
      "0001-01-01[u-ca=islamic-civil]",
    );
    expect(
      convertDateToCalendar("0001-01-01[u-ca=islamic-civil]", "gregorian"),
    ).toBe("0622-07-19");

    expect(convertDateToCalendar("0622-07-18", "islamic-tabular")).toBe(
      "0001-01-01[u-ca=islamic-tabular]",
    );
    expect(
      convertDateToCalendar("0001-01-01[u-ca=islamic-tabular]", "gregorian"),
    ).toBe("0622-07-18");

    expect(convertDateToCalendar("0622-07-19", "islamic-umalqura")).toBe(
      "0001-01-01[u-ca=islamic-umalqura]",
    );
    expect(
      convertDateToCalendar("0001-01-01[u-ca=islamic-umalqura]", "gregorian"),
    ).toBe("0622-07-19");
  });

  // Umm al-Qura is a tabulated calendar (Saudi civil calendar), not the tabular variant's
  // pure arithmetic rule — this date is a table-boundary case where they diverge, proving
  // GMT does not silently approximate Umm al-Qura with tabular's math.
  it("Umm al-Qura diverges from the tabular calendar's arithmetic on a table-boundary date", () => {
    expect(convertDateToCalendar("2020-02-24", "islamic-umalqura")).toBe(
      "1441-06-30[u-ca=islamic-umalqura]",
    );
    expect(convertDateToCalendar("2020-02-24", "islamic-tabular")).toBe(
      "1441-07-01[u-ca=islamic-tabular]",
    );
  });

  it("returns empty string for an unsupported calendar system", () => {
    expect(
      convertDateToCalendar("2024-10-03", "martian" as unknown as "hebrew"),
    ).toBe("");
  });

  it("returns empty string when Temporal.PlainDate.from throws", () => {
    mockTemporalPlainDateFromThrow();
    expect(convertDateToCalendar("2024-10-03", "hebrew")).toBe("");
  });

  // Buddhist and Taiwan are pure fixed-offset calendars (Gregorian day/month structure);
  // Persian and Indian are distinct solar calendars with their own leap-year rule.
  it.each`
    value           | calendar      | expected
    ${"2024-10-03"} | ${"japanese"} | ${"0006-10-03[u-ca=japanese;era=reiwa]"}
    ${"2024-10-03"} | ${"buddhist"} | ${"2567-10-03[u-ca=buddhist]"}
    ${"2024-10-03"} | ${"taiwan"}   | ${"0113-10-03[u-ca=taiwan]"}
    ${"2024-10-03"} | ${"persian"}  | ${"1403-07-12[u-ca=persian]"}
    ${"2024-10-03"} | ${"indian"}   | ${"1946-07-11[u-ca=indian]"}
  `(
    "converts $value to $calendar as $expected",
    ({
      value,
      calendar,
      expected,
    }: {
      value: string;
      calendar: "japanese" | "buddhist" | "taiwan" | "persian" | "indian";
      expected: string;
    }) => {
      expect(convertDateToCalendar(value, calendar)).toBe(expected);
    },
  );

  // Every Japanese imperial era boundary Temporal supports, both sides of the transition.
  it.each`
    lastIsoOfEra    | expectedLast                              | firstIsoOfNextEra | expectedNext
    ${"1912-07-29"} | ${"0045-07-29[u-ca=japanese;era=meiji]"}  | ${"1912-07-30"}   | ${"0001-07-30[u-ca=japanese;era=taisho]"}
    ${"1926-12-24"} | ${"0015-12-24[u-ca=japanese;era=taisho]"} | ${"1926-12-25"}   | ${"0001-12-25[u-ca=japanese;era=showa]"}
    ${"1989-01-07"} | ${"0064-01-07[u-ca=japanese;era=showa]"}  | ${"1989-01-08"}   | ${"0001-01-08[u-ca=japanese;era=heisei]"}
    ${"2019-04-30"} | ${"0031-04-30[u-ca=japanese;era=heisei]"} | ${"2019-05-01"}   | ${"0001-05-01[u-ca=japanese;era=reiwa]"}
  `(
    "japanese era boundary: $lastIsoOfEra -> $expectedLast, $firstIsoOfNextEra -> $expectedNext",
    ({
      lastIsoOfEra,
      expectedLast,
      firstIsoOfNextEra,
      expectedNext,
    }: {
      lastIsoOfEra: string;
      expectedLast: string;
      firstIsoOfNextEra: string;
      expectedNext: string;
    }) => {
      expect(convertDateToCalendar(lastIsoOfEra, "japanese")).toBe(
        expectedLast,
      );
      expect(convertDateToCalendar(firstIsoOfNextEra, "japanese")).toBe(
        expectedNext,
      );
    },
  );

  // CORE-6 D8 (owner decision): the Intl era/monthCode proposal's era codes. ISO dates up to
  // 1872-12-31 are `ce` (era year = ISO year), ISO years <= 0 are `bce` (era year = 1 - ISO year),
  // and `meiji` starts at year 6 on 1873-01-01. Values: the proposal's era table, test262
  // japanese-pre-meiji.js and extreme-dates.js, Chromium 152.
  it.each`
    iso                | expected
    ${"1800-01-01"}    | ${"1800-01-01[u-ca=japanese;era=ce]"}
    ${"1868-10-23"}    | ${"1868-10-23[u-ca=japanese;era=ce]"}
    ${"1872-12-31"}    | ${"1872-12-31[u-ca=japanese;era=ce]"}
    ${"1873-01-01"}    | ${"0006-01-01[u-ca=japanese;era=meiji]"}
    ${"0001-01-01"}    | ${"0001-01-01[u-ca=japanese;era=ce]"}
    ${"0000-12-31"}    | ${"0001-12-31[u-ca=japanese;era=bce]"}
    ${"-000500-06-15"} | ${"0501-06-15[u-ca=japanese;era=bce]"}
    ${"-271821-04-19"} | ${"271822-04-19[u-ca=japanese;era=bce]"}
  `("converts $iso to japanese as $expected and back", ({ iso, expected }) => {
    expect(convertDateToCalendar(iso, "japanese")).toBe(expected);
    expect(convertDateToCalendar(expected, "gregorian")).toBe(iso);
  });

  // Era input: `ce`, `bce` and every proposal era parse; `japanese` is GMT's deprecated alias of
  // `ce` (the era GMT emitted before CORE-6), accepted until the next major.
  it.each`
    value                                       | expectedIso
    ${"1870-01-01[u-ca=japanese;era=ce]"}       | ${"1870-01-01"}
    ${"0006-01-01[u-ca=japanese;era=meiji]"}    | ${"1873-01-01"}
    ${"0501-06-15[u-ca=japanese;era=bce]"}      | ${"-000500-06-15"}
    ${"1800-01-01[u-ca=japanese;era=japanese]"} | ${"1800-01-01"}
  `(
    "parses the japanese era input $value as ISO $expectedIso",
    ({ value, expectedIso }) => {
      expect(convertDateToCalendar(value, "gregorian")).toBe(expectedIso);
    },
  );

  // CORE-6 D2 (owner decision): buddhist is proleptic Gregorian, year = ISO year + 543 with ISO
  // month and day, for every date. ICU4C's Julian cutover (1582-10-15) must not show through.
  it.each`
    iso                | expected                          | note
    ${"1000-01-01"}    | ${"1543-01-01[u-ca=buddhist]"}    | ${"before the cutover"}
    ${"1582-10-04"}    | ${"2125-10-04[u-ca=buddhist]"}    | ${"last Julian day in ICU4C"}
    ${"1582-10-14"}    | ${"2125-10-14[u-ca=buddhist]"}    | ${"a day ICU4C's cutover skips"}
    ${"1582-10-15"}    | ${"2125-10-15[u-ca=buddhist]"}    | ${"control"}
    ${"-000500-06-15"} | ${"0043-06-15[u-ca=buddhist]"}    | ${"far past, positive BE year"}
    ${"-000544-01-01"} | ${"-000001-01-01[u-ca=buddhist]"} | ${"negative BE year"}
    ${"-271821-04-19"} | ${"-271278-04-19[u-ca=buddhist]"} | ${"minimum (test262)"}
    ${"-271821-04-20"} | ${"-271278-04-20[u-ca=buddhist]"} | ${"minimum + 1 day"}
  `(
    "converts $iso to buddhist as $expected and back ($note)",
    ({ iso, expected }) => {
      expect(convertDateToCalendar(iso, "buddhist")).toBe(expected);
      expect(convertDateToCalendar(expected, "gregorian")).toBe(iso);
    },
  );

  // CORE-6 D3 + D4 (owner decision): Hebrew years <= 0. Values: Chromium 152 reads, which the
  // Dershowitz-Reingold arithmetic agrees with; Node's ICU4C is a day off here. Ordinal months:
  // year -268058 and -96239 are common, so M11 is month 11 and M06 month 6.
  it.each`
    iso                | expected                        | note
    ${"-003761-09-01"} | ${"0000-01-13[u-ca=hebrew]"}    | ${"year 0"}
    ${"-100000-01-01"} | ${"-096239-06-23[u-ca=hebrew]"} | ${"common negative year"}
    ${"-271821-11-05"} | ${"-268057-05-28[u-ca=hebrew]"} | ${"far past"}
    ${"-271821-04-19"} | ${"-268058-11-04[u-ca=hebrew]"} | ${"minimum (test262)"}
    ${"-271821-04-20"} | ${"-268058-11-05[u-ca=hebrew]"} | ${"minimum + 1 day"}
    ${"-001000-01-01"} | ${"2760-05-01[u-ca=hebrew]"}    | ${"positive-year control"}
  `(
    "converts $iso to hebrew as $expected and back ($note)",
    ({ iso, expected }) => {
      expect(convertDateToCalendar(iso, "hebrew")).toBe(expected);
      expect(convertDateToCalendar(expected, "gregorian")).toBe(iso);
    },
  );

  // CORE-6 D5 (owner decision): Indian dates before ISO year 1. Values: Chromium 152 reads and
  // test262 extreme-dates.js.
  it.each`
    iso                | expected                        | note
    ${"-000500-06-15"} | ${"-000578-03-25[u-ca=indian]"} | ${"far past"}
    ${"-271821-04-21"} | ${"-271899-02-01[u-ca=indian]"} | ${"minimum + 2 days, month 2"}
    ${"-271821-04-19"} | ${"-271899-01-29[u-ca=indian]"} | ${"minimum (test262)"}
    ${"0001-01-01"}    | ${"-000078-10-11[u-ca=indian]"} | ${"first ISO year 1 date (control)"}
  `(
    "converts $iso to indian as $expected and back ($note)",
    ({ iso, expected }) => {
      expect(convertDateToCalendar(iso, "indian")).toBe(expected);
      expect(convertDateToCalendar(expected, "gregorian")).toBe(iso);
    },
  );

  it("round-trips a japanese date through gregorian and back", () => {
    const converted = convertDateToCalendar("2024-10-03", "japanese");
    expect(converted).toBe("0006-10-03[u-ca=japanese;era=reiwa]");
    expect(convertDateToCalendar(converted, "gregorian")).toBe("2024-10-03");
  });

  // 1403 AP is a leap year (30-day 12th month, Esfand) under Persian's 33-year cycle rule
  // (`(25 * year + 11) % 33 < 8`); the Gregorian year/month boundary lands mid-Persian-year.
  it("converts the leap-year boundary of Persian year 1403 (Esfand 30 -> Farvardin 1)", () => {
    expect(convertDateToCalendar("2024-03-19", "persian")).toBe(
      "1402-12-29[u-ca=persian]",
    );
    expect(convertDateToCalendar("2024-03-20", "persian")).toBe(
      "1403-01-01[u-ca=persian]",
    );
  });

  it("round-trips a persian date through gregorian and back", () => {
    const converted = convertDateToCalendar("2024-10-03", "persian");
    expect(converted).toBe("1403-07-12[u-ca=persian]");
    expect(convertDateToCalendar(converted, "gregorian")).toBe("2024-10-03");
  });

  // Indian's leap alignment follows the Gregorian rule (its first month is 31 days in a
  // Gregorian leap year, 30 otherwise) rather than an independent cycle of its own.
  it("converts the Saka-year boundary that crosses a Gregorian-aligned leap adjustment", () => {
    expect(convertDateToCalendar("2024-03-20", "indian")).toBe(
      "1945-12-30[u-ca=indian]",
    );
    expect(convertDateToCalendar("2024-03-21", "indian")).toBe(
      "1946-01-01[u-ca=indian]",
    );
  });

  it("round-trips an indian date through gregorian and back", () => {
    const converted = convertDateToCalendar("2024-10-03", "indian");
    expect(converted).toBe("1946-07-11[u-ca=indian]");
    expect(convertDateToCalendar(converted, "gregorian")).toBe("2024-10-03");
  });

  it("converts a taiwan (ROC) date before the 1912 epoch using the inverse era's signed year", () => {
    expect(convertDateToCalendar("1911-12-31", "taiwan")).toBe(
      "0000-12-31[u-ca=taiwan]",
    );
    expect(convertDateToCalendar("1912-01-01", "taiwan")).toBe(
      "0001-01-01[u-ca=taiwan]",
    );
  });

  it("round-trips buddhist and taiwan dates through gregorian and back", () => {
    const buddhist = convertDateToCalendar("2024-10-03", "buddhist");
    expect(buddhist).toBe("2567-10-03[u-ca=buddhist]");
    expect(convertDateToCalendar(buddhist, "gregorian")).toBe("2024-10-03");

    const taiwan = convertDateToCalendar("2024-10-03", "taiwan");
    expect(taiwan).toBe("0113-10-03[u-ca=taiwan]");
    expect(convertDateToCalendar(taiwan, "gregorian")).toBe("2024-10-03");
  });

  it.each`
    value           | calendar
    ${"invalid"}    | ${"japanese"}
    ${"2024-02-30"} | ${"buddhist"}
    ${""}           | ${"taiwan"}
    ${null}         | ${"persian"}
    ${123}          | ${"indian"}
  `(
    "returns empty string for invalid input: $value / $calendar",
    ({
      value,
      calendar,
    }: {
      value: unknown;
      calendar: "japanese" | "buddhist" | "taiwan" | "persian" | "indian";
    }) => {
      expect(convertDateToCalendar(value as string, calendar)).toBe("");
    },
  );

  // Ethiopic, Ethiopic Amete Alem, and Coptic share the same 13-month structure (12 x 30
  // days + a short Pagume/Nasie 13th month) but differ in epoch: Ethiopic additionally
  // resets to the Amete Mihret era at ~AD 8 (hence the eraYear-based string, unlike its
  // two siblings), Amete Alem counts continuously from ~5493 BCE, and Coptic's epoch is
  // the Diocletian/Martyrs era (~AD 284).
  it.each`
    value           | calendar                 | expected
    ${"2024-10-03"} | ${"ethiopic"}            | ${"2017-01-23[u-ca=ethiopic;era=ethiopic]"}
    ${"2024-10-03"} | ${"ethiopic-amete-alem"} | ${"7517-01-23[u-ca=ethiopic-amete-alem]"}
    ${"2024-10-03"} | ${"coptic"}              | ${"1741-01-23[u-ca=coptic]"}
  `(
    "converts $value to $calendar as $expected",
    ({
      value,
      calendar,
      expected,
    }: {
      value: string;
      calendar: "ethiopic" | "ethiopic-amete-alem" | "coptic";
      expected: string;
    }) => {
      expect(convertDateToCalendar(value, calendar)).toBe(expected);
    },
  );

  // 13th-month (Pagume/Nasie) boundary: a non-leap year's 13th month is 5 days, crossing
  // straight into next year's month 1 day 1.
  it.each`
    lastIsoOfYear   | calendar                 | expectedLast                                | firstIsoOfNextYear | expectedNext
    ${"2025-09-10"} | ${"ethiopic"}            | ${"2017-13-05[u-ca=ethiopic;era=ethiopic]"} | ${"2025-09-11"}    | ${"2018-01-01[u-ca=ethiopic;era=ethiopic]"}
    ${"2025-09-10"} | ${"ethiopic-amete-alem"} | ${"7517-13-05[u-ca=ethiopic-amete-alem]"}   | ${"2025-09-11"}    | ${"7518-01-01[u-ca=ethiopic-amete-alem]"}
    ${"2025-09-10"} | ${"coptic"}              | ${"1741-13-05[u-ca=coptic]"}                | ${"2025-09-11"}    | ${"1742-01-01[u-ca=coptic]"}
  `(
    "non-leap 13th month boundary for $calendar: $lastIsoOfYear -> $expectedLast, $firstIsoOfNextYear -> $expectedNext",
    ({
      lastIsoOfYear,
      calendar,
      expectedLast,
      firstIsoOfNextYear,
      expectedNext,
    }: {
      lastIsoOfYear: string;
      calendar: "ethiopic" | "ethiopic-amete-alem" | "coptic";
      expectedLast: string;
      firstIsoOfNextYear: string;
      expectedNext: string;
    }) => {
      expect(convertDateToCalendar(lastIsoOfYear, calendar)).toBe(expectedLast);
      expect(convertDateToCalendar(firstIsoOfNextYear, calendar)).toBe(
        expectedNext,
      );
    },
  );

  // Leap-year-equivalent boundary: a leap year's 13th month is 6 days (Pagume/Nasie 6, the
  // Julian-calendar-aligned leap day), one day longer than the non-leap case above.
  it.each`
    lastIsoOfYear   | calendar                 | expectedLast                                | firstIsoOfNextYear | expectedNext
    ${"2027-09-11"} | ${"ethiopic"}            | ${"2019-13-06[u-ca=ethiopic;era=ethiopic]"} | ${"2027-09-12"}    | ${"2020-01-01[u-ca=ethiopic;era=ethiopic]"}
    ${"2027-09-11"} | ${"ethiopic-amete-alem"} | ${"7519-13-06[u-ca=ethiopic-amete-alem]"}   | ${"2027-09-12"}    | ${"7520-01-01[u-ca=ethiopic-amete-alem]"}
    ${"2027-09-11"} | ${"coptic"}              | ${"1743-13-06[u-ca=coptic]"}                | ${"2027-09-12"}    | ${"1744-01-01[u-ca=coptic]"}
  `(
    "leap 13th month boundary for $calendar: $lastIsoOfYear -> $expectedLast, $firstIsoOfNextYear -> $expectedNext",
    ({
      lastIsoOfYear,
      calendar,
      expectedLast,
      firstIsoOfNextYear,
      expectedNext,
    }: {
      lastIsoOfYear: string;
      calendar: "ethiopic" | "ethiopic-amete-alem" | "coptic";
      expectedLast: string;
      firstIsoOfNextYear: string;
      expectedNext: string;
    }) => {
      expect(convertDateToCalendar(lastIsoOfYear, calendar)).toBe(expectedLast);
      expect(convertDateToCalendar(firstIsoOfNextYear, calendar)).toBe(
        expectedNext,
      );
    },
  );

  // Ethiopic's own era boundary: the Amete Alem ("ethioaa") era gives way to the Amete
  // Mihret ("ethiopic") era at this Julian-calendar date, mirroring the japanese era
  // boundary tests above.
  it("converts the ethiopic era boundary (amete-alem -> amete-mihret)", () => {
    expect(convertDateToCalendar("0008-08-26", "ethiopic")).toBe(
      "5500-13-05[u-ca=ethiopic;era=ethioaa]",
    );
    expect(convertDateToCalendar("0008-08-27", "ethiopic")).toBe(
      "0001-01-01[u-ca=ethiopic;era=ethiopic]",
    );
  });

  it("round-trips epoch-adjacent dates for each Ethiopic-family calendar", () => {
    const ethiopic = convertDateToCalendar("-005492-07-17", "ethiopic");
    expect(ethiopic).toBe("0001-01-01[u-ca=ethiopic;era=ethioaa]");
    expect(convertDateToCalendar(ethiopic, "gregorian")).toBe("-005492-07-17");

    const ameteAlem = convertDateToCalendar(
      "-005492-07-17",
      "ethiopic-amete-alem",
    );
    expect(ameteAlem).toBe("0001-01-01[u-ca=ethiopic-amete-alem]");
    expect(convertDateToCalendar(ameteAlem, "gregorian")).toBe("-005492-07-17");

    const coptic = convertDateToCalendar("0284-08-29", "coptic");
    expect(coptic).toBe("0001-01-01[u-ca=coptic]");
    expect(convertDateToCalendar(coptic, "gregorian")).toBe("0284-08-29");
  });

  it("round-trips ethiopic-family dates through gregorian and back", () => {
    const ethiopic = convertDateToCalendar("2024-10-03", "ethiopic");
    expect(ethiopic).toBe("2017-01-23[u-ca=ethiopic;era=ethiopic]");
    expect(convertDateToCalendar(ethiopic, "gregorian")).toBe("2024-10-03");

    const ameteAlem = convertDateToCalendar(
      "2024-10-03",
      "ethiopic-amete-alem",
    );
    expect(ameteAlem).toBe("7517-01-23[u-ca=ethiopic-amete-alem]");
    expect(convertDateToCalendar(ameteAlem, "gregorian")).toBe("2024-10-03");

    const coptic = convertDateToCalendar("2024-10-03", "coptic");
    expect(coptic).toBe("1741-01-23[u-ca=coptic]");
    expect(convertDateToCalendar(coptic, "gregorian")).toBe("2024-10-03");
  });

  it.each`
    value           | calendar
    ${"invalid"}    | ${"ethiopic"}
    ${"2024-02-30"} | ${"ethiopic-amete-alem"}
    ${""}           | ${"coptic"}
    ${null}         | ${"ethiopic"}
    ${123}          | ${"coptic"}
  `(
    "returns empty string for invalid input: $value / $calendar",
    ({
      value,
      calendar,
    }: {
      value: unknown;
      calendar: "ethiopic" | "ethiopic-amete-alem" | "coptic";
    }) => {
      expect(convertDateToCalendar(value as string, calendar)).toBe("");
    },
  );
});
