import { exactSeconds } from "../../internal/exactSeconds";
import { HUMAN_DURATION_UNITS } from "../../internal/humanDuration";
import { Temporal } from "../../internal/temporal";

/**
 * Write an ISO 8601 duration in the compact form `parseHumanDuration` reads, such as `2h 30m`.
 *
 * - Implements no standard: the form is GMT's grammar, stated in full on `parseHumanDuration`.
 * - Largest unit first, zero units left out, one space between units. Symbols: `y`, `mo`, `w`,
 *   `d`, `h`, `m`, `s`. `m` is a minute and `mo` a month.
 * - Units are not balanced: `PT90M` is `90m`. A fraction in the input is spread by Temporal
 *   first: `PT1.5H` is `1h 30m`. To carry, pass the duration through `normalizeDuration` with a
 *   `largestUnit`: `normalizeDuration("PT90M", { largestUnit: "hour" })` is `"PT1H30M"`, which
 *   formats as `1h 30m`.
 * - A fraction of a second prints on seconds with every digit the duration holds, up to 9:
 *   `PT1.5S` is `1.5s`, `PT1.0005S` is `1.0005s`. `ms` is never written.
 * - A negative duration has one leading `-`: `-PT2H30M` is `-2h 30m`. A zero duration is `0s`.
 * - `parseHumanDuration(formatHumanDuration(d))` equals `parseDuration(d)` for every valid ISO
 *   8601 duration `d`.
 * - For a locale's words, use `formatDuration`.
 * - Returns `""` for a non-string or a string `Temporal.Duration.from` refuses.
 *
 * @param duration An ISO 8601 duration string, such as `"PT2H30M"`
 * @returns The compact human form, or `""` on invalid input
 *
 * @example formatHumanDuration("PT2H30M") // "2h 30m"
 * @example formatHumanDuration("P1Y2M") // "1y 2mo"
 * @example formatHumanDuration("PT1M") // "1m"
 * @example formatHumanDuration("PT90M") // "90m"
 * @example formatHumanDuration("PT1.5S") // "1.5s"
 * @example formatHumanDuration("PT1.0005S") // "1.0005s"
 * @example formatHumanDuration("-PT2H30M") // "-2h 30m"
 * @example formatHumanDuration("PT0S") // "0s"
 * @example formatHumanDuration("2h 30m") // "" (not ISO 8601)
 */
export function formatHumanDuration(duration: string): string {
  if (typeof duration !== "string") return "";
  try {
    const value = Temporal.Duration.from(duration);
    const magnitude = value.abs();
    // Rank order: year, month, week, day, hour, minute, second (the millisecond is never written).
    const amounts = [
      String(magnitude.years),
      String(magnitude.months),
      String(magnitude.weeks),
      String(magnitude.days),
      String(magnitude.hours),
      String(magnitude.minutes),
      exactSeconds(magnitude),
    ];
    const parts: string[] = [];
    for (let index = 0; index < amounts.length; index++) {
      if (amounts[index] !== "0") {
        parts.push(`${amounts[index]}${HUMAN_DURATION_UNITS[index].symbol}`);
      }
    }
    if (parts.length === 0) return "0s";
    return `${value.sign < 0 ? "-" : ""}${parts.join(" ")}`;
  } catch {
    return "";
  }
}
