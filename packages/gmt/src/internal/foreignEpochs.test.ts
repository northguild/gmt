import { Temporal } from "./temporal";
import {
  DOT_NET_TICKS_EPOCH_OFFSET,
  EXCEL_1900_EPOCH_NANOSECONDS,
  EXCEL_1900_PHANTOM_END_NANOSECONDS,
  EXCEL_1900_PRE_PHANTOM_EPOCH_NANOSECONDS,
  EXCEL_1904_EPOCH_NANOSECONDS,
  EXCEL_SYSTEM_DAY_DELTA,
  FILE_TIME_EPOCH_OFFSET_TICKS,
  GREGORIAN_EPOCH_OFFSET_TICKS,
  JULIAN_DAY_OF_UNIX_EPOCH,
  KSUID_EPOCH_SECONDS,
  MAX_DOT_NET_TICKS,
  MAX_INT64,
  MAX_UNIX_MS_48,
  MIN_INT64,
  PROTO_DURATION_MAX_SECONDS,
  PROTO_TIMESTAMP_MAX_SECONDS,
  PROTO_TIMESTAMP_MIN_SECONDS,
  MAX_EXCEL_1900_SERIAL_EXCLUSIVE,
  MAX_EXCEL_1904_SERIAL_EXCLUSIVE,
  MAX_FILE_TIME,
  NANOSECONDS_PER_DAY as NANOSECONDS_PER_DAY_CONSTANT,
  NANOSECONDS_PER_WEEK,
  NTP_EPOCH_OFFSET_NANOSECONDS,
  NTP_ERA_UNITS,
  NTP_UNITS_PER_SECOND,
  PG_EPOCH_OFFSET_MICROSECONDS,
} from "./foreignEpochs";

/**
 * Count whole days between two ISO dates with `Temporal.PlainDate.until`. This is a
 * different route to the answer than the epoch-offset arithmetic the constants feed, so a
 * transcription error in either shows up as a mismatch rather than cancelling out.
 */
function daysBetween(from: string, to: string): bigint {
  return BigInt(
    Temporal.PlainDate.from(from).until(Temporal.PlainDate.from(to), {
      largestUnit: "day",
    }).days,
  );
}

const NANOSECONDS_PER_DAY = 86_400_000_000_000n;
const SECONDS_PER_DAY = 86_400n;
const TICKS_PER_DAY = 864_000_000_000n;

