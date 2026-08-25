import { parseCalendarDatePairForArithmetic } from "./calendarDatePairPolicy";

describe("parseCalendarDatePairForArithmetic", () => {
  it("resolves in the shared calendar when both values carry the same tag", () => {
    const { calendar, a, b } = parseCalendarDatePairForArithmetic(
      "5784-06-15[u-ca=hebrew]",
      "5784-07-15[u-ca=hebrew]",
    );
    expect(calendar).toBe("hebrew");
    expect(a.calendarId).toBe("hebrew");
    expect(b.calendarId).toBe("hebrew");
    expect(a.until(b, { largestUnit: "months" }).months).toBe(1);
  });

  it("resolves as gregorian when both values are bare ISO", () => {
    const { calendar, a, b } = parseCalendarDatePairForArithmetic(
      "2024-01-01",
      "2024-02-01",
    );
    expect(calendar).toBe("gregorian");
    expect(a.calendarId).toBe("iso8601");
    expect(b.calendarId).toBe("iso8601");
  });

  it("falls back to iso8601 (both operands converted) when the two calendars mismatch", () => {
    const { calendar, a, b } = parseCalendarDatePairForArithmetic(
      "5785-01-01[u-ca=hebrew]", // = 2024-10-03
      "2024-11-03",
    );
    expect(calendar).toBe("gregorian");
    expect(a.calendarId).toBe("iso8601");
    expect(b.calendarId).toBe("iso8601");
    expect(a.toString()).toBe("2024-10-03");
    // Falling back to iso8601 must not throw the "cannot compute difference between dates of
    // different calendars" RangeError that .until() throws across genuinely mismatched
    // calendars (verified directly against @js-temporal/polyfill during E5 research).
    expect(a.until(b, { largestUnit: "days" }).days).toBe(31);
  });

  it("falls back to iso8601 when one value is bare ISO and the other is calendar-tagged", () => {
    const { calendar } = parseCalendarDatePairForArithmetic(
      "2024-10-03",
      "5785-02-01[u-ca=hebrew]",
    );
    expect(calendar).toBe("gregorian");
  });

  it("throws if either value fails to parse", () => {
    expect(() =>
      parseCalendarDatePairForArithmetic("not-a-date", "2024-01-01"),
    ).toThrow();
  });
});
