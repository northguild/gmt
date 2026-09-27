/**
 * Pure helpers for the Timetable Reader widget (TRAN-9): what a printed,
 * zoneless departure time means, through `scheduleDelivery`'s `startTimeZone`.
 *
 * A timetable prints wall times with no offset. `startTimeZone` is what makes
 * one exact: a repeated hour (a fall-back night) resolves to the earlier
 * instant, a skipped one (a spring-forward night) to the later instant, and
 * writing the offset picks the other pass of a repeated hour — but names no
 * instant in a skipped one, because none exists. Every classification and
 * every instant shown comes from `resolveLocal`, `etaAtZone` and
 * `scheduleDelivery` alone; this widget computes none of them.
 *
 * No DOM and no gmt import: `TransportLib` comes in from the mount.
 */

import {
  diagnose,
  scheduleNullText,
  type DeliverySchedule,
  type ScheduleLeg,
  type ScheduleOptions,
  type TransportLib,
} from "./transport-widgets";

export const MAX_ROWS = 4;

/** One row of the printed timetable, as the DOM holds it: a printed wall
 *  time, and an optional offset that picks a pass of a repeated hour. A row
 *  with a blank `departure` is skipped everywhere. */
export interface TimetableRow {
  departure: string;
  offset: string;
}

export interface TimetableState {
  startTimeZone: string;
  duration: string;
  timeZone: string;
  rows: [TimetableRow, TimetableRow, TimetableRow, TimetableRow];
}

/** Seed arguments: the chat sends `departures` (and optionally `offsets`) as
 *  arrays; the permalink flattens them to `departure1`…`offset4`, because
 *  `seedFromLocation` keeps only top-level strings. */
export interface TimetableReaderArgs {
  startTimeZone?: string;
  duration?: string;
  timeZone?: string;
  departures?: string[];
  offsets?: string[];
  departure1?: string;
  offset1?: string;
  departure2?: string;
  offset2?: string;
  departure3?: string;
  offset3?: string;
  departure4?: string;
  offset4?: string;
}

export const CUSTOM_PRESET_ID = "custom";

const BLANK_ROW: TimetableRow = { departure: "", offset: "" };

function padRows(
  rows: readonly TimetableRow[],
): [TimetableRow, TimetableRow, TimetableRow, TimetableRow] {
  const out: TimetableRow[] = [];
  for (let i = 0; i < MAX_ROWS; i++) out.push(rows[i] ?? { ...BLANK_ROW });
  return out as [TimetableRow, TimetableRow, TimetableRow, TimetableRow];
}

export interface TimetablePreset {
  id: string;
  label: string;
  description: string;
  startTimeZone: string;
  duration: string;
  timeZone: string;
  rows: readonly TimetableRow[];
}

const NY = "America/New_York";

/** Every preset is a section 9 row, so every result the widget shows is a
 *  verified value. */
export const TIMETABLE_PRESETS: readonly TimetablePreset[] = [
  {
    id: "fall-back",
    label: "New York's fall-back night: 00:30, 01:30, 02:30",
    description:
      "New York's fall-back night, printed as three timetable rows. 00:30 and 02:30 each happen once; 01:30 happens twice, and the clock alone cannot say which pass a printed 01:30 means.",
    startTimeZone: NY,
    duration: "PT1H",
    timeZone: NY,
    rows: [
      { departure: "2024-11-03T00:30:00", offset: "" },
      { departure: "2024-11-03T01:30:00", offset: "" },
      { departure: "2024-11-03T02:30:00", offset: "" },
    ],
  },
  {
    id: "offset-picks",
    label: "01:30 twice: with no offset, then with −05:00",
    description:
      "01:30 happens twice on New York's fall-back night. Left with no offset it resolves to the earlier pass; written with −05:00 it resolves to the later one.",
    startTimeZone: NY,
    duration: "PT1H",
    timeZone: NY,
    rows: [
      { departure: "2024-11-03T01:30:00", offset: "" },
      { departure: "2024-11-03T01:30:00", offset: "-05:00" },
    ],
  },
  {
    id: "spring-forward",
    label: "New York's spring-forward night: 01:30, 02:30, 03:30",
    description:
      "02:30 never shows on a New York clock that night, so it resolves to 03:30, the same instant as the row printed 03:30. Two timetable rows, one departure.",
    startTimeZone: NY,
    duration: "PT1H",
    timeZone: NY,
    rows: [
      { departure: "2024-03-10T01:30:00", offset: "" },
      { departure: "2024-03-10T02:30:00", offset: "" },
      { departure: "2024-03-10T03:30:00", offset: "" },
    ],
  },
  {
    id: "published-local",
    label: "A published 10:00, read in New York",
    description:
      "The library's own documented case: a published 10:00 with no offset, read in New York, arriving in UTC.",
    startTimeZone: NY,
    duration: "PT1H",
    timeZone: "UTC",
    rows: [{ departure: "2024-06-15T10:00:00", offset: "" }],
  },
  {
    id: "berlin-fall-back",
    label: "Berlin's fall-back night: 02:30",
    description:
      "Berlin's fall-back night: a timetable printing 02:30, read for a run onward to Amsterdam.",
    startTimeZone: "Europe/Berlin",
    duration: "PT1H",
    timeZone: "Europe/Amsterdam",
    rows: [{ departure: "2024-10-27T02:30:00", offset: "" }],
  },
];

