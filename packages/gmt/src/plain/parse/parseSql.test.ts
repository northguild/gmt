import { formatSql } from "../format/formatSql";
import { parseSql } from "./parseSql";

describe("parseSql", () => {
  it.each`
    value                              | expected
    ${"2024-03-15 14:30:00"}           | ${"2024-03-15T14:30:00"}
    ${"2024-03-05 09:00:00"}           | ${"2024-03-05T09:00:00"}
    ${"2024-03-15 14:30"}              | ${"2024-03-15T14:30:00"}
    ${"2024-03-15 14:30:00.5"}         | ${"2024-03-15T14:30:00.5"}
    ${"2024-03-15 14:30:00.123456789"} | ${"2024-03-15T14:30:00.123456789"}
  `(
    "parses $value to $expected",
    ({ value, expected }: { value: string; expected: string }) => {
      expect(parseSql(value)).toBe(expected);
    },
  );

  it.each`
    value
    ${"not a date"}
    ${""}
    ${"2024-03-15T14:30:00"}
    ${"2024-3-5 14:30:00"}
    ${"2024-03-05 4:30:00"}
    ${"2024-02-30 14:30:00"}
    ${"2024-03-15  14:30:00"}
  `("returns '' for invalid input $value", ({ value }: { value: string }) => {
    expect(parseSql(value)).toBe("");
  });

  it("round-trips through formatSql", () => {
    const original = "2024-03-15 14:30:00";
    expect(formatSql(parseSql(original))).toBe(original);
  });
});
