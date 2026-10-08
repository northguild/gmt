import { Temporal } from "@js-temporal/polyfill";
import { vi } from "vitest";
import { X12_TIME_CODES } from "../../internal";
import {
  mockTemporalInstantFromThrow,
  mockTemporalPlainDateFromThrow,
  mockTemporalPlainTimeFromThrow,
} from "../../test/mocks";
import { hostileProxy, revokedProxy } from "../../test/noThrow";
import {
  X12_TIME_CODE_EXPECTATIONS,
  type X12TimeCodeExpectation,
} from "../../test/x12TimeCodeMatrix";
import { formatX12DateTimePeriod } from "../format/formatX12DateTimePeriod";
import { parseX12DateTime } from "./parseX12DateTime";

/** The 623 codes whose definition is an ISO designator, each with the offset it states. */
const OFFSET_CODES = X12_TIME_CODES.flatMap((timeCode) => {
  const expectation: X12TimeCodeExpectation =
    X12_TIME_CODE_EXPECTATIONS[timeCode];
  return "minutes" in expectation ? [{ timeCode, ...expectation }] : [];
});

/** The 623 codes whose definition is a zone name, each with the name and flag it states. */
const ZONE_CODES = X12_TIME_CODES.flatMap((timeCode) => {
  const expectation: X12TimeCodeExpectation =
    X12_TIME_CODE_EXPECTATIONS[timeCode];
  return "zone" in expectation ? [{ timeCode, ...expectation }] : [];
});

/**
 * X12 freight segments (`AT7`, `G62`, `DTM-02/03/04`) carry a moment as three elements: 373 Date
 * (`CCYYMMDD`), 337 Time (`HHMM`, `HHMMSS`, `HHMMSSD` or `HHMMSSDD`) and 623 Time Code. Every
 * expected value is read off those masks by hand; the fixture is 15 June 2024 at 14:30 (and 45
 * seconds where the value has them). A fraction is the element's decimal seconds: one digit is
 * tenths, two are hundredths.
 */
/**
 * Values that are not strings, each named for the failure message. Built per use: a Proxy that
 * throws on every trap reaches the catch path, where the others stop at a `typeof` guard.
 * `undefined` is not here: for each of the three arguments it means the element was not sent.
 */
const NON_STRINGS: [string, () => unknown][] = [
  ["null", () => null],
  ["a number", () => 1430],
  ["a boolean", () => true],
  ["an array holding the value", () => ["1430"]],
  ["an object", () => ({})],
  ["a String object", () => Object("1430")],
  ["a Proxy that throws on any trap", hostileProxy],
  ["a revoked Proxy", revokedProxy],
];

