import { parseCalendarDatePairForArithmetic } from "./calendarDatePairPolicy";

describe("parseCalendarDatePairForArithmetic", () => {
  it("resolves in the shared calendar when both values carry the same tag", () => {
    const { calendar, a, b } = parseCalendarDatePairForArithmetic(
      "2024-02-24[u-ca=hebrew]",
      "2024-03-25[u-ca=hebrew]",
    );
    expect(calendar).toBe("hebrew");
    expect(a.calendarId).toBe("hebrew");
    expect(b.calendarId).toBe("hebrew");
    expect(a.until(b, { largestUnit: "months" }).months).toBe(1);
  });

  it("resolves as iso8601 when both values are bare ISO", () => {
    const { calendar, a, b } = parseCalendarDatePairForArithmetic(
      "2024-01-01",
      "2024-02-01",
    );
    expect(calendar).toBe("iso8601");
    expect(a.calendarId).toBe("iso8601");
    expect(b.calendarId).toBe("iso8601");
  });

  // TC39 DifferenceTemporalPlainDate: CalendarEquals is false -> RangeError, for every largestUnit.
  // Native Temporal (Chromium 153) throws "Mismatched calendars." for each pair below.
  it.each`
    aValue                         | bValue                         | reason
    ${"2024-10-03[u-ca=hebrew]"}   | ${"2024-11-03"}                | ${"hebrew and bare ISO"}
    ${"2024-10-03"}                | ${"2024-11-02[u-ca=hebrew]"}   | ${"bare ISO and hebrew"}
    ${"2024-10-03"}                | ${"2024-11-02[u-ca=gregory]"}  | ${"iso8601 and gregory"}
    ${"2024-10-03[u-ca=ethiopic]"} | ${"2024-11-02[u-ca=ethioaa]"}  | ${"ethiopic and ethioaa, which compute alike but are different calendars"}
    ${"2024-10-03[u-ca=coptic]"}   | ${"2024-11-02[u-ca=ethiopic]"} | ${"coptic and ethiopic"}
  `(
    "throws a RangeError for $aValue and $bValue ($reason), as Temporal's until does",
    ({ aValue, bValue }) => {
      expect(() => parseCalendarDatePairForArithmetic(aValue, bValue)).toThrow(
        RangeError,
      );
    },
  );

  it("resolves in the shared calendar when the two tags spell the same calendar differently", () => {
    const { calendar, a } = parseCalendarDatePairForArithmetic(
      "2024-10-03[u-ca=ethiopic-amete-alem]",
      "2024-11-02[u-ca=ethioaa]",
    );
    expect(calendar).toBe("ethioaa");
    expect(a.calendarId).toBe("ethioaa");
  });

  it("throws if either value fails to parse", () => {
    expect(() =>
      parseCalendarDatePairForArithmetic("not-a-date", "2024-01-01"),
    ).toThrow();
  });
});
