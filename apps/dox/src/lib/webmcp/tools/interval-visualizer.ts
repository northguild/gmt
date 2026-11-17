/**
 * WebMCP tool for `/tools/interval-visualizer/`: the intersection, union, difference and
 * symmetric difference of two zoned intervals, from the same `intervalFacts` the visualizer's
 * redraw calls. The timeline and its handles are not part of it.
 */
import { showIntervalVisualizerInput } from "../../dox-tool-schemas";
import { intervalFacts } from "../../interval-visualizer";
import { encodeWidgetPermalink } from "../../widget-permalink";
import { normaliseZonedInput } from "../../zoned-input";
import { loadIntervalLib } from "../../zones-lib";
import { jsonSafe } from "../json-safe";
import { loadLibFor } from "../load-lib";
import { definePageTool, toModelContextTool } from "../page-tool";

export const invalidIntervalNote = (name: "A" | "B"): string =>
  `Interval ${name} is not valid: both ends must be zoned date-times and the end must not come before the start. No operation ran.`;

export const unzonedNote = (key: string, given: string, used: string): string =>
  `${key} ${given} names no zone, so it was read as UTC: ${used}.`;

export const def = definePageTool({
  page: "interval-visualizer",
  name: "compare_intervals",
  title: "Interval Algebra Visualizer",
  doxTool: "showIntervalVisualizer",
  returns:
    "aValid and bValid (whether each interval is valid), valid (both are), and results with intersection, union, difference (A minus B) and xor; intersection and union are an interval with start and end or null, difference and xor are a list of intervals, and an empty list or null is a real answer, the intervals share no time; results is null when an interval is not valid",
  calls: [
    "intervalIntersectionZoned",
    "intervalUnionZoned",
    "intervalDifferenceZoned",
    "intervalXorZoned",
    "isValidZonedDateTime",
    "isValidZonedRange",
  ],
  input: showIntervalVisualizerInput,
  example: {
    aStart: "2024-01-01T00:00:00+00:00[UTC]",
    aEnd: "2024-06-30T00:00:00+00:00[UTC]",
    bStart: "2024-04-01T00:00:00+00:00[UTC]",
    bEnd: "2024-12-31T00:00:00+00:00[UTC]",
  },
  async run(args, signal) {
    const lib = await loadLibFor(loadIntervalLib, signal);
    const notes: string[] = [];
    const used = { ...args };
    for (const key of ["aStart", "aEnd", "bStart", "bEnd"] as const) {
      used[key] = normaliseZonedInput(args[key]);
      if (used[key] !== args[key].trim()) {
        notes.push(unzonedNote(key, args[key], used[key]));
      }
    }
    const facts = intervalFacts(used, lib);
    if (!facts.aValid) notes.push(invalidIntervalNote("A"));
    if (!facts.bValid) notes.push(invalidIntervalNote("B"));
    return {
      input: used,
      result: jsonSafe(facts),
      notes,
      link: encodeWidgetPermalink("interval", used),
    };
  },
});

export default toModelContextTool(def);
