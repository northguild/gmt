/**
 * Pure helpers for the Billing Deadlines widget (INT-58).
 *
 * The strip draws the deadline chain `billingTimeline` returns — the last date
 * to issue, dispute and resolve a demurrage or detention invoice — as a day
 * strip wrapped by ISO week, with the three windows as numbered, patterned
 * lanes. The widget never computes a deadline itself: the mount calls the real
 * function and this module only lays out what it returned.
 *
 * No DOM and no gmt import, mirroring `free-time-ledger.ts`: the real
 * `billingTimeline` and its validators come in from the mount, loaded from the
 * real package. `@js-temporal/polyfill` is imported for drawing only — turning
 * the library's own ISO dates into a day strip — never to compute a deadline.
 *
 * Nor does it order dates as strings. A typed date may carry an RFC 9557
 * annotation or an expanded year, and even canonical ISO strings sort wrongly
 * outside years 0000–9999, so every ordering is `Temporal.PlainDate.compare`
 * and every drawn or labelled date is the canonical form the library emits.
 * Only the printed call keeps the text as typed, because it is the real call.
 *
 * GMT tracks no law: every preset label, description and reason string here
 * names no statute, regulator, docket or jurisdiction, and none of the words
 * `timely`, `untimely`, `late`, `void`, `payable` or `compliant` appears. The
 * only verdicts are "on or before the deadline" and "after the deadline" —
 * date comparisons, not a liability finding.
 */

import { Temporal } from "@js-temporal/polyfill";
import { codeSpan } from "./widget-ui";

// ---------------------------------------------------------------------------
// Seed arguments and control state
// ---------------------------------------------------------------------------

/**
 * Seed arguments. The chat tool sends typed numbers for the windows; a
 * permalink can only carry strings (see `seedFromLocation`), so every window
 * is also accepted as text and read by `readArgs`.
 */
export interface BillingDeadlinesArgs {
  anchorOn?: string;
  invoiceIssuedOn?: string;
  requestReceivedOn?: string;
  agreedResolutionOn?: string;
  issueDays?: number | string;
  disputeDays?: number | string;
  resolutionDays?: number | string;
}

/** The widget's controls, as strings, which is what the DOM holds. */
export interface BillingState {
  anchorOn: string;
  invoiceIssuedOn: string;
  requestReceivedOn: string;
  issueDays: string;
  disputeDays: string;
  resolutionDays: string;
  agreedResolutionOn: string;
}

export const CUSTOM_PRESET_ID = "custom";

export interface BillingPreset extends BillingState {
  id: string;
  label: string;
  description: string;
}

/**
 * Every preset is one of `billingTimeline`'s JSDoc examples, so the result the
 * widget prints is a result the library documents. Labels are numbers only —
 * "30-day windows", "14/14/45" — never a jurisdiction's name for them.
 */
export const BILLING_PRESETS: readonly BillingPreset[] = [
  {
    id: "thirty-day-30",
    label: "30-day windows, invoice on day 30",
    description:
      "An invoice issued on day 30 of a 30-day issue window: on or before the deadline. The dispute window opens the same day.",
    anchorOn: "2026-03-01",
    invoiceIssuedOn: "2026-03-31",
    requestReceivedOn: "",
    issueDays: "30",
    disputeDays: "30",
    resolutionDays: "30",
    agreedResolutionOn: "",
  },
  {
    id: "thirty-day-31",
    label: "30-day windows, invoice on day 31",
    description:
      "The same 30-day issue window, invoiced one day later: after the deadline.",
    anchorOn: "2026-03-01",
    invoiceIssuedOn: "2026-04-01",
    requestReceivedOn: "",
    issueDays: "30",
    disputeDays: "30",
    resolutionDays: "30",
    agreedResolutionOn: "",
  },
  {
    id: "thirty-rebill",
    label: "30-day windows, re-bill counted from the invoice received",
    description:
      "A party re-billing a charge it was itself billed counts its 30-day issue window from the invoice it received, not from the original charge: on or before the deadline.",
    anchorOn: "2026-03-10",
    invoiceIssuedOn: "2026-04-05",
    requestReceivedOn: "",
    issueDays: "30",
    disputeDays: "30",
    resolutionDays: "30",
    agreedResolutionOn: "",
  },
  {
    id: "forecast",
    label: "30-day windows, no invoice yet",
    description:
      "Only the anchor is set: the issue deadline is known, and everything after it is still a forecast.",
    anchorOn: "2026-03-01",
    invoiceIssuedOn: "",
    requestReceivedOn: "",
    issueDays: "30",
    disputeDays: "30",
    resolutionDays: "30",
    agreedResolutionOn: "",
  },
  {
    id: "contract-14-14-45",
    label: "14/14/45 windows, with a dispute",
    description:
      "A service contract's own 14/14/45 windows, with a dispute request received on or before its 14-day dispute deadline.",
    anchorOn: "2026-03-01",
    invoiceIssuedOn: "2026-03-05",
    requestReceivedOn: "2026-03-18",
    issueDays: "14",
    disputeDays: "14",
    resolutionDays: "45",
    agreedResolutionOn: "",
  },
] as const;

