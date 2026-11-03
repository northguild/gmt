import { arrives, NON_STRINGS } from "../../test/nonStrings";
import { parseSqlDateTime } from "../../plain/parse/parseSqlDateTime";
import { parseRfc3339 } from "../../zoned/parse/parseRfc3339";
import { toOffsetInstant } from "../convert/toOffsetInstant";
import { parseSqlOffsetDateTime } from "./parseSqlOffsetDateTime";

/**
 * Every expected value is decided from the grammar (SQL-92 §5.3 with the PostgreSQL and SQL
 * Server deviations, as `internal/sqlOffsetDateTime.test.ts` tabulates) and the Temporal string
 * forms: offset kept, `T` separator, hour-only offset gains `:00`, zero offset seconds dropped, `-00` written `+00:00`,
 * fraction trailing zeros dropped.
 */
describe("parseSqlOffsetDateTime", () => {
  it.each`
    value                                        | expected                                 | reason
    ${"2024-03-15 14:30:00+00"}                  | ${"2024-03-15T14:30:00+00:00"}           | ${"hour-only offset gains :00"}
    ${"2024-03-15 14:30:00-08"}                  | ${"2024-03-15T14:30:00-08:00"}           | ${"negative hour-only offset"}
    ${"2024-03-15 14:30:00+05:30"}               | ${"2024-03-15T14:30:00+05:30"}           | ${"SQL-92 form"}
    ${"2024-03-15 14:30:00+05:30:00"}            | ${"2024-03-15T14:30:00+05:30"}           | ${"zero offset seconds dropped"}
    ${"2024-03-15 14:30:00-00"}                  | ${"2024-03-15T14:30:00+00:00"}           | ${"negative zero hour-only"}
    ${"2024-03-15 14:30:00-00:00"}               | ${"2024-03-15T14:30:00+00:00"}           | ${"negative zero to the minute"}
    ${"2024-03-15 14:30:00-00:00:00"}            | ${"2024-03-15T14:30:00+00:00"}           | ${"negative zero with seconds"}
    ${"1900-01-01 00:00:00+00:19:32"}            | ${"1900-01-01T00:00:00+00:19:32"}        | ${"offset seconds kept"}
    ${"2024-03-15 14:30:00.123456+05:30"}        | ${"2024-03-15T14:30:00.123456+05:30"}    | ${"PostgreSQL six digits"}
    ${"2024-03-15 14:30:00.500000+00"}           | ${"2024-03-15T14:30:00.5+00:00"}         | ${"trailing zeros dropped"}
    ${"2024-03-15 14:30:00.000000+00"}           | ${"2024-03-15T14:30:00+00:00"}           | ${"all-zero fraction dropped"}
    ${"2024-03-15 14:30:00.+00"}                 | ${"2024-03-15T14:30:00+00:00"}           | ${"bare period dropped"}
    ${"2024-03-15 14:30:00.123456789+00"}        | ${"2024-03-15T14:30:00.123456789+00:00"} | ${"nine digits"}
    ${"2007-05-08 12:35:29.1234567 +12:15"}      | ${"2007-05-08T12:35:29.1234567+12:15"}   | ${"SQL Server datetimeoffset"}
    ${"2024-03-15 14:30:00.000000 +05:30"}       | ${"2024-03-15T14:30:00+05:30"}           | ${"Oracle under an ISO NLS format"}
    ${"2020-01-01 10:10:10+05:30"}               | ${"2020-01-01T10:10:10+05:30"}           | ${"MySQL example"}
    ${"2024-02-29 12:00:00+00"}                  | ${"2024-02-29T12:00:00+00:00"}           | ${"leap day"}
    ${"0001-01-01 00:00:00+14:00"}               | ${"0001-01-01T00:00:00+14:00"}           | ${"instant in year 0, in range"}
    ${"9999-12-31 23:59:59-12:00"}               | ${"9999-12-31T23:59:59-12:00"}           | ${"instant in year 10000, in range"}
    ${"2023-02-29 12:00:00+00"}                  | ${""}                                    | ${"29 February, common year"}
    ${"2024-02-30 12:00:00+00"}                  | ${""}                                    | ${"30 February"}
    ${"2024-06-31 12:00:00+00"}                  | ${""}                                    | ${"31 June"}
    ${"2024-03-15T14:30:00+00:00"}               | ${""}                                    | ${"T separator: ISO 8601"}
    ${"2024-03-15 14:30:00Z"}                    | ${""}                                    | ${"Z designator"}
    ${"2024-03-15 14:30:00"}                     | ${""}                                    | ${"no offset"}
    ${"2024-03-15 14:30:00  +05:30"}             | ${""}                                    | ${"two spaces"}
    ${"2024-03-15 14:30:00+5"}                   | ${""}                                    | ${"one-digit hour"}
    ${"2024-03-15 14:30:00+0530"}                | ${""}                                    | ${"basic offset"}
    ${"2024-03-15 14:30:00+24:00"}               | ${""}                                    | ${"hour 24"}
    ${"2024-03-15 14:30:00+05:60"}               | ${""}                                    | ${"minute 60"}
    ${"2024-03-15 14:30:60+00"}                  | ${""}                                    | ${"leap second"}
    ${"2024-03-15 14:30+00"}                     | ${""}                                    | ${"seconds required"}
    ${"2024-03-15 14:30:00.1234567890+00"}       | ${""}                                    | ${"ten digits"}
    ${"0000-01-01 00:00:00+00"}                  | ${""}                                    | ${"year 0000"}
    ${"10000-01-01 00:00:00+00"}                 | ${""}                                    | ${"five-digit year"}
    ${"2024-03-15 14:30:00+00 BC"}               | ${""}                                    | ${"trailing era"}
    ${"infinity"}                                | ${""}                                    | ${"infinity"}
    ${"2024-03-15 14:30:00+05:30[Asia/Kolkata]"} | ${""}                                    | ${"annotation"}
    ${""}                                        | ${""}                                    | ${"empty string"}
  `(
    "parseSqlOffsetDateTime('$value') is '$expected' ($reason)",
    ({ value, expected }: { value: string; expected: string }) => {
      expect(parseSqlOffsetDateTime(value)).toBe(expected);
    },
  );

  // Instants are fixed by hand: wall time minus offset.
  it.each`
    value                                   | offset         | instant
    ${"2024-03-15 14:30:00+05:30"}          | ${"+05:30"}    | ${"2024-03-15T09:00:00Z"}
    ${"2024-03-15 14:30:00-08"}             | ${"-08:00"}    | ${"2024-03-15T22:30:00Z"}
    ${"2007-05-08 12:35:29.1234567 +12:15"} | ${"+12:15"}    | ${"2007-05-08T00:20:29.1234567Z"}
    ${"1900-01-01 00:00:00+00:19:32"}       | ${"+00:19:32"} | ${"1899-12-31T23:40:28Z"}
    ${"2024-03-15 14:30:00-00"}             | ${"+00:00"}    | ${"2024-03-15T14:30:00Z"}
    ${"2024-03-15 14:30:00.5-08:00"}        | ${"-08:00"}    | ${"2024-03-15T22:30:00.5Z"}
    ${"0001-01-01 00:00:00+14:00"}          | ${"+14:00"}    | ${"0000-12-31T10:00:00Z"}
  `(
    "the result for '$value' reads as instant '$instant' with offset '$offset'",
    ({
      value,
      offset,
      instant,
    }: {
      value: string;
      offset: string;
      instant: string;
    }) => {
      const result = toOffsetInstant(parseSqlOffsetDateTime(value));
      expect(result).not.toBeNull();
      expect(result?.offset).toBe(offset);
      expect(result?.instant).toBe(instant);
    },
  );

  it.each`
    value
    ${"2024-03-15 14:30:00+05:30"}
    ${"2024-03-15 14:30:00.5-08:00"}
    ${"2024-03-15 14:30:00+00:00"}
  `(
    "toOffsetInstant agrees with parseRfc3339 on the shared form '$value'",
    ({ value }: { value: string }) => {
      const ours = toOffsetInstant(parseSqlOffsetDateTime(value));
      const theirs = toOffsetInstant(parseRfc3339(value));
      expect(ours).not.toBeNull();
      expect(ours?.instant).toBe(theirs?.instant);
      expect(ours?.offset).toBe(theirs?.offset);
    },
  );

  it("parseRfc3339 gives the shared form its zoned spelling", () => {
    expect(parseRfc3339("2024-03-15 14:30:00+05:30")).toBe(
      "2024-03-15T14:30:00+05:30[+05:30]",
    );
  });

  it.each`
    value
    ${"2024-03-15 14:30:00+00"}
    ${"1900-01-01 00:00:00+00:19:32"}
    ${"2007-05-08 12:35:29.1234567 +12:15"}
  `(
    "parseRfc3339 refuses '$value' that this reader accepts",
    ({ value }: { value: string }) => {
      expect(parseRfc3339(value)).toBe("");
      expect(parseSqlOffsetDateTime(value)).not.toBe("");
    },
  );

  it.each`
    wall                               | datePart
    ${"2024-03-15 14:30:00"}           | ${"2024-03-15T14:30:00"}
    ${"2024-03-15 14:30:00.5"}         | ${"2024-03-15T14:30:00.5"}
    ${"2024-03-15 14:30:00.123456789"} | ${"2024-03-15T14:30:00.123456789"}
  `(
    "parseSqlDateTime('$wall') is the date-time part of the +00 reading",
    ({ wall, datePart }: { wall: string; datePart: string }) => {
      expect(parseSqlDateTime(wall)).toBe(datePart);
      expect(parseSqlOffsetDateTime(`${wall}+00`)).toBe(`${datePart}+00:00`);
    },
  );

  it("returns '' for every value that is not a string", () => {
    for (const [kind, make] of NON_STRINGS) {
      expect(parseSqlOffsetDateTime(arrives(make()) as string), kind).toBe("");
    }
  });

  it("returns '' for a String object, which is an object and not a string", () => {
    expect(
      parseSqlOffsetDateTime(
        new String("2024-03-15 14:30:00+00") as unknown as string,
      ),
    ).toBe("");
  });

  it("returns '' for a proxy whose toString throws, without calling it", () => {
    const toString = vi.fn(() => {
      throw new TypeError("toString must not be called");
    });
    const proxy = new Proxy({}, { get: () => toString });
    expect(parseSqlOffsetDateTime(arrives(proxy) as string)).toBe("");
    expect(toString).not.toHaveBeenCalled();
  });
});
