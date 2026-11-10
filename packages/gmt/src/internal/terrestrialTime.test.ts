import { Temporal } from "./temporal";
import { LEAP_SECOND_STEPS } from "./leapSeconds";
import {
  L_G_DENOMINATOR,
  L_G_NUMERATOR,
  TCG_TT_EPOCH_NANOSECONDS,
  TT_MINUS_TAI_NANOSECONDS,
  tcgMinusTtNanoseconds,
  ttOfTcg,
  ttOfUtc,
  utcOfTt,
} from "./terrestrialTime";
import { parseUtcReading } from "./utcReading";

const EPOCH = TCG_TT_EPOCH_NANOSECONDS;
const SECOND = 10n ** 9n;

describe("terrestrial time constants", () => {
  it("TT_MINUS_TAI_NANOSECONDS is exactly 32.184 s (IERS TN 36 §10.1)", () => {
    expect(TT_MINUS_TAI_NANOSECONDS).toBe(32_184_000_000n);
  });

  it("L_G is 6.969290134e-10 (IAU 2000 B1.9)", () => {
    expect(Number(L_G_NUMERATOR) / Number(L_G_DENOMINATOR)).toBe(
      6.969290134e-10,
    );
  });

  it("the TCG/TT epoch is the label 1977-01-01T00:00:32.184", () => {
    expect(EPOCH).toBe(
      Temporal.Instant.from("1977-01-01T00:00:32.184Z").epochNanoseconds,
    );
  });

  it("the TCG/TT epoch is 1976-12-31T23:59:45Z, when TAI − UTC was 15 s", () => {
    const reading = parseUtcReading("1976-12-31T23:59:45Z");
    expect(reading).not.toBeNull();
    expect(ttOfUtc(LEAP_SECOND_STEPS, reading!)).toBe(EPOCH);
  });
});

describe("tcgMinusTtNanoseconds", () => {
  // Offsets in seconds from the epoch were derived from the UTC date and TAI − UTC, then
  // TCG − TT = ⌊d × L_G / (1 − L_G)⌋ (TN 36 eq. 10.1), spelled out with the constants.
  it.each`
    label                        | seconds           | expected
    ${"1977-01-01T00:00:32.184"} | ${0n}             | ${0n}
    ${"2000-01-01T12:01:04.184"} | ${725_803_232n}   | ${505_833_330n}
    ${"2026-01-01T00:01:09.184"} | ${1_546_300_837n} | ${1_077_661_917n}
    ${"1972-01-01T00:00:42.184"} | ${-157_852_790n}  | ${-110_012_190n}
  `(
    "TT $label is $expected ns behind TCG",
    ({ seconds, expected }: { seconds: bigint; expected: bigint }) => {
      expect(tcgMinusTtNanoseconds(EPOCH + seconds * SECOND)).toBe(expected);
    },
  );

  // d is TT nanoseconds since the epoch. Exact bigint arithmetic outside the library: the
  // smallest d with ⌊d × L_G / (1 − L_G)⌋ >= n is ⌈n × (10^19 − L_G) / L_G⌉ (TN 36 eq. 10.1).
  it.each`
    d                            | expected
    ${-1_434_866_364n}           | ${-2n}
    ${-1_434_866_363n}           | ${-1n}
    ${-1n}                       | ${-1n}
    ${0n}                        | ${0n}
    ${1n}                        | ${0n}
    ${1_434_866_363n}            | ${0n}
    ${1_434_866_364n}            | ${1n}
    ${2_869_732_727n}            | ${1n}
    ${2_869_732_728n}            | ${2n}
    ${-157_852_790_000_000_000n} | ${-110_012_190n}
  `(
    "TT epoch + $d ns is $expected ns behind TCG (floor, not truncation)",
    ({ d, expected }: { d: bigint; expected: bigint }) => {
      expect(tcgMinusTtNanoseconds(EPOCH + d)).toBe(expected);
    },
  );

  // 9999-12-31T23:59:59.999999999Z + 37 s + 32.184 s: the last TT of a four-digit UTC year.
  it("TT of the last UTC instant of year 9999 is 176_449_446_735 ns behind TCG", () => {
    expect(tcgMinusTtNanoseconds(253_402_300_869_183_999_999n)).toBe(
      176_449_446_735n,
    );
  });
});

