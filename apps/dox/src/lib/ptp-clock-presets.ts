/**
 * The PTP Clock Converter's presets and its probe record (IOT-101).
 *
 * The only file in the tool that holds a range number: a preset needs the value the library
 * refuses, and the probe record needs one the library takes. The pure module and the mount
 * hold no PTP rule, so every expected reading below is asserted against the library in
 * `ptp-clock-converter.test.ts`, never trusted from this table.
 *
 * No library import, no DOM.
 */

/** The text of the four boxes, as typed. The offset box serves both directions. */
export interface PtpState {
  seconds: string;
  nanoseconds: string;
  offset: string;
  instant: string;
}

/** Why a write preset's refusal has a name of its own (the text must match the preset exactly). */
export type WriteNamedReason = "leapSecond" | "before1970";

export interface ReadPreset {
  id: string;
  label: string;
  description: string;
  seconds: string;
  nanoseconds: string;
  offset: string;
}

export interface WritePreset {
  id: string;
  label: string;
  description: string;
  instant: string;
  /** The reason that holds for this exact text and no other. */
  reason?: WriteNamedReason;
}

export const CUSTOM_PRESET_ID = "custom";

/** A record the library takes, for asking whether it is the offset that is refused. */
export const PROBE_RECORD = { seconds: 1704067237n, nanoseconds: 0 } as const;

export const READ_PRESETS: readonly ReadPreset[] = [
  {
    id: "announced-37",
    label: "Offset 37, as announced",
    description: "The count minus the offset is UTC.",
    seconds: "1704067237",
    nanoseconds: "0",
    offset: "37",
  },
  {
    id: "stale-36",
    label: "A stale offset, 36",
    description: "The grandmaster still announces the 2016 offset.",
    seconds: "1704067237",
    nanoseconds: "0",
    offset: "36",
  },
  {
    id: "announced-0",
    label: "Offset 0, ignored",
    description: "The count read as if it were UTC.",
    seconds: "1704067237",
    nanoseconds: "0",
    offset: "0",
  },
  {
    id: "half-second",
    label: "Half a second",
    description: "500000000 nanoseconds are kept.",
    seconds: "1704067237",
    nanoseconds: "500000000",
    offset: "37",
  },
  {
    id: "unset-clock",
    label: "A clock never set",
    description: "A count of 0: refused.",
    seconds: "0",
    nanoseconds: "0",
    offset: "37",
  },
  {
    id: "out-of-range",
    label: "Seconds out of range",
    description: "One past what 48 bits hold: refused.",
    seconds: "281474976710656",
    nanoseconds: "0",
    offset: "37",
  },
  {
    id: "before-1972",
    label: "Before 1972",
    description: "The leap-second table has no whole-second value.",
    seconds: "31536010",
    nanoseconds: "0",
    offset: "10",
  },
];

export const WRITE_PRESETS: readonly WritePreset[] = [
  {
    id: "utc-offset-instant",
    label: "An instant with an offset",
    description: "02:00 at +02:00 is midnight UTC.",
    instant: "2024-01-01T02:00:00+02:00",
  },
  {
    id: "leap-second",
    label: "An inserted second",
    description: "Refused: one offset gives it no reading.",
    instant: "2016-12-31T23:59:60Z",
    reason: "leapSecond",
  },
  {
    id: "before-1970",
    label: "Before 1970",
    description: "Refused: the count starts in 1970.",
    instant: "1969-12-31T23:59:59Z",
    reason: "before1970",
  },
];

export const DEFAULT_READ_PRESET = READ_PRESETS[0]!;
export const DEFAULT_WRITE_PRESET = WRITE_PRESETS[0]!;

// ---------------------------------------------------------------------------
// The widest samples, for the holds
// ---------------------------------------------------------------------------

/** The widest instant a plate can show: the last second the library writes. */
export const WIDEST_INSTANT = "+275760-09-12T23:59:59.999999999Z";
/** The widest seconds text the box takes, and the widest nanoseconds and offset. */
export const WIDEST_SECONDS_TEXT = "-99999999999999999999";
export const WIDEST_DECIMAL_TEXT = "-99999999999.999999999";
