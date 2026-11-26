/**
 * WebMCP tool for `/tools/ccsds-time-code-decoder/`: a CCSDS 301.0-B-4 ASCII time code read into
 * the instant it names, and an instant written as Code A and Code B, from the same `readCode` and
 * `writeInstant` the page's redraw calls. The fields given pick the sections, as
 * `report-time-resolver` does; a section with none of its fields given is `null`.
 */
import type { z } from "zod";
import { loadCcsdsLib } from "../../ccsds-lib";
import {
  CODE_PRESETS,
  EMPTY_CODE_TEXT,
  EMPTY_INSTANT_TEXT,
  permalinkOf,
  readArgs,
  readCode,
  WRITE_PRESETS,
  WRITE_REFUSED_TEXT,
  writeInstant,
} from "../../ccsds-time-code-decoder";
import { showCcsdsTimeCodeDecoderInput } from "../../dox-tool-schemas";
import { encodeWidgetPermalink } from "../../widget-permalink";
import { jsonSafe } from "../json-safe";
import { loadLibFor } from "../load-lib";
import { definePageTool, toModelContextTool } from "../page-tool";

const code = CODE_PRESETS[0];
const write = WRITE_PRESETS[0];
if (!code || !write) throw new Error("ccsds-time-code-decoder: no presets");
const digits = String(write.digits) as NonNullable<
  z.input<typeof showCcsdsTimeCodeDecoderInput>["digits"]
>;

export const NEEDS_A_FIELD = "Give a code to read or an instant to write.";
export const DIGITS_NEED_AN_INSTANT =
  "The digits apply only to an instant to write, and none was given.";

export const def = definePageTool({
  page: "ccsds-time-code-decoder",
  name: "decode_ccsds_time_code",
  title: "CCSDS Time Code Decoder",
  doxTool: "showCcsdsTimeCodeDecoder",
  returns:
    "For a code, read holds kind, which (Code A or Code B), the instant, digits kept, dropped digits, secondSixty, zSent, dayCaption and the refusal reason; for an instant, write holds kind, a (Code A text), b (Code B text) and cut, the fraction cut off or null; read is null with no code, write is null with no instant",
  calls: [
    "parseCcsdsAsciiA",
    "parseCcsdsAsciiB",
    "formatCcsdsAsciiA",
    "formatCcsdsAsciiB",
    "getLocaleMonthNames",
  ],
  input: showCcsdsTimeCodeDecoderInput,
  example: {
    code: code.text,
    instant: write.text,
    digits,
  },
  async run(args, signal) {
    const lib = await loadLibFor(loadCcsdsLib, signal);
    const state = readArgs(args);
    const notes: string[] = [];
    let read = null;
    let written = null;
    if (args.code !== undefined) {
      const reading = readCode(lib, state.code);
      read = {
        kind: reading.kind,
        which: reading.which,
        instant: reading.instant,
        digits: reading.digits,
        dropped: reading.dropped,
        secondSixty: reading.secondSixty,
        zSent: reading.zSent,
        dayCaption: reading.dayCaption,
        reason: reading.reason,
      };
      if (reading.kind === "empty") notes.push(EMPTY_CODE_TEXT);
      if (reading.kind === "refused") notes.push(reading.reason);
    }
    if (args.instant !== undefined) {
      const writing = writeInstant(lib, state.instant, state.digits);
      written = {
        kind: writing.kind,
        a: writing.a,
        b: writing.b,
        cut: writing.cut,
      };
      if (writing.kind === "empty") notes.push(EMPTY_INSTANT_TEXT);
      if (writing.kind === "refused") notes.push(WRITE_REFUSED_TEXT);
    } else if (args.digits !== undefined && args.code !== undefined) {
      notes.push(DIGITS_NEED_AN_INSTANT);
    }
    if (args.code === undefined && args.instant === undefined) {
      notes.push(NEEDS_A_FIELD);
    }
    return {
      input: args,
      result: jsonSafe({ read, write: written }),
      notes,
      link: encodeWidgetPermalink("ccsds", permalinkOf(state)),
    };
  },
});

export default toModelContextTool(def);
