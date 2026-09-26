/**
 * Pure helpers shared by the four multi-leg scheduling widgets (TRAN-9): the
 * Delivery Scheduler, the Connection Checker, the Timetable Reader and the
 * Crossing Clock.
 *
 * No DOM and no gmt import, mirroring `dwell-ledger.ts`: every widget-facing
 * function here takes a `TransportLib` — the real `scheduleDelivery`,
 * `transitTime`, `etaAtZone`, `crossingTime`, `isValidTimeZone`,
 * `isValidDateTime` and `resolveLocal` — as an argument, loaded by the mount
 * from the real package (`transport-lib.ts`). That keeps this module free of
 * gmt imports and lets the tests inject the real library by module path.
 *
 * `@js-temporal/polyfill` is imported for drawing only — axis positions, tick
 * instants, DST-transition markers, and the naive offset-table reading these
 * widgets each show beside the real one — never to compute a scheduling
 * result. Every arrival, local arrival, ETA, ready instant, departure instant
 * and missed-connection verdict shown by any of the four widgets comes from a
 * real call through `TransportLib`.
 *
 * GMT tracks no law: no string here names a statute, standard, regulator,
 * docket or industry body. "minimum connect time" and "handling time" are the
 * only vocabulary for the dwell after a leg.
 */

import { Temporal } from "@js-temporal/polyfill";
import { CURATED_TIMEZONES } from "./curated-timezones";
import { escapeAttr, escapeHtml } from "./widget-ui";

// ---------------------------------------------------------------------------
// Zones
// ---------------------------------------------------------------------------

/** The zone picker's options across every transport widget. */
export const TRANSPORT_ZONES: readonly string[] = [
  ...CURATED_TIMEZONES,
  "Europe/Amsterdam",
  "Europe/Rome",
  "America/Panama",
];

/** Fixed offsets, offered only where a widget specifically teaches that a
 *  fixed offset observes no DST (the Crossing Clock). */
export const FIXED_OFFSET_ZONES: readonly string[] = ["+02:00", "-05:00"];

/**
 * `<option>`s for a zone `<select>`: escaped, with a selected value the list
 * lacks appended so a seeded or typed zone is never silently dropped. An
 * optional `noneLabel` adds a first `value=""` option — omitted, the select
 * has no "none" choice at all.
 */
export function zoneOptionsHtml(
  zones: readonly string[],
  selected: string,
  noneLabel?: string,
): string {
  const list =
    selected === "" || zones.includes(selected) ? zones : [...zones, selected];
  const none =
    noneLabel === undefined
      ? ""
      : `<option value=""${selected === "" ? " selected" : ""}>${escapeHtml(noneLabel)}</option>`;
  return (
    none +
    list
      .map(
        (z) =>
          `<option value="${escapeAttr(z)}"${z === selected ? " selected" : ""}>${escapeHtml(z)}</option>`,
      )
      .join("")
  );
}

// ---------------------------------------------------------------------------
// The library, injected
// ---------------------------------------------------------------------------

export interface ScheduleLeg {
  departure?: string;
  duration: string;
  timeZone: string;
  dwellAfter?: string;
  mode?: string;
  origin?: string;
  destination?: string;
}

export interface LegTime {
  arrival: string;
  localArrival: string;
  dwellAfter: string;
  mode?: string;
  origin?: string;
  destination?: string;
}

export interface DeliverySchedule {
  eta: string;
  legTimes: LegTime[];
}

export interface ScheduleOptions {
  startTimeZone?: string;
}

export interface Crossing {
  duration: string;
  enter: string;
  exit: string;
}

/** The five real functions every transport widget needs, loaded at module
 *  granularity by `transport-lib.ts`. Injected so this module stays free of
 *  gmt imports and the tests can supply the real library by module path. */