/**
 * Seed arguments as control values. A finite integer number (the chat tool)
 * becomes its text form; a non-empty string (a permalink) is kept as typed;
 * anything else — `undefined`, `""`, `NaN` — becomes `""`. No window falls
 * back to a preset: a blank window is a blank window, never a guess.
 */
export function readArgs(args: BillingDeadlinesArgs): BillingState {
  const str = (v: string | number | undefined): string => {
    if (typeof v === "number") return Number.isInteger(v) ? String(v) : "";
    if (typeof v === "string" && v !== "") return v;
    return "";
  };
  return {
    anchorOn: str(args.anchorOn),
    invoiceIssuedOn: str(args.invoiceIssuedOn),
    requestReceivedOn: str(args.requestReceivedOn),
    issueDays: str(args.issueDays),
    disputeDays: str(args.disputeDays),
    resolutionDays: str(args.resolutionDays),
    agreedResolutionOn: str(args.agreedResolutionOn),
  };
}

/** The preset whose seven fields match `state`, trimmed, or `custom`. */
export function matchPreset(state: BillingState): string {
  const t = (s: string) => s.trim();
  const hit = BILLING_PRESETS.find(
    (p) =>
      t(p.anchorOn) === t(state.anchorOn) &&
      t(p.invoiceIssuedOn) === t(state.invoiceIssuedOn) &&
      t(p.requestReceivedOn) === t(state.requestReceivedOn) &&
      t(p.issueDays) === t(state.issueDays) &&
      t(p.disputeDays) === t(state.disputeDays) &&
      t(p.resolutionDays) === t(state.resolutionDays) &&
      t(p.agreedResolutionOn) === t(state.agreedResolutionOn),
  );
  return hit ? hit.id : CUSTOM_PRESET_ID;
}

// ---------------------------------------------------------------------------
// The library's arguments
// ---------------------------------------------------------------------------

export interface DatesArg {
  anchorOn: string;
  invoiceIssuedOn?: string;
  requestReceivedOn?: string;
}

export interface WindowsArg {
  issueDays?: number;
  disputeDays?: number;
  resolutionDays?: number;
  agreedResolutionOn?: string;
}

/**
 * The `dates` object `billingTimeline` is called with, exactly as the call
 * line prints it. `anchorOn` is never omitted — the library requires it — and
 * a blank optional date is omitted rather than sent as `""`, because the
 * library reads an explicit `""` as an invalid date, not an absence.
 */
export function datesOf(state: BillingState): DatesArg {
  const dates: DatesArg = { anchorOn: state.anchorOn.trim() };
  if (state.invoiceIssuedOn.trim() !== "")
    dates.invoiceIssuedOn = state.invoiceIssuedOn.trim();
  if (state.requestReceivedOn.trim() !== "")
    dates.requestReceivedOn = state.requestReceivedOn.trim();
  return dates;
}

/**
 * The `windows` object `billingTimeline` is called with. A blank window is
 * omitted — windows have no defaults, in the widget as in the library — and a
 * non-blank one is `Number(text.trim())`, passed and printed as is, so the
 * printed call is the real call even when it reads `NaN` or `30.5`.
 */
export function windowsOf(state: BillingState): WindowsArg {
  const windows: WindowsArg = {};
  if (state.issueDays.trim() !== "")
    windows.issueDays = Number(state.issueDays.trim());
  if (state.disputeDays.trim() !== "")
    windows.disputeDays = Number(state.disputeDays.trim());
  if (state.resolutionDays.trim() !== "")
    windows.resolutionDays = Number(state.resolutionDays.trim());
  if (state.agreedResolutionOn.trim() !== "")
    windows.agreedResolutionOn = state.agreedResolutionOn.trim();
  return windows;
}

