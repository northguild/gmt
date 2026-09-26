/**
 * Pure helpers for the Delivery Scheduler widget (TRAN-9): `scheduleDelivery`
 * chaining a truck, a ship and a train (or any 1-4 legs) into one ETA.
 *
 * The timeline draws `collectJourneyFacts`' output — every arrival, ready
 * instant and scheduled departure the real `scheduleDelivery` call produced —
 * and computes none of it itself. Its one naive value is `offsetTableReading`
 * (`transport-widgets.ts`): a fixed offset read at the moment the schedule was
 * booked, applied to a later instant as a paper table would. That is what
 * makes the hour lost at a spring-forward handoff visible.
 *
 * No DOM and no gmt import: `TransportLib` comes in from the mount, loaded
 * from the real package. `@js-temporal/polyfill` is imported for drawing
 * only — axis positions, tick instants and DST-transition markers.
 */

import { Temporal } from "@js-temporal/polyfill";
import { formatDayLabel } from "./dwell-ledger";
import {
  ZERO_LEG,
  epochMs,
  legObject,
  minutesBetween,
  minutesText,
  offsetTableReading,
  type JourneyFacts,
  type LegFields,
  type NullReason,
  type ScheduleLeg,
  type ScheduleOptions,
  type TransportLib,
} from "./transport-widgets";

export const MAX_LEGS = 4;

const BLANK_LEG: LegFields = {
  departure: "",
  duration: "",
  timeZone: "",
  dwellAfter: "",
  mode: "",
};

/** The widget's controls, as strings, which is what the DOM holds. */
export interface DeliveryState {
  legCount: string;
  startTimeZone: string;
  legs: [LegFields, LegFields, LegFields, LegFields];
}

/** Seed arguments: `legs` (the chat array) wins over the flat permalink keys. */
export interface DeliverySchedulerArgs {
  legs?: Partial<LegFields>[];
  startTimeZone?: string;
  legCount?: string;
  departure1?: string;
  duration1?: string;
  timeZone1?: string;
  dwellAfter1?: string;
  mode1?: string;
  departure2?: string;
  duration2?: string;
  timeZone2?: string;
  dwellAfter2?: string;
  mode2?: string;
  departure3?: string;
  duration3?: string;
  timeZone3?: string;
  dwellAfter3?: string;
  mode3?: string;
  departure4?: string;
  duration4?: string;
  timeZone4?: string;
  dwellAfter4?: string;
  mode4?: string;
}

export const CUSTOM_PRESET_ID = "custom";

export interface DeliveryPreset {
  id: string;
  label: string;
  description: string;
  startTimeZone: string;
  legs: readonly LegFields[];
}

const truck: LegFields = {
  departure: "2024-03-08T08:00:00-06:00[America/Chicago]",
  duration: "PT46H",
  timeZone: "America/Los_Angeles",
  dwellAfter: "PT2H",
  mode: "truck",
};
const ship = (departure: string): LegFields => ({
  departure,
  duration: "P11D",
  timeZone: "Asia/Tokyo",
  dwellAfter: "PT24H",
  mode: "ship",
});
const rail: LegFields = {
  departure: "",
  duration: "PT2H30M",
  timeZone: "Asia/Tokyo",
  dwellAfter: "",
  mode: "rail",
};

/** Every preset is a section 9 row, so the result the widget shows is a
 *  verified value. */
export const DELIVERY_PRESETS: readonly DeliveryPreset[] = [
  {
    id: "truck-ship-rail",
    label: "Truck → ship → rail across the spring-forward",
    description:
      "A truck leaves Chicago at 08:00 on 8 March 2024 and reaches Los Angeles at 05:00 on the 10th, three hours after the clocks sprang forward. Two hours of handling, eleven days at sea, a day at the Tokyo terminal, then two and a half hours by rail.",
    startTimeZone: "",
    legs: [truck, ship(""), rail],
  },
  {
    id: "ship-scheduled",
    label: "The ship sails at 07:30: a scheduled connection",
    description:
      "The ship now sails at a scheduled 07:30. The cargo is ready at 07:00, so it waits 30 minutes and the connection holds.",
    startTimeZone: "",
    legs: [truck, ship("2024-03-10T07:30:00[America/Los_Angeles]"), rail],
  },
  {
    id: "missed-connection",
    label: "The ship sails at 06:30: a missed connection",
    description:
      "The ship sails at 06:30, before the two-hour handoff ends. An offset table's −08:00 would read the truck's arrival as 04:00 and call this a connection. scheduleDelivery returns null.",
    startTimeZone: "",
    legs: [truck, ship("2024-03-10T06:30:00[America/Los_Angeles]"), rail],
  },
  {
    id: "trans-pacific",
    label: "Tokyo → Los Angeles by air, across the Date Line",
    description:
      "A flight leaves Tokyo at 17:00 on 17 June and lands in Los Angeles at 11:00 the same date, before it left by the wall clock. Then 44 hours by truck to Chicago.",
    startTimeZone: "",
    legs: [
      {
        departure: "2024-06-17T17:00:00+09:00[Asia/Tokyo]",
        duration: "PT10H",
        timeZone: "America/Los_Angeles",
        dwellAfter: "PT3H",
        mode: "air",
      },
      {
        departure: "",
        duration: "PT44H",
        timeZone: "America/Chicago",
        dwellAfter: "",
        mode: "truck",
      },
    ],
  },
  {
    id: "fall-back-night",
    label: "Overnight rail across New York's fall-back",
    description:
      "A train leaves at 22:00 on 2 November 2024 and runs six hours through the night New York falls back. The wall clock shows five. An offset table's −04:00 puts every later time an hour late.",
    startTimeZone: "",
    legs: [
      {
        departure: "2024-11-02T22:00:00-04:00[America/New_York]",
        duration: "PT6H",
        timeZone: "America/New_York",
        dwellAfter: "PT1H",
        mode: "rail",
      },
      {
        departure: "",
        duration: "PT2H",
        timeZone: "America/New_York",
        dwellAfter: "",
        mode: "truck",
      },
    ],
  },
  {
    id: "dwell-handoff",
    label: "Two hours at a UTC terminal, then on to Tokyo",
    description:
      "The JSDoc's two-leg case: ten hours to a UTC terminal, two hours of dwell, five hours on to Tokyo. The second leg leaves at 12:00Z.",
    startTimeZone: "",
    legs: [
      {
        departure: "2024-06-15T00:00:00Z",
        duration: "PT10H",
        timeZone: "UTC",
        dwellAfter: "PT2H",
        mode: "",
      },
      {
        departure: "",
        duration: "PT5H",
        timeZone: "Asia/Tokyo",
        dwellAfter: "",
        mode: "",
      },
    ],
  },
];

