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
  "@date-fns/tz",
  "spacetime",
] as const;

export type BannedDateLibrary = (typeof BANNED_DATE_LIBRARIES)[number];

/**
 * The banned package a specifier imports, for the package itself or any of
 * its subpaths (`date-fns/format`), and `undefined` for anything else. A
 * relative path is never a package: `./my-moment-helper` is a local file,
 * even though its name contains one.
 */
export const bannedDateLibraryOf = (
  specifier: unknown,
): BannedDateLibrary | undefined => {
  if (typeof specifier !== "string") {
    return undefined;
  }

  return BANNED_DATE_LIBRARIES.find(
    (lib) => specifier === lib || specifier.startsWith(`${lib}/`),
  );
};
