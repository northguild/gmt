/**
 * The events a test hands `sky-events.ts` in place of the loaded data: an instant from its ISO text,
 * and a kit (the data, gmt's formatters and the reader's zone) over a list of events.
 */
import { areUnixEqualBy } from "@northguild/gmt/unix/compare";
import { convertUnixToUtc } from "@northguild/gmt/unix/convert";
import { formatUnix } from "@northguild/gmt/unix/format";
import { convertUtcToUnix } from "@northguild/gmt/utc/convert";
import type { EventsKit, SkyEvent } from "~/lib/sky-events";

/** An instant as epoch milliseconds, from an ISO UTC text. */
export const at = (iso: string): number => convertUtcToUnix(iso)!;

export const SPAN_END = at("2036-11-23T00:00:00Z");

export const kitOf = (
  events: SkyEvent[],
  timeZone = "Europe/Stockholm",
  locale = "en-GB",
): EventsKit => ({
  data: { spanEndMs: SPAN_END, events },
  lib: { formatUnix, areUnixEqualBy, convertUnixToUtc },
  zone: { locale, timeZone },
});
