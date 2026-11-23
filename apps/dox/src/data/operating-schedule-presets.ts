/**
 * The operating-hours tools' presets: a schedule's JSON text exactly as a reader would paste it,
 * and an interval to look at it in.
 *
 * Content only, read by the Operating Schedule Checker and the Opening Hours Board. A label
 * describes the schedule and never the verdict, so a preset does not give the answer away. Each
 * preset's zone and dates carry their years. The facts tests put every preset through the real
 * library; nothing here is trusted.
 */

export interface OperatingSchedulePreset {
  id: string;
  label: string;
  description: string;
  /** The schedule as JSON text, as pasted. */
  text: string;
  /** The interval's two ends, ISO 8601 instants with an offset. */
  start: string;
  end: string;
  /** Which tools list the preset. The Board's editor has no eighth weekday row, so that preset is the Checker's alone. */
  tools: readonly OperatingTool[];
  /** The Board's own reading: the week it draws and the two instants it opens on. */
  board?: { weekOf: string; from: string; to: string };
}

type OperatingTool = "checker" | "board";

export const OPERATING_SCHEDULE_PRESETS: readonly OperatingSchedulePreset[] = [
  {
    id: "tokyo-desk",
    label: "Tokyo support desk, weekdays 09:00 to 18:00",
    description: "One working week in June 2024.",
    text: `{
  "timeZone": "Asia/Tokyo",
  "weekly": {
    "1": [{ "from": "09:00", "to": "18:00" }],
    "2": [{ "from": "09:00", "to": "18:00" }],
    "3": [{ "from": "09:00", "to": "18:00" }],
    "4": [{ "from": "09:00", "to": "18:00" }],
    "5": [{ "from": "09:00", "to": "18:00" }]
  }
}`,
    start: "2024-06-10T00:00:00+09:00",
    end: "2024-06-15T00:00:00+09:00",
    tools: ["checker", "board"],
    board: {
      weekOf: "2024-06-10",
      from: "2024-06-14T17:30:00+09:00",
      to: "2024-06-17T00:00:00+09:00",
    },
  },
  {
    id: "johannesburg-holidays",
    label: "Johannesburg office, a week of holidays",
    description:
      "Weekdays 08:00 to 16:30, with the weekdays 23 to 27 December 2024 listed as holidays.",
    text: `{
  "timeZone": "Africa/Johannesburg",
  "weekly": {
    "1": [{ "from": "08:00", "to": "16:30" }],
    "2": [{ "from": "08:00", "to": "16:30" }],
    "3": [{ "from": "08:00", "to": "16:30" }],
    "4": [{ "from": "08:00", "to": "16:30" }],
    "5": [{ "from": "08:00", "to": "16:30" }]
  },
  "holidays": [
    "2024-12-23",
    "2024-12-24",
    "2024-12-25",
    "2024-12-26",
    "2024-12-27"
  ]
}`,
    start: "2024-12-23T00:00:00+02:00",
    end: "2024-12-28T00:00:00+02:00",
    tools: ["checker", "board"],
    board: {
      weekOf: "2024-12-23",
      from: "2024-12-23T00:00:00+02:00",
      to: "2024-12-30T00:00:00+02:00",
    },
  },
  {
    id: "london-weekday-8",
    label: "London desk with a weekday key 8",
    description: 'A Monday window, and a second window under the key "8".',
    text: `{
  "timeZone": "Europe/London",
  "weekly": {
    "1": [{ "from": "09:00", "to": "17:30" }],
    "8": [{ "from": "09:00", "to": "17:30" }]
  }
}`,
    start: "2024-03-04T00:00:00Z",
    end: "2024-03-11T00:00:00Z",
    tools: ["checker"],
  },
  {
    id: "kolkata-annotated-holiday",
    label: "Kolkata office with an annotated holiday",
    description:
      "Weekdays 09:30 to 18:00, and 15 August 2024 written with a calendar annotation.",
    text: `{
  "timeZone": "Asia/Kolkata",
  "weekly": {
    "1": [{ "from": "09:30", "to": "18:00" }],
    "2": [{ "from": "09:30", "to": "18:00" }],
    "3": [{ "from": "09:30", "to": "18:00" }],
    "4": [{ "from": "09:30", "to": "18:00" }],
    "5": [{ "from": "09:30", "to": "18:00" }]
  },
  "holidays": ["2024-08-15[u-ca=iso8601]"]
}`,
    start: "2024-08-12T00:00:00+05:30",
    end: "2024-08-17T00:00:00+05:30",
    tools: ["checker", "board"],
    board: {
      weekOf: "2024-08-12",
      from: "2024-08-12T00:00:00+05:30",
      to: "2024-08-19T00:00:00+05:30",
    },
  },
  {
    id: "sao-paulo-two-overrides",
    label: "São Paulo counter with two overrides for one date",
    description:
      "Weekdays 10:00 to 18:00, and two override entries for 2024-11-20.",
    text: `{
  "timeZone": "America/Sao_Paulo",
  "weekly": {
    "1": [{ "from": "10:00", "to": "18:00" }],
    "2": [{ "from": "10:00", "to": "18:00" }],
    "3": [{ "from": "10:00", "to": "18:00" }],
    "4": [{ "from": "10:00", "to": "18:00" }],
    "5": [{ "from": "10:00", "to": "18:00" }]
  },
  "overrides": [
    { "date": "2024-11-20", "windows": [{ "from": "10:00", "to": "13:00" }] },
    { "date": "2024-11-20", "windows": [] }
  ]
}`,
    start: "2024-11-18T00:00:00-03:00",
    end: "2024-11-23T00:00:00-03:00",
    tools: ["checker", "board"],
    board: {
      weekOf: "2024-11-18",
      from: "2024-11-18T00:00:00-03:00",
      to: "2024-11-25T00:00:00-03:00",
    },
  },
  {
    id: "sydney-night-curfew",
    label: "Sydney night curfew, 23:00 to 06:00",
    description:
      "A Saturday-night window across the clocks going back, 7 April 2024.",
    text: `{
  "timeZone": "Australia/Sydney",
  "weekly": {
    "6": [{ "from": "23:00", "to": "06:00" }]
  }
}`,
    start: "2024-04-06T00:00:00+11:00",
    end: "2024-04-08T00:00:00+10:00",
    tools: ["checker", "board"],
    board: {
      weekOf: "2024-04-01",
      from: "2024-04-06T22:00:00+11:00",
      to: "2024-04-08T00:00:00+10:00",
    },
  },
];

/** A preset the Board lists: it carries its own week and two instants. */
export type BoardPreset = OperatingSchedulePreset & {
  board: NonNullable<OperatingSchedulePreset["board"]>;
};

/** The presets the Board lists. */
export const BOARD_PRESETS = OPERATING_SCHEDULE_PRESETS.filter(
  (p): p is BoardPreset => p.tools.includes("board") && p.board !== undefined,
);
