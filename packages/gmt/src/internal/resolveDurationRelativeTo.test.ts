import { Temporal } from "@js-temporal/polyfill";
import { resolveDurationRelativeTo } from "./resolveDurationRelativeTo";

describe("resolveDurationRelativeTo", () => {
  it("passes through undefined unchanged", () => {
    expect(resolveDurationRelativeTo(undefined)).toBeUndefined();
  });

  it("passes a plain ISO string through unchanged", () => {
    expect(resolveDurationRelativeTo("2024-02-10")).toBe("2024-02-10");
  });

  it("passes a Temporal.PlainDateTime object through unchanged", () => {
    const pdt = Temporal.PlainDateTime.from("2024-02-10T00:00:00");
    expect(resolveDurationRelativeTo(pdt)).toBe(pdt);
  });

  it("passes a non-calendar-annotated string through unchanged even if it superficially resembles one", () => {
    // Doesn't match the calendarDate grammar (no [u-ca=...] suffix) — untouched.
    expect(resolveDurationRelativeTo("2024-02-10T00:00:00")).toBe(
      "2024-02-10T00:00:00",
    );
  });

  it("converts an RFC 9557 calendar-annotated PlainDate string into the PlainDateTime it names", () => {
    const resolved = resolveDurationRelativeTo("2024-02-24[u-ca=hebrew]");
    expect(resolved).toBeInstanceOf(Temporal.PlainDateTime);
    const pdt = resolved as Temporal.PlainDateTime;
    expect(pdt.calendarId).toBe("hebrew");
    expect(pdt.toPlainDate().withCalendar("iso8601").toString()).toBe(
      "2024-02-24",
    );
  });

  it("produces a relativeTo that resolves duration totals identically to the equivalent Temporal-shape string", () => {
    // Native Temporal (Chromium 153): P1Y from ISO 2024-02-24 in the Hebrew calendar is 385 days.
    const resolved = resolveDurationRelativeTo("2024-02-24[u-ca=hebrew]");
    expect(
      Temporal.Duration.from("P1Y").total({
        unit: "days",
        relativeTo: resolved,
      }),
    ).toBe(385);
  });

  // The GMT calendar grammars, as Temporal reads them: critical flag and letter case are part of
  // RFC 9557 / CanonicalizeCalendar; "ethiopic" and "coptic" compute in "ethioaa".
  it.each`
    value                                                           | type                      | calendarId
    ${"2024-02-24[!u-ca=hebrew]"}                                   | ${Temporal.PlainDateTime} | ${"hebrew"}
    ${"2024-02-24[u-ca=HEBREW]"}                                    | ${Temporal.PlainDateTime} | ${"hebrew"}
    ${"2024-02-24[u-ca=coptic]"}                                    | ${Temporal.PlainDateTime} | ${"ethioaa"}
    ${"2024-02-24T00:00:00+00:00[UTC][u-ca=hebrew]"}                | ${Temporal.ZonedDateTime} | ${"hebrew"}
    ${"2024-02-24T00:00:00-05:00[America/New_York][u-ca=ethiopic]"} | ${Temporal.ZonedDateTime} | ${"ethioaa"}
    ${"2024-02-24[u-ca=hebrew][foo=bar]"}                           | ${Temporal.PlainDateTime} | ${"hebrew"}
    ${"2024-02-24T00:00:00[u-ca=hebrew]"}                           | ${Temporal.PlainDateTime} | ${"hebrew"}
    ${"2024-02-24T00:00:00+00:00[UTC][foo=bar][u-ca=hebrew]"}       | ${Temporal.ZonedDateTime} | ${"hebrew"}
  `(
    "resolves $value to a $type.name computing in $calendarId",
    ({ value, type, calendarId }) => {
      const resolved = resolveDurationRelativeTo(value);
      expect(resolved).toBeInstanceOf(type);
      expect((resolved as Temporal.PlainDateTime).calendarId).toBe(calendarId);
    },
  );

  it.each`
    value                                            | reason
    ${"2024-02-24[!foo=bar][u-ca=hebrew]"}           | ${"unknown critical annotation"}
    ${"2024-02-24[u-ca=hebrew][!u-ca=roc]"}          | ${"critical second calendar annotation"}
    ${"2024-02-24T00:00:00Z[u-ca=hebrew]"}           | ${"UTC designator without a time zone annotation"}
    ${"2024-02-24T00:00:00+00:00[u-ca=hebrew][UTC]"} | ${"calendar before zone (not RFC 9557)"}
    ${"2024-02-24[U-CA=hebrew]"}                     | ${"upper-case annotation key"}
    ${"2024-02-24[u-ca=chinese]"}                    | ${"calendar GMT does not support"}
    ${"0006-02-01[u-ca=japanese;era=reiwa]"}         | ${"';era=' is not RFC 9557 syntax"}
    ${"2016-12-31t23:59:60+00:00[UTC]"}              | ${"leap second, lowercase t"}
    ${"2016-12-31T23:59:60"}                         | ${"leap second, PlainDateTime"}
  `("throws for $value ($reason)", ({ value }) => {
    expect(() => resolveDurationRelativeTo(value)).toThrow(RangeError);
  });

  it("throws for a malformed calendar-annotated string", () => {
    expect(() =>
      resolveDurationRelativeTo("2024-14-01[u-ca=hebrew]"),
    ).toThrow();
  });
});

