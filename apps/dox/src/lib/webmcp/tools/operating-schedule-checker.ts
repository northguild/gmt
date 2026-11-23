/**
 * WebMCP tool for `/tools/operating-schedule-checker/`: whether a pasted `OperatingSchedule` is
 * refused, closed or open in an interval, from the same `checkSchedule` the page's redraw calls.
 * The interval is optional and never defaulted: without one, nothing is asked of
 * `operatingIntervals` and the answer says so.
 */
import { showScheduleCheckerInput } from "../../dox-tool-schemas";
import {
  OPERATING_SCHEDULE_PRESETS,
  NOT_JSON_TEXT,
  checkSchedule,
  intervalsResult,
  permalinkOf,
  readArgs,
  refusedLines,
  validResult,
  verdictOf,
} from "../../schedule-checker";
import { loadHoursLib } from "../../hours-lib";
import { encodeWidgetPermalink } from "../../widget-permalink";
import { jsonSafe } from "../json-safe";
import { loadLibFor } from "../load-lib";
import { definePageTool, toModelContextTool } from "../page-tool";

const first = OPERATING_SCHEDULE_PRESETS[0];
if (!first) throw new Error("operating-schedule-checker: no presets");

export const def = definePageTool({
  page: "operating-schedule-checker",
  name: "check_operating_schedule",
  title: "Operating Schedule Checker",
  doxTool: "showScheduleChecker",
  returns:
    "kind is not-json, refused, no-interval, interval-refused, closed or open; valid is what isValidOperatingSchedule returned; intervals is what operatingIntervals returned, null when not called; openTime is for open only; parts lists the JSON paths of parts refused on their own",
  calls: [
    "isValidOperatingSchedule",
    "isValidInterval",
    "operatingIntervals",
    "operatingTimeBetween",
  ],
  rules: [
    "Send the schedule as JSON text, exactly as it is written.",
    "[] from operatingIntervals means closed or refused: read valid to tell which.",
  ],
  input: showScheduleCheckerInput,
  example: { schedule: first.text, start: first.start, end: first.end },
  async run(args, signal) {
    const lib = await loadLibFor(loadHoursLib, signal);
    const state = readArgs(args);
    const facts = checkSchedule(lib, state);
    const verdict = verdictOf(facts);
    const notes: string[] = [];
    if (facts.kind === "not-json") notes.push(NOT_JSON_TEXT);
    else notes.push(`${verdict.title}. ${verdict.detail}`);
    if (facts.kind === "refused") notes.push(...refusedLines(facts.probe));
    return {
      input: args,
      result: jsonSafe({
        kind: facts.kind,
        valid: validResult(facts),
        intervals: intervalsResult(facts),
        openTime: facts.kind === "open" ? facts.openTime : null,
        parts:
          facts.kind === "refused" && facts.probe.kind === "parts-refused"
            ? facts.probe.parts
            : [],
      }),
      notes,
      link: encodeWidgetPermalink("schedule", permalinkOf(state)),
    };
  },
});

export default toModelContextTool(def);
