/**
 * RegExp matching the shape of a time zone identifier: Temporal's `TimeZoneIdentifier` grammar
 * (§14.6.2 Time Zone Identifiers), `UTCOffset[~SubMinutePrecision] | TimeZoneIANAName`.
 *
 * - An offset identifier (`UTCOffset[~SubMinutePrecision]`): an ASCII sign and a two-digit hour
 *   `00`–`23`, optionally followed by two minute digits `00`–`59`, with or without `:` (`+05`,
 *   `+0530`, `-08:00`). No seconds and no fraction. `Intl.DateTimeFormat` accepts the same
 *   offsets (ECMA-402 `IsTimeZoneOffsetString`).
 * - An IANA name (`TimeZoneIANAName`): one or more `/`-separated components. Each starts with a
 *   letter, `.` or `_` (`TZLeadingChar`) and continues with letters, digits, `.`, `_`, `-` or `+`
 *   (`TZChar`). So single-component names match (`UTC`, `Japan`, `Zulu`, `EST5EDT`, `GMT+0`,
 *   `NZ-CHAT`), as do `Area/Location` names at any depth (`America/Argentina/Buenos_Aires`,
 *   `Etc/GMT+5`). Temporal must accept every Zone and Link name in the IANA database, and tzdb's
 *   `backward` file has more than forty slash-less ones.
 * - Letter case is not checked: ECMA-402 matches an identifier ASCII-case-insensitively, so `utc`
 *   and `america/new_york` name the same zones as `UTC` and `America/New_York`.
 * - SHAPE ONLY. Whether the name exists is decided by Temporal: its only consumer,
 *   `isValidTimeZone`, also requires `Temporal.ZonedDateTime.from` to accept the zone.
 *
 * @example timeZoneLike.test("UTC")              // true
 * @example timeZoneLike.test("America/New_York") // true
 * @example timeZoneLike.test("Japan")            // true (single-component IANA link)
 * @example timeZoneLike.test("Etc/GMT+5")        // true
 * @example timeZoneLike.test("Custom/Zone")      // true (shape only; existence is not checked)
 * @example timeZoneLike.test("+05:00")           // true (an offset identifier)
 * @example timeZoneLike.test("-0800")            // true (a basic-format offset identifier)
 * @example timeZoneLike.test("+05:00:00")        // false (no seconds in an offset identifier)
 * @example timeZoneLike.test("-foo/bar")         // false (a name cannot start with - or +)
 * @example timeZoneLike.test("UTC+05:00")        // false (":" is not a name character)
 */
export const timeZoneLike: RegExp =
  /^(?:[+-](?:[01][0-9]|2[0-3])(?::?[0-5][0-9])?|[A-Za-z._][A-Za-z0-9._+-]*(?:\/[A-Za-z._][A-Za-z0-9._+-]*)*)$/;
