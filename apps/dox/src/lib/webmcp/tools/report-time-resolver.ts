/**
 * WebMCP tool for `/tools/report-time-resolver/`: a METAR, SPECI or TAF time group resolved
 * against a reference the caller states, and NOTAM items B) and C) read in a window the caller
 * states, from the same `buildModel` and `buildNotamModel` the page's redraws call. One tool, two
 * modes: the fields given pick the mode, and a mode with no field given is `null` in the result.
 */
import { loadAviationLib } from "../../aviation-lib";
import { showReportTimeResolverInput } from "../../dox-tool-schemas";
import {
  ANSWER_REASONS,
  buildModel,
  buildNotamModel,
  METAR_PRESETS,
  NOTAM_PRESETS,
  NOTAM_REASONS,
  notamPermalinkOf,
  permalinkOf,
  readArgs,
  readNotamArgs,
  type MetarModel,
  type NotamModel,
} from "../../report-time-resolver";
import { encodeWidgetPermalink } from "../../widget-permalink";
import { jsonSafe } from "../json-safe";
import { loadLibFor } from "../load-lib";
import { definePageTool, toModelContextTool } from "../page-tool";

const first = METAR_PRESETS[0];
if (!first) throw new Error("report-time-resolver: no presets");
if (NOTAM_PRESETS.length === 0) {
  throw new Error("report-time-resolver: no NOTAM presets");
}

export const NEEDS_A_FIELD =
  "Give a METAR, SPECI or TAF time group, or NOTAM items B) and C), to read.";

export const def = definePageTool({
  page: "report-time-resolver",
  name: "resolve_aviation_report_time",
  title: "Report Time Resolver",
  doxTool: "showReportTimeResolver",
  returns:
    "METAR fields (group, reference, metarPreset) give the instant the time group names and its candidate months; NOTAM fields (itemB, itemC, yearWindow, notamPreset) give the instant or permanent marker each item reads as. A mode with none of its fields given is null",
  calls: [
    "parseMetarTime",
    "isValidMetarTime",
    "toOffsetInstant",
    "parseNotamValidity",
    "isValidNotamValidity",
  ],
  input: showReportTimeResolverInput,
  example: { group: first.group, reference: first.reference },
  async run(args, signal) {
    const lib = await loadLibFor(loadAviationLib, signal);
    const wantsMetar =
      args.group !== undefined ||
      args.reference !== undefined ||
      args.metarPreset !== undefined;
    const wantsNotam =
      args.itemB !== undefined ||
      args.itemC !== undefined ||
      args.yearWindow !== undefined ||
      args.notamPreset !== undefined;

    const notes: string[] = [];
    let metar: MetarModel | null = null;
    let notam: NotamModel | null = null;
    let link: Record<string, unknown> = {};

    if (wantsMetar) {
      const state = readArgs({
        ...(args.metarPreset === undefined
          ? {}
          : { metarPreset: args.metarPreset }),
        ...(args.group === undefined ? {} : { group: args.group }),
        ...(args.reference === undefined ? {} : { ref: args.reference }),
      });
      metar = buildModel(lib, state);
      if (!metar.answer.blank && metar.answer.answer === null) {
        notes.push(ANSWER_REASONS[metar.answer.reason]);
      }
      link = { ...link, ...permalinkOf(state) };
    }
    if (wantsNotam) {
      const state = readNotamArgs({
        ...(args.notamPreset === undefined
          ? {}
          : { notamPreset: args.notamPreset }),
        ...(args.itemB === undefined ? {} : { b: args.itemB }),
        ...(args.itemC === undefined ? {} : { c: args.itemC }),
        ...(args.yearWindow === undefined
          ? {}
          : { window: String(args.yearWindow) }),
      });
      notam = buildNotamModel(lib, state);
      for (const item of [notam.b, notam.c]) {
        if (!item.blank && item.value === null) {
          notes.push(NOTAM_REASONS[item.reason]);
        }
      }
      link = { ...link, ...notamPermalinkOf(state) };
    }
    if (!wantsMetar && !wantsNotam) notes.push(NEEDS_A_FIELD);

    return {
      input: args,
      result: jsonSafe({ metar, notam }),
      notes,
      link: encodeWidgetPermalink("reporttime", link),
    };
  },
});

export default toModelContextTool(def);
