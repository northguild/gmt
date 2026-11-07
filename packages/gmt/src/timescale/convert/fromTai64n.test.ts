import { Temporal } from "../../internal/temporal";
import {
  mockTemporalInstantFromEpochNanosecondsThrow,
  mockTemporalPlainTimeFromThrow,
} from "../../test/mocks";
import { hostileProxy, revokedProxy } from "../../test/hostileValues";
import { fromTai64n } from "./fromTai64n";
import { toTai64n } from "./toTai64n";

describe("fromTai64n", () => {
  // UTC = TAI − (TAI − UTC), the Leap_Second.dat row in force; label = 2^62 + TAI seconds since
  // 1970 TAI (Bernstein, TAI64 § TAI64 labels), so the TAI − UTC offset is subtracted after the 2^62.
  it.each`
    label                          | expected                            | why
    ${"@400000002a2b2c2d00000000"} | ${"1992-06-02T08:06:43Z"}           | ${"26 s, Bernstein's example"}
    ${"@400000002a2b2c2d"}         | ${"1992-06-02T08:06:43Z"}           | ${"TAI64 with the @"}
    ${"400000002a2b2c2d"}          | ${"1992-06-02T08:06:43Z"}           | ${"TAI64 without the @"}
    ${"400000002a2b2c2d00000000"}  | ${"1992-06-02T08:06:43Z"}           | ${"TAI64N without the @"}
    ${"@400000002A2B2C2D00000000"} | ${"1992-06-02T08:06:43Z"}           | ${"upper case"}
    ${"@400000002a2B2c2D00000000"} | ${"1992-06-02T08:06:43Z"}           | ${"mixed case"}
    ${"@4000000037c219bf2ef02e94"} | ${"1999-08-24T04:03:43.7874925Z"}   | ${"32 s, daemontools' example"}
    ${"@400000006955b92500000000"} | ${"2026-01-01T00:00:00Z"}           | ${"37 s"}
    ${"@40000000586846a300000000"} | ${"2016-12-31T23:59:59Z"}           | ${"36 s, before the insertion"}
    ${"@40000000586846a500000000"} | ${"2017-01-01T00:00:00Z"}           | ${"37 s, after the insertion"}
    ${"@4000000003c2670a00000000"} | ${"1972-01-01T00:00:00Z"}           | ${"10 s, the first table instant"}
    ${"@4000003afff441a43b9ac9ff"} | ${"9999-12-31T23:59:59.999999999Z"} | ${"the last four-digit result"}
    ${"@4000000037c219bf00000001"} | ${"1999-08-24T04:03:43.000000001Z"} | ${"1 ns survives"}
  `("returns '$expected' for '$label' ($why)", ({ label, expected }) => {
    expect(fromTai64n(label)).toBe(expected);
  });

  // An inserted second reads 23:59:60 (ITU-R TF.460-6 Annex 3).
  it.each`
    label                                  | expected
    ${"@40000000586846a400000000"}         | ${"2016-12-31T23:59:60Z"}
    ${"@40000000586846a41dcd6500"}         | ${"2016-12-31T23:59:60.5Z"}
    ${"@40000000586846a43b9ac9ff"}         | ${"2016-12-31T23:59:60.999999999Z"}
    ${"@40000000586846a41dcd65003b9ac9ff"} | ${"2016-12-31T23:59:60.5Z"}
  `(
    "returns '$expected' for the inserted second '$label'",
    ({ label, expected }) => {
      expect(fromTai64n(label)).toBe(expected);
    },
  );

  // TAI64NA attoseconds are checked and dropped: truncated, never rounded, never carried.
  it.each`
    label                                  | expected
    ${"@4000000037c219bf2ef02e9400000000"} | ${"1999-08-24T04:03:43.7874925Z"}
    ${"@4000000037c219bf2ef02e9400000001"} | ${"1999-08-24T04:03:43.7874925Z"}
    ${"@4000000037c219bf2ef02e943b9ac9ff"} | ${"1999-08-24T04:03:43.7874925Z"}
    ${"@4000000037c219bf3b9ac9ff3b9ac9ff"} | ${"1999-08-24T04:03:43.999999999Z"}
  `(
    "returns '$expected' for the TAI64NA label '$label'",
    ({ label, expected }) => {
      expect(fromTai64n(label)).toBe(expected);
    },
  );

  // Before 1972-01-01T00:00:10 TAI, reserved, past year 9999, and counters above 999999999.
  it.each`
    label                                  | why
    ${"@4000000003c2670900000000"}         | ${"1 s before 1972-01-01T00:00:10 TAI"}
    ${"@4000000003c267093b9ac9ff"}         | ${"1 ns before 1972-01-01T00:00:10 TAI"}
    ${"@4000000000000000"}                 | ${"1970 TAI, before 1972"}
    ${"@3fffffffffffffff"}                 | ${"before 1970 TAI"}
    ${"@4000003afff441a500000000"}         | ${"UTC 10000-01-01"}
    ${"@7fffffffffffffff"}                 | ${"the last label before the reserved range"}
    ${"@8000000000000000"}                 | ${"reserved, 2^63"}
    ${"@ffffffffffffffff"}                 | ${"reserved, 2^64 - 1"}
    ${"@0000000000000000"}                 | ${"label 0, before 1970 TAI"}
    ${"@4000000003c26709"}                 | ${"TAI64, 1 s before 1972-01-01T00:00:10 TAI"}
    ${"@4000003afff441a5"}                 | ${"TAI64, UTC 10000-01-01"}
    ${"@4000000003c267093b9ac9ff3b9ac9ff"} | ${"TAI64NA, 1 ns before 1972-01-01T00:00:10 TAI"}
    ${"@4000003afff441a5000000003b9ac9ff"} | ${"TAI64NA, UTC 10000-01-01"}
    ${"@4000003afff441a500000001"}         | ${"1 ns past the last four-digit result"}
    ${"@4000000003c2670a3b9aca00"}         | ${"nanoseconds 10^9 at the first table instant"}
    ${"@40000000586846a43b9aca00"}         | ${"nanoseconds 10^9 in an inserted second, not the next second"}
    ${"@40000000586846a4000000003b9aca00"} | ${"attoseconds 10^9 in an inserted second"}
    ${"@4000000037c219bf2ef02e94ffffffff"} | ${"attoseconds 0xffffffff"}
    ${"@4000000037c219bf3b9aca00"}         | ${"nanoseconds 1000000000"}
    ${"@4000000037c219bfffffffff"}         | ${"nanoseconds 0xffffffff"}
    ${"@4000000037c219bf2ef02e943b9aca00"} | ${"attoseconds 1000000000"}
  `("returns '' for '$label' ($why)", ({ label }) => {
    expect(fromTai64n(label)).toBe("");
  });

  // Whole label only: lengths, prefix, characters, surrounding text.
  it.each`
    label                                        | why
    ${""}                                        | ${"the empty string"}
    ${"@"}                                       | ${"only the @"}
    ${"@@400000002a2b2c2d"}                      | ${"two @"}
    ${"@400000002a2b2c2"}                        | ${"15 digits"}
    ${"@400000002a2b2c2d0"}                      | ${"17 digits"}
    ${"@400000002a2b2c2d0000000"}                | ${"23 digits"}
    ${"@400000002a2b2c2d000000000"}              | ${"25 digits"}
    ${"@400000002a2b2c2d0000000000000000000000"} | ${"38 digits"}
    ${"@400000002a2b2c2d00000000000000000"}      | ${"33 digits"}
    ${"@400000002a2b2c2d000000000000000"}        | ${"31 digits"}
    ${"@400000002a2b2c2g"}                       | ${"non-hex digit"}
    ${"0x400000002a2b2c2d"}                      | ${"0x prefix"}
    ${" @400000002a2b2c2d00000000"}              | ${"leading space"}
    ${"@400000002a2b2c2d00000000 "}              | ${"trailing space"}
    ${"@400000002a2b2c2d00000000 mark"}          | ${"a whole log line"}
    ${"@4000 0000 2a2b 2c2d"}                    | ${"spaces inside"}
    ${"@40000000２a2b2c2d"}                      | ${"a full-width digit"}
    ${"@400000002a2b2c2d\n"}                     | ${"trailing newline"}
    ${"2026-01-01T00:00:37 TAI"}                 | ${"a TAI time-scale string, fromTAI's input"}
  `("returns '' for the malformed '$label' ($why)", ({ label }) => {
    expect(fromTai64n(label)).toBe("");
  });

  it.each`
    value                        | label
    ${null}                      | ${"null"}
    ${undefined}                 | ${"undefined"}
    ${123}                       | ${"123"}
    ${12n}                       | ${"12n"}
    ${true}                      | ${"true"}
    ${{}}                        | ${"{}"}
    ${[]}                        | ${"[]"}
    ${() => "@400000002a2b2c2d"} | ${"a function"}
    ${Symbol("x")}               | ${"a symbol"}
    ${hostileProxy()}            | ${"a hostile proxy"}
    ${revokedProxy()}            | ${"a revoked proxy"}
  `("returns '' for the non-string $label", ({ value }) => {
    expect(fromTai64n(value)).toBe("");
  });

  it("returns '' when Temporal.Instant.fromEpochNanoseconds throws while writing", () => {
    mockTemporalInstantFromEpochNanosecondsThrow();
    expect(fromTai64n("@400000006955b92500000000")).toBe("");
  });

  it("returns '' when Temporal.PlainTime.from throws while writing second 60", () => {
    mockTemporalPlainTimeFromThrow();
    expect(fromTai64n("@40000000586846a41dcd6500")).toBe("");
  });
});

