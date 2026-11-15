import { Temporal } from "../../internal/temporal";
import { mockTemporalInstantFromThrow } from "../../test/mocks";
import { battleTestTimeZones } from "../../test/timeZoneMatrix";
import { gtfsToInstant } from "./gtfsToInstant";

const LA = "America/Los_Angeles";
const NY = "America/New_York";

/** Start of the local date plus the written seconds: the midnight reading the function must not use. */
function naiveInstant(date: string, seconds: number, timeZone: string): string {
  const iso =
    date.length === 8
      ? `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6)}`
      : date;
  return Temporal.PlainDate.from(iso)
    .toZonedDateTime({ timeZone })
    .toInstant()
    .add({ seconds })
    .toString();
}

// Expected values below are derived from GTFS § Field Types, Time (noon minus 12 h of the service
// day, then the written time as exact seconds), with noon resolved in the zone with
// disambiguation "reject"; checked against @js-temporal/polyfill.
describe("gtfsToInstant", () => {
  describe("valid rows", () => {
    it.each`
      id      | serviceDate     | gtfsTime      | timeZone              | expected                  | derivation
      ${"V1"} | ${"20240130"}   | ${"25:35:00"} | ${LA}                 | ${"2024-01-31T09:35:00Z"} | ${"noon PST 20:00Z - 12 h = 08:00Z, + 25 h 35 m"}
      ${"V2"} | ${"20240130"}   | ${"27:00:00"} | ${LA}                 | ${"2024-01-31T11:00:00Z"} | ${"08:00Z + 27 h"}
      ${"V3"} | ${"2024-01-30"} | ${"25:35:00"} | ${LA}                 | ${"2024-01-31T09:35:00Z"} | ${"the ISO form equals V1"}
      ${"S1"} | ${"20240331"}   | ${"03:00:00"} | ${"Europe/Berlin"}    | ${"2024-03-31T01:00:00Z"} | ${"anchor 22:00Z on the 30th + 3 h"}
      ${"S2"} | ${"20240331"}   | ${"00:00:00"} | ${"Europe/Berlin"}    | ${"2024-03-30T22:00:00Z"} | ${"the anchor is 23:00 local on 30 March"}
      ${"S3"} | ${"20240331"}   | ${"14:30:00"} | ${"Europe/Berlin"}    | ${"2024-03-31T12:30:00Z"} | ${"22:00Z + 14 h 30 m"}
      ${"F1"} | ${"20240407"}   | ${"00:00:00"} | ${"Australia/Sydney"} | ${"2024-04-06T14:00:00Z"} | ${"noon AEST 02:00Z - 12 h is 01:00 local"}
      ${"F2"} | ${"20240407"}   | ${"12:00:00"} | ${"Australia/Sydney"} | ${"2024-04-07T02:00:00Z"} | ${"noon local"}
    `(
      "$id: $serviceDate $gtfsTime in $timeZone is $expected ($derivation)",
      ({ serviceDate, gtfsTime, timeZone, expected }) => {
        expect(gtfsToInstant(serviceDate, gtfsTime, timeZone)).toBe(expected);
      },
    );
  });

  describe("against the naive midnight reading", () => {
    it.each`
      id      | serviceDate   | gtfsTime      | seconds  | timeZone                 | naive
      ${"S1"} | ${"20240331"} | ${"03:00:00"} | ${10800} | ${"Europe/Berlin"}       | ${"2024-03-31T02:00:00Z"}
      ${"S2"} | ${"20240331"} | ${"00:00:00"} | ${0}     | ${"Europe/Berlin"}       | ${"2024-03-30T23:00:00Z"}
      ${"S3"} | ${"20240331"} | ${"14:30:00"} | ${52200} | ${"Europe/Berlin"}       | ${"2024-03-31T13:30:00Z"}
      ${"F1"} | ${"20240407"} | ${"00:00:00"} | ${0}     | ${"Australia/Sydney"}    | ${"2024-04-06T13:00:00Z"}
      ${"F2"} | ${"20240407"} | ${"12:00:00"} | ${43200} | ${"Australia/Sydney"}    | ${"2024-04-07T01:00:00Z"}
      ${"P1"} | ${"20240310"} | ${"00:00:00"} | ${0}     | ${NY}                    | ${"2024-03-10T05:00:00Z"}
      ${"P2"} | ${"20241103"} | ${"00:00:00"} | ${0}     | ${NY}                    | ${"2024-11-03T04:00:00Z"}
      ${"P3"} | ${"20240908"} | ${"00:00:00"} | ${0}     | ${"America/Santiago"}    | ${"2024-09-08T04:00:00Z"}
      ${"P4"} | ${"20241103"} | ${"00:00:00"} | ${0}     | ${"America/Havana"}      | ${"2024-11-03T04:00:00Z"}
      ${"P5"} | ${"20241006"} | ${"00:00:00"} | ${0}     | ${"Australia/Lord_Howe"} | ${"2024-10-05T13:30:00Z"}
      ${"P6"} | ${"20240407"} | ${"00:00:00"} | ${0}     | ${"Australia/Lord_Howe"} | ${"2024-04-06T13:00:00Z"}
      ${"P7"} | ${"20240929"} | ${"00:00:00"} | ${0}     | ${"Pacific/Chatham"}     | ${"2024-09-28T11:15:00Z"}
      ${"P8"} | ${"20240331"} | ${"00:00:00"} | ${0}     | ${"Europe/London"}       | ${"2024-03-31T00:00:00Z"}
      ${"P9"} | ${"20241027"} | ${"00:00:00"} | ${0}     | ${"Europe/London"}       | ${"2024-10-26T23:00:00Z"}
    `(
      "$id: $serviceDate $gtfsTime in $timeZone differs from the midnight reading $naive",
      ({ serviceDate, gtfsTime, seconds, timeZone, naive }) => {
        expect(naiveInstant(serviceDate, seconds, timeZone)).toBe(naive);
        expect(gtfsToInstant(serviceDate, gtfsTime, timeZone)).not.toBe(naive);
      },
    );

    it.each`
      id      | serviceDate   | gtfsTime      | seconds
      ${"V1"} | ${"20240130"} | ${"25:35:00"} | ${92100}
      ${"V2"} | ${"20240130"} | ${"27:00:00"} | ${97200}
    `(
      "$id: $serviceDate $gtfsTime on an ordinary day equals the midnight reading (control)",
      ({ serviceDate, gtfsTime, seconds }) => {
        expect(gtfsToInstant(serviceDate, gtfsTime, LA)).toBe(
          naiveInstant(serviceDate, seconds, LA),
        );
      },
    );
  });

  describe("probe zones at 00:00:00 (the anchor itself)", () => {
    it.each`
      id      | serviceDate   | timeZone                 | expected                  | why
      ${"P1"} | ${"20240310"} | ${NY}                    | ${"2024-03-10T04:00:00Z"} | ${"spring forward: 23:00 EST on 9 March"}
      ${"P2"} | ${"20241103"} | ${NY}                    | ${"2024-11-03T05:00:00Z"} | ${"fall back: the first 01:00 (EDT)"}
      ${"P3"} | ${"20240908"} | ${"America/Santiago"}    | ${"2024-09-08T03:00:00Z"} | ${"local midnight skipped, the anchor still exists"}
      ${"P4"} | ${"20241103"} | ${"America/Havana"}      | ${"2024-11-03T05:00:00Z"} | ${"midnight repeated, the anchor is the second 00:00"}
      ${"P5"} | ${"20241006"} | ${"Australia/Lord_Howe"} | ${"2024-10-05T13:00:00Z"} | ${"30-minute spring"}
      ${"P6"} | ${"20240407"} | ${"Australia/Lord_Howe"} | ${"2024-04-06T13:30:00Z"} | ${"30-minute fall"}
      ${"P7"} | ${"20240929"} | ${"Pacific/Chatham"}     | ${"2024-09-28T10:15:00Z"} | ${"+12:45 to +13:45"}
      ${"P8"} | ${"20240331"} | ${"Europe/London"}       | ${"2024-03-30T23:00:00Z"} | ${"spring"}
      ${"P9"} | ${"20241027"} | ${"Europe/London"}       | ${"2024-10-27T00:00:00Z"} | ${"fall: 01:00 BST"}
    `(
      "$id: $serviceDate 00:00:00 in $timeZone is $expected ($why)",
      ({ serviceDate, timeZone, expected }) => {
        expect(gtfsToInstant(serviceDate, "00:00:00", timeZone)).toBe(expected);
      },
    );
  });

  describe("24:00:00 and the nights after the service day", () => {
    it.each`
      id      | serviceDate   | gtfsTime      | expected                  | local
      ${"N1"} | ${"20240310"} | ${"24:00:00"} | ${"2024-03-11T04:00:00Z"} | ${"00:00 EDT, 11 March: anchor + 24 h on a 23-hour day"}
      ${"N2"} | ${"20241103"} | ${"24:00:00"} | ${"2024-11-04T05:00:00Z"} | ${"00:00 EST, 4 November"}
      ${"N3"} | ${"20240309"} | ${"25:30:00"} | ${"2024-03-10T06:30:00Z"} | ${"01:30 EST"}
      ${"N4"} | ${"20240309"} | ${"26:30:00"} | ${"2024-03-10T07:30:00Z"} | ${"03:30 EDT: elapsed, so the skipped 02:30 never arises"}
      ${"N5"} | ${"20241102"} | ${"25:30:00"} | ${"2024-11-03T05:30:00Z"} | ${"first 01:30 (EDT)"}
      ${"N6"} | ${"20241102"} | ${"26:30:00"} | ${"2024-11-03T06:30:00Z"} | ${"second 01:30 (EST), an hour after N5"}
    `(
      "$id: $serviceDate $gtfsTime in New York is $expected ($local)",
      ({ serviceDate, gtfsTime, expected }) => {
        expect(gtfsToInstant(serviceDate, gtfsTime, NY)).toBe(expected);
      },
    );
  });

  describe("overflow past 24:00:00 across clock changes and calendar ends", () => {
    it.each`
      serviceDate   | gtfsTime       | timeZone                 | expected                  | why
      ${"20241006"} | ${"26:30:00"}  | ${"Australia/Sydney"}    | ${"2024-10-06T15:30:00Z"} | ${"anchor 13:00Z on 5 Oct + 26 h 30 m: reads 02:30 +11 on the 7th"}
      ${"20241006"} | ${"24:00:00"}  | ${"Australia/Lord_Howe"} | ${"2024-10-06T13:00:00Z"} | ${"anchor 13:00Z (23:30 +10:30) + 24 h reads 00:00 +11"}
      ${"20240929"} | ${"24:00:00"}  | ${"Pacific/Chatham"}     | ${"2024-09-29T10:15:00Z"} | ${"24 h after the 23:00 anchor on a 23-hour day reads 00:00 +13:45"}
      ${"20241026"} | ${"25:30:00"}  | ${"Europe/London"}       | ${"2024-10-27T00:30:00Z"} | ${"first 01:30 (BST)"}
      ${"20241026"} | ${"26:30:00"}  | ${"Europe/London"}       | ${"2024-10-27T01:30:00Z"} | ${"second 01:30 (GMT), an hour after the row above"}
      ${"20241026"} | ${"26:30:00"}  | ${"Europe/Berlin"}       | ${"2024-10-27T00:30:00Z"} | ${"02:30 CEST, the first of two 02:30 readings"}
      ${"20241103"} | ${"25:00:00"}  | ${"America/Havana"}      | ${"2024-11-04T06:00:00Z"} | ${"anchor 05:00Z + 25 h reads 01:00 CST"}
      ${"20241103"} | ${"999:59:59"} | ${NY}                    | ${"2024-12-14T20:59:59Z"} | ${"05:00Z + 3 599 999 s"}
      ${"20240228"} | ${"25:00:00"}  | ${"UTC"}                 | ${"2024-02-29T01:00:00Z"} | ${"leap day is reached by overflow"}
      ${"20230228"} | ${"24:00:00"}  | ${"UTC"}                 | ${"2023-03-01T00:00:00Z"} | ${"February has 28 days in 2023"}
      ${"20241231"} | ${"25:00:00"}  | ${"UTC"}                 | ${"2025-01-01T01:00:00Z"} | ${"overflow crosses the year end"}
      ${"20240130"} | ${"25:00:00"}  | ${"-00:44:30"}           | ${"2024-01-31T01:44:30Z"} | ${"anchor 00:44:30Z + 25 h, offset with seconds"}
      ${"20240130"} | ${"5:05:00"}   | ${LA}                    | ${"2024-01-30T13:05:00Z"} | ${"a one-digit hour is a GTFS time"}
      ${"00000101"} | ${"999:59:59"} | ${"+14:00"}              | ${"0000-02-11T01:59:59Z"} | ${"anchor -000001-12-31T10:00:00Z + 3 599 999 s, year 0000 stays four-digit"}
      ${"00000101"} | ${"00:00:00"}  | ${"-14:00"}              | ${"0000-01-01T14:00:00Z"} | ${"midnight at -14:00"}
    `(
      "$serviceDate $gtfsTime in $timeZone is $expected ($why)",
      ({ serviceDate, gtfsTime, timeZone, expected }) => {
        expect(gtfsToInstant(serviceDate, gtfsTime, timeZone)).toBe(expected);
      },
    );
  });

  describe("noon skipped or repeated returns the sentinel", () => {
    it.each`
      id      | serviceDate   | timeZone               | why
      ${"X1"} | ${"20000115"} | ${"Africa/Khartoum"}   | ${"12:00 +02 to 13:00 +03: noon nonexistent"}
      ${"X2"} | ${"20000115"} | ${"Africa/Juba"}       | ${"same transition"}
      ${"X3"} | ${"19670603"} | ${"Africa/Casablanca"} | ${"noon nonexistent"}
      ${"X4"} | ${"19690930"} | ${"Pacific/Kwajalein"} | ${"+11 to -12: the whole day repeated, noon ambiguous"}
      ${"X5"} | ${"20111230"} | ${"Pacific/Apia"}      | ${"deleted day"}
      ${"X6"} | ${"18441231"} | ${"Asia/Manila"}       | ${"deleted day before the polyfill search floor"}
      ${"X7"} | ${"18831118"} | ${NY}                  | ${"US railway time: -04:56:02 to -05:00 at noon, so noon happened twice"}
      ${"X8"} | ${"19930821"} | ${"Pacific/Kwajalein"} | ${"-12 to +12: deleted day"}
    `(
      "$id: $serviceDate in $timeZone returns '' for 00:00:00 and 25:00:00 ($why)",
      ({ serviceDate, timeZone }) => {
        expect(gtfsToInstant(serviceDate, "00:00:00", timeZone)).toBe("");
        expect(gtfsToInstant(serviceDate, "25:00:00", timeZone)).toBe("");
      },
    );

    // X6c needs tzdata 2025a or later, which set Manila's offset before the deleted day
    // 1844-12-31 to -15:56:08 (it was -15:56:00), so the noon of 1844-12-30 is 03:56:08Z.
    it.each`
      id       | serviceDate   | gtfsTime      | timeZone               | expected
      ${"X1c"} | ${"20000116"} | ${"00:00:00"} | ${"Africa/Khartoum"}   | ${"2000-01-15T21:00:00Z"}
      ${"X4c"} | ${"19691001"} | ${"12:00:00"} | ${"Pacific/Kwajalein"} | ${"1969-10-02T00:00:00Z"}
      ${"X5c"} | ${"20111231"} | ${"00:00:00"} | ${"Pacific/Apia"}      | ${"2011-12-30T10:00:00Z"}
      ${"X6c"} | ${"18441230"} | ${"12:00:00"} | ${"Asia/Manila"}       | ${"1844-12-31T03:56:08Z"}
    `(
      "$id: the day beside the gap, $serviceDate $gtfsTime in $timeZone, is $expected",
      ({ serviceDate, gtfsTime, timeZone, expected }) => {
        expect(gtfsToInstant(serviceDate, gtfsTime, timeZone)).toBe(expected);
      },
    );
  });

  describe("zone forms", () => {
    it.each`
      id      | serviceDate   | gtfsTime      | timeZone                 | expected
      ${"Z1"} | ${"20240130"} | ${"00:00:00"} | ${"+05:30"}              | ${"2024-01-29T18:30:00Z"}
      ${"Z2"} | ${"20240130"} | ${"00:00:00"} | ${"-00:44:30"}           | ${"2024-01-30T00:44:30Z"}
      ${"Z3"} | ${"20240130"} | ${"00:00:00"} | ${"UTC"}                 | ${"2024-01-30T00:00:00Z"}
      ${"Z4"} | ${"20240130"} | ${"25:35:00"} | ${"america/los_angeles"} | ${"2024-01-31T09:35:00Z"}
    `(
      "$id: $serviceDate $gtfsTime in '$timeZone' is $expected",
      ({ serviceDate, gtfsTime, timeZone, expected }) => {
        expect(gtfsToInstant(serviceDate, gtfsTime, timeZone)).toBe(expected);
      },
    );
  });

  describe("range", () => {
    it.each`
      id      | serviceDate   | gtfsTime       | timeZone    | expected                     | why
      ${"R1"} | ${"00000101"} | ${"00:00:00"}  | ${"UTC"}    | ${"0000-01-01T00:00:00Z"}    | ${"first four-digit year"}
      ${"R2"} | ${"20240130"} | ${"999:59:59"} | ${LA}       | ${"2024-03-11T23:59:59Z"}    | ${"08:00Z + 3 599 999 s"}
      ${"R3"} | ${"99991231"} | ${"999:59:59"} | ${"UTC"}    | ${"+010000-02-10T15:59:59Z"} | ${"Temporal's expanded year past 9999"}
      ${"R4"} | ${"00000101"} | ${"00:00:00"}  | ${"+14:00"} | ${"-000001-12-31T10:00:00Z"} | ${"noon at +14 is 22:00Z the day before, minus 12 h"}
    `(
      "$id: $serviceDate $gtfsTime in $timeZone is $expected ($why)",
      ({ serviceDate, gtfsTime, timeZone, expected }) => {
        expect(gtfsToInstant(serviceDate, gtfsTime, timeZone)).toBe(expected);
      },
    );
  });

  describe("sentinel", () => {
    it.each`
      label                     | serviceDate
      ${"20240230"}             | ${"20240230"}
      ${"2024-02-30"}           | ${"2024-02-30"}
      ${"20230229"}             | ${"20230229"}
      ${"a date-time"}          | ${"2024-01-30T23:00"}
      ${"a basic date-time"}    | ${"20240130T2300"}
      ${"an expanded year"}     | ${"+002024-01-30"}
      ${"an annotation"}        | ${"2024-01-30[u-ca=hebrew]"}
      ${"a UTC designator"}     | ${"2024-01-30Z"}
      ${"mixed form 2024-0130"} | ${"2024-0130"}
      ${"mixed form 202401-30"} | ${"202401-30"}
      ${"an unpadded month"}    | ${"2024-1-30"}
      ${"a two-digit year"}     | ${"240130"}
      ${"an empty string"}      | ${""}
      ${"a leading space"}      | ${" 20240130"}
      ${"a trailing newline"}   | ${"20240130\n"}
      ${"a leading tab"}        | ${"\t20240130"}
      ${"a trailing tab"}       | ${"20240130\t"}
      ${"a byte order mark"}    | ${"\uFEFF20240130"}
      ${"fullwidth digits"}     | ${"２０２４０１３０"}
      ${"the number 20240130"}  | ${20240130}
      ${"null"}                 | ${null}
      ${"undefined"}            | ${undefined}
      ${"an object"}            | ${{}}
    `(
      "returns '' for the service date $label",
      ({ serviceDate }: { serviceDate: unknown }) => {
        expect(gtfsToInstant(serviceDate as string, "25:35:00", LA)).toBe("");
      },
    );

    it.each`
      label                    | gtfsTime
      ${"minute 60"}           | ${"25:60:00"}
      ${"second 60"}           | ${"24:00:60"}
      ${"four hour digits"}    | ${"1000:00:00"}
      ${"no seconds"}          | ${"25:35"}
      ${"an empty string"}     | ${""}
      ${"a leading space"}     | ${" 25:35:00"}
      ${"a leading tab"}       | ${"\t25:35:00"}
      ${"a trailing tab"}      | ${"25:35:00\t"}
      ${"a byte order mark"}   | ${"\uFEFF25:35:00"}
      ${"a negative hour"}     | ${"-01:00:00"}
      ${"a fractional second"} | ${"25:35:00.5"}
      ${"null"}                | ${null}
      ${"the number 5700"}     | ${5700}
    `(
      "returns '' for the GTFS time $label",
      ({ gtfsTime }: { gtfsTime: unknown }) => {
        expect(gtfsToInstant("20240130", gtfsTime as string, LA)).toBe("");
      },
    );

    it.each`
      label                  | timeZone
      ${"an unknown zone"}   | ${"Not/AZone"}
      ${"an empty string"}   | ${""}
      ${"Z"}                 | ${"Z"}
      ${"a leading space"}   | ${" UTC"}
      ${"a leading tab"}     | ${"\tUTC"}
      ${"a trailing tab"}    | ${"UTC\t"}
      ${"a byte order mark"} | ${"\uFEFFUTC"}
      ${"null"}              | ${null}
      ${"undefined"}         | ${undefined}
      ${"the number 123"}    | ${123}
    `(
      "returns '' for the time zone $label",
      ({ timeZone }: { timeZone: unknown }) => {
        expect(gtfsToInstant("20240130", "25:35:00", timeZone as string)).toBe(
          "",
        );
      },
    );

    it("returns '' when the instant parse throws", () => {
      mockTemporalInstantFromThrow();
      expect(gtfsToInstant("20240130", "25:35:00", LA)).toBe("");
    });
  });

  describe.each(["20240229", "2024-02-29"])(
    "battle-test zones on %s",
    (serviceDate) => {
      const noonOf = (timeZone: string) =>
        Temporal.ZonedDateTime.from({
          year: 2024,
          month: 2,
          day: 29,
          hour: 12,
          timeZone,
        }).toInstant();

      it.each(battleTestTimeZones)(
        "12:00:00 is noon local in %s",
        (timeZone) => {
          expect(gtfsToInstant(serviceDate, "12:00:00", timeZone)).toBe(
            noonOf(timeZone).toString(),
          );
        },
      );

      it.each(battleTestTimeZones)(
        "00:00:00 is noon minus 12 h exact in %s",
        (timeZone) => {
          expect(gtfsToInstant(serviceDate, "00:00:00", timeZone)).toBe(
            noonOf(timeZone).subtract({ hours: 12 }).toString(),
          );
        },
      );

      it.each(battleTestTimeZones)(
        "36:00:00 is 12:00:00 plus 24 h exact in %s",
        (timeZone) => {
          expect(gtfsToInstant(serviceDate, "36:00:00", timeZone)).toBe(
            noonOf(timeZone).add({ hours: 24 }).toString(),
          );
        },
      );
    },
  );

  it.each(battleTestTimeZones)(
    "reads 20240229 and 2024-02-29 the same in %s",
    (timeZone) => {
      expect(gtfsToInstant("20240229", "25:35:00", timeZone)).toBe(
        gtfsToInstant("2024-02-29", "25:35:00", timeZone),
      );
    },
  );
});