describe("ttOfTcg", () => {
  // d is the smallest TT offset (ns from the epoch) at which TCG − TT reaches the floor step n.
  it.each`
    step   | d
    ${-1n} | ${-1_434_866_363n}
    ${0n}  | ${0n}
    ${1n}  | ${1_434_866_364n}
    ${2n}  | ${2_869_732_728n}
  `(
    "inverts toTCG at floor step $step and its neighbours",
    ({ d }: { d: bigint }) => {
      for (const tt of [EPOCH + d - 1n, EPOCH + d, EPOCH + d + 1n]) {
        expect(ttOfTcg(tt + tcgMinusTtNanoseconds(tt))).toBe(tt);
      }
    },
  );

  it.each`
    label                        | seconds
    ${"1977-01-01T00:00:32.184"} | ${0n}
    ${"2000-01-01T12:01:04.184"} | ${725_803_232n}
    ${"2026-01-01T00:01:09.184"} | ${1_546_300_837n}
    ${"1972-01-01T00:00:42.184"} | ${-157_852_790n}
  `(
    "inverts toTCG at TT $label and its neighbours",
    ({ seconds }: { seconds: bigint }) => {
      const base = EPOCH + seconds * SECOND;
      for (const tt of [base - 1n, base, base + 1n]) {
        expect(ttOfTcg(tt + tcgMinusTtNanoseconds(tt))).toBe(tt);
      }
    },
  );

  it("inverts toTCG at the last TT of year 9999", () => {
    const tt = 253_402_300_869_183_999_999n;
    expect(ttOfTcg(tt + 176_449_446_735n)).toBe(tt);
    expect(ttOfTcg(tt + 176_449_446_735n - 1n)).toBe(tt - 1n);
  });

  // At step n the TCG label rises by 2 ns, so TCG label (tt + n − 1) belongs to no TT. It reads
  // back as tt, the TT whose TCG is the next label. Steps -1 and 0 are the negative side and the
  // epoch itself (TCG epoch − 1 ns is skipped between TT epoch − 1 and the epoch).
  it.each`
    step   | d
    ${-1n} | ${-1_434_866_363n}
    ${0n}  | ${0n}
    ${1n}  | ${1_434_866_364n}
    ${2n}  | ${2_869_732_728n}
  `(
    "reads the TCG nanosecond skipped at floor step $step as the later TT",
    ({ step, d }: { step: bigint; d: bigint }) => {
      const tt = EPOCH + d;
      expect(tcgMinusTtNanoseconds(tt)).toBe(step);
      const skipped = tt + step - 1n;
      expect(skipped).toBe(tt - 1n + tcgMinusTtNanoseconds(tt - 1n) + 1n);
      expect(ttOfTcg(skipped)).toBe(tt);
    },
  );
});

describe("ttOfUtc and utcOfTt", () => {
  it.each`
    iso
    ${"1972-01-01T00:00:00Z"}
    ${"2016-12-31T23:59:59Z"}
    ${"2016-12-31T23:59:60Z"}
    ${"2016-12-31T23:59:60.5Z"}
    ${"2026-01-01T00:00:00Z"}
  `("round-trips $iso", ({ iso }) => {
    const reading = parseUtcReading(iso)!;
    const tt = ttOfUtc(LEAP_SECOND_STEPS, reading)!;
    expect(utcOfTt(LEAP_SECOND_STEPS, tt)).toEqual(reading);
  });

  // TAI − UTC from the leap-second table: 10 s from 1972-01-01, 11 s from 1972-07-01 (the
  // 1972-06-30T23:59:60 second is the first inserted one); then + 32.184 s (TN 36 §10.1).
  it.each`
    iso                                 | tt
    ${"1972-01-01T00:00:00Z"}           | ${63_072_042_184_000_000n}
    ${"1972-06-30T23:59:59Z"}           | ${78_796_841_184_000_000n}
    ${"1972-06-30T23:59:60Z"}           | ${78_796_842_184_000_000n}
    ${"1972-07-01T00:00:00Z"}           | ${78_796_843_184_000_000n}
    ${"9999-12-31T23:59:59.999999999Z"} | ${253_402_300_869_183_999_999n}
  `("TT of $iso is $tt", ({ iso, tt }: { iso: string; tt: bigint }) => {
    const reading = parseUtcReading(iso)!;
    expect(ttOfUtc(LEAP_SECOND_STEPS, reading)).toBe(tt);
    expect(utcOfTt(LEAP_SECOND_STEPS, tt)).toEqual(reading);
  });

  it("is 37 s + 32.184 s ahead of UTC in 2026", () => {
    expect(
      ttOfUtc(LEAP_SECOND_STEPS, parseUtcReading("2026-01-01T00:00:00Z")!),
    ).toBe(Temporal.Instant.from("2026-01-01T00:01:09.184Z").epochNanoseconds);
  });

  it("returns null for a UTC reading before 1972", () => {
    expect(
      ttOfUtc(LEAP_SECOND_STEPS, parseUtcReading("1971-12-31T23:59:59Z")!),
    ).toBeNull();
  });

  it("returns null for a TT label before 1972-01-01T00:00:42.184", () => {
    const first = Temporal.Instant.from(
      "1972-01-01T00:00:42.184Z",
    ).epochNanoseconds;
    expect(utcOfTt(LEAP_SECOND_STEPS, first - 1n)).toBeNull();
    expect(utcOfTt(LEAP_SECOND_STEPS, first)).toEqual({
      epochNanoseconds: Temporal.Instant.from("1972-01-01T00:00:00Z")
        .epochNanoseconds,
      secondSixty: false,
    });
  });
});
