import { toInstantFromUtc } from "./toInstantFromUtc";

describe("toInstantFromUtc", () => {
  it.each`
    value                         | expected
    ${"2024-03-10T12:00:00Z"}     | ${"2024-03-10T12:00:00Z"}
    ${"2024-01-01T00:00:00Z"}     | ${"2024-01-01T00:00:00Z"}
    ${"1970-01-01T00:00:00Z"}     | ${"1970-01-01T00:00:00Z"}
    ${"2024-06-15T23:59:59.999Z"} | ${"2024-06-15T23:59:59.999Z"}
    ${"2024-02-29T12:00:00Z"}     | ${"2024-02-29T12:00:00Z"}
  `(
    "converts valid UTC string $value to Instant $expected",
    ({ value, expected }) => {
      const instant = toInstantFromUtc(value);
      expect(instant).not.toBeNull();
      expect(instant?.toString()).toBe(expected);
    },
  );

  it.each`
    value                                     | reason
    ${""}                                     | ${"empty string"}
    ${"not-a-date"}                           | ${"random string"}
    ${"2024-03-10"}                           | ${"date without time or Z"}
    ${"2024-03-10T12:00:00[Europe/Helsinki]"} | ${"zoned string"}
    ${"2024-03-10T25:00:00Z"}                 | ${"invalid hour"}
  `("returns null for invalid UTC string $value ($reason)", ({ value }) => {
    expect(toInstantFromUtc(value)).toBeNull();
  });
});