export interface TransportLib {
  scheduleDelivery(legs: unknown, options?: unknown): DeliverySchedule | null;
  transitTime(departure: string, duration: string): string;
  etaAtZone(instant: string, zone: string): string;
  crossingTime(entry: string, exit: string, zone: string): Crossing | null;
  isValidTimeZone(value: string): boolean;
  isValidDateTime(value: string): boolean;
  resolveLocal(
    wallTime: string,
    zone: string,
    options?: { disambiguation: "earlier" | "later" },
  ): string;
}

// ---------------------------------------------------------------------------
// Legs
// ---------------------------------------------------------------------------

/** A leg's fields as the widgets' controls hold them: every value a string,
 *  blank meaning "not set". */
export interface LegFields {
  departure: string;
  duration: string;
  timeZone: string;
  dwellAfter: string;
  mode: string;
}

/**
 * The leg object `scheduleDelivery` is called with. Keys in the JSDoc order
 * (`departure, duration, timeZone, dwellAfter, mode`); every blank field is
 * omitted rather than sent as `""`, which the library reads as present and
 * invalid.
 */
export function legObject(f: LegFields): ScheduleLeg {
  const departure = f.departure.trim();
  const dwellAfter = f.dwellAfter.trim();
  const mode = f.mode.trim();
  return {
    ...(departure !== "" ? { departure } : {}),
    duration: f.duration.trim(),
    timeZone: f.timeZone.trim(),
    ...(dwellAfter !== "" ? { dwellAfter } : {}),
    ...(mode !== "" ? { mode } : {}),
  };
}

/**
 * The call's arguments as source text: `[{ … }, { … }]`, then
 * `, { startTimeZone: "…" }` only when given — for `renderCallLine`. `plain`
 * is exactly the JSDoc spelling, so V2's and V4's calls equal the library's
 * own documented call text verbatim.
 */
export function scheduleCallSource(
  legs: readonly ScheduleLeg[],
  options?: ScheduleOptions,
): [string, string] {
  const legHtml = (leg: ScheduleLeg, str: (s: string) => string): string => {
    const entries: string[] = [];
    if (leg.departure !== undefined)
      entries.push(`departure: ${str(leg.departure)}`);
    entries.push(`duration: ${str(leg.duration)}`);
    entries.push(`timeZone: ${str(leg.timeZone)}`);
    if (leg.dwellAfter !== undefined)
      entries.push(`dwellAfter: ${str(leg.dwellAfter)}`);
    if (leg.mode !== undefined) entries.push(`mode: ${str(leg.mode)}`);
    return `{ ${entries.join(", ")} }`;
  };
  const htmlStr = (s: string) =>
    `<span class="gmt-code-str">${escapeHtml(JSON.stringify(s))}</span>`;
  const plainStr = (s: string) => JSON.stringify(s);

  const legsHtml = `[${legs.map((l) => legHtml(l, htmlStr)).join(", ")}]`;
  const legsPlain = `[${legs.map((l) => legHtml(l, plainStr)).join(", ")}]`;

  const optHtml =
    options?.startTimeZone !== undefined
      ? `, { startTimeZone: ${htmlStr(options.startTimeZone)} }`
      : "";
  const optPlain =
    options?.startTimeZone !== undefined
      ? `, { startTimeZone: ${plainStr(options.startTimeZone)} }`
      : "";

  return [legsHtml + optHtml, legsPlain + optPlain];
}

// ---------------------------------------------------------------------------
// Formatting results
// ---------------------------------------------------------------------------

function legTimeLiteral(l: LegTime): string {
  const parts = [
    `arrival: ${JSON.stringify(l.arrival)}`,
    `localArrival: ${JSON.stringify(l.localArrival)}`,
    `dwellAfter: ${JSON.stringify(l.dwellAfter)}`,
  ];
  if (l.mode !== undefined) parts.push(`mode: ${JSON.stringify(l.mode)}`);
  if (l.origin !== undefined) parts.push(`origin: ${JSON.stringify(l.origin)}`);
  if (l.destination !== undefined)
    parts.push(`destination: ${JSON.stringify(l.destination)}`);
  return `{ ${parts.join(", ")} }`;
}

