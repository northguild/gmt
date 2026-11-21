/**
 * WebMCP tool for `/tools/column-timestamp-bridge/`: one instant stored in a Parquet INT96, an
 * Arrow timestamp and protobuf Timestamp and Duration columns, or stored values read back, from
 * the same `readBridge` the page's redraw calls. The card layout and the code frames are drawing
 * and not part of it.
 */
import { loadColumnBridgeLib } from "../../column-bridge-lib";
import {
  CARDS,
  NO_VALUE_TEXT,
  permalinkOf,
  readArgs,
  readBridge,
  type BridgeState,
} from "../../column-timestamp-bridge";
import { BRIDGE_PRESETS } from "../../column-timestamp-bridge-presets";
import { showColumnTimestampBridgeInput } from "../../dox-tool-schemas";
import { callArgsPlain, formatValue } from "../../punctuality-widgets";
import { encodeWidgetPermalink } from "../../widget-permalink";
import { jsonSafe } from "../json-safe";
import { loadLibFor } from "../load-lib";
import { definePageTool, toModelContextTool } from "../page-tool";
import { seedNote } from "../seed-note";

const first = BRIDGE_PRESETS[0];
if (first === undefined) throw new Error("column-timestamp-bridge: no presets");

const orNull = (text: string): string | null => (text === "" ? null : text);

export const def = definePageTool({
  page: "column-timestamp-bridge",
  name: "convert_column_timestamp",
  title: "Column Timestamp Bridge",
  doxTool: "showColumnTimestampBridge",
  returns:
    "mode, hero (the instant read back, else null), cards (INT96, Arrow, Timestamp and Duration, each with status, fields and read-back), ladder (encode only, else null) and calls",
  calls: [
    "toParquetInt96",
    "fromParquetInt96",
    "fromArrowLocalTimestamp",
    "toProtoTimestamp",
    "fromProtoTimestamp",
    "toProtoDuration",
    "fromProtoDuration",
    "toNanoseconds",
    "fromNanoseconds",
    "isValidInstant",
    "isValidDateTime",
    "isValidTimeZone",
  ],
  rules: [
    "Not value and stored fields together, nor INT96 bytes with its record fields.",
  ],
  argsSwaps: [
    [
      "mode (encode | decode; optional, taken from the fields). Encode needs value (an ISO instant or a zoneless wall time); decode needs at least one stored value: julianDay and nanosOfDay (or bytes, 24 hex digits; int96Form record | bytes is optional), int64, seconds and nanos, or durSeconds and durNanos. Never send both value and a stored value. Also unit (second | millisecond | microsecond | nanosecond), zone (the Arrow column's IANA id; leave out for a zoneless column) and duration (ISO, optional). Send values exactly as the reader gave them.",
      "mode (encode | decode, optional); value to encode (ISO instant or zoneless wall time); or stored fields to decode (bytes, 24 hex digits, or julianDay and nanosOfDay; int64; seconds and nanos; durSeconds and durNanos); unit; zone (IANA id, Arrow only); duration (ISO). Values exactly as given",
    ],
  ],
  input: showColumnTimestampBridgeInput,
  example: {
    value: first.state.value,
    unit: first.state.unit,
    zone: first.state.zone,
    duration: first.state.duration,
  },
  async run(args, signal) {
    const lib = await loadLibFor(loadColumnBridgeLib, signal);
    const state: BridgeState = readArgs(args);
    const reading = readBridge(lib, state);
    const text = (c: { fn: string; args: unknown[] }) =>
      `${c.fn}(${callArgsPlain(c.args)})`;

    const notes: string[] = [];
    if (state.mode === "encode" && args.unit === undefined) {
      notes.push(seedNote(["unit"]));
    }
    if (reading.hero !== null && reading.hero.kind !== "instant") {
      notes.push(reading.hero.reason);
    }
    for (const card of reading.cards) {
      const words = card.status === "idle" ? card.idle : card.reason;
      if (words !== "" && !notes.includes(words)) notes.push(words);
    }
    if (reading.hero === null && reading.cards.length === 0) {
      notes.push(NO_VALUE_TEXT);
    }

    return {
      input: {
        ...args,
        mode: state.mode,
        unit: state.unit,
        int96Form: state.int96Form,
      },
      result: jsonSafe({
        mode: reading.mode,
        hero:
          reading.hero === null
            ? null
            : {
                kind: reading.hero.kind,
                exact:
                  reading.hero.kind === "instant" ? reading.hero.exact : null,
                reason:
                  reading.hero.kind === "instant" ? null : reading.hero.reason,
              },
        cards: reading.cards.map((card) => ({
          id: card.id,
          title: CARDS.find((c) => c.id === card.id)?.title ?? card.id,
          status: card.status,
          stored: card.stored,
          readBack: card.readBack === null ? null : card.readBack.text,
          readBackIsWallTime: card.readBack?.kind === "local",
          zonelessRead: card.zonelessRead,
          literal: orNull(card.literal),
          validator: card.validator === null ? null : text(card.validator),
          message: orNull(card.status === "idle" ? card.idle : card.reason),
        })),
        ladder: reading.ladder,
        calls: reading.calls.map((c) => ({
          call: text(c),
          returned: formatValue(c.result),
        })),
      }),
      notes,
      link: encodeWidgetPermalink("colbridge", permalinkOf(state)),
    };
  },
});

export default toModelContextTool(def);
