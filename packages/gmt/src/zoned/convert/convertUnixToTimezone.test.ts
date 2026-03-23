import { parseZonedTimezone } from "../parse";
import { battleTestTimeZones } from "../test/timezoneFixtures";
import { convertUnixToTimezone } from "./convertUnixToTimezone";

describe("convertUnixToTimezone", () => {
  it.each`
    value | timeZone                 | unit              | expected
    ${0}  | ${"UTC"}                 | ${"milliseconds"} | ${"1970-01-01T00:00:00+00:00[UTC]"}
    ${0}  | ${"UTC"}                 | ${"seconds"}      | ${"1970-01-01T00:00:00+00:00[UTC]"}
    ${0}  | ${"GMT"}                 | ${"milliseconds"} | ${"1970-01-01T00:00:00+00:00[GMT]"}
    ${0}  | ${"GMT"}                 | ${"seconds"}      | ${"1970-01-01T00:00:00+00:00[GMT]"}
    ${0}  | ${"Etc/GMT"}             | ${"milliseconds"} | ${"1970-01-01T00:00:00+00:00[Etc/GMT]"}
    ${0}  | ${"Etc/GMT"}             | ${"seconds"}      | ${"1970-01-01T00:00:00+00:00[Etc/GMT]"}
    ${0}  | ${"Europe/Lisbon"}       | ${"milliseconds"} | ${"1970-01-01T01:00:00+01:00[Europe/Lisbon]"}
    ${0}  | ${"Europe/Lisbon"}       | ${"seconds"}      | ${"1970-01-01T01:00:00+01:00[Europe/Lisbon]"}
    ${0}  | ${"Europe/Dublin"}       | ${"milliseconds"} | ${"1970-01-01T01:00:00+01:00[Europe/Dublin]"}
    ${0}  | ${"Europe/Dublin"}       | ${"seconds"}      | ${"1970-01-01T01:00:00+01:00[Europe/Dublin]"}
    ${0}  | ${"Europe/Berlin"}       | ${"milliseconds"} | ${"1970-01-01T01:00:00+01:00[Europe/Berlin]"}
    ${0}  | ${"Europe/Berlin"}       | ${"seconds"}      | ${"1970-01-01T01:00:00+01:00[Europe/Berlin]"}
    ${0}  | ${"Europe/Helsinki"}     | ${"milliseconds"} | ${"1970-01-01T02:00:00+02:00[Europe/Helsinki]"}
    ${0}  | ${"Europe/Helsinki"}     | ${"seconds"}      | ${"1970-01-01T02:00:00+02:00[Europe/Helsinki]"}
    ${0}  | ${"Europe/Istanbul"}     | ${"milliseconds"} | ${"1970-01-01T02:00:00+02:00[Europe/Istanbul]"}
    ${0}  | ${"Europe/Istanbul"}     | ${"seconds"}      | ${"1970-01-01T02:00:00+02:00[Europe/Istanbul]"}
    ${0}  | ${"Asia/Kolkata"}        | ${"milliseconds"} | ${"1970-01-01T05:30:00+05:30[Asia/Kolkata]"}
    ${0}  | ${"Asia/Kolkata"}        | ${"seconds"}      | ${"1970-01-01T05:30:00+05:30[Asia/Kolkata]"}
    ${0}  | ${"Asia/Kathmandu"}      | ${"milliseconds"} | ${"1970-01-01T05:30:00+05:30[Asia/Kathmandu]"}
    ${0}  | ${"Asia/Kathmandu"}      | ${"seconds"}      | ${"1970-01-01T05:30:00+05:30[Asia/Kathmandu]"}
    ${0}  | ${"Asia/Shanghai"}       | ${"milliseconds"} | ${"1970-01-01T08:00:00+08:00[Asia/Shanghai]"}
    ${0}  | ${"Asia/Shanghai"}       | ${"seconds"}      | ${"1970-01-01T08:00:00+08:00[Asia/Shanghai]"}
    ${0}  | ${"Australia/Lord_Howe"} | ${"milliseconds"} | ${"1970-01-01T10:00:00+10:00[Australia/Lord_Howe]"}
    ${0}  | ${"Australia/Lord_Howe"} | ${"seconds"}      | ${"1970-01-01T10:00:00+10:00[Australia/Lord_Howe]"}
    ${0}  | ${"Pacific/Chatham"}     | ${"milliseconds"} | ${"1970-01-01T12:45:00+12:45[Pacific/Chatham]"}
    ${0}  | ${"Pacific/Chatham"}     | ${"seconds"}      | ${"1970-01-01T12:45:00+12:45[Pacific/Chatham]"}
    ${0}  | ${"Pacific/Apia"}        | ${"milliseconds"} | ${"1969-12-31T13:00:00-11:00[Pacific/Apia]"}
    ${0}  | ${"Pacific/Apia"}        | ${"seconds"}      | ${"1969-12-31T13:00:00-11:00[Pacific/Apia]"}
    ${0}  | ${"Pacific/Niue"}        | ${"milliseconds"} | ${"1969-12-31T13:00:00-11:00[Pacific/Niue]"}
    ${0}  | ${"Pacific/Niue"}        | ${"seconds"}      | ${"1969-12-31T13:00:00-11:00[Pacific/Niue]"}
    ${0}  | ${"America/New_York"}    | ${"milliseconds"} | ${"1969-12-31T19:00:00-05:00[America/New_York]"}
    ${0}  | ${"America/New_York"}    | ${"seconds"}      | ${"1969-12-31T19:00:00-05:00[America/New_York]"}
    ${0}  | ${"America/Chicago"}     | ${"milliseconds"} | ${"1969-12-31T18:00:00-06:00[America/Chicago]"}
    ${0}  | ${"America/Chicago"}     | ${"seconds"}      | ${"1969-12-31T18:00:00-06:00[America/Chicago]"}
    ${0}  | ${"America/Phoenix"}     | ${"milliseconds"} | ${"1969-12-31T17:00:00-07:00[America/Phoenix]"}
    ${0}  | ${"America/Phoenix"}     | ${"seconds"}      | ${"1969-12-31T17:00:00-07:00[America/Phoenix]"}
  `(
    "returns $expected for $value in $timeZone using $unit",
    ({ value, timeZone, unit, expected }) => {
      expect(convertUnixToTimezone(value, timeZone, unit)).toBe(expected);
    },
  );

  it.each`
    value            | timeZone                 | unit              | expected
    ${1709197200000} | ${"UTC"}                 | ${"milliseconds"} | ${"2024-02-29T09:00:00+00:00[UTC]"}
    ${1709197200}    | ${"UTC"}                 | ${"seconds"}      | ${"2024-02-29T09:00:00+00:00[UTC]"}
    ${1709197200000} | ${"GMT"}                 | ${"milliseconds"} | ${"2024-02-29T09:00:00+00:00[GMT]"}
    ${1709197200}    | ${"GMT"}                 | ${"seconds"}      | ${"2024-02-29T09:00:00+00:00[GMT]"}
    ${1709197200000} | ${"Etc/GMT"}             | ${"milliseconds"} | ${"2024-02-29T09:00:00+00:00[Etc/GMT]"}
    ${1709197200}    | ${"Etc/GMT"}             | ${"seconds"}      | ${"2024-02-29T09:00:00+00:00[Etc/GMT]"}
    ${1709197200000} | ${"Europe/Lisbon"}       | ${"milliseconds"} | ${"2024-02-29T09:00:00+00:00[Europe/Lisbon]"}
    ${1709197200}    | ${"Europe/Lisbon"}       | ${"seconds"}      | ${"2024-02-29T09:00:00+00:00[Europe/Lisbon]"}
    ${1709197200000} | ${"Europe/Dublin"}       | ${"milliseconds"} | ${"2024-02-29T09:00:00+00:00[Europe/Dublin]"}
    ${1709197200}    | ${"Europe/Dublin"}       | ${"seconds"}      | ${"2024-02-29T09:00:00+00:00[Europe/Dublin]"}
    ${1709197200000} | ${"Europe/Berlin"}       | ${"milliseconds"} | ${"2024-02-29T10:00:00+01:00[Europe/Berlin]"}
    ${1709197200}    | ${"Europe/Berlin"}       | ${"seconds"}      | ${"2024-02-29T10:00:00+01:00[Europe/Berlin]"}
    ${1709197200000} | ${"Europe/Helsinki"}     | ${"milliseconds"} | ${"2024-02-29T11:00:00+02:00[Europe/Helsinki]"}
    ${1709197200}    | ${"Europe/Helsinki"}     | ${"seconds"}      | ${"2024-02-29T11:00:00+02:00[Europe/Helsinki]"}
    ${1709197200000} | ${"Europe/Istanbul"}     | ${"milliseconds"} | ${"2024-02-29T12:00:00+03:00[Europe/Istanbul]"}
    ${1709197200}    | ${"Europe/Istanbul"}     | ${"seconds"}      | ${"2024-02-29T12:00:00+03:00[Europe/Istanbul]"}
    ${1709197200000} | ${"Asia/Kolkata"}        | ${"milliseconds"} | ${"2024-02-29T14:30:00+05:30[Asia/Kolkata]"}
    ${1709197200}    | ${"Asia/Kolkata"}        | ${"seconds"}      | ${"2024-02-29T14:30:00+05:30[Asia/Kolkata]"}
    ${1709197200000} | ${"Asia/Kathmandu"}      | ${"milliseconds"} | ${"2024-02-29T14:45:00+05:45[Asia/Kathmandu]"}
    ${1709197200}    | ${"Asia/Kathmandu"}      | ${"seconds"}      | ${"2024-02-29T14:45:00+05:45[Asia/Kathmandu]"}
    ${1709197200000} | ${"Asia/Shanghai"}       | ${"milliseconds"} | ${"2024-02-29T17:00:00+08:00[Asia/Shanghai]"}
    ${1709197200}    | ${"Asia/Shanghai"}       | ${"seconds"}      | ${"2024-02-29T17:00:00+08:00[Asia/Shanghai]"}
    ${1709197200000} | ${"Australia/Lord_Howe"} | ${"milliseconds"} | ${"2024-02-29T20:00:00+11:00[Australia/Lord_Howe]"}
    ${1709197200}    | ${"Australia/Lord_Howe"} | ${"seconds"}      | ${"2024-02-29T20:00:00+11:00[Australia/Lord_Howe]"}
    ${1709197200000} | ${"Pacific/Chatham"}     | ${"milliseconds"} | ${"2024-02-29T22:45:00+13:45[Pacific/Chatham]"}
    ${1709197200}    | ${"Pacific/Chatham"}     | ${"seconds"}      | ${"2024-02-29T22:45:00+13:45[Pacific/Chatham]"}
    ${1709197200000} | ${"Pacific/Apia"}        | ${"milliseconds"} | ${"2024-02-29T22:00:00+13:00[Pacific/Apia]"}
    ${1709197200}    | ${"Pacific/Apia"}        | ${"seconds"}      | ${"2024-02-29T22:00:00+13:00[Pacific/Apia]"}
    ${1709197200000} | ${"Pacific/Niue"}        | ${"milliseconds"} | ${"2024-02-28T22:00:00-11:00[Pacific/Niue]"}
    ${1709197200}    | ${"Pacific/Niue"}        | ${"seconds"}      | ${"2024-02-28T22:00:00-11:00[Pacific/Niue]"}
    ${1709197200000} | ${"America/New_York"}    | ${"milliseconds"} | ${"2024-02-29T04:00:00-05:00[America/New_York]"}
    ${1709197200}    | ${"America/New_York"}    | ${"seconds"}      | ${"2024-02-29T04:00:00-05:00[America/New_York]"}
    ${1709197200000} | ${"America/Chicago"}     | ${"milliseconds"} | ${"2024-02-29T03:00:00-06:00[America/Chicago]"}
    ${1709197200}    | ${"America/Chicago"}     | ${"seconds"}      | ${"2024-02-29T03:00:00-06:00[America/Chicago]"}
    ${1709197200000} | ${"America/Phoenix"}     | ${"milliseconds"} | ${"2024-02-29T02:00:00-07:00[America/Phoenix]"}
    ${1709197200}    | ${"America/Phoenix"}     | ${"seconds"}      | ${"2024-02-29T02:00:00-07:00[America/Phoenix]"}
  `(
    "returns leap-year $expected for $value in $timeZone using $unit",
    ({ value, timeZone, unit, expected }) => {
      expect(convertUnixToTimezone(value, timeZone, unit)).toBe(expected);
    },
  );

  it.each`
    invalidValue
    ${NaN}
    ${Infinity}
    ${-Infinity}
    ${null}
    ${undefined}
  `(
    "returns an empty string for invalid unix value $invalidValue",
    ({ invalidValue }) => {
      expect(convertUnixToTimezone(invalidValue as never, "UTC")).toBe("");
    },
  );

  for (const timeZone of battleTestTimeZones) {
    it(`returns a battle-test timezone result for ${timeZone}`, () => {
      expect(
        parseZonedTimezone(convertUnixToTimezone(1709217045000, timeZone)),
      ).toBe(timeZone);
    });
  }
});
