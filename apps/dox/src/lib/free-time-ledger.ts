/**
 * Pure helpers for the Free Time Ledger widget (INT-12).
 *
 * The ledger draws a container's clock on a terminal's real local-day grid,
 * the same grid the Dwell Ledger draws, and colours each day the way the tariff
 * reads it: the uncounted event day, the free days, the closed days a
 * working-day tariff skips, and the chargeable days with their tier bands. The
 * numbers it teaches are `freeTimeExpiry`'s and `chargeableDays`'s, and the
 * widget never computes them itself: the mount calls the real functions and
 * prints what they return. The colouring here is drawing, and a test asserts
 * it agrees with the library for every preset.
 *
 * No DOM and no gmt import, mirroring `dwell-ledger.ts`: validators come in
 * from the mount, loaded from the real package.
 */

import { Temporal } from "@js-temporal/polyfill";
import { CURATED_TIMEZONES } from "./curated-timezones";
import type { DayCell } from "./dwell-ledger";

export type FirstDay = "eventDay" | "nextDay";
export type Basis = "calendar" | "working";

/**
 * Seed arguments. The chat tool sends typed values; a permalink can only carry
 * strings (see `seedFromLocation`), so every list and number is also accepted
 * as text and read by `readArgs`.
 */
export interface FreeTimeLedgerArgs {
  clockStart?: string;
  clockEnd?: string;
  freeDays?: number | string;
  firstDay?: string;
  basis?: string;
  /** How days after free time are charged: `calendar` or `working`. */
  chargeBasis?: string;
  /** IANA zone the days are counted in. */
  zone?: string;
  /** ISO weekday numbers, or their comma-joined text. */
  weekend?: number[] | string;
  /** ISO dates, or their comma-joined text. */
  holidays?: string[] | string;
  /** Last chargeable-day ordinal of each band, or their comma-joined text. */
  tiers?: number[] | string;
}

/** The widget's controls, as strings, which is what the DOM holds. */
export interface LedgerState {
  clockStart: string;
  clockEnd: string;
  freeDays: string;
  firstDay: FirstDay;
  basis: Basis;
  chargeBasis: Basis;
  zone: string;
  /** ISO weekday numbers, ascending. */
  weekend: number[];
  /** One ISO date per line, as typed. */
  holidays: string;
  /** Comma-separated ordinals, as typed. */
  tiers: string;
}

export const LEDGER_ZONES: readonly string[] = CURATED_TIMEZONES;
export const CUSTOM_PRESET_ID = "custom";
export const DEFAULT_WEEKEND: readonly number[] = [6, 7];

export interface FreeTimePreset extends LedgerState {
  id: string;
  label: string;
  description: string;
}

const friday = "2024-06-14T19:00:00Z";
const newYork = "America/New_York";

/**
 * Every preset is one of `freeTimeExpiry`'s or `chargeableDays`'s JSDoc
 * examples, so the result the widget prints is a result the library documents.
 * The mount test asserts each one against the literal string.
 */
