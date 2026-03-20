import { chopDate } from "./chopDate";

describe("chopDate", () => {
  it.each`
    value                        | expected
    ${"2024-02-29T12:30:45"}     | ${"12:30:45"}
    ${"2024-02-29T00:00:00"}     | ${"00:00:00"}
    ${"2024-02-29T23:59:59"}     | ${"23:59:59"}
    ${"2024-02-29T12:30:45.123"} | ${"12:30:45.123"}
    ${"2024-02-29T12:30:45,999"} | ${"12:30:45.999"}
    ${"2024-02-29T12:30"}        | ${"12:30:00"}
    ${"2024-12-31T23:59:59.999"} | ${"23:59:59.999"}
    ${"2024-01-01T06:00:00.000"} | ${"06:00:00"}
  `(
    "returns $expected for $value",
    ({ value, expected }: { value: string; expected: string }) => {
      expect(chopDate(value)).toBe(expected);
    },
  );

  it.each`
    invalidValue
    ${"2024-02-29"}
    ${"12:30:45"}
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
    expect(chopDate(invalidValue)).toBe("");
  });
});