/**
 * The call's arguments as source text — `{ dates }, { windows }`, with no
 * function name or parens — for `renderCallLine(codeEl, "billingTimeline",
 * html, plain)`, exactly as `optionsSource` feeds
 * `free-time-ledger-mount.ts`'s calls. For every preset, `billingTimeline(` +
 * the plain string + `)` is the `billingTimeline.ts` JSDoc call text,
 * verbatim.
 */
export function callSource(state: BillingState): [string, string] {
  const dates = datesOf(state);
  const windows = windowsOf(state);

  const dateEntries: [string, string][] = [["anchorOn", dates.anchorOn]];
  if (dates.invoiceIssuedOn !== undefined)
    dateEntries.push(["invoiceIssuedOn", dates.invoiceIssuedOn]);
  if (dates.requestReceivedOn !== undefined)
    dateEntries.push(["requestReceivedOn", dates.requestReceivedOn]);

  const windowEntries: [string, number | string][] = [];
  if (windows.issueDays !== undefined)
    windowEntries.push(["issueDays", windows.issueDays]);
  if (windows.disputeDays !== undefined)
    windowEntries.push(["disputeDays", windows.disputeDays]);
  if (windows.resolutionDays !== undefined)
    windowEntries.push(["resolutionDays", windows.resolutionDays]);
  if (windows.agreedResolutionOn !== undefined)
    windowEntries.push(["agreedResolutionOn", windows.agreedResolutionOn]);

  const obj = (
    entries: readonly [string, string | number][],
    str: (s: string) => string,
    num: (n: number) => string,
  ): string =>
    `{ ${entries
      .map(
        ([k, val]) => `${k}: ${typeof val === "number" ? num(val) : str(val)}`,
      )
      .join(", ")} }`;

  const html =
    `${obj(
      dateEntries,
      (s) => codeSpan("str", JSON.stringify(s)),
      (n) => codeSpan("num", String(n)),
    )}, ` +
    `${obj(
      windowEntries,
      (s) => codeSpan("str", JSON.stringify(s)),
      (n) => codeSpan("num", String(n)),
    )}`;
  const plain =
    `${obj(dateEntries, JSON.stringify, String)}, ` +
    `${obj(windowEntries, JSON.stringify, String)}`;

  return [html, plain];
}

// ---------------------------------------------------------------------------
// The result
// ---------------------------------------------------------------------------

export interface BillingDeadlines {
  invoiceDeadline: string;
  issuedByDeadline: boolean | null;
  disputeDeadline: string | null;
  requestedByDeadline: boolean | null;
  resolutionDeadline: string | null;
}

function valueLiteral(v: string | boolean | null): string {
  if (v === null) return "null";
  if (typeof v === "boolean") return String(v);
  return JSON.stringify(v);
}

/** A valid ISO date in the canonical bare form `billingTimeline` emits. */
function isoOf(date: string): string {
  return Temporal.PlainDate.from(date.trim()).toString();
}

/** `Temporal.PlainDate.compare` for two valid ISO date strings. */
function compareDates(a: string, b: string): number {
  return Temporal.PlainDate.compare(
    Temporal.PlainDate.from(a),
    Temporal.PlainDate.from(b),
  );
}

/** What `billingTimeline` returns, one key per line, as the guide writes it. */
export function formatDeadlines(r: BillingDeadlines): string {
  return (
    `{ invoiceDeadline: ${JSON.stringify(r.invoiceDeadline)},\n` +
    `  issuedByDeadline: ${valueLiteral(r.issuedByDeadline)},\n` +
    `  disputeDeadline: ${valueLiteral(r.disputeDeadline)},\n` +
    `  requestedByDeadline: ${valueLiteral(r.requestedByDeadline)},\n` +
    `  resolutionDeadline: ${valueLiteral(r.resolutionDeadline)} }`
  );
}

export type VerdictKind = "issued" | "requested";

/**
 * The only verdict strings the widget shows. Date comparisons, never a
 * liability finding: `on or before the deadline` or `after the deadline`,
 * and nothing else. A non-null `value` means the library accepted `date`, so
 * it is shown in the canonical form the library emits.
 */
