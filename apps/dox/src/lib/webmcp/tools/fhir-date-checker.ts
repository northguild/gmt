/**
 * WebMCP tool for `/tools/fhir-date-checker/`: one value read as a FHIR R4 `date`, `dateTime`
 * and `instant`, from the same `readFhir` the page's redraw calls. Each type's verdict carries
 * the page's own sentence for why it refuses.
 */
import { showFhirDateCheckerInput } from "../../dox-tool-schemas";
import { loadFhirLib } from "../../fhir-lib";
import {
  FHIR_PRESETS,
  memberReadout,
  permalinkOf,
  readArgs,
  readFhir,
  REASON_VALID,
  verdictOf,
} from "../../fhir-date-checker";
import { encodeWidgetPermalink } from "../../widget-permalink";
import { jsonSafe } from "../json-safe";
import { loadLibFor } from "../load-lib";
import { definePageTool, toModelContextTool } from "../page-tool";

const first = FHIR_PRESETS[0];
if (!first) throw new Error("fhir-date-checker: no presets");

export const def = definePageTool({
  page: "fhir-date-checker",
  name: "check_fhir_date",
  title: "FHIR Date Checker",
  doxTool: "showFhirDateChecker",
  returns:
    "Returns value, precision and offset (each null when the library does not read the value), verdict and detail, and types (one entry each for date, dateTime and instant, with valid, patternMatches and the reason that type refuses the value, or Valid.)",
  calls: ["parseFHIR", "isValidFHIR", "isLeapSecond"],
  input: showFhirDateCheckerInput,
  example: { value: first.value },
  async run(args, signal) {
    const lib = await loadLibFor(loadFhirLib, signal);
    const state = readArgs(args);
    const read = readFhir(lib, state.value);
    const member = (key: "value" | "precision" | "offset") => {
      const m = memberReadout(read, key);
      return m.state === "value" ? m.text : null;
    };
    const verdict = verdictOf(read);
    const notes: string[] = [];
    for (const r of read.rows) {
      if (r.reason !== REASON_VALID) notes.push(`${r.type}: ${r.reason}`);
    }
    return {
      input: args,
      result: jsonSafe({
        value: read.parsed === null ? null : read.parsed.value,
        precision: read.parsed === null ? null : read.parsed.precision,
        offset: read.parsed === null ? null : member("offset"),
        verdict: verdict.title,
        detail: verdict.detail === "" ? null : verdict.detail,
        types: read.rows.map((r) => ({
          type: r.type,
          valid: r.valid,
          patternMatches: r.pattern,
          reason: r.reason,
        })),
      }),
      notes,
      link: encodeWidgetPermalink("fhir", permalinkOf(state)),
    };
  },
});

export default toModelContextTool(def);
