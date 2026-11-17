/**
 * WebMCP tool for `/tools/holiday-rule-builder/`: an ordered list of holiday rules built into one
 * year's calendar, from the same `holidayFacts` the page's redraw calls. The grid, the printed
 * calls and the Ledger hand-off are not part of it.
 */
import { showHolidayRuleBuilderInput } from "../../dox-tool-schemas";
import { loadHolidayLib } from "../../holiday-lib";
import {
  BUILDER_PRESETS,
  holidayFacts,
  permalinkOf,
  readArgs,
  rowResult,
  rulesOf,
  NO_SIGNAL_TEXT,
  YEAR_NOTE_INVALID,
  YEAR_NOTE_NULL,
  movedCount,
} from "../../holiday-rule-builder";
import { encodeWidgetPermalink } from "../../widget-permalink";
import { jsonSafe } from "../json-safe";
import { loadLibFor } from "../load-lib";
import { definePageTool, toModelContextTool } from "../page-tool";
import { seedNote } from "../seed-note";

/**
 * The page's zone is a list it chooses from, so it cannot show a zone the library does not know.
 * A tool call can name one: every rule is then valid and the calendar still cannot be built.
 */
export const zoneNote = (zone: string): string =>
  `${NO_SIGNAL_TEXT}: the library does not know the zone ${zone}, so the calendar cannot be built.`;

const first = BUILDER_PRESETS[0];
if (first === undefined) throw new Error("holiday-rule-builder: no presets");

/** What the build returns; every field but the zone and weekend is empty when the year is not read. */
interface BuildResult {
  year: number | null;
  zone: string;
  weekend: readonly number[];
  rules: unknown[];
  closedDays: string[] | null;
  moved: number | null;
}

export const def = definePageTool<
  typeof showHolidayRuleBuilderInput,
  BuildResult
>({
  page: "holiday-rule-builder",
  name: "build_holiday_calendar",
  title: "Holiday Rule Builder",
  doxTool: "showHolidayRuleBuilder",
  returns:
    "year, zone, weekend, rules (each with rule, valid, state, text and dates of unshifted, observed and walks), closedDays (null when a rule is not valid or the zone is unknown) and moved (dates the policies moved); state empty is a correct answer (no date that year), sentinel a rejected rule or shift",
  calls: [
    "isValidHolidayRule",
    "holidayDates",
    "observedDate",
    "buildBusinessCalendar",
    "areDatesEqual",
  ],
  input: showHolidayRuleBuilderInput,
  example: {
    rules: [...first.rules],
    weekend: [...first.weekend],
    year: first.year,
    zone: first.zone,
  },
  async run(args, signal) {
    const lib = await loadLibFor(loadHolidayLib, signal);
    const state = readArgs(args);
    const facts = holidayFacts(state, lib);
    const notes: string[] = [];
    const left = (
      [
        ["rules", args.rules],
        ["weekend", args.weekend],
        ["year", args.year],
        ["zone", args.zone],
      ] as const
    )
      .filter(([, value]) => value === undefined)
      .map(([name]) => name);
    if (left.length > 0) notes.push(seedNote(left));
    const input = {
      rules: rulesOf(state),
      weekend: state.weekend,
      year: Number(state.year),
      zone: state.zone,
    };
    const link = encodeWidgetPermalink("holidays", permalinkOf(state));
    if (!facts.ok) {
      notes.push(YEAR_NOTE_INVALID);
      return {
        input,
        result: jsonSafe<BuildResult>({
          year: null,
          zone: state.zone,
          weekend: state.weekend,
          rules: [],
          closedDays: null,
          moved: null,
        }),
        notes,
        link,
      };
    }
    const { year, rules, attribution } = facts;
    const moved = movedCount(
      lib,
      attribution.rows.map((r) => r.pairs),
    );
    const rows = rules.map((rule, i) => {
      const row = attribution.rows[i];
      const line = row
        ? rowResult(rule, row.valid, row.pairs, year)
        : { state: "sentinel" as const, text: "" };
      if (line.state !== "signal") notes.push(line.text);
      return {
        rule,
        valid: row?.valid ?? false,
        state: line.state,
        text: line.text,
        dates: (row?.pairs ?? []).map(({ unshifted, observed, walks }) => ({
          unshifted,
          observed: observed === "" ? null : observed,
          walks,
        })),
      };
    });
    if (attribution.full === null) {
      notes.push(
        rows.every((row) => row.valid) ? zoneNote(state.zone) : YEAR_NOTE_NULL,
      );
    }
    return {
      input,
      result: jsonSafe<BuildResult>({
        year,
        zone: state.zone,
        weekend: state.weekend,
        rules: rows,
        closedDays:
          attribution.full === null ? null : [...attribution.full.holidays],
        moved,
      }),
      notes,
      link,
    };
  },
});

export default toModelContextTool(def);