export function verdictText(
  kind: VerdictKind,
  date: string | undefined,
  value: boolean | null,
): string {
  if (kind === "issued") {
    if (value === null) return "No invoice date yet: this is a forecast";
    return `Invoice issued ${isoOf(date!)}: ${value ? "on or before" : "after"} the deadline`;
  }
  if (value === null) return "No request date yet";
  return `Request received ${isoOf(date!)}: ${value ? "on or before" : "after"} the deadline`;
}

// ---------------------------------------------------------------------------
// The day strip
// ---------------------------------------------------------------------------

export type MarkKind = "anchor" | "invoice" | "request";
export type LaneState = "zero" | "in" | "deadline";

export interface LaneCellState {
  lane: 1 | 2 | 3;
  state: LaneState;
  /** Day ordinal within the lane's own window, for the cell's label. */
  day: number;
}

export interface DayStripDay {
  kind: "day";
  date: string;
  /** Outside the real span, in the first or last drawn week: blank, aria-hidden. */
  padding: boolean;
  marks: MarkKind[];
  lanes: LaneCellState[];
}

export interface DayStripGap {
  kind: "gap";
  from: string;
  to: string;
  days: number;
}

export type DayStripItem = DayStripDay | DayStripGap;

export interface DayStripResult {
  items: readonly DayStripItem[];
  summary: string;
}

/** Past this many padded cells, collapse the weeks with nothing to show. */
export const MAX_STRIP_CELLS = 120;

function addDays(date: string, n: number): string {
  return Temporal.PlainDate.from(date).add({ days: n }).toString();
}

function daysBetween(a: string, b: string): number {
  return Temporal.PlainDate.from(a).until(Temporal.PlainDate.from(b), {
    largestUnit: "days",
  }).days;
}

/** Monday of the ISO week containing `date`. */
function weekStart(date: string): string {
  const d = Temporal.PlainDate.from(date);
  return d.subtract({ days: d.dayOfWeek - 1 }).toString();
}

/** Sunday of the ISO week containing `date`. */
function weekEnd(date: string): string {
  const d = Temporal.PlainDate.from(date);
  return d.add({ days: 7 - d.dayOfWeek }).toString();
}

interface Lane {
  lane: 1 | 2 | 3;
  start: string;
  end: string;
}

function laneDefs(dates: DatesArg, result: BillingDeadlines): Lane[] {
  const lanes: Lane[] = [
    { lane: 1, start: dates.anchorOn, end: result.invoiceDeadline },
  ];
  if (dates.invoiceIssuedOn !== undefined && result.disputeDeadline !== null) {
    lanes.push({
      lane: 2,
      start: dates.invoiceIssuedOn,
      end: result.disputeDeadline,
    });
  }
  if (
    dates.requestReceivedOn !== undefined &&
    result.resolutionDeadline !== null
  ) {
    lanes.push({
      lane: 3,
      start: dates.requestReceivedOn,
      end: result.resolutionDeadline,
    });
  }
  return lanes;
}

/**
 * The strip: a day strip wrapped by ISO week (Monday first), from
 * `min(anchorOn, invoiceIssuedOn)` to the latest of the non-null deadlines and
 * the given dates. `null` when `result` is `null` — nothing to draw for an
 * invalid call.
 *
 * Past `MAX_STRIP_CELLS` padded cells, only the first week, the last week, and
 * every week holding a mark or a lane's day 0 or deadline are kept; every run
 * of dropped weeks becomes one gap row.
 */
