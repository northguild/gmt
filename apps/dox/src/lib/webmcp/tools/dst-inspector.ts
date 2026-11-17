/**
 * WebMCP tool for `/tools/dst-inspector/`: a zone's clock changes in one year, and what one wall
 * time next to a change turns into under the chosen disambiguation, from the same `dstFacts` the
 * inspector's redraw calls. The strip's thumb is not part of it: the probe starts where the
 * preset puts it.
 */
import { showDstInspectorInput } from "../../dox-tool-schemas";
import { dstFacts, dstScrubFor, VALUE_PRESETS } from "../../dst-inspector";
import { encodeWidgetPermalink } from "../../widget-permalink";
import { loadDstLib } from "../../zones-lib";
import { jsonSafe } from "../json-safe";
import { loadLibFor } from "../load-lib";
import { definePageTool, toModelContextTool } from "../page-tool";
import { seedNote } from "../seed-note";

/** The preset the inspector opens on, and the disambiguation it opens with. */
const DEFAULT_PRESET = "gap";
const DEFAULT_DISAMBIGUATION = "compatible";

/** The inspector's own presets. The chat schema also allows `fixed`, which the inspector lacks. */
const KNOWN_PRESETS: readonly string[] = VALUE_PRESETS.map((p) => p.type);

/**
 * The preset the inspector settles on for a call. A preset it does not offer leaves its
 * selector on the first option.
 */
export function presetUsed(given: string | undefined): string {
  if (given === undefined) return DEFAULT_PRESET;
  const first = VALUE_PRESETS[0];
  if (first === undefined) throw new Error("dst-inspector: no presets");
  return KNOWN_PRESETS.includes(given) ? given : first.type;
}

export const unknownPresetNote = (given: string, used: string): string =>
  `The preset ${given} is not one the inspector offers, so ${used} was used.`;

export const OFFSET_IGNORED =
  "offset is not read: the probe is a wall time, and the disambiguation decides which offset it takes.";

export const noProbeNote = (
  zone: string,
  year: number,
  preset: string,
): string =>
  `No probe could be built for the ${preset} preset in ${zone} in ${year}: the zone has no clock change that year, or the library does not know it. Nothing was probed.`;

export const def = definePageTool({
  page: "dst-inspector",
  name: "list_dst_transitions",
  title: "DST Transition Inspector",
  doxTool: "showDstInspector",
  returns:
    "transitions (instant, offsetBefore and offsetAfter of each clock change in the year) and probe (value, the wall time tried, resolved, the instant the library gave back or an empty string when it gave none, and classification with its type gap, overlap or normal and a sentence); probe is null when the zone has no change to probe",
  calls: ["getDstTransitions", "convertPlainDateTimeToZoned"],
  input: showDstInspectorInput,
  example: { zone: "Europe/London", year: 2024, preset: "gap" },
  async run(args, signal) {
    const lib = await loadLibFor(loadDstLib, signal);
    const preset = presetUsed(args.preset);
    const disambiguation = args.disambiguation ?? DEFAULT_DISAMBIGUATION;
    const facts = dstFacts(
      {
        zone: args.zone,
        year: args.year,
        preset,
        disambiguation,
        scrub: dstScrubFor(args.zone, args.year, preset, lib),
      },
      lib,
    );

    const notes: string[] = [];
    const seeded = [
      ...(args.preset === undefined ? ["preset"] : []),
      ...(args.disambiguation === undefined ? ["disambiguation"] : []),
    ];
    if (seeded.length > 0) notes.push(seedNote(seeded));
    if (args.preset !== undefined && args.preset !== preset) {
      notes.push(unknownPresetNote(args.preset, preset));
    }
    if (args.offset !== undefined) notes.push(OFFSET_IGNORED);
    const probed = facts.value !== "";
    if (!probed) notes.push(noProbeNote(args.zone, args.year, preset));

    return {
      input: { ...args, preset, disambiguation },
      result: jsonSafe({
        transitions: facts.transitions,
        probe: probed
          ? {
              value: facts.value,
              wallTime: facts.plainValue,
              resolved: facts.result,
              classification: facts.classification,
            }
          : null,
      }),
      notes,
      link: encodeWidgetPermalink("dst", {
        zone: args.zone,
        year: args.year,
        preset,
        disambiguation,
      }),
    };
  },
});

export default toModelContextTool(def);
