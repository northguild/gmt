import { sameInstantBattleCases, unixEpochBattleCases } from "../../test";
import { mockTemporalInstantFromThrow } from "../../test/mocks";
import { etaAtZone } from "./etaAtZone";

describe("etaAtZone", () => {
  it.each`
    arrivalUtc                       | targetZone               | expected
    ${"2024-06-15T12:30:00Z"}        | ${"Asia/Tokyo"}          | ${"2024-06-15T21:30:00+09:00[Asia/Tokyo]"}
    ${"2024-06-15T12:30:00Z"}        | ${"America/Los_Angeles"} | ${"2024-06-15T05:30:00-07:00[America/Los_Angeles]"}
    ${"2024-06-15T12:30:00Z"}        | ${"UTC"}                 | ${"2024-06-15T12:30:00+00:00[UTC]"}
    ${"2024-06-15T12:30:00+02:00"}   | ${"Pacific/Apia"}        | ${"2024-06-15T23:30:00+13:00[Pacific/Apia]"}
    ${"2024-06-15T12:30:00-05:00[America/New_York]"} | ${"Asia/Kolkata"} | ${"2024-06-15T23:00:00+05:30[Asia/Kolkata]"}
    ${"2024-06-15T12:30:00.123456789Z"} | ${"Asia/Kathmandu"} | ${"2024-06-15T18:15:00.123456789+05:45[Asia/Kathmandu]"}
    ${"2024-06-15T23:30:00Z"}        | ${"Pacific/Kiritimati"}  | ${"2024-06-16T13:30:00+14:00[Pacific/Kiritimati]"}
  `(
    "renders $arrivalUtc in $targetZone as $expected",
    ({ arrivalUtc, targetZone, expected }) => {
      expect(etaAtZone(arrivalUtc, targetZone)).toBe(expected);
    },
  );

  // A moment has exactly one wall time in a zone; on a fall-back night two moments print the
  // same wall time and the offset tells them apart. On a spring-forward night the skipped hour
  // never appears.
  it.each`
    arrivalUtc                | targetZone            | expected                                          | night
    ${"2024-11-03T05:30:00Z"} | ${"America/New_York"} | ${"2024-11-03T01:30:00-04:00[America/New_York]"} | ${"first 01:30 of the fall-back night"}
    ${"2024-11-03T06:30:00Z"} | ${"America/New_York"} | ${"2024-11-03T01:30:00-05:00[America/New_York]"} | ${"second 01:30 of the fall-back night"}
    ${"2024-03-10T06:59:59Z"} | ${"America/New_York"} | ${"2024-03-10T01:59:59-05:00[America/New_York]"} | ${"last second before the spring-forward"}
    ${"2024-03-10T07:00:00Z"} | ${"America/New_York"} | ${"2024-03-10T03:00:00-04:00[America/New_York]"} | ${"first second after it: 02:00 never appears"}
    ${"2024-04-06T15:00:00Z"} | ${"Australia/Lord_Howe"} | ${"2024-04-07T01:30:00+10:30[Australia/Lord_Howe]"} | ${"half-hour fall-back, second pass"}
  `(
    "prints the $night with the offset that disambiguates it",
    ({ arrivalUtc, targetZone, expected }) => {
      expect(etaAtZone(arrivalUtc, targetZone)).toBe(expected);
    },
  );

  it.each(sameInstantBattleCases)(
    "renders the battle instant in $timeZone exactly as Temporal does",
    ({ timeZone, utc, value }) => {
      expect(etaAtZone(utc, timeZone)).toBe(value);
    },
  );

  it.each(unixEpochBattleCases)(
    "renders the Unix epoch in $timeZone with the historical offset",
    ({ timeZone, utc, value }) => {
      expect(etaAtZone(utc, timeZone)).toBe(value);
    },
  );

  it.each`
    arrivalUtc                 | targetZone      | reason
    ${"2024-06-15T12:30:00"}   | ${"Asia/Tokyo"} | ${"no offset designator"}
    ${"2024-06-15 12:30:00Z"}  | ${"Asia/Tokyo"} | ${"space separator"}
    ${"2016-12-31T23:59:60Z"}  | ${"Asia/Tokyo"} | ${"leap second"}
    ${"2024-06-15T12:30:00Z"}  | ${"Asia/Tokio"} | ${"zone does not exist"}
    ${"2024-06-15T12:30:00Z"}  | ${""}           | ${"empty zone"}
    ${""}                      | ${"Asia/Tokyo"} | ${"empty instant"}
    ${"invalid"}               | ${"Asia/Tokyo"} | ${"garbage instant"}
  `(
    "returns the sentinel for $arrivalUtc in $targetZone ($reason)",
    ({ arrivalUtc, targetZone }) => {
      expect(etaAtZone(arrivalUtc, targetZone)).toBe("");
    },
  );

  it("returns the sentinel when the instant parse throws", () => {
    mockTemporalInstantFromThrow();
    expect(etaAtZone("2024-06-15T12:30:00Z", "Asia/Tokyo")).toBe("");
  });
});
