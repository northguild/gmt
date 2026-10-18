import { Temporal } from "@js-temporal/polyfill";
import { LEAP_SECOND_STEPS } from "../../internal/leapSeconds";
import {
  mockTemporalInstantFromEpochNanosecondsThrow,
  mockTemporalPlainDateTimeFromThrow,
  mockTemporalPlainTimeFromThrow,
} from "../../test/mocks";
import { gnssToUtc } from "./gnssToUtc";
import { utcToGnss } from "./utcToGnss";

describe("gnssToUtc", () => {
  // UTC = scale + (TAI − scale) − (TAI − UTC).
  it.each`
    system   | value                                  | expected                            | why
    ${"GPS"} | ${"2024-01-01T00:00:18 GPS"}           | ${"2024-01-01T00:00:00Z"}           | ${"37 − 19"}
    ${"GPS"} | ${"1980-01-06T00:00:00 GPS"}           | ${"1980-01-06T00:00:00Z"}           | ${"the GPS epoch"}
    ${"GPS"} | ${"2017-01-01T00:00:17 GPS"}           | ${"2016-12-31T23:59:60Z"}           | ${"the inserted second"}
    ${"GPS"} | ${"2017-01-01T00:00:17.25 GPS"}        | ${"2016-12-31T23:59:60.25Z"}        | ${"the inserted second, fraction kept"}
    ${"GPS"} | ${"2017-01-01T00:00:16 GPS"}           | ${"2016-12-31T23:59:59Z"}           | ${"the second before the insertion"}
    ${"GPS"} | ${"2017-01-01T00:00:18 GPS"}           | ${"2017-01-01T00:00:00Z"}           | ${"the second after the insertion"}
    ${"GPS"} | ${"2027-06-28T00:00:18 GPS"}           | ${"2027-06-28T00:00:00Z"}           | ${"18 s: the table is closed"}
    ${"GPS"} | ${"2038-11-21T00:00:00 GPS"}           | ${"2038-11-20T23:59:42Z"}           | ${"the third LNAV rollover"}
    ${"GAL"} | ${"1999-08-22T00:00:00 GAL"}           | ${"1999-08-21T23:59:47Z"}           | ${"the Galileo epoch"}
    ${"BDT"} | ${"2024-01-01T00:00:04 BDT"}           | ${"2024-01-01T00:00:00Z"}           | ${"37 − 33"}
    ${"QZS"} | ${"2024-01-01T00:00:18 QZS"}           | ${"2024-01-01T00:00:00Z"}           | ${"37 − 19"}
    ${"IRN"} | ${"1999-08-22T00:00:00 IRN"}           | ${"1999-08-21T23:59:47Z"}           | ${"the NavIC epoch"}
    ${"IRN"} | ${"2024-01-01T00:00:18 IRN"}           | ${"2024-01-01T00:00:00Z"}           | ${"37 − 19, derived"}
    ${"IRN"} | ${"2017-01-01T00:00:17 IRN"}           | ${"2016-12-31T23:59:60Z"}           | ${"the inserted second"}
    ${"GLO"} | ${"2024-01-01T00:00:00 GLO"}           | ${"2024-01-01T00:00:00Z"}           | ${"UTC's own wall clock"}
    ${"GLO"} | ${"2016-12-31T23:59:60 GLO"}           | ${"2016-12-31T23:59:60Z"}           | ${"GLO keeps UTC's leap seconds"}
    ${"GLO"} | ${"2016-12-31T23:59:60.25 GLO"}        | ${"2016-12-31T23:59:60.25Z"}        | ${"GLO keeps UTC's leap seconds, fraction kept"}
    ${"GLO"} | ${"1972-01-01T00:00:00 GLO"}           | ${"1972-01-01T00:00:00Z"}           | ${"the first GLO label"}
    ${"QZS"} | ${"1980-01-06T00:00:00 QZS"}           | ${"1980-01-06T00:00:00Z"}           | ${"the QZSS week epoch"}
    ${"BDT"} | ${"2006-01-01T00:00:00 BDT"}           | ${"2006-01-01T00:00:00Z"}           | ${"the BeiDou epoch: equals UTC"}
    ${"GPS"} | ${"2017-01-01T00:00:16.999999999 GPS"} | ${"2016-12-31T23:59:59.999999999Z"} | ${"1 ns before the inserted second"}
    ${"GPS"} | ${"2017-01-01T00:00:17.999999999 GPS"} | ${"2016-12-31T23:59:60.999999999Z"} | ${"the last nanosecond of the inserted second"}
    ${"GPS"} | ${"9999-12-31T23:59:59.999999999 GPS"} | ${"9999-12-31T23:59:41.999999999Z"} | ${"the last four-digit GPS label: 37 − 19"}
    ${"BDT"} | ${"9999-12-31T23:59:59.999999999 BDT"} | ${"9999-12-31T23:59:55.999999999Z"} | ${"the last four-digit BDT label: 37 − 33"}
    ${"GLO"} | ${"9999-12-31T23:59:59.999999999 GLO"} | ${"9999-12-31T23:59:59.999999999Z"} | ${"the last four-digit GLO label"}
  `(
    "returns $expected for $system $value ($why)",
    ({ system, value, expected }) => {
      expect(gnssToUtc(system, value)).toBe(expected);
    },
  );

  it.each`
    system   | value                                  | why
    ${"GPS"} | ${"1980-01-05T23:59:59.999999999 GPS"} | ${"before the GPS epoch"}
    ${"GPS"} | ${"2016-12-31T23:59:60 GPS"}           | ${"GPS is continuous: no second 60"}
    ${"GPS"} | ${"2024-01-01T00:00:18 GAL"}           | ${"another system's token"}
    ${"GPS"} | ${"2024-01-01T00:00:18 TAI"}           | ${"the TAI token"}
    ${"GAL"} | ${"1999-08-21T23:59:59.999999999 GAL"} | ${"before the Galileo epoch"}
    ${"BDT"} | ${"2005-12-31T23:59:59.999999999 BDT"} | ${"before the BeiDou epoch"}
    ${"QZS"} | ${"1980-01-05T23:59:59.999999999 QZS"} | ${"before the QZSS week epoch"}
    ${"GPS"} | ${"0000-01-01T00:00:00 GPS"}           | ${"the first four-digit year, before the GPS epoch"}
    ${"IRN"} | ${"1999-08-21T23:59:59.999999999 IRN"} | ${"before the NavIC epoch"}
    ${"IRN"} | ${"2016-12-31T23:59:60 IRN"}           | ${"NavIC is continuous: no second 60"}
    ${"IRN"} | ${"2024-01-01T00:00:18 GPS"}           | ${"the GPS token"}
    ${"GLO"} | ${"2017-12-31T23:59:60 GLO"}           | ${"second 60 with no insertion that day"}
    ${"GLO"} | ${"2016-12-31T12:34:60 GLO"}           | ${"second 60 mid-day"}
    ${"GLO"} | ${"1971-12-31T23:59:59.999999999 GLO"} | ${"before 1972"}
    ${"GLO"} | ${"2024-01-01T03:00:00 GLONASST"}      | ${"not a RINEX token"}
  `("returns '' for $system $value ($why)", ({ system, value }) => {
    expect(gnssToUtc(system, value)).toBe("");
  });

  it.each`
    system       | why
    ${"gps"}     | ${"lower case"}
    ${"BDS"}     | ${"the constellation, not a RINEX time token"}
    ${"GLONASS"} | ${"not a RINEX token"}
    ${"NAVIC"}   | ${"not a RINEX token"}
    ${""}        | ${"empty"}
    ${null}      | ${"null"}
  `("returns '' for the system $system ($why)", ({ system }) => {
    expect(gnssToUtc(system, "2024-01-01T00:00:18 GPS")).toBe("");
  });

  it.each`
    value
    ${null}
    ${undefined}
    ${123}
    ${""}
    ${"2024-01-01T00:00:18"}
  `("returns '' for the invalid scale string $value", ({ value }) => {
    expect(gnssToUtc("GPS", value)).toBe("");
  });

  // The time-scale string format (MAR-16.md, String format), with the GPS token.
  it.each`
    value
    ${"2026-01-01t00:00:18 GPS"}
    ${"2026-01-01 00:00:18 GPS"}
    ${"2026-01-01T00:00 GPS"}
    ${"2026-01-01T00:00:18,5 GPS"}
    ${"2026-01-01T00:00:18.1234567890 GPS"}
    ${"2026-01-01T00:00:18. GPS"}
    ${"2026-01-01T00:00:18  GPS"}
    ${"2026-01-01T00:00:18GPS"}
    ${" 2026-01-01T00:00:18 GPS"}
    ${"2026-01-01T00:00:18 GPS "}
    ${"2026-01-01T00:00:18 gps"}
    ${"2026-01-01T00:00:18Z GPS"}
    ${"2026-01-01T00:00:18+00:00 GPS"}
    ${"+002026-01-01T00:00:18 GPS"}
    ${"2026-02-30T00:00:18 GPS"}
    ${"2026-01-01T24:00:00 GPS"}
    ${"2026-01-01T00:60:00 GPS"}
    ${"2026-01-01T00:00:61 GPS"}
    ${"2026-01-01T00:00:18 UTC"}
    ${"2026-01-01T00:00:18 GPST"}
  `(
    "returns '' for the malformed GPS time-scale string $value",
    ({ value }) => {
      expect(gnssToUtc("GPS", value)).toBe("");
    },
  );

  // The time-scale string format (MAR-16.md, String format), with the GAL token.
  it.each`
    value
    ${"2026-01-01t00:00:18 GAL"}
    ${"2026-01-01 00:00:18 GAL"}
    ${"2026-01-01T00:00 GAL"}
    ${"2026-01-01T00:00:18,5 GAL"}
    ${"2026-01-01T00:00:18.1234567890 GAL"}
    ${"2026-01-01T00:00:18. GAL"}
    ${"2026-01-01T00:00:18  GAL"}
    ${"2026-01-01T00:00:18GAL"}
    ${" 2026-01-01T00:00:18 GAL"}
    ${"2026-01-01T00:00:18 GAL "}
    ${"2026-01-01T00:00:18 gal"}
    ${"2026-01-01T00:00:18Z GAL"}
    ${"2026-01-01T00:00:18+00:00 GAL"}
    ${"+002026-01-01T00:00:18 GAL"}
    ${"2026-02-30T00:00:18 GAL"}
    ${"2026-01-01T24:00:00 GAL"}
    ${"2026-01-01T00:60:00 GAL"}
    ${"2026-01-01T00:00:61 GAL"}
    ${"2026-01-01T00:00:18 UTC"}
    ${"2026-01-01T00:00:18 GST"}
    ${"2026-01-01T00:00:18 QZSST"}
    ${"2026-01-01T00:00:18 GLONASST"}
    ${123}
    ${null}
  `(
    "returns '' for the malformed Galileo time-scale string $value",
    ({ value }) => {
      expect(gnssToUtc("GAL", value)).toBe("");
    },
  );

  it.each`
    value                                  | expected
    ${"2026-01-01T00:00:18.5 GAL"}         | ${"2026-01-01T00:00:00.5Z"}
    ${"2026-01-01T00:00:18.000000001 GAL"} | ${"2026-01-01T00:00:00.000000001Z"}
    ${"2026-01-01T00:00:18.100 GAL"}       | ${"2026-01-01T00:00:00.1Z"}
  `("reads the fraction in $value as $expected", ({ value, expected }) => {
    expect(gnssToUtc("GAL", value)).toBe(expected);
  });

  it("returns '' when Temporal.PlainDateTime.from throws", () => {
    mockTemporalPlainDateTimeFromThrow();
    expect(gnssToUtc("GPS", "2024-01-01T00:00:18 GPS")).toBe("");
  });

  it("returns '' when Temporal.Instant.fromEpochNanoseconds throws while writing", () => {
    mockTemporalInstantFromEpochNanosecondsThrow();
    expect(gnssToUtc("GPS", "2024-01-01T00:00:18 GPS")).toBe("");
  });

  it("returns '' when Temporal.PlainTime.from throws while writing the inserted second", () => {
    mockTemporalPlainTimeFromThrow();
    expect(gnssToUtc("GPS", "2017-01-01T00:00:17 GPS")).toBe("");
  });
});

