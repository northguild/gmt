import { gtfsServiceDateOf } from "./gtfsServiceDate";

describe("gtfsServiceDateOf", () => {
  it.each`
    value           | expected        | reason
    ${"20240130"}   | ${"2024-01-30"} | ${"basic form YYYYMMDD"}
    ${"2024-01-30"} | ${"2024-01-30"} | ${"extended form YYYY-MM-DD"}
    ${"20240229"}   | ${"2024-02-29"} | ${"leap day in a leap year"}
    ${"2024-02-29"} | ${"2024-02-29"} | ${"leap day, extended form"}
    ${"00000101"}   | ${"0000-01-01"} | ${"year 0000 is a four-digit year"}
    ${"99991231"}   | ${"9999-12-31"} | ${"the last four-digit year"}
  `(
    "reads '$value' as '$expected' ($reason)",
    ({ value, expected }: { value: string; expected: string }) => {
      expect(gtfsServiceDateOf(value)).toBe(expected);
    },
  );

  it.each`
    value                        | label                     | reason
    ${"20240230"}                | ${"20240230"}             | ${"February 30 does not exist"}
    ${"2024-02-30"}              | ${"2024-02-30"}           | ${"February 30 does not exist, extended"}
    ${"20230229"}                | ${"20230229"}             | ${"29 February in a common year"}
    ${"20241301"}                | ${"month 13"}             | ${"month 13"}
    ${"20240100"}                | ${"day 00"}               | ${"day 00"}
    ${"2024-01-30T23:00"}        | ${"date-time"}            | ${"a date-time is not a date"}
    ${"20240130T2300"}           | ${"basic date-time"}      | ${"a basic date-time is not a date"}
    ${"+002024-01-30"}           | ${"expanded year"}        | ${"extended years are not GTFS"}
    ${"2024-01-30[u-ca=hebrew]"} | ${"annotation"}           | ${"annotations are not GTFS"}
    ${"2024-01-30Z"}             | ${"UTC designator"}       | ${"offsets are not GTFS"}
    ${"2024-0130"}               | ${"mixed form 2024-0130"} | ${"mixed forms are rejected"}
    ${"202401-30"}               | ${"mixed form 202401-30"} | ${"mixed forms are rejected"}
    ${"2024-1-30"}               | ${"unpadded month"}       | ${"fields are zero-padded"}
    ${"240130"}                  | ${"two-digit year"}       | ${"four-digit year only"}
    ${""}                        | ${"empty string"}         | ${"empty field"}
    ${" 20240130"}               | ${"leading space"}        | ${"nothing is trimmed"}
    ${"20240130\n"}              | ${"trailing newline"}     | ${"nothing is trimmed"}
    ${"２０２４０１３０"}        | ${"fullwidth digits"}     | ${"ASCII digits only"}
  `("returns null for $label ($reason)", ({ value }: { value: string }) => {
    expect(gtfsServiceDateOf(value)).toBeNull();
  });

  it.each`
    value        | label
    ${20240130}  | ${"number"}
    ${null}      | ${"null"}
    ${undefined} | ${"undefined"}
    ${{}}        | ${"object"}
  `(
    "returns null for the non-string $label",
    ({ value }: { value: unknown }) => {
      expect(gtfsServiceDateOf(value)).toBeNull();
    },
  );
});