export function dayStrip(
  state: BillingState,
  result: BillingDeadlines | null,
): DayStripResult | null {
  if (result === null) return null;
  // A non-null result means every given date is valid: draw their canonical form.
  const typed = datesOf(state);
  const dates: DatesArg = { anchorOn: isoOf(typed.anchorOn) };
  if (typed.invoiceIssuedOn !== undefined)
    dates.invoiceIssuedOn = isoOf(typed.invoiceIssuedOn);
  if (typed.requestReceivedOn !== undefined)
    dates.requestReceivedOn = isoOf(typed.requestReceivedOn);
  const lanes = laneDefs(dates, result);
  const before = (a: string, b: string) => compareDates(a, b) < 0;

  const spanStart =
    dates.invoiceIssuedOn !== undefined &&
    before(dates.invoiceIssuedOn, dates.anchorOn)
      ? dates.invoiceIssuedOn
      : dates.anchorOn;

  const endCandidates: string[] = [
    dates.anchorOn,
    ...(dates.invoiceIssuedOn !== undefined ? [dates.invoiceIssuedOn] : []),
    ...(dates.requestReceivedOn !== undefined ? [dates.requestReceivedOn] : []),
    result.invoiceDeadline,
    ...(result.disputeDeadline !== null ? [result.disputeDeadline] : []),
    ...(result.resolutionDeadline !== null ? [result.resolutionDeadline] : []),
  ];
  const spanEnd = endCandidates.reduce((a, b) => (before(a, b) ? b : a));

  const marksOf = (date: string): MarkKind[] => {
    const m: MarkKind[] = [];
    if (date === dates.anchorOn) m.push("anchor");
    if (dates.invoiceIssuedOn !== undefined && date === dates.invoiceIssuedOn)
      m.push("invoice");
    if (
      dates.requestReceivedOn !== undefined &&
      date === dates.requestReceivedOn
    )
      m.push("request");
    return m;
  };

  const lanesOf = (date: string): LaneCellState[] => {
    const out: LaneCellState[] = [];
    for (const lane of lanes) {
      if (before(date, lane.start) || before(lane.end, date)) continue;
      const deadline = date === lane.end;
      const day = daysBetween(lane.start, date);
      out.push({
        lane: lane.lane,
        state: deadline ? "deadline" : day === 0 ? "zero" : "in",
        day,
      });
    }
    return out;
  };

  const dayItem = (date: string): DayStripDay => {
    const padding = before(date, spanStart) || before(spanEnd, date);
    return {
      kind: "day",
      date,
      padding,
      marks: padding ? [] : marksOf(date),
      lanes: padding ? [] : lanesOf(date),
    };
  };

  const paddedStart = weekStart(spanStart);
  const paddedEnd = weekEnd(spanEnd);
  const totalDays = daysBetween(paddedStart, paddedEnd) + 1;
  const realDays = daysBetween(spanStart, spanEnd) + 1;

  if (totalDays <= MAX_STRIP_CELLS) {
    const items: DayStripItem[] = [];
    for (let d = paddedStart; !before(paddedEnd, d); d = addDays(d, 1)) {
      items.push(dayItem(d));
    }
    return {
      items,
      summary: `${realDays} days from ${spanStart} to ${spanEnd}.`,
    };
  }

  const keyDates = new Set<string>([
    dates.anchorOn,
    ...(dates.invoiceIssuedOn !== undefined ? [dates.invoiceIssuedOn] : []),
    ...(dates.requestReceivedOn !== undefined ? [dates.requestReceivedOn] : []),
    result.invoiceDeadline,
    ...(result.disputeDeadline !== null ? [result.disputeDeadline] : []),
    ...(result.resolutionDeadline !== null ? [result.resolutionDeadline] : []),
  ]);
  const keptWeeks = new Set<string>([paddedStart, weekStart(paddedEnd)]);
  for (const d of keyDates) keptWeeks.add(weekStart(d));

  const items: DayStripItem[] = [];
  let droppedStart: string | null = null;
  let droppedDays = 0;
  const flushGap = () => {
    if (droppedStart === null) return;
    items.push({
      kind: "gap",
      from: droppedStart,
      to: addDays(droppedStart, droppedDays - 1),
      days: droppedDays,
    });
    droppedStart = null;
    droppedDays = 0;
  };
  for (let w = paddedStart; !before(paddedEnd, w); w = addDays(w, 7)) {
    if (keptWeeks.has(w)) {
      flushGap();
      for (let i = 0; i < 7; i++) items.push(dayItem(addDays(w, i)));
    } else {
      droppedStart ??= w;
      droppedDays += 7;
    }
  }
  flushGap();

  const notDrawn = items
    .filter((i): i is DayStripGap => i.kind === "gap")
    .reduce((sum, g) => sum + g.days, 0);

  return {
    items,
    summary: `${realDays} days from ${spanStart} to ${spanEnd}. Weeks with no marked date or deadline are collapsed: ${notDrawn} days not drawn.`,
  };
}

// ---------------------------------------------------------------------------
// Why null
// ---------------------------------------------------------------------------

export type WindowField = "issueDays" | "disputeDays" | "resolutionDays";

export type NullReason =
  | "invalid-anchor"
  | "invalid-invoice"
  | "invalid-request"
  | "request-without-invoice"
  | "request-before-invoice"
  | "missing-window"
  | "invalid-window"
  | "invalid-agreed"
  | "agreed-before-request"
  | "out-of-range";

