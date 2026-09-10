import { sameInstantBattleCases } from "../../test";
import { mockTemporalInstantFromThrow } from "../../test/mocks";
import { toExcelSerial } from "./toExcelSerial";

describe("toExcelSerial", () => {
  it.each`
    value                         | expected              | reason
    ${"1900-01-01T00:00:00Z"}     | ${1}                  | ${"Excel's first serial"}
    ${"1900-02-28T00:00:00Z"}     | ${59}                 | ${"the last real day before the phantom leap day"}
    ${"1900-03-01T00:00:00Z"}     | ${61}                 | ${"the first day after it — serial 60 is skipped"}
    ${"1970-01-01T00:00:00Z"}     | ${25569}              | ${"the Unix epoch"}
    ${"2024-02-29T00:00:00Z"}     | ${45351}              | ${"a real leap day"}
    ${"2024-03-10T00:00:00Z"}     | ${45361}              | ${"whole day"}
    ${"2024-03-10T12:00:00Z"}     | ${45361.5}            | ${"midday — the fraction is the time of day"}
    ${"2024-03-10T12:34:56.789Z"} | ${45361.5242683912}   | ${"millisecond precision"}
    ${"9999-12-31T00:00:00Z"}     | ${2958465}            | ${"Excel's last serial"}
    ${"9999-12-31T23:59:59.999Z"} | ${2958465.9999999884} | ${"the last instant Excel can name"}
  `(
    "returns $expected for $value in the default 1900 system ($reason)",
    ({ value, expected }) => {
      expect(toExcelSerial(value)).toBe(expected);
    },
  );

  it.each`
    value                     | expected   | reason
    ${"1900-01-01T00:00:00Z"} | ${1}       | ${"explicit 1900 matches the default"}
    ${"2024-03-10T12:00:00Z"} | ${45361.5} | ${"explicit 1900 matches the default"}
  `(
    'returns $expected for $value with { system: "1900" } ($reason)',
    ({ value, expected }) => {
      expect(toExcelSerial(value, { system: "1900" })).toBe(expected);
    },
  );

  it.each`
    value                     | expected   | reason
    ${"1904-01-01T00:00:00Z"} | ${0}       | ${"the 1904 system's first serial"}
    ${"1970-01-01T00:00:00Z"} | ${24107}   | ${"the Unix epoch"}
    ${"2024-03-10T00:00:00Z"} | ${43899}   | ${"whole day"}
    ${"2024-03-10T12:00:00Z"} | ${43899.5} | ${"midday"}
    ${"9999-12-31T00:00:00Z"} | ${2957003} | ${"the 1904 system's last serial"}
  `(
    'returns $expected for $value with { system: "1904" } ($reason)',
    ({ value, expected }) => {
      expect(toExcelSerial(value, { system: "1904" })).toBe(expected);
    },
  );

  it.each`
    value                         | reason
    ${"1904-01-01T00:00:00Z"}     | ${"the 1904 epoch"}
    ${"1970-01-01T00:00:00Z"}     | ${"the Unix epoch"}
    ${"2024-03-10T12:34:56.789Z"} | ${"millisecond precision"}
    ${"9999-12-31T00:00:00Z"}     | ${"the last whole day"}
  `(
    "offsets the 1904 system from the 1900 system by exactly 1462 days at $value ($reason)",
    ({ value }) => {
      expect(toExcelSerial(value, { system: "1900" })).toBe(
        (toExcelSerial(value, { system: "1904" }) as number) + 1462,
      );
    },
  );

  it.each`
    value                               | expected              | reason
    ${"9999-12-31T23:59:59.999979883Z"} | ${2958465.9999999995} | ${"the last instant that still rounds below the exclusive maximum"}
  `("returns $expected for $value ($reason)", ({ value, expected }) => {
    expect(toExcelSerial(value)).toBe(expected);
  });

  it.each`
    value                               | reason
    ${"9999-12-31T23:59:59.999979884Z"} | ${"the first instant whose serial rounds to 2958466"}
    ${"9999-12-31T23:59:59.99998Z"}     | ${"inside the same ~20 us window"}
    ${"9999-12-31T23:59:59.999999999Z"} | ${"the last instant of 9999-12-31"}
  `(
    "returns null for $value — a double near serial 2958465 rounds it past Excel's last serial ($reason)",
    ({ value }) => {
      expect(toExcelSerial(value)).toBeNull();
    },
  );

  it("never returns a serial Excel would reject", () => {
    // The range check is made on the rounded double, so a non-null result is always < 2958466.
    for (const value of [
      "9999-12-31T23:59:59.999Z",
      "9999-12-31T23:59:59.99997Z",
      "9999-12-31T23:59:59.999979883Z",
    ]) {
      expect(toExcelSerial(value)).toBeLessThan(2958466);
    }
  });

  it("never produces serial 60 — Excel's phantom 29 February 1900", () => {
    expect(toExcelSerial("1900-02-28T23:59:59.999Z")).toBeLessThan(60);
    expect(toExcelSerial("1900-03-01T00:00:00Z")).toBe(61);
  });

  it.each(sameInstantBattleCases)(
    "returns the same serial for 2024-02-29T00:00:00Z expressed in $timeZone",
    ({ value }) => {
      expect(toExcelSerial(value)).toBe(45351);
    },
  );

  it.each`
    value                        | reason
    ${"1899-12-31T00:00:00Z"}    | ${"serial 0, which Excel renders as January 0 rather than a date"}
    ${"1899-12-30T00:00:00Z"}    | ${"before the 1900 system's first serial"}
    ${"1066-10-14T00:00:00Z"}    | ${"centuries before Excel's range"}
    ${"+010000-01-01T00:00:00Z"} | ${"one day past Excel's last serial"}
    ${"+275760-09-13T00:00:00Z"} | ${"the largest representable instant"}
  `(
    "returns null for $value in the 1900 system, which Excel cannot name ($reason)",
    ({ value }) => {
      expect(toExcelSerial(value)).toBeNull();
    },
  );

  it.each`
    value                        | reason
    ${"1903-12-31T00:00:00Z"}    | ${"before the 1904 system's first serial"}
    ${"1900-01-01T00:00:00Z"}    | ${"inside the 1900 system's range but negative in the 1904 system"}
    ${"+010000-01-01T00:00:00Z"} | ${"one day past the 1904 system's last serial"}
  `(
    "returns null for $value in the 1904 system, which Excel cannot name ($reason)",
    ({ value }) => {
      expect(toExcelSerial(value, { system: "1904" })).toBeNull();
    },
  );

  it.each`
    system    | reason
    ${"1899"} | ${"not a date system Excel has"}
    ${1900}   | ${"number, not the string literal"}
    ${1904}   | ${"number, not the string literal"}
    ${""}     | ${"empty string"}
    ${true}   | ${"boolean"}
  `("returns null when system $system is invalid ($reason)", ({ system }) => {
    expect(
      toExcelSerial("2024-03-10T12:00:00Z", {
        system: system as unknown as "1900",
      }),
    ).toBeNull();
  });

  it.each`
    options                  | reason
    ${undefined}             | ${"no options argument"}
    ${{}}                    | ${"empty options object"}
    ${{ system: undefined }} | ${"system explicitly undefined"}
    ${{ system: null }}      | ${"system explicitly null"}
  `(
    "falls back to the 1900 system when options is $options ($reason)",
    ({ options }) => {
      expect(toExcelSerial("2024-03-10T12:00:00Z", options)).toBe(45361.5);
    },
  );

  it.each`
    value                                       | reason
    ${"2024-03-10"}                             | ${"date-only, no offset"}
    ${"2024-03-10T12:00:00"}                    | ${"no offset designator"}
    ${"2024-02-30T12:00:00Z"}                   | ${"day out of range"}
    ${"2016-12-31T23:59:60Z"}                   | ${"leap second"}
    ${"2016-12-31 23:59:60Z"}                   | ${"leap second, space separator"}
    ${"2024-03-10T12:00:00-05:00[u-ca=hebrew]"} | ${"calendar annotation"}
    ${"invalid"}                                | ${"unparseable"}
    ${""}                                       | ${"empty string"}
  `("returns null when $value is invalid ($reason)", ({ value }) => {
    expect(toExcelSerial(value)).toBeNull();
  });

  it.each`
    value
    ${null}
    ${undefined}
    ${123}
    ${0n}
    ${true}
    ${[]}
    ${{}}
  `("returns null when $value is non-string input", ({ value }) => {
    expect(toExcelSerial(value as unknown as string)).toBeNull();
  });

  it("returns null when Temporal.Instant.from throws", () => {
    mockTemporalInstantFromThrow();

    expect(toExcelSerial("2024-03-10T12:00:00Z")).toBeNull();
  });
});