// Strict-shape rule (see coding-standards): the part before the first `[` must be GMT's strict extended date (or
// date-time), as `isValidDate`/`isValidDateTime` require. Native Chromium 153
// `Temporal.PlainDate.from` reads each of these as 2024-10-03; GMT rejects them.
describe("resolveDurationRelativeTo calendar PlainDate strings use GMT's strict shape", () => {
  it.each`
    value                                    | reason
    ${"20241003[u-ca=hebrew]"}               | ${"basic format"}
    ${"2024-10-03 14:30[u-ca=hebrew]"}       | ${"space separator"}
    ${"2024-10-03T14:30+01:00[u-ca=hebrew]"} | ${"UTC offset"}
  `("throws for $value ($reason)", ({ value }) => {
    expect(() => resolveDurationRelativeTo(value)).toThrow();
  });
});

// The strict-shape rule (see coding-standards) for every string relativeTo: before the first `[`, a string with a time zone
// annotation must have the strict extended zoned shape (`<date>T<time>`, then nothing, `Z` or
// `±HH:MM[:SS[.fraction]]`), and any other string the strict extended date or date-time shape.
// Temporal's `ParseTemporalRelativeToString` reads every row below (polyfill 0.5.1 totals P1D as
// 24 hours relative to each); GMT rejects them.
describe("resolveDurationRelativeTo requires GMT's strict extended shape for every string", () => {
  it.each`
    value                                            | reason
    ${"20241003"}                                    | ${"basic date"}
    ${"2024-10-03 00:00"}                            | ${"space separator"}
    ${"2024-10-03t00:00"}                            | ${"lower-case t separator"}
    ${"2024-10-03T00"}                               | ${"hour-only time"}
    ${"2024-10-03T00:00+05:00"}                      | ${"UTC offset without a time zone annotation"}
    ${"20241003T000000-0400[America/New_York]"}      | ${"basic zoned format"}
    ${"2024-10-03 00:00:00-04:00[America/New_York]"} | ${"zoned, space separator"}
    ${"2024-10-03T04:00:00z[America/New_York]"}      | ${"zoned, lower-case z"}
    ${"2024-10-03T00:00:00-04[America/New_York]"}    | ${"zoned, hour-only offset"}
    ${"2024-10-03[UTC]"}                             | ${"zoned, date without a time"}
    ${"2024-02-24[UTC][u-ca=hebrew]"}                | ${"calendar zoned, date without a time"}
  `("throws for $value ($reason)", ({ value }) => {
    expect(() => resolveDurationRelativeTo(value)).toThrow(RangeError);
  });

  it.each`
    value
    ${"2024-10-03"}
    ${"2024-10-03T00:00"}
    ${"+002024-10-03T00:00:00.5"}
    ${"2024-10-03T00:00:00-04:00[America/New_York]"}
    ${"2024-10-03T00:00[America/New_York]"}
    ${"2024-10-03T04:00:00Z[America/New_York]"}
    ${"2024-10-03T00:00:00-04:00[America/New_York][foo=bar]"}
  `("passes the strict extended $value through unchanged", ({ value }) => {
    expect(resolveDurationRelativeTo(value)).toBe(value);
  });
});
