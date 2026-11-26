/**
 * WebMCP tool for `/tools/dtm-decoder/`: a UN/EDIFACT DTM segment or a bare value with its 2379
 * format code, read by the same `readDtm`, `gapRows` and `writeBack` the page's redraw calls.
 * A value with no offset is read in the zones given; the zones are the caller's picks.
 */
import { showDtmDecoderInput } from "../../dox-tool-schemas";
import {
  dtmBlank,
  DTM_PRESETS,
  gapRows,
  memberText,
  permalinkOf,
  readArgs,
  readDtm,
  sentinelText,
  stripApplies,
  stripNote,
  writeBack,
} from "../../dtm-decoder";
import { loadEdiLib } from "../../edi-lib";
import { widestGap } from "../../edi-widgets";
import { encodeWidgetPermalink } from "../../widget-permalink";
import { jsonSafe } from "../json-safe";
import { loadLibFor } from "../load-lib";
import { definePageTool, toModelContextTool } from "../page-tool";

const first = DTM_PRESETS[0];
if (!first) throw new Error("dtm-decoder: no presets");

export const def = definePageTool({
  page: "dtm-decoder",
  name: "decode_edifact_dtm",
  title: "EDIFACT DTM Decoder",
  doxTool: "showDtmDecoder",
  returns:
    "value and format (as read), kind, start, end (null unless a period), instant and offset (null unless the value states an offset), written (the value written back, or null), zones (one entry per zone given, each with zone, instant, offset, third and reason; null unless a local time or period) and gap (the widest gap between the zones, or null)",
  calls: [
    "classifyEdifactDtmFormat",
    "parseEdifactDate",
    "toOffsetInstant",
    "resolveLocal",
    "formatEdifactOffsetDateTime",
  ],
  input: showDtmDecoderInput,
  example: {
    input: first.input,
    zone1: first.zones[0],
    zone2: first.zones[1],
    zone3: first.zones[2],
    zone4: first.zones[3],
  },
  async run(args, signal) {
    const lib = await loadLibFor(loadEdiLib, signal);
    const state = readArgs(args);
    const blank = dtmBlank(state);
    const read = readDtm(
      blank ? { ...state, input: "", format: "" } : state,
      lib,
    );
    const notes: string[] = [];
    if (read.house === null) notes.push(sentinelText(state, read, lib));
    const applies = stripApplies(read);
    let zones = null;
    let gap = null;
    if (applies && read.house !== null) {
      const rows = gapRows(read.house, state.zones, lib);
      zones = rows.filter((r) => r.zone !== "");
      for (const r of zones)
        if (r.reason !== "") notes.push(`${r.zone}: ${r.reason}`);
      gap = widestGap(rows, lib)?.text ?? null;
    }
    if (read.house !== null) notes.push(stripNote(read));
    const written = writeBack(read, lib);
    if (written !== null && written.note !== "") notes.push(written.note);
    return {
      input: args,
      result: jsonSafe({
        value: read.value,
        format: read.format,
        kind: memberText(read, "kind"),
        start: memberText(read, "value"),
        end: memberText(read, "periodEnd"),
        instant: memberText(read, "instant"),
        offset: memberText(read, "offset"),
        written: written === null ? null : written.output,
        zones,
        gap,
      }),
      notes,
      link: encodeWidgetPermalink("dtm", permalinkOf(state)),
    };
  },
});

export default toModelContextTool(def);
