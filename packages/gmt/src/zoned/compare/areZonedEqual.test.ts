import { linkPairIsOneZone, sameInstantBattleCases } from "../../test";
import { areZonedEqual } from "./areZonedEqual";

describe("areZonedEqual", () => {
  it.each`
    value1                                               | value2                                           | expected
    ${"2024-02-29T14:30[America/New_York]"}              | ${"2024-02-29T14:30:00[America/New_York]"}       | ${true}
    ${"2024-02-29T14:30:45.123-05:00[America/New_York]"} | ${"2024-02-29T14:30:45.123[America/New_York]"}   | ${true}
    ${"2024-02-29T14:30:45Z[UTC]"}                       | ${"2024-02-29T14:30:45Z[UTC]"}                   | ${true}
    ${"2024-02-29T14:30:45Z[UTC]"}                       | ${"2024-02-29T10:30:45-05:00[America/New_York]"} | ${false}
    ${"2024-02-29T14:30:45[America/New_York]"}           | ${"2024-02-29T14:31:45[America/New_York]"}       | ${false}
    ${"2024-02-29T14:30:45[America/New_York]"}           | ${"not-a-zoned-datetime"}                        | ${false}
  `(
    "returns $expected when comparing $value1 to $value2",
    ({
      value1,
      value2,
      expected,
    }: {
      value1: string;
      value2: string;
      expected: boolean;
    }) => {
      expect(areZonedEqual(value1, value2)).toBe(expected);
    },
  );

  it.each`
    value                                               | expected
    ${"2024-02-29T00:00:00+00:00[UTC]"}                 | ${true}
    ${"2024-02-29T00:00:00+00:00[GMT]"}                 | ${true}
    ${"2024-02-29T00:00:00+00:00[Etc/GMT]"}             | ${true}
    ${"2024-02-29T00:00:00+00:00[Europe/Lisbon]"}       | ${true}
    ${"2024-02-29T00:00:00+00:00[Europe/Dublin]"}       | ${true}
    ${"2024-02-29T01:00:00+01:00[Europe/Berlin]"}       | ${true}
    ${"2024-02-29T02:00:00+02:00[Europe/Helsinki]"}     | ${true}
    ${"2024-02-29T03:00:00+03:00[Europe/Istanbul]"}     | ${true}
    ${"2024-02-29T05:30:00+05:30[Asia/Kolkata]"}        | ${true}
    ${"2024-02-29T05:45:00+05:45[Asia/Kathmandu]"}      | ${true}
    ${"2024-02-29T08:00:00+08:00[Asia/Shanghai]"}       | ${true}
    ${"2024-02-29T11:00:00+11:00[Australia/Lord_Howe]"} | ${true}
    ${"2024-02-29T13:45:00+13:45[Pacific/Chatham]"}     | ${true}
    ${"2024-02-29T13:00:00+13:00[Pacific/Apia]"}        | ${true}
    ${"2024-02-28T13:00:00-11:00[Pacific/Niue]"}        | ${true}
    ${"2024-02-28T19:00:00-05:00[America/New_York]"}    | ${true}
    ${"2024-02-28T18:00:00-06:00[America/Chicago]"}     | ${true}
    ${"2024-02-28T17:00:00-07:00[America/Phoenix]"}     | ${true}
  `(
    "returns $expected when comparing identical battle-test $value to itself",
    ({ value, expected }: { value: string; expected: boolean }) => {
      expect(areZonedEqual(value, value)).toBe(expected);
    },
  );

  for (const { timeZone, value } of sameInstantBattleCases) {
    it(`returns true for identical battle-test zoned datetime in ${timeZone}`, () => {
      expect(areZonedEqual(value, value)).toBe(true);
    });
  }
});

