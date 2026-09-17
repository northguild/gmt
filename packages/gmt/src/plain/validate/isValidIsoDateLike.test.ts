import { isValidIsoDateLike } from "./isValidIsoDateLike";

describe("isValidIsoDateLike", () => {
  it.each`
    value
    ${"2024-02-29"}
    ${"2024-02-29T00:00:00"}
    ${"2024-02-29T12:00:00"}
    ${"2024-02-29T23:59:59"}
    ${"2024-02-29T12:30:45.123"}
    ${"+001234-12-31"}
    ${"+001234-12-31T23:59:59"}
  `(
    "returns true for valid date or datetime string $value",
    ({ value }: { value: string }) => {
      expect(isValidIsoDateLike(value)).toBe(true);
    },
  );

  it.each`
    value
    ${"2024-02-30"}
    ${"2024-02-29T24:00:00"}
    ${"2024-02-29T12:60:00"}
    ${"2024-02-29T12:30:60"}
    ${"2024-02-29T12:30:45.1234567890"}
    ${"invalid-date"}
    ${""}
    ${null}
    ${undefined}
    ${NaN}
    ${true}
    ${false}
  `(
    "returns false for invalid date or datetime string $value",
    ({ value }: { value: string }) => {
      expect(isValidIsoDateLike(value)).toBe(false);
    },
  );

  // Temporal's ISO grammar reads an elective annotation (`[foo=bar]`) and `[u-ca=iso8601]` and ignores
  // them (RFC 9557 §3.3; native Temporal agrees), so the result is the unannotated input's.
  it.each`
    value                                   | expected
    ${"2024-02-29[foo=bar]"}                | ${true}
    ${"2024-02-29T12:00[u-ca=iso8601]"}     | ${true}
    ${"2024-02-29T12:00[America/New_York]"} | ${true}
    ${"2024-02-29[!foo=bar]"}               | ${false}
    ${"2024-02-29[u-ca=hebrew]"}            | ${false}
    ${"2024-02-29T23:59:60[foo=bar]"}       | ${false}
  `(
    "reads the annotations of $value as Temporal does → $expected",
    ({ value, expected }) => {
      expect(isValidIsoDateLike(value)).toBe(expected);
    },
  );
});
