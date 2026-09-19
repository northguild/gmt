import { Temporal } from "@js-temporal/polyfill";
import {
  battleTestTimeZones,
  dateLineCrossingAt,
  dateLineCrossingTimeZones,
} from "../../test";
import { roundZoned } from "./roundZoned";

const baseInstant = Temporal.Instant.from("2024-06-15T16:34:56.789123456Z");
const baseInstantNoFrac = Temporal.Instant.from("2024-06-15T16:34:56Z");
const halfBoundaryInstant = Temporal.Instant.from("2024-06-15T16:30:00Z");
const dayBoundaryInstantLow = Temporal.Instant.from("2024-06-15T16:00:00Z");
const dayBoundaryInstantHigh = Temporal.Instant.from("2024-06-15T23:59:59Z");
const subSecondInstant = Temporal.Instant.from(
  "2024-06-15T16:34:56.123456789Z",
);
const negativeInstantLow = Temporal.Instant.from("1970-01-01T04:00:00Z");
const negativeInstantHigh = Temporal.Instant.from("1970-01-01T04:34:56Z");

const happyPathCases = battleTestTimeZones.map((timeZone) => {
  const zdt = baseInstant.toZonedDateTimeISO(timeZone);
  const zdtNoFrac = baseInstantNoFrac.toZonedDateTimeISO(timeZone);
  const value = zdt.toString();
  const valueNoFrac = zdtNoFrac.toString();

  return {
    value,
    valueNoFrac,
    timeZone,
    expected: {
      day: zdt
        .round({ smallestUnit: "day" })
        .toString({ fractionalSecondDigits: 0 }),
      hour: zdt
        .round({ smallestUnit: "hour" })
        .toString({ fractionalSecondDigits: 0 }),
      minute: zdt
        .round({ smallestUnit: "minute" })
        .toString({ fractionalSecondDigits: 0 }),
      second: zdtNoFrac
        .round({ smallestUnit: "second" })
        .toString({ fractionalSecondDigits: 0 }),
      millisecond: zdt
        .round({ smallestUnit: "millisecond" })
        .toString({ fractionalSecondDigits: 3 }),
      microsecond: zdt
        .round({ smallestUnit: "microsecond" })
        .toString({ fractionalSecondDigits: 6 }),
      nanosecond: zdt
        .round({ smallestUnit: "nanosecond" })
        .toString({ fractionalSecondDigits: 9 }),
    },
  };
});

const roundingModeCases = battleTestTimeZones.map((timeZone) => {
  const zdt = baseInstantNoFrac.toZonedDateTimeISO(timeZone);
  const zdtFrac = baseInstant.toZonedDateTimeISO(timeZone);
  const value = zdt.toString();
  const valueFrac = zdtFrac.toString();

  return {
    value,
    valueFrac,
    timeZone,
    expected: {
      hourFloor: zdt
        .round({ smallestUnit: "hour", roundingMode: "floor" })
        .toString({ fractionalSecondDigits: 0 }),
      hourCeil: zdt
        .round({ smallestUnit: "hour", roundingMode: "ceil" })
        .toString({ fractionalSecondDigits: 0 }),
      hourExpand: zdt
        .round({ smallestUnit: "hour", roundingMode: "expand" })
        .toString({ fractionalSecondDigits: 0 }),
      hourTrunc: zdt
        .round({ smallestUnit: "hour", roundingMode: "trunc" })
        .toString({ fractionalSecondDigits: 0 }),
      minuteFloor: zdt
        .round({ smallestUnit: "minute", roundingMode: "floor" })
        .toString({ fractionalSecondDigits: 0 }),
      minuteCeil: zdt
        .round({ smallestUnit: "minute", roundingMode: "ceil" })
        .toString({ fractionalSecondDigits: 0 }),
      secondFloor: zdtFrac
        .round({ smallestUnit: "second", roundingMode: "floor" })
        .toString({ fractionalSecondDigits: 0 }),
      secondCeil: zdtFrac
        .round({ smallestUnit: "second", roundingMode: "ceil" })
        .toString({ fractionalSecondDigits: 0 }),
    },
  };
});

