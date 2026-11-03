import { parseSqlOffsetDateTime } from "../parse/parseSqlOffsetDateTime";
import { sqlOffsetDateTime } from "../../regex";
import { arrives, NON_STRINGS } from "../../test/nonStrings";
import { isValidSqlOffsetDateTime } from "./isValidSqlOffsetDateTime";

/**
 * Each verdict is worked out from the SQL-92 §5.3 `<timestamp string>` and `<time zone interval>`
 * grammar that `sqlOffsetDateTime` documents (a single space, seconds required, up to nine
 * fraction digits, an optional space before a `±HH[:MM[:SS]]` offset, no leap second) and from the
 * calendar, never from the function. `pattern` is what the shape-only regex says of the same
 * string. Every input the regex tests and the parser tests use is here, so the files stay in step.
 */
describe("isValidSqlOffsetDateTime", () => {
  it.each`
    value                                               | expected | pattern  | reason
    ${"2024-03-15 14:30:00+00"}                         | ${true}  | ${true}  | ${"PostgreSQL hour-only offset"}
    ${"2024-03-15 14:30:00-08"}                         | ${true}  | ${true}  | ${"negative hour-only offset"}
    ${"2024-03-15 14:30:00+05:30"}                      | ${true}  | ${true}  | ${"SQL-92 offset"}
    ${"2024-03-15 14:30:00+05:30:00"}                   | ${true}  | ${true}  | ${"zero offset seconds"}
    ${"2024-03-15 14:30:00-00"}                         | ${true}  | ${true}  | ${"negative zero offset"}
    ${"2024-03-15 14:30:00-00:00:00"}                   | ${true}  | ${true}  | ${"negative zero offset with seconds"}
    ${"1900-01-01 00:00:00+00:19:32"}                   | ${true}  | ${true}  | ${"PostgreSQL hh:mm:ss offset"}
    ${"2024-03-15 14:30:00.500000+00"}                  | ${true}  | ${true}  | ${"fraction with trailing zeros"}
    ${"2024-03-15 14:30:00.000000+00"}                  | ${true}  | ${true}  | ${"all-zero fraction"}
    ${"2024-03-15 14:30:00.+00"}                        | ${true}  | ${true}  | ${"a period with no fraction"}
    ${"2024-03-15 14:30:00.1+00"}                       | ${true}  | ${true}  | ${"one fraction digit"}
    ${"2024-03-15 14:30:00.123456+05:30"}               | ${true}  | ${true}  | ${"six fraction digits"}
    ${"2024-03-15 14:30:00.123456780+00"}               | ${true}  | ${true}  | ${"nine fraction digits, trailing zero"}
    ${"2024-03-15 14:30:00.123456789+00"}               | ${true}  | ${true}  | ${"nine fraction digits"}
    ${"2007-05-08 12:35:29.1234567 +12:15"}             | ${true}  | ${true}  | ${"SQL Server, space before offset"}
    ${"2024-03-15 14:30:00.000000 +05:30"}              | ${true}  | ${true}  | ${"Oracle under an ISO NLS format"}
    ${"2024-03-15 14:30:00 -08"}                        | ${true}  | ${true}  | ${"space before hour-only offset"}
    ${"2020-01-01 10:10:10+05:30"}                      | ${true}  | ${true}  | ${"MySQL 11.1.3 example"}
    ${"2024-03-15 14:30:00+23:59"}                      | ${true}  | ${true}  | ${"largest offset to the minute"}
    ${"2024-03-15 14:30:00-23:59:59"}                   | ${true}  | ${true}  | ${"largest negative offset with seconds"}
    ${"2024-03-15 14:30:00+00:00:01"}                   | ${true}  | ${true}  | ${"smallest non-zero offset"}
    ${"2024-02-29 12:00:00+00"}                         | ${true}  | ${true}  | ${"29 February in a leap year"}
    ${"2000-02-29 12:00:00+00"}                         | ${true}  | ${true}  | ${"2000 is divisible by 400"}
    ${"0001-01-01 00:00:00+00"}                         | ${true}  | ${true}  | ${"lowest year, lowest time"}
    ${"0001-01-01 00:00:00+14:00"}                      | ${true}  | ${true}  | ${"instant in year 0 is still in range"}
    ${"9999-12-31 23:59:59-12:00"}                      | ${true}  | ${true}  | ${"instant in year 10000 is still in range"}
    ${"9999-12-31 23:59:59.999999999-23:59:59"}         | ${true}  | ${true}  | ${"highest year, highest time"}
    ${"2023-02-29 12:00:00+00"}                         | ${false} | ${true}  | ${"2023 has no 29 February"}
    ${"1900-02-29 12:00:00+00"}                         | ${false} | ${true}  | ${"1900 is divisible by 100, not 400"}
    ${"2024-02-30 00:00:00+00"}                         | ${false} | ${true}  | ${"February has no 30th"}
    ${"2024-02-30 12:00:00+00"}                         | ${false} | ${true}  | ${"February has no 30th, at noon"}
    ${"2024-04-31 12:00:00+00"}                         | ${false} | ${true}  | ${"April has 30 days"}
    ${"2024-06-31 12:00:00+00"}                         | ${false} | ${true}  | ${"June has 30 days"}
    ${""}                                               | ${false} | ${false} | ${"empty string"}
    ${"infinity"}                                       | ${false} | ${false} | ${"PostgreSQL infinity"}
    ${"2024-03-15T14:30:00+00:00"}                      | ${false} | ${false} | ${"T separator"}
    ${"2024-03-15t14:30:00+00"}                         | ${false} | ${false} | ${"lowercase t"}
    ${"2024-03-15 14:30:00Z"}                           | ${false} | ${false} | ${"Z designator"}
    ${"2024-03-15 14:30:00z"}                           | ${false} | ${false} | ${"lowercase z"}
    ${"2024-03-15 14:30:00"}                            | ${false} | ${false} | ${"no offset: isValidSqlDateTime"}
    ${"2024-03-15 14:30:00  +05:30"}                    | ${false} | ${false} | ${"two spaces"}
    ${"2024-03-15\t14:30:00+00"}                        | ${false} | ${false} | ${"tab separator"}
    ${"2024-03-15 14:30:00+00"}                         | ${false} | ${false} | ${"no-break space separator"}
    ${"2024-03-15 14:30:00\t+00"}                       | ${false} | ${false} | ${"tab before the offset"}
    ${"2024-03-15 14:30:00+ 05"}                        | ${false} | ${false} | ${"space after the sign"}
    ${"2024-03-15 14:30:00 05"}                         | ${false} | ${false} | ${"no sign"}
    ${"2024-03-15 14:30:00−08"}                         | ${false} | ${false} | ${"Unicode minus sign"}
    ${"2024-03-15 14:30:00+5"}                          | ${false} | ${false} | ${"one-digit hour"}
    ${"2024-03-15 14:30:00+0530"}                       | ${false} | ${false} | ${"basic offset"}
    ${"2024-03-15 14:30:00+05:30:00:00"}                | ${false} | ${false} | ${"four offset parts"}
    ${"2024-03-15 14:30:00+24:00"}                      | ${false} | ${false} | ${"offset hour 24"}
    ${"2024-03-15 14:30:00+05:60"}                      | ${false} | ${false} | ${"offset minute 60"}
    ${"2024-03-15 14:30:00+05:30:60"}                   | ${false} | ${false} | ${"offset second 60"}
    ${"2024-03-15 24:00:00+00"}                         | ${false} | ${false} | ${"hour 24"}
    ${"2024-03-15 14:60:00+00"}                         | ${false} | ${false} | ${"minute 60"}
    ${"2024-03-15 14:30:60+00"}                         | ${false} | ${false} | ${"second 60: GMT rejects leap seconds"}
    ${"2024-03-15 14:30+00"}                            | ${false} | ${false} | ${"seconds are required"}
    ${"2024-13-15 14:30:00+00"}                         | ${false} | ${false} | ${"month 13"}
    ${"2024-00-15 14:30:00+00"}                         | ${false} | ${false} | ${"month 00"}
    ${"2024-03-00 14:30:00+00"}                         | ${false} | ${false} | ${"day 00"}
    ${"2024-03-32 14:30:00+00"}                         | ${false} | ${false} | ${"day 32"}
    ${"2024-03-15 14:30:00.1234567890+00"}              | ${false} | ${false} | ${"ten fraction digits"}
    ${"0000-01-01 00:00:00+00"}                         | ${false} | ${false} | ${"year 0000"}
    ${"10000-01-01 00:00:00+00"}                        | ${false} | ${false} | ${"five-digit year"}
    ${" 2024-03-15 14:30:00+00"}                        | ${false} | ${false} | ${"leading space"}
    ${"2024-03-15 14:30:00+00 "}                        | ${false} | ${false} | ${"trailing space"}
    ${"2024-03-15 14:30:00+00\n"}                       | ${false} | ${false} | ${"trailing newline"}
    ${"\n2024-03-15 14:30:00+00"}                       | ${false} | ${false} | ${"leading newline"}
    ${"2024-03-15 14:30:00+00\n2024-03-15 14:30:00+00"} | ${false} | ${false} | ${"two lines"}
    ${"２０２４-03-15 14:30:00+00"}                     | ${false} | ${false} | ${"fullwidth digits"}
    ${"2024-03-15 14:30:00+٠٥"}                         | ${false} | ${false} | ${"Arabic-Indic digits"}
    ${"2024-03-15 14:30:00+00 BC"}                      | ${false} | ${false} | ${"trailing era"}
    ${"2024-03-15 14:30:00+00 bc"}                      | ${false} | ${false} | ${"lowercase era"}
    ${"2024-03-15 14:30:00+05:30[Asia/Kolkata]"}        | ${false} | ${false} | ${"annotation"}
  `(
    "returns $expected for '$value' ($reason); the pattern alone says $pattern; parseSqlOffsetDateTime agrees",
    ({
      value,
      expected,
      pattern,
    }: {
      value: string;
      expected: boolean;
      pattern: boolean;
    }) => {
      expect(isValidSqlOffsetDateTime(value)).toBe(expected);
      expect(sqlOffsetDateTime.test(value)).toBe(pattern);
      expect(isValidSqlOffsetDateTime(value)).toBe(
        parseSqlOffsetDateTime(value) !== "",
      );
    },
  );

  it("returns false for an argument that is not a string, as parseSqlOffsetDateTime returns ''", () => {
    for (const [kind, make] of NON_STRINGS) {
      expect(isValidSqlOffsetDateTime(make()), kind).toBe(false);
      expect(parseSqlOffsetDateTime(make() as never), kind).toBe("");
    }
  });
});