function padLegs(
  legs: readonly LegFields[],
): [LegFields, LegFields, LegFields, LegFields] {
  const out: LegFields[] = [];
  for (let i = 0; i < MAX_LEGS; i++) out.push(legs[i] ?? { ...BLANK_LEG });
  return out as [LegFields, LegFields, LegFields, LegFields];
}

const str = (v: unknown): string => (typeof v === "string" ? v : "");

/**
 * `legs` (an array) wins. Otherwise the flat keys. `legCount` comes from
 * `legs.length`, else `legCount` parsed as 1-4, else the highest index with
 * any non-blank field, else 1. Anything that is not a string becomes `""`.
 */
export function readArgs(args: DeliverySchedulerArgs): DeliveryState {
  let legs: LegFields[];
  let legCountFromArray: number | undefined;

  if (Array.isArray(args.legs)) {
    legs = args.legs.slice(0, MAX_LEGS).map((l) => ({
      departure: str(l?.departure),
      duration: str(l?.duration),
      timeZone: str(l?.timeZone),
      dwellAfter: str(l?.dwellAfter),
      mode: str(l?.mode),
    }));
    legCountFromArray = Math.max(1, Math.min(MAX_LEGS, legs.length));
  } else {
    legs = [1, 2, 3, 4].map((n) => {
      const rec = args as unknown as Record<string, unknown>;
      return {
        departure: str(rec[`departure${n}`]),
        duration: str(rec[`duration${n}`]),
        timeZone: str(rec[`timeZone${n}`]),
        dwellAfter: str(rec[`dwellAfter${n}`]),
        mode: str(rec[`mode${n}`]),
      };
    });
  }

  const legCountArg = (() => {
    const n = Number.parseInt(str(args.legCount), 10);
    return Number.isInteger(n) && n >= 1 && n <= MAX_LEGS ? n : undefined;
  })();

  const highestNonBlank = (() => {
    for (let i = legs.length - 1; i >= 0; i--) {
      const l = legs[i]!;
      if (l.departure || l.duration || l.timeZone || l.dwellAfter || l.mode) {
        return i + 1;
      }
    }
    return 1;
  })();

  const legCount = legCountFromArray ?? legCountArg ?? highestNonBlank;

  return {
    legCount: String(legCount),
    startTimeZone: str(args.startTimeZone),
    legs: padLegs(legs),
  };
}

/** The preset whose `legCount`, `startTimeZone` and every visible leg's five
 *  fields match `state`, trimmed, or `custom`. */
export function matchPreset(state: DeliveryState): string {
  const t = (s: string) => s.trim();
  const n = Number.parseInt(state.legCount, 10) || 0;
  const hit = DELIVERY_PRESETS.find((p) => {
    if (p.legs.length !== n) return false;
    if (t(p.startTimeZone) !== t(state.startTimeZone)) return false;
    for (let i = 0; i < n; i++) {
      const a = p.legs[i]!;
      const b = state.legs[i]!;
      if (
        t(a.departure) !== t(b.departure) ||
        t(a.duration) !== t(b.duration) ||
        t(a.timeZone) !== t(b.timeZone) ||
        t(a.dwellAfter) !== t(b.dwellAfter) ||
        t(a.mode) !== t(b.mode)
      ) {
        return false;
      }
    }
    return true;
  });
  return hit ? hit.id : CUSTOM_PRESET_ID;
}

/** `legObject` for legs `0..legCount-1`. */
export function legsOf(state: DeliveryState): ScheduleLeg[] {
  const n = Number.parseInt(state.legCount, 10) || 0;
  return state.legs.slice(0, n).map(legObject);
}

export function optionsOf(state: DeliveryState): ScheduleOptions | undefined {
  const zone = state.startTimeZone.trim();
  return zone === "" ? undefined : { startTimeZone: zone };
}

/** `legCount`, `startTimeZone` when set, and every non-blank field of each
 *  visible leg under its flat key. Strings only. */