describe("parseX12DateTime", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("a date alone (element 373, CCYYMMDD)", () => {
    it.each`
      date          | expected        | reads
      ${"20240615"} | ${"2024-06-15"} | ${"the fixture"}
      ${"20240229"} | ${"2024-02-29"} | ${"the leap day"}
      ${"20231231"} | ${"2023-12-31"} | ${"a year end"}
      ${"00000101"} | ${"0000-01-01"} | ${"the first four-digit year"}
      ${"99991231"} | ${"9999-12-31"} | ${"the last four-digit year"}
    `(
      "reads $date as { date: $expected } and nothing else ($reads)",
      ({ date, expected }) => {
        expect(Temporal.PlainDate.from(expected).toString()).toBe(expected);
        expect(parseX12DateTime(date)).toStrictEqual({ date: expected });
      },
    );
  });

  describe("a date and a time (element 337), no time code", () => {
    // `milliseconds` is the decimal seconds worked out by hand: tenths × 100, hundredths × 10.
    // Each row checks the expected time against it through plain Temporal, so a fraction shifted
    // by a digit fails.
    it.each`
      time          | form          | milliseconds | expected         | reads
      ${"1430"}     | ${"HHMM"}     | ${0}         | ${"14:30:00"}    | ${"seconds are written as 00"}
      ${"0000"}     | ${"HHMM"}     | ${0}         | ${"00:00:00"}    | ${"midnight"}
      ${"2359"}     | ${"HHMM"}     | ${0}         | ${"23:59:00"}    | ${"the last minute"}
      ${"143045"}   | ${"HHMMSS"}   | ${0}         | ${"14:30:45"}    | ${"seconds"}
      ${"235959"}   | ${"HHMMSS"}   | ${0}         | ${"23:59:59"}    | ${"the last second"}
      ${"1430001"}  | ${"HHMMSSD"}  | ${100}       | ${"14:30:00.1"}  | ${"one tenth"}
      ${"1430459"}  | ${"HHMMSSD"}  | ${900}       | ${"14:30:45.9"}  | ${"nine tenths"}
      ${"1430450"}  | ${"HHMMSSD"}  | ${0}         | ${"14:30:45"}    | ${"zero tenths: no fraction to write"}
      ${"14300012"} | ${"HHMMSSDD"} | ${120}       | ${"14:30:00.12"} | ${"twelve hundredths"}
      ${"14304505"} | ${"HHMMSSDD"} | ${50}        | ${"14:30:45.05"} | ${"five hundredths: the leading zero counts"}
      ${"14304550"} | ${"HHMMSSDD"} | ${500}       | ${"14:30:45.5"}  | ${"fifty hundredths is five tenths"}
      ${"14304500"} | ${"HHMMSSDD"} | ${0}         | ${"14:30:45"}    | ${"zero hundredths: no fraction to write"}
      ${"23595999"} | ${"HHMMSSDD"} | ${990}       | ${"23:59:59.99"} | ${"the last hundredth of the day"}
    `(
      "reads the time $time ($form) as $expected ($reads)",
      ({ time, milliseconds, expected }) => {
        const plainTime = Temporal.PlainTime.from(expected);
        expect(plainTime.toString()).toBe(expected);
        expect(plainTime.millisecond).toBe(milliseconds);
        expect(parseX12DateTime("20240615", time)).toStrictEqual({
          date: "2024-06-15",
          time: expected,
          local: `2024-06-15T${expected}`,
        });
      },
    );

    // `AT7`: "If AT707 is not present then AT706 represents local time of the status". `DTM`
    // and `G62` do not say what an absent time code means, and GMT reads them the same way (GMT
    // rule). Either way the place is elsewhere in the message and the value states no offset,
    // so the result has no instant.
    it("returns no instant, offset or zone for a date and time with no time code", () => {
      const result = parseX12DateTime("20240615", "1430");
      expect(result).not.toHaveProperty("instant");
      expect(result).not.toHaveProperty("offset");
      expect(result).not.toHaveProperty("zone");
      expect(result).not.toHaveProperty("daylight");
    });

    it.each`
      time           | reads
      ${"143"}       | ${"three digits"}
      ${"14304"}     | ${"five digits: between HHMM and HHMMSS"}
      ${"143045123"} | ${"nine digits: element 337 holds eight at most"}
      ${"2430"}      | ${"hour 24"}
      ${"1460"}      | ${"minute 60"}
      ${"143060"}    | ${"second 60"}
      ${"14:30"}     | ${"a colon"}
      ${"143045.1"}  | ${"a decimal point: the decimal seconds are bare digits"}
      ${"1430 "}     | ${"a trailing space"}
      ${" 1430"}     | ${"a leading space"}
      ${"T1430"}     | ${"a time designator"}
      ${"-1430"}     | ${"a sign"}
      ${"１４３０"}  | ${"full-width digits"}
      ${"1430+0200"} | ${"an offset: element 337 has none"}
      ${"14h30"}     | ${"a letter"}
    `("returns null for the time $time ($reads)", ({ time }) => {
      expect(parseX12DateTime("20240615", time)).toBeNull();
    });
  });

  describe("a date that is not a real CCYYMMDD date", () => {
    it.each`
      date            | reads
      ${"20230229"}   | ${"29 February 2023"}
      ${"20240631"}   | ${"31 June"}
      ${"20241301"}   | ${"month 13"}
      ${"20240600"}   | ${"day 00"}
      ${"240615"}     | ${"six digits: element 373 has a four-digit year"}
      ${"202406150"}  | ${"nine digits"}
      ${"2024-06-15"} | ${"an ISO 8601 date"}
      ${"06152024"}   | ${"month first"}
      ${"20240615 "}  | ${"a trailing space"}
      ${" "}          | ${"a space: not empty, so it was sent"}
    `("returns null for the date $date ($reads)", ({ date }) => {
      expect(parseX12DateTime(date)).toBeNull();
      expect(parseX12DateTime(date, "1430")).toBeNull();
    });
  });
  describe("a time alone (X12 DTM syntax note R020305, G62 R0103: a segment may carry a time and no date)", () => {
    // `DTM` R020305: "At least one of DTM-02, DTM-03 or DTM-05 is required". `G62` R0103: "At
    // least one of G62-01 or G62-03 is required", where G62-03/04 are the time qualifier and the
    // time. So the time element can stand with no date beside it. `AT7` forbids it (C0605: "If
    // AT7-06 is present, then AT7-05 is required"), but the function is not told which segment
    // a value came from, so it reads a time alone wherever it came from (GMT rule). A time
    // alone is a reading of a clock on no stated day: it has no `date`, no `local` (a date and
    // a time together) and no `instant`. `milliseconds` is the decimal seconds by hand, as in
    // the block above.
    it.each`
      time          | form          | milliseconds | expected         | reads
      ${"1430"}     | ${"HHMM"}     | ${0}         | ${"14:30:00"}    | ${"seconds are written as 00"}
      ${"0000"}     | ${"HHMM"}     | ${0}         | ${"00:00:00"}    | ${"midnight"}
      ${"143045"}   | ${"HHMMSS"}   | ${0}         | ${"14:30:45"}    | ${"seconds"}
      ${"235959"}   | ${"HHMMSS"}   | ${0}         | ${"23:59:59"}    | ${"the last second"}
      ${"1430001"}  | ${"HHMMSSD"}  | ${100}       | ${"14:30:00.1"}  | ${"one tenth"}
      ${"1430450"}  | ${"HHMMSSD"}  | ${0}         | ${"14:30:45"}    | ${"zero tenths: no fraction to write"}
      ${"14300012"} | ${"HHMMSSDD"} | ${120}       | ${"14:30:00.12"} | ${"twelve hundredths"}
      ${"14304505"} | ${"HHMMSSDD"} | ${50}        | ${"14:30:45.05"} | ${"five hundredths: the leading zero counts"}
      ${"23595999"} | ${"HHMMSSDD"} | ${990}       | ${"23:59:59.99"} | ${"the last hundredth of the day"}
    `(
      "reads the time $time ($form) with no date as { time: $expected } and nothing else ($reads)",
      ({ time, milliseconds, expected }) => {
        const plainTime = Temporal.PlainTime.from(expected);
        expect(plainTime.toString()).toBe(expected);
        expect(plainTime.millisecond).toBe(milliseconds);
        expect(parseX12DateTime("", time)).toStrictEqual({ time: expected });
      },
    );

    // "" is what a segment splitter hands over for `DTM*139**1430`; undefined is what a caller
    // with no date element passes. Both mean "not sent".
    it.each`
      date         | timeCode     | reads
      ${""}        | ${undefined} | ${"an empty date, no time code"}
      ${undefined} | ${undefined} | ${"an undefined date, no time code"}
      ${""}        | ${""}        | ${"an empty date and an empty time code"}
      ${undefined} | ${""}        | ${"an undefined date and an empty time code"}
    `(
      "reads the date $date, time 1430, time code $timeCode as { time: 14:30:00 } ($reads)",
      ({ date, timeCode }) => {
        expect(parseX12DateTime(date, "1430", timeCode)).toStrictEqual({
          time: "14:30:00",
        });
      },
    );

    it("reads the same result with the time code omitted", () => {
      expect(parseX12DateTime("", "1430")).toStrictEqual({ time: "14:30:00" });
      expect(parseX12DateTime(undefined, "1430")).toStrictEqual({
        time: "14:30:00",
      });
    });

    it.each`
      time           | reads
      ${"14304"}     | ${"five digits: between HHMM and HHMMSS"}
      ${"143045123"} | ${"nine digits: element 337 holds eight at most"}
      ${"2430"}      | ${"hour 24"}
      ${"1460"}      | ${"minute 60"}
      ${"143060"}    | ${"second 60"}
      ${"14:30"}     | ${"a colon"}
    `("returns null for the time $time with no date ($reads)", ({ time }) => {
      expect(parseX12DateTime("", time)).toBeNull();
      expect(parseX12DateTime(undefined, time)).toBeNull();
    });
  });

  describe("a time alone with a time code", () => {
    // A time and an offset name no instant: there is no day to place them on. The same rule as
    // UN/EDIFACT 2379 `209` (`HHMMSSZHHMM`) and `404` (`HHMMSSZZZ`), which return `time` and
    // `offset`. `minutes` is the code's ISO designator; plain Temporal reads the expected offset
    // back as that many minutes, so a wrong sign or hour fails.
    it.each(OFFSET_CODES)(
      "reads the time 1430 with $timeCode ($definition) and no date as { time: 14:30:00, offset: $offset } and no instant",
      ({ timeCode, minutes, offset }) => {
        // Midnight on a clock `minutes` ahead of UTC is `minutes` before midnight UTC.
        expect(
          Temporal.Instant.from(`1970-01-01T00:00:00${offset}`)
            .epochMilliseconds,
        ).toBe(0 - minutes * 60_000);
        const result = parseX12DateTime("", "1430", timeCode);
        expect(result).toStrictEqual({ time: "14:30:00", offset });
        expect(result).not.toHaveProperty("date");
        expect(result).not.toHaveProperty("local");
        expect(result).not.toHaveProperty("instant");
      },
    );

    it.each(ZONE_CODES)(
      "reads the time 1430 with $timeCode ($definition) and no date as { time: 14:30:00, zone: $zone, daylight: $daylight }",
      ({ timeCode, zone, daylight }) => {
        const result = parseX12DateTime("", "1430", timeCode);
        expect(result).toStrictEqual({ time: "14:30:00", zone, daylight });
        expect(result).not.toHaveProperty("date");
        expect(result).not.toHaveProperty("local");
        expect(result).not.toHaveProperty("offset");
        expect(result).not.toHaveProperty("instant");
      },
    );

    // One of each kind of code, by hand, with the date undefined rather than empty. 2330 at
    // −01:00 and 0030 at +12:00 cross a UTC day when a date is beside them: with no date there
    // is no day to cross, so the time is returned as transmitted.
    it.each`
      time          | timeCode | expected                                                  | reads
      ${"1430"}     | ${"UT"}  | ${{ time: "14:30:00", offset: "+00:00" }}                 | ${"UT: Universal Time Coordinate"}
      ${"1430"}     | ${"GM"}  | ${{ time: "14:30:00", offset: "+00:00" }}                 | ${"GM: Greenwich Mean Time"}
      ${"1430"}     | ${"20"}  | ${{ time: "14:30:00", offset: "-05:00" }}                 | ${"20 is ISO M05"}
      ${"1430"}     | ${"27"}  | ${{ time: "14:30:00", offset: "+05:30" }}                 | ${"27 is ISO P5:30: a half hour"}
      ${"2330"}     | ${"24"}  | ${{ time: "23:30:00", offset: "-01:00" }}                 | ${"late at −01:00: no day to cross"}
      ${"0030"}     | ${"12"}  | ${{ time: "00:30:00", offset: "+12:00" }}                 | ${"early at +12:00: no day to cross"}
      ${"14304512"} | ${"UT"}  | ${{ time: "14:30:45.12", offset: "+00:00" }}              | ${"hundredths with an offset code"}
      ${"143045"}   | ${"ES"}  | ${{ time: "14:30:45", zone: "Eastern", daylight: false }} | ${"Eastern Standard Time"}
      ${"143045"}   | ${"ED"}  | ${{ time: "14:30:45", zone: "Eastern", daylight: true }}  | ${"Eastern Daylight Time"}
      ${"143045"}   | ${"ET"}  | ${{ time: "14:30:45", zone: "Eastern", daylight: null }}  | ${"Eastern Time: no date to decide"}
      ${"1430001"}  | ${"LT"}  | ${{ time: "14:30:00.1", zone: "Local", daylight: null }}  | ${"Local Time, with tenths"}
    `(
      "reads the time $time with $timeCode and an undefined date as $expected ($reads)",
      ({ time, timeCode, expected }) => {
        expect(parseX12DateTime(undefined, time, timeCode)).toStrictEqual(
          expected,
        );
        expect(parseX12DateTime("", time, timeCode)).toStrictEqual(expected);
      },
    );

    it.each`
      time      | timeCode | reads
      ${"1430"} | ${"EST"} | ${"not an element 623 code"}
      ${"1430"} | ${"et"}  | ${"lower case: matching is exact"}
      ${"1430"} | ${"30"}  | ${"above the numeric run"}
      ${"2430"} | ${"UT"}  | ${"hour 24 with a valid code"}
      ${"1460"} | ${"ES"}  | ${"minute 60 with a valid code"}
    `(
      "returns null for the time $time with the time code $timeCode and no date ($reads)",
      ({ time, timeCode }) => {
        expect(parseX12DateTime("", time, timeCode)).toBeNull();
        expect(parseX12DateTime(undefined, time, timeCode)).toBeNull();
      },
    );
  });

  describe("neither a date nor a time (GMT rule: there is nothing to read)", () => {
    // 373 and 337 are the two elements this function reads a value from; with neither there is
    // nothing to return. This is GMT's rule, not X12's: R020305 ("At least one of DTM-02, DTM-03
    // or DTM-05 is required") is also met by a `DTM` carrying only DTM-05/06, which is read by
    // `parseX12DateTimePeriod`. A time code alone also breaks C0403: it has no time to qualify.
    it.each`
      date         | time         | timeCode     | reads
      ${undefined} | ${undefined} | ${undefined} | ${"all three undefined"}
      ${""}        | ${""}        | ${""}        | ${"all three empty"}
      ${""}        | ${undefined} | ${undefined} | ${"an empty date alone"}
      ${undefined} | ${""}        | ${""}        | ${"an undefined date, the others empty"}
      ${undefined} | ${undefined} | ${"UT"}      | ${"an offset code alone"}
      ${""}        | ${""}        | ${"20"}      | ${"a numeric offset code alone"}
      ${""}        | ${""}        | ${"ES"}      | ${"a named code alone"}
      ${undefined} | ${""}        | ${"LT"}      | ${"local time alone"}
      ${""}        | ${undefined} | ${"ZZ"}      | ${"an unknown code alone"}
    `(
      "returns null for date $date, time $time, time code $timeCode ($reads)",
      ({ date, time, timeCode }) => {
        expect(parseX12DateTime(date, time, timeCode)).toBeNull();
      },
    );

    it("returns null with every argument omitted", () => {
      expect(parseX12DateTime()).toBeNull();
    });
  });

  describe("a time code that states an offset (element 623: 01–29, UT, GM)", () => {
    // 14:30 on 15 June 2024 on a clock `minutes` ahead of UTC is the UTC instant `minutes`
    // earlier. The expected instant is that subtraction done by plain Temporal on the UTC
    // clock, from the code's own designator, so a wrong sign or a wrong hour fails.
    it.each(OFFSET_CODES)(
      "reads 20240615 1430 $timeCode ($definition) as the instant 14:30 less $minutes minutes, at $offset",
      ({ timeCode, minutes, offset }) => {
        const instant = Temporal.PlainDateTime.from("2024-06-15T14:30:00")
          .toZonedDateTime("UTC")
          .subtract({ minutes })
          .toInstant()
          .toString();
        expect(parseX12DateTime("20240615", "1430", timeCode)).toStrictEqual({
          date: "2024-06-15",
          time: "14:30:00",
          local: "2024-06-15T14:30:00",
          offset,
          instant,
        });
      },
    );

    it("covers the 31 offset codes: 01–29, GM and UT", () => {
      expect(OFFSET_CODES).toHaveLength(31);
    });

    // The wall clock less the offset, worked out by hand; plain Temporal agrees in the test.
    it.each`
      date          | time          | timeCode | local                       | offset      | instant                      | reads
      ${"20240615"} | ${"1430"}     | ${"20"}  | ${"2024-06-15T14:30:00"}    | ${"-05:00"} | ${"2024-06-15T19:30:00Z"}    | ${"20 is ISO M05: five hours west"}
      ${"20240615"} | ${"1430"}     | ${"02"}  | ${"2024-06-15T14:30:00"}    | ${"+02:00"} | ${"2024-06-15T12:30:00Z"}    | ${"02 is ISO P02: two hours east"}
      ${"20240615"} | ${"2330"}     | ${"24"}  | ${"2024-06-15T23:30:00"}    | ${"-01:00"} | ${"2024-06-16T00:30:00Z"}    | ${"23:30 at −01:00 is the next UTC day"}
      ${"20240615"} | ${"0030"}     | ${"12"}  | ${"2024-06-15T00:30:00"}    | ${"+12:00"} | ${"2024-06-14T12:30:00Z"}    | ${"00:30 at +12:00 is the previous UTC day"}
      ${"20241231"} | ${"2330"}     | ${"13"}  | ${"2024-12-31T23:30:00"}    | ${"-12:00"} | ${"2025-01-01T11:30:00Z"}    | ${"the UTC date is in the year after"}
      ${"20240229"} | ${"2330"}     | ${"20"}  | ${"2024-02-29T23:30:00"}    | ${"-05:00"} | ${"2024-03-01T04:30:00Z"}    | ${"the leap day, late: the UTC date is 1 March"}
      ${"20240615"} | ${"1430"}     | ${"27"}  | ${"2024-06-15T14:30:00"}    | ${"+05:30"} | ${"2024-06-15T09:00:00Z"}    | ${"27 is ISO P5:30: a half hour"}
      ${"20240615"} | ${"143045"}   | ${"UT"}  | ${"2024-06-15T14:30:45"}    | ${"+00:00"} | ${"2024-06-15T14:30:45Z"}    | ${"UT with seconds"}
      ${"20240615"} | ${"14304512"} | ${"GM"}  | ${"2024-06-15T14:30:45.12"} | ${"+00:00"} | ${"2024-06-15T14:30:45.12Z"} | ${"GM with hundredths: the fraction reaches the instant"}
      ${"20240615"} | ${"14300012"} | ${"UT"}  | ${"2024-06-15T14:30:00.12"} | ${"+00:00"} | ${"2024-06-15T14:30:00.12Z"} | ${"UT with twelve hundredths and no whole seconds: the fraction reaches local and the instant"}
      ${"20240615"} | ${"1430451"}  | ${"20"}  | ${"2024-06-15T14:30:45.1"}  | ${"-05:00"} | ${"2024-06-15T19:30:45.1Z"}  | ${"tenths, five hours west"}
      ${"99991231"} | ${"2330"}     | ${"24"}  | ${"9999-12-31T23:30:00"}    | ${"-01:00"} | ${"+010000-01-01T00:30:00Z"} | ${"the last four-digit year: the instant's UTC year is after it"}
      ${"00000101"} | ${"0030"}     | ${"01"}  | ${"0000-01-01T00:30:00"}    | ${"+01:00"} | ${"-000001-12-31T23:30:00Z"} | ${"the first four-digit year: the instant's UTC year is before it"}
    `(
      "reads $date $time $timeCode as instant $instant at $offset ($reads)",
      ({ date, time, timeCode, local, offset, instant }) => {
        expect(Temporal.Instant.from(`${local}${offset}`).toString()).toBe(
          instant,
        );
        const result = parseX12DateTime(date, time, timeCode);
        expect(result).toMatchObject({ local, offset, instant });
        expect(result).not.toHaveProperty("zone");
        expect(result).not.toHaveProperty("daylight");
      },
    );
  });

  describe("a time code that names a zone (element 623: the lettered codes, LT included)", () => {
    // A named code is a zone name, not an offset: X12 states none, and GMT maps no name to one.
    it.each(ZONE_CODES)(
      "reads 20240615 1430 $timeCode ($definition) as the local time, zone $zone, daylight $daylight, and no instant",
      ({ timeCode, zone, daylight }) => {
        const result = parseX12DateTime("20240615", "1430", timeCode);
        expect(result).toStrictEqual({
          date: "2024-06-15",
          time: "14:30:00",
          local: "2024-06-15T14:30:00",
          zone,
          daylight,
        });
        expect(result).not.toHaveProperty("instant");
        expect(result).not.toHaveProperty("offset");
      },
    );

    it("covers the 25 zone codes: 8 daylight, 8 standard, 8 generic and LT", () => {
      expect(ZONE_CODES).toHaveLength(25);
      expect(
        ZONE_CODES.filter(({ daylight }) => daylight === true),
      ).toHaveLength(8);
      expect(
        ZONE_CODES.filter(({ daylight }) => daylight === false),
      ).toHaveLength(8);
      expect(
        ZONE_CODES.filter(({ daylight }) => daylight === null),
      ).toHaveLength(9);
    });

    // One of each kind, with the definition's own words.
    it.each`
      timeCode | zone         | daylight | reads
      ${"ES"}  | ${"Eastern"} | ${false} | ${"Eastern Standard Time"}
      ${"ED"}  | ${"Eastern"} | ${true}  | ${"Eastern Daylight Time"}
      ${"ET"}  | ${"Eastern"} | ${null}  | ${"Eastern Time: the date decides"}
      ${"LT"}  | ${"Local"}   | ${null}  | ${"Local Time: the place is elsewhere in the message"}
    `(
      "reads the time code $timeCode as zone $zone, daylight $daylight ($reads)",
      ({ timeCode, zone, daylight }) => {
        expect(parseX12DateTime("20240615", "143045", timeCode)).toStrictEqual({
          date: "2024-06-15",
          time: "14:30:45",
          local: "2024-06-15T14:30:45",
          zone,
          daylight,
        });
      },
    );
  });

  describe("a time code that is not an element 623 code", () => {
    it.each`
      timeCode    | reads
      ${"et"}     | ${"lower case: matching is exact"}
      ${"EST"}    | ${"an abbreviation, not a 623 code"}
      ${"00"}     | ${"below the numeric run"}
      ${"30"}     | ${"above the numeric run"}
      ${"1"}      | ${"one digit: the code is 01"}
      ${"Z"}      | ${"the ISO 8601 UTC designator"}
      ${"UTC"}    | ${"UTC is UT in 623"}
      ${"+01:00"} | ${"an offset, not a code"}
      ${" ET"}    | ${"a leading space"}
      ${"D8"}     | ${"a 1250 format code"}
    `(
      "returns null for 20240615 1430 with the time code $timeCode ($reads)",
      ({ timeCode }) => {
        expect(parseX12DateTime("20240615", "1430", timeCode)).toBeNull();
      },
    );
  });

  // X12's rule for `DTM` (C0403) and `AT7` (C0706: "If AT7-07 is present, then AT7-06 is
  // required"); GMT's rule for `G62`, which has no such note.
  describe("a time code with no time (X12 syntax note C0403: if DTM-04 is present, DTM-03 is required)", () => {
    it.each`
      timeCode | reads
      ${"UT"}  | ${"an offset code"}
      ${"20"}  | ${"a numeric offset code"}
      ${"ES"}  | ${"a named code"}
      ${"LT"}  | ${"local time"}
      ${"ZZ"}  | ${"an unknown code"}
    `(
      "returns null for a date and the time code $timeCode with the time omitted ($reads)",
      ({ timeCode }) => {
        expect(parseX12DateTime("20240615", undefined, timeCode)).toBeNull();
      },
    );
  });
  describe("an element that was not sent is undefined or an empty string", () => {
    // An absent X12 element is empty between its delimiters (`G62*11*20240615***`), so a
    // segment splitter hands over "" where a caller with no element passes undefined or nothing.
    // All three mean "not sent". `expected` is what the elements that were sent state.
    it.each`
      time         | timeCode     | expected                                                                  | reads
      ${undefined} | ${undefined} | ${{ date: "2024-06-15" }}                                                 | ${"both undefined"}
      ${""}        | ${undefined} | ${{ date: "2024-06-15" }}                                                 | ${"an empty time"}
      ${""}        | ${""}        | ${{ date: "2024-06-15" }}                                                 | ${"an empty time and an empty time code"}
      ${undefined} | ${""}        | ${{ date: "2024-06-15" }}                                                 | ${"an empty time code alone"}
      ${"1430"}    | ${undefined} | ${{ date: "2024-06-15", time: "14:30:00", local: "2024-06-15T14:30:00" }} | ${"a time, the time code undefined"}
      ${"1430"}    | ${""}        | ${{ date: "2024-06-15", time: "14:30:00", local: "2024-06-15T14:30:00" }} | ${"a time, the time code empty"}
    `(
      "reads 20240615 with time $time and time code $timeCode as $expected ($reads)",
      ({ time, timeCode, expected }) => {
        expect(parseX12DateTime("20240615", time, timeCode)).toStrictEqual(
          expected,
        );
      },
    );

    it("reads the same result with the trailing arguments omitted", () => {
      expect(parseX12DateTime("20240615")).toStrictEqual({
        date: "2024-06-15",
      });
      expect(parseX12DateTime("20240615", "1430")).toStrictEqual({
        date: "2024-06-15",
        time: "14:30:00",
        local: "2024-06-15T14:30:00",
      });
    });

    // An empty time is no time, so a time code beside it has no time to qualify (C0403).
    it.each`
      timeCode | reads
      ${"UT"}  | ${"an offset code"}
      ${"ES"}  | ${"a named code"}
      ${"LT"}  | ${"local time"}
    `(
      "returns null for an empty time with the time code $timeCode ($reads)",
      ({ timeCode }) => {
        expect(parseX12DateTime("20240615", "", timeCode)).toBeNull();
      },
    );
  });

  describe("non-string arguments", () => {
    // A non-string collapses to one path per argument. null is not "not sent": only undefined
    // and "" are.
    it.each`
      argument      | call
      ${"date"}     | ${(bad: unknown) => parseX12DateTime(bad as never, "1430", "UT")}
      ${"time"}     | ${(bad: unknown) => parseX12DateTime("20240615", bad as never)}
      ${"timeCode"} | ${(bad: unknown) => parseX12DateTime("20240615", "1430", bad as never)}
    `("returns null for a $argument that is not a string", ({ call }) => {
      for (const [kind, make] of NON_STRINGS) {
        expect(call(make()), kind).toBeNull();
      }
    });

    // Only undefined and "" mean "not sent". Every other non-string date is invalid input even
    // beside a time that could stand alone.
    it("returns null for a non-string date beside a time alone and beside nothing", () => {
      for (const [kind, make] of NON_STRINGS) {
        expect(parseX12DateTime(make() as never, "1430"), kind).toBeNull();
        expect(parseX12DateTime(make() as never), kind).toBeNull();
      }
    });

    it("returns null for a non-string time or time code when no date was sent", () => {
      for (const [kind, make] of NON_STRINGS) {
        expect(parseX12DateTime("", make() as never), kind).toBeNull();
        expect(parseX12DateTime("", "1430", make() as never), kind).toBeNull();
      }
    });
  });

  describe("the catch path", () => {
    it("returns null when Temporal.PlainDate.from throws", () => {
      mockTemporalPlainDateFromThrow();
      expect(parseX12DateTime("20240615")).toBeNull();
    });

    it("returns null when Temporal.PlainTime.from throws", () => {
      mockTemporalPlainTimeFromThrow();
      expect(parseX12DateTime("20240615", "1430")).toBeNull();
    });

    it("returns null when Temporal.Instant.from throws under an offset code", () => {
      mockTemporalInstantFromThrow();
      expect(parseX12DateTime("20240615", "1430", "UT")).toBeNull();
    });

    it("returns null when Temporal.PlainTime.from throws for a time alone", () => {
      mockTemporalPlainTimeFromThrow();
      expect(parseX12DateTime("", "1430")).toBeNull();
    });

    it("returns null when Temporal.Instant.from throws under an offset code with no date", () => {
      mockTemporalInstantFromThrow();
      expect(parseX12DateTime("", "1430", "UT")).toBeNull();
    });
  });
  describe("the elements are written by formatX12DateTimePeriod under D8, TM and TS", () => {
    // Elements 373 and 337 have no formatter of their own: `CCYYMMDD` is the 1250 code D8,
    // `HHMM` is TM and `HHMMSS` is TS. What those three write, this function reads back.
    it.each`
      local                    | timeCodeFormat | date          | time
      ${"2024-06-15T14:30:00"} | ${"TM"}        | ${"20240615"} | ${"1430"}
      ${"2024-06-15T14:30:45"} | ${"TS"}        | ${"20240615"} | ${"143045"}
      ${"2024-02-29T23:59:59"} | ${"TS"}        | ${"20240229"} | ${"235959"}
      ${"2024-12-31T00:00:00"} | ${"TM"}        | ${"20241231"} | ${"0000"}
    `(
      "$local writes $date under D8 and $time under $timeCodeFormat, and reads back as $local",
      ({ local, timeCodeFormat, date, time }) => {
        const [isoDate, isoTime] = local.split("T");
        expect(formatX12DateTimePeriod(isoDate, "D8")).toBe(date);
        expect(formatX12DateTimePeriod(isoTime, timeCodeFormat)).toBe(time);
        expect(parseX12DateTime(date, time)).toStrictEqual({
          date: isoDate,
          time: isoTime,
          local,
        });
      },
    );

    // Tenths and hundredths are read and not written: no 1250 code has a field below the second.
    it("reads 14304512 as 14:30:45.12, which TS refuses to write", () => {
      expect(parseX12DateTime("20240615", "14304512")?.time).toBe(
        "14:30:45.12",
      );
      expect(formatX12DateTimePeriod("14:30:45.12", "TS")).toBe("");
    });
  });
});
