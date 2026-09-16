import { battleTestTimeZones, MustTestDstTimeZones } from "../../test";
import { parseTimeZoneFromZoned } from "../../zoned/parse";
import { convertUnixToZoned } from "./convertUnixToZoned";

// Expected values per battle-test timeZone, verified against @js-temporal/polyfill.
const epochByZone = {
  UTC: "1970-01-01T00:00:00+00:00[UTC]",
  GMT: "1970-01-01T00:00:00+00:00[GMT]",
  "Etc/GMT": "1970-01-01T00:00:00+00:00[Etc/GMT]",
  "America/Nome": "1969-12-31T13:00:00-11:00[America/Nome]",
  "Asia/Anadyr": "1970-01-01T13:00:00+13:00[Asia/Anadyr]",
  "Europe/Lisbon": "1970-01-01T01:00:00+01:00[Europe/Lisbon]",
  "Europe/Dublin": "1970-01-01T01:00:00+01:00[Europe/Dublin]",
  "Europe/Berlin": "1970-01-01T01:00:00+01:00[Europe/Berlin]",
  "Europe/Helsinki": "1970-01-01T02:00:00+02:00[Europe/Helsinki]",
  "Europe/Istanbul": "1970-01-01T02:00:00+02:00[Europe/Istanbul]",
  "Asia/Kolkata": "1970-01-01T05:30:00+05:30[Asia/Kolkata]",
  "Asia/Kathmandu": "1970-01-01T05:30:00+05:30[Asia/Kathmandu]",
  "Asia/Shanghai": "1970-01-01T08:00:00+08:00[Asia/Shanghai]",
  "Australia/Lord_Howe": "1970-01-01T10:00:00+10:00[Australia/Lord_Howe]",
  "Pacific/Chatham": "1970-01-01T12:45:00+12:45[Pacific/Chatham]",
  "Pacific/Apia": "1969-12-31T13:00:00-11:00[Pacific/Apia]",
  "Pacific/Niue": "1969-12-31T13:00:00-11:00[Pacific/Niue]",
  "America/New_York": "1969-12-31T19:00:00-05:00[America/New_York]",
  "America/Chicago": "1969-12-31T18:00:00-06:00[America/Chicago]",
  "America/Phoenix": "1969-12-31T17:00:00-07:00[America/Phoenix]",
} satisfies Record<keyof typeof MustTestDstTimeZones, string>;

const leapDayByZone = {
  UTC: "2024-02-29T09:00:00+00:00[UTC]",
  GMT: "2024-02-29T09:00:00+00:00[GMT]",
  "Etc/GMT": "2024-02-29T09:00:00+00:00[Etc/GMT]",
  "America/Nome": "2024-02-29T00:00:00-09:00[America/Nome]",
  "Asia/Anadyr": "2024-02-29T21:00:00+12:00[Asia/Anadyr]",
  "Europe/Lisbon": "2024-02-29T09:00:00+00:00[Europe/Lisbon]",
  "Europe/Dublin": "2024-02-29T09:00:00+00:00[Europe/Dublin]",
  "Europe/Berlin": "2024-02-29T10:00:00+01:00[Europe/Berlin]",
  "Europe/Helsinki": "2024-02-29T11:00:00+02:00[Europe/Helsinki]",
  "Europe/Istanbul": "2024-02-29T12:00:00+03:00[Europe/Istanbul]",
  "Asia/Kolkata": "2024-02-29T14:30:00+05:30[Asia/Kolkata]",
  "Asia/Kathmandu": "2024-02-29T14:45:00+05:45[Asia/Kathmandu]",
  "Asia/Shanghai": "2024-02-29T17:00:00+08:00[Asia/Shanghai]",
  "Australia/Lord_Howe": "2024-02-29T20:00:00+11:00[Australia/Lord_Howe]",
  "Pacific/Chatham": "2024-02-29T22:45:00+13:45[Pacific/Chatham]",
  "Pacific/Apia": "2024-02-29T22:00:00+13:00[Pacific/Apia]",
  "Pacific/Niue": "2024-02-28T22:00:00-11:00[Pacific/Niue]",
  "America/New_York": "2024-02-29T04:00:00-05:00[America/New_York]",
  "America/Chicago": "2024-02-29T03:00:00-06:00[America/Chicago]",
  "America/Phoenix": "2024-02-29T02:00:00-07:00[America/Phoenix]",
} satisfies Record<keyof typeof MustTestDstTimeZones, string>;

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

  it.each(
    battleTestTimeZones.flatMap((timeZone) =>
      (["milliseconds", "seconds"] as const).map((unit) => ({
        timeZone,
        unit,
        expected: epochByZone[timeZone],
      })),
    ),
  )(
    "returns $expected for 0 unix time in $timeZone using $unit",
    ({ timeZone, unit, expected }) => {
      expect(convertUnixToZoned(0, timeZone, unit)).toBe(expected);
    },
  );

  it.each(
    battleTestTimeZones.flatMap((timeZone) =>
      (["milliseconds", "seconds"] as const).map((unit) => ({
        timeZone,
        unit,
        expected: leapDayByZone[timeZone],
      })),
    ),
  )(
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

describe("convertUnixToZoned invalid-input @example", () => {
  it('returns "" for convertUnixToZoned(NaN, "UTC")', () => {
    expect(convertUnixToZoned(NaN, "UTC")).toBe("");
  });
});
