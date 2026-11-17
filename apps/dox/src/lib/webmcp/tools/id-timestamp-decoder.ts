/**
 * WebMCP tool for `/tools/id-timestamp-decoder/`: one identifier put to all five decoders, from the
 * same `readIds` and `heroOf` the page's redraw calls. The call listing is not part of it.
 */
import {
  heroOf,
  ID_PRESETS,
  permalinkOf,
  readArgs,
  readIds,
  type RowResult,
} from "../../id-timestamp-decoder";
import { loadIdentifierLib } from "../../identifier-lib";
import { showIdTimestampDecoderInput } from "../../dox-tool-schemas";
import { encodeWidgetPermalink } from "../../widget-permalink";
import { jsonSafe } from "../json-safe";
import { loadLibFor } from "../load-lib";
import { definePageTool, toModelContextTool } from "../page-tool";

const first = ID_PRESETS[0];
if (first === undefined) throw new Error("id-timestamp-decoder: no presets");

const rowFacts = (result: RowResult) =>
  result.kind === "read"
    ? {
        status: "read",
        instant: result.instant,
        version: result.version ?? null,
        returned: null,
        reason: null,
      }
    : result.kind === "sentinel"
      ? {
          status: "sentinel",
          instant: null,
          version: null,
          returned: result.literal === '""' ? "" : null,
          reason: null,
        }
      : {
          status: "not-called",
          instant: null,
          version: null,
          returned: null,
          reason: result.why,
        };

export const def = definePageTool({
  page: "id-timestamp-decoder",
  name: "decode_id_timestamp",
  title: "ID Timestamp Decoder",
  doxTool: "showIdTimestampDecoder",
  returns:
    "outcome (one when a single decoder read the id, many when several did, none when no decoder did), format and instant (the decoder and the creation time when outcome is one, otherwise null), version (1, 6 or 7 for a UUID, otherwise null), readBy (how many decoders read it) and rows, one entry for each of the five formats in the order tried, with its format, fn, status (read, sentinel or not-called), instant, version, returned (what the decoder gave for a sentinel, an empty string or null; else null) and reason (why a Snowflake was not tried)",
  calls: [
    "fromUuidTimestamp",
    "fromUlid",
    "fromObjectId",
    "fromKsuid",
    "fromSnowflake",
  ],
  input: showIdTimestampDecoderInput,
  example: { id: first.state.id },
  async run(args, signal) {
    const lib = await loadLibFor(loadIdentifierLib, signal);
    const state = readArgs(args);
    const rows = readIds(lib, state);
    const hero = heroOf(rows, state);
    const notes: string[] = [];
    if (hero.kind === "none" || hero.kind === "many") notes.push(hero.reason);
    for (const row of rows) {
      if (row.result.kind === "not-called" && !notes.includes(row.result.why)) {
        notes.push(row.result.why);
      }
    }
    return {
      input: args,
      result: jsonSafe({
        outcome: hero.kind,
        format: hero.kind === "one" ? hero.format : null,
        instant: hero.kind === "one" ? hero.instant : null,
        version: hero.kind === "one" ? (hero.version ?? null) : null,
        readBy: hero.kind === "one" ? 1 : hero.kind === "many" ? hero.count : 0,
        rows: rows.map((row) => ({
          format: row.format,
          fn: row.fn,
          ...rowFacts(row.result),
        })),
      }),
      notes,
      link: encodeWidgetPermalink("iddecode", permalinkOf(state)),
    };
  },
});

export default toModelContextTool(def);
