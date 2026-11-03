import { readSqlDateTime } from "./sqlDateTime";

describe("internal/sqlDateTime", () => {
  it.each`
    value                        | expected                   | reason
    ${"2024-03-15 14:30:00.500"} | ${"2024-03-15T14:30:00.5"} | ${"trailing zeros dropped"}
    ${"2024-02-30 14:30:00"}     | ${""}                      | ${"pattern matches, Temporal rejects"}
    ${42}                        | ${""}                      | ${"not a string"}
  `(
    "readSqlDateTime($value) is '$expected' ($reason)",
    ({ value, expected }: { value: unknown; expected: string }) => {
      expect(readSqlDateTime(value)).toBe(expected);
    },
  );
});