describe("isValidSqlOffsetDateTime types", () => {
  it("narrows a value typed unknown to string when it is valid", () => {
    const input = arrives("2024-03-15 14:30:00+00");
    if (isValidSqlOffsetDateTime(input)) {
      expectTypeOf(input).toEqualTypeOf<string>();
    } else {
      expectTypeOf(input).toEqualTypeOf<unknown>();
    }
    expect(isValidSqlOffsetDateTime(input)).toBe(true);
  });

  it("keeps a string a string when it is not valid", () => {
    const input: string = "invalid";
    if (!isValidSqlOffsetDateTime(input)) {
      expectTypeOf(input).toEqualTypeOf<string>();
    }
    expect(isValidSqlOffsetDateTime(input)).toBe(false);
  });

  it("leaves string | null as it is on both branches", () => {
    const check = (input: string | null): boolean => {
      if (isValidSqlOffsetDateTime(input)) {
        expectTypeOf(input).toEqualTypeOf<string | null>();
        return true;
      }
      expectTypeOf(input).toEqualTypeOf<string | null>();
      return false;
    };
    expect(check("2024-03-15 14:30:00+00")).toBe(true);
    expect(check(null)).toBe(false);
  });

  it("leaves string | void as it is on both branches", () => {
    const check = (input: string | void): boolean => {
      if (isValidSqlOffsetDateTime(input)) {
        expectTypeOf(input).toEqualTypeOf<string | void>();
        return true;
      }
      expectTypeOf(input).toEqualTypeOf<string | void>();
      return false;
    };
    expect(check("2024-03-15 14:30:00+00")).toBe(true);
    expect(check(undefined)).toBe(false);
  });

  it("filters an unknown[] to string[]", () => {
    const values = [null, "2024-03-15 14:30:00+00", 1, "invalid"].map(arrives);
    const kept = values.filter(isValidSqlOffsetDateTime);
    expectTypeOf(kept).toEqualTypeOf<string[]>();
    expect(kept).toEqual(["2024-03-15 14:30:00+00"]);
  });
});