export function permalinkOf(state: DeliveryState): Record<string, string> {
  const out: Record<string, string> = { legCount: state.legCount };
  const zone = state.startTimeZone.trim();
  if (zone !== "") out.startTimeZone = zone;
  const n = Number.parseInt(state.legCount, 10) || 0;
  for (let i = 0; i < n; i++) {
    const leg = state.legs[i]!;
    const idx = i + 1;
    if (leg.departure.trim() !== "")
      out[`departure${idx}`] = leg.departure.trim();
    if (leg.duration.trim() !== "") out[`duration${idx}`] = leg.duration.trim();
    if (leg.timeZone.trim() !== "") out[`timeZone${idx}`] = leg.timeZone.trim();
    if (leg.dwellAfter.trim() !== "")
      out[`dwellAfter${idx}`] = leg.dwellAfter.trim();
    if (leg.mode.trim() !== "") out[`mode${idx}`] = leg.mode.trim();
  }
  return out;
}

/** The zone leg 1's departure names in brackets, else `startTimeZone`, else
 *  `null` — the timeline's origin zone row. */
export function originZoneOf(state: DeliveryState): string | null {
  const bracket = /\[([^=\]]+)]/.exec(state.legs[0].departure);
  if (bracket) return bracket[1]!;
  const zone = state.startTimeZone.trim();
  return zone === "" ? null : zone;
}

// ---------------------------------------------------------------------------
// Short zone labels — a city name for an itinerary event; the full IANA id
// stays on the event's own muted, exact ISO line.
// ---------------------------------------------------------------------------

export function shortZoneLabel(zone: string): string {
  const idx = zone.lastIndexOf("/");
  const base = idx === -1 ? zone : zone.slice(idx + 1);
  return base.replace(/_/g, " ");
}

function hhmm(localText: string): string {
  const m = /T(\d{2}:\d{2})/.exec(localText);
  return m ? m[1]! : localText;
}

/** `+09:00`, `-07:00`, `Z` — the offset off a zoned string's tail, before its
 *  bracket (if any). */
