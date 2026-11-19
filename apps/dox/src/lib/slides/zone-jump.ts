/**
 * The calendar pages round a zone's recorded jump, for a slide about a zone that changed its date:
 * the local date just before the jump, any dates the zone never had, and the local date just
 * after. Every date is read from gmt at build time (the zone's own transition, then its local date
 * a second either side of it), so nothing here is typed in. A jump that moves the date by one day or less has no gap pages.
 */
import { addDate } from "@northguild/gmt/plain/calculate";
import { convertUnixToZoned } from "@northguild/gmt/unix/convert";
import { convertZonedToUnix } from "@northguild/gmt/zoned/convert";
import { getDstTransitions } from "@northguild/gmt/zoned/get";
import { firstTransition } from "./transition-ms";

interface JumpPage {
  /** `YYYY-MM-DD`. */
  date: string;
  /** True for a date the zone never had. */
  gap: boolean;
}

interface ZoneJump {
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
  const jump = firstTransition(zone, years, {
    getDstTransitions,
    convertZonedToUnix,
  });
  if (!jump) return null;
  const before = convertUnixToZoned(jump.ms - 1000, zone).slice(0, 10);
  const after = convertUnixToZoned(jump.ms, zone).slice(0, 10);
  const pages: JumpPage[] = [{ date: before, gap: false }];
  for (
    let d = addDate(before, { days: 1 });
    d !== "" && d < after;
    d = addDate(d, { days: 1 })
  )
    pages.push({ date: d, gap: true });
  pages.push({ date: after, gap: false });
  return { zone, instant: jump.instant, pages };
}
