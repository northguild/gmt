import { areDatesEqual } from "./areDatesEqual";

describe("areDatesEqual", () => {
  it("returns true for identical dates", () => {
    expect(areDatesEqual("2024-01-01", "2024-01-01")).toBe(true);
  });

  it.each`
    value1          | value2
    ${"2024-01-01"} | ${"2024-01-01"}
    ${"0000-01-01"} | ${"0000-01-01"}
  `(
    "returns true when comparing valid dates $value1 to $value2",
    ({ value1, value2 }) => {
      expect(areDatesEqual(value1, value2)).toBe(true);
    },
  );

  it.each`
    value1                   | value2
    ${"2024-01-01T06:00:00"} | ${"2024-01-01T00:00:00"}
    ${"2024-01-01T06:00:00"} | ${"2024-01-01T07:00:00"}
  `(
    "returns true for edge-case equivalent dates $value1 and $value2",
    ({ value1, value2 }) => {
      expect(areDatesEqual(value1, value2)).toBe(true);
    },
  );

  it.each`
    value1          | value2
    ${"2024-01-01"} | ${"2024-01-02"}
    ${""}           | ${""}
  `(
    "returns false for non-equal or empty values $value1 and $value2",
    ({ value1, value2 }) => {
      expect(areDatesEqual(value1, value2)).toBe(false);
    },
  );

  it.each`
    invalidValue1   | value2
    ${"not-a-date"} | ${"2024-01-01"}
    ${null}         | ${"2024-01-01"}
    ${undefined}    | ${"2024-01-01"}
  `(
    "returns false for invalid first value $invalidValue1",
    ({ invalidValue1, value2 }) => {
      expect(areDatesEqual(invalidValue1 as never, value2)).toBe(false);
    },
  );

  it.each`
    value1          | invalidValue2
    ${"2024-01-01"} | ${"not-a-date"}
    ${"2024-01-01"} | ${null}
    ${"2024-01-01"} | ${undefined}
  `(
    "returns false for invalid second value $invalidValue2",
    ({ value1, invalidValue2 }) => {
      expect(areDatesEqual(value1, invalidValue2 as never)).toBe(false);
    },
  );

  // Temporal's ISO grammar reads an elective annotation (`[foo=bar]`) and `[u-ca=iso8601]` and ignores
  // them (RFC 9557 §3.3; native Temporal agrees), so the result is the unannotated input's.
  it.each`
    value1                       | value2                                 | expected
    ${"2024-02-29[foo=bar]"}     | ${"2024-02-29T12:34:56[u-ca=iso8601]"} | ${true}
    ${"2024-02-29[u-ca=hebrew]"} | ${"2024-02-29"}                        | ${false}
  `(
    "reads the annotations of $value1 and $value2 as Temporal does → $expected",
    ({ value1, value2, expected }) => {
      expect(areDatesEqual(value1, value2)).toBe(expected);
    },
  );
});