describe("foreignEpochs", () => {
  it.each`
    epoch           | constant                                    | expected
    ${"1899-12-30"} | ${EXCEL_1900_EPOCH_NANOSECONDS}             | ${"Excel 1900 serial 0"}
    ${"1899-12-31"} | ${EXCEL_1900_PRE_PHANTOM_EPOCH_NANOSECONDS} | ${"Excel 1900 pre-phantom serial 0"}
    ${"1900-03-01"} | ${EXCEL_1900_PHANTOM_END_NANOSECONDS}       | ${"first day past the phantom leap day"}
    ${"1904-01-01"} | ${EXCEL_1904_EPOCH_NANOSECONDS}             | ${"Excel 1904 serial 0"}
  `("places $expected at midnight UTC on $epoch", ({ epoch, constant }) => {
    expect(constant).toBe(
      Temporal.Instant.from(`${epoch}T00:00:00Z`).epochNanoseconds,
    );
  });

  it("puts the NTP epoch 2 208 988 800 seconds before the Unix epoch", () => {
    expect(NTP_EPOCH_OFFSET_NANOSECONDS).toBe(
      daysBetween("1900-01-01", "1970-01-01") *
        SECONDS_PER_DAY *
        1_000_000_000n,
    );
    expect(NTP_EPOCH_OFFSET_NANOSECONDS / 1_000_000_000n).toBe(2_208_988_800n);
  });

  // IS-GPS-200N §3.3.4: a GPS week is 604,800 seconds; every satellite week counter uses it.
  it("counts 604 800 seconds, seven days, in NANOSECONDS_PER_WEEK", () => {
    expect(NANOSECONDS_PER_WEEK).toBe(7n * NANOSECONDS_PER_DAY_CONSTANT);
    expect(NANOSECONDS_PER_WEEK).toBe(
      BigInt(
        Temporal.Duration.from({ days: 7 }).total({
          unit: "seconds",
          relativeTo: "2024-01-01",
        }),
      ) * 1_000_000_000n,
    );
    expect(NANOSECONDS_PER_WEEK / 1_000_000_000n).toBe(604_800n);
  });

  it("counts 2^32 fractional units per NTP second and 2^64 per era", () => {
    expect(NTP_UNITS_PER_SECOND).toBe(2n ** 32n);
    expect(NTP_ERA_UNITS).toBe(2n ** 64n);
  });

  it("puts the FILETIME epoch 116 444 736 000 000 000 ticks before the Unix epoch", () => {
    expect(FILE_TIME_EPOCH_OFFSET_TICKS).toBe(
      daysBetween("1601-01-01", "1970-01-01") * TICKS_PER_DAY,
    );
    expect(FILE_TIME_EPOCH_OFFSET_TICKS).toBe(116_444_736_000_000_000n);
  });

  it("caps FILETIME below 0x8000000000000000, the limit FileTimeToSystemTime enforces", () => {
    expect(MAX_FILE_TIME).toBe(2n ** 63n - 1n);
  });

  it("puts the .NET ticks epoch 621 355 968 000 000 000 ticks before the Unix epoch", () => {
    expect(DOT_NET_TICKS_EPOCH_OFFSET).toBe(
      daysBetween("0001-01-01", "1970-01-01") * TICKS_PER_DAY,
    );
    expect(DOT_NET_TICKS_EPOCH_OFFSET).toBe(621_355_968_000_000_000n);
  });

  it("caps .NET ticks at DateTime.MaxValue — 9999-12-31T23:59:59.9999999", () => {
    const lastInstant = Temporal.Instant.from("9999-12-31T23:59:59.9999999Z");

    expect(MAX_DOT_NET_TICKS).toBe(
      (lastInstant.epochNanoseconds + DOT_NET_TICKS_EPOCH_OFFSET * 100n) / 100n,
    );
  });

  it("puts the PostgreSQL epoch 946 684 800 seconds after the Unix epoch", () => {
    expect(PG_EPOCH_OFFSET_MICROSECONDS).toBe(
      daysBetween("1970-01-01", "2000-01-01") * SECONDS_PER_DAY * 1_000_000n,
    );
    expect(PG_EPOCH_OFFSET_MICROSECONDS).toBe(946_684_800_000_000n);
  });

  it("separates the two Excel systems' serial 0 by exactly 1462 days", () => {
    expect(EXCEL_SYSTEM_DAY_DELTA).toBe(
      Number(daysBetween("1899-12-30", "1904-01-01")),
    );
    expect(
      (EXCEL_1904_EPOCH_NANOSECONDS - EXCEL_1900_EPOCH_NANOSECONDS) /
        NANOSECONDS_PER_DAY,
    ).toBe(1462n);
  });

  it.each`
    system    | exclusiveMax                       | epoch
    ${"1900"} | ${MAX_EXCEL_1900_SERIAL_EXCLUSIVE} | ${"1899-12-30"}
    ${"1904"} | ${MAX_EXCEL_1904_SERIAL_EXCLUSIVE} | ${"1904-01-01"}
  `(
    "ends the Excel $system system's serial range one day past 9999-12-31",
    ({ exclusiveMax, epoch }) => {
      expect(BigInt(exclusiveMax) - 1n).toBe(daysBetween(epoch, "9999-12-31"));
    },
  );

  it("separates the two Excel systems' maximum serials by the same 1462 days", () => {
    expect(
      MAX_EXCEL_1900_SERIAL_EXCLUSIVE - MAX_EXCEL_1904_SERIAL_EXCLUSIVE,
    ).toBe(EXCEL_SYSTEM_DAY_DELTA);
  });

  it("puts the Gregorian epoch 141 427 days of 100 ns ticks before the Unix epoch", () => {
    // RFC 9562 Appendix A: UUIDv1 counts from 1582-10-15, proleptic Gregorian.
    expect(GREGORIAN_EPOCH_OFFSET_TICKS).toBe(
      daysBetween("1582-10-15", "1970-01-01") * TICKS_PER_DAY,
    );
    expect(daysBetween("1582-10-15", "1970-01-01")).toBe(141_427n);
    // RFC 9562 Appendix A prints the same offset as hex.
    expect(GREGORIAN_EPOCH_OFFSET_TICKS).toBe(0x01b21dd213814000n);
  });

  it("holds 48 bits of Unix milliseconds (RFC 9562 §5.7, ULID)", () => {
    expect(MAX_UNIX_MS_48).toBe(2n ** 48n - 1n);
    expect(MAX_UNIX_MS_48).toBe(281_474_976_710_655n);
  });

  it("starts the KSUID epoch at 2014-05-13T16:53:20Z", () => {
    expect(KSUID_EPOCH_SECONDS).toBe(
      Temporal.Instant.from("2014-05-13T16:53:20Z").epochNanoseconds /
        1_000_000_000n,
    );
  });

  it("puts the Unix epoch at Julian Day 2 440 588 from Julian Day 0", () => {
    expect(BigInt(JULIAN_DAY_OF_UNIX_EPOCH)).toBe(
      daysBetween("-004713-11-24", "1970-01-01"),
    );
  });

  it("spans the signed 64-bit integer range", () => {
    expect(MIN_INT64).toBe(-(2n ** 63n));
    expect(MAX_INT64).toBe(2n ** 63n - 1n);
  });

  it("bounds a protobuf Timestamp at 0001-01-01 and 9999-12-31T23:59:59", () => {
    expect(PROTO_TIMESTAMP_MIN_SECONDS).toBe(
      Temporal.Instant.from("0001-01-01T00:00:00Z").epochNanoseconds /
        1_000_000_000n,
    );
    expect(PROTO_TIMESTAMP_MAX_SECONDS).toBe(
      Temporal.Instant.from("9999-12-31T23:59:59Z").epochNanoseconds /
        1_000_000_000n,
    );
  });

  it("bounds a protobuf Duration at 10 000 years of 365.25 days", () => {
    // duration.proto: ±315,576,000,000 s = 10 000 * 365.25 * 24 * 3600.
    expect(PROTO_DURATION_MAX_SECONDS).toBe(
      (10_000n * 36_525n * SECONDS_PER_DAY) / 100n,
    );
  });
});