function offsetOf(localText: string): string {
  const m = /(Z|[+-]\d{2}:\d{2})(?=\[|$)/.exec(localText);
  return m ? m[1]! : "";
}

const WEEKDAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** `Fri 8 Mar 2024` — an itinerary date-group heading. */
function formatDateHeading(date: Temporal.PlainDate): string {
  return `${WEEKDAY_NAMES[date.dayOfWeek - 1]} ${formatDayLabel(date.toString())} ${date.year}`;
}

function parseOffsetMinutesLocal(offset: string): number {
  const m = /^([+-])(\d{2}):(\d{2})/.exec(offset);
  if (!m) return 0;
  const sign = m[1] === "-" ? -1 : 1;
  return sign * (Number(m[2]) * 60 + Number(m[3]));
}

/** `1 d 22 h`, `2 h 30 min`, `11 d`, `0 min` — whole days, hours and minutes,
 *  from a total minute count. Days and hours only appear when non-zero;
 *  `0 min` is the floor for a genuinely zero-length span. */
function formatDaysHoursMinutes(totalMinutes: number): string {
  const abs = Math.round(Math.abs(totalMinutes));
  const days = Math.floor(abs / 1440);
  const hours = Math.floor((abs % 1440) / 60);
  const minutes = abs % 60;
  const parts: string[] = [];
  if (days > 0) parts.push(`${days} d`);
  if (hours > 0) parts.push(`${hours} h`);
  if (minutes > 0) parts.push(`${minutes} min`);
  return parts.length > 0 ? parts.join(" ") : "0 min";
}

/** A leg's own written `duration` (`PT46H`, `P11D`, `PT2H30M`), formatted as
 *  `formatDaysHoursMinutes` — the route map's segment label. Every leg
 *  duration here is hours/minutes/seconds and whole 24-hour days, the same
 *  shape `transitTime` accepts, so `Temporal.Duration.from` never throws on a
 *  value the widget itself produced or a preset shipped. */
function legDurationText(iso: string): string {
  try {
    const d = Temporal.Duration.from(iso);
    const totalMinutes =
      d.days * 24 * 60 + d.hours * 60 + d.minutes + d.seconds / 60;
    return formatDaysHoursMinutes(totalMinutes);
  } catch {
    return iso;
  }
}

// ---------------------------------------------------------------------------
// Chart data (TanStack Charts, TRAN-9 second re-evaluation): the Route
// (schematic, equal spacing) and To-scale (real time) views draw from this
// one model. Every field is read straight off `facts` or through
// `lib.etaAtZone`, never computed by arithmetic beyond formatting a duration
// or a delta. `delivery-scheduler-charts.ts` turns this into `defineChart`
// mark/scale definitions; nothing chart-library-specific lives here.
// ---------------------------------------------------------------------------

export type ChartBadgeKind = "handling" | "wait" | "offset" | "missed";

export interface ChartBadge {
  kind: ChartBadgeKind;
  text: string;
}

/** A DST or Date Line transition, attached to every leg whose departure or
 *  arrival zone (extended through a scheduled wait) contains it — the same
 *  transitions the itinerary's own date-group annotations use
 *  (`dstTransitionsIn`, `dateAnomalyText`), so the charts, the ETA card's
 *  flags and the itinerary always name the same set. A transition can attach
 *  to two legs (the zone it happens in is one leg's arrival zone and the
 *  next leg's departure zone at once). */
export interface ChartTransition {
  legIndex: number;
  zone: string;
  atMs: number;
  kind: "dst" | "date-line";
  note: string;
}

export interface ChartLeg {
  legIndex: number;
  mode?: string;
  durationIso: string;
  /** `1 d 22 h`, `2 h 30 min` — the leg's own written duration, formatted. */
  durationText: string;
  fromStation: number;
  toStation: number;
  departureMs: number;
  /** The leg's own arrival instant, or — for a leg scheduled but never
   *  reached (a missed connection) — the instant it was scheduled to leave,
   *  so a broken link still has an end point to draw to. */
  arrivalMs: number;
  /** The leg was scheduled but the journey never reached it: drawn broken,
   *  and its "arrival" is where it was scheduled to leave, not where it
   *  landed (it never did). */
  missed?: boolean;
}

export interface ChartStation {
  index: number;
  city: string;
  zone: string;
  /** `HH:MM`, local. */
  time: string;
  /** `10 Mar` — the day this station's arrival falls on, in its own zone. */
  date: string;
  /** `+09:00` / `-07:00` / `Z`. */
  offset: string;
  instantMs: number;
  isOrigin?: boolean;
  /** Set on the final station, when the schedule resolved. */
  isEta?: boolean;
  /** The leg colour this station's node takes: the leg that just arrived
   *  here, or the first leg's for the origin — same rule everywhere. */
  legColorIndex: number;
  badges: readonly ChartBadge[];
}

/** The missed-connection detail the To-scale view marks as a conflict: the
 *  gap between when the cargo was ready and when the next leg was scheduled
 *  to leave, read in the handoff zone. */
export interface ChartConflict {
  legIndex: number;
  zone: string;
  scheduledMs: number;
  readyMs: number;
}

export interface ChartData {
  legs: readonly ChartLeg[];
  stations: readonly ChartStation[];
  transitions: readonly ChartTransition[];
  conflict?: ChartConflict;
  /** The whole journey's span in milliseconds — the minimum-visible-bar
   *  fraction (`visibleBarEndMs`) is relative to this. */
  journeySpanMs: number;
}

/** Below this fraction of the whole journey's span, a leg's bar in the
 *  To-scale view is stretched to stay visible — an 11-day sea crossing
 *  would otherwise reduce a 2.5-hour rail leg to a sliver a fraction of a
 *  pixel wide. The real duration always still comes from `durationText` and
 *  the tooltip; this only changes where the bar's far edge is *drawn*. */
export const MIN_CHART_BAR_FRACTION = 0.03;

/** The visual end position for a leg's bar: never earlier than the leg's
 *  real arrival, stretched forward when the leg is shorter than
 *  `MIN_CHART_BAR_FRACTION` of the journey. */
export function visibleBarEndMs(
  departureMs: number,
  arrivalMs: number,
  journeySpanMs: number,
): number {
  const minSpan = journeySpanMs * MIN_CHART_BAR_FRACTION;
  return Math.max(arrivalMs, departureMs + minSpan);
}

// ---------------------------------------------------------------------------
// The itinerary: every event `scheduleDelivery` produced, grouped by the
// local date on which it happens (in the zone where it happens), walked in
// strict instant order.
// ---------------------------------------------------------------------------

export type ItineraryEventKind = "departure" | "arrival" | "handoff" | "dst";

export interface OffsetCheck {
  agrees: boolean;
  badge: string;
  /** `HH:MM`, only when the reading disagrees. */
  naiveTime?: string;
}

export interface ItineraryEvent {
  kind: ItineraryEventKind;
  /** The exact instant, from the library alone — the sort key. */
  instant: string;
  zone: string;
  city: string;
  /** `HH:MM`, local. */
  time: string;
  /** `+09:00` / `-07:00` / `Z`, local. */
  offset: string;
  /** The full zoned string. Kept visible on its own line, not only in a
   *  tooltip — precision is non-negotiable. */
  isoText: string;
  legIndex?: number;
  mode?: string;
  /** Set on the last leg's arrival, when the schedule resolved. */
  isEta?: boolean;
  /** Set on an arrival, when a booked-at instant exists to read one from. */
  offsetCheck?: OffsetCheck;
  /** Set on a handoff. */
  dwell?: string;
  tail?: "ready" | "waits" | "missed";
  waitText?: string;
  missedText?: string;
  /** Set on a `dst` event: the wall-clock-jump sentence, computed here from
   *  the offsets either side of the transition — never guessed. */
  note?: string;
  fromOffset?: string;
  toOffset?: string;
}

export interface ItineraryGroup {
  /** `YYYY-MM-DD`, this group's local date. */
  date: string;
  heading: string;
  /** Set when the first event landing in this group crossed into a local
   *  date its previous zone's calendar would not have shown yet (or would
   *  already have passed) — the Date Line / zone-change signal, computed
   *  from Temporal alone, never named per preset. */
  anomaly: string | null;
  events: readonly ItineraryEvent[];
}

export interface Itinerary {
  groups: readonly ItineraryGroup[];
  /** The chart views' shared accessible summary (`aria-label`). */
  summary: string;
}

/** DST transitions inside the span, at most 4 per zone, as the wall-clock
 *  jump they are (`02:00 → 03:00`) rather than as an offset pair — computed
 *  from the instant's offset either side of the transition. */
function dstTransitionsIn(
  zone: string,
  axisStartMs: number,
  axisEndMs: number,
): { instant: string; fromOffset: string; toOffset: string; note: string }[] {
  try {
    let cur = Temporal.Instant.fromEpochMilliseconds(
      Math.floor(axisStartMs),
    ).toZonedDateTimeISO(zone);
    const out: {
      instant: string;
      fromOffset: string;
      toOffset: string;
      note: string;
    }[] = [];
    for (let i = 0; i < 4; i++) {
      const next = cur.getTimeZoneTransition("next");
      if (!next || next.epochMilliseconds > axisEndMs) break;
      const gapMinutes =
        parseOffsetMinutesLocal(next.offset) -
        parseOffsetMinutesLocal(cur.offset);
      const after = next.toPlainTime();
      const before = after.subtract({ minutes: gapMinutes });
      const verb = gapMinutes > 0 ? "spring forward" : "fall back";
      const pad = (n: number) => String(n).padStart(2, "0");
      const wall = (t: Temporal.PlainTime) => `${pad(t.hour)}:${pad(t.minute)}`;
      out.push({
        instant: next.toInstant().toString(),
        fromOffset: cur.offset,
        toOffset: next.offset,
        note: `${shortZoneLabel(zone)} clocks ${verb} ${wall(before)} → ${wall(after)}`,
      });
      cur = next;
    }
    return out;
  } catch {
    return [];
  }
}

/** Whether `curZone`'s local date at `instant` differs from what `prevZone`'s
 *  calendar would show at that same instant — the Date Line / zone-change
 *  signal. `null` when the zones agree, or the zone did not change. */
function dateAnomalyText(
  instant: string,
  prevZone: string,
  curZone: string,
  city: string,
): string | null {
  if (prevZone === curZone) return null;
  try {
    const inst = Temporal.Instant.from(instant);
    const actual = inst.toZonedDateTimeISO(curZone).toPlainDate();
    const projected = inst.toZonedDateTimeISO(prevZone).toPlainDate();
    const cmp = Temporal.PlainDate.compare(actual, projected);
    if (cmp === 0) return null;
    return cmp < 0
      ? `${city} date — crossed the Date Line`
      : `${city} date — the calendar skips ahead here`;
  } catch {
    return null;
  }
}

/**
 * Every event `scheduleDelivery` produced for this journey, grouped by local
 * date. Ordering is strictly by exact instant — grouping and the Date Line
 * annotation are read off that order, never used to reorder it. The overview
 * map's segments are equal-width, never time-proportional; the itinerary
 * carries every value, each one read straight off `facts`
 * (`collectJourneyFacts`) or `lib.etaAtZone`, never computed by arithmetic.
 */
export function buildItinerary(
  facts: JourneyFacts,
  legs: readonly ScheduleLeg[],
  originZone: string | null,
  lib: TransportLib,
): Itinerary | null {
  const reached = facts.arrivals.length;
  if (reached === 0 && facts.departures[0] == null) return null;

  const instants: string[] = [];
  if (facts.departures[0]) instants.push(facts.departures[0]!);
  for (const a of facts.arrivals) if (a) instants.push(a);
  for (const r of facts.readies) if (r) instants.push(r);
  for (const d of facts.departures) if (d) instants.push(d);
  if (instants.length === 0) return null;

  const epochs = instants
    .map((s) => epochMs(s))
    .filter((n) => !Number.isNaN(n));
  const minMs = Math.min(...epochs);
  const maxMs = Math.max(...epochs);
  const span = Math.max(1, maxMs - minMs);
  const pad = span * 0.02;
  const axisStartMs = minMs - pad;
  const axisEndMs = maxMs + pad;

  // Guarded above: reached > 0 or departures[0] != null, so leg 0's
  // departure always resolved by this point.
  const bookedAt = facts.departures[0]!;

  // ------------------------------------------------------------
  // Itinerary events
  // ------------------------------------------------------------
  const events: ItineraryEvent[] = [];

  const zoned = (
    kind: ItineraryEventKind,
    instant: string,
    zone: string,
    extra: Partial<ItineraryEvent> = {},
  ): ItineraryEvent => {
    const isoText = lib.etaAtZone(instant, zone);
    return {
      kind,
      instant,
      zone,
      city: shortZoneLabel(zone),
      time: hhmm(isoText),
      offset: offsetOf(isoText),
      isoText,
      ...extra,
    };
  };

  for (let i = 0; i < reached; i++) {
    const dep = facts.departures[i];
    const depZone =
      i === 0 ? (originZone ?? legs[0]!.timeZone) : legs[i - 1]!.timeZone;
    if (dep) {
      events.push(
        zoned("departure", dep, depZone, { legIndex: i, mode: legs[i]?.mode }),
      );
    }

    const arr = facts.arrivals[i];
    if (arr) {
      let offsetCheck: OffsetCheck | undefined;
      if (bookedAt) {
        const reading = offsetTableReading(arr, legs[i]!.timeZone, bookedAt);
        offsetCheck =
          reading.deltaMinutes === 0
            ? { agrees: true, badge: "agrees" }
            : {
                agrees: false,
                badge: `${minutesText(reading.deltaMinutes)} ${reading.deltaMinutes < 0 ? "early" : "late"}`,
                naiveTime: hhmm(reading.wall),
              };
      }
      const isEta = facts.result !== null && i === legs.length - 1;
      events.push(
        zoned("arrival", arr, legs[i]!.timeZone, {
          legIndex: i,
          mode: legs[i]?.mode,
          offsetCheck,
          isEta,
        }),
      );
    }

    // Not `i === reached - 1`: on a missed connection `reached` stops one
    // leg short of the failure, so the last *reached* leg is exactly the one
    // whose handoff needs to show (the special case, below). Only a genuine
    // completed journey's last leg has no handoff to show.
    const isTrueFinal = facts.result !== null && i === legs.length - 1;
    if (!isTrueFinal) {
      const ready = facts.readies[i];
      if (ready) {
        const scheduled = facts.scheduled[i + 1];
        const nextDep = facts.departures[i + 1];
        let tail: "ready" | "waits" | "missed" = "ready";
        let waitText: string | undefined;
        let missedText: string | undefined;
        if (
          facts.failure?.reason === "missed-connection" &&
          facts.failure.leg === i + 1
        ) {
          tail = "missed";
          const missedDep = facts.departures[i + 1];
          missedText = missedDep
            ? `Missed connection: scheduled to leave ${hhmm(lib.etaAtZone(missedDep, legs[i]!.timeZone))}, before the cargo is ready.`
            : "Missed connection: scheduled before the cargo is ready.";
        } else if (scheduled !== undefined && nextDep && nextDep !== ready) {
          tail = "waits";
          waitText = `leaves ${minutesText(minutesBetween(ready, nextDep))} after the cargo is ready`;
        }
        events.push(
          zoned("handoff", ready, legs[i]!.timeZone, {
            legIndex: i,
            dwell: legs[i]?.dwellAfter ?? "PT0S",
            tail,
            waitText,
            missedText,
          }),
        );
      }
    }
  }

  const zonesInvolved = new Set<string>();
  if (originZone) zonesInvolved.add(originZone);
  for (const leg of legs) zonesInvolved.add(leg.timeZone);
  for (const zone of zonesInvolved) {
    for (const t of dstTransitionsIn(zone, axisStartMs, axisEndMs)) {
      events.push(
        zoned("dst", t.instant, zone, {
          fromOffset: t.fromOffset,
          toOffset: t.toOffset,
          note: t.note,
        }),
      );
    }
  }

  events.sort((a, b) => epochMs(a.instant) - epochMs(b.instant));

  // ------------------------------------------------------------
  // Group by local date, walked in instant order
  // ------------------------------------------------------------
  const groups: ItineraryGroup[] = [];
  let prevEvent: ItineraryEvent | null = null;
  let prevDate: Temporal.PlainDate | null = null;
  for (const ev of events) {
    const date = Temporal.Instant.from(ev.instant)
      .toZonedDateTimeISO(ev.zone)
      .toPlainDate();
    if (!prevDate || Temporal.PlainDate.compare(date, prevDate) !== 0) {
      groups.push({
        date: date.toString(),
        heading: formatDateHeading(date),
        anomaly: null,
        events: [],
      });
      prevDate = date;
    }
    const group = groups[groups.length - 1]!;
    if (prevEvent) {
      const anomaly = dateAnomalyText(
        ev.instant,
        prevEvent.zone,
        ev.zone,
        ev.city,
      );
      if (anomaly && group.anomaly === null) group.anomaly = anomaly;
    }
    (group.events as ItineraryEvent[]).push(ev);
    prevEvent = ev;
  }

  // ------------------------------------------------------------
  // Summary — the route map's accessible name
  // ------------------------------------------------------------
  const summaryParts: string[] = [];
  for (let i = 0; i < reached; i++) {
    const dep = facts.departures[i];
    const arr = facts.arrivals[i];
    const local = facts.localArrivals[i];
    const mode = legs[i]?.mode;
    if (dep && arr) {
      summaryParts.push(
        `Leg ${i + 1}${mode ? `, ${mode}` : ""}: leaves ${dep}, arrives ${arr}${local ? `, ${hhmm(local)} in ${legs[i]!.timeZone}` : ""}.`,
      );
    }
  }
  if (facts.failure?.reason === "missed-connection") {
    const k = facts.failure.leg;
    summaryParts.push(
      `Leg ${k + 1} is scheduled before leg ${k}'s handling time allows: a missed connection.`,
    );
  }
  for (const ev of events) {
    if (ev.kind === "dst" && ev.note) summaryParts.push(ev.note);
  }

  return {
    groups,
    summary: summaryParts.join(" "),
  };
}

/**
 * The chart views' shared data: one leg per reached leg (plus one broken
 * "leg" for a missed connection, so the Route view has a broken segment to
 * draw and the To-scale view a lane to mark the conflict in), stations
 * between them, and every DST / Date Line transition attached to the leg(s)
 * whose departure or arrival zone contains it. Every value is read straight
 * off `facts` or through `lib.etaAtZone` — nothing here is time-proportional
 * or computed by arithmetic beyond formatting a duration or a delta.
 *
 * Transitions are found exactly as the itinerary finds its own DST notes
 * (`dstTransitionsIn`, the same helper, the same zones), just attributed to
 * legs instead of dumped into date groups — so the Route and To-scale
 * views, the ETA card's `DST ×N` flag and the itinerary's own notes always
 * name the same set. A transition can attach to two legs when it falls in a
 * zone that is one leg's arrival zone and the next leg's departure zone at
 * once (the same handoff zone) — the arrival-zone check is extended through
 * a scheduled wait, so a transition during the handoff still counts.
 */
export function buildChartData(
  facts: JourneyFacts,
  legs: readonly ScheduleLeg[],
  originZone: string | null,
  lib: TransportLib,
): ChartData | null {
  const reached = facts.arrivals.length;
  if (reached === 0 && facts.departures[0] == null) return null;

  const instants: string[] = [];
  if (facts.departures[0]) instants.push(facts.departures[0]!);
  for (const a of facts.arrivals) if (a) instants.push(a);
  for (const r of facts.readies) if (r) instants.push(r);
  for (const d of facts.departures) if (d) instants.push(d);
  if (instants.length === 0) return null;

  const epochs = instants
    .map((s) => epochMs(s))
    .filter((n) => !Number.isNaN(n));
  const minMs = Math.min(...epochs);
  const maxMs = Math.max(...epochs);
  const journeySpanMs = Math.max(1, maxMs - minMs);

  const bookedAt = facts.departures[0]!;
  const originFieldsZone = originZone ?? legs[0]!.timeZone;

  const stationAt = (
    instant: string,
    zone: string,
  ): Omit<ChartStation, "badges" | "index" | "legColorIndex"> => {
    const isoText = lib.etaAtZone(instant, zone);
    const date = Temporal.Instant.from(instant)
      .toZonedDateTimeISO(zone)
      .toPlainDate();
    return {
      city: shortZoneLabel(zone),
      zone,
      time: hhmm(isoText),
      offset: offsetOf(isoText),
      date: formatDayLabel(date.toString()),
      instantMs: epochMs(instant),
    };
  };

  const chartLegs: ChartLeg[] = [];
  const stations: ChartStation[] = [
    {
      ...stationAt(bookedAt, originFieldsZone),
      index: 0,
      legColorIndex: 0,
      isOrigin: true,
      badges: [],
    },
  ];
  const transitions: ChartTransition[] = [];

  const pushTransitions = (
    legIndex: number,
    zone: string,
    fromMs: number,
    toMs: number,
  ): void => {
    if (toMs <= fromMs) return;
    for (const t of dstTransitionsIn(zone, fromMs, toMs)) {
      transitions.push({
        legIndex,
        zone,
        atMs: epochMs(t.instant),
        kind: "dst",
        note: t.note,
      });
    }
  };

  for (let i = 0; i < reached; i++) {
    const dep = facts.departures[i];
    const arr = facts.arrivals[i];
    if (!dep || !arr) break;

    const depZone = i === 0 ? originFieldsZone : legs[i - 1]!.timeZone;
    const arrZone = legs[i]!.timeZone;
    const depMs = epochMs(dep);
    const arrMs = epochMs(arr);

    const ready = facts.readies[i];
    const nextDep = facts.departures[i + 1];
    const waitEndMs =
      ready && nextDep ? Math.max(arrMs, epochMs(nextDep)) : arrMs;

    // Departure zone over the leg's own transit; arrival zone (the handoff
    // zone) over the same span, extended through a scheduled wait. When
    // they're the same zone, one scan already covers both.
    pushTransitions(i, depZone, depMs, arrMs);
    if (arrZone !== depZone) {
      pushTransitions(i, arrZone, depMs, waitEndMs);
    } else if (waitEndMs > arrMs) {
      pushTransitions(i, arrZone, arrMs, waitEndMs);
    }

    const dateLineNote =
      dateAnomalyText(arr, depZone, arrZone, shortZoneLabel(arrZone)) ??
      undefined;
    if (dateLineNote) {
      transitions.push({
        legIndex: i,
        zone: arrZone,
        atMs: arrMs,
        kind: "date-line",
        note: dateLineNote,
      });
    }

    chartLegs.push({
      legIndex: i,
      mode: legs[i]?.mode,
      durationIso: legs[i]!.duration,
      durationText: legDurationText(legs[i]!.duration),
      fromStation: i,
      toStation: i + 1,
      departureMs: depMs,
      arrivalMs: arrMs,
    });

    const badges: ChartBadge[] = [];
    const reading = offsetTableReading(arr, arrZone, bookedAt);
    if (reading.deltaMinutes !== 0) {
      badges.push({
        kind: "offset",
        text: `${minutesText(reading.deltaMinutes)} ${reading.deltaMinutes < 0 ? "early" : "late"}`,
      });
    }

    const isFinal = facts.result !== null && i === legs.length - 1;
    if (!isFinal && ready) {
      const dwell = legs[i]?.dwellAfter?.trim();
      if (dwell) {
        badges.push({
          kind: "handling",
          text: `+${legDurationText(dwell)} handling`,
        });
      }
      const isMissedHere =
        facts.failure?.reason === "missed-connection" &&
        facts.failure.leg === i + 1;
      const scheduled = facts.scheduled[i + 1];
      if (
        !isMissedHere &&
        scheduled !== undefined &&
        nextDep &&
        nextDep !== ready
      ) {
        badges.push({
          kind: "wait",
          text: `waits for ${hhmm(lib.etaAtZone(nextDep, arrZone))}`,
        });
      }
    }

    stations.push({
      ...stationAt(arr, arrZone),
      index: i + 1,
      legColorIndex: i,
      badges,
      isEta: isFinal,
    });
  }

  let conflict: ChartConflict | undefined;
  if (facts.failure?.reason === "missed-connection") {
    const k = facts.failure.leg;
    const scheduledDep = facts.departures[k];
    const readyPrev = facts.readies[k - 1];
    const handoffZone = legs[k - 1]!.timeZone;
    if (scheduledDep && readyPrev) {
      const scheduledMs = epochMs(scheduledDep);
      chartLegs.push({
        legIndex: k,
        mode: legs[k]?.mode,
        durationIso: legs[k]!.duration,
        durationText: legDurationText(legs[k]!.duration),
        fromStation: k,
        toStation: k + 1,
        departureMs: scheduledMs,
        arrivalMs: scheduledMs,
        missed: true,
      });
      stations.push({
        ...stationAt(scheduledDep, handoffZone),
        index: k + 1,
        legColorIndex: k,
        badges: [
          {
            kind: "missed",
            text: `missed — ready ${hhmm(lib.etaAtZone(readyPrev, handoffZone))}`,
          },
        ],
      });
      conflict = {
        legIndex: k,
        zone: handoffZone,
        scheduledMs,
        readyMs: epochMs(readyPrev),
      };
    }
  }

  return { legs: chartLegs, stations, transitions, conflict, journeySpanMs };
}

// ---------------------------------------------------------------------------
// The ETA summary card — the answer, first. Every value here is read off
// `facts` or `itinerary` (already the real `scheduleDelivery` output and what
// `buildItinerary` derived from it), except `doorToDoor`: a genuine
// `Temporal` computation over two gmt-returned instants — the first leg's
// exact departure and the final leg's exact arrival — never a hand count.
// ---------------------------------------------------------------------------

const FAILURE_HEADLINE: Record<NullReason, string> = {
  "invalid-start-zone": "Start zone invalid",
  "no-departure": "No departure",
  "zoneless-first": "No zone on the first departure",
  "zoneless-later": "No zone on a later departure",
  "invalid-departure": "Invalid departure",
  "missed-connection": "Missed connection",
  "invalid-duration": "Invalid duration",
  "negative-duration": "Negative duration",
  "invalid-zone": "Invalid zone",
  "invalid-dwell": "Invalid dwell",
  "out-of-range": "Out of range",
};

export interface EtaSummary {
  status: "ok" | "failed";
  legCount: number;
  /** `Sat 23 Mar 2024 · 01:30 Tokyo (+09:00)` — set when the schedule
   *  resolved. Parsed straight out of the library's own `eta` string. */
  etaLocal?: string;
  /** The same instant, exact — kept visible on a muted line underneath. */
  etaIso?: string;
  /** `14 d 17 h 30 min door to door`. */
  doorToDoor?: string;
  flags: readonly string[];
  /** 1-based. Unset for `invalid-start-zone`, which names no single leg. */
  failureLeg?: number;
  failureHeadline?: string;
}

export function buildEtaSummary(
  facts: JourneyFacts,
  legs: readonly ScheduleLeg[],
  chartData: ChartData | null,
): EtaSummary {
  const legCount = legs.length;
  const flags: string[] = [];

  if (chartData) {
    // De-duplicated by (zone, instant): a transition attached to two legs
    // (the shared handoff zone) is still one real transition, and the same
    // set `buildChartData` attaches to the Route and To-scale views —
    // agreement with the charts is by shared source, not by coincidence.
    const dstKeys = new Set(
      chartData.transitions
        .filter((t) => t.kind === "dst")
        .map((t) => `${t.zone}@${t.atMs}`),
    );
    if (dstKeys.size > 0) {
      flags.push(dstKeys.size === 1 ? "DST" : `DST ×${dstKeys.size}`);
    }
    if (chartData.transitions.some((t) => t.kind === "date-line")) {
      flags.push("Date Line");
    }
    const offsetBadge = chartData.stations
      .flatMap((s) => s.badges)
      .find((b) => b.kind === "offset");
    if (offsetBadge) {
      const magnitude = offsetBadge.text.replace(/ (early|late)$/, "");
      flags.push(`${magnitude} offset-table error`);
    }
  }

  if (facts.result !== null) {
    // `result.eta` is already the last leg's zoned local reading — parsed
    // for display, never recomputed.
    const z = Temporal.ZonedDateTime.from(facts.result.eta);
    const hh = String(z.hour).padStart(2, "0");
    const mm = String(z.minute).padStart(2, "0");
    const etaLocal = `${formatDateHeading(z.toPlainDate())} · ${hh}:${mm} ${shortZoneLabel(z.timeZoneId)} (${z.offset})`;
    const originInstant = facts.departures[0]!;
    const finalArrival = facts.arrivals[facts.arrivals.length - 1]!;
    const doorToDoor = `${formatDaysHoursMinutes(minutesBetween(originInstant, finalArrival))} door to door`;
    return {
      status: "ok",
      legCount,
      etaLocal,
      etaIso: facts.result.eta,
      doorToDoor,
      flags,
    };
  }

  const failure = facts.failure;
  return {
    status: "failed",
    legCount,
    flags,
    failureLeg: failure && failure.leg >= 0 ? failure.leg + 1 : undefined,
    failureHeadline: failure ? FAILURE_HEADLINE[failure.reason] : undefined,
  };
}

export { ZERO_LEG };