const str = (v: unknown): string => (typeof v === "string" ? v : "");

/** `departures`/`offsets` arrays (the chat tool) win over the flat permalink
 *  keys. Anything that is not a string becomes `""`. */
export function readArgs(args: TimetableReaderArgs): TimetableState {
  let rows: TimetableRow[];
  if (Array.isArray(args.departures)) {
    rows = args.departures.slice(0, MAX_ROWS).map((d, i) => ({
      departure: str(d),
      offset: str(args.offsets?.[i]),
    }));
  } else {
    const rec = args as unknown as Record<string, unknown>;
    rows = [1, 2, 3, 4].map((n) => ({
      departure: str(rec[`departure${n}`]),
      offset: str(rec[`offset${n}`]),
    }));
  }
  return {
    startTimeZone: str(args.startTimeZone),
    duration: str(args.duration),
    timeZone: str(args.timeZone),
    rows: padRows(rows),
  };
}

/** The preset whose `startTimeZone`, `duration`, `timeZone` and every row
 *  match `state`, trimmed, or `custom`. */
export function matchPreset(state: TimetableState): string {
  const t = (s: string) => s.trim();
  const hit = TIMETABLE_PRESETS.find((p) => {
    if (t(p.startTimeZone) !== t(state.startTimeZone)) return false;
    if (t(p.duration) !== t(state.duration)) return false;
    if (t(p.timeZone) !== t(state.timeZone)) return false;
    for (let i = 0; i < MAX_ROWS; i++) {
      const a = p.rows[i] ?? BLANK_ROW;
      const b = state.rows[i]!;
      if (t(a.departure) !== t(b.departure) || t(a.offset) !== t(b.offset)) {
        return false;
      }
    }
    return true;
  });
  return hit ? hit.id : CUSTOM_PRESET_ID;
}

/**
 * The text passed as a leg's `departure`: the printed time when the row has
 * no offset, else the printed time with the offset appended and `zone`
 * bracketed — the same shape a timetable's own footnote would write.
 */
export function rowDeparture(row: TimetableRow, zone: string): string {
  const printed = row.departure.trim();
  const offset = row.offset.trim();
  if (offset === "") return printed;
  return `${printed}${offset}[${zone}]`;
}

/** The leg row `i` names, read in `state.startTimeZone` — every row is its
 *  own single-leg call. `null` when the row is blank. */
export function rowLeg(state: TimetableState, i: number): ScheduleLeg | null {
  const row = state.rows[i]!;
  if (row.departure.trim() === "") return null;
  return {
    departure: rowDeparture(row, state.startTimeZone.trim()),
    duration: state.duration.trim(),
    timeZone: state.timeZone.trim(),
  };
}

export function optionsOf(state: TimetableState): ScheduleOptions | undefined {
  const zone = state.startTimeZone.trim();
  return zone === "" ? undefined : { startTimeZone: zone };
}

/** `startTimeZone`, `duration`, `timeZone`, and every non-blank row under its
 *  flat key. Strings only. */
export function permalinkOf(state: TimetableState): Record<string, string> {
  const out: Record<string, string> = {};
  const zone = state.startTimeZone.trim();
  const duration = state.duration.trim();
  const timeZone = state.timeZone.trim();
  if (zone !== "") out.startTimeZone = zone;
  if (duration !== "") out.duration = duration;
  if (timeZone !== "") out.timeZone = timeZone;
  for (let i = 0; i < MAX_ROWS; i++) {
    const row = state.rows[i]!;
    const idx = i + 1;
    if (row.departure.trim() !== "")
      out[`departure${idx}`] = row.departure.trim();
    if (row.offset.trim() !== "") out[`offset${idx}`] = row.offset.trim();
  }
  return out;
}

