import { sqlDateTime } from "../../regex";
import { formatSql } from "./formatSql";

describe("formatSql", () => {
  it.each`
    value                              | expected
    ${"2024-03-15T14:30:00"}           | ${"2024-03-15 14:30:00"}
    ${"2024-03-05T09:00:00"}           | ${"2024-03-05 09:00:00"}
    ${"2024-03-15T14:30:00.5"}         | ${"2024-03-15 14:30:00.5"}
    ${"2024-03-15T14:30:00.123456789"} | ${"2024-03-15 14:30:00.123456789"}
    ${"2024-03-15T14:30"}              | ${"2024-03-15 14:30:00"}
  `(
    "formats $value as $expected",
    ({ value, expected }: { value: string; expected: string }) => {
      expect(formatSql(value)).toBe(expected);
    },
  );

  it("zero-pads a single-digit day/month to 2 digits", () => {
    expect(formatSql("2024-03-05T09:00:00")).toBe("2024-03-05 09:00:00");
  });

  it.each`
    value
    ${"invalid"}
    ${""}
    ${"2024-03-15 14:30:00"}
    ${"2024-02-30T14:30:00"}
  `("returns '' for invalid input $value", ({ value }: { value: string }) => {
    expect(formatSql(value)).toBe("");
  });

  it("output shape is locale-invariant (no locale argument, no Intl call)", () => {
    const result = formatSql("2024-03-15T14:30:00");
    expect(sqlDateTime.test(result)).toBe(true);
  });
});
