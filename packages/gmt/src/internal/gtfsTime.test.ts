import { readGtfsTime, readGtfsTimeFields, writeGtfsTime } from "./gtfsTime";

describe("readGtfsTime", () => {
  it.each`
    value          | expected
    ${"25:35:00"}  | ${{ seconds: 5700, dayOverflow: 1 }}
    ${"8:05:00"}   | ${{ seconds: 29100, dayOverflow: 0 }}
    ${"24:00:00"}  | ${{ seconds: 0, dayOverflow: 1 }}
    ${"110:29:00"} | ${{ seconds: 52140, dayOverflow: 4 }}
    ${"999:59:59"} | ${{ seconds: 57599, dayOverflow: 41 }}
  `(
    "reads '$value' as a time of day and the days past",
    ({ value, expected }) => {
      expect(readGtfsTime(value)).toEqual(expected);
    },
  );

  it.each`
    value
    ${"25:60:00"}
    ${"25:35:60"}
    ${"1000:00:00"}
    ${" 25:35:00"}
    ${""}
  `("returns null for '$value'", ({ value }) => {
    expect(readGtfsTime(value)).toBeNull();
  });

  it("returns null for a value that is not a string", () => {
    expect(readGtfsTime(42 as unknown as string)).toBeNull();
  });
});

describe("readGtfsTimeFields", () => {
  it.each`
    value          | expected
    ${"25:35:00"}  | ${{ hours: 25, minutes: 35, seconds: 0 }}
    ${"8:05:00"}   | ${{ hours: 8, minutes: 5, seconds: 0 }}
    ${"25:60:00"}  | ${{ hours: 25, minutes: 60, seconds: 0 }}
    ${"99:99:99"}  | ${{ hours: 99, minutes: 99, seconds: 99 }}
    ${"110:29:00"} | ${{ hours: 110, minutes: 29, seconds: 0 }}
    ${"125:00:00"} | ${{ hours: 125, minutes: 0, seconds: 0 }}
  `(
    "reads the shape of '$value' without checking the range",
    ({ value, expected }) => {
      expect(readGtfsTimeFields(value)).toEqual(expected);
    },
  );

  it.each`
    value
    ${"25:35:00\n"}
    ${"1000:00:00"}
    ${"25:5:00"}
    ${""}
  `("returns null for the wrong shape '$value'", ({ value }) => {
    expect(readGtfsTimeFields(value)).toBeNull();
  });
});

describe("writeGtfsTime", () => {
  it.each`
    hours  | minutes | seconds | expected
    ${8}   | ${5}    | ${0}    | ${"08:05:00"}
    ${99}  | ${59}   | ${59}   | ${"99:59:59"}
    ${25}  | ${35}   | ${0}    | ${"25:35:00"}
    ${110} | ${29}   | ${0}    | ${"110:29:00"}
  `(
    "writes $hours, $minutes, $seconds as $expected",
    ({ hours, minutes, seconds, expected }) => {
      expect(writeGtfsTime(hours, minutes, seconds)).toBe(expected);
    },
  );
});