// Temporal `ZonedDateTime.prototype.equals`: equal epoch nanoseconds, then TimeZoneEquals (same
// primary identifier, offset zones by offset), then CalendarEquals. Every value below was checked
// against `@js-temporal/polyfill` and native Temporal on Node.
describe("areZonedEqual compares the instant, the time zone and the calendar", () => {
  it.each`
    value1                                                       | value2                                                       | expected | label
    ${"2024-10-27T02:30:00+02:00[Europe/Berlin]"}                | ${"2024-10-27T02:30:00+01:00[Europe/Berlin]"}                | ${false} | ${"the two passes of Berlin's repeated 02:30 are an hour apart"}
    ${"2024-10-27T02:30:00+01:00[Europe/Berlin]"}                | ${"2024-10-27T02:30:00+01:00[Europe/Berlin]"}                | ${true}  | ${"one pass of Berlin's repeated 02:30 equals itself"}
    ${"2024-04-07T01:45:00+11:00[Australia/Lord_Howe]"}          | ${"2024-04-07T01:45:00+10:30[Australia/Lord_Howe]"}          | ${false} | ${"Lord Howe's 30-minute fall-back overlap is two instants"}
    ${"2024-04-06T23:30:00-03:00[America/Santiago]"}             | ${"2024-04-06T23:30:00-04:00[America/Santiago]"}             | ${false} | ${"the two passes of Santiago's repeated 23:30 are an hour apart"}
    ${"2024-01-01T00:00:00+00:00[UTC]"}                          | ${"2024-01-01T00:00:00+00:00[Etc/UTC]"}                      | ${true}  | ${"UTC and Etc/UTC are one time zone"}
    ${"2024-01-01T00:00:00+00:00[Etc/GMT]"}                      | ${"2024-01-01T00:00:00+00:00[UTC]"}                          | ${true}  | ${"Etc/GMT and UTC are one time zone"}
    ${"2024-01-01T12:00:00+01:00[europe/berlin]"}                | ${"2024-01-01T12:00:00+01:00[Europe/Berlin]"}                | ${true}  | ${"identifiers match in any letter case"}
    ${"2024-01-01T05:30:00+05:30[+05:30]"}                       | ${"2024-01-01T05:30:00+05:30[+05:30]"}                       | ${true}  | ${"the same offset zone and instant"}
    ${"2024-01-01T05:30:00+05:30[+05:30]"}                       | ${"2024-01-01T06:30:00+06:30[+06:30]"}                       | ${false} | ${"different offset zones are different zones"}
    ${"2024-01-01T05:30:00+05:30[+05:30]"}                       | ${"2024-01-01T05:30:00+05:30[+0530]"}                        | ${true}  | ${"+05:30 and +0530 write one offset zone"}
    ${"2024-01-01T00:00:00+00:00[+00:00]"}                       | ${"2024-01-01T00:00:00+00:00[UTC]"}                          | ${false} | ${"an offset zone of zero is not UTC"}
    ${"2024-01-01T05:30:00+05:30[+05:30]"}                       | ${"2024-01-01T05:30:00+05:30[Asia/Kolkata]"}                 | ${false} | ${"an offset zone is not a named zone, even at the same instant"}
    ${"2024-01-01T12:00:00+01:00[Europe/Berlin]"}                | ${"2024-01-01T20:00:00+09:00[Asia/Tokyo]"}                   | ${false} | ${"one instant in two zones is not equal"}
    ${"2024-01-01T12:00:00+01:00[Europe/Berlin][u-ca=japanese]"} | ${"2024-01-01T12:00:00+01:00[Europe/Berlin]"}                | ${false} | ${"a non-ISO calendar annotation is invalid input here, so no calendar can differ"}
    ${"2024-01-01T12:00:00+01:00[Europe/Berlin][u-ca=japanese]"} | ${"2024-01-01T12:00:00+01:00[Europe/Berlin][u-ca=japanese]"} | ${false} | ${"two values with the same non-ISO calendar are still invalid input"}
    ${"2024-01-01T12:00:00+01:00[Europe/Berlin]"}                | ${"invalid"}                                                 | ${false} | ${"an invalid second value keeps the sentinel"}
    ${"invalid"}                                                 | ${"2024-01-01T12:00:00+01:00[Europe/Berlin]"}                | ${false} | ${"an invalid first value keeps the sentinel"}
  `(
    "returns $expected when comparing $value1 to $value2 ($label)",
    ({
      value1,
      value2,
      expected,
    }: {
      value1: string;
      value2: string;
      expected: boolean;
    }) => {
      expect(areZonedEqual(value1, value2)).toBe(expected);
      expect(areZonedEqual(value2, value1)).toBe(expected);
    },
  );
});

// An IANA link is one zone with its target only where the host can resolve it (temporalCompat D19):
// the expected value is the host's own answer, so the rows hold on every engine.
describe("areZonedEqual across an IANA link pair", () => {
  it.each`
    value1                                        | value2                                       | zone1              | zone2
    ${"2024-01-01T00:00:00+02:00[Europe/Kiev]"}   | ${"2024-01-01T00:00:00+02:00[Europe/Kyiv]"}  | ${"Europe/Kiev"}   | ${"Europe/Kyiv"}
    ${"2024-01-01T05:30:00+05:30[Asia/Calcutta]"} | ${"2024-01-01T05:30:00+05:30[Asia/Kolkata]"} | ${"Asia/Calcutta"} | ${"Asia/Kolkata"}
  `(
    "matches the host's answer for $zone1 and $zone2 at one instant",
    ({ value1, value2, zone1, zone2 }: Record<string, string>) => {
      expect(areZonedEqual(value1, value2)).toBe(
        linkPairIsOneZone(zone1, zone2),
      );
    },
  );
});
