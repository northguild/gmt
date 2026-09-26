/**
 * Pure helpers for the Connection Checker widget (TRAN-9): one handoff — an
 * arriving leg, the handling time at the port (the minimum connect time) and
 * a scheduled onward departure — checked by the real `scheduleDelivery`.
 *
 * `verdict` comes from the library alone: made, missed, or no verdict. The
 * widget's one naive value is `naiveCheck`, "the times as printed" — a wall-
 * clock addition through the polyfill, which agrees with the library when
 * nothing moves the zone's offset between the two ends and disagrees when a
 * DST transition or a zone change does.
 *
 * No DOM and no gmt import: `TransportLib` comes in from the mount.
 */

import { Temporal } from "@js-temporal/polyfill";
import {
  departureAt,
  diagnose,
  minutesBetween,
  minutesText,
  readyAt,
  type ScheduleLeg,
  type TransportLib,
} from "./transport-widgets";

/** The widget's controls, as strings. The chat tool sends `handlingMinutes`
 *  as a number; the permalink, like every other window in this app, as a
 *  string (`seedFromLocation` carries only strings). */
export interface ConnectionCheckerArgs {
  inboundDeparture?: string;
  inboundDuration?: string;
  portZone?: string;
  handlingMinutes?: number | string;
  onwardDeparture?: string;
  onwardDuration?: string;
  onwardZone?: string;
}

export interface ConnectionState {
  inboundDeparture: string;
  inboundDuration: string;
  portZone: string;
  handlingMinutes: string;
  onwardDeparture: string;
  onwardDuration: string;
  onwardZone: string;
}

export const CUSTOM_PRESET_ID = "custom";

export interface ConnectionPreset {
  id: string;
  label: string;
  description: string;
  state: ConnectionState;
}

const BERLIN_MADE: Omit<ConnectionState, "handlingMinutes"> = {
  inboundDeparture: "2024-06-14T22:10:00+02:00[Europe/Berlin]",
  inboundDuration: "PT15H",
  portZone: "Europe/Amsterdam",
  onwardDeparture: "2024-06-15T14:00:00[Europe/Amsterdam]",
  onwardDuration: "PT12H",
  onwardZone: "Europe/Rome",
};

export const CONNECTION_PRESETS: readonly ConnectionPreset[] = [
  {
    id: "made",
    label: "Lands 13:10, train at 14:00, 45 min handling",
    description:
      "The barge lands at 13:10 in Amsterdam. Forty-five minutes of handling, ready at 13:55. The train leaves at 14:00: made, with 5 minutes to spare.",
    state: { ...BERLIN_MADE, handlingMinutes: "45" },
  },
  {
    id: "zero-slack",
    label: "50 min handling: ready exactly at 14:00",
    description:
      "Fifty minutes of handling puts the cargo ready at exactly 14:00, when the train leaves. Equal passes.",
    state: { ...BERLIN_MADE, handlingMinutes: "50" },
  },
  {
    id: "spring-forward",
    label: "The same barge the night the clocks spring forward",
    description:
      "Same run, two weeks earlier: the night of 30-31 March 2024, when Amsterdam's clocks spring forward. The printed-clock check still says made. scheduleDelivery says missed.",
    state: {
      inboundDeparture: "2024-03-30T22:10:00+01:00[Europe/Berlin]",
      inboundDuration: "PT15H",
      portZone: "Europe/Amsterdam",
      handlingMinutes: "45",
      onwardDeparture: "2024-03-31T14:00:00[Europe/Amsterdam]",
      onwardDuration: "PT12H",
      onwardZone: "Europe/Rome",
    },
  },
  {
    id: "zone-change",
    label: "A flight whose landing time was printed in London",
    description:
      "A short flight lands in Amsterdam, its published departure printed on London's clock. The printed-clock check treats London's wall time as Amsterdam's. scheduleDelivery reads each in its own zone: missed.",
    state: {
      inboundDeparture: "2024-06-15T12:10:00+01:00[Europe/London]",
      inboundDuration: "PT1H",
      portZone: "Europe/Amsterdam",
      handlingMinutes: "45",
      onwardDeparture: "2024-06-15T14:00:00[Europe/Amsterdam]",
      onwardDuration: "PT12H",
      onwardZone: "Europe/Rome",
    },
  },
];

const str = (v: unknown): string => {
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : "";
  return typeof v === "string" ? v : "";
};

/** A number (the chat tool) or a string (the permalink), turned into text;
 *  anything else becomes `""`. */
export function readArgs(args: ConnectionCheckerArgs): ConnectionState {
  return {
    inboundDeparture: str(args.inboundDeparture),
    inboundDuration: str(args.inboundDuration),
    portZone: str(args.portZone),
    handlingMinutes: str(args.handlingMinutes),
    onwardDeparture: str(args.onwardDeparture),
    onwardDuration: str(args.onwardDuration),
    onwardZone: str(args.onwardZone),
  };
}

export function matchPreset(state: ConnectionState): string {
  const t = (s: string) => s.trim();
  const hit = CONNECTION_PRESETS.find(
    (p) =>
      t(p.state.inboundDeparture) === t(state.inboundDeparture) &&
      t(p.state.inboundDuration) === t(state.inboundDuration) &&
      t(p.state.portZone) === t(state.portZone) &&
      t(p.state.handlingMinutes) === t(state.handlingMinutes) &&
      t(p.state.onwardDeparture) === t(state.onwardDeparture) &&
      t(p.state.onwardDuration) === t(state.onwardDuration) &&
      t(p.state.onwardZone) === t(state.onwardZone),
  );
  return hit ? hit.id : CUSTOM_PRESET_ID;
}

