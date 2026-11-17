/**
 * WebMCP tool for `/tools/terrestrial-time-stack/`: one instant on UTC, TAI, TT and TCG with the
 * three offsets between them, from the same `readStack` the page's redraw calls. Without a value
 * it reads the first preset, as the page opens on it; it needs no clock.
 */
import { showTerrestrialTimeStackInput } from "../../dox-tool-schemas";
import {
  permalinkOf,
  readArgs,
  readStack,
  STACK_PRESETS,
} from "../../terrestrial-time-stack";
import { loadTimescaleLib } from "../../timescale-lib";
import { encodeWidgetPermalink } from "../../widget-permalink";
import { jsonSafe } from "../json-safe";
import { loadLibFor } from "../load-lib";
import { definePageTool, toModelContextTool } from "../page-tool";

const first = STACK_PRESETS[0];
if (!first) throw new Error("terrestrial-time-stack: no presets");

export const def = definePageTool({
  page: "terrestrial-time-stack",
  name: "convert_instant_to_terrestrial_scales",
  title: "Terrestrial Time Stack",
  doxTool: "showTerrestrialTimeStack",
  returns:
    "The UTC instant the value names, rows with its label on UTC, TAI, TT and TCG and each label read back to UTC, and segments and gap for the gaps TAI - UTC, TT - TAI, TCG - TT and TT - UTC in seconds; a row has an empty label, and a segment or gap has kind none, when the library gives no answer for the instant",
  calls: [
    "toTAI",
    "fromTAI",
    "toTT",
    "fromTT",
    "toTCG",
    "fromTCG",
    "taiMinusUtc",
    "tcgMinusTt",
    "diffUtcAsDuration",
  ],
  input: showTerrestrialTimeStackInput,
  example: { value: first.state.value },
  async run(args, signal) {
    const lib = await loadLibFor(loadTimescaleLib, signal);
    const state = readArgs(args);
    const read = readStack(lib, state);
    const notes: string[] = [];
    if (read.failure !== null) notes.push(read.failure);
    if (read.emptyText !== null) notes.push(read.emptyText);
    if (read.footnote !== "") notes.push(read.footnote);
    return {
      input: args,
      result: jsonSafe({
        status: read.status,
        scale: read.scale,
        utc: read.utc,
        rows: read.rows.map((row) => ({
          scale: row.scale,
          label: row.label,
          back: row.back,
          yours: row.yours,
        })),
        segments: read.segments,
        gap: read.gap,
      }),
      notes,
      link: encodeWidgetPermalink("ttstack", permalinkOf(state)),
    };
  },
});

export default toModelContextTool(def);
