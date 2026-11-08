import { Temporal } from "../../internal/temporal";
import { mockTemporalInstantFromThrow } from "../../test/mocks";
import { hostileProxy, revokedProxy } from "../../test/hostileValues";
import {
  battleTestTimeZones,
  sameInstantBattleCases,
} from "../../test/timeZoneMatrix";
import { toTai64n } from "./toTai64n";

/**
 * The 2016 inserted second written as local wall-clock time in every battle-test zone: the
 * zone's reading of 2016-12-31T23:59:59Z with its second field set to 60. None of these zones has
 * a sub-minute offset there, so the local second is 59 and the inserted second follows it
 * (ITU-R TF.460-6 Annex 1 §2.2).
 */
const insertedSecondBattleCases = battleTestTimeZones.map((timeZone) => ({
  timeZone,
  value: Temporal.Instant.from("2016-12-31T23:59:59Z")
    .toZonedDateTimeISO(timeZone)
    .toString()
    .replace(/:59(?=[+-])/, ":60"),
}));

describe("toTai64n", () => {
  // Label = 2^62 + TAI seconds since 1970 TAI, then nanoseconds, in hex (Bernstein, TAI64 § TAI64N;
  // daemontools tai64n § Timestamps). TAI = UTC + the Leap_Second.dat row in force.
  it.each`
    isoString                                   | expected                       | why
    ${"1992-06-02T08:06:43Z"}                   | ${"@400000002a2b2c2d00000000"} | ${"26 s, Bernstein's example"}
    ${"1999-08-24T04:03:43.7874925Z"}           | ${"@4000000037c219bf2ef02e94"} | ${"32 s, daemontools' example"}
    ${"1999-08-23T21:03:43.7874925-07:00"}      | ${"@4000000037c219bf2ef02e94"} | ${"the same instant at -07:00"}
    ${"2026-01-01T00:00:00Z"}                   | ${"@400000006955b92500000000"} | ${"37 s"}
    ${"1972-01-01T00:00:00Z"}                   | ${"@4000000003c2670a00000000"} | ${"10 s, the first table instant"}
    ${"9999-12-31T23:59:59.999999999Z"}         | ${"@4000003afff441a43b9ac9ff"} | ${"the last four-digit UTC instant"}
    ${"2024-03-10T14:30:00.000000001Z"}         | ${"@4000000065edc40d00000001"} | ${"1 ns survives"}
    ${"2024-03-10T14:30:00.123456789Z"}         | ${"@4000000065edc40d075bcd15"} | ${"all nine fraction digits survive"}
    ${"2024-03-10T14:30:00.999999999Z"}         | ${"@4000000065edc40d3b9ac9ff"} | ${"the largest nanosecond counter"}
    ${"1972-01-01T00:00:00.000000001Z"}         | ${"@4000000003c2670a00000001"} | ${"1 ns after the table starts"}
    ${"1971-12-31T19:00:00-05:00"}              | ${"@4000000003c2670a00000000"} | ${"first table instant at -05:00"}
    ${"+010000-01-01T00:59:59.999999999+01:00"} | ${"@4000003afff441a43b9ac9ff"} | ${"last instant at +01:00"}
  `(
    "returns '$expected' for '$isoString' ($why)",
    ({ isoString, expected }) => {
      expect(toTai64n(isoString)).toBe(expected);
    },
  );

  // Out of the table: the input is longer than the 40 characters Vitest prints of a title value.
  it("reads an offset with a bracketed zone", () => {
    expect(
      toTai64n("1999-08-23T21:03:43.7874925-07:00[America/Los_Angeles]"),
    ).toBe("@4000000037c219bf2ef02e94");
  });

  // An inserted second has its own label: the old offset + 1 s (TF.460-6 Annex 1 §2.2).
  it.each`
    isoString                           | expected
    ${"2016-12-31T23:59:60.5Z"}         | ${"@40000000586846a41dcd6500"}
    ${"2016-12-31T23:59:60.999999999Z"} | ${"@40000000586846a43b9ac9ff"}
  `(
    "maps the inserted second '$isoString' to '$expected'",
    ({ isoString, expected }) => {
      expect(toTai64n(isoString)).toBe(expected);
    },
  );

  // Every inserted second, 1972-06-30 to 2016-12-31 (27 in all; Leap_Second.dat rows, TF.460-6
  // Annex 1 §2.2): second 60 takes the old offset + 1 s, 23:59:59 the old offset, and the next
  // 00:00:00 the new one.
  it.each`
    day             | before59                       | second60                       | after00
    ${"1972-06-30"} | ${"@4000000004b2580900000000"} | ${"@4000000004b2580a00000000"} | ${"@4000000004b2580b00000000"}
    ${"1972-12-31"} | ${"@4000000005a4ec0a00000000"} | ${"@4000000005a4ec0b00000000"} | ${"@4000000005a4ec0c00000000"}
    ${"1973-12-31"} | ${"@4000000007861f8b00000000"} | ${"@4000000007861f8c00000000"} | ${"@4000000007861f8d00000000"}
    ${"1974-12-31"} | ${"@400000000967530c00000000"} | ${"@400000000967530d00000000"} | ${"@400000000967530e00000000"}
    ${"1975-12-31"} | ${"@400000000b48868d00000000"} | ${"@400000000b48868e00000000"} | ${"@400000000b48868f00000000"}
    ${"1976-12-31"} | ${"@400000000d2b0b8e00000000"} | ${"@400000000d2b0b8f00000000"} | ${"@400000000d2b0b9000000000"}
    ${"1977-12-31"} | ${"@400000000f0c3f0f00000000"} | ${"@400000000f0c3f1000000000"} | ${"@400000000f0c3f1100000000"}
    ${"1978-12-31"} | ${"@4000000010ed729000000000"} | ${"@4000000010ed729100000000"} | ${"@4000000010ed729200000000"}
    ${"1979-12-31"} | ${"@4000000012cea61100000000"} | ${"@4000000012cea61200000000"} | ${"@4000000012cea61300000000"}
    ${"1981-06-30"} | ${"@40000000159fca9200000000"} | ${"@40000000159fca9300000000"} | ${"@40000000159fca9400000000"}
    ${"1982-06-30"} | ${"@400000001780fe1300000000"} | ${"@400000001780fe1400000000"} | ${"@400000001780fe1500000000"}
    ${"1983-06-30"} | ${"@400000001962319400000000"} | ${"@400000001962319500000000"} | ${"@400000001962319600000000"}
    ${"1985-06-30"} | ${"@400000001d25ea1500000000"} | ${"@400000001d25ea1600000000"} | ${"@400000001d25ea1700000000"}
    ${"1987-12-31"} | ${"@4000000021dae51600000000"} | ${"@4000000021dae51700000000"} | ${"@4000000021dae51800000000"}
    ${"1989-12-31"} | ${"@40000000259e9d9700000000"} | ${"@40000000259e9d9800000000"} | ${"@40000000259e9d9900000000"}
    ${"1990-12-31"} | ${"@40000000277fd11800000000"} | ${"@40000000277fd11900000000"} | ${"@40000000277fd11a00000000"}
    ${"1992-06-30"} | ${"@400000002a50f59900000000"} | ${"@400000002a50f59a00000000"} | ${"@400000002a50f59b00000000"}
    ${"1993-06-30"} | ${"@400000002c32291a00000000"} | ${"@400000002c32291b00000000"} | ${"@400000002c32291c00000000"}
    ${"1994-06-30"} | ${"@400000002e135c9b00000000"} | ${"@400000002e135c9c00000000"} | ${"@400000002e135c9d00000000"}
    ${"1995-12-31"} | ${"@4000000030e7241c00000000"} | ${"@4000000030e7241d00000000"} | ${"@4000000030e7241e00000000"}
    ${"1997-06-30"} | ${"@4000000033b8489d00000000"} | ${"@4000000033b8489e00000000"} | ${"@4000000033b8489f00000000"}
    ${"1998-12-31"} | ${"@40000000368c101e00000000"} | ${"@40000000368c101f00000000"} | ${"@40000000368c102000000000"}
    ${"2005-12-31"} | ${"@4000000043b71b9f00000000"} | ${"@4000000043b71ba000000000"} | ${"@4000000043b71ba100000000"}
    ${"2008-12-31"} | ${"@40000000495c07a000000000"} | ${"@40000000495c07a100000000"} | ${"@40000000495c07a200000000"}
    ${"2012-06-30"} | ${"@400000004fef932100000000"} | ${"@400000004fef932200000000"} | ${"@400000004fef932300000000"}
    ${"2015-06-30"} | ${"@4000000055932da200000000"} | ${"@4000000055932da300000000"} | ${"@4000000055932da400000000"}
    ${"2016-12-31"} | ${"@40000000586846a300000000"} | ${"@40000000586846a400000000"} | ${"@40000000586846a500000000"}
  `(
    "labels the inserted second ending $day and the seconds either side",
    ({ day, before59, second60, after00 }) => {
      const next = Temporal.PlainDate.from(day).add({ days: 1 }).toString();
      expect(toTai64n(`${day}T23:59:59Z`)).toBe(before59);
      expect(toTai64n(`${day}T23:59:60Z`)).toBe(second60);
      expect(toTai64n(`${next}T00:00:00Z`)).toBe(after00);
    },
  );

  it.each(insertedSecondBattleCases)(
    "returns @40000000586846a400000000 for the 2016 inserted second written in $timeZone",
    ({ value }) => {
      expect(toTai64n(value)).toBe("@40000000586846a400000000");
    },
  );

  // Same instant, any zone: 2024-02-29T00:00:00Z is 37 s ahead of UTC.
  it.each(sameInstantBattleCases)(
    "returns @4000000065dfc92500000000 for 2024-02-29T00:00:00Z written in $timeZone",
    ({ value, utc }) => {
      expect(toTai64n(value)).toBe("@4000000065dfc92500000000");
      expect(toTai64n(value)).toBe(toTai64n(utc));
    },
  );

  // Before the table, past year 9999, no insertion that day, and unreadable input.
  it.each`
    isoString                                | why
    ${"1971-12-31T23:59:59.999999999Z"}      | ${"1 ns before the table"}
    ${"1970-01-01T00:00:00Z"}                | ${"the Unix epoch, before 1972"}
    ${"+010000-01-01T00:00:00Z"}             | ${"year 10000"}
    ${"9999-12-31T23:59:60Z"}                | ${"second 60 with no insertion that day"}
    ${"2017-12-31T23:59:60Z"}                | ${"second 60 with no insertion that day"}
    ${"9999-12-31T23:59:59.999999999-01:00"} | ${"last instant + 1 h at -01:00"}
    ${"1972-01-01T00:59:59.999999999+01:00"} | ${"1 ns before the table, written at +01:00"}
    ${"1971-12-31T23:59:60Z"}                | ${"second 60 before the table"}
    ${"1973-06-30T23:59:60Z"}                | ${"second 60 on a June 30 with no insertion"}
    ${"2016-06-30T23:59:60Z"}                | ${"second 60 on a June 30 with no insertion"}
    ${"2016-12-31T23:59:61Z"}                | ${"second 61"}
    ${"2016-12-31T22:59:60Z"}                | ${"second 60 not before midnight"}
    ${"2024-02-30T00:00:00Z"}                | ${"a day that does not exist"}
    ${"2024-03-10"}                          | ${"no time"}
    ${"2024-03-10T14:30:00"}                 | ${"no offset"}
    ${""}                                    | ${"the empty string"}
  `("returns '' for '$isoString' ($why)", ({ isoString }) => {
    expect(toTai64n(isoString)).toBe("");
  });

  it.each`
    value             | label
    ${null}           | ${"null"}
    ${undefined}      | ${"undefined"}
    ${123}            | ${"123"}
    ${12n}            | ${"12n"}
    ${true}           | ${"true"}
    ${{}}             | ${"{}"}
    ${[]}             | ${"[]"}
    ${Symbol("x")}    | ${"a symbol"}
    ${hostileProxy()} | ${"a hostile proxy"}
    ${revokedProxy()} | ${"a revoked proxy"}
  `("returns '' for the non-string $label", ({ value }) => {
    expect(toTai64n(value)).toBe("");
  });

  it("returns '' when Temporal.Instant.from throws on a second-60 string", () => {
    mockTemporalInstantFromThrow();
    expect(toTai64n("2016-12-31T23:59:60Z")).toBe("");
  });
});