describe("toTai64n and fromTai64n round trip", () => {
  // All 27 inserted seconds (Leap_Second.dat; ITU-R TF.460-6 Annex 3): the label of each day's
  // 23:59:60 is 2^62 + the Unix seconds of the next midnight + (TAI - UTC after the step) - 1.
  // The second either side reads 23:59:59 and the next day's 00:00:00; the label writes back.
  const shift = (label: string, seconds: bigint) =>
    `@${(BigInt(`0x${label.slice(1)}`) + seconds).toString(16).padStart(16, "0")}`;
  it.each`
    day             | nextDay         | label
    ${"1972-06-30"} | ${"1972-07-01"} | ${"@4000000004b2580a"}
    ${"1972-12-31"} | ${"1973-01-01"} | ${"@4000000005a4ec0b"}
    ${"1973-12-31"} | ${"1974-01-01"} | ${"@4000000007861f8c"}
    ${"1974-12-31"} | ${"1975-01-01"} | ${"@400000000967530d"}
    ${"1975-12-31"} | ${"1976-01-01"} | ${"@400000000b48868e"}
    ${"1976-12-31"} | ${"1977-01-01"} | ${"@400000000d2b0b8f"}
    ${"1977-12-31"} | ${"1978-01-01"} | ${"@400000000f0c3f10"}
    ${"1978-12-31"} | ${"1979-01-01"} | ${"@4000000010ed7291"}
    ${"1979-12-31"} | ${"1980-01-01"} | ${"@4000000012cea612"}
    ${"1981-06-30"} | ${"1981-07-01"} | ${"@40000000159fca93"}
    ${"1982-06-30"} | ${"1982-07-01"} | ${"@400000001780fe14"}
    ${"1983-06-30"} | ${"1983-07-01"} | ${"@4000000019623195"}
    ${"1985-06-30"} | ${"1985-07-01"} | ${"@400000001d25ea16"}
    ${"1987-12-31"} | ${"1988-01-01"} | ${"@4000000021dae517"}
    ${"1989-12-31"} | ${"1990-01-01"} | ${"@40000000259e9d98"}
    ${"1990-12-31"} | ${"1991-01-01"} | ${"@40000000277fd119"}
    ${"1992-06-30"} | ${"1992-07-01"} | ${"@400000002a50f59a"}
    ${"1993-06-30"} | ${"1993-07-01"} | ${"@400000002c32291b"}
    ${"1994-06-30"} | ${"1994-07-01"} | ${"@400000002e135c9c"}
    ${"1995-12-31"} | ${"1996-01-01"} | ${"@4000000030e7241d"}
    ${"1997-06-30"} | ${"1997-07-01"} | ${"@4000000033b8489e"}
    ${"1998-12-31"} | ${"1999-01-01"} | ${"@40000000368c101f"}
    ${"2005-12-31"} | ${"2006-01-01"} | ${"@4000000043b71ba0"}
    ${"2008-12-31"} | ${"2009-01-01"} | ${"@40000000495c07a1"}
    ${"2012-06-30"} | ${"2012-07-01"} | ${"@400000004fef9322"}
    ${"2015-06-30"} | ${"2015-07-01"} | ${"@4000000055932da3"}
    ${"2016-12-31"} | ${"2017-01-01"} | ${"@40000000586846a4"}
  `(
    "reads the inserted second of $day as 23:59:60 and round-trips it",
    ({ day, nextDay, label }) => {
      expect(fromTai64n(shift(label, -1n))).toBe(`${day}T23:59:59Z`);
      expect(fromTai64n(label)).toBe(`${day}T23:59:60Z`);
      expect(fromTai64n(`${label}1dcd6500`)).toBe(`${day}T23:59:60.5Z`);
      expect(fromTai64n(`${label}3b9ac9ff3b9ac9ff`)).toBe(
        `${day}T23:59:60.999999999Z`,
      );
      expect(fromTai64n(shift(label, 1n))).toBe(`${nextDay}T00:00:00Z`);
      expect(toTai64n(fromTai64n(`${label}00000000`))).toBe(`${label}00000000`);
    },
  );

  it.each`
    label                                  | expected
    ${"@400000002a2b2c2d"}                 | ${"@400000002a2b2c2d00000000"}
    ${"400000002A2B2C2D"}                  | ${"@400000002a2b2c2d00000000"}
    ${"@4000000037c219bf2ef02e943b9ac9ff"} | ${"@4000000037c219bf2ef02e94"}
    ${"4000000037C219BF3B9AC9FF00000000"}  | ${"@4000000037c219bf3b9ac9ff"}
  `(
    "toTai64n(fromTai64n('$label')) returns '$expected'",
    ({ label, expected }) => {
      expect(toTai64n(fromTai64n(label))).toBe(expected);
    },
  );

  it("returns the same instant for 500 seeded instants from 1972 to 9999", () => {
    const first = 63_072_000_000_000_000n; // 1972-01-01T00:00:00Z
    const span = 253_402_300_800_000_000_000n - first; // to 10000-01-01T00:00:00Z
    let state = 987654321n;
    const failures: string[] = [];
    for (let index = 0; index < 500; index++) {
      // 64-bit LCG (Knuth MMIX), widened over the span.
      state = (state * 6364136223846793005n + 1442695040888963407n) % 2n ** 64n;
      const nanoseconds = first + ((state * 2n ** 64n + state * 40503n) % span);
      const iso = Temporal.Instant.fromEpochNanoseconds(nanoseconds).toString();
      if (fromTai64n(toTai64n(iso)) !== iso) {
        failures.push(iso);
      }
    }
    expect({ count: failures.length, first: failures.slice(0, 20) }).toEqual({
      count: 0,
      first: [],
    });
  });
});
