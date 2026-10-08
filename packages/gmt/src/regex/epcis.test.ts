import { epcisEventTime, epcisTimeZoneOffset } from "./epcis";
import * as regex from "./index";

// GS1 EPCIS 2.0 (ISO/IEC 19987). Both patterns are the published grammar verbatim: the JSON
// schema's `eventTimeZoneOffset` pattern and the XSD's `DateTimeStamp` pattern. Neither is
// loosened or tightened here, so the rows below assert GS1's grammar, not GMT's judgement.

describe("regex/epcisTimeZoneOffset (JSON schema eventTimeZoneOffset)", () => {
  it.each`
    value          | expected | reason
    ${"+02:00"}    | ${true}  | ${"eastern offset"}
    ${"-05:00"}    | ${true}  | ${"western offset"}
    ${"+00:00"}    | ${true}  | ${"zero"}
    ${"-00:00"}    | ${true}  | ${"negative zero: the pattern allows it"}
    ${"+05:30"}    | ${true}  | ${"half-hour offset"}
    ${"+13:59"}    | ${true}  | ${"last minute below the 14:00 alternative"}
    ${"-13:59"}    | ${true}  | ${"last minute below the 14:00 alternative, west"}
    ${"+14:00"}    | ${true}  | ${"the one 14-hour value the pattern names"}
    ${"-14:00"}    | ${true}  | ${"the pattern's sign group is independent of the 14:00 alternative"}
    ${"+14:01"}    | ${false} | ${"past 14:00"}
    ${"-14:01"}    | ${false} | ${"past 14:00, west"}
    ${"+14:30"}    | ${false} | ${"past 14:00"}
    ${"-14:30"}    | ${false} | ${"past 14:00, west"}
    ${"+15:00"}    | ${false} | ${"hour 15"}
    ${"-15:00"}    | ${false} | ${"hour 15, west"}
    ${"+05:30:00"} | ${false} | ${"seconds"}
    ${"+02:60"}    | ${false} | ${"minute 60"}
    ${"Z"}         | ${false} | ${"Z is eventTime's designator, not an offset"}
    ${"+0200"}     | ${false} | ${"no colon"}
    ${"+02"}       | ${false} | ${"hours only"}
    ${"02:00"}     | ${false} | ${"no sign"}
    ${"+2:00"}     | ${false} | ${"unpadded hour"}
    ${" +02:00"}   | ${false} | ${"leading whitespace"}
    ${"+02:00 "}   | ${false} | ${"trailing whitespace"}
    ${""}          | ${false} | ${"empty string"}
  `("matches $value as $expected ($reason)", ({ value, expected }) => {
    expect(epcisTimeZoneOffset.test(value)).toBe(expected);
  });

  it("is GS1's pattern verbatim, anchored, with no flags", () => {
    expect(epcisTimeZoneOffset.source).toBe(
      "^([+]|[-])((0[0-9]|1[0-3]):([0-5][0-9])|14:00)$",
    );
    expect(epcisTimeZoneOffset.flags).toBe("");
  });
});

