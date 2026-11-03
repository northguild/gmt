import { sqlOffsetDateTime } from "./sql-offset-date-time";

// SQL-92 §5.3 `<timestamp string> [ <time zone interval> ]`, with PostgreSQL §8.5.2's hour-only
// and `hh:mm:ss` offsets and SQL Server's `datetimeoffset` space before the offset. GMT rejects
// `T`, `Z`, a basic offset, second 60 and a fraction over 9 digits.
describe("regex/sql-offset-date-time", () => {
  it.each`
    value                                               | expected | reason
    ${"2024-03-15 14:30:00+00"}                         | ${true}  | ${"PostgreSQL hour-only offset"}
    ${"2024-03-15 14:30:00-08"}                         | ${true}  | ${"negative hour-only offset"}
    ${"2024-03-15 14:30:00+05:30"}                      | ${true}  | ${"SQL-92 form"}
    ${"2024-03-15 14:30:00.123456+05:30"}               | ${true}  | ${"six fraction digits"}
    ${"2007-05-08 12:35:29.1234567 +12:15"}             | ${true}  | ${"SQL Server, space before offset"}
    ${"1900-01-01 00:00:00+00:19:32"}                   | ${true}  | ${"PostgreSQL hh:mm:ss offset"}
    ${"2024-03-15 14:30:00.+00"}                        | ${true}  | ${"bare period"}
    ${"2024-02-30 00:00:00+00"}                         | ${true}  | ${"shape only"}
    ${"2024-03-15 14:30:00+23:59"}                      | ${true}  | ${"largest offset to the minute"}
    ${"2024-03-15 14:30:00-23:59:59"}                   | ${true}  | ${"largest negative offset with seconds"}
    ${"2024-03-15 14:30:00+00:00:01"}                   | ${true}  | ${"smallest non-zero offset"}
    ${"2024-03-15 14:30:00 -08"}                        | ${true}  | ${"space before hour-only offset"}
    ${"2024-03-15 14:30:00.1+00"}                       | ${true}  | ${"one fraction digit"}
    ${"2024-03-15 14:30:00.123456780+00"}               | ${true}  | ${"nine fraction digits, trailing zero"}
    ${"0001-01-01 00:00:00+00"}                         | ${true}  | ${"lowest year, lowest time"}
    ${"9999-12-31 23:59:59.999999999-23:59:59"}         | ${true}  | ${"highest year, highest time"}
    ${"2024-03-15T14:30:00+00:00"}                      | ${false} | ${"T separator"}
    ${"2024-03-15 24:00:00+00"}                         | ${false} | ${"time hour 24"}
    ${"2024-03-15 14:60:00+00"}                         | ${false} | ${"time minute 60"}
    ${"2024-13-15 14:30:00+00"}                         | ${false} | ${"month 13"}
    ${"2024-00-15 14:30:00+00"}                         | ${false} | ${"month 00"}
    ${"2024-03-00 14:30:00+00"}                         | ${false} | ${"day 00"}
    ${"2024-03-32 14:30:00+00"}                         | ${false} | ${"day 32"}
    ${"2024-03-15 14:30:00+05:30:60"}                   | ${false} | ${"offset second 60"}
    ${"2024-03-15 14:30:00+05:30:00:00"}                | ${false} | ${"four offset parts"}
    ${"2024-03-15 14:30:00+ 05"}                        | ${false} | ${"space after the sign"}
    ${"2024-03-15 14:30:00 05"}                         | ${false} | ${"no sign"}
    ${"2024-03-15 14:30:00\u221208"}                    | ${false} | ${"Unicode minus sign"}
    ${"2024-03-15\t14:30:00+00"}                        | ${false} | ${"tab separator"}
    ${"2024-03-15\u00a014:30:00+00"}                    | ${false} | ${"no-break space separator"}
    ${"2024-03-15 14:30:00\t+00"}                       | ${false} | ${"tab before the offset"}
    ${" 2024-03-15 14:30:00+00"}                        | ${false} | ${"leading space"}
    ${"2024-03-15 14:30:00+00 "}                        | ${false} | ${"trailing space"}
    ${"2024-03-15 14:30:00+00\n"}                       | ${false} | ${"trailing newline"}
    ${"\n2024-03-15 14:30:00+00"}                       | ${false} | ${"leading newline"}
    ${"2024-03-15 14:30:00+00\n2024-03-15 14:30:00+00"} | ${false} | ${"two lines"}
    ${"\uff12\uff10\uff12\uff14-03-15 14:30:00+00"}     | ${false} | ${"fullwidth digits"}
    ${"2024-03-15 14:30:00+\u0660\u0665"}               | ${false} | ${"Arabic-Indic digits"}
    ${"2024-03-15t14:30:00+00"}                         | ${false} | ${"lowercase t"}
    ${"2024-03-15 14:30:00z"}                           | ${false} | ${"lowercase z"}
    ${"2024-03-15 14:30:00+00 bc"}                      | ${false} | ${"lowercase era"}
    ${""}                                               | ${false} | ${"empty string"}
    ${"2024-03-15 14:30:00Z"}                           | ${false} | ${"Z"}
    ${"2024-03-15 14:30:00"}                            | ${false} | ${"no offset"}
    ${"2024-03-15 14:30:00  +05:30"}                    | ${false} | ${"two spaces"}
    ${"2024-03-15 14:30:00+5"}                          | ${false} | ${"one-digit hour"}
    ${"2024-03-15 14:30:00+0530"}                       | ${false} | ${"basic offset"}
    ${"2024-03-15 14:30:00+24:00"}                      | ${false} | ${"offset hour 24"}
    ${"2024-03-15 14:30:00+05:60"}                      | ${false} | ${"offset minute 60"}
    ${"2024-03-15 14:30:60+00"}                         | ${false} | ${"leap second"}
    ${"2024-03-15 14:30+00"}                            | ${false} | ${"seconds required"}
    ${"2024-03-15 14:30:00.1234567890+00"}              | ${false} | ${"ten fraction digits"}
    ${"0000-01-01 00:00:00+00"}                         | ${false} | ${"year 0000"}
    ${"10000-01-01 00:00:00+00"}                        | ${false} | ${"five-digit year"}
    ${"2024-03-15 14:30:00+00 BC"}                      | ${false} | ${"trailing era"}
    ${"infinity"}                                       | ${false} | ${"infinity"}
    ${"2024-03-15 14:30:00+05:30[Asia/Kolkata]"}        | ${false} | ${"annotation"}
  `(
    "sqlOffsetDateTime matches '$value' as $expected ($reason)",
    ({ value, expected }: { value: string; expected: boolean }) => {
      expect(sqlOffsetDateTime.test(value)).toBe(expected);
    },
  );

  it.each`
    value                                   | group | expected
    ${"2007-05-08 12:35:29.1234567 +12:15"} | ${1}  | ${"2007-05-08"}
    ${"2007-05-08 12:35:29.1234567 +12:15"} | ${2}  | ${"12:35:29"}
    ${"2007-05-08 12:35:29.1234567 +12:15"} | ${3}  | ${"1234567"}
    ${"2024-03-15 14:30:00.120000000+00"}   | ${3}  | ${"120000000"}
    ${"2024-03-15 14:30:00.+00"}            | ${3}  | ${""}
    ${"2024-03-15 14:30:00-08"}             | ${4}  | ${"-"}
    ${"2024-03-15 14:30:00-08"}             | ${5}  | ${"08"}
    ${"1900-01-01 00:00:00+00:19:32"}       | ${6}  | ${"19"}
    ${"1900-01-01 00:00:00+00:19:32"}       | ${7}  | ${"32"}
  `(
    "sqlOffsetDateTime captures group $group of '$value' as '$expected'",
    ({
      value,
      group,
      expected,
    }: {
      value: string;
      group: number;
      expected: string;
    }) => {
      expect(sqlOffsetDateTime.exec(value)?.[group]).toBe(expected);
    },
  );

  it.each`
    value                          | group
    ${"2024-03-15 14:30:00+00"}    | ${3}
    ${"2024-03-15 14:30:00-08"}    | ${6}
    ${"2024-03-15 14:30:00+05:30"} | ${7}
  `(
    "sqlOffsetDateTime leaves group $group of '$value' undefined",
    ({ value, group }: { value: string; group: number }) => {
      expect(sqlOffsetDateTime.exec(value)?.[group]).toBeUndefined();
    },
  );
});
