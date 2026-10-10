import { formatSqlDateTime } from "../format/formatSqlDateTime";
import { parseSqlDateTime } from "./parseSqlDateTime";

describe("parseSqlDateTime", () => {
  it.each`
    value                              | expected
    ${"2024-03-15 14:30:00"}           | ${"2024-03-15T14:30:00"}
    ${"2024-03-05 09:00:00"}           | ${"2024-03-05T09:00:00"}
    ${"2024-03-15 14:30:00."}          | ${"2024-03-15T14:30:00"}
    ${"0001-01-01 00:00:00"}           | ${"0001-01-01T00:00:00"}
    ${"9999-12-31 23:59:59.999999999"} | ${"9999-12-31T23:59:59.999999999"}
    ${"2024-03-15 14:30:00.5"}         | ${"2024-03-15T14:30:00.5"}
    ${"2024-03-15 14:30:00.123456789"} | ${"2024-03-15T14:30:00.123456789"}
  `(
    "parses $value to $expected",
    ({ value, expected }: { value: string; expected: string }) => {
      expect(parseSqlDateTime(value)).toBe(expected);
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
    ${"2024-03-15 14:30"}
    ${"0000-01-01 00:00:00"}
    ${"+002024-03-15 14:30:00"}
    ${"-000001-01-01 00:00:00"}
  `("returns '' for invalid input $value", ({ value }: { value: string }) => {
    expect(parseSqlDateTime(value)).toBe("");
  });

  it("round-trips through formatSqlDateTime", () => {
    const original = "2024-03-15 14:30:00";
    expect(formatSqlDateTime(parseSqlDateTime(original))).toBe(original);
  });
});