/** `{ eta: "…", legTimes: [{ … }, { … }] }`, one leg per line, as the guide
 *  writes it. Collapsing every `\n` plus its indent to one space gives the
 *  JSDoc result literal exactly. */
export function formatSchedule(r: DeliverySchedule): string {
  if (r.legTimes.length === 0) {
    return `{ eta: "", legTimes: [] }`;
  }
  return (
    `{ eta: ${JSON.stringify(r.eta)},\n` +
    `  legTimes: [${r.legTimes.map(legTimeLiteral).join(",\n    ")}] }`
  );
}

/** `{ duration: "…", enter: "…", exit: "…" }`, collapsing to the JSDoc
 *  literal. */
export function formatCrossing(r: Crossing): string {
  return (
    `{ duration: ${JSON.stringify(r.duration)},\n` +
    `  enter: ${JSON.stringify(r.enter)},\n` +
    `  exit: ${JSON.stringify(r.exit)} }`
  );
}

// ---------------------------------------------------------------------------
// Minutes
// ---------------------------------------------------------------------------

/** Hours and minutes only — `"0 min"`, `"5 min"`, `"1 h"`, `"1 h 30 min"`,
 *  `"55 min"`. Negative values take their absolute value; the caller words the
 *  direction ("early"/"late"). */
