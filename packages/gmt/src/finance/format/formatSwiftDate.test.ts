import { Temporal } from "../../internal/temporal";
import { countIntlConstructions } from "../../test/countIntlConstructions";
import { mockTemporalPlainDateFromThrow } from "../../test/mocks";
import { NON_STRINGS } from "../../test/nonStrings";
import { SWIFT_VALID_ROWS } from "../../test/swiftDateRows";
import { isValidDate } from "../../plain/validate/isValidDate";
import { formatSwiftDate } from "./formatSwiftDate";

/**
 * Every expected value is written by hand from SWIFT Standards MT General Information (Nov 2025)
 * §6.3.1 (`YYMMDD`, zero-padded; a value date lies in 2001 to 2060) and §6.3.6 (`YY` 01 to 60).
 */
describe("formatSwiftDate", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each`
    value                         | expected    | why
    ${"2024-06-15"}               | ${"240615"} | ${"an ordinary date"}
    ${"2001-01-01"}               | ${"010101"} | ${"the lower limit"}
    ${"2060-12-31"}               | ${"601231"} | ${"the upper limit"}
    ${"2004-02-29"}               | ${"040229"} | ${"the first leap day in range"}
    ${"2060-02-29"}               | ${"600229"} | ${"a leap day at the upper limit"}
    ${"2005-01-09"}               | ${"050109"} | ${"month, day and year are padded"}
    ${"2024-06-15[u-ca=iso8601]"} | ${"240615"} | ${"the ISO calendar annotation, as isValidDate"}
  `("writes '$value' as '$expected': $why", ({ value, expected }) => {
    expect(formatSwiftDate(value)).toBe(expected);
  });

  it.each`
    value                                       | reason
    ${"2000-12-31"}                             | ${"before 2001: YY 00 is T50"}
    ${"2000-01-01"}                             | ${"before 2001: YY 00 is T50"}
    ${"2000-02-29"}                             | ${"before 2001, though a leap day"}
    ${"1999-12-31"}                             | ${"before 2001: YY 99 is T50"}
    ${"1980-01-01"}                             | ${"before 2001: the 2006 rule's first year"}
    ${"2061-01-01"}                             | ${"after 2060"}
    ${"2079-06-15"}                             | ${"would read back as T50"}
    ${"1924-06-15"}                             | ${"would read back as 2024"}
    ${"2124-06-15"}                             | ${"would read back as 2024"}
    ${"0024-06-15"}                             | ${"far outside the range"}
    ${"9999-12-31"}                             | ${"far outside the range"}
    ${"2024-06-15T10:00:00"}                    | ${"a date-time"}
    ${"2024-06-15T10:00:00Z"}                   | ${"an instant"}
    ${"2024-06-15T10:00:00+02:00[Europe/Oslo]"} | ${"a zoned date-time"}
    ${"2024-06-15[u-ca=hebrew]"}                | ${"a non-ISO calendar"}
    ${"2024-02-30"}                             | ${"February has no day 30"}
    ${"2023-02-29"}                             | ${"2023 is not a leap year"}
    ${"2024-13-01"}                             | ${"there is no month 13"}
    ${"240615"}                                 | ${"a SWIFT date is not this input"}
    ${""}                                       | ${"empty"}
    ${" 2024-06-15"}                            | ${"leading space"}
  `("returns '' for '$value': $reason", ({ value }) => {
    expect(formatSwiftDate(value)).toBe("");
  });

  it.each`
    value
    ${"20240615"}
    ${"+002024-06-15"}
  `(
    "agrees with isValidDate on the alternative spelling '$value'",
    ({ value }) => {
      const expected = isValidDate(value) ? "240615" : "";
      expect(formatSwiftDate(value)).toBe(expected);
    },
  );

  it.each`
    value                         | expected    | why
    ${"20240615"}                 | ${""}       | ${"the basic form is not accepted by isValidDate"}
    ${"+002024-06-15"}            | ${"240615"} | ${"an expanded year is the same date"}
    ${"2024-06-15[Europe/Paris]"} | ${"240615"} | ${"a zone annotation is dropped, the date is kept"}
  `("writes '$value' as '$expected': $why", ({ value, expected }) => {
    expect(formatSwiftDate(value)).toBe(expected);
  });

  it("writes the shared valid rows back to their YYMMDD value", () => {
    for (const { value, expected } of SWIFT_VALID_ROWS) {
      expect(formatSwiftDate(expected), expected).toBe(value);
    }
  });

  describe("arguments", () => {
    it("returns '' for every non-string value", () => {
      for (const [kind, make] of NON_STRINGS) {
        expect(formatSwiftDate(make() as string), kind).toBe("");
      }
    });

    it("returns '' for a String object", () => {
      expect(formatSwiftDate(new String("2024-06-15") as string)).toBe("");
    });

    it("returns '' for a Temporal.PlainDate object", () => {
      expect(
        formatSwiftDate(Temporal.PlainDate.from("2024-06-15") as never),
      ).toBe("");
    });

    it("returns '' when Temporal.PlainDate.from throws", () => {
      mockTemporalPlainDateFromThrow();
      expect(formatSwiftDate("2024-06-15")).toBe("");
    });
  });

  describe("locale independence", () => {
    it("constructs no Intl formatter", () => {
      const run = (): void => {
        for (const { expected } of SWIFT_VALID_ROWS) {
          formatSwiftDate(expected);
        }
      };
      expect(
        countIntlConstructions(["DateTimeFormat", "NumberFormat"], run, run),
      ).toBe(0);
    });
  });
});