describe("regex/epcisEventTime (XSD DateTimeStamp)", () => {
  it.each`
    value                                | expected | reason
    ${"2024-06-15T14:30:00Z"}            | ${true}  | ${"UTC instant with seconds"}
    ${"2024-06-15T14:30:00+02:00"}       | ${true}  | ${"offset form"}
    ${"2024-06-15T14:30:00-05:00"}       | ${true}  | ${"negative offset"}
    ${"2024-06-15T14:30:00.123Z"}        | ${true}  | ${"fraction, any length"}
    ${"2024-06-15T14:30:00.1Z"}          | ${true}  | ${"one-digit fraction"}
    ${"2024-06-15T14:30:00.123456789Z"}  | ${true}  | ${"nine-digit fraction"}
    ${"2024-06-15T14:30:00.1234567891Z"} | ${true}  | ${"ten-digit fraction: the XSD allows any length, and parseEpcisEvent refuses it (GMT rule)"}
    ${"2024-06-15T14:30:00+14:00"}       | ${true}  | ${"the 14:00 offset"}
    ${"2024-06-15T14:30:00-14:00"}       | ${true}  | ${"the 14:00 offset, west"}
    ${"2024-06-15T14:30:00+13:59"}       | ${true}  | ${"last minute below the 14:00 alternative"}
    ${"0000-01-01T00:00:00Z"}            | ${true}  | ${"the first four-digit year"}
    ${"9999-12-31T23:59:59Z"}            | ${true}  | ${"the last four-digit year"}
    ${"2024-02-29T00:00:00Z"}            | ${true}  | ${"leap day: shape only"}
    ${"2023-02-29T00:00:00Z"}            | ${true}  | ${"a day the year does not have still matches: calendar validity is Temporal's"}
    ${"2024-06-15T14:30Z"}               | ${false} | ${"seconds are required"}
    ${"2024-06-15T14:30:00"}             | ${false} | ${"Z or offset is required"}
    ${"2024-06-15T14:30:00+15:00"}       | ${false} | ${"offset hour 15"}
    ${"2024-06-15T14:30:00+14:01"}       | ${false} | ${"offset one minute past 14:00"}
    ${"2024-06-15T14:30:00-14:30"}       | ${false} | ${"offset past 14:00, west"}
    ${"2024-06-15T14:30:00+0200"}        | ${false} | ${"offset without colon"}
    ${"2024-06-15T24:00:00Z"}            | ${false} | ${"hour 24"}
    ${"2024-13-15T14:30:00Z"}            | ${false} | ${"month 13"}
    ${"2024-06-32T14:30:00Z"}            | ${false} | ${"day 32"}
    ${"2024-06-15T14:30:60Z"}            | ${false} | ${"second 60"}
    ${"2024-06-15 14:30:00Z"}            | ${false} | ${"space separator"}
    ${"2024-06-15t14:30:00Z"}            | ${false} | ${"lower-case t"}
    ${"2024-06-15T14:30:00z"}            | ${false} | ${"lower-case z"}
    ${"2024-06-15T14:30:00.Z"}           | ${false} | ${"period with no fraction digits"}
    ${"+002024-06-15T14:30:00Z"}         | ${false} | ${"expanded year"}
    ${"20240615T143000Z"}                | ${false} | ${"no separators"}
    ${" 2024-06-15T14:30:00Z"}           | ${false} | ${"leading whitespace"}
    ${"2024-06-15T14:30:00Z "}           | ${false} | ${"trailing whitespace"}
    ${""}                                | ${false} | ${"empty string"}
  `("matches $value as $expected ($reason)", ({ value, expected }) => {
    expect(epcisEventTime.test(value)).toBe(expected);
  });

  it("is GS1's pattern verbatim, anchored, with no flags", () => {
    expect(epcisEventTime.source).toBe(
      "^([0-9]{4})-(1[0-2]|0[1-9])-(3[01]|0[1-9]|[12][0-9])T(2[0-3]|[01][0-9]):([0-5][0-9]):([0-5][0-9])(\\.[0-9]+)?(Z|(([+]|[-])((0[0-9]|1[0-3]):([0-5][0-9])|14:00)))$",
    );
    expect(epcisEventTime.flags).toBe("");
  });

  it("captures year, month, day, hour, minute, second, fraction, designator", () => {
    expect(
      epcisEventTime.exec("2024-06-15T14:30:00.5-05:00")?.slice(1, 9),
    ).toEqual(["2024", "06", "15", "14", "30", "00", ".5", "-05:00"]);
  });
});

describe("regex/epcis barrel", () => {
  it.each`
    name                     | pattern
    ${"epcisEventTime"}      | ${epcisEventTime}
    ${"epcisTimeZoneOffset"} | ${epcisTimeZoneOffset}
  `("exports $name from the regex barrel", ({ name, pattern }) => {
    expect((regex as Record<string, unknown>)[name]).toBe(pattern);
  });

  // The EDI grammars (UNTDID 2379, X12 1250) are a value-plus-code relation, so their public form
  // is the validator function, not a constant per code; they live in `internal/ediGrammar.ts`.
  // The two EPCIS patterns are the only RegExp constants this story adds to the barrel.
  it("adds exactly the two EPCIS patterns to the barrel's RegExp exports", () => {
    // Read off the barrel at `main` (`git show main:packages/gmt/src/regex/index.ts`, every
    // RegExp export of the fifteen modules it names), not typed from memory.
    const patternsOnMain = [
      "calendarDate",
      "calendarZonedDateTime",
      "day",
      "fractionalSecond",
      "hour",
      "httpDate",
      "instantLeapSecond",
      "leapSecond",
      "millisecond",
      "minute",
      "month",
      "nanosecondDecimal",
      "plainDate",
      "plainDateTime",
      "plainTime",
      "rfc2822DateTime",
      "rfc3339DateTime",
      "second",
      "sqlDateTime",
      "timeZoneLike",
      "unixMilliseconds",
      "unixSeconds",
      "utcDateTime",
      "utcOffset",
      "year",
    ];
    const patternsNow = Object.entries(regex)
      .filter(([, value]) => value instanceof RegExp)
      .map(([name]) => name)
      .sort();
    expect(patternsNow).toEqual(
      [...patternsOnMain, "epcisEventTime", "epcisTimeZoneOffset"].sort(),
    );
  });
});