// ---------------------------------------------------------------------------
// What a printed time means — from resolveLocal and etaAtZone alone
// ---------------------------------------------------------------------------

export type RowClass = "once" | "twice" | "skipped";

function hhmm(text: string): string {
  const m = /T(\d{2}:\d{2})/.exec(text);
  return m ? m[1]! : text;
}

/**
 * Whether `printed` (a bare wall time, `zone`'s own printed departure with no
 * offset) names one instant, an ambiguous one, or none at all — from
 * `resolveLocal`'s earlier and later resolutions alone. `once`: the two
 * resolutions agree. `twice`: they differ, and the earlier one's local time
 * in `zone` still reads as printed — an hour the clock ran through twice.
 * `skipped`: they differ and the earlier resolution reads a different local
 * time — an hour the clock never showed, resolved forward to the next one.
 */
export function classify(
  printed: string,
  zone: string,
  lib: TransportLib,
): RowClass {
  const earlier = lib.resolveLocal(printed, zone, {
    disambiguation: "earlier",
  });
  const later = lib.resolveLocal(printed, zone, { disambiguation: "later" });
  if (earlier === later) return "once";
  return hhmm(lib.etaAtZone(earlier, zone)) === hhmm(printed)
    ? "twice"
    : "skipped";
}

/** The badge text for a classified row, or `null` for `once`, which shows no
 *  badge. A `twice` row with an offset written shows that the offset is what
 *  picked the pass, rather than repeating the generic "occurs twice" text. */
export function rowBadge(kind: RowClass, hasOffset: boolean): string | null {
  switch (kind) {
    case "once":
      return null;
    case "twice":
      return hasOffset
        ? "Offset written: this pass"
        : "Occurs twice: the earlier instant";
    case "skipped":
      return "Never shows on the clock: the later instant";
  }
}

/** The reason text an offset written into a `skipped` row's `NO SIGNAL`
 *  deserves — a reading no offset can name, distinct from every reason
 *  `scheduleNullText` covers. */
export const SKIPPED_OFFSET_TEXT =
  "No offset names a time this clock skipped. Leave the offset off and it resolves to the later instant.";

/**
 * The exact instant row `i`'s printed departure names, rendered back in
 * `startTimeZone` — a zero-length leg whose `timeZone` is `startTimeZone`
 * itself, so the "Leaves (exact)" column comes from the library's own
 * resolution of the printed time, never from arithmetic. `null` when the row
 * is blank or does not resolve.
 */
export function leavesAt(
  state: TimetableState,
  i: number,
  lib: TransportLib,
): string | null {
  const row = state.rows[i]!;
  if (row.departure.trim() === "") return null;
  const zone = state.startTimeZone.trim();
  const departure = rowDeparture(row, zone);
  const result = lib.scheduleDelivery(
    [{ departure, duration: "PT0S", timeZone: zone }],
    { startTimeZone: zone },
  );
  return result?.legTimes[0]?.localArrival ?? null;
}

/**
 * Row `i`'s real call result and, when it is `null`, the reason to show —
 * `SKIPPED_OFFSET_TEXT` when an offset was written into a row whose printed
 * time the clock skipped, else `scheduleNullText` for whatever `diagnose`
 * finds. `null` reason alongside a `null` result means the row is blank.
 */
export function rowResult(
  state: TimetableState,
  i: number,
  lib: TransportLib,
): { result: DeliverySchedule | null; reason: string | null } {
  const leg = rowLeg(state, i);
  if (leg === null) return { result: null, reason: null };
  const options = optionsOf(state);
  const result = lib.scheduleDelivery([leg], options);
  if (result !== null) return { result, reason: null };

  const row = state.rows[i]!;
  const zone = state.startTimeZone.trim();
  if (
    row.offset.trim() !== "" &&
    zone !== "" &&
    classify(row.departure.trim(), zone, lib) === "skipped"
  ) {
    return { result: null, reason: SKIPPED_OFFSET_TEXT };
  }
  const diag = diagnose([leg], options, lib);
  return {
    result: null,
    reason: diag ? scheduleNullText(diag.reason, 1) : null,
  };
}
