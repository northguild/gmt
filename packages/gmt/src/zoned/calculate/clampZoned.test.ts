import { Temporal } from "@js-temporal/polyfill";
import { localNoonBattleCases } from "../../test";
import { clampZoned } from "./clampZoned";

describe("clampZoned", () => {
  describe("value within bounds", () => {
    it.each`
      value                                      | min                                        | max                                        | expected
      ${"2024-03-15T12:00:00[America/New_York]"} | ${"2024-03-01T00:00:00[America/New_York]"} | ${"2024-03-31T23:59:59[America/New_York]"} | ${"2024-03-15T12:00:00-04:00[America/New_York]"}
      ${"2024-06-15T12:00:00[America/New_York]"} | ${"2024-01-01T00:00:00[America/New_York]"} | ${"2024-12-31T23:59:59[America/New_York]"} | ${"2024-06-15T12:00:00-04:00[America/New_York]"}
      ${"2024-02-29T12:00:00[America/New_York]"} | ${"2024-02-01T00:00:00[America/New_York]"} | ${"2024-03-01T00:00:00[America/New_York]"} | ${"2024-02-29T12:00:00-05:00[America/New_York]"}
    `(
      "returns $expected when value=$value, min=$min, max=$max",
      ({ value, min, max, expected }) => {
        expect(clampZoned(value, min, max)).toBe(expected);
      },
    );
  });

  describe("value equals bounds", () => {
    it.each`
      value                                      | min                                        | max                                        | expected
      ${"2024-03-01T12:00:00[America/New_York]"} | ${"2024-03-01T00:00:00[America/New_York]"} | ${"2024-03-31T23:59:59[America/New_York]"} | ${"2024-03-01T12:00:00-05:00[America/New_York]"}
      ${"2024-03-31T12:00:00[America/New_York]"} | ${"2024-03-01T00:00:00[America/New_York]"} | ${"2024-03-31T23:59:59[America/New_York]"} | ${"2024-03-31T12:00:00-04:00[America/New_York]"}
    `(
      "returns $expected when value equals a bound (value=$value, min=$min, max=$max)",
      ({ value, min, max, expected }) => {
        expect(clampZoned(value, min, max)).toBe(expected);
      },
    );
  });

  describe("value below min", () => {
    it.each`
      value                                      | min                                        | max                                        | expected
      ${"2024-02-01T12:00:00[America/New_York]"} | ${"2024-03-01T00:00:00[America/New_York]"} | ${"2024-03-31T23:59:59[America/New_York]"} | ${"2024-03-01T00:00:00-05:00[America/New_York]"}
      ${"2023-12-31T12:00:00[America/New_York]"} | ${"2024-01-01T00:00:00[America/New_York]"} | ${"2024-12-31T23:59:59[America/New_York]"} | ${"2024-01-01T00:00:00-05:00[America/New_York]"}
      ${"2024-01-15T12:00:00[America/New_York]"} | ${"2024-02-01T00:00:00[America/New_York]"} | ${"2024-06-30T23:59:59[America/New_York]"} | ${"2024-02-01T00:00:00-05:00[America/New_York]"}
    `(
      "returns $expected (min) when value=$value is below min=$min",
      ({ value, min, max, expected }) => {
        expect(clampZoned(value, min, max)).toBe(expected);
      },
    );
  });

  describe("value above max", () => {
    it.each`
      value                                      | min                                        | max                                        | expected
      ${"2024-05-01T12:00:00[America/New_York]"} | ${"2024-03-01T00:00:00[America/New_York]"} | ${"2024-03-31T23:59:59[America/New_York]"} | ${"2024-03-31T23:59:59-04:00[America/New_York]"}
      ${"2025-01-01T12:00:00[America/New_York]"} | ${"2024-01-01T00:00:00[America/New_York]"} | ${"2024-12-31T23:59:59[America/New_York]"} | ${"2024-12-31T23:59:59-05:00[America/New_York]"}
      ${"2024-08-15T12:00:00[America/New_York]"} | ${"2024-01-01T00:00:00[America/New_York]"} | ${"2024-07-31T23:59:59[America/New_York]"} | ${"2024-07-31T23:59:59-04:00[America/New_York]"}
    `(
      "returns $expected (max) when value=$value is above max=$max",
      ({ value, min, max, expected }) => {
        expect(clampZoned(value, min, max)).toBe(expected);
      },
    );
  });

  describe("min equals max", () => {
    it.each`
      value                                      | min                                        | max                                        | expected
      ${"2024-03-01T00:00:00[America/New_York]"} | ${"2024-03-01T00:00:00[America/New_York]"} | ${"2024-03-01T00:00:00[America/New_York]"} | ${"2024-03-01T00:00:00-05:00[America/New_York]"}
      ${"2024-02-01T12:00:00[America/New_York]"} | ${"2024-03-01T00:00:00[America/New_York]"} | ${"2024-03-01T00:00:00[America/New_York]"} | ${"2024-03-01T00:00:00-05:00[America/New_York]"}
      ${"2024-04-01T12:00:00[America/New_York]"} | ${"2024-03-01T00:00:00[America/New_York]"} | ${"2024-03-01T00:00:00[America/New_York]"} | ${"2024-03-01T00:00:00-05:00[America/New_York]"}
    `(
      "returns $expected when min equals max ($min)",
      ({ value, min, max, expected }) => {
        expect(clampZoned(value, min, max)).toBe(expected);
      },
    );
  });

  describe("invalid inputs", () => {
    it.each`
      value                                      | min                                        | max                                        | description
      ${"invalid"}                               | ${"2024-03-01T00:00:00[America/New_York]"} | ${"2024-03-31T23:59:59[America/New_York]"} | ${"invalid value"}
      ${"2024-03-15T12:00:00[America/New_York]"} | ${"invalid"}                               | ${"2024-03-31T23:59:59[America/New_York]"} | ${"invalid min"}
      ${"2024-03-15T12:00:00[America/New_York]"} | ${"2024-03-01T00:00:00[America/New_York]"} | ${"invalid"}                               | ${"invalid max"}
      ${""}                                      | ${"2024-03-01T00:00:00[America/New_York]"} | ${"2024-03-31T23:59:59[America/New_York]"} | ${"empty value"}
      ${"2024-03-15T12:00:00[America/New_York]"} | ${""}                                      | ${"2024-03-31T23:59:59[America/New_York]"} | ${"empty min"}
      ${"2024-03-15T12:00:00[America/New_York]"} | ${"2024-03-01T00:00:00[America/New_York]"} | ${""}                                      | ${"empty max"}
      ${"2024-02-30T12:00:00[America/New_York]"} | ${"2024-03-01T00:00:00[America/New_York]"} | ${"2024-03-31T23:59:59[America/New_York]"} | ${"invalid value (Feb 30)"}
    `('returns "" when $description', ({ value, min, max }) => {
      expect(clampZoned(value, min, max)).toBe("");
    });
  });

  describe("min > max", () => {
    it.each`
      value                                      | min                                        | max                                        | expected
      ${"2024-03-15T12:00:00[America/New_York]"} | ${"2024-03-31T00:00:00[America/New_York]"} | ${"2024-03-01T00:00:00[America/New_York]"} | ${""}
      ${"2024-01-01T12:00:00[America/New_York]"} | ${"2024-12-31T00:00:00[America/New_York]"} | ${"2024-01-01T00:00:00[America/New_York]"} | ${""}
      ${"2025-01-01T12:00:00[America/New_York]"} | ${"2024-12-31T00:00:00[America/New_York]"} | ${"2024-01-01T00:00:00[America/New_York]"} | ${""}
    `(
      'returns "" when min > max (min=$min, max=$max)',
      ({ value, min, max, expected }) => {
        expect(clampZoned(value, min, max)).toBe(expected);
      },
    );
  });

  describe("cross-year boundaries", () => {
    it.each`
      value                                      | min                                        | max                                        | expected
      ${"2024-12-31T12:00:00[America/New_York]"} | ${"2024-01-01T00:00:00[America/New_York]"} | ${"2025-01-01T00:00:00[America/New_York]"} | ${"2024-12-31T12:00:00-05:00[America/New_York]"}
      ${"2025-01-02T12:00:00[America/New_York]"} | ${"2024-01-01T00:00:00[America/New_York]"} | ${"2025-01-01T00:00:00[America/New_York]"} | ${"2025-01-01T00:00:00-05:00[America/New_York]"}
      ${"2023-12-31T12:00:00[America/New_York]"} | ${"2024-01-01T00:00:00[America/New_York]"} | ${"2025-01-01T00:00:00[America/New_York]"} | ${"2024-01-01T00:00:00-05:00[America/New_York]"}
    `(
      "returns $expected across year boundary (value=$value, min=$min, max=$max)",
      ({ value, min, max, expected }) => {
        expect(clampZoned(value, min, max)).toBe(expected);
      },
    );
  });

  describe("leap year dates", () => {
    it.each`
      value                                      | min                                        | max                                        | expected
      ${"2024-02-29T12:00:00[America/New_York]"} | ${"2024-02-01T00:00:00[America/New_York]"} | ${"2024-03-01T00:00:00[America/New_York]"} | ${"2024-02-29T12:00:00-05:00[America/New_York]"}
      ${"2024-02-28T12:00:00[America/New_York]"} | ${"2024-02-29T00:00:00[America/New_York]"} | ${"2024-03-01T00:00:00[America/New_York]"} | ${"2024-02-29T00:00:00-05:00[America/New_York]"}
      ${"2024-03-01T12:00:00[America/New_York]"} | ${"2024-02-01T00:00:00[America/New_York]"} | ${"2024-02-28T00:00:00[America/New_York]"} | ${"2024-02-28T00:00:00-05:00[America/New_York]"}
    `(
      "returns $expected for leap year edge (value=$value, min=$min, max=$max)",
      ({ value, min, max, expected }) => {
        expect(clampZoned(value, min, max)).toBe(expected);
      },
    );
  });

  describe("very far apart dates", () => {
    it.each`
      value                                      | min                                        | max                                        | expected
      ${"2024-06-15T12:00:00[America/New_York]"} | ${"0001-01-01T00:00:00[America/New_York]"} | ${"9999-12-31T23:59:59[America/New_York]"} | ${"2024-06-15T12:00:00-04:00[America/New_York]"}
      ${"0001-01-02T12:00:00[America/New_York]"} | ${"0001-01-01T00:00:00[America/New_York]"} | ${"9999-12-31T23:59:59[America/New_York]"} | ${"0001-01-02T12:00:00-04:56[America/New_York]"}
      ${"9999-12-30T12:00:00[America/New_York]"} | ${"0001-01-01T00:00:00[America/New_York]"} | ${"9999-12-31T23:59:59[America/New_York]"} | ${"9999-12-30T12:00:00-05:00[America/New_York]"}
    `(
      "returns $expected for extreme date range (value=$value)",
      ({ value, min, max, expected }) => {
        expect(clampZoned(value, min, max)).toBe(expected);
      },
    );
  });

  describe("all same date", () => {
    it.each`
      value                                      | min                                        | max                                        | expected
      ${"2024-03-15T00:00:00[America/New_York]"} | ${"2024-03-15T00:00:00[America/New_York]"} | ${"2024-03-15T00:00:00[America/New_York]"} | ${"2024-03-15T00:00:00-04:00[America/New_York]"}
    `(
      "returns $expected when all three dates are identical",
      ({ value, min, max, expected }) => {
        expect(clampZoned(value, min, max)).toBe(expected);
      },
    );
  });

  describe("mixed valid/invalid with min > max", () => {
    it.each`
      value                                      | min                                        | max                                        | expected
      ${"2024-03-15T12:00:00[America/New_York]"} | ${"invalid"}                               | ${"2024-03-01T00:00:00[America/New_York]"} | ${""}
      ${"2024-03-15T12:00:00[America/New_York]"} | ${"2024-03-31T00:00:00[America/New_York]"} | ${"invalid"}                               | ${""}
    `(
      'returns "" when one bound is invalid even if min > max',
      ({ value, min, max, expected }) => {
        expect(clampZoned(value, min, max)).toBe(expected);
      },
    );
  });

  describe("different timezones", () => {
    it.each`
      value                                      | min                                        | max                                        | expected
      ${"2024-03-15T12:00:00[America/New_York]"} | ${"2024-03-01T00:00:00[America/New_York]"} | ${"2024-03-31T23:59:59[Europe/London]"}    | ${"2024-03-15T12:00:00-04:00[America/New_York]"}
      ${"2024-03-15T12:00:00[Europe/London]"}    | ${"2024-03-01T00:00:00[America/New_York]"} | ${"2024-03-31T23:59:59[Europe/London]"}    | ${"2024-03-15T12:00:00+00:00[Europe/London]"}
      ${"2024-03-15T12:00:00[America/New_York]"} | ${"2024-03-01T00:00:00[Europe/London]"}    | ${"2024-03-31T23:59:59[America/New_York]"} | ${"2024-03-15T12:00:00-04:00[America/New_York]"}
    `(
      "returns $expected across timezones (value=$value, min=$min, max=$max)",
      ({ value, min, max, expected }) => {
        expect(clampZoned(value, min, max)).toBe(expected);
      },
    );
  });

  describe("battle-test timezones", () => {
    for (const { timeZone, value } of localNoonBattleCases) {
      it(`returns the value when min equals max equals value for ${timeZone}`, () => {
        expect(clampZoned(value, value, value)).toBe(value);
      });

      it(`preserves the timeZone when value is within bounds for ${timeZone}`, () => {
        const min = Temporal.ZonedDateTime.from({
          year: 2024,
          month: 1,
          day: 1,
          hour: 12,
          minute: 0,
          second: 0,
          timeZone,
        }).toString();
        const max = Temporal.ZonedDateTime.from({
          year: 2024,
          month: 12,
          day: 31,
          hour: 12,
          minute: 0,
          second: 0,
          timeZone,
        }).toString();
        expect(clampZoned(value, min, max)).toBe(value);
      });
    }
  });
});
