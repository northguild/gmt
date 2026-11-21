/**
 * The registry of decks: one row for each talk under `/slides/`. The index page lists these rows,
 * and `decks.test.ts` holds that every slug has a deck component in `deck-pages.ts`. Delete this
 * file and `src/pages/slides/` together and the site builds without decks.
 */
import { convertPlainDateTimeToZoned } from "@northguild/gmt/zoned/convert";
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
  /** The page's meta description, one sentence. */
  description: string;
  event: string;
  /**
   * The talk's start as a zoned date-time string in `zone`
   * (`2026-12-15T18:00:00+02:00[Europe/Helsinki]`), or `null` while no date is fixed. Every page
   * then says "Date to be announced".
   */
  start: string | null;
  /**
   * When the doors open, in the same form as `start`, or `null` when the event names no time.
   * The card shows it small, under the start.
   */
  doors: string | null;
  /** Where the talk is, or `null` while no venue is fixed. */
  venue: Venue | null;
  /** The IANA zone of the venue: the title slide's clock and `start` are read in it. */
  zone: string;
  /** The venue's locale tag, for its clock. */
  locale: string;
  /** The talk's length in minutes, not counting the questions. */
  minutes: number;
  /** The minutes of questions after it. */
  qa: number;
}

/** The building a talk is in. */
export interface Venue {
  /** The host and the building ("Kisko Labs, Trooli"). */
  name: string;
  street: string;
  /** Which floor, as the event states it ("6th floor"). */
  floor: string;
  /** The postcode and city ("00580 Helsinki"). */
  city: string;
}

/** The venue's address on one line, floor included. */
export function venueAddress(venue: Venue): string {
  return `${venue.street}, ${venue.floor}, ${venue.city}`;
}

/**
 * A Google Maps search for the venue's street address, in the documented Maps URLs form
 * (`/maps/search/?api=1&query=`). The floor is left out: Maps does not know it.
 */
export function venueMapUrl(venue: Venue): string {
  const query = encodeURIComponent(`${venue.street}, ${venue.city}`);
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

/**
 * Deck 0's times on 15 December 2026 in Helsinki: doors at 17:30, talks from 18:00. Each is made by
 * gmt from the wall time and the zone, so its offset is gmt's answer and nobody writes it by hand.
 */
const HELSINKI = "Europe/Helsinki";
function helsinkiAt(wallTime: string): string {
  const zoned = convertPlainDateTimeToZoned(
    `2026-12-15T${wallTime}`,
    HELSINKI,
    {
      smallestUnit: "seconds",
    },
  );
  if (zoned === "") throw new Error(`gmt rejected Deck 0's time ${wallTime}`);
  return zoned;
}

export const DECKS: readonly DeckEntry[] = [
  {
    slug: "give-me-temporal",
    label: "Deck 0",
    title: "Give Me Temporal",
    description:
      "Slides for the talk Give Me Temporal: one clock against the whole planet, and what GMT does about it.",
    event: "HelsinkiJS",
    start: helsinkiAt("18:00:00"),
    doors: helsinkiAt("17:30:00"),
    venue: {
      name: "Kisko Labs, Trooli",
      street: "Panimokatu 2A",
      floor: "6th floor",
      city: "00580 Helsinki",
    },
    zone: HELSINKI,
    locale: "fi",
    minutes: 22,
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
interface DeckSchedule {
  weekday: string;
  day: string;
  month: string;
  year: string;
  /** The short weekday and month the locale gives, for the calendar page. */
  weekdayShort: string;
  monthShort: string;
  /** The start time, `HH:MM` in the venue's zone. */
  start: string;
  /** When the doors open, `HH:MM` and as an HTML date-time string, or `null` when not stated. */
  doors: { time: string; datetime: string } | null;
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
  const doors =
    entry.doors === null
      ? null
      : {
          time: formatZonedDateTime(entry.doors, "en-GB", {
            timeStyle: "short",
          }),
          datetime: htmlDateTime(entry.doors),
        };
  if (doors?.time === "") return null;
  return {
    ...schedule,
    doors,
    zone: entry.zone,
    offset: `UTC${offset}`,
    datetime: htmlDateTime(entry.start),
  };
}

/** A zoned date-time string without its bracketed zone: a valid HTML date-time string. */
function htmlDateTime(zoned: string): string {
  return zoned.slice(0, zoned.indexOf("["));
}
