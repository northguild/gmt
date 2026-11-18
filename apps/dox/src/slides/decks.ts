/**
 * The registry of decks: one row for each talk under `/slides/`. The index page lists these rows,
 * and `decks.test.ts` holds that every slug has a page and every page a row. Delete this file and
 * `src/pages/slides/` together and the site builds without decks.
 */
import {
  formatZonedDateTime,
  formatZonedToParts,
} from "@northguild/gmt/zoned/format";

export interface DeckEntry {
  /** The route's last segment: `/slides/<slug>/`. */
  slug: string;
  /** The short tag on the index card ("Deck 0"). */
  label: string;
  title: string;
  event: string;
  /**
   * The talk's start as a zoned date-time string in `zone`
   * (`2026-12-16T18:00:00+02:00[Europe/Helsinki]`), or `null` while no date is fixed. Every page
   * then says "Date to be announced".
   */
  start: string | null;
  /** The IANA zone of the venue: the title slide's clock and `start` are read in it. */
  zone: string;
  /** The venue's locale tag, for its clock. */
  locale: string;
  /** The talk's length in minutes, not counting the questions. */
  minutes: number;
  /** The minutes of questions after it. */
  qa: number;
}

export const DECKS: readonly DeckEntry[] = [
  {
    slug: "give-me-temporal",
    label: "Deck 0",
    title: "Give Me Temporal",
    event: "HelsinkiJS",
    start: "2026-12-16T18:00:00+02:00[Europe/Helsinki]",
    zone: "Europe/Helsinki",
    locale: "fi",
    minutes: 20,
    qa: 5,
  },
];

/** The words shown while the owner has not fixed the date. */
export const DATE_TO_BE_ANNOUNCED = "Date to be announced";

/**
 * The text of a card's date line: the date and start time read with gmt, in the venue's zone, or
 * the plain statement that none is fixed.
 */
export function deckDate(entry: DeckEntry): string {
  if (entry.start === null) return DATE_TO_BE_ANNOUNCED;
  const text = formatZonedDateTime(entry.start, "en-GB", {
    dateStyle: "long",
    timeStyle: "short",
  });
  return text === "" ? DATE_TO_BE_ANNOUNCED : `${text}, ${entry.zone} time`;
}

/** A talk as a calendar day and a start time, for the title slide's schedule card. */
export interface DeckSchedule {
  weekday: string;
  day: string;
  month: string;
  year: string;
  /** The short weekday and month the locale gives, for the calendar page. */
  weekdayShort: string;
  monthShort: string;
  /** The start time, `HH:MM` in the venue's zone. */
  start: string;
  zone: string;
  /** The venue's offset from UTC at the start, `UTC+02:00`. */
  offset: string;
  /** The start as a valid HTML date-time string with its offset, for `<time datetime>`. */
  datetime: string;
}

/**
 * The talk's day and start, every field read with gmt in the venue's zone. `null` while the date
 * is not fixed or when gmt rejects it, where the card says "Date to be announced".
 */
export function deckSchedule(entry: DeckEntry): DeckSchedule | null {
  if (entry.start === null) return null;
  const parts = formatZonedToParts(entry.start, "en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const short = formatZonedToParts(entry.start, "en-GB", {
    weekday: "short",
    month: "short",
  });
  const part = (type: string, from = parts): string =>
    from.find((p) => p.type === type)?.value ?? "";
  const offset = /([+-]\d{2}:\d{2})\[/.exec(entry.start)?.[1];
  const schedule = {
    weekday: part("weekday"),
    day: part("day"),
    month: part("month"),
    year: part("year"),
    weekdayShort: part("weekday", short),
    monthShort: part("month", short),
    start: formatZonedDateTime(entry.start, "en-GB", { timeStyle: "short" }),
  };
  if (offset === undefined || Object.values(schedule).includes("")) return null;
  return {
    ...schedule,
    zone: entry.zone,
    offset: `UTC${offset}`,
    datetime: entry.start.slice(0, entry.start.indexOf("[")),
  };
}
