import { mockTemporalPlainMonthDayFromThrow } from "../../test/mocks";
import { isValidMonthDay } from "../validate";
import { parseMonthDay } from "./parseMonthDay";

const VALID: string[] = [
  "--12-25",
  "12-25",
  "--02-29",
  "--01-31",
  "--04-30",
  "--12-01",
  "--12-25[u-ca=iso8601]",
  "--12-25[u-ca=ISO8601]",
  "--12-25[!u-ca=Iso8601]",
  "--12-25[u-ca=iso8601][u-ca=gregory]",
  "--12-25[_foo=bar]",
  "--12-25[Europe/Paris]",
  "--12-25[+01:00]",
  "11-18[+01:00][u-ca=ISO8601]",
  "--12-25[!Europe/Paris]",
  "--12-25[foo=bar]",
];

const INVALID: string[] = [
  "--02-30",
  "--02-31",
  "--04-31",
  "--06-31",
  "--09-31",
  "--11-31",
  "--00-10",
  "--13-01",
  "--12-00",
  "--12-32",
  "--1225",
  "1225",
  "--12",
  "12",
  "2024-12-25",
  "2024-12",
  "--12-25T10:00",
  "--12-25Z",
  "--12-25+01:00",
  "--12-25[u-ca=gregory]",
  "--12-25[u-ca=hebrew]",
  "--12-25[U-CA=iso8601]",
  "--12-25[!foo=bar]",
  "--12-25[!u-ca=iso8601][u-ca=gregory]",
  "--12-25[u-ca=GREGORY][u-ca=ISO8601]",
  " --12-25",
  "--12-25 ",
  "−−12-25",
  "--１２-２５",
  "",
];

describe("parseMonthDay", () => {
  it.each`
    value                                    | expected
    ${"--12-25"}                             | ${"--12-25"}
    ${"12-25"}                               | ${"--12-25"}
    ${"--02-29"}                             | ${"--02-29"}
    ${"--01-31"}                             | ${"--01-31"}
    ${"--04-30"}                             | ${"--04-30"}
    ${"--12-01"}                             | ${"--12-01"}
    ${"--12-25[u-ca=iso8601]"}               | ${"--12-25"}
    ${"--12-25[u-ca=ISO8601]"}               | ${"--12-25"}
    ${"--12-25[!u-ca=Iso8601]"}              | ${"--12-25"}
    ${"--12-25[u-ca=iso8601][u-ca=gregory]"} | ${"--12-25"}
    ${"--12-25[_foo=bar]"}                   | ${"--12-25"}
    ${"--12-25[Europe/Paris]"}               | ${"--12-25"}
    ${"--12-25[+01:00]"}                     | ${"--12-25"}
    ${"11-18[+01:00][u-ca=ISO8601]"}         | ${"--11-18"}
    ${"--12-25[!Europe/Paris]"}              | ${"--12-25"}
    ${"--12-25[foo=bar]"}                    | ${"--12-25"}
  `(
    "returns '$expected' for '$value'",
    ({ value, expected }: { value: string; expected: string }) => {
      expect(parseMonthDay(value)).toBe(expected);
    },
  );

  it.each(INVALID)("returns '' for the invalid month-day '%s'", (value) => {
    expect(parseMonthDay(value)).toBe("");
  });

  it.each`
    label          | value
    ${"null"}      | ${null}
    ${"undefined"} | ${undefined}
    ${"{}"}        | ${{}}
    ${"1225"}      | ${1225}
  `("returns '' for the non-string $label", ({ value }: { value: unknown }) => {
    expect(parseMonthDay(value as string)).toBe("");
  });

  it.each([...VALID, ...INVALID])(
    "agrees with isValidMonthDay for '%s'",
    (value) => {
      expect(isValidMonthDay(value)).toBe(parseMonthDay(value) !== "");
    },
  );

  it("returns '' when Temporal throws", () => {
    mockTemporalPlainMonthDayFromThrow();
    expect(parseMonthDay("--12-25")).toBe("");
  });
});
