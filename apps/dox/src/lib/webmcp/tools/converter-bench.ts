/**
 * WebMCP tool for `/tools/converter-bench/`: one date-time in a target zone, as formatted parts
 * and in words relative to now, from the same `converterFacts` the bench's redraw calls. The
 * regex chips are not part of it: they test a fixed sample, not the caller's value.
 */
import { CONVERTER_DEFAULTS, converterFacts } from "../../converter-bench";
import { showConverterBenchInput } from "../../dox-tool-schemas";
import { encodeWidgetPermalink } from "../../widget-permalink";
import { normaliseZonedInput } from "../../zoned-input";
import { loadConverterLib } from "../../zones-lib";
import { getUtcNow } from "@northguild/gmt/utc/get";
import { jsonSafe } from "../json-safe";
import { loadLibFor } from "../load-lib";
import { definePageTool, toModelContextTool } from "../page-tool";
import { seedNote } from "../seed-note";

/** The zone a value names in its own brackets, or `null` when it names none. */
const bracketZone = (value: string): string | null =>
  /\[([^\]]+)\]$/.exec(value)?.[1] ?? null;

export const currentTimeNote = (now: string): string =>
  `The current time, ${now}, was used for the relative wording.`;

/** Said for every value that is not already a zoned date-time (a plain date-time, a date alone, a Z or numeric offset with no bracketed zone, or text that is not a date at all). */
export const unzonedNote = (given: string, used: string): string =>
  `${given} is not a date-time with a bracketed zone, so it was rewritten as ${used}.`;

export const fromIgnoredNote = (from: string, zone: string): string =>
  `from is ${from}, but the value carries ${zone}, and the conversion starts from the zone the value carries.`;

export const def = definePageTool({
  page: "converter-bench",
  name: "convert_instant_between_zones",
  title: "Converter and Format Bench",
  doxTool: "showConverterBench",
  returns:
    "converted (the value in the target zone), parts (type and value of each piece of the value formatted for the locale) and relative (the value in words against the current time); converted and relative are empty strings and parts is an empty list when the library refuses the value, and only converted is empty when it refuses the target zone (parts and relative are still read); parts and relative are empty when it refuses the locale. A value that is empty or shorter than 4 characters is refused before the library runs. A value with no bracketed zone is rewritten first (one with no offset is read as UTC), and the conversion starts from the zone the value then carries, so from does not choose it",
  calls: ["convertZonedToZoned", "formatZonedToParts", "formatRelativeZoned"],
  input: showConverterBenchInput,
  example: {
    value: CONVERTER_DEFAULTS.value,
    from: CONVERTER_DEFAULTS.from,
    to: CONVERTER_DEFAULTS.to,
    locale: CONVERTER_DEFAULTS.locale,
  },
  async run(args, signal) {
    const lib = await loadLibFor(loadConverterLib, signal);
    const now = getUtcNow();
    const value = normaliseZonedInput(args.value);
    const locale = args.locale ?? CONVERTER_DEFAULTS.locale;
    const facts = converterFacts(
      {
        convertValue: value,
        target: args.to,
        formatValue: value,
        locale,
        regexInput: "",
      },
      lib,
    );

    const notes: string[] = [currentTimeNote(now)];
    if (args.locale === undefined) notes.push(seedNote(["locale"]));
    if (value !== args.value.trim()) notes.push(unzonedNote(args.value, value));
    const named = bracketZone(value);
    if (facts.converted !== "" && named !== null && named !== args.from) {
      notes.push(fromIgnoredNote(args.from, named));
    }
    if (facts.converted === "") {
      notes.push(
        "convertZonedToZoned returned an empty string: the value or the target zone is not valid.",
      );
    }
    return {
      input: { ...args, value, locale, now },
      result: jsonSafe({
        converted: facts.converted,
        parts: facts.parts,
        relative: facts.relative,
      }),
      notes,
      link: encodeWidgetPermalink("converter", {
        value,
        from: args.from,
        to: args.to,
        locale,
      }),
    };
  },
});

export default toModelContextTool(def);
