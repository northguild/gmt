import { battleTestTimeZones } from "../../test";
import { parseTimeZoneFromZoned } from "../../zoned/parse";
import { convertUnixToZoned } from "./convertUnixToZoned";

describe("convertUnixToZoned", () => {
  it("defaults to milliseconds when unit is not provided", () => {
    expect(convertUnixToZoned(0, "UTC")).toBe("1970-01-01T00:00:00+00:00[UTC]");
  });

  it('supports "milliseconds" and "seconds" units', () => {
    expect(convertUnixToZoned(0, "UTC", "milliseconds")).toBe(
      "1970-01-01T00:00:00+00:00[UTC]",
    );
    expect(convertUnixToZoned(0, "UTC", "seconds")).toBe(
      "1970-01-01T00:00:00+00:00[UTC]",
    );
  });

  it.each`
    timeZone                 | unit              | expected
    ${"UTC"}                 | ${"milliseconds"} | ${"1970-01-01T00:00:00+00:00[UTC]"}
    ${"UTC"}                 | ${"seconds"}      | ${"1970-01-01T00:00:00+00:00[UTC]"}
    ${"GMT"}                 | ${"milliseconds"} | ${"1970-01-01T00:00:00+00:00[GMT]"}
    ${"GMT"}                 | ${"seconds"}      | ${"1970-01-01T00:00:00+00:00[GMT]"}
    ${"Etc/GMT"}             | ${"milliseconds"} | ${"1970-01-01T00:00:00+00:00[Etc/GMT]"}
    ${"Etc/GMT"}             | ${"seconds"}      | ${"1970-01-01T00:00:00+00:00[Etc/GMT]"}
    ${"Europe/Lisbon"}       | ${"milliseconds"} | ${"1970-01-01T01:00:00+01:00[Europe/Lisbon]"}
    ${"Europe/Lisbon"}       | ${"seconds"}      | ${"1970-01-01T01:00:00+01:00[Europe/Lisbon]"}
    ${"Europe/Dublin"}       | ${"milliseconds"} | ${"1970-01-01T01:00:00+01:00[Europe/Dublin]"}
    ${"Europe/Dublin"}       | ${"seconds"}      | ${"1970-01-01T01:00:00+01:00[Europe/Dublin]"}
    ${"Europe/Berlin"}       | ${"milliseconds"} | ${"1970-01-01T01:00:00+01:00[Europe/Berlin]"}
    ${"Europe/Berlin"}       | ${"seconds"}      | ${"1970-01-01T01:00:00+01:00[Europe/Berlin]"}
    ${"Europe/Helsinki"}     | ${"milliseconds"} | ${"1970-01-01T02:00:00+02:00[Europe/Helsinki]"}
    ${"Europe/Helsinki"}     | ${"seconds"}      | ${"1970-01-01T02:00:00+02:00[Europe/Helsinki]"}
    ${"Europe/Istanbul"}     | ${"milliseconds"} | ${"1970-01-01T02:00:00+02:00[Europe/Istanbul]"}
    ${"Europe/Istanbul"}     | ${"seconds"}      | ${"1970-01-01T02:00:00+02:00[Europe/Istanbul]"}
    ${"Asia/Kolkata"}        | ${"milliseconds"} | ${"1970-01-01T05:30:00+05:30[Asia/Kolkata]"}
    ${"Asia/Kolkata"}        | ${"seconds"}      | ${"1970-01-01T05:30:00+05:30[Asia/Kolkata]"}
    ${"Asia/Kathmandu"}      | ${"milliseconds"} | ${"1970-01-01T05:30:00+05:30[Asia/Kathmandu]"}
    ${"Asia/Kathmandu"}      | ${"seconds"}      | ${"1970-01-01T05:30:00+05:30[Asia/Kathmandu]"}
    ${"Asia/Shanghai"}       | ${"milliseconds"} | ${"1970-01-01T08:00:00+08:00[Asia/Shanghai]"}
    ${"Asia/Shanghai"}       | ${"seconds"}      | ${"1970-01-01T08:00:00+08:00[Asia/Shanghai]"}
    ${"Australia/Lord_Howe"} | ${"milliseconds"} | ${"1970-01-01T10:00:00+10:00[Australia/Lord_Howe]"}
    ${"Australia/Lord_Howe"} | ${"seconds"}      | ${"1970-01-01T10:00:00+10:00[Australia/Lord_Howe]"}
    ${"Pacific/Chatham"}     | ${"milliseconds"} | ${"1970-01-01T12:45:00+12:45[Pacific/Chatham]"}
    ${"Pacific/Chatham"}     | ${"seconds"}      | ${"1970-01-01T12:45:00+12:45[Pacific/Chatham]"}
    ${"Pacific/Apia"}        | ${"milliseconds"} | ${"1969-12-31T13:00:00-11:00[Pacific/Apia]"}
    ${"Pacific/Apia"}        | ${"seconds"}      | ${"1969-12-31T13:00:00-11:00[Pacific/Apia]"}
    ${"Pacific/Niue"}        | ${"milliseconds"} | ${"1969-12-31T13:00:00-11:00[Pacific/Niue]"}
    ${"Pacific/Niue"}        | ${"seconds"}      | ${"1969-12-31T13:00:00-11:00[Pacific/Niue]"}
    ${"America/New_York"}    | ${"milliseconds"} | ${"1969-12-31T19:00:00-05:00[America/New_York]"}
    ${"America/New_York"}    | ${"seconds"}      | ${"1969-12-31T19:00:00-05:00[America/New_York]"}
    ${"America/Chicago"}     | ${"milliseconds"} | ${"1969-12-31T18:00:00-06:00[America/Chicago]"}
    ${"America/Chicago"}     | ${"seconds"}      | ${"1969-12-31T18:00:00-06:00[America/Chicago]"}
    ${"America/Phoenix"}     | ${"milliseconds"} | ${"1969-12-31T17:00:00-07:00[America/Phoenix]"}
    ${"America/Phoenix"}     | ${"seconds"}      | ${"1969-12-31T17:00:00-07:00[America/Phoenix]"}
  `(
    "returns $expected for 0 unix time in $timeZone using $unit",
    ({ timeZone, unit, expected }) => {
      expect(convertUnixToZoned(0, timeZone, unit)).toBe(expected);
    },
  );

  it.each`
    timeZone                 | unit              | expected
    ${"UTC"}                 | ${"milliseconds"} | ${"2024-02-29T09:00:00+00:00[UTC]"}
    ${"UTC"}                 | ${"seconds"}      | ${"2024-02-29T09:00:00+00:00[UTC]"}
    ${"GMT"}                 | ${"milliseconds"} | ${"2024-02-29T09:00:00+00:00[GMT]"}
    ${"GMT"}                 | ${"seconds"}      | ${"2024-02-29T09:00:00+00:00[GMT]"}
    ${"Etc/GMT"}             | ${"milliseconds"} | ${"2024-02-29T09:00:00+00:00[Etc/GMT]"}
    ${"Etc/GMT"}             | ${"seconds"}      | ${"2024-02-29T09:00:00+00:00[Etc/GMT]"}
    ${"Europe/Lisbon"}       | ${"milliseconds"} | ${"2024-02-29T09:00:00+00:00[Europe/Lisbon]"}
    ${"Europe/Lisbon"}       | ${"seconds"}      | ${"2024-02-29T09:00:00+00:00[Europe/Lisbon]"}
    ${"Europe/Dublin"}       | ${"milliseconds"} | ${"2024-02-29T09:00:00+00:00[Europe/Dublin]"}
    ${"Europe/Dublin"}       | ${"seconds"}      | ${"2024-02-29T09:00:00+00:00[Europe/Dublin]"}
    ${"Europe/Berlin"}       | ${"milliseconds"} | ${"2024-02-29T10:00:00+01:00[Europe/Berlin]"}
    ${"Europe/Berlin"}       | ${"seconds"}      | ${"2024-02-29T10:00:00+01:00[Europe/Berlin]"}
    ${"Europe/Helsinki"}     | ${"milliseconds"} | ${"2024-02-29T11:00:00+02:00[Europe/Helsinki]"}
    ${"Europe/Helsinki"}     | ${"seconds"}      | ${"2024-02-29T11:00:00+02:00[Europe/Helsinki]"}
    ${"Europe/Istanbul"}     | ${"milliseconds"} | ${"2024-02-29T12:00:00+03:00[Europe/Istanbul]"}
    ${"Europe/Istanbul"}     | ${"seconds"}      | ${"2024-02-29T12:00:00+03:00[Europe/Istanbul]"}
    ${"Asia/Kolkata"}        | ${"milliseconds"} | ${"2024-02-29T14:30:00+05:30[Asia/Kolkata]"}
    ${"Asia/Kolkata"}        | ${"seconds"}      | ${"2024-02-29T14:30:00+05:30[Asia/Kolkata]"}
    ${"Asia/Kathmandu"}      | ${"milliseconds"} | ${"2024-02-29T14:45:00+05:45[Asia/Kathmandu]"}
    ${"Asia/Kathmandu"}      | ${"seconds"}      | ${"2024-02-29T14:45:00+05:45[Asia/Kathmandu]"}
    ${"Asia/Shanghai"}       | ${"milliseconds"} | ${"2024-02-29T17:00:00+08:00[Asia/Shanghai]"}
    ${"Asia/Shanghai"}       | ${"seconds"}      | ${"2024-02-29T17:00:00+08:00[Asia/Shanghai]"}
    ${"Australia/Lord_Howe"} | ${"milliseconds"} | ${"2024-02-29T20:00:00+11:00[Australia/Lord_Howe]"}
    ${"Australia/Lord_Howe"} | ${"seconds"}      | ${"2024-02-29T20:00:00+11:00[Australia/Lord_Howe]"}
    ${"Pacific/Chatham"}     | ${"milliseconds"} | ${"2024-02-29T22:45:00+13:45[Pacific/Chatham]"}
    ${"Pacific/Chatham"}     | ${"seconds"}      | ${"2024-02-29T22:45:00+13:45[Pacific/Chatham]"}
    ${"Pacific/Apia"}        | ${"milliseconds"} | ${"2024-02-29T22:00:00+13:00[Pacific/Apia]"}
    ${"Pacific/Apia"}        | ${"seconds"}      | ${"2024-02-29T22:00:00+13:00[Pacific/Apia]"}
    ${"Pacific/Niue"}        | ${"milliseconds"} | ${"2024-02-28T22:00:00-11:00[Pacific/Niue]"}
    ${"Pacific/Niue"}        | ${"seconds"}      | ${"2024-02-28T22:00:00-11:00[Pacific/Niue]"}
    ${"America/New_York"}    | ${"milliseconds"} | ${"2024-02-29T04:00:00-05:00[America/New_York]"}
    ${"America/New_York"}    | ${"seconds"}      | ${"2024-02-29T04:00:00-05:00[America/New_York]"}
    ${"America/Chicago"}     | ${"milliseconds"} | ${"2024-02-29T03:00:00-06:00[America/Chicago]"}
    ${"America/Chicago"}     | ${"seconds"}      | ${"2024-02-29T03:00:00-06:00[America/Chicago]"}
    ${"America/Phoenix"}     | ${"milliseconds"} | ${"2024-02-29T02:00:00-07:00[America/Phoenix]"}
    ${"America/Phoenix"}     | ${"seconds"}      | ${"2024-02-29T02:00:00-07:00[America/Phoenix]"}
  `(
    "returns $expected leap year date 2024-02-29 correctly for $timeZone using $unit",
    ({ timeZone, unit, expected }) => {
      if (unit === "seconds") {
        expect(convertUnixToZoned(1709197200, timeZone, unit)).toBe(expected);
      } else {
        expect(convertUnixToZoned(1709197200000, timeZone, unit)).toBe(
          expected,
        );
      }
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
      expect(convertUnixToZoned(invalidValue as never, "UTC")).toBe("");
    },
  );

  it.each`
    invalidTimeZone
    ${"Mars/Olympus"}
    ${""}
    ${null}
    ${undefined}
  `(
    "returns an empty string for invalid timeZone $invalidTimeZone",
    ({ invalidTimeZone }) => {
      expect(convertUnixToZoned(0, invalidTimeZone as never)).toBe("");
    },
  );

  it.each`
    invalidUnit
    ${"minutes"}
    ${""}
    ${null}
    ${undefined}
  `(
    "returns an empty string for invalid unit $invalidUnit",
    ({ invalidUnit }) => {
      expect(convertUnixToZoned(0, "UTC", invalidUnit as never)).toBe("");
    },
  );

  for (const timeZone of battleTestTimeZones) {
    it(`returns a zoned datetime in battle-test timeZone ${timeZone}`, () => {
      const value = convertUnixToZoned(1709217045000, timeZone);
      expect(parseTimeZoneFromZoned(value)).toBe(timeZone);
    });
  }
});
