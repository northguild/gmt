/**
 * Date libraries that wrap or pass native `Date` objects internally, and so
 * reintroduce the ambient-timezone and DST problems GMT exists to prevent.
 *
 * `@js-joda/core` is deliberately absent: it has its own value types and
 * touches `Date` only at the boundary (reading the clock, host zone lookup,
 * `toDate()` interop), so it does not carry those problems.
 */
export const BANNED_DATE_LIBRARIES = [
  "moment",
  "moment-timezone",
  "dayjs",
  "luxon",
  "date-fns",
  "date-fns-tz",
  "spacetime",
] as const;

/**
 * True for a banned package or any of its subpaths (`date-fns/format`), and
 * false for anything relative — `./my-moment-helper` is a local file, not the
 * package, even though its name contains one.
 */
export const isBannedDateLibrary = (specifier: unknown): boolean => {
  if (typeof specifier !== "string") {
    return false;
  }

  return BANNED_DATE_LIBRARIES.some(
    (lib) => specifier === lib || specifier.startsWith(`${lib}/`),
  );
};