const roundingIncrementCases = battleTestTimeZones.map((timeZone) => {
  const zdt = baseInstantNoFrac.toZonedDateTimeISO(timeZone);
  const zdtDayCross = dayBoundaryInstantHigh.toZonedDateTimeISO(timeZone);
  const value = zdt.toString();
  const valueDayCross = zdtDayCross.toString();

  return {
    value,
    valueDayCross,
    timeZone,
    expected: {
      minuteIncrement15: zdt
        .round({ smallestUnit: "minute", roundingIncrement: 15 })
        .toString({ fractionalSecondDigits: 0 }),
      minuteIncrement30: zdt
        .round({ smallestUnit: "minute", roundingIncrement: 30 })
        .toString({ fractionalSecondDigits: 0 }),
      hourIncrement2: zdt
        .round({ smallestUnit: "hour", roundingIncrement: 2 })
        .toString({ fractionalSecondDigits: 0 }),
      hourIncrement2DayCross: zdtDayCross
        .round({ smallestUnit: "hour", roundingIncrement: 2 })
        .toString({ fractionalSecondDigits: 0 }),
    },
  };
});

const halfBoundaryCases = battleTestTimeZones.map((timeZone) => {
  const zdtHalfMinute = halfBoundaryInstant.toZonedDateTimeISO(timeZone);
  const zdtSubSecond = subSecondInstant.toZonedDateTimeISO(timeZone);
  const zdtDayLow = dayBoundaryInstantLow.toZonedDateTimeISO(timeZone);
  const zdtDayHigh = dayBoundaryInstantHigh.toZonedDateTimeISO(timeZone);

  return {
    timeZone,
    valueHalfMinute: zdtHalfMinute.toString(),
    valueSubSecond: zdtSubSecond.toString(),
    valueDayLow: zdtDayLow.toString(),
    valueDayHigh: zdtDayHigh.toString(),
    expected: {
      minuteHalfExpand: zdtHalfMinute
        .round({ smallestUnit: "minute", roundingMode: "halfExpand" })
        .toString({ fractionalSecondDigits: 0 }),
      minuteHalfTrunc: zdtHalfMinute
        .round({ smallestUnit: "minute", roundingMode: "halfTrunc" })
        .toString({ fractionalSecondDigits: 0 }),
      hourHalfExpandLow: zdtDayLow
        .round({ smallestUnit: "hour", roundingMode: "halfExpand" })
        .toString({ fractionalSecondDigits: 0 }),
      hourHalfExpandHigh: zdtDayHigh
        .round({ smallestUnit: "hour", roundingMode: "halfExpand" })
        .toString({ fractionalSecondDigits: 0 }),
      millisecondHalfExpand: zdtSubSecond
        .round({ smallestUnit: "millisecond", roundingMode: "halfExpand" })
        .toString({ fractionalSecondDigits: 3 }),
      millisecondHalfCeil: zdtSubSecond
        .round({ smallestUnit: "millisecond", roundingMode: "halfCeil" })
        .toString({ fractionalSecondDigits: 3 }),
      millisecondHalfTrunc: zdtSubSecond
        .round({ smallestUnit: "millisecond", roundingMode: "halfTrunc" })
        .toString({ fractionalSecondDigits: 3 }),
      millisecondHalfFloor: zdtSubSecond
        .round({ smallestUnit: "millisecond", roundingMode: "halfFloor" })
        .toString({ fractionalSecondDigits: 3 }),
      microsecondHalfExpand: zdtSubSecond
        .round({ smallestUnit: "microsecond", roundingMode: "halfExpand" })
        .toString({ fractionalSecondDigits: 6 }),
      microsecondHalfCeil: zdtSubSecond
        .round({ smallestUnit: "microsecond", roundingMode: "halfCeil" })
        .toString({ fractionalSecondDigits: 6 }),
      microsecondHalfTrunc: zdtSubSecond
        .round({ smallestUnit: "microsecond", roundingMode: "halfTrunc" })
        .toString({ fractionalSecondDigits: 6 }),
      microsecondHalfFloor: zdtSubSecond
        .round({ smallestUnit: "microsecond", roundingMode: "halfFloor" })
        .toString({ fractionalSecondDigits: 6 }),
      microsecondHalfEven: zdtSubSecond
        .round({ smallestUnit: "microsecond", roundingMode: "halfEven" })
        .toString({ fractionalSecondDigits: 6 }),
      nanosecondHalfExpand: zdtSubSecond
        .round({ smallestUnit: "nanosecond", roundingMode: "halfExpand" })
        .toString({ fractionalSecondDigits: 9 }),
      nanosecondHalfCeil: zdtSubSecond
        .round({ smallestUnit: "nanosecond", roundingMode: "halfCeil" })
        .toString({ fractionalSecondDigits: 9 }),
      nanosecondHalfTrunc: zdtSubSecond
        .round({ smallestUnit: "nanosecond", roundingMode: "halfTrunc" })
        .toString({ fractionalSecondDigits: 9 }),
      nanosecondHalfFloor: zdtSubSecond
        .round({ smallestUnit: "nanosecond", roundingMode: "halfFloor" })
        .toString({ fractionalSecondDigits: 9 }),
      nanosecondHalfEven: zdtSubSecond
        .round({ smallestUnit: "nanosecond", roundingMode: "halfEven" })
        .toString({ fractionalSecondDigits: 9 }),
    },
  };
});