/**
 * The two legs `scheduleDelivery` is called with. A blank onward duration or
 * zone falls back to `PT0S` / the port's own zone — the onward leg's run
 * time never changes whether the connection is made, and its widget hint
 * says so.
 */
export function legsOf(state: ConnectionState): ScheduleLeg[] {
  const handling = Number.parseInt(state.handlingMinutes, 10);
  const minutes = Number.isFinite(handling) ? handling : 0;
  return [
    {
      departure: state.inboundDeparture.trim(),
      duration: state.inboundDuration.trim(),
      timeZone: state.portZone.trim(),
      dwellAfter: `PT${minutes}M`,
    },
    {
      departure: state.onwardDeparture.trim(),
      duration: state.onwardDuration.trim() || "PT0S",
      timeZone: state.onwardZone.trim() || state.portZone.trim(),
    },
  ];
}

export function permalinkOf(state: ConnectionState): Record<string, string> {
  const out: Record<string, string> = {};
  const field = (key: keyof ConnectionState) => {
    const value = state[key].trim();
    if (value !== "") out[key] = value;
  };
  field("inboundDeparture");
  field("inboundDuration");
  field("portZone");
  field("handlingMinutes");
  field("onwardDeparture");
  field("onwardDuration");
  field("onwardZone");
  return out;
}

// ---------------------------------------------------------------------------
// The verdict — from the library alone
// ---------------------------------------------------------------------------

export type VerdictKind = "made" | "missed" | "no-verdict";

export interface Verdict {
  kind: VerdictKind;
  text: string;
  readyLocal?: string;
  departureLocal?: string;
}

/**
 * `result !== null` means made. The slack is the onward departure minus the
 * ready instant. A `null` whose failing reason is `missed-connection` means
 * missed; anything else is no verdict, explained by `diagnose` in the reason
 * aside.
 */
export function verdict(
  legs: readonly ScheduleLeg[],
  lib: TransportLib,
): Verdict {
  const portZone = legs[0]!.timeZone;
  const result = lib.scheduleDelivery(legs);
  const ready = readyAt(legs, 0, undefined, lib);
  const onwardDeparture = legs[1]!.departure;
  const dep =
    onwardDeparture !== undefined
      ? departureAt(onwardDeparture, false, undefined, lib)
      : null;
  const readyLocal = ready ? lib.etaAtZone(ready, portZone) : undefined;
  const departureLocal = dep ? lib.etaAtZone(dep, portZone) : undefined;

  if (result !== null && ready && dep) {
    const slack = minutesBetween(ready, dep);
    const text =
      slack === 0
        ? "Made with zero slack: the train leaves exactly when the cargo is ready. Equal passes."
        : `Made: the train leaves ${minutesText(slack)} after the cargo is ready.`;
    return { kind: "made", text, readyLocal, departureLocal };
  }

  const diag = diagnose(legs, undefined, lib);
  if (diag?.reason === "missed-connection" && ready && dep) {
    const slack = minutesBetween(ready, dep);
    return {
      kind: "missed",
      text: `Missed: the train leaves ${minutesText(slack)} before the cargo is ready.`,
      readyLocal,
      departureLocal,
    };
  }

  return {
    kind: "no-verdict",
    text: "No verdict.",
    readyLocal,
    departureLocal,
  };
}

// ---------------------------------------------------------------------------
// The naive check — "the times as printed"
// ---------------------------------------------------------------------------

export interface NaiveCheck {
  lands: string;
  ready: string;
  leaves: string;
  made: boolean;
  spareMinutes: number;
}

/** The `YYYY-MM-DDTHH:MM[:SS]` text before any offset or bracket. */
function writtenWallClock(text: string): string {
  const m = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?)/.exec(text.trim());
  return m ? m[1]! : text.trim();
}

function hhmm(pdt: Temporal.PlainDateTime): string {
  return `${String(pdt.hour).padStart(2, "0")}:${String(pdt.minute).padStart(2, "0")}`;
}

/**
 * The naive value: the inbound departure's written wall clock, plus its
 * duration as a wall-clock addition, plus the handling time, compared with
 * the onward departure's written wall clock — no zone, no offset, no DST.
 * `null` when the written text or duration cannot be parsed as a plain wall
 * time.
 */
export function naiveCheck(state: ConnectionState): NaiveCheck | null {
  try {
    const inbound = Temporal.PlainDateTime.from(
      writtenWallClock(state.inboundDeparture),
    );
    const duration = Temporal.Duration.from(state.inboundDuration.trim());
    const lands = inbound.add(duration);
    const handling = Number.parseInt(state.handlingMinutes, 10);
    const minutes = Number.isFinite(handling) ? handling : 0;
    const ready = lands.add({ minutes });
    const leaves = Temporal.PlainDateTime.from(
      writtenWallClock(state.onwardDeparture),
    );
    const made = Temporal.PlainDateTime.compare(ready, leaves) <= 0;
    const spareMinutes = leaves.since(ready, {
      largestUnit: "minutes",
    }).minutes;
    return {
      lands: hhmm(lands),
      ready: hhmm(ready),
      leaves: hhmm(leaves),
      made,
      spareMinutes,
    };
  } catch {
    return null;
  }
}
