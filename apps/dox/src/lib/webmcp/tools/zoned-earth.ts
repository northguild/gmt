/**
 * WebMCP tool for `/tools/zoned-earth/`: the clock of one zone now, from the same `readZoneNow`
 * the globe's clock panel reads. The globe itself, its rotation and its search are not part of it.
 */
import { getUtcNow } from "@northguild/gmt/utc/get";
import { showGlobeInput } from "../../dox-tool-schemas";
import { encodeWidgetPermalink } from "../../widget-permalink";
import { readZoneNow } from "../../zone-clock";
import { jsonSafe } from "../json-safe";
import { definePageTool, toModelContextTool } from "../page-tool";

export const currentTimeNote = (now: string): string =>
  `The current time, ${now}, was read in the zone.`;

export const unknownZoneNote = (zone: string): string =>
  `${zone} is not a zone the library knows, so there is no clock for it.`;

export const def = definePageTool({
  page: "zoned-earth",
  name: "read_zone_clock",
  title: "Zoned Earth",
  doxTool: "showGlobe",
  returns:
    "id, ok (false when the library does not know the zone, and then date, time and offset are empty), date, time, offset (the zone's exact offset now), inDst (daylight saving is in effect now) and observesDst (the zone changes its clocks at all)",
  calls: [
    "getZonedNow",
    "toOffsetInstant",
    "isInDaylightSaving",
    "hasDaylightSaving",
  ],
  input: showGlobeInput,
  example: { zone: "Europe/London" },
  async run(args) {
    const now = getUtcNow();
    const reading = readZoneNow(args.zone);
    return {
      input: { ...args, now },
      result: jsonSafe(reading),
      notes: [
        currentTimeNote(now),
        ...(reading.ok ? [] : [unknownZoneNote(args.zone)]),
      ],
      link: encodeWidgetPermalink("globe", { zone: args.zone }),
    };
  },
});

export default toModelContextTool(def);
