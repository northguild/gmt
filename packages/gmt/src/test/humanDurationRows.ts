/**
 * Accepted human duration strings and the ISO 8601 duration each one reads as (CORE-85).
 * Every `iso` was derived from the grammar rule named on the group and checked against
 * `Temporal.Duration.from(...).toString()`. Test-only: shipped code never imports this file.
 */
interface HumanDurationRow {
  readonly text: string;
  readonly iso: string;
}

const rows = (
  pairs: ReadonlyArray<readonly [string, string]>,
): readonly HumanDurationRow[] => pairs.map(([text, iso]) => ({ text, iso }));

/** G1, G8: `m` is a minute, `mo` a month, `ms` a millisecond. */
export const minuteOrMonthRows = rows([
  ["1m", "PT1M"],
  ["1M", "PT1M"],
  ["1min", "PT1M"],
  ["1 minute", "PT1M"],
  ["1mo", "P1M"],
  ["1MO", "P1M"],
  ["1Mo", "P1M"],
  ["1 month", "P1M"],
  ["1 months", "P1M"],
  ["1ms", "PT0.001S"],
  ["1MS", "PT0.001S"],
  ["1Ms", "PT0.001S"],
  // G8: both M-spellings in one string; month before T, minute after.
  ["1mo 1m", "P1MT1M"],
  ["1MO 1M", "P1MT1M"],
  ["1M 1MS", "PT1M0.001S"],
]);

/** Separators: space runs, comma, `and`, empty. */
export const separatorRows = rows([
  ["2h30m", "PT2H30M"],
  ["2h 30m", "PT2H30M"],
  ["2h  30m", "PT2H30M"],
  ["2h,30m", "PT2H30M"],
  ["2h, 30m", "PT2H30M"],
  ["2h,  30m", "PT2H30M"],
  ["2h and 30m", "PT2H30M"],
  ["2h AND 30m", "PT2H30M"],
  ["2h, and 30m", "PT2H30M"],
  ["1h, 2m, and 3s", "PT1H2M3S"],
  ["1h, 2m and 3s", "PT1H2M3S"],
  ["2 h", "PT2H"],
  ["3 days", "P3D"],
  ["3days", "P3D"],
  ["3   days", "P3D"],
  ["2 h 30 m", "PT2H30M"],
  ["2h  and  30m", "PT2H30M"],
  ["2H And 30M", "PT2H30M"],
  ["1h and 2m and 3s", "PT1H2M3S"],
  ["1d,1h", "P1DT1H"],
  ["1y2mo3w4d5h6m7s8ms", "P1Y2M3W4DT5H6M7.008S"],
  ["1y 2mo 3w 4d 5h 6m 7s 8ms", "P1Y2M3W4DT5H6M7.008S"],
]);

/** G3, G6: a fraction on the last of hour, minute, second, spread by Temporal. */
export const fractionRows = rows([
  ["1.5h", "PT1H30M"],
  ["0.25m", "PT15S"],
  ["1.5s", "PT1.5S"],
  ["2h 1.5m", "PT2H1M30S"],
  ["1.50h", "PT1H30M"],
  ["1.0h", "PT1H"],
  ["0.0h", "PT0S"],
  ["1.123456789s", "PT1.123456789S"],
  ["0.000000001h", "PT0.0000036S"],
  ["1.5 h", "PT1H30M"],
  ["1.5 minutes", "PT1M30S"],
  ["2h 30.5s", "PT2H30.5S"],
  ["1.123456789h", "PT1H7M24.4444404S"],
  // Largest hours that fit §7.5.16 with a half hour left over.
  ["2501999792983.5h", "PT2501999792983H30M"],
  ["9007199254740991.999999999s", "PT9007199254740991.999999999S"],
]);

/** G5: milliseconds fold into seconds. */
export const millisecondRows = rows([
  ["500ms", "PT0.5S"],
  ["1s 500ms", "PT1.5S"],
  ["1500ms", "PT1.5S"],
  ["1000ms", "PT1S"],
  ["1ms", "PT0.001S"],
  ["0ms", "PT0S"],
  ["1s 0ms", "PT1S"],
  ["1h 500ms", "PT1H0.5S"],
  ["9007199254740991999ms", "PT9007199254740991.999S"],
  ["999ms", "PT0.999S"],
  ["10ms", "PT0.01S"],
  ["100ms", "PT0.1S"],
  ["1010ms", "PT1.01S"],
  ["1s 999ms", "PT1.999S"],
  ["1s 1000ms", "PT2S"],
  ["1 millisecond", "PT0.001S"],
  ["1 milliseconds", "PT0.001S"],
  ["9007199254740990999ms", "PT9007199254740990.999S"],
  ["9007199254740991s 999ms", "PT9007199254740991.999S"],
]);

/** G4: one sign covers the whole duration. */
export const signRows = rows([
  ["-2h", "-PT2H"],
  ["+2h", "PT2H"],
  ["-2h 30m", "-PT2H30M"],
  ["-1y 2mo", "-P1Y2M"],
  ["-0s", "PT0S"],
  ["+0s", "PT0S"],
  ["-0ms", "PT0S"],
  ["-0.0h", "PT0S"],
  ["-1ms", "-PT0.001S"],
  ["-1.5h", "-PT1H30M"],
  ["-2h30m", "-PT2H30M"],
  ["-2h, 30m", "-PT2H30M"],
  ["-2h and 30m", "-PT2H30M"],
  ["+2h and 30m", "PT2H30M"],
  ["+2h, and 30m", "PT2H30M"],
  ["-4294967295y", "-P4294967295Y"],
  ["-9007199254740991s", "-PT9007199254740991S"],
]);

/** G6: zero units drop; a zero duration is PT0S. */
export const zeroRows = rows([
  ["0s", "PT0S"],
  ["0h", "PT0S"],
  ["0y 0mo", "PT0S"],
  ["0.0s", "PT0S"],
  ["2h 0m", "PT2H"],
]);

/** G2: ranks increase; weeks combine with other units. */
export const orderRows = rows([
  ["1w 2d", "P1W2D"],
  ["1y 2w", "P1Y2W"],
  ["1y 1d", "P1Y1D"],
  ["1d 1h", "P1DT1H"],
  ["1w 2d 3h", "P1W2DT3H"],
]);

/** Temporal §7.5.16 limits, last accepted value of each field. */
export const limitRows = rows([
  ["4294967295y", "P4294967295Y"],
  ["4294967295mo", "P4294967295M"],
  ["4294967295w", "P4294967295W"],
  ["104249991374d", "P104249991374D"],
  ["2501999792983h", "PT2501999792983H"],
  ["9007199254740991s", "PT9007199254740991S"],
  // 104249991374 d is 9 007 199 254 713 600 s; 27 391 s (7 h 36 min 31 s) fit below 2^53.
  ["104249991374d 7h 36m 31s", "P104249991374DT7H36M31S"],
  [
    "4294967295y 4294967295mo 4294967295w 104249991374d 7h 36m 31s",
    "P4294967295Y4294967295M4294967295W104249991374DT7H36M31S",
  ],
  ["02h", "PT2H"],
]);