const negativeTimestampCases = battleTestTimeZones.map((timeZone) => {
  const zdtLow = negativeInstantLow.toZonedDateTimeISO(timeZone);
  const zdtHigh = negativeInstantHigh.toZonedDateTimeISO(timeZone);
  const valueLow = zdtLow.toString();
  const valueHigh = zdtHigh.toString();

  return {
    valueLow,
    valueHigh,
    timeZone,
    expectedLow: zdtLow
      .round({ smallestUnit: "hour" })
      .toString({ fractionalSecondDigits: 0 }),
    expectedHigh: zdtHigh
      .round({ smallestUnit: "hour" })
      .toString({ fractionalSecondDigits: 0 }),
  };
});

describe("roundZoned", () => {
  // happy path: all supported time units across all battle-test timeZones
  for (const { value, valueNoFrac, timeZone, expected } of happyPathCases) {
    it(`rounds ${value} (${timeZone}) to day`, () => {
      expect(roundZoned(value, { smallestUnit: "day" })).toBe(expected.day);
    });
    it(`rounds ${value} (${timeZone}) to hour`, () => {
      expect(roundZoned(value, { smallestUnit: "hour" })).toBe(expected.hour);
    });
    it(`rounds ${value} (${timeZone}) to minute`, () => {
      expect(roundZoned(value, { smallestUnit: "minute" })).toBe(
        expected.minute,
      );
    });
    it(`rounds ${valueNoFrac} (${timeZone}) to second`, () => {
      expect(roundZoned(valueNoFrac, { smallestUnit: "second" })).toBe(
        expected.second,
      );
    });
    it(`rounds ${value} (${timeZone}) to millisecond`, () => {
      expect(roundZoned(value, { smallestUnit: "millisecond" })).toBe(
        expected.millisecond,
      );
    });
    it(`rounds ${value} (${timeZone}) to microsecond`, () => {
      expect(roundZoned(value, { smallestUnit: "microsecond" })).toBe(
        expected.microsecond,
      );
    });
    it(`rounds ${value} (${timeZone}) to nanosecond`, () => {
      expect(roundZoned(value, { smallestUnit: "nanosecond" })).toBe(
        expected.nanosecond,
      );
    });
  }

  // rounding modes across all battle-test timeZones
  for (const { value, valueFrac, timeZone, expected } of roundingModeCases) {
    it(`applies floor roundingMode on hour for ${value} (${timeZone})`, () => {
      expect(
        roundZoned(value, { smallestUnit: "hour", roundingMode: "floor" }),
      ).toBe(expected.hourFloor);
    });
    it(`applies ceil roundingMode on hour for ${value} (${timeZone})`, () => {
      expect(
        roundZoned(value, { smallestUnit: "hour", roundingMode: "ceil" }),
      ).toBe(expected.hourCeil);
    });
    it(`applies expand roundingMode on hour for ${value} (${timeZone})`, () => {
      expect(
        roundZoned(value, { smallestUnit: "hour", roundingMode: "expand" }),
      ).toBe(expected.hourExpand);
    });
    it(`applies trunc roundingMode on hour for ${value} (${timeZone})`, () => {
      expect(
        roundZoned(value, { smallestUnit: "hour", roundingMode: "trunc" }),
      ).toBe(expected.hourTrunc);
    });
    it(`applies floor roundingMode on minute for ${value} (${timeZone})`, () => {
      expect(
        roundZoned(value, { smallestUnit: "minute", roundingMode: "floor" }),
      ).toBe(expected.minuteFloor);
    });
    it(`applies ceil roundingMode on minute for ${value} (${timeZone})`, () => {
      expect(
        roundZoned(value, { smallestUnit: "minute", roundingMode: "ceil" }),
      ).toBe(expected.minuteCeil);
    });
    it(`applies floor roundingMode on second for ${valueFrac} (${timeZone})`, () => {
      expect(
        roundZoned(valueFrac, {
          smallestUnit: "second",
          roundingMode: "floor",
        }),
      ).toBe(expected.secondFloor);
    });
    it(`applies ceil roundingMode on second for ${valueFrac} (${timeZone})`, () => {
      expect(
        roundZoned(valueFrac, { smallestUnit: "second", roundingMode: "ceil" }),
      ).toBe(expected.secondCeil);
    });
  }

  // rounding increments across all battle-test timeZones
  for (const {
    value,
    valueDayCross,
    timeZone,
    expected,
  } of roundingIncrementCases) {
    it(`applies roundingIncrement 15 on minute for ${value} (${timeZone})`, () => {
      expect(
        roundZoned(value, { smallestUnit: "minute", roundingIncrement: 15 }),
      ).toBe(expected.minuteIncrement15);
    });
    it(`applies roundingIncrement 30 on minute for ${value} (${timeZone})`, () => {
      expect(
        roundZoned(value, { smallestUnit: "minute", roundingIncrement: 30 }),
      ).toBe(expected.minuteIncrement30);
    });
    it(`applies roundingIncrement 2 on hour for ${value} (${timeZone})`, () => {
      expect(
        roundZoned(value, { smallestUnit: "hour", roundingIncrement: 2 }),
      ).toBe(expected.hourIncrement2);
    });
    it(`applies roundingIncrement 2 on hour crossing day boundary for ${valueDayCross} (${timeZone})`, () => {
      expect(
        roundZoned(valueDayCross, {
          smallestUnit: "hour",
          roundingIncrement: 2,
        }),
      ).toBe(expected.hourIncrement2DayCross);
    });
  }

  // zero and negative roundingIncrement return ""
  it.each`
    value                                            | unit        | roundingIncrement
    ${"2024-06-15T12:34:56-04:00[America/New_York]"} | ${"minute"} | ${0}
    ${"2024-06-15T12:34:56-04:00[America/New_York]"} | ${"hour"}   | ${-1}
  `(
    "returns empty string for $value with roundingIncrement $roundingIncrement on $unit",
    ({ value, unit, roundingIncrement }) => {
      expect(
        roundZoned(value, { smallestUnit: unit as never, roundingIncrement }),
      ).toBe("");
    },
  );

  // exact half-boundary and boundary cases across all battle-test timeZones
  for (const {
    timeZone,
    valueHalfMinute,
    valueSubSecond,
    valueDayLow,
    valueDayHigh,
    expected,
  } of halfBoundaryCases) {
    it(`returns halfExpand on minute for ${valueHalfMinute} (${timeZone})`, () => {
      expect(
        roundZoned(valueHalfMinute, {
          smallestUnit: "minute",
          roundingMode: "halfExpand",
        }),
      ).toBe(expected.minuteHalfExpand);
    });
    it(`returns halfTrunc on minute for ${valueHalfMinute} (${timeZone})`, () => {
      expect(
        roundZoned(valueHalfMinute, {
          smallestUnit: "minute",
          roundingMode: "halfTrunc",
        }),
      ).toBe(expected.minuteHalfTrunc);
    });
    it(`returns halfExpand on hour at day start for ${valueDayLow} (${timeZone})`, () => {
      expect(
        roundZoned(valueDayLow, {
          smallestUnit: "hour",
          roundingMode: "halfExpand",
        }),
      ).toBe(expected.hourHalfExpandLow);
    });
    it(`returns halfExpand on hour at day end for ${valueDayHigh} (${timeZone})`, () => {
      expect(
        roundZoned(valueDayHigh, {
          smallestUnit: "hour",
          roundingMode: "halfExpand",
        }),
      ).toBe(expected.hourHalfExpandHigh);
    });
    it(`returns halfExpand on millisecond for ${valueSubSecond} (${timeZone})`, () => {
      expect(
        roundZoned(valueSubSecond, {
          smallestUnit: "millisecond",
          roundingMode: "halfExpand",
        }),
      ).toBe(expected.millisecondHalfExpand);
    });
    it(`returns halfCeil on millisecond for ${valueSubSecond} (${timeZone})`, () => {
      expect(
        roundZoned(valueSubSecond, {
          smallestUnit: "millisecond",
          roundingMode: "halfCeil",
        }),
      ).toBe(expected.millisecondHalfCeil);
    });
    it(`returns halfTrunc on millisecond for ${valueSubSecond} (${timeZone})`, () => {
      expect(
        roundZoned(valueSubSecond, {
          smallestUnit: "millisecond",
          roundingMode: "halfTrunc",
        }),
      ).toBe(expected.millisecondHalfTrunc);
    });
    it(`returns halfFloor on millisecond for ${valueSubSecond} (${timeZone})`, () => {
      expect(
        roundZoned(valueSubSecond, {
          smallestUnit: "millisecond",
          roundingMode: "halfFloor",
        }),
      ).toBe(expected.millisecondHalfFloor);
    });
    it(`returns halfExpand on microsecond for ${valueSubSecond} (${timeZone})`, () => {
      expect(
        roundZoned(valueSubSecond, {
          smallestUnit: "microsecond",
          roundingMode: "halfExpand",
        }),
      ).toBe(expected.microsecondHalfExpand);
    });
    it(`returns halfCeil on microsecond for ${valueSubSecond} (${timeZone})`, () => {
      expect(
        roundZoned(valueSubSecond, {
          smallestUnit: "microsecond",
          roundingMode: "halfCeil",
        }),
      ).toBe(expected.microsecondHalfCeil);
    });
    it(`returns halfTrunc on microsecond for ${valueSubSecond} (${timeZone})`, () => {
      expect(
        roundZoned(valueSubSecond, {
          smallestUnit: "microsecond",
          roundingMode: "halfTrunc",
        }),
      ).toBe(expected.microsecondHalfTrunc);
    });
    it(`returns halfFloor on microsecond for ${valueSubSecond} (${timeZone})`, () => {
      expect(
        roundZoned(valueSubSecond, {
          smallestUnit: "microsecond",
          roundingMode: "halfFloor",
        }),
      ).toBe(expected.microsecondHalfFloor);
    });
    it(`returns halfEven on microsecond for ${valueSubSecond} (${timeZone})`, () => {
      expect(
        roundZoned(valueSubSecond, {
          smallestUnit: "microsecond",
          roundingMode: "halfEven",
        }),
      ).toBe(expected.microsecondHalfEven);
    });
    it(`returns halfExpand on nanosecond for ${valueSubSecond} (${timeZone})`, () => {
      expect(
        roundZoned(valueSubSecond, {
          smallestUnit: "nanosecond",
          roundingMode: "halfExpand",
        }),
      ).toBe(expected.nanosecondHalfExpand);
    });
    it(`returns halfCeil on nanosecond for ${valueSubSecond} (${timeZone})`, () => {
      expect(
        roundZoned(valueSubSecond, {
          smallestUnit: "nanosecond",
          roundingMode: "halfCeil",
        }),
      ).toBe(expected.nanosecondHalfCeil);
    });
    it(`returns halfTrunc on nanosecond for ${valueSubSecond} (${timeZone})`, () => {
      expect(
        roundZoned(valueSubSecond, {
          smallestUnit: "nanosecond",
          roundingMode: "halfTrunc",
        }),
      ).toBe(expected.nanosecondHalfTrunc);
    });
    it(`returns halfFloor on nanosecond for ${valueSubSecond} (${timeZone})`, () => {
      expect(
        roundZoned(valueSubSecond, {
          smallestUnit: "nanosecond",
          roundingMode: "halfFloor",
        }),
      ).toBe(expected.nanosecondHalfFloor);
    });
    it(`returns halfEven on nanosecond for ${valueSubSecond} (${timeZone})`, () => {
      expect(
        roundZoned(valueSubSecond, {
          smallestUnit: "nanosecond",
          roundingMode: "halfEven",
        }),
      ).toBe(expected.nanosecondHalfEven);
    });
  }

  // invalid inputs
  it.each`
    invalidValue
    ${"invalid"}
    ${""}
    ${null}
    ${undefined}
  `(
    "returns empty string for invalid value $invalidValue",
    ({ invalidValue }) => {
      expect(
        roundZoned(invalidValue as never, { smallestUnit: "hour" as never }),
      ).toBe("");
    },
  );

  it.each`
    invalidUnit
    ${"invalid-unit"}
    ${"hourss"}
    ${"Days"}
    ${""}
    ${null}
    ${undefined}
  `("returns empty string for invalid unit $invalidUnit", ({ invalidUnit }) => {
    expect(
      roundZoned("2024-06-15T12:34:56-04:00[America/New_York]", {
        smallestUnit: invalidUnit as never,
      }),
    ).toBe("");
  });

  // Temporal §13.17 GetTemporalUnitValuedOption: "Both singular and plural unit names are accepted".
  it.each`
    value                                                 | unit              | expected
    ${"2024-06-15T12:34:56-04:00[America/New_York]"}      | ${"days"}         | ${"2024-06-16T00:00:00-04:00[America/New_York]"}
    ${"2024-06-15T12:34:56-04:00[America/New_York]"}      | ${"hours"}        | ${"2024-06-15T13:00:00-04:00[America/New_York]"}
    ${"2024-06-15T12:34:56-04:00[America/New_York]"}      | ${"minutes"}      | ${"2024-06-15T12:35:00-04:00[America/New_York]"}
    ${"2024-06-15T12:34:56.5-04:00[America/New_York]"}    | ${"seconds"}      | ${"2024-06-15T12:34:57-04:00[America/New_York]"}
    ${"2024-06-15T12:34:56.1234-04:00[America/New_York]"} | ${"milliseconds"} | ${"2024-06-15T12:34:56.123-04:00[America/New_York]"}
  `(
    "returns $expected for $value rounded to the plural unit $unit",
    ({ value, unit, expected }) => {
      expect(roundZoned(value, { smallestUnit: unit })).toBe(expected);
    },
  );

  // unsupported date units (year, month, week) return ""
  it.each`
    unit
    ${"year"}
    ${"month"}
    ${"week"}
    ${"weeks"}
  `("returns empty string for unsupported date unit $unit", ({ unit }) => {
    expect(
      roundZoned("2024-06-15T12:34:56-04:00[America/New_York]", {
        smallestUnit: unit as never,
      }),
    ).toBe("");
  });

  // Pins TC39 ZonedDateTime.round: it rounds the wall clock and re-resolves, so across a
  // transition a "trunc" result can land after the input or on another local date.
  it.each`
    value                                             | smallestUnit | roundingMode | expected
    ${"2024-09-29T03:50:00+13:45[Pacific/Chatham]"}   | ${"hour"}    | ${"trunc"}   | ${"2024-09-29T04:00:00+13:45[Pacific/Chatham]"}
    ${"2010-11-06T23:30:00-04:00[America/Goose_Bay]"} | ${"hour"}    | ${"trunc"}   | ${"2010-11-06T23:00:00-03:00[America/Goose_Bay]"}
    ${"2010-11-06T23:30:00-04:00[America/Goose_Bay]"} | ${"day"}     | ${"trunc"}   | ${"2010-11-07T00:00:00-03:00[America/Goose_Bay]"}
  `(
    "follows TC39 round for $value to $smallestUnit with $roundingMode, giving $expected",
    ({ value, smallestUnit, roundingMode, expected }) => {
      expect(roundZoned(value, { smallestUnit, roundingMode })).toBe(expected);
    },
  );

  // different time zones (now covered by battleTestTimeZones loops above)

  // negative timestamps (dates before epoch) across all battle-test timeZones
  for (const {
    valueLow,
    valueHigh,
    timeZone,
    expectedLow,
    expectedHigh,
  } of negativeTimestampCases) {
    it(`returns $expectedLow for negative timestamp ${valueLow} (${timeZone}) rounded to hour`, () => {
      expect(roundZoned(valueLow, { smallestUnit: "hour" })).toBe(expectedLow);
    });
    it(`returns $expectedHigh for negative timestamp ${valueHigh} (${timeZone}) rounded to hour`, () => {
      expect(roundZoned(valueHigh, { smallestUnit: "hour" })).toBe(
        expectedHigh,
      );
    });
  }
});

