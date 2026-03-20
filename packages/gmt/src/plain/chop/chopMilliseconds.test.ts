import { chopMilliseconds } from "./chopMilliseconds";

describe("chopMilliseconds", () => {
  describe("with PlainDateTime input", () => {
    it.each`
      value                              | expected
      ${"2024-02-29T12:30:45.123"}       | ${"2024-02-29T12:30:45"}
      ${"2024-02-29T12:30:45,999"}       | ${"2024-02-29T12:30:45"}
      ${"2024-02-29T12:30:45.000000001"} | ${"2024-02-29T12:30:45"}
      ${"2024-02-29T12:30:45"}           | ${"2024-02-29T12:30:45"}
      ${"2024-02-29T12:30"}              | ${"2024-02-29T12:30:00"}
      ${"2024-12-31T23:59:59.999999999"} | ${"2024-12-31T23:59:59"}
    `(
      "returns $expected for $value",
      ({ value, expected }: { value: string; expected: string }) => {
        expect(chopMilliseconds(value)).toBe(expected);
      },
    );
  });

  describe("with PlainTime input", () => {
    it.each`
      value                   | expected
      ${"12:30:45.123"}       | ${"12:30:45"}
      ${"12:30:45,999"}       | ${"12:30:45"}
      ${"12:30:45.000000001"} | ${"12:30:45"}
      ${"12:30:45"}           | ${"12:30:45"}
      ${"12:30"}              | ${"12:30:00"}
      ${"23:59:59.999"}       | ${"23:59:59"}
    `(
      "returns $expected for $value",
      ({ value, expected }: { value: string; expected: string }) => {
        expect(chopMilliseconds(value)).toBe(expected);
      },
    );
  });

  it.each`
    invalidValue
    ${"2024-02-29"}
    ${"2024-02-29T12:30:45Z"}
    ${"2024-02-29T12:30:45+01:00[Europe/Paris]"}
    ${"not-a-datetime"}
    ${""}
    ${NaN}
    ${null}
    ${undefined}
    ${true}
    ${false}
  `("returns empty string for $invalidValue", ({ invalidValue }) => {
    expect(chopMilliseconds(invalidValue)).toBe("");
  });
});