export const FREE_TIME_PRESETS: readonly FreeTimePreset[] = [
  {
    id: "friday-three-days",
    label: "Friday discharge, three calendar days",
    description:
      "Discharged Friday 15:00 in New York with three free calendar days, out one second into Monday. The weekend is consumed, and Monday is a charged day.",
    clockStart: friday,
    clockEnd: "2024-06-17T04:00:01Z",
    freeDays: "3",
    firstDay: "eventDay",
    basis: "calendar",
    chargeBasis: "calendar",
    zone: newYork,
    weekend: [6, 7],
    holidays: "",
    tiers: "",
  },
  {
    id: "read-as-next-day",
    label: "The same tariff read as nextDay",
    description:
      "The same discharge, but free time starts the day after the event. Free time ends on Tuesday, and the Monday gate-out is still free: one convention, one day of charges.",
    clockStart: friday,
    clockEnd: "2024-06-17T04:00:01Z",
    freeDays: "3",
    firstDay: "nextDay",
    basis: "calendar",
    chargeBasis: "calendar",
    zone: newYork,
    weekend: [6, 7],
    holidays: "",
    tiers: "",
  },
  {
    id: "out-at-expiry",
    label: "Gate-out exactly at expiry",
    description:
      "Out at 00:00 on Monday, the instant free time ends. The dwell is half-open, so nothing of Monday is used and nothing is charged.",
    clockStart: friday,
    clockEnd: "2024-06-17T04:00:00Z",
    freeDays: "3",
    firstDay: "eventDay",
    basis: "calendar",
    chargeBasis: "calendar",
    zone: newYork,
    weekend: [6, 7],
    holidays: "",
    tiers: "",
  },
  {
    id: "working-days",
    label: "Working-day free time, calendar-day charges",
    description:
      "Free time counted in working days, then every calendar day charged, the most common shape where free time is in working days. The weekend does not burn free time, but Juneteenth and the next weekend are billed once free time has ended.",
    clockStart: friday,
    clockEnd: "2024-06-24T15:00:00Z",
    freeDays: "3",
    firstDay: "eventDay",
    basis: "working",
    chargeBasis: "calendar",
    zone: newYork,
    weekend: [6, 7],
    holidays: "2024-06-19",
    tiers: "",
  },
  {
    id: "terminal-holiday",
    label: "Working days throughout",
    description:
      "The same dwell on a tariff that charges working days only: the Juneteenth holiday and the weekend after expiry are not charged, so three days are billed instead of six.",
    clockStart: friday,
    clockEnd: "2024-06-24T15:00:00Z",
    freeDays: "3",
    firstDay: "eventDay",
    basis: "working",
    chargeBasis: "working",
    zone: newYork,
    weekend: [6, 7],
    holidays: "2024-06-19",
    tiers: "",
  },
  {
    id: "tiers",
    label: "Twelve days in tiers of 5, 5 and 2",
    description:
      "Two weeks at the terminal on a tariff that escalates after five and ten days. byTier counts the days in each band; the rates are yours.",
    clockStart: friday,
    clockEnd: "2024-06-28T15:00:00Z",
    freeDays: "3",
    firstDay: "eventDay",
    basis: "calendar",
    chargeBasis: "calendar",
    zone: newYork,
    weekend: [6, 7],
    holidays: "",
    tiers: "5, 10",
  },
  {
    id: "no-free-time",
    label: "No free time",
    description:
      "A tariff with no free days at all. chargeableDays charges every day from the event day; freeTimeExpiry has no last free day to name and returns null.",
    clockStart: friday,
    clockEnd: "2024-06-16T15:00:00Z",
    freeDays: "0",
    firstDay: "eventDay",
    basis: "calendar",
    chargeBasis: "calendar",
    zone: newYork,
    weekend: [6, 7],
    holidays: "",
    tiers: "",
  },
];

// ---------------------------------------------------------------------------
// Reading controls and arguments
// ---------------------------------------------------------------------------

