/**
 * The words about when a body of the night sky is bright enough to draw, and the one place they
 * are written: the "Coming up in the sky" rows of the landing's info popover, the second line of a
 * Look at row, and the reason on a faint body's ring label (`sky-names.ts`). The dates come from
 * `src/assets/sky-events.json`, found by `scripts/prepare-sky-orbits.ts` (nothing is searched in
 * the browser); this file only reads them.
 *
 * It is plain text from data and a library handed in (`EventsKit`, made by `sky-events-kit.ts`
 * once gmt's formatters and the data have loaded), so it carries no gmt code of its own and the
 * Look at bar can load it with the page. A text that needs the data reads one way before the kit
 * has loaded and another after, and no text names a body: the name is its registry row's.
 */
import type { areUnixEqualBy } from "@northguild/gmt/unix/compare";
import type { convertUnixToUtc } from "@northguild/gmt/unix/convert";
import type { formatUnix } from "@northguild/gmt/unix/format";
import { SKY_BODIES } from "./sky-registry";
import { FAINT } from "./sky-stars";

/** One spell of a body being bright enough to draw (V at or under the faint limit), from the Earth's centre. */
export interface SkyEvent {
  id: string;
  /** True for a body the sky does not normally draw (a small body, a close pass); false for a planet. */
  rare: boolean;
  startMs: number;
  endMs: number;
  /** A pass's closest approach, epoch milliseconds. */
  closestMs?: number;
  /** The precision the dates are told to: a pass to the minute, the rest to the day. */
  unit: "day" | "minute";
}

export interface SkyEventData {
  /** The end of what the file looked through, epoch milliseconds. */
  spanEndMs: number;
  /** Sorted by `startMs`. */
  events: SkyEvent[];
}

/** The reader's locale and time zone. */
export interface Zone {
  locale: string;
  timeZone: string;
}

/** What the texts read: the data, the two gmt functions and the reader's zone. */
export interface EventsKit {
  data: SkyEventData;
  lib: {
    formatUnix: typeof formatUnix;
    areUnixEqualBy: typeof areUnixEqualBy;
    /** For a `time` element's `datetime`. */
    convertUnixToUtc: typeof convertUnixToUtc;
  };
  zone: Zone;
}

/** A piece of a row: plain text, or a moment (a `time` element's `datetime`). */
export type Segment = string | { text: string; ms: number };

export interface EventRow {
  id: string;
  name: string;
  segments: Segment[];
}

const FALLBACK_LOCALE = "en-GB";

/** The reader's first English locale, else `en-GB`, as northguild.dev's panel does. */
export const readerLocale = (languages: readonly string[]): string =>
  languages.find((tag) => /^en(-|$)/i.test(tag)) ?? FALLBACK_LOCALE;

const rowOf = (id: string) => SKY_BODIES.find((row) => row.id === id);

const nameOf = (id: string): string => rowOf(id)?.name ?? id;

/** What a body is, when it is not a planet (`Asteroid`), or null: said beside its name in the Look at bar and the events list. */
export function groupTag(id: string): string | null {
  const row = rowOf(id);
  return row?.kind === "point" && row.group !== "Planet" ? row.group : null;
}

/** What else the label says of a body, or null: Pluto's years as the ninth planet. */
export function rowNote(id: string): string | null {
  return id === "pluto" ? "The ninth planet from 1930 to 2006" : null;
}

const fmt = (kit: EventsKit, ms: number, options: Intl.DateTimeFormatOptions) =>
  kit.lib.formatUnix(ms, kit.zone.locale, {
    timeZone: kit.zone.timeZone,
    ...options,
  });

const DAY = { day: "numeric", month: "long" } as const;
const SHORT = { day: "numeric", month: "short", year: "numeric" } as const;
const CLOCK = { hour: "2-digit", minute: "2-digit" } as const;

const sameIn = (
  kit: EventsKit,
  a: number,
  b: number,
  unit: "day" | "year",
): boolean =>
  kit.lib.areUnixEqualBy(a, b, unit, { timeZone: kit.zone.timeZone });

/** The date with its year (`8 July 2029`). */
const dated = (kit: EventsKit, ms: number): string =>
  fmt(kit, ms, { ...DAY, year: "numeric" });

/** The spell as a range: a date once for one day, the year once for one year, times for a pass. */
function range(kit: EventsKit, { startMs, endMs, unit }: SkyEvent): Segment[] {
  const sameDay = sameIn(kit, startMs, endMs, "day");
  const at = (ms: number, text: string): Segment => ({ text, ms });
  if (unit === "minute")
    return sameDay
      ? [
          at(startMs, `${dated(kit, startMs)}, ${fmt(kit, startMs, CLOCK)}`),
          " – ",
          at(endMs, fmt(kit, endMs, CLOCK)),
        ]
      : [startMs, endMs].flatMap((ms, i) => [
          ...(i ? [" – "] : []),
          at(ms, `${dated(kit, ms)}, ${fmt(kit, ms, CLOCK)}`),
        ]);
  if (sameDay) return [at(startMs, dated(kit, startMs))];
  const year = sameIn(kit, startMs, endMs, "year");
  return [
    at(startMs, year ? fmt(kit, startMs, DAY) : dated(kit, startMs)),
    " – ",
    at(endMs, dated(kit, endMs)),
  ];
}

