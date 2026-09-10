/**
 * The magic numbers behind `precision/convert/`'s foreign-epoch bridges, in one place.
 *
 * Every integration that talks to NTP, Windows, .NET, Excel or PostgreSQL re-derives these
 * constants, usually wrongly. They live here so each `to*`/`from*` pair reads from the same
 * declaration and `foreignEpochs.test.ts` can assert every one of them against a real
 * `Temporal` day count rather than against the arithmetic that consumes them.
 *
 * | Format | Epoch | Unit | Representable range |
 * | --- | --- | --- | --- |
 * | NTP | 1900-01-01 | 2^-32 s | 64 bits, wrapping every 2^32 s (~136.19 years) into a new era |
 * | FILETIME | 1601-01-01 | 100 ns | unsigned 64-bit, 1601-01-01 to +060056-05-28 |
 * | .NET ticks | 0001-01-01 | 100 ns | `DateTime.MinValue` to `DateTime.MaxValue`, 0001-01-01 to 9999-12-31 |
 * | Excel 1900 | 1899-12-30 | 1 day | serial 1 (1900-01-01) to 2958465 (9999-12-31); 60 is the phantom 1900-02-29 |
 * | Excel 1904 | 1904-01-01 | 1 day | serial 0 (1904-01-01) to 2957003 (9999-12-31) |
 * | PostgreSQL | 2000-01-01 | 1 µs | `MIN_TIMESTAMP` (4713 BC) up; capped above by `Temporal.Instant`, not by int64 |
 *
 * Sources: [FILETIME epoch](https://devblogs.microsoft.com/oldnewthing/20090306-00/?p=18913),
 * [NTP eras](https://www.eecis.udel.edu/~mills/y2k.html),
 * [.NET ticks](https://www.epochconverter.com/dotnet).
 */

/** Nanoseconds in one second. */
export const NANOSECONDS_PER_SECOND = 1_000_000_000n;

/** Nanoseconds in one millisecond — the finest grid an Excel serial's `double` can carry. */
export const NANOSECONDS_PER_MILLISECOND = 1_000_000n;

/** Nanoseconds in one microsecond — PostgreSQL `timestamptz` resolution. */
export const NANOSECONDS_PER_MICROSECOND = 1_000n;

/** Nanoseconds in one 100-nanosecond tick — the unit FILETIME and .NET ticks share. */
export const NANOSECONDS_PER_TICK = 100n;

/** Nanoseconds in one 24-hour day. */
export const NANOSECONDS_PER_DAY = 86_400_000_000_000n;

/** The same value as a `number` — an Excel serial is days in a `double`. */
export const NANOSECONDS_PER_DAY_NUMBER = 86_400_000_000_000;

/** Milliseconds in one 24-hour day. Excel serials round to this grid; see `fromExcelSerial`. */
export const MILLISECONDS_PER_DAY = 86_400_000;

// --- NTP (RFC 5905) -------------------------------------------------------

/**
 * Fractional units in one NTP second: the low 32 bits of the timestamp count 2^-32 s,
 * i.e. ~232.83 picoseconds.
 */
export const NTP_UNITS_PER_SECOND = 4_294_967_296n;

/**
 * Values in one NTP era: 2^64, the whole 64-bit timestamp. The seconds field is unsigned
 * 32-bit, so the timestamp wraps here — every 2^32 seconds, or ~136.19 years.
 */
export const NTP_ERA_UNITS = 18_446_744_073_709_551_616n;

/**
 * Nanoseconds from 1900-01-01 (the NTP epoch) to 1970-01-01: 2 208 988 800 s, the delta
 * RFC 5905 names for converting an NTP timestamp to a Unix one.
 */
export const NTP_EPOCH_OFFSET_NANOSECONDS = 2_208_988_800_000_000_000n;

// --- Windows FILETIME -----------------------------------------------------

/**
 * 100-nanosecond intervals from 1601-01-01 (the FILETIME epoch) to 1970-01-01:
 * 11 644 473 600 s, the constant every Win32-to-Unix conversion carries.
 */
export const FILE_TIME_EPOCH_OFFSET_TICKS = 116_444_736_000_000_000n;

/** Smallest FILETIME: `FILETIME` is a pair of `DWORD`s, so the value is unsigned. */
export const MIN_FILE_TIME = 0n;

/** Largest FILETIME: 2^64 − 1, i.e. `+060056-05-28T05:36:10.9551615Z`. */
export const MAX_FILE_TIME = 18_446_744_073_709_551_615n;