describe("roundZoned at the maximum instant", () => {
  // 09:30 halfExpand to the hour is 10:00, the maximum; 0 fractional digits for "hour".
  it.each`
    value                                                 | smallestUnit | expected
    ${"+275760-09-13T09:30:00+10:00[Australia/Sydney]"}   | ${"hour"}    | ${"+275760-09-13T10:00:00+10:00[Australia/Sydney]"}
    ${"+275760-09-13T13:59:30+14:00[Pacific/Kiritimati]"} | ${"minute"}  | ${"+275760-09-13T14:00:00+14:00[Pacific/Kiritimati]"}
    ${"+275760-09-07T15:00:00-03:00[America/Santiago]"}   | ${"day"}     | ${"+275760-09-08T00:00:00-03:00[America/Santiago]"}
  `(
    "rounds $value to the $smallestUnit giving $expected",
    ({ value, smallestUnit, expected }) => {
      expect(roundZoned(value, { smallestUnit })).toBe(expected);
    },
  );
});

// The 1844 date-line crossings (zoned.E): Asia/Manila, Pacific/Guam, Saipan, Kosrae and Palau
// skipped 1844-12-31, jumping a whole day forward at local 1844-12-31T00:00 in LMT. Expected values
// are Chromium 153 native Temporal, never the polyfill (whose transition search starts at
// 1847-01-01). `dateLineCrossingAt(zone, h)` is the zone h hours from its crossing, from exact time.

describe("roundZoned across the 1844 date-line crossings (zoned.E)", () => {
  // 1844-12-30 is 24 hours long, so its noon is an exact half and halfExpand rounds up to the
  // next day's start, the crossing; 11:00 rounds down.
  it.each(dateLineCrossingTimeZones)(
    "rounds 1844-12-30 in $timeZone to a day",
    (crossing) => {
      expect(
        roundZoned(dateLineCrossingAt(crossing, -12).toString(), {
          smallestUnit: "day",
        }),
      ).toBe(dateLineCrossingAt(crossing, 0).toString());
      expect(
        roundZoned(dateLineCrossingAt(crossing, -13).toString(), {
          smallestUnit: "day",
        }),
      ).toBe(dateLineCrossingAt(crossing, -24).toString());
    },
  );
});
