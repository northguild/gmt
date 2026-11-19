/**
 * The bug slides' calendar figures, worked out at build time: a month laid out in weeks, a
 * tear-off leaf for one date, and the two rows of a split-flap board. Every date, weekday and month
 * name is read from gmt, so nothing calendar-shaped here is typed in.
 */
import { addDate, getDaysInMonth } from "@northguild/gmt/plain/calculate";
import { formatDate } from "@northguild/gmt/plain/format";
import { parseDayOfWeekFromDate } from "@northguild/gmt/plain/parse";

interface MonthGrid {
  /** "February 2027". */
  title: string;
  /** The month's name alone, "February". */
  month: string;
  /** Monday first: short and long names. */
  weekdays: { short: string; long: string }[];
  /** Weeks of seven cells; `null` is a day of the month before or after. */
  weeks: (number | null)[][];
}

/** `yearMonth` (`YYYY-MM`) as a Monday-first page of weeks. */
export function monthGrid(yearMonth: string): MonthGrid {
  const first = `${yearMonth}-01`;
  const weekday = parseDayOfWeekFromDate(first);
  const days = getDaysInMonth(first);
  if (weekday === null || days === null)
    throw new Error(`${yearMonth} is not a month`);
  const monday = addDate(first, { days: 1 - weekday });
  const weekdays = Array.from({ length: 7 }, (_, i) => {
    const d = addDate(monday, { days: i });
    return {
      short: formatDate(d, "en", { weekday: "short" }),
      long: formatDate(d, "en", { weekday: "long" }),
    };
  });
  const cells: (number | null)[] = [
    ...Array.from({ length: weekday - 1 }, () => null),
    ...Array.from({ length: days }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks = Array.from({ length: cells.length / 7 }, (_, w) =>
    cells.slice(w * 7, w * 7 + 7),
  );
  return {
    title: formatDate(first, "en", { month: "long", year: "numeric" }),
    month: formatDate(first, "en", { month: "long" }),
    weekdays,
    weeks,
  };
}

interface Leaf {
  /** "Dec 1844". */
  head: string;
  /** "30". */
  day: string;
  /** "Monday". */
  weekday: string;
}

/** A tear-off calendar leaf for `date` (`YYYY-MM-DD`). */
export function leaf(date: string): Leaf {
  const head = formatDate(date, "en", { month: "short", year: "numeric" });
  const day = formatDate(date, "en", { day: "numeric" });
  const weekday = formatDate(date, "en", { weekday: "long" });
  if (!head || !day || !weekday) throw new Error(`${date} is not a date`);
  return { head, day, weekday };
}

interface FlapTile {
  ch: string;
  /** The two rows show different characters here. */
  diff: boolean;
}

/**
 * Two values as the rows of a split-flap board: both padded on the left to one width, so their last
 * characters line up, and each tile marked where the rows differ.
 */
export function flapRows(
  expected: string,
  observed: string,
): [FlapTile[], FlapTile[]] {
  const width = Math.max([...expected].length, [...observed].length);
  const a = [...expected.padStart(width, " ")];
  const b = [...observed.padStart(width, " ")];
  const tiles = (row: string[], other: string[]): FlapTile[] =>
    row.map((ch, i) => ({ ch, diff: ch !== other[i] }));
  return [tiles(a, b), tiles(b, a)];
}