/** The end of a spell under way: a pass's on its own day is a time, anything else a date. */
function until(kit: EventsKit, event: SkyEvent, nowMs: number): Segment[] {
  const { endMs, unit } = event;
  if (unit === "day") return [{ text: dated(kit, endMs), ms: endMs }];
  return [
    {
      text: sameIn(kit, nowMs, endMs, "day")
        ? fmt(kit, endMs, CLOCK)
        : `${dated(kit, endMs)}, ${fmt(kit, endMs, CLOCK)}`,
      ms: endMs,
    },
  ];
}

/** The popover's list: each rare spell that has not ended, soonest first, and the note under it. */
export function skyEventRows(
  kit: EventsKit,
  nowMs: number,
): { rows: EventRow[]; note: string } {
  const rows = kit.data.events
    .filter(({ rare, endMs }) => rare && endMs > nowMs)
    .map((event): EventRow => {
      const closest =
        event.closestMs !== undefined
          ? [
              " · closest ",
              {
                text: fmt(kit, event.closestMs, CLOCK),
                ms: event.closestMs,
              },
            ]
          : [];
      const tag = groupTag(event.id);
      return {
        id: event.id,
        name: nameOf(event.id),
        segments: [
          ...(tag ? [`${tag} · `] : []),
          ...(event.startMs > nowMs
            ? [...range(kit, event), ...closest]
            : ["In view now, until ", ...until(kit, event, nowMs), ...closest]),
        ],
      };
    });
  return {
    rows,
    note: rows.length
      ? `Times in your time zone (${kit.zone.timeZone}).`
      : `Nothing rare in the sky through ${dated(kit, kit.data.spanEndMs)}.`,
  };
}

/** A row as one line of text. */
export const rowText = ({ name, segments }: EventRow): string =>
  `${name} · ${segments.map((s) => (typeof s === "string" ? s : s.text)).join("")}`;

/** The next moment a row changes: a spell's start or end after `nowMs`, or null. */
export const nextEdge = (data: SkyEventData, nowMs: number): number | null =>
  data.events
    .filter(({ rare }) => rare)
    .flatMap(({ startMs, endMs }) => [startMs, endMs])
    .filter((ms) => ms > nowMs)
    .reduce<number | null>(
      (best, ms) => (best === null || ms < best ? ms : best),
      null,
    );

/** The first spell of a body that has not ended. */
const spellOf = (
  data: SkyEventData,
  id: string,
  nowMs: number,
): SkyEvent | undefined =>
  data.events.find((event) => event.id === id && event.endMs > nowMs);

/** `Nov 2036`: the month the data ends in. */
const endMonth = (kit: EventsKit): string =>
  fmt(kit, kit.data.spanEndMs, { month: "short", year: "numeric" });

/**
 * The dim second line of a Look at row, or null for none. `V` is the body's magnitude from the
 * camera when the layer can place it, and null when it cannot; `kit` is null before the data has
 * loaded.
 */
export function lookLine(
  kit: EventsKit | null,
  id: string,
  V: number | null,
  nowMs: number,
): string | null {
  /* A placed body's line is its magnitude alone: a pass date beside it would wrap the row to a third line. About this sky lists the pass. */
  if (V !== null) return V <= FAINT ? null : `Too faint · ${V.toFixed(1)}`;
  if (!kit) return "Too faint";
  const next = spellOf(kit.data, id, nowMs);
  if (!next) return `Too faint through ${endMonth(kit)}`;
  if (next.startMs <= nowMs) return "In view now";
  const when = fmt(kit, next.startMs, SHORT);
  return next.unit === "minute"
    ? `Close pass ${when}`
    : `Too faint until ${when}`;
}

/** The ring label's reason: the first sentence at once, the second once the data has loaded. */
export function faintReason(
  kit: EventsKit | null,
  id: string,
  V: number,
  nowMs: number,
): string {
  const first = `Too faint to draw: magnitude ${V.toFixed(1)}; the sky draws to ${FAINT.toFixed(1)}.`;
  if (!kit) return first;
  const next = spellOf(kit.data, id, nowMs);
  if (!next) return `${first} Not brighter before ${endMonth(kit)}.`;
  if (next.startMs <= nowMs) return first;
  const when = fmt(kit, next.startMs, SHORT);
  return next.unit === "minute"
    ? `${first} Bright enough in a close pass on ${when}.`
    : `${first} Bright enough from ${when}.`;
}
