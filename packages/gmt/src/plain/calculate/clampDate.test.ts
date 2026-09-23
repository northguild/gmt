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
    "returns $expected for value=$value, min=$min, max=$max",
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
  `('returns "" for invalid input', ({ value, min, max }) => {
    expect(clampDate(value, min, max)).toBe("");
  });

  // Temporal's ISO grammar reads an elective annotation (`[foo=bar]`) and `[u-ca=iso8601]` and ignores
  // them (RFC 9557 §3.3; native Temporal agrees), so the result is the unannotated input's.
  it.each`
    value                    | min                           | max                         | expected
    ${"2024-03-15[foo=bar]"} | ${"2024-03-01"}               | ${"2024-03-31"}             | ${"2024-03-15"}
    ${"2024-02-15"}          | ${"2024-03-01[u-ca=iso8601]"} | ${"2024-03-31"}             | ${"2024-03-01"}
    ${"2024-04-15"}          | ${"2024-03-01"}               | ${"2024-03-31[Asia/Tokyo]"} | ${"2024-03-31"}
  `(
    "returns the canonical date for annotated input ($value in [$min, $max]) → $expected",
    ({ value, min, max, expected }) => {
      expect(clampDate(value, min, max)).toBe(expected);
    },
  );
});
