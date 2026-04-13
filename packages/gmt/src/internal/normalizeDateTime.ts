/**
 * Normalize formatted date/time strings for stable comparisons.
 *
 * - Removes Unicode format and bidi control characters (LRM/RLM/LRE/RLE/etc.)
 * - Removes zero-width space and BOM
 * - Normalizes various non-breaking and narrow spaces to plain space
 * - Collapses repeated whitespace to a single space and trims
 * - Normalizes common dash/minus characters to ASCII hyphen-minus
 * - Optionally lowercases the result (disabled by default)
 */
export function normalizeDateTime(
  input: string,
  opts?: { lower?: boolean; locale?: string },
): string {
  if (typeof input !== "string") return "";

  const { lower = false, locale = "en-US" } = opts ?? {};

  // Use NFC where available for stable composed characters
  let s =
    typeof input.normalize === "function" ? input.normalize("NFC") : input;

  // Remove Unicode format characters (includes bidi marks), zero-width space, BOM
  // \p{Cf} covers most format/control characters like U+200E/U+200F, LRE/RLE, PDF, etc.
  s = s.replace(/[\p{Cf}\u200B\uFEFF]/gu, "");

  // Normalize various space characters to ordinary space
  s = s.replace(
    /[\u00A0\u202F\u2009\u2007\u2002\u2003\u2004\u2005\u2006\u2008\u200A]/g,
    " ",
  );

  // Treat dash/minus characters specially:
  // - If the dash sits between digits (e.g. dates like 2024–02–03), keep a
  //   compact hyphen (no added spaces).
  // - Otherwise convert dash-like characters to a spaced " - " so ranges like
  //   "AM- 12:00" become "AM - 12:00".
  s = s.replace(
    /(?<=\d)[\u2010\u2011\u2012\u2013\u2014\u2015\u2212](?=\d)/g,
    "-",
  );
  s = s.replace(/[\u2010\u2011\u2012\u2013\u2014\u2015\u2212]/g, " - ");

  // Collapse whitespace and trim
  s = s.replace(/\s+/g, " ").trim();

  // Normalize fraction slash etc. to ASCII slash where appropriate
  s = s.replace(/[\u2044]/g, "/");

  return lower ? s.toLocaleLowerCase(locale) : s;
}
