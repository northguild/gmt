/**
 * WebMCP tool for `/tools/hl7-timestamp-reader/`: one HL7 v2 date-time read by `parseHL7`, a value
 * with no offset placed in the zones given, and the value written back at every precision. The
 * facts come from `hl7Facts`, the one function the page's redraw also calls.
 */
import { showHl7TimestampReaderInput } from "../../dox-tool-schemas";
import { loadHl7Lib } from "../../hl7-lib";
import {
  detailText,
  hl7Blank,
  hl7Facts,
  HL7_PRESETS,
  memberReadout,
  permalinkOf,
  readArgs,
  sentinelText,
  stripNote,
  verdictText,
  type LadderCell,
} from "../../hl7-timestamp-reader";
import { encodeWidgetPermalink } from "../../widget-permalink";
import { jsonSafe } from "../json-safe";
import { loadLibFor } from "../load-lib";
import { definePageTool, toModelContextTool } from "../page-tool";

const first = HL7_PRESETS[0];
if (!first) throw new Error("hl7-timestamp-reader: no presets");

/** A ladder cell as the library's text: a value, `""` for `no result`, null where none was made. */
const cellText = (cell: LadderCell): string | null =>
  cell.state === "value" ? cell.text : cell.state === "none" ? "" : null;

export const def = definePageTool({
  page: "hl7-timestamp-reader",
  name: "read_hl7_timestamp",
  title: "HL7 Timestamp Reader",
  doxTool: "showHl7TimestampReader",
  returns:
    "kind (instant, local, partial or null), instant, local, offset and precision (null where not stated), verdict, detail, readAsUtc, gap (the widest gap between zones, or null), zones (when kind is local; per zone: zone, instant, offset, fromUtcReading, reason) and ladder (withOffsetColumn; rows of precision, sent and withOffset, each precision as sent and with an offset)",
  argsSwaps: [
    ["; at most 64 characters", ""],
    ["zone4 (optional IANA", "zone4 (IANA"],
  ],
  calls: ["parseHL7", "resolveLocal", "diffUtcAsDuration", "formatHL7"],
  input: showHl7TimestampReaderInput,
  example: {
    value: first.value,
    zone1: first.zones[0],
    zone2: first.zones[1],
  },
  async run(args, signal) {
    const lib = await loadLibFor(loadHl7Lib, signal);
    const state = readArgs(args);
    const { read, strip, ladder } = hl7Facts(state, lib);
    const notes: string[] = [];
    const blank = hl7Blank(state);
    if (!blank && read.parsed === null) notes.push(sentinelText(read, lib));
    if (read.parsed !== null) notes.push(stripNote(read));
    let zones = null;
    if (strip !== null) {
      zones = strip.rows
        .filter((r) => r.zone !== "")
        .map((r) => ({
          zone: r.zone,
          instant: r.instant,
          offset: r.offset,
          fromUtcReading: r.third,
          reason: r.reason,
        }));
      for (const r of zones) {
        if (r.reason !== "") notes.push(`${r.zone}: ${r.reason}`);
      }
    }
    if (ladder.note !== "") notes.push(ladder.note);
    const member = (
      key: "kind" | "instant" | "offset" | "local" | "precision",
    ) => {
      const m = memberReadout(read, key);
      return m.state === "value" ? m.text : null;
    };
    const verdict = verdictText(read);
    const detail = detailText(read);
    return {
      input: args,
      result: jsonSafe({
        kind: member("kind"),
        instant: member("instant"),
        local: member("local"),
        offset: member("offset"),
        precision: member("precision"),
        verdict: verdict === "" ? null : verdict,
        detail: detail === "" ? null : detail,
        readAsUtc:
          strip === null || strip.utcReading === "" ? null : strip.utcReading,
        gap: strip?.gap?.text ?? null,
        zones,
        ladder:
          read.parsed === null
            ? null
            : {
                withOffsetColumn: ladder.third,
                rows: ladder.rows.map((r) => ({
                  precision: r.precision,
                  sent: cellText(r.sent),
                  withOffset: cellText(r.offset),
                })),
              },
      }),
      notes,
      link: encodeWidgetPermalink("hl7", permalinkOf(state)),
    };
  },
});

export default toModelContextTool(def);
