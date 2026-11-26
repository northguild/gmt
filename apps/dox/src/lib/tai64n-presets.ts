/**
 * The TAI64N Log Reader's presets: literal log lines, each a label and then a message.
 *
 * They are the only place a label is written out. `tai64n-log-reader.ts` holds none, so a test
 * can hold that module to "it reads every label through the library and decodes none itself".
 * The test file checks every instant a preset states through the real library; nothing here is
 * trusted.
 */

export interface Tai64nPreset {
  id: string;
  label: string;
  description: string;
  lines: readonly string[];
  /** The line selected on open, 1-based, or `null` for the first line with a label. */
  selected: number | null;
}

export const TAI64N_PRESETS: readonly Tai64nPreset[] = [
  {
    id: "today",
    label: "A log from today",
    description:
      "The same instant written with and without the @, and in lower and upper case: the library reads either.",
    lines: [
      "@40000000659200a500000000 service started",
      "@40000000659200a5075bcd15 accepted connection",
      "40000000659200A5075BCD15 same label, no @, upper case",
    ],
    selected: null,
  },
  {
    id: "bernstein-1992",
    label: "Bernstein's TAI64 example, 1992",
    description:
      "The example on the TAI64 page. TAI ran 26 seconds ahead of UTC then.",
    lines: ["@400000002a2b2c2d00000000 the TAI64 page's example"],
    selected: null,
  },
  {
    id: "daemontools-doc",
    label: "The daemontools tai64n example, 1999",
    description:
      "The example on the tai64n page. TAI ran 32 seconds ahead of UTC then.",
    lines: ["@4000000037c219bf2ef02e94 the tai64n page's example"],
    selected: null,
  },
  {
    id: "across-2016",
    label: "Across the 2016 leap second",
    description:
      "Three labels a second apart. The middle one is the inserted second, 23:59:60, and TAI minus UTC changes after it.",
    lines: [
      "@40000000586846a300000000 last second of 2016",
      "@40000000586846a400000000 the inserted second",
      "@40000000586846a500000000 first second of 2017",
    ],
    selected: null,
  },
  {
    id: "tai64na",
    label: "A TAI64NA label",
    description:
      "Thirty-two digits: seconds, nanoseconds and attoseconds. The instant is read and the attoseconds are dropped.",
    lines: ["@40000000659200a5075bcd150000002a attoseconds are dropped"],
    selected: null,
  },
  {
    id: "utc-clock-daemontools",
    label: "daemontools on a UTC clock",
    description:
      "A label that daemontools wrote on a host whose clock counts UTC. Read as true TAI it is 27 seconds early.",
    lines: [
      "@400000006592008a00000000 daemontools on a UTC clock at 2024-01-01T00:00:00Z",
    ],
    selected: null,
  },
  {
    id: "refused",
    label: "Lines the library refuses",
    description:
      "A label before 1972, a plain timestamp, and a label behind a leading space: none is read.",
    lines: [
      "@400000000000000000000000 1970",
      "2024-01-01 12:00:00 a plain timestamp",
      " @40000000659200a500000000 leading space",
    ],
    selected: null,
  },
];
