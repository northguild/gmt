/**
 * WebMCP tool for `/tools/duration-parser-bench/`: a duration string read the way the page reads
 * it, from the same `durationFacts` the page's redraw calls. The fixed tables are not part of it.
 */
import {
  BENCH_DEFAULT_TEXT,
  durationFacts,
  permalinkOf,
  readArgs,
} from "../../duration-parser-bench";
import { loadDurationBenchLib } from "../../duration-bench-lib";
import { showDurationParserBenchInput } from "../../dox-tool-schemas";
import { encodeWidgetPermalink } from "../../widget-permalink";
import { jsonSafe } from "../json-safe";
import { loadLibFor } from "../load-lib";
import { definePageTool, toModelContextTool } from "../page-tool";

export const defaultLocaleNote = (locale: string): string =>
  `No locale was given, so the words are written in ${locale}.`;

export const noWordsNote = (locale: string): string =>
  `formatDuration returned no words for the locale "${locale}", which this runtime does not read.`;

export const def = definePageTool({
  page: "duration-parser-bench",
  name: "read_duration",
  title: "Duration Parser Bench",
  doxTool: "showDurationParserBench",
  returns:
    "parser (iso, human or none), iso (the ISO 8601 duration, empty when neither parser reads the text), cells (one for each field from years to nanoseconds, with field, name and value, null for every field when the text is not read), compact, roundTrip, sameDuration (whether the round trip matches) and words (in the locale); compact, roundTrip, sameDuration and words are null when the text is not read; with no locale English is used",
  calls: [
    "parseDuration",
    "parseHumanDuration",
    "getDurationUnit",
    "formatHumanDuration",
    "formatDuration",
  ],
  input: showDurationParserBenchInput,
  example: { text: BENCH_DEFAULT_TEXT },
  async run(args, signal) {
    const lib = await loadLibFor(loadDurationBenchLib, signal);
    const state = readArgs(args);
    const seeded = args.locale === undefined || args.locale === "";
    const view = durationFacts(state, lib);
    const notes: string[] = [];
    if (seeded) notes.push(defaultLocaleNote(state.locale));
    if (view.refusal !== null) notes.push(view.refusal);
    else if (view.words === "") notes.push(noWordsNote(state.locale));
    return {
      input: { ...args, text: state.text, locale: state.locale },
      result: jsonSafe({
        parser: view.parser,
        iso: view.iso,
        cells: view.cells.map(({ field, name, value }) => ({
          field,
          name,
          value,
        })),
        compact: view.compact,
        roundTrip: view.roundTrip,
        sameDuration: view.sameDuration,
        words: view.words,
      }),
      notes,
      link: encodeWidgetPermalink("durationbench", permalinkOf(state)),
    };
  },
});

export default toModelContextTool(def);
