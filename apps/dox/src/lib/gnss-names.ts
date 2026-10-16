/**
 * The names the GNSS tools list: the library's own type members, held in one
 * leaf module so the chat schemas (`dox-tools.ts`) and the widgets can share
 * them without loading anything heavy.
 *
 * A leaf: it imports nothing. Each list is the library's union, in the order
 * the type declares it. `gnss-names.test.ts` checks every list against the
 * enum choices of the generated playground templates, so a name the library
 * adds or drops fails there. The lists are names, not rules: a counter's
 * width, a system's epoch and an era's start are always asked of the library.
 */

/** Every satellite week counter (`GnssWeekCounter`). */
export const GNSS_WEEK_COUNTERS = [
  "GPS-LNAV",
  "GPS-CNAV",
  "GAL",
  "BDT",
  "QZS-LNAV",
  "QZS-CNAV",
  "IRN-LNAV",
  "IRN-L1NV",
] as const;

/** Every system whose RINEX navigation records carry a week (`RinexWeekSystem`). */
export const RINEX_WEEK_SYSTEMS = ["GPS", "GAL", "BDT", "QZS", "IRN"] as const;

/** Every satellite time scale (`GnssSystem`). */
export const GNSS_SYSTEMS = ["GPS", "GAL", "BDT", "QZS", "GLO", "IRN"] as const;

/** The three ways into the GNSS Week Decoder. */
export const GNSS_DECODER_MODES = ["broadcast", "rinex", "utc"] as const;

/** The two ways the Rollover Checker reads "now": the live clock or a date. */
export const ROLLOVER_NOW_MODES = ["today", "date"] as const;

export type GnssWeekCounter = (typeof GNSS_WEEK_COUNTERS)[number];
export type RinexWeekSystem = (typeof RINEX_WEEK_SYSTEMS)[number];
export type GnssSystem = (typeof GNSS_SYSTEMS)[number];
export type GnssDecoderMode = (typeof GNSS_DECODER_MODES)[number];
export type RolloverNowMode = (typeof ROLLOVER_NOW_MODES)[number];

/** The system a counter belongs to: the token before the `-` (`"QZS-CNAV"`
 *  gives `"QZS"`, `"GAL"` gives `"GAL"`), as a type. */
export type CounterSystem<C extends GnssWeekCounter> =
  C extends `${infer S}-${string}` ? S : C;
