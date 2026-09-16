/**
 * RegExp matching the shape of an IANA time zone name: Temporal's `TimeZoneIANAName` grammar
 * (§14.6.2 Time Zone Identifiers).
 *
 * - One or more `/`-separated components. Each starts with a letter, `.` or `_`
 *   (`TZLeadingChar`) and continues with letters, digits, `.`, `_`, `-` or `+` (`TZChar`).
 * - So single-component names match (`UTC`, `Japan`, `Zulu`, `EST5EDT`, `GMT+0`, `NZ-CHAT`), as
 *   do `Area/Location` names at any depth (`America/Argentina/Buenos_Aires`, `Etc/GMT+5`). Temporal
 *   must accept every Zone and Link name in the IANA database, and tzdb's `backward` file has more
 *   than forty slash-less ones.
 * - Letter case is not checked: ECMA-402 matches an identifier ASCII-case-insensitively, so `utc`
 *   and `america/new_york` name the same zones as `UTC` and `America/New_York`.
 * - A leading `+` or `-` never matches. Temporal also accepts offset time zone identifiers
 *   (`"+05:00"`), but those are its separate `UTCOffset` grammar, not a zone name, and this pattern
 *   does not cover them.
 * - SHAPE ONLY. Whether the name exists is decided by Temporal: its only consumer,
 *   `isValidTimeZone`, also requires `Temporal.ZonedDateTime.from` to accept the zone.
 *
 * @example timeZoneLike.test("UTC")              // true
 * @example timeZoneLike.test("America/New_York") // true
 * @example timeZoneLike.test("Japan")            // true (single-component IANA link)
 * @example timeZoneLike.test("Etc/GMT+5")        // true
 * @example timeZoneLike.test("Custom/Zone")      // true (shape only; existence is not checked)
 * @example timeZoneLike.test("+05:00")           // false (an offset identifier, not a zone name)
 * @example timeZoneLike.test("-foo/bar")         // false (a name cannot start with - or +)
 * @example timeZoneLike.test("UTC+05:00")        // false (":" is not a name character)
 */
export const timeZoneLike: RegExp =
  /^[A-Za-z._][A-Za-z0-9._+-]*(?:\/[A-Za-z._][A-Za-z0-9._+-]*)*$/;
