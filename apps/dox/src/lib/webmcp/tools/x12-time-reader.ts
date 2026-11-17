/**
 * WebMCP tool for `/tools/x12-time-reader/`: the date, time and time code of an X12 segment
 * (elements 373, 337 and 623) and a DTP value with its 1250 qualifier, read by the same
 * functions the page's redraw calls. A section with none of its fields given is `null`.
 */
import { showX12TimeReaderInput } from "../../dox-tool-schemas";
import { loadEdiLib } from "../../edi-lib";
import { widestGap } from "../../edi-widgets";
import {
  DTP_PRESETS,
  dtpBlank,
  dtpMemberText,
  dtpSentinelText,
  dtpWriteBack,
  gapRows,
  instantPlan,
  mainBlank,
  memberText,
  ok,
  permalinkOf,
  readArgs,
  readDtp,
  readX12,
  sentinelText,
  stripApplies,
  stripNote,
  verdictOf,
  writeDate,
  writeTime,
  X12_PRESETS,
} from "../../x12-time-reader";
import { encodeWidgetPermalink } from "../../widget-permalink";
import { jsonSafe } from "../json-safe";
import { loadLibFor } from "../load-lib";
import { definePageTool, toModelContextTool } from "../page-tool";

const main = X12_PRESETS[0];
const dtp = DTP_PRESETS[0];
if (!main || !dtp) throw new Error("x12-time-reader: no presets");

export const def = definePageTool({
  page: "x12-time-reader",
  name: "read_x12_date_time",
  title: "X12 Time Reader",
  doxTool: "showX12TimeReader",
  returns:
    "main holds kind, value, timeCode, offset (codes 01-29, UT, GM), zone and daylight (the other codes), instant, zones, gap, verdict, detail and written; dtp holds kind, value, end and written; null if not sent",
  argsSwaps: [
    ["; leave out when only a time is sent", ""],
    ["; leave out when only a date is sent", ""],
    ["timeCode (optional element", "timeCode (element"],
    ["zone4 (optional IANA", "zone4 (IANA"],
    ["(a DTP value: the 1250", "(the 1250"],
    [
      "only zones the reader named: never choose one from",
      "only the reader's zones, never one from",
    ],
    ["exactly as sent)", "as sent)"],
  ],
  calls: [
    "parseX12DateAndTime",
    "classifyX12TimeCode",
    "x12TimeCodeOffset",
    "x12TimeCodeZone",
  ],
  rules: ["Send a date, a time or a DTP value."],
  input: showX12TimeReaderInput,
  example: {
    date: main.date,
    time: main.time,
    timeCode: main.timeCode,
    zone: main.zones[0],
    zone2: main.zones[1],
    format: dtp.format,
    value: dtp.value,
  },
  async run(args, signal) {
    const lib = await loadLibFor(loadEdiLib, signal);
    const { main: m, dtp: d } = readArgs(args);
    const notes: string[] = [];
    let mainResult = null;
    let dtpResult = null;

    if (!mainBlank(m)) {
      const read = readX12(m, lib);
      const valid = ok(read);
      if (!valid) notes.push(sentinelText(read, lib));
      const applies = stripApplies(read);
      const rows = applies ? gapRows(read.house!, m.zones, lib) : [];
      const zones = rows.filter((r) => r.zone !== "");
      for (const r of zones) {
        if (r.reason !== "") notes.push(`${r.zone}: ${r.reason}`);
      }
      const plan = instantPlan(read, m.zones);
      const planned =
        plan.kind === "resolve"
          ? (rows.find((r) => r.zone !== "")?.instant ?? "")
          : read.instant;
      if (valid) {
        notes.push(plan.note, stripNote(read));
      }
      const dateW = writeDate(read, lib);
      const timeW = writeTime(read, lib);
      for (const w of [dateW, timeW]) {
        if (w !== null && w.note !== "") notes.push(w.note);
      }
      const v = verdictOf(read);
      mainResult = {
        kind: memberText(read, "kind"),
        value: memberText(read, "value"),
        timeCode: memberText(read, "code"),
        offset: memberText(read, "offset"),
        zone: memberText(read, "zone"),
        daylight: memberText(read, "daylight"),
        instant: planned === "" ? null : planned,
        zones: applies ? zones : null,
        gap: applies ? (widestGap(rows, lib)?.text ?? null) : null,
        verdict: v.verdict === "" ? null : v.verdict,
        detail: v.detail === "" ? null : v.detail,
        written: {
          date: dateW === null ? null : dateW.output,
          time: timeW === null ? null : timeW.output,
        },
      };
    }

    if (!dtpBlank(d)) {
      const read = readDtp(d, lib);
      if (read.house === null) notes.push(dtpSentinelText(read));
      const w = dtpWriteBack(read, lib);
      if (w !== null && w.note !== "") notes.push(w.note);
      dtpResult = {
        kind: dtpMemberText(read, "kind"),
        value: dtpMemberText(read, "value"),
        end: dtpMemberText(read, "rangeEnd"),
        written: w === null ? null : w.output,
      };
    }

    return {
      input: args,
      result: jsonSafe({ main: mainResult, dtp: dtpResult }),
      notes,
      link: encodeWidgetPermalink("xtime", permalinkOf(m, d)),
    };
  },
});

export default toModelContextTool(def);
