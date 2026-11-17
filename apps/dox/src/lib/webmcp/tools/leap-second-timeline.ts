/**
 * WebMCP tool for `/tools/leap-second-timeline/`: the inserted seconds with the offset each
 * begins, the offset on a date, the leap seconds between two dates and a verdict on a typed
 * second 60, from the same `readTimeline` the page's redraw calls. The page has no mode field, so
 * the fields given pick the sections, as `report-time-resolver` does; a section with none of its
 * fields given is `null`.
 */
import { showLeapSecondTimelineInput } from "../../dox-tool-schemas";
import {
  permalinkOf,
  readArgs,
  readTimeline,
  TIMELINE_PRESETS,
} from "../../leap-second-timeline";
import { loadTimescaleLib } from "../../timescale-lib";
import { encodeWidgetPermalink } from "../../widget-permalink";
import { jsonSafe } from "../json-safe";
import { loadLibFor } from "../load-lib";
import { definePageTool, toModelContextTool } from "../page-tool";

const first = TIMELINE_PRESETS[0];
if (!first) throw new Error("leap-second-timeline: no presets");

export const BOTH_ENDS =
  "Give both from and to to count the leap seconds between two dates.";

export const def = definePageTool({
  page: "leap-second-timeline",
  name: "list_leap_seconds",
  title: "Leap Second Timeline",
  doxTool: "showLeapSecondTimeline",
  returns:
    "Every inserted leap second with the first instant after it and the offset TAI - UTC from then on, plus one section for each field given, offset for date, between for from and to together, and check for a typed second 60, and when several fields are given every one of those sections is read; a section whose fields were not given is null, and within a section the offset, count or verdict field is null when the library gives no answer",
  calls: [
    "taiMinusUtc",
    "nextLeapSecond",
    "leapSecondsBetween",
    "hasSecond60",
    "isLeapSecond",
    "isValidInstant",
    "fromTAI",
    "toTAI",
  ],
  rules: ["Give at least one of date, check, from and to."],
  input: showLeapSecondTimelineInput,
  example: {
    date: first.date,
    check: first.check,
    from: first.from,
    to: first.to,
  },
  async run(args, signal) {
    const lib = await loadLibFor(loadTimescaleLib, signal);
    const state = readArgs(args);
    const read = readTimeline(lib, state);
    const wantsDate = state.date !== "";
    const wantsCheck = state.check !== "";
    const wantsBetween = state.from !== "" && state.to !== "";
    const notes: string[] = [];
    if ((state.from === "") !== (state.to === "")) notes.push(BOTH_ENDS);
    if (wantsDate && read.offset.reason !== "") notes.push(read.offset.reason);
    if (wantsBetween && read.between.reason !== "") {
      notes.push(read.between.reason);
    }
    if (wantsCheck && read.check.reason !== "") notes.push(read.check.reason);
    return {
      input: args,
      result: jsonSafe({
        steps: read.steps.map((step) => ({
          insertion: step.insertion,
          after: step.after,
          offset: step.offset,
        })),
        startOffset: read.startOffset,
        offset: wantsDate
          ? { offset: read.offset.offset, next: read.offset.next }
          : null,
        between: wantsBetween
          ? { count: read.between.count, counted: read.between.counted }
          : null,
        check: wantsCheck
          ? {
              verdict: read.check.verdict,
              insertion: read.check.insertion,
              isLeap: read.check.isLeap,
              hasSecond60: read.check.hasSecond60,
            }
          : null,
      }),
      notes,
      link: encodeWidgetPermalink("leapline", permalinkOf(state)),
    };
  },
});

export default toModelContextTool(def);