// --- .NET ticks -----------------------------------------------------------

/**
 * 100-nanosecond intervals from 0001-01-01 (the `DateTime` epoch, proleptic Gregorian) to
 * 1970-01-01. `DateTime.UnixEpoch.Ticks` in .NET.
 */
export const DOT_NET_TICKS_EPOCH_OFFSET = 621_355_968_000_000_000n;

/** `DateTime.MinValue.Ticks` — 0001-01-01T00:00:00. */
export const MIN_DOT_NET_TICKS = 0n;

/** `DateTime.MaxValue.Ticks` — 9999-12-31T23:59:59.9999999. */
export const MAX_DOT_NET_TICKS = 3_155_378_975_999_999_999n;

// --- Excel day serials ----------------------------------------------------

/**
 * Nanoseconds at 1899-12-30, serial 0 of the 1900 date system.
 *
 * Serial 0 is *not* 1899-12-31, even though serial 1 is 1900-01-01: the system counts the
 * phantom 29 February 1900 that Lotus 1-2-3 invented and Excel keeps for compatibility, so
 * everything from serial 61 on sits one day later than a naive count would put it. Serials
 * 1–59 are offset from `EXCEL_1900_PRE_PHANTOM_EPOCH_NANOSECONDS` instead.
 */
export const EXCEL_1900_EPOCH_NANOSECONDS = -2_209_161_600_000_000_000n;

/**
 * Nanoseconds at 1899-12-31 — the effective serial 0 for the 1900 system's serials 1–59,
 * which precede the phantom leap day.
 */
export const EXCEL_1900_PRE_PHANTOM_EPOCH_NANOSECONDS =
  -2_209_075_200_000_000_000n;

/** Nanoseconds at 1904-01-01, serial 0 of the legacy Mac 1904 date system. */
export const EXCEL_1904_EPOCH_NANOSECONDS = -2_082_844_800_000_000_000n;

/**
 * Days between the two systems' serial 0. A 1900-system serial is exactly 1462 higher than
 * the 1904-system serial for the same date (once past the phantom day).
 */
export const EXCEL_SYSTEM_DAY_DELTA = 1462;

/** Excel's first real 1900-system serial: 1 is 1900-01-01. Serial 0 renders as "January 0". */
export const MIN_EXCEL_1900_SERIAL = 1;

/** Excel's first 1904-system serial: 0 is 1904-01-01. */
export const MIN_EXCEL_1904_SERIAL = 0;

/**
 * One past Excel's last 1900-system serial. 2958465 is 9999-12-31, so anything below
 * 2958466 is inside 9999-12-31.
 */
export const MAX_EXCEL_1900_SERIAL_EXCLUSIVE = 2_958_466;

/** One past Excel's last 1904-system serial. 2957003 is 9999-12-31. */
export const MAX_EXCEL_1904_SERIAL_EXCLUSIVE = 2_957_004;

/**
 * The 1900 system's phantom serial: 60 is 29 February 1900, a date that never existed —
 * 1900 was not a leap year. The whole serial day `[60, 61)` has no instant behind it.
 */
export const EXCEL_PHANTOM_SERIAL = 60;

/**
 * Nanoseconds at 1900-03-01, the first instant the 1900 system's serials stop needing the
 * phantom-day correction.
 */
export const EXCEL_1900_PHANTOM_END_NANOSECONDS = -2_203_891_200_000_000_000n;

// --- PostgreSQL -----------------------------------------------------------

/**
 * Microseconds from 1970-01-01 to 2000-01-01, PostgreSQL's internal `timestamptz` epoch:
 * 946 684 800 s.
 */
export const PG_EPOCH_OFFSET_MICROSECONDS = 946_684_800_000_000n;

/**
 * PostgreSQL's smallest `timestamp`/`timestamptz`: `MIN_TIMESTAMP` in
 * `src/include/datatype/timestamp.h`, i.e. Julian Day 0 — `-004713-11-24T00:00:00Z` in the
 * proleptic Gregorian calendar the ISO strings use, which is the 4713 BC the manual names in
 * the *Julian* calendar.
 *
 * There is no matching maximum here: PostgreSQL's `END_TIMESTAMP` (9223371331200000000, one
 * past 294276-12-31) is beyond what `Temporal.Instant` can represent, so the instant range
 * binds first and a second constant would be unreachable.
 */
export const MIN_PG_MICROSECONDS = -211_813_488_000_000_000n;