export function minutesText(n: number): string {
  const abs = Math.abs(Math.round(n));
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

/**
 * An instant string's epoch milliseconds, for axis positions and elapsed-
 * minute comparisons. `Temporal.Instant`, never the native `Date` this
 * package exists to replace — `epochMilliseconds` is exact and needs no
 * timezone or calendar of its own, unlike `Date.parse`.
 */
export function epochMs(instant: string): number {
  return Temporal.Instant.from(instant).epochMilliseconds;
}

/** Whole minutes from `a` to `b` (`b - a`), both real instants. */
export function minutesBetween(a: string, b: string): number {
  return (epochMs(b) - epochMs(a)) / 60_000;
}

// ---------------------------------------------------------------------------
// Probing the library for one instant, with no arithmetic of its own
// ---------------------------------------------------------------------------

/** A zero-length leg in UTC: valid input (V15), and how a widget asks the
 *  library for an instant it did not compute itself. */
export const ZERO_LEG: ScheduleLeg = { duration: "PT0S", timeZone: "UTC" };

/**
 * The instant the leg after `k` may leave: the arrival of a zero-length leg
 * appended right after it, so leg `k`'s dwell is applied exactly as it is in
 * the real call. `null` when the prefix through leg `k` does not resolve.
 */
export function readyAt(
  legs: readonly ScheduleLeg[],
  k: number,
  options: ScheduleOptions | undefined,
  lib: TransportLib,
): string | null {
  if (k < 0 || k >= legs.length) return null;
  const probe = [...legs.slice(0, k + 1), ZERO_LEG];
  const result = lib.scheduleDelivery(probe, options);
  return result?.legTimes[k + 1]?.arrival ?? null;
}

/**
 * The exact instant a written `departure` names, alone: a single zero-length
 * leg with that departure. `isFirst` decides whether `options` (and so
 * `startTimeZone`) applies — only the first leg ever reads it. `null` when
 * the departure does not resolve.
 */
export function departureAt(
  departure: string,
  isFirst: boolean,
  options: ScheduleOptions | undefined,
  lib: TransportLib,
): string | null {
  const result = lib.scheduleDelivery(
    [{ departure, ...ZERO_LEG }],
    isFirst ? options : undefined,
  );
  return result?.legTimes[0]?.arrival ?? null;
}

// ---------------------------------------------------------------------------
// Why null
// ---------------------------------------------------------------------------

export type NullReason =
  | "invalid-start-zone"
  | "no-departure"
  | "zoneless-first"
  | "zoneless-later"
  | "invalid-departure"
  | "missed-connection"
  | "invalid-duration"
  | "negative-duration"
  | "invalid-zone"
  | "invalid-dwell"
  | "out-of-range";

export interface Diagnosis {
  /** The failing leg's 0-based index, or `-1` for `invalid-start-zone`. */
  leg: number;
  reason: NullReason;
}

/** A trailing `Z`, or a numeric offset, anywhere in the text — the shape
 *  `departureInstant` treats as "already exact". */
const HAS_OFFSET_OR_Z = /(?:Z|[+-]\d{2}:?\d{2})/i;

function isZonelessDeparture(text: string, lib: TransportLib): boolean {
  return (
    lib.isValidDateTime(text) &&
    !HAS_OFFSET_OR_Z.test(text) &&
    !text.includes("[")
  );
}

/** Whether `dwell` is a duration `transitTime` would accept for the final
 *  leg: no years, months or weeks, and not negative. Mirrors
 *  `scheduleDelivery`'s own `isValidFinalDwell`, using the polyfill only to
 *  classify a diagnostic reason — never to compute a schedule. */
function isTimeUnitDwell(dwell: string | undefined): boolean {
  if (dwell === undefined) return true;
  try {
    const d = Temporal.Duration.from(dwell);
    return d.years === 0 && d.months === 0 && d.weeks === 0 && d.sign >= 0;
  } catch {
    return false;
  }
}

/**
 * Why `scheduleDelivery(legs, options)` returned `null`, checked in the
 * library's own order: `startTimeZone`, then the first failing leg's
 * departure, then a missed connection, then its duration, then its zone,
 * then its dwell. `null` when the call in fact succeeds.
 */
export function diagnose(
  legs: readonly ScheduleLeg[],
  options: ScheduleOptions | undefined,
  lib: TransportLib,
): Diagnosis | null {
  const startTimeZone = options?.startTimeZone;
  if (startTimeZone !== undefined && !lib.isValidTimeZone(startTimeZone)) {
    return { leg: -1, reason: "invalid-start-zone" };
  }

  let k = -1;
  for (let i = 0; i < legs.length; i++) {
    const prefix = legs.slice(0, i + 1);
    const probe = i + 1 < legs.length ? [...prefix, ZERO_LEG] : prefix;
    if (lib.scheduleDelivery(probe, options) === null) {
      k = i;
      break;
    }
  }
  if (k === -1) return null;

  const leg = legs[k]!;
  const departure = leg.departure;

  if (k === 0 && (departure === undefined || departure === "")) {
    return { leg: k, reason: "no-departure" };
  }

  let depInstant: string | null;
  if (departure !== undefined) {
    depInstant = departureAt(departure, k === 0, options, lib);
    if (depInstant === null) {
      return {
        leg: k,
        reason: isZonelessDeparture(departure, lib)
          ? k === 0
            ? "zoneless-first"
            : "zoneless-later"
          : "invalid-departure",
      };
    }
    if (k > 0) {
      const probe = [...legs.slice(0, k), { departure, ...ZERO_LEG }];
      if (lib.scheduleDelivery(probe, options) === null) {
        return { leg: k, reason: "missed-connection" };
      }
    }
  } else {
    depInstant = readyAt(legs, k - 1, options, lib);
  }
  if (depInstant === null) return null;

  const arrival = lib.transitTime(depInstant, leg.duration);
  if (arrival === "") return { leg: k, reason: "invalid-duration" };
  if (
    Temporal.Instant.compare(
      Temporal.Instant.from(arrival),
      Temporal.Instant.from(depInstant),
    ) < 0
  ) {
    return { leg: k, reason: "negative-duration" };
  }

  if (!lib.isValidTimeZone(leg.timeZone)) {
    return { leg: k, reason: "invalid-zone" };
  }

  return {
    leg: k,
    reason: isTimeUnitDwell(leg.dwellAfter) ? "out-of-range" : "invalid-dwell",
  };
}

/** The only reason strings a transport widget shows. `n` is the 1-based leg;
 *  `facts` carries what `missed-connection` needs to name its three times. */
export function scheduleNullText(
  reason: NullReason,
  n: number,
  facts?: { dep: string; arr: string; dwell: string; ready: string },
): string {
  switch (reason) {
    case "invalid-start-zone":
      return "startTimeZone is not a time zone this browser knows. An invalid startTimeZone returns null even when no departure needs it.";
    case "no-departure":
      return `Leg ${n} has no departure. The first leg needs one: an instant, or a zoned date-time.`;
    case "zoneless-first":
      return `Leg ${n} leaves at a wall time with no offset or zone, so it is not a moment. Set the start zone to read it as a published local time, or write its offset.`;
    case "zoneless-later":
      return `Leg ${n}'s scheduled departure has no offset or zone. Only the first leg is read in the start zone. A later departure must be exact, so write its zone in brackets.`;
    case "invalid-departure":
      return `Leg ${n}'s departure is not an instant, or a zoned date-time whose zone is real and agrees with its offset.`;
    case "missed-connection":
      return facts
        ? `Missed connection: leg ${n} is scheduled to leave at ${facts.dep}, but leg ${n - 1} arrives at ${facts.arr} and needs ${facts.dwell} at the handoff, so the earliest it can leave is ${facts.ready}. A departure before the arrival plus its handling time returns null.`
        : `Missed connection: leg ${n} is scheduled to leave before leg ${n - 1}'s arrival plus its handling time allows. A departure before the arrival plus its handling time returns null.`;
    case "invalid-duration":
      return `Leg ${n}'s duration is not one transitTime accepts: hours, minutes and seconds, and days of exactly 24 hours. Years, months and weeks return null.`;
    case "negative-duration":
      return `Leg ${n}'s duration is negative. A leg cannot arrive before it departs.`;
    case "invalid-zone":
      return `Leg ${n}'s arrival zone is not a time zone this browser knows.`;
    case "invalid-dwell":
      return `Leg ${n}'s dwell is not a duration of time units, or it is negative.`;
    case "out-of-range":
      return "The schedule leaves the range of instants Temporal can represent.";
  }
}

// ---------------------------------------------------------------------------
// Journey facts — every value a widget shows, from the library alone
// ---------------------------------------------------------------------------

export interface JourneyFacts {
  result: DeliverySchedule | null;
  failure: Diagnosis | null;
  /** The instant each reached leg departs, or `null` if it could not be found. */
  departures: (string | null)[];
  arrivals: string[];
  localArrivals: string[];
  /** The instant the leg after `i` may leave, for every non-final reached leg. */
  readies: (string | null)[];
  /** The written scheduled departure of each reached leg that had one. */
  scheduled: (string | undefined)[];
}

/**
 * Everything a widget draws about a journey, collected from `scheduleDelivery`
 * alone — never by arithmetic. On success every leg is "reached"; on failure
 * only the legs before the failing one are, plus the ready instant the failing
 * leg missed.
 */
export function collectJourneyFacts(
  legs: readonly ScheduleLeg[],
  options: ScheduleOptions | undefined,
  lib: TransportLib,
): JourneyFacts {
  const result = lib.scheduleDelivery(legs, options);
  const failure = result === null ? diagnose(legs, options, lib) : null;
  const reached = result !== null ? legs.length : (failure?.leg ?? 0);

  const prefixResult =
    result !== null
      ? result
      : reached > 0
        ? lib.scheduleDelivery(legs.slice(0, reached), options)
        : null;

  const arrivals: string[] = [];
  const localArrivals: string[] = [];
  const departures: (string | null)[] = [];
  const readies: (string | null)[] = [];
  const scheduled: (string | undefined)[] = [];

  for (let i = 0; i < reached; i++) {
    const legTime = prefixResult?.legTimes[i];
    arrivals.push(legTime?.arrival ?? "");
    localArrivals.push(legTime?.localArrival ?? "");
    const leg = legs[i]!;
    scheduled.push(leg.departure);
    departures.push(
      leg.departure !== undefined
        ? departureAt(leg.departure, i === 0, options, lib)
        : (readies[i - 1] ?? null),
    );
    const isFinal = result !== null && i === legs.length - 1;
    readies.push(isFinal ? null : readyAt(legs, i, options, lib));
  }

  if (failure?.reason === "missed-connection" && failure.leg > 0) {
    readies[failure.leg - 1] = readyAt(legs, failure.leg - 1, options, lib);
    // The failing leg's own scheduled departure never chained, so it was not
    // "reached" by the main loop above — but the timeline still needs to mark
    // where it was scheduled to leave.
    const missedLeg = legs[failure.leg]!;
    scheduled[failure.leg] = missedLeg.departure;
    departures[failure.leg] = departureAt(
      missedLeg.departure!,
      failure.leg === 0,
      options,
      lib,
    );
  }

  return {
    result,
    failure,
    departures,
    arrivals,
    localArrivals,
    readies,
    scheduled,
  };
}

// ---------------------------------------------------------------------------
// The naive offset-table reading
// ---------------------------------------------------------------------------

export interface OffsetReading {
  wall: string;
  offset: string;
  /** Naive wall clock minus the library's wall clock, in minutes. */
  deltaMinutes: number;
}

function parseOffsetMinutes(offset: string): number {
  const m = /^([+-])(\d{2}):(\d{2})/.exec(offset);
  if (!m) return 0;
  const sign = m[1] === "-" ? -1 : 1;
  return sign * (Number(m[2]) * 60 + Number(m[3]));
}

/**
 * The naive value every transport widget compares itself against: read
 * `zone`'s offset at the moment the schedule was booked (`bookedAtZ`, the
 * first departure), then apply that one fixed offset to `instantZ` as a table
 * on a wall would. This is the widget's own arithmetic, drawn with the
 * polyfill, and it is deliberately wrong across a DST change — that
 * disagreement is what the widget teaches. `deltaMinutes` compares it against
 * the zone's real offset at `instantZ` (full DST awareness — the same
 * unambiguous conversion `etaAtZone` renders), never against a second naive
 * guess.
 */
export function offsetTableReading(
  instantZ: string,
  zone: string,
  bookedAtZ: string,
): OffsetReading {
  const bookedOffset =
    Temporal.Instant.from(bookedAtZ).toZonedDateTimeISO(zone).offset;
  const naiveInstant = Temporal.Instant.from(instantZ).add({
    minutes: parseOffsetMinutes(bookedOffset),
  });
  const wall = naiveInstant.toString().slice(0, 16);

  const trueWall = Temporal.Instant.from(instantZ)
    .toZonedDateTimeISO(zone)
    .toPlainDateTime()
    .toString()
    .slice(0, 16);

  return {
    wall,
    offset: bookedOffset,
    deltaMinutes: offsetTableDelta(wall, trueWall),
  };
}

/**
 * `offsetTableReading`'s `deltaMinutes`, computed against the library's own
 * local-arrival text: the naive wall clock minus the library's, in minutes,
 * from each side's `YYYY-MM-DDTHH:MM` text.
 */
export function offsetTableDelta(
  naiveWall: string,
  libraryWall: string,
): number {
  const naive = Temporal.PlainDateTime.from(naiveWall.slice(0, 16));
  const real = Temporal.PlainDateTime.from(libraryWall.slice(0, 16));
  return naive.since(real, { largestUnit: "minutes" }).total("minutes");
}
