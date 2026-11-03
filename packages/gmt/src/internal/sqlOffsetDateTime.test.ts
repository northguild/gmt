import { readSqlOffsetDateTime } from "./sqlOffsetDateTime";

describe("internal/sqlOffsetDateTime", () => {
  it.each`
    value                                               | expected                                    | reason
    ${"2024-03-15 14:30:00+00"}                         | ${"2024-03-15T14:30:00+00:00"}              | ${"hour-only offset gains :00"}
    ${"2024-03-15 14:30:00-08"}                         | ${"2024-03-15T14:30:00-08:00"}              | ${"negative hour-only offset"}
    ${"2024-03-15 14:30:00+05:30"}                      | ${"2024-03-15T14:30:00+05:30"}              | ${"SQL-92 form"}
    ${"2024-03-15 14:30:00+05:30:00"}                   | ${"2024-03-15T14:30:00+05:30"}              | ${"zero offset seconds dropped"}
    ${"2024-03-15 14:30:00-00"}                         | ${"2024-03-15T14:30:00+00:00"}              | ${"negative zero hour-only"}
    ${"2024-03-15 14:30:00-00:00:00"}                   | ${"2024-03-15T14:30:00+00:00"}              | ${"negative zero with seconds"}
    ${"2024-03-15 14:30:00-00:00"}                      | ${"2024-03-15T14:30:00+00:00"}              | ${"negative zero to the minute"}
    ${"1900-01-01 00:00:00+00:19:32"}                   | ${"1900-01-01T00:00:00+00:19:32"}           | ${"offset seconds kept"}
    ${"2020-01-01 10:10:10+05:30"}                      | ${"2020-01-01T10:10:10+05:30"}              | ${"MySQL"}
    ${"2024-03-15 14:30:00.500000+00"}                  | ${"2024-03-15T14:30:00.5+00:00"}            | ${"trailing zeros dropped"}
    ${"2024-03-15 14:30:00.000000+00"}                  | ${"2024-03-15T14:30:00+00:00"}              | ${"all-zero fraction dropped"}
    ${"2024-03-15 14:30:00.+00"}                        | ${"2024-03-15T14:30:00+00:00"}              | ${"bare period dropped"}
    ${"2024-03-15 14:30:00.123456789+00"}               | ${"2024-03-15T14:30:00.123456789+00:00"}    | ${"nine digits"}
    ${"2007-05-08 12:35:29.1234567 +12:15"}             | ${"2007-05-08T12:35:29.1234567+12:15"}      | ${"SQL Server"}
    ${"2024-03-15 14:30:00.000000 +05:30"}              | ${"2024-03-15T14:30:00+05:30"}              | ${"Oracle ISO NLS"}
    ${"2024-02-29 12:00:00+00"}                         | ${"2024-02-29T12:00:00+00:00"}              | ${"leap day"}
    ${"0001-01-01 00:00:00+14:00"}                      | ${"0001-01-01T00:00:00+14:00"}              | ${"instant in year 0 still in range"}
    ${"9999-12-31 23:59:59-12:00"}                      | ${"9999-12-31T23:59:59-12:00"}              | ${"instant in year 10000 still in range"}
    ${"2024-03-15 14:30:00+23:59"}                      | ${"2024-03-15T14:30:00+23:59"}              | ${"largest offset to the minute"}
    ${"2024-03-15 14:30:00-23:59:59"}                   | ${"2024-03-15T14:30:00-23:59:59"}           | ${"largest negative offset with seconds"}
    ${"2024-03-15 14:30:00+00:00:01"}                   | ${"2024-03-15T14:30:00+00:00:01"}           | ${"smallest non-zero offset keeps seconds"}
    ${"2024-03-15 14:30:00-00:00:01"}                   | ${"2024-03-15T14:30:00-00:00:01"}           | ${"negative one second keeps its minus"}
    ${"2024-03-15 14:30:00-00:01"}                      | ${"2024-03-15T14:30:00-00:01"}              | ${"negative one minute keeps its minus"}
    ${"2024-03-15 14:30:00 -08"}                        | ${"2024-03-15T14:30:00-08:00"}              | ${"space before hour-only offset"}
    ${"2024-03-15 14:30:00.1+00"}                       | ${"2024-03-15T14:30:00.1+00:00"}            | ${"one fraction digit"}
    ${"2024-03-15 14:30:00.100000000+00"}               | ${"2024-03-15T14:30:00.1+00:00"}            | ${"nine digits, eight trailing zeros"}
    ${"2024-03-15 14:30:00.123456780+00"}               | ${"2024-03-15T14:30:00.12345678+00:00"}     | ${"nine digits, one trailing zero"}
    ${"2024-03-15 14:30:00.000000001+00"}               | ${"2024-03-15T14:30:00.000000001+00:00"}    | ${"one nanosecond keeps leading zeros"}
    ${"0001-01-01 00:00:00+23:59:59"}                   | ${"0001-01-01T00:00:00+23:59:59"}           | ${"lowest date with largest positive offset"}
    ${"9999-12-31 23:59:59.999999999-23:59:59"}         | ${"9999-12-31T23:59:59.999999999-23:59:59"} | ${"highest date with largest negative offset"}
    ${" 2024-03-15 14:30:00+00"}                        | ${""}                                       | ${"leading space"}
    ${"2024-03-15 14:30:00+00 "}                        | ${""}                                       | ${"trailing space"}
    ${"2024-03-15 14:30:00+00\n"}                       | ${""}                                       | ${"trailing newline"}
    ${"\uff12\uff10\uff12\uff14-03-15 14:30:00+00"}     | ${""}                                       | ${"fullwidth digits"}
    ${"2024-03-15 14:30:00z"}                           | ${""}                                       | ${"lowercase z"}
    ${"2024-03-15 14:30:00\u221208"}                    | ${""}                                       | ${"Unicode minus sign"}
    ${"2023-02-29 12:00:00+00"}                         | ${""}                                       | ${"29 February, common year"}
    ${"2024-02-30 12:00:00+00"}                         | ${""}                                       | ${"30 February"}
    ${"2024-06-31 12:00:00+00"}                         | ${""}                                       | ${"31 June"}
    ${"2024-03-15T14:30:00+00:00"}                      | ${""}                                       | ${"T"}
    ${""}                                               | ${""}                                       | ${"empty string"}
    ${"2024-03-15 14:30:00Z"}                           | ${""}                                       | ${"Z"}
    ${"2024-03-15 14:30:00"}                            | ${""}                                       | ${"no offset"}
    ${"2024-03-15 14:30:60+00"}                         | ${""}                                       | ${"leap second"}
    ${"0000-01-01 00:00:00+00"}                         | ${""}                                       | ${"year 0000"}
    ${"2024-03-15 14:30:00+05:30[Asia/Kolkata]"}        | ${""}                                       | ${"annotation"}
    ${"2024-03-15 24:00:00+00"}                         | ${""}                                       | ${"time hour 24"}
    ${"2024-03-15 14:60:00+00"}                         | ${""}                                       | ${"time minute 60"}
    ${"2024-13-15 14:30:00+00"}                         | ${""}                                       | ${"month 13"}
    ${"2024-00-15 14:30:00+00"}                         | ${""}                                       | ${"month 00"}
    ${"2024-03-00 14:30:00+00"}                         | ${""}                                       | ${"day 00"}
    ${"2024-03-32 14:30:00+00"}                         | ${""}                                       | ${"day 32"}
    ${"2024-03-15 14:30:00+05:30:60"}                   | ${""}                                       | ${"offset second 60"}
    ${"2024-03-15 14:30:00+05:30:00:00"}                | ${""}                                       | ${"four offset parts"}
    ${"2024-03-15 14:30:00+ 05"}                        | ${""}                                       | ${"space after the sign"}
    ${"2024-03-15 14:30:00 05"}                         | ${""}                                       | ${"no sign"}
    ${"2024-03-15\t14:30:00+00"}                        | ${""}                                       | ${"tab separator"}
    ${"2024-03-15\u00a014:30:00+00"}                    | ${""}                                       | ${"no-break space separator"}
    ${"2024-03-15 14:30:00\t+00"}                       | ${""}                                       | ${"tab before the offset"}
    ${"\n2024-03-15 14:30:00+00"}                       | ${""}                                       | ${"leading newline"}
    ${"2024-03-15 14:30:00+00\n2024-03-15 14:30:00+00"} | ${""}                                       | ${"two lines"}
    ${"2024-03-15 14:30:00+\u0660\u0665"}               | ${""}                                       | ${"Arabic-Indic digits"}
    ${"2024-03-15t14:30:00+00"}                         | ${""}                                       | ${"lowercase t"}
    ${"2024-03-15 14:30:00+00 bc"}                      | ${""}                                       | ${"lowercase era"}
    ${"2024-03-15 14:30:00  +05:30"}                    | ${""}                                       | ${"two spaces"}
    ${"2024-03-15 14:30:00+5"}                          | ${""}                                       | ${"one-digit hour"}
    ${"2024-03-15 14:30:00+0530"}                       | ${""}                                       | ${"basic offset"}
    ${"2024-03-15 14:30:00+24:00"}                      | ${""}                                       | ${"offset hour 24"}
    ${"2024-03-15 14:30:00+05:60"}                      | ${""}                                       | ${"offset minute 60"}
    ${"2024-03-15 14:30+00"}                            | ${""}                                       | ${"seconds required"}
    ${"2024-03-15 14:30:00.1234567890+00"}              | ${""}                                       | ${"ten fraction digits"}
    ${"10000-01-01 00:00:00+00"}                        | ${""}                                       | ${"five-digit year"}
    ${"2024-03-15 14:30:00+00 BC"}                      | ${""}                                       | ${"trailing era"}
    ${"infinity"}                                       | ${""}                                       | ${"infinity"}
  `(
    "readSqlOffsetDateTime('$value') is '$expected' ($reason)",
    ({ value, expected }: { value: string; expected: string }) => {
      expect(readSqlOffsetDateTime(value)).toBe(expected);
    },
  );

  it.each`
    value                                           | label
    ${null}                                         | ${"null"}
    ${undefined}                                    | ${"undefined"}
    ${123}                                          | ${"number"}
    ${new String("2024-03-15 14:30:00+00")}         | ${"String object"}
    ${true}                                         | ${"boolean"}
    ${10n}                                          | ${"bigint"}
    ${Symbol("x")}                                  | ${"symbol"}
    ${["2024-03-15 14:30:00+00"]}                   | ${"array holding a valid string"}
    ${{ toString: () => "2024-03-15 14:30:00+00" }} | ${"object with a valid toString"}
  `(
    "readSqlOffsetDateTime returns '' for a non-string ($label)",
    ({ value }: { value: unknown }) => {
      expect(readSqlOffsetDateTime(value)).toBe("");
    },
  );

  it("readSqlOffsetDateTime returns '' for a proxy whose every trap throws", () => {
    const hostile = new Proxy(
      {},
      {
        get: () => {
          throw new Error("get");
        },
        has: () => {
          throw new Error("has");
        },
        getPrototypeOf: () => {
          throw new Error("getPrototypeOf");
        },
      },
    );
    expect(readSqlOffsetDateTime(hostile)).toBe("");
  });
});
