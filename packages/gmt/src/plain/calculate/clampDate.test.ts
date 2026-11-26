import { clampDate } from "./clampDate";

describe("clampDate", () => {
  it.each`
    value           | min             | max             | expected
    ${"2024-03-15"} | ${"2024-03-01"} | ${"2024-03-31"} | ${"2024-03-15"}
    ${"2024-06-15"} | ${"2024-01-01"} | ${"2024-12-31"} | ${"2024-06-15"}
    ${"2024-02-29"} | ${"2024-02-01"} | ${"2024-03-01"} | ${"2024-02-29"}
    ${"2024-02-01"} | ${"2024-03-01"} | ${"2024-03-31"} | ${"2024-03-01"}
    ${"2024-05-01"} | ${"2024-03-01"} | ${"2024-03-31"} | ${"2024-03-31"}
    ${"2024-03-01"} | ${"2024-03-01"} | ${"2024-03-31"} | ${"2024-03-01"}
    ${"2024-03-31"} | ${"2024-03-01"} | ${"2024-03-31"} | ${"2024-03-31"}
    ${"2023-12-31"} | ${"2024-01-01"} | ${"2024-12-31"} | ${"2024-01-01"}
    ${"2024-01-15"} | ${"2024-02-01"} | ${"2024-06-30"} | ${"2024-02-01"}
    ${"2024-03-15"} | ${"2024-03-31"} | ${"2024-03-01"} | ${""}
  `(
    "returns '$expected' for value=$value, min=$min, max=$max",
    ({ value, min, max, expected }) => {
      expect(clampDate(value, min, max)).toBe(expected);
    },
  );

  it.each`
    value           | min             | max
    ${"invalid"}    | ${"2024-03-01"} | ${"2024-03-31"}
    ${"2024-03-15"} | ${"invalid"}    | ${"2024-03-31"}
    ${"2024-03-15"} | ${"2024-03-01"} | ${"invalid"}
    ${""}           | ${"2024-03-01"} | ${"2024-03-31"}
    ${"2024-03-15"} | ${""}           | ${"2024-03-31"}
    ${"2024-03-15"} | ${"2024-03-01"} | ${""}
    ${"2024-02-30"} | ${"2024-03-01"} | ${"2024-03-31"}
  `(
    "returns '' for invalid input value='$value', min='$min', max='$max'",
    ({ value, min, max }) => {
      expect(clampDate(value, min, max)).toBe("");
    },
  );

  // CORE-113 (#528): a plain date matches its exact pattern over the whole string, so an annotation of any kind (zone, calendar or elective) makes it invalid.
  it.each`
    value                    | min                           | max                         | expected
    ${"2024-03-15[foo=bar]"} | ${"2024-03-01"}               | ${"2024-03-31"}             | ${""}
    ${"2024-02-15"}          | ${"2024-03-01[u-ca=iso8601]"} | ${"2024-03-31"}             | ${""}
    ${"2024-04-15"}          | ${"2024-03-01"}               | ${"2024-03-31[Asia/Tokyo]"} | ${""}
  `(
    "returns an empty string for annotated input ($value in [$min, $max]) → '$expected'",
    ({ value, min, max, expected }) => {
      expect(clampDate(value, min, max)).toBe(expected);
    },
  );
});
