import { chopTime } from "./chopTime";

describe("chopTime", () => {
  it.each`
    value                        | expected
    ${"2024-02-29T12:30:45"}     | ${"2024-02-29"}
    ${"2024-02-29T00:00:00"}     | ${"2024-02-29"}
    ${"2024-02-29T23:59:59"}     | ${"2024-02-29"}
    ${"2024-02-29T12:30:45.123"} | ${"2024-02-29"}
    ${"2024-02-29T12:30:45,999"} | ${"2024-02-29"}
    ${"2024-02-29T12:30"}        | ${"2024-02-29"}
    ${"2024-12-31T23:59:59.999"} | ${"2024-12-31"}
    ${"2024-01-01T00:00:00.000"} | ${"2024-01-01"}
  `(
    "returns $expected for $value",
    ({ value, expected }: { value: string; expected: string }) => {
      expect(chopTime(value)).toBe(expected);
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
    expect(chopTime(invalidValue)).toBe("");
  });
});
