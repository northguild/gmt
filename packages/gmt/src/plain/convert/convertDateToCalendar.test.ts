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

  // Dates before the Meiji era (1868-10-23) are a known gap in `@internationalized/date`
  // (documented as unsupported there), but GMT delegates entirely to Temporal's own
  // calendar support rather than porting/replicating that limitation — Temporal resolves
  // pre-Meiji dates under a synthetic "japanese" era with an ISO-aligned eraYear, and GMT
  // passes that straight through as an intentional extension, not an error case.
  it("converts a pre-Meiji date under the synthetic 'japanese' era rather than rejecting it", () => {
    expect(convertDateToCalendar("1800-01-01", "japanese")).toBe(
      "1800-01-01[u-ca=japanese;era=japanese]",
    );
    expect(
      convertDateToCalendar(
        "1800-01-01[u-ca=japanese;era=japanese]",
        "gregorian",
      ),
    ).toBe("1800-01-01");
  });

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
});
