import { clampDate } from "./clampDate";

describe("clampDate", () => {
  describe("value within bounds", () => {
    it.each`
      value           | min             | max             | expected
      ${"2024-03-15"} | ${"2024-03-01"} | ${"2024-03-31"} | ${"2024-03-15"}
      ${"2024-06-15"} | ${"2024-01-01"} | ${"2024-12-31"} | ${"2024-06-15"}
      ${"2024-02-29"} | ${"2024-02-01"} | ${"2024-03-01"} | ${"2024-02-29"}
    `(
      "returns $expected when value=$value, min=$min, max=$max",
      ({ value, min, max, expected }) => {
        expect(clampDate(value, min, max)).toBe(expected);
      },
    );
  });

  describe("value equals bounds", () => {
    it.each`
      value           | min             | max             | expected
      ${"2024-03-01"} | ${"2024-03-01"} | ${"2024-03-31"} | ${"2024-03-01"}
      ${"2024-03-31"} | ${"2024-03-01"} | ${"2024-03-31"} | ${"2024-03-31"}
    `(
      "returns $expected when value equals a bound (value=$value, min=$min, max=$max)",
      ({ value, min, max, expected }) => {
        expect(clampDate(value, min, max)).toBe(expected);
      },
    );
  });

  describe("value below min", () => {
    it.each`
      value           | min             | max             | expected
      ${"2024-02-01"} | ${"2024-03-01"} | ${"2024-03-31"} | ${"2024-03-01"}
      ${"2023-12-31"} | ${"2024-01-01"} | ${"2024-12-31"} | ${"2024-01-01"}
      ${"2024-01-15"} | ${"2024-02-01"} | ${"2024-06-30"} | ${"2024-02-01"}
    `(
      "returns $expected (min) when value=$value is below min=$min",
      ({ value, min, max, expected }) => {
        expect(clampDate(value, min, max)).toBe(expected);
      },
    );
  });

  describe("value above max", () => {
    it.each`
      value           | min             | max             | expected
      ${"2024-05-01"} | ${"2024-03-01"} | ${"2024-03-31"} | ${"2024-03-31"}
      ${"2025-01-01"} | ${"2024-01-01"} | ${"2024-12-31"} | ${"2024-12-31"}
      ${"2024-08-15"} | ${"2024-01-01"} | ${"2024-07-31"} | ${"2024-07-31"}
    `(
      "returns $expected (max) when value=$value is above max=$max",
      ({ value, min, max, expected }) => {
        expect(clampDate(value, min, max)).toBe(expected);
      },
    );
  });

  describe("min equals max", () => {
    it.each`
      value           | min             | max             | expected
      ${"2024-03-01"} | ${"2024-03-01"} | ${"2024-03-01"} | ${"2024-03-01"}
      ${"2024-02-01"} | ${"2024-03-01"} | ${"2024-03-01"} | ${"2024-03-01"}
      ${"2024-04-01"} | ${"2024-03-01"} | ${"2024-03-01"} | ${"2024-03-01"}
    `(
      "returns $expected when min equals max ($min)",
      ({ value, min, max, expected }) => {
        expect(clampDate(value, min, max)).toBe(expected);
      },
    );
  });

  describe("invalid inputs", () => {
    it.each`
      value           | min             | max             | description
      ${"invalid"}    | ${"2024-03-01"} | ${"2024-03-31"} | ${"invalid value"}
      ${"2024-03-15"} | ${"invalid"}    | ${"2024-03-31"} | ${"invalid min"}
      ${"2024-03-15"} | ${"2024-03-01"} | ${"invalid"}    | ${"invalid max"}
      ${""}           | ${"2024-03-01"} | ${"2024-03-31"} | ${"empty value"}
      ${"2024-03-15"} | ${""}           | ${"2024-03-31"} | ${"empty min"}
      ${"2024-03-15"} | ${"2024-03-01"} | ${""}           | ${"empty max"}
      ${"2024-02-30"} | ${"2024-03-01"} | ${"2024-03-31"} | ${"invalid value (Feb 30)"}
    `('returns "" when $description', ({ value, min, max }) => {
      expect(clampDate(value, min, max)).toBe("");
    });
  });

  describe("min > max", () => {
    it.each`
      value           | min             | max             | expected
      ${"2024-03-15"} | ${"2024-03-31"} | ${"2024-03-01"} | ${""}
      ${"2024-01-01"} | ${"2024-12-31"} | ${"2024-01-01"} | ${""}
      ${"2025-01-01"} | ${"2024-12-31"} | ${"2024-01-01"} | ${""}
    `(
      'returns "" when min > max (min=$min, max=$max)',
      ({ value, min, max, expected }) => {
        expect(clampDate(value, min, max)).toBe(expected);
      },
    );
  });
  describe("cross-year boundaries", () => {
    it.each`
      value           | min             | max             | expected
      ${"2024-12-31"} | ${"2024-01-01"} | ${"2025-01-01"} | ${"2024-12-31"}
      ${"2025-01-02"} | ${"2024-01-01"} | ${"2025-01-01"} | ${"2025-01-01"}
      ${"2023-12-31"} | ${"2024-01-01"} | ${"2025-01-01"} | ${"2024-01-01"}
    `(
      "returns $expected across year boundary (value=$value, min=$min, max=$max)",
      ({ value, min, max, expected }) => {
        expect(clampDate(value, min, max)).toBe(expected);
      },
    );
  });

  describe("leap year dates", () => {
    it.each`
      value           | min             | max             | expected
      ${"2024-02-29"} | ${"2024-02-01"} | ${"2024-03-01"} | ${"2024-02-29"}
      ${"2024-02-28"} | ${"2024-02-29"} | ${"2024-03-01"} | ${"2024-02-29"}
      ${"2024-03-01"} | ${"2024-02-01"} | ${"2024-02-28"} | ${"2024-02-28"}
    `(
      "returns $expected for leap year edge (value=$value, min=$min, max=$max)",
      ({ value, min, max, expected }) => {
        expect(clampDate(value, min, max)).toBe(expected);
      },
    );
  });

  describe("very far apart dates", () => {
    it.each`
      value           | min             | max             | expected
      ${"2024-06-15"} | ${"0001-01-01"} | ${"9999-12-31"} | ${"2024-06-15"}
      ${"0001-01-02"} | ${"0001-01-01"} | ${"9999-12-31"} | ${"0001-01-02"}
      ${"9999-12-30"} | ${"0001-01-01"} | ${"9999-12-31"} | ${"9999-12-30"}
    `(
      "returns $expected for extreme date range (value=$value)",
      ({ value, min, max, expected }) => {
        expect(clampDate(value, min, max)).toBe(expected);
      },
    );
  });

  describe("all same date", () => {
    it.each`
      value           | min             | max             | expected
      ${"2024-03-15"} | ${"2024-03-15"} | ${"2024-03-15"} | ${"2024-03-15"}
    `(
      "returns $expected when all three dates are identical",
      ({ value, min, max, expected }) => {
        expect(clampDate(value, min, max)).toBe(expected);
      },
    );
  });

  describe("mixed valid/invalid with min > max", () => {
    it.each`
      value           | min             | max             | expected
      ${"2024-03-15"} | ${"invalid"}    | ${"2024-03-01"} | ${""}
      ${"2024-03-15"} | ${"2024-03-31"} | ${"invalid"}    | ${""}
    `(
      'returns "" when one bound is invalid even if min > max',
      ({ value, min, max, expected }) => {
        expect(clampDate(value, min, max)).toBe(expected);
      },
    );
  });
});
