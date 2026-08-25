import { Temporal } from "@js-temporal/polyfill";
import { battleTestTimeZones } from "../../test";
import { addZonedBusinessDays } from "./addZonedBusinessDays";

describe("addZonedBusinessDays", () => {
  // Basic weekday addition — Monday + 1 = Tuesday
  it.each`
    value                                            | amount | expected
    ${"2024-02-29T14:30:00-05:00[America/New_York]"} | ${1}   | ${"2024-03-01T14:30:00-05:00[America/New_York]"}
    ${"2024-02-29T14:30:00-05:00[America/New_York]"} | ${2}   | ${"2024-03-04T14:30:00-05:00[America/New_York]"}
    ${"2024-02-29T14:30:00-05:00[America/New_York]"} | ${5}   | ${"2024-03-07T14:30:00-05:00[America/New_York]"}
    ${"2024-03-01T10:00:00+01:00[Europe/Berlin]"}    | ${1}   | ${"2024-03-04T10:00:00+01:00[Europe/Berlin]"}
    ${"2024-03-01T10:00:00+01:00[Europe/Berlin]"}    | ${3}   | ${"2024-03-06T10:00:00+01:00[Europe/Berlin]"}
  `(
    "returns $expected for $value + $amount business days",
    ({ value, amount, expected }) => {
      expect(addZonedBusinessDays(value, amount)).toBe(expected);
    },
  );

  // Weekend crossing — Friday + 1 = Monday
  it.each`
    value                                            | amount | expected
    ${"2024-03-01T14:30:00-05:00[America/New_York]"} | ${1}   | ${"2024-03-04T14:30:00-05:00[America/New_York]"}
    ${"2024-03-01T14:30:00-05:00[America/New_York]"} | ${2}   | ${"2024-03-05T14:30:00-05:00[America/New_York]"}
    ${"2024-03-01T14:30:00-05:00[America/New_York]"} | ${3}   | ${"2024-03-06T14:30:00-05:00[America/New_York]"}
    ${"2024-03-01T14:30:00-05:00[America/New_York]"} | ${4}   | ${"2024-03-07T14:30:00-05:00[America/New_York]"}
    ${"2024-03-01T14:30:00-05:00[America/New_York]"} | ${5}   | ${"2024-03-08T14:30:00-05:00[America/New_York]"}
  `(
    "returns $expected for Friday start $value + $amount business days",
    ({ value, amount, expected }) => {
      expect(addZonedBusinessDays(value, amount)).toBe(expected);
    },
  );

  // Weekend crossing — Saturday + 1 = Monday
  it.each`
    value                                            | amount | expected
    ${"2024-03-02T14:30:00-05:00[America/New_York]"} | ${1}   | ${"2024-03-04T14:30:00-05:00[America/New_York]"}
    ${"2024-03-02T14:30:00-05:00[America/New_York]"} | ${2}   | ${"2024-03-05T14:30:00-05:00[America/New_York]"}
    ${"2024-03-02T14:30:00-05:00[America/New_York]"} | ${3}   | ${"2024-03-06T14:30:00-05:00[America/New_York]"}
  `(
    "returns $expected for Saturday start $value + $amount business days",
    ({ value, amount, expected }) => {
      expect(addZonedBusinessDays(value, amount)).toBe(expected);
    },
  );

  // Multi-week spans
  it.each`
    value                                            | amount | expected
    ${"2024-02-29T14:30:00-05:00[America/New_York]"} | ${10}  | ${"2024-03-14T14:30:00-04:00[America/New_York]"}
    ${"2024-02-29T14:30:00-05:00[America/New_York]"} | ${20}  | ${"2024-03-28T14:30:00-04:00[America/New_York]"}
    ${"2024-02-29T14:30:00-05:00[America/New_York]"} | ${50}  | ${"2024-05-09T14:30:00-04:00[America/New_York]"}
  `(
    "returns $expected for multi-week span $value + $amount business days",
    ({ value, amount, expected }) => {
      expect(addZonedBusinessDays(value, amount)).toBe(expected);
    },
  );

  // Zero amount — returns original value unchanged
  it.each`
    value                                            | expected
    ${"2024-02-29T14:30:00-05:00[America/New_York]"} | ${"2024-02-29T14:30:00-05:00[America/New_York]"}
    ${"2024-03-01T10:00:00+01:00[Europe/Berlin]"}    | ${"2024-03-01T10:00:00+01:00[Europe/Berlin]"}
    ${"2024-06-15T23:59:59.999+00:00[UTC]"}          | ${"2024-06-15T23:59:59.999+00:00[UTC]"}
  `("returns $expected for zero amount", ({ value, expected }) => {
    expect(addZonedBusinessDays(value, 0)).toBe(expected);
  });

  // Negative amount — behaves like subtract
  it.each`
    value                                            | amount | expected
    ${"2024-03-05T14:30:00-05:00[America/New_York]"} | ${-1}  | ${"2024-03-04T14:30:00-05:00[America/New_York]"}
    ${"2024-03-05T14:30:00-05:00[America/New_York]"} | ${-2}  | ${"2024-03-01T14:30:00-05:00[America/New_York]"}
    ${"2024-03-05T14:30:00-05:00[America/New_York]"} | ${-5}  | ${"2024-02-27T14:30:00-05:00[America/New_York]"}
    ${"2024-03-01T10:00:00+01:00[Europe/Berlin]"}    | ${-1}  | ${"2024-02-29T10:00:00+01:00[Europe/Berlin]"}
    ${"2024-03-01T10:00:00+01:00[Europe/Berlin]"}    | ${-2}  | ${"2024-02-28T10:00:00+01:00[Europe/Berlin]"}
  `(
    "returns $expected for negative amount: $amount",
    ({ value, amount, expected }) => {
      expect(addZonedBusinessDays(value, amount)).toBe(expected);
    },
  );

  // DST boundary — spring forward (March 10, 2024 in America/New_York)
  it.each`
    value                                            | amount | expected
    ${"2024-03-08T14:30:00-05:00[America/New_York]"} | ${1}   | ${"2024-03-11T14:30:00-04:00[America/New_York]"}
    ${"2024-03-08T14:30:00-05:00[America/New_York]"} | ${2}   | ${"2024-03-12T14:30:00-04:00[America/New_York]"}
  `(
    "returns $expected across spring-forward DST boundary",
    ({ value, amount, expected }) => {
      expect(addZonedBusinessDays(value, amount)).toBe(expected);
    },
  );

  // DST boundary — fall back (November 3, 2024 in America/New_York)
  it.each`
    value                                            | amount | expected
    ${"2024-11-01T14:30:00-04:00[America/New_York]"} | ${1}   | ${"2024-11-04T14:30:00-05:00[America/New_York]"}
    ${"2024-11-01T14:30:00-04:00[America/New_York]"} | ${2}   | ${"2024-11-05T14:30:00-05:00[America/New_York]"}
  `(
    "returns $expected across fall-back DST boundary",
    ({ value, amount, expected }) => {
      expect(addZonedBusinessDays(value, amount)).toBe(expected);
    },
  );

  // Cross-timeZone coverage — ensure time component is preserved in each zone
  it.each`
    amount | expectedSuffix
    ${1}   | ${"T14:30:00"}
    ${2}   | ${"T14:30:00"}
    ${5}   | ${"T14:30:00"}
  `(
    "preserves time component for $amount business days across all battle-test zones",
    ({ amount, expectedSuffix }) => {
      battleTestTimeZones.forEach((timeZone) => {
        const zdt = Temporal.ZonedDateTime.from({
          year: 2024,
          month: 3,
          day: 1, // Friday
          hour: 14,
          minute: 30,
          second: 0,
          timeZone,
        });
        const result = addZonedBusinessDays(zdt.toString(), amount);
        expect(result).toContain(expectedSuffix);
        expect(result).toContain(timeZone);
      });
    },
  );

  // Invalid input — returns empty string
  it.each`
    invalidValue
    ${"invalid"}
    ${"2024-02-30T14:30:00+00:00[UTC]"}
    ${""}
    ${null}
    ${undefined}
    ${"not-a-date"}
    ${"2024/03/15T14:30:00+00:00[UTC]"}
  `(
    "returns an empty string for invalid value $invalidValue",
    ({ invalidValue }) => {
      expect(addZonedBusinessDays(invalidValue as never, 1)).toBe("");
    },
  );

  // Invalid amount — returns empty string
  it.each`
    invalidAmount
    ${NaN}
    ${Infinity}
    ${-Infinity}
    ${"not-a-number"}
  `(
    "returns an empty string for invalid amount $invalidAmount",
    ({ invalidAmount }) => {
      expect(
        addZonedBusinessDays(
          "2024-03-01T14:30:00+00:00[UTC]",
          invalidAmount as never,
        ),
      ).toBe("");
    },
  );

  // Invalid timezone — returns empty string
  it.each`
    value
    ${"2024-03-01T14:30:00+00:00[Invalid/Zone]"}
    ${"2024-03-01T14:30:00+00:00[NotA/Timezone]"}
  `("returns an empty string for invalid timezone in $value", ({ value }) => {
    expect(addZonedBusinessDays(value, 1)).toBe("");
  });

  // Large positive amounts
  it.each`
    value                                            | amount | expected
    ${"2024-02-29T14:30:00-05:00[America/New_York]"} | ${100} | ${"2024-07-18T14:30:00-04:00[America/New_York]"}
    ${"2024-02-29T14:30:00-05:00[America/New_York]"} | ${200} | ${"2024-12-05T14:30:00-05:00[America/New_York]"}
  `(
    "returns $expected for large positive amount $value + $amount business days",
    ({ value, amount, expected }) => {
      expect(addZonedBusinessDays(value, amount)).toBe(expected);
    },
  );

  // Large negative amounts
  it.each`
    value                                            | amount  | expected
    ${"2024-07-18T14:30:00-04:00[America/New_York]"} | ${-100} | ${"2024-02-29T14:30:00-05:00[America/New_York]"}
    ${"2024-11-22T14:30:00-05:00[America/New_York]"} | ${-200} | ${"2024-02-16T14:30:00-05:00[America/New_York]"}
  `(
    "returns $expected for large negative amount $value + $amount business days",
    ({ value, amount, expected }) => {
      expect(addZonedBusinessDays(value, amount)).toBe(expected);
    },
  );

  // Year-boundary crossing
  it.each`
    value                                            | amount | expected
    ${"2024-12-30T14:30:00-05:00[America/New_York]"} | ${1}   | ${"2024-12-31T14:30:00-05:00[America/New_York]"}
    ${"2024-12-30T14:30:00-05:00[America/New_York]"} | ${2}   | ${"2025-01-01T14:30:00-05:00[America/New_York]"}
    ${"2024-12-31T14:30:00-05:00[America/New_York]"} | ${1}   | ${"2025-01-01T14:30:00-05:00[America/New_York]"}
  `("returns $expected across year boundary", ({ value, amount, expected }) => {
    expect(addZonedBusinessDays(value, amount)).toBe(expected);
  });
  // E5 (issue #78), decision of record D2 and D9 (business-day functions reject calendar
  // tags -- weekday is calendar-independent in every supported calendar) -- see
  // addZoned.test.ts for the full rationale.
  it("returns \"\" when value carries a calendar annotation", () => {
    expect(addZonedBusinessDays("2024-01-01T00:00:00+00:00[UTC][u-ca=hebrew]", 1)).toBe("");
  });
});