// Property 1: for each system, around every table row and through every inserted second, a UTC
// instant written on the scale reads back as the same UTC string.
describe.each`
  system   | epoch
  ${"GPS"} | ${"1980-01-06T00:00:00Z"}
  ${"GAL"} | ${"1999-08-21T23:59:47Z"}
  ${"BDT"} | ${"2006-01-01T00:00:00Z"}
  ${"QZS"} | ${"1980-01-06T00:00:00Z"}
  ${"GLO"} | ${"1972-01-01T00:00:00Z"}
  ${"IRN"} | ${"1999-08-21T23:59:47Z"}
`("utcToGnss and gnssToUtc round trip: $system", ({ system, epoch }) => {
  const offsets = [
    -2_000_000_000n,
    -1_000_000_000n,
    -1n,
    0n,
    1n,
    1_000_000_000n,
  ];
  const cases = LEAP_SECOND_STEPS.at.flatMap((at, index) => {
    const around = offsets.map((offset) => ({
      iso: Temporal.Instant.fromEpochNanoseconds(at + offset).toString(),
    }));
    if (index === 0) {
      return around;
    }
    const day = Temporal.Instant.fromEpochNanoseconds(at)
      .toZonedDateTimeISO("UTC")
      .toPlainDate()
      .subtract({ days: 1 })
      .toString();
    return [
      ...around,
      { iso: `${day}T23:59:60Z` },
      { iso: `${day}T23:59:60.5Z` },
    ];
  });

  it.each(cases)(
    `gnssToUtc(${system}, utcToGnss(${system}, $iso)) returns $iso`,
    ({ iso }) => {
      const label = utcToGnss(system, iso);
      if (label !== "") {
        expect(gnssToUtc(system, label)).toBe(iso);
      } else {
        // Only the instants before the system's epoch have no label.
        expect(Temporal.Instant.compare(iso, epoch)).toBe(-1);
      }
    },
  );
});
