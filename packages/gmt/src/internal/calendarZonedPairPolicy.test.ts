import { calendarZonedFixtures } from "../test";
import { parseCalendarZonedPairForArithmetic } from "./calendarZonedPairPolicy";
import { parseCalendarZonedValue } from "./calendarZonedString";

const Y = calendarZonedFixtures.hebrewLeapYearSpan;
const islamicEnd =
  "1446-03-30T00:00:00-04:00[u-ca=islamic-tabular][America/New_York]";

describe("parseCalendarZonedPairForArithmetic", () => {
  it.each`
    label                    | aValue                   | bValue                   | calendar       | operandCalendarId
    ${"both hebrew"}         | ${Y.tishri1_5784NewYork} | ${Y.tishri1_5785NewYork} | ${"hebrew"}    | ${"hebrew"}
    ${"both bare ISO"}       | ${Y.isoStart}            | ${Y.isoEnd}              | ${"gregorian"} | ${"iso8601"}
    ${"hebrew and islamic"}  | ${Y.tishri1_5784NewYork} | ${islamicEnd}            | ${"gregorian"} | ${"iso8601"}
    ${"hebrew and bare ISO"} | ${Y.tishri1_5784NewYork} | ${Y.isoEnd}              | ${"gregorian"} | ${"iso8601"}
  `(
    "resolves $label to calendar $calendar with both operands normalized to $operandCalendarId",
    ({ aValue, bValue, calendar, operandCalendarId }) => {
      const pair = parseCalendarZonedPairForArithmetic(aValue, bValue);

      expect(pair.calendar).toBe(calendar);
      expect(pair.a.calendarId).toBe(operandCalendarId);
      expect(pair.b.calendarId).toBe(operandCalendarId);
    },
  );

  it("preserves both operands' instants when falling back to Gregorian", () => {
    const pair = parseCalendarZonedPairForArithmetic(
      Y.tishri1_5784NewYork,
      islamicEnd,
    );

    expect(pair.a.toInstant().toString()).toBe(
      parseCalendarZonedValue(Y.tishri1_5784NewYork).toInstant().toString(),
    );
    expect(pair.b.toInstant().toString()).toBe(
      parseCalendarZonedValue(islamicEnd).toInstant().toString(),
    );
  });

  // The Gregorian fallback is mandatory rather than a convenience: unlike PlainDate (where only
  // date units throw), ZonedDateTime.until throws across mismatched calendars for EVERY
  // largestUnit. Without normalization, even a pure time-unit question would fail.
  it.each`
    largestUnit
    ${"month"}
    ${"hour"}
    ${"nanosecond"}
  `(
    "makes an otherwise-throwing until($largestUnit) across mismatched calendars succeed",
    ({ largestUnit }) => {
      const rawA = parseCalendarZonedValue(Y.tishri1_5784NewYork);
      const rawB = parseCalendarZonedValue(islamicEnd);

      expect(() => rawA.until(rawB, { largestUnit })).toThrow();

      const pair = parseCalendarZonedPairForArithmetic(
        Y.tishri1_5784NewYork,
        islamicEnd,
      );
      expect(() => pair.a.until(pair.b, { largestUnit })).not.toThrow();
    },
  );

  // R2: the wrong answer here is plausible enough to survive eyeballing, so it is pinned
  // explicitly. All three numbers were produced by running @js-temporal/polyfill@0.5.1.
  it("returns operands whose relativeTo anchor gives the correct total, not the plausible wrong one", () => {
    const rawHebrew = parseCalendarZonedValue(Y.tishri1_5784NewYork);
    const pair = parseCalendarZonedPairForArithmetic(
      Y.tishri1_5784NewYork,
      islamicEnd,
    );
    const duration = pair.a.until(pair.b, { largestUnit: "month" });

    // Correct: anchor on the policy's normalized operand.
    expect(duration.total({ unit: "month", relativeTo: pair.a })).toBe(
      12.566666666666666,
    );

    // Wrong, but neither throws nor looks obviously wrong — anchoring on the raw Hebrew operand
    // lands between the correct ISO answer above and the correct all-Hebrew answer of 13.
    expect(duration.total({ unit: "month", relativeTo: rawHebrew })).toBe(
      12.586206896551724,
    );
  });

  it("measures in the shared calendar when both endpoints agree", () => {
    const pair = parseCalendarZonedPairForArithmetic(
      Y.tishri1_5784NewYork,
      Y.tishri1_5785NewYork,
    );

    expect(
      pair.a
        .until(pair.b, { largestUnit: "month" })
        .total({ unit: "month", relativeTo: pair.a }),
    ).toBe(13);
  });

  it("throws when either value is not a valid GMT zoned string", () => {
    expect(() =>
      parseCalendarZonedPairForArithmetic("invalid", Y.isoEnd),
    ).toThrow();
    expect(() =>
      parseCalendarZonedPairForArithmetic(
        Y.isoStart,
        "2024-10-03T14:30:45-04:00[America/New_York][u-ca=hebrew]",
      ),
    ).toThrow();
  });
});