/** Comma- or newline-separated text as trimmed, non-empty items. */
export function splitList(text: string): string[] {
  return text
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Comma-separated ordinals as numbers, or `null` when any item is not one. */
export function parseNumberList(text: string): number[] | null {
  const items = splitList(text);
  const numbers = items.map((s) => Number(s));
  return numbers.every((n) => Number.isFinite(n)) ? numbers : null;
}

/** The weekday list a preset or argument names, ascending and deduplicated. */
export function normaliseWeekend(days: readonly number[]): number[] {
  return [...new Set(days.filter((d) => Number.isInteger(d)))].sort(
    (a, b) => a - b,
  );
}

/**
 * Seed arguments as control values. Typed values (the chat tool) and their text
 * forms (a permalink) both land here; anything unusable falls back to the
 * first preset's value for that control, never to a guess about the tariff.
 */
export function readArgs(args: FreeTimeLedgerArgs): LedgerState {
  const base = FREE_TIME_PRESETS[0]!;
  const list = (v: unknown): string[] =>
    Array.isArray(v)
      ? v.map(String)
      : typeof v === "string"
        ? splitList(v)
        : [];
  const weekendItems =
    args.weekend === undefined ? null : list(args.weekend).map(Number);
  return {
    clockStart: args.clockStart ?? "",
    clockEnd: args.clockEnd ?? "",
    freeDays:
      args.freeDays === undefined || args.freeDays === ""
        ? base.freeDays
        : String(args.freeDays),
    firstDay: args.firstDay === "nextDay" ? "nextDay" : "eventDay",
    basis: args.basis === "working" ? "working" : "calendar",
    chargeBasis: args.chargeBasis === "working" ? "working" : "calendar",
    zone: args.zone ?? "",
    weekend:
      weekendItems === null
        ? [...DEFAULT_WEEKEND]
        : normaliseWeekend(weekendItems),
    holidays: list(args.holidays).join("\n"),
    tiers: list(args.tiers).join(", "),
  };
}

/** The preset whose controls match `state`, or `custom`. */
export function matchPreset(state: LedgerState): string {
  const hit = FREE_TIME_PRESETS.find(
    (p) =>
      p.clockStart === state.clockStart &&
      p.clockEnd === state.clockEnd &&
      p.freeDays === state.freeDays &&
      p.firstDay === state.firstDay &&
      p.basis === state.basis &&
      p.chargeBasis === state.chargeBasis &&
      p.zone === state.zone &&
      ((p.basis === "calendar" && p.chargeBasis === "calendar") ||
        (p.weekend.join(",") === state.weekend.join(",") &&
          splitList(p.holidays).join(",") ===
            splitList(state.holidays).join(","))) &&
      splitList(p.tiers).join(",") === splitList(state.tiers).join(","),
  );
  return hit ? hit.id : CUSTOM_PRESET_ID;
}

// ---------------------------------------------------------------------------
// The library's arguments
// ---------------------------------------------------------------------------

export interface BusinessCalendarArg {
  weekend: number[];
  holidays: string[];
  timeZone: string;
}

export interface TermsArg {
  basis: Basis;
  timeZone: string;
  firstDay: FirstDay;
  calendar?: BusinessCalendarArg;
}

export interface ChargeTermsArg {
  basis: Basis;
  chargeBasis: Basis;
  timeZone: string;
  firstDay: FirstDay;
  calendar?: BusinessCalendarArg;
}

/**
 * The options object `freeTimeExpiry` is called with, exactly as the call line prints it. The
 * calendar is passed when free days are counted on it.
 */
export function termsOf(state: LedgerState): TermsArg {
  const terms: TermsArg = {
    basis: state.basis,
    timeZone: state.zone,
    firstDay: state.firstDay,
  };
  if (state.basis === "working") {
    terms.calendar = {
      weekend: state.weekend,
      holidays: splitList(state.holidays),
      timeZone: state.zone,
    };
  }
  return terms;
}

/**
 * The options object `chargeableDays` is called with: the free-time terms plus the charge basis,
 * and the calendar when either basis is working.
 */
export function chargeTermsOf(state: LedgerState): ChargeTermsArg {
  const terms: ChargeTermsArg = {
    basis: state.basis,
    chargeBasis: state.chargeBasis,
    timeZone: state.zone,
    firstDay: state.firstDay,
  };
  if (state.basis === "working" || state.chargeBasis === "working") {
    terms.calendar = {
      weekend: state.weekend,
      holidays: splitList(state.holidays),
      timeZone: state.zone,
    };
  }
  return terms;
}

/** `freeDays` as the number the library is called with; `NaN` when it is not one. */
export function freeDaysOf(state: LedgerState): number {
  return state.freeDays.trim() === "" ? Number.NaN : Number(state.freeDays);
}

/** The `tiers` option, `undefined` when blank, `null` when unreadable. */
export function tiersOf(state: LedgerState): number[] | undefined | null {
  if (state.tiers.trim() === "") return undefined;
  return parseNumberList(state.tiers);
}

// ---------------------------------------------------------------------------
// Results and their drawing
// ---------------------------------------------------------------------------

export interface FreeTimeResult {
  freeTimeStart: string;
  lastFreeDay: string;
  expiresAt: string;
}

export interface TierBandResult {
  from: number;
  to: number | null;
  days: number;
}

export interface ChargesResult {
  freeDaysUsed: number;
  chargeableDays: number;
  expiresAt: string;
  chargedDates: string[];
  byTier: TierBandResult[];
}

/** How the tariff reads one local day of the dwell. */
export type CellState = "event" | "free" | "closed" | "chargeable" | "none";

/** True when `date` is a weekend day or holiday of the working-day calendar. */
export function isClosedDate(
  date: string,
  basis: Basis,
  weekend: readonly number[],
  holidays: readonly string[],
): boolean {
  if (basis !== "working") return false;
  try {
    const d = Temporal.PlainDate.from(date);
    return weekend.includes(d.dayOfWeek) || holidays.includes(d.toString());
  } catch {
    return false;
  }
}

/**
 * Classify a day cell from the library's answers. A charged date is what
 * `chargedDates` says; a free day lies inside the window `freeTimeExpiry`
 * named; a closed day is one the working-day calendar skips, read on `basis`
 * before expiry and on `chargeBasis` after it; and a touched day before free
 * time began is the event day the tariff did not count. Cells the dwell never
 * touched are plain.
 */
export function cellState(
  cell: DayCell,
  state: LedgerState,
  freeTime: FreeTimeResult | null,
  charges: ChargesResult | null,
): CellState {
  if (charges?.chargedDates.includes(cell.date)) return "chargeable";
  if (!cell.touched) return "none";
  const expiresMs = charges
    ? epochMs(charges.expiresAt)
    : freeTime
      ? epochMs(freeTime.expiresAt)
      : Number.NaN;
  const afterExpiry = !Number.isNaN(expiresMs) && cell.startMs >= expiresMs;
  if (
    isClosedDate(
      cell.date,
      afterExpiry ? state.chargeBasis : state.basis,
      state.weekend,
      splitList(state.holidays),
    )
  ) {
    return "closed";
  }
  if (
    freeTime &&
    cell.date >= freeTime.freeTimeStart &&
    cell.date <= freeTime.lastFreeDay
  ) {
    return "free";
  }
  if (charges && (!freeTime || cell.date < freeTime.freeTimeStart))
    return "event";
  return "none";
}

/** Charged dates that end a tier band, so a boundary can be drawn after them. */
export function tierEnds(charges: ChargesResult | null): Set<string> {
  const ends = new Set<string>();
  if (!charges) return ends;
  for (const band of charges.byTier) {
    if (band.to !== null && band.to <= charges.chargedDates.length) {
      ends.add(charges.chargedDates[band.to - 1]!);
    }
  }
  return ends;
}

/** What `freeTimeExpiry` returns, one key per line, as the guide writes it. */
export function formatFreeTime(r: FreeTimeResult): string {
  return (
    `{ freeTimeStart: ${JSON.stringify(r.freeTimeStart)},\n` +
    `  lastFreeDay: ${JSON.stringify(r.lastFreeDay)},\n` +
    `  expiresAt: ${JSON.stringify(r.expiresAt)} }`
  );
}

/** What `chargeableDays` returns, one key per line, as the guide writes it. */
export function formatCharges(r: ChargesResult): string {
  const dates = `[${r.chargedDates.map((d) => JSON.stringify(d)).join(", ")}]`;
  const bands = `[${r.byTier
    .map((b) => `{ from: ${b.from}, to: ${b.to}, days: ${b.days} }`)
    .join(", ")}]`;
  return (
    `{ freeDaysUsed: ${r.freeDaysUsed},\n` +
    `  chargeableDays: ${r.chargeableDays},\n` +
    `  expiresAt: ${JSON.stringify(r.expiresAt)},\n` +
    `  chargedDates: ${dates},\n` +
    `  byTier: ${bands} }`
  );
}

/** `3 free days used · 1 chargeable day`. */
export function summaryText(r: ChargesResult): string {
  const free = `${r.freeDaysUsed} free ${r.freeDaysUsed === 1 ? "day" : "days"} used`;
  const charged = `${r.chargeableDays} chargeable ${r.chargeableDays === 1 ? "day" : "days"}`;
  return `${free} · ${charged}`;
}

// ---------------------------------------------------------------------------
// Why null
// ---------------------------------------------------------------------------

export type NullReason =
  | "invalid-start"
  | "invalid-end"
  | "unknown-zone"
  | "invalid-free-days"
  | "invalid-calendar"
  | "invalid-tiers"
  | "inverted"
  | "no-free-days";

export const NULL_REASON_TEXT: Record<NullReason, string> = {
  "invalid-start":
    "The clock start is not an instant. It needs a Z, an offset, or an offset with a bracketed zone.",
  "invalid-end":
    "The clock end is not an instant. It needs a Z, an offset, or an offset with a bracketed zone.",
  "unknown-zone": "The zone is not an IANA time zone this browser knows.",
  "invalid-free-days": "Free days must be a whole number of days, 0 or more.",
  "invalid-calendar":
    "The working-day calendar is not valid: it needs at least one working day a week, and every holiday must be a real ISO date.",
  "invalid-tiers":
    "Tiers must be whole chargeable-day ordinals, each larger than the last, starting at 1 or more.",
  inverted:
    "The clock end is before the clock start. An inverted dwell is a data error.",
  "no-free-days":
    "With no free days there is no last free day to name, so freeTimeExpiry returns null. chargeableDays still charges every day.",
};

export interface NullValidators {
  isValidInstant(value: string): boolean;
  isValidTimeZone(value: string): boolean;
  isValidBusinessCalendar(value: unknown): boolean;
}

function tiersValid(tiers: number[] | undefined | null): boolean {
  if (tiers === undefined) return true;
  if (tiers === null) return false;
  return tiers.every(
    (t, i) =>
      Number.isSafeInteger(t) && t >= 1 && (i === 0 || t > tiers[i - 1]!),
  );
}

/**
 * Why `chargeableDays` returned `null`, checked in the order the library
 * checks, so the reason shown is the one that actually stopped it. `null` when
 * none applies. `freeTimeExpiry`'s one extra case, zero free days, is
 * `no-free-days`, reported by `explainExpiryNull`.
 */
export function explainNull(
  state: LedgerState,
  v: NullValidators,
): NullReason | null {
  const terms = chargeTermsOf(state);
  if (!v.isValidInstant(state.clockStart)) return "invalid-start";
  if (!v.isValidInstant(state.clockEnd)) return "invalid-end";
  if (!v.isValidTimeZone(state.zone)) return "unknown-zone";
  if (terms.calendar && !v.isValidBusinessCalendar(terms.calendar))
    return "invalid-calendar";
  const days = freeDaysOf(state);
  if (!Number.isInteger(days) || days < 0) return "invalid-free-days";
  if (!tiersValid(tiersOf(state))) return "invalid-tiers";
  if (epochMs(state.clockStart) > epochMs(state.clockEnd)) return "inverted";
  return null;
}

/**
 * Why `freeTimeExpiry` returned `null`, from its own checks: it reads no clock end, no tiers and
 * no charge basis, so only the start, the zone, the free-time calendar and the free days can stop
 * it, and zero free days leaves no last free day to name.
 */
export function explainExpiryNull(
  state: LedgerState,
  v: NullValidators,
): NullReason | null {
  const terms = termsOf(state);
  if (!v.isValidInstant(state.clockStart)) return "invalid-start";
  if (!v.isValidTimeZone(state.zone)) return "unknown-zone";
  if (terms.calendar && !v.isValidBusinessCalendar(terms.calendar))
    return "invalid-calendar";
  const days = freeDaysOf(state);
  if (!Number.isInteger(days) || days < 0) return "invalid-free-days";
  return days === 0 ? "no-free-days" : null;
}

function epochMs(iso: string): number {
  try {
    return Temporal.Instant.from(iso).epochMilliseconds;
  } catch {
    try {
      return Temporal.ZonedDateTime.from(iso).epochMilliseconds;
    } catch {
      return Number.NaN;
    }
  }
}