export interface NullExplanation {
  reason: NullReason;
  /** Which window, when `reason` is `missing-window` or `invalid-window`. */
  field?: WindowField;
}

const REDUCE_INSTANT =
  "Deadlines are dates: reduce an instant to the billing party's local date first.";

export const NULL_REASON_TEXT: Record<NullReason, string> = {
  "invalid-anchor": `The anchor date is not a valid date. ${REDUCE_INSTANT}`,
  "invalid-invoice": `The invoice date is not a valid date. ${REDUCE_INSTANT}`,
  "invalid-request": `The request date is not a valid date. ${REDUCE_INSTANT}`,
  "invalid-agreed": `The agreed resolution date is not a valid date. ${REDUCE_INSTANT}`,
  "request-without-invoice":
    "A dispute request needs the invoice it disputes: type the invoice date, or clear the request date.",
  "request-before-invoice":
    "The request date is before the invoice date. A dispute cannot precede the invoice it disputes.",
  "missing-window":
    "{field} is missing. Windows have no defaults: type the number your tariff or contract sets.",
  "invalid-window": "{field} must be a whole number of days, 0 or more.",
  "agreed-before-request":
    "The agreed resolution date is before the request date. A resolution cannot precede the dispute it resolves.",
  "out-of-range":
    "That date arithmetic runs past the calendar this library can represent. Use a smaller window or a later anchor.",
};

/** `NULL_REASON_TEXT`'s entry for `explanation`, with its window field named. */
export function nullReasonText(explanation: NullExplanation): string {
  const template = NULL_REASON_TEXT[explanation.reason];
  return explanation.field
    ? template.replace("{field}", explanation.field)
    : template;
}

export interface NullValidators {
  isValidDate(value: string): boolean;
}

const WINDOW_FIELDS: readonly WindowField[] = [
  "issueDays",
  "disputeDays",
  "resolutionDays",
];

function isWindowValid(text: string): boolean {
  const n = Number(text);
  return Number.isSafeInteger(n) && n >= 0;
}

/** Whether `anchorOn + issueDays`, and any date the other windows extend, stays
 *  inside the calendar Temporal can represent. */
function isOutOfRange(state: BillingState): boolean {
  try {
    const anchor = Temporal.PlainDate.from(state.anchorOn.trim());
    anchor.add({ days: Number(state.issueDays.trim()) });
    if (state.invoiceIssuedOn.trim() !== "") {
      Temporal.PlainDate.from(state.invoiceIssuedOn.trim()).add({
        days: Number(state.disputeDays.trim()),
      });
    }
    if (
      state.requestReceivedOn.trim() !== "" &&
      state.agreedResolutionOn.trim() === ""
    ) {
      Temporal.PlainDate.from(state.requestReceivedOn.trim()).add({
        days: Number(state.resolutionDays.trim()),
      });
    }
    return false;
  } catch {
    return true;
  }
}

/**
 * Why `billingTimeline` returned `null`, checked in the order the library
 * checks (`layOutDeadlines`: `readDates`, then `readWindows`, then
 * `agreedAfterRequest`, then range). `null` when none applies.
 */
export function explainNull(
  state: BillingState,
  v: NullValidators,
): NullExplanation | null {
  const anchor = state.anchorOn.trim();
  if (!v.isValidDate(anchor)) return { reason: "invalid-anchor" };

  const invoice = state.invoiceIssuedOn.trim();
  if (invoice !== "" && !v.isValidDate(invoice))
    return { reason: "invalid-invoice" };

  const request = state.requestReceivedOn.trim();
  if (request !== "" && !v.isValidDate(request))
    return { reason: "invalid-request" };

  if (request !== "") {
    if (invoice === "") return { reason: "request-without-invoice" };
    if (compareDates(request, invoice) < 0)
      return { reason: "request-before-invoice" };
  }

  for (const field of WINDOW_FIELDS) {
    const text = state[field].trim();
    if (text === "") return { reason: "missing-window", field };
    if (!isWindowValid(text)) return { reason: "invalid-window", field };
  }

  const agreed = state.agreedResolutionOn.trim();
  if (agreed !== "" && !v.isValidDate(agreed))
    return { reason: "invalid-agreed" };
  if (agreed !== "" && request !== "" && compareDates(agreed, request) < 0)
    return { reason: "agreed-before-request" };

  if (isOutOfRange(state)) return { reason: "out-of-range" };

  return null;
}
