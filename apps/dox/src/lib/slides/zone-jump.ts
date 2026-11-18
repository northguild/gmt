/**
 * The calendar pages round a zone's recorded jump, for the Manila slide: the local date just before
 * the jump, any dates the zone never had, and the local date just after. Every date is read from
 * gmt at build time (the zone's own transition, then its local date a second either side of it), so
 * nothing here is typed in. A jump that moves the date by one day or less has no gap pages.
 */
import { addDate } from "@northguild/gmt/plain/calculate";
import { convertUnixToZoned } from "@northguild/gmt/unix/convert";
import { convertZonedToUnix } from "@northguild/gmt/zoned/convert";
import { getDstTransitions } from "@northguild/gmt/zoned/get";

export interface JumpPage {
  /** `YYYY-MM-DD`. */
  date: string;
  /** True for a date the zone never had. */
  gap: boolean;
}

export interface ZoneJump {
  zone: string;
  /** The jump's instant, `YYYY-MM-DDTHH:MM:SSZ`. */
  instant: string;
  pages: JumpPage[];
}

/** The pages round the zone's first offset change in any of `years`, or `null` for none. */
export function zoneJump(
  zone: string,
  years: readonly number[],
): ZoneJump | null {
  for (const year of years) {
    const first = getDstTransitions(zone, year)[0];
    if (!first) continue;
    const ms = convertZonedToUnix(first.instant.replace(/Z$/, "+00:00[UTC]"));
    if (ms === null) continue;
    const before = convertUnixToZoned(ms - 1000, zone).slice(0, 10);
    const after = convertUnixToZoned(ms, zone).slice(0, 10);
    const pages: JumpPage[] = [{ date: before, gap: false }];
    for (
      let d = addDate(before, { days: 1 });
      d !== "" && d < after;
      d = addDate(d, { days: 1 })
    )
      pages.push({ date: d, gap: true });
    pages.push({ date: after, gap: false });
    return { zone, instant: first.instant, pages };
  }
  return null;
}
