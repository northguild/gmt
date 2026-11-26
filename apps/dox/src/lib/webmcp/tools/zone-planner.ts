/**
 * WebMCP tool for `/tools/zone-planner/`: what the clock reads in each of up to eight zones at
 * one UTC instant, from the same `readZonesAt` the planner's redraw calls. The slider, the
 * clock changes it crosses and the jump to the next one are not part of it.
 */
import { getUnixNow } from "@northguild/gmt/unix/get";
import { showZonePlannerInput } from "../../dox-tool-schemas";
import { COORDINATES_BY_ID } from "../../globe-zones";
import { encodeWidgetPermalink } from "../../widget-permalink";
import {
  anchorZoned,
  fromUtc,
  roundToStep,
  roundUpToStep,
  toUtc,
} from "../../zone-anchor";
import { readZonesAt } from "../../zone-clock";
import { permalinkOf, seededZones } from "../../zone-planner";
import { jsonSafe } from "../json-safe";
import { definePageTool, toModelContextTool } from "../page-tool";

export const currentTimeNote = (time: string): string =>
  `No usable UTC instant was given, so the current time rounded forward to the next 5 minutes, ${time}, was used.`;

export const unplacedNote = (zones: readonly string[]): string =>
  `${zones.join(", ")} ${zones.length === 1 ? "is" : "are"} not ${zones.length === 1 ? "a zone" : "zones"} the planner can place, so ${zones.length === 1 ? "it was" : "they were"} left out.`;

export const NO_INSTANT =
  "No UTC instant was given and the current time cannot be read, so at is null and no zone was read.";

export const NO_PLACEABLE_ZONES =
  "None of the zones can be placed, so there is nothing to read.";

export const def = definePageTool({
  page: "zone-planner",
  name: "compare_zone_clocks",
  title: "Zone Planner",
  doxTool: "showZonePlanner",
  returns:
    "at (the UTC instant read, to the nearest 5 minutes) and zones (one reading per zone in the order given: id, ok, date, time, offset, inDst and observesDst); a reading with ok false is a zone the library refused, and a zone the planner cannot place is left out; at is null and zones is empty when no UTC instant was given and the current time cannot be read",
  calls: ["convertZonedToZoned", "isInDaylightSaving", "hasDaylightSaving"],
  argsSwaps: [[" that the slider shifts from", " that the clocks are read at"]],
  input: showZonePlannerInput,
  example: {
    zones: ["America/New_York", "Europe/London", "Asia/Tokyo"],
    time: "2024-03-10T12:00:00Z",
  },
  async run(args) {
    const named = seededZones(args);
    const placed = named.filter((zone) => COORDINATES_BY_ID.has(zone));
    const unplaced = named.filter((zone) => !COORDINATES_BY_ID.has(zone));

    const given = args.time === undefined ? null : fromUtc(args.time);
    const now = getUnixNow();
    const anchorMs =
      given === null
        ? now === null
          ? null
          : roundUpToStep(now)
        : roundToStep(given);
    const at = anchorMs === null ? null : toUtc(anchorMs);

    const notes: string[] = [];
    if (unplaced.length > 0) notes.push(unplacedNote(unplaced));
    if (placed.length === 0) notes.push(NO_PLACEABLE_ZONES);
    if (at === null) notes.push(NO_INSTANT);
    if (given === null && at !== null) notes.push(currentTimeNote(at));

    const zones =
      anchorMs === null ? [] : readZonesAt(placed, anchorZoned(anchorMs));
    return {
      input: { ...args, zones: placed, ...(at === null ? {} : { time: at }) },
      result: jsonSafe({ at, zones }),
      notes,
      ...(placed.length === 0 || at === null
        ? {}
        : { link: encodeWidgetPermalink("planner", permalinkOf(placed, at)) }),
    };
  },
});

export default toModelContextTool(def);
