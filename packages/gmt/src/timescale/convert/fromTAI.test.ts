import { Temporal } from "../../internal/temporal";
import { LEAP_SECOND_STEPS } from "../../internal";
import {
  mockTemporalInstantFromEpochNanosecondsThrow,
  mockTemporalPlainDateTimeFromThrow,
  mockTemporalPlainTimeFromThrow,
} from "../../test/mocks";
import { fromTAI } from "./fromTAI";
import { toTAI } from "./toTAI";

describe("fromTAI", () => {
  // UTC = TAI − (TAI − UTC), the IERS Leap_Second.dat row in force (Bulletin C 72).
  it.each`
    taiString                              | expected                            | why
    ${"2026-01-01T00:00:37 TAI"}           | ${"2026-01-01T00:00:00Z"}           | ${"37 s"}
    ${"2017-01-01T00:00:35 TAI"}           | ${"2016-12-31T23:59:59Z"}           | ${"36 s, before the insertion"}
    ${"2017-01-01T00:00:37 TAI"}           | ${"2017-01-01T00:00:00Z"}           | ${"37 s, after the insertion"}
    ${"1972-01-01T00:00:10 TAI"}           | ${"1972-01-01T00:00:00Z"}           | ${"10 s, the first TAI instant of the table"}
    ${"2027-06-28T00:00:37 TAI"}           | ${"2027-06-28T00:00:00Z"}           | ${"37 s, the table is closed"}
    ${"9999-12-31T23:59:59.999999999 TAI"} | ${"9999-12-31T23:59:22.999999999Z"} | ${"the last four-digit TAI label"}
    ${"2017-01-01T00:00:35.999999999 TAI"} | ${"2016-12-31T23:59:59.999999999Z"} | ${"36 s, 1 ns before the inserted second"}
  `("returns $expected for $taiString ($why)", ({ taiString, expected }) => {
    expect(fromTAI(taiString)).toBe(expected);
  });

  // Inside an inserted second UTC reads 23:59:60 (ITU-R TF.460-6 Annex 3).
  it.each`
    taiString                              | expected
    ${"2017-01-01T00:00:36 TAI"}           | ${"2016-12-31T23:59:60Z"}
    ${"2017-01-01T00:00:36.5 TAI"}         | ${"2016-12-31T23:59:60.5Z"}
    ${"2017-01-01T00:00:36.123456789 TAI"} | ${"2016-12-31T23:59:60.123456789Z"}
    ${"1972-07-01T00:00:10 TAI"}           | ${"1972-06-30T23:59:60Z"}
    ${"2017-01-01T00:00:36.999999999 TAI"} | ${"2016-12-31T23:59:60.999999999Z"}
  `(
    "returns the inserted second $expected for $taiString",
    ({ taiString, expected }) => {
      expect(fromTAI(taiString)).toBe(expected);
    },
  );

  it.each`
    taiString                              | why
    ${"1972-01-01T00:00:09.999999999 TAI"} | ${"before 1972-01-01T00:00:10 TAI"}
    ${"2016-12-31T23:59:60 TAI"}           | ${"TAI has no leap seconds"}
    ${"2024-01-01T00:00:37 GPS"}           | ${"wrong token"}
    ${"0000-01-01T00:00:00 TAI"}           | ${"the first four-digit year, before 1972"}
  `("returns '' for $taiString ($why)", ({ taiString }) => {
    expect(fromTAI(taiString)).toBe("");
  });

  // The time-scale string format (MAR-16.md, String format): extended date-time, seconds
  // required, 1-9 fraction digits after ".", one space, the token.
  it.each`
    taiString
    ${"2026-01-01t00:00:37 TAI"}
    ${"2026-01-01 00:00:37 TAI"}
    ${"2026-01-01T00:00 TAI"}
    ${"2026-01-01T00:00:37,5 TAI"}
    ${"2026-01-01T00:00:37.1234567890 TAI"}
    ${"2026-01-01T00:00:37. TAI"}
    ${"2026-01-01T00:00:37  TAI"}
    ${"2026-01-01T00:00:37TAI"}
    ${" 2026-01-01T00:00:37 TAI"}
    ${"2026-01-01T00:00:37 TAI "}
    ${"2026-01-01T00:00:37 tai"}
    ${"2026-01-01T00:00:37Z TAI"}
    ${"2026-01-01T00:00:37+00:00 TAI"}
    ${"+002026-01-01T00:00:37 TAI"}
    ${"2026-02-30T00:00:37 TAI"}
    ${"2026-01-01T24:00:00 TAI"}
    ${"2026-01-01T00:60:00 TAI"}
    ${"2026-01-01T00:00:61 TAI"}
    ${"2026-01-01T00:00:37 UTC"}
    ${"2026-01-01T00:00:37 GST"}
    ${"2026-01-01T00:00:37 QZSST"}
    ${"2026-01-01T00:00:37 GLONASST"}
    ${123}
    ${null}
  `(
    "returns '' for the malformed time-scale string $taiString",
    ({ taiString }) => {
      expect(fromTAI(taiString)).toBe("");
    },
  );

  it.each`
    taiString                              | expected
    ${"2026-01-01T00:00:37.5 TAI"}         | ${"2026-01-01T00:00:00.5Z"}
    ${"2026-01-01T00:00:37.000000001 TAI"} | ${"2026-01-01T00:00:00.000000001Z"}
    ${"2026-01-01T00:00:37.100 TAI"}       | ${"2026-01-01T00:00:00.1Z"}
  `(
    "reads the fraction in $taiString as $expected",
    ({ taiString, expected }) => {
      expect(fromTAI(taiString)).toBe(expected);
    },
  );

  it("returns '' when Temporal.PlainDateTime.from throws", () => {
    mockTemporalPlainDateTimeFromThrow();
    expect(fromTAI("2026-01-01T00:00:37 TAI")).toBe("");
  });

  it("returns '' when Temporal.Instant.fromEpochNanoseconds throws while writing", () => {
    mockTemporalInstantFromEpochNanosecondsThrow();
    expect(fromTAI("2026-01-01T00:00:37 TAI")).toBe("");
  });

  it("returns '' when Temporal.PlainTime.from throws while writing second 60", () => {
    mockTemporalPlainTimeFromThrow();
    expect(fromTAI("2017-01-01T00:00:36 TAI")).toBe("");
  });
});

describe("toTAI and fromTAI round trip", () => {
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

  it.each(cases)("fromTAI(toTAI($iso)) returns $iso", ({ iso }) => {
    const tai = toTAI(iso);
    if (tai !== "") {
      expect(fromTAI(tai)).toBe(iso);
    } else {
      // Only the instants before the table's first row have no TAI label.
      expect(Temporal.Instant.compare(iso, "1972-01-01T00:00:00Z")).toBe(-1);
    }
  });
});
