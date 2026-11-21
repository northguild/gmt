/**
 * The calendar page the deck draws a date on: a bevelled leaf with the month on a cyan strip, the
 * day large under it and the weekday at the foot. The Earth clock's date window and the title
 * slide's schedule card draw the same page from this geometry, so the two read as one object.
 *
 * Units are SVG user units with the page's top-left corner at `(x, y)`: the clock places it on its
 * 100-unit dial, the schedule card at the origin of its own `viewBox`.
 */

/** The page's size, its corner cut and the height of the month strip. */
export const CALENDAR_PAGE = {
  w: 13.2,
  h: 13.4,
  cut: 1.2,
  strip: 3.6,
} as const;

/** A line of the page's text: where its centre sits and how tall it is. */
interface PageText {
  x: string;
  y: string;
  size: string;
}

interface CalendarPageShape {
  /** The page outline, an octagon of `polygon` points. */
  page: string;
  /** The month strip across the top, bevelled at its two top corners. */
  strip: string;
  month: PageText;
  day: PageText;
  weekday: PageText;
}

export const coord = (n: number): string => String(Number(n.toFixed(3)));
const points = (list: readonly (readonly [number, number])[]): string =>
  list.map(([px, py]) => `${coord(px)},${coord(py)}`).join(" ");

/** The page's shapes and text positions with its top-left corner at `(x, y)`. */
export function calendarPage(x: number, y: number): CalendarPageShape {
  const { w, h, cut, strip } = CALENDAR_PAGE;
  const r = x + w;
  const b = y + h;
  const mid = coord(x + w / 2);
  return {
    page: points([
      [x + cut, y],
      [r - cut, y],
      [r, y + cut],
      [r, b - cut],
      [r - cut, b],
      [x + cut, b],
      [x, b - cut],
      [x, y + cut],
    ]),
    strip: points([
      [x + cut, y],
      [r - cut, y],
      [r, y + cut],
      [r, y + strip],
      [x, y + strip],
      [x, y + cut],
    ]),
    month: { x: mid, y: coord(y + strip / 2), size: "1.7" },
    day: { x: mid, y: coord(y + strip + 4.4), size: "5.6" },
    weekday: { x: mid, y: coord(b - 1.6), size: "1.45" },
  };
}
