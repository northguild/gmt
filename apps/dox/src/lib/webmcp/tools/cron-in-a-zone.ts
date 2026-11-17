/**
 * WebMCP tool for `/tools/cron-in-a-zone/`: one cron line run through a zone's clock change under
 * both documented rules side by side, and the next runs under each, from the same `cronView` the
 * page's redraw calls. The night's tick marks and mark positions are drawing and not part of it.
 */
import { loadCronLib } from "../../cron-lib";
import {
  CRON_PRESETS,
  cronView,
  LIST_ROWS,
  NO_RUNS_TEXT,
  NO_SIGNAL_NOTE,
  permalinkOf,
  POLICIES,
  POLICY_LINE,
  readArgs,
  WEEKDAY_NOTE,
  type ListRow,
} from "../../cron-in-a-zone";
import { showCronInAZoneInput } from "../../dox-tool-schemas";
import { encodeWidgetPermalink } from "../../widget-permalink";
import { jsonSafe } from "../json-safe";
import { loadLibFor } from "../load-lib";
import { definePageTool, toModelContextTool } from "../page-tool";

const first = CRON_PRESETS[0];
if (first === undefined) throw new Error("cron-in-a-zone: no presets");

export const defaultZoneNote = (zone: string): string =>
  `No zone was given, so ${zone} was used.`;

export const listCapNote = (): string =>
  `Each list holds the next ${LIST_ROWS} runs at most.`;

export const def = definePageTool({
  page: "cron-in-a-zone",
  name: "check_cron_on_clock_change",
  title: "Cron in a Zone",
  doxTool: "showCronInAZone",
  returns:
    "zone, year, change (the clock change read; 0 when the year has none or the zone is refused), fields (the five cron fields), night (the clock change with its offsets, whether crontabMatch and daemonCatchUp agree, and each rule's runs; null when the year has no clock change), after and lists (each rule's next runs with local, instant, classification and only); a refused line nulls fields, night, after and lists",
  calls: [
    "isValidTimeZone",
    "parseCronExpression",
    "getDstTransitions",
    "cronRuns",
  ],
  rules: [
    "Year is a whole number from 1900 to 2100 and change a digit string from 1 to 20.",
  ],
  whenSwaps: [["`30 2 * * *` job", "daily 02:30 job"]],
  argsSwaps: [
    [
      'line: the cron line exactly as the reader wrote it, never corrected; zone: an IANA id, only when the reader named it; year: required, a whole year from 1900 to 2100; change: the year\'s first ("1") or second ("2") clock change in time order; after: optional instant for the lists. The tool shows both rules and there is no default to pick.',
      "line: the cron line exactly as written; zone: an IANA id, only when named; year: required, 1900 to 2100; change: 1 or 2, the clock change in time order; after: optional instant",
    ],
  ],
  input: showCronInAZoneInput,
  example: {
    line: first.line,
    zone: first.zone,
    year: first.year,
    change: first.change,
  },
  async run(args, signal) {
    const lib = await loadLibFor(loadCronLib, signal);
    const state = readArgs(args);
    const view = cronView(lib, state);
    const seeded = args.zone === undefined || args.zone.trim() === "";
    const notes: string[] = [];
    if (seeded) notes.push(defaultZoneNote(state.zone));
    for (const problem of [
      view.zoneError,
      view.yearError,
      view.afterError,
      view.changeNote,
      view.noChangeNote,
    ]) {
      if (problem !== null) notes.push(problem);
    }
    if (view.parsed && view.expr === null) notes.push(NO_SIGNAL_NOTE);
    if (view.fields !== null) notes.push(WEEKDAY_NOTE);
    if (view.lists !== null) {
      notes.push(listCapNote());
      if (view.lists.some((list) => list.length === 0)) {
        notes.push(NO_RUNS_TEXT);
      }
    }
    const listOf = (rows: ListRow[], policy: string) => ({
      policy,
      runs: rows.map(({ local, instant, classification, only }) => ({
        local,
        instant,
        classification,
        only,
      })),
    });
    const night = view.night;
    return {
      input: { ...args, zone: state.zone },
      result: jsonSafe({
        zone: state.zone,
        year: args.year,
        change: view.ordinal,
        fields:
          view.fields === null
            ? null
            : view.fields.map(({ key, label, text, star }) => ({
                key,
                label,
                text,
                star,
              })),
        night:
          night === null
            ? null
            : {
                transition: {
                  instant: night.transition.instant,
                  offsetBefore: night.transition.offsetBefore,
                  offsetAfter: night.transition.offsetAfter,
                },
                start: night.start,
                end: night.end,
                same: night.same,
                sentence: night.sentence,
                rules: night.lanes.map((lane) => ({
                  policy: lane.policy,
                  rule: POLICY_LINE[lane.policy],
                  plate: lane.plate,
                  runs: lane.runs.map(({ local, instant, classification }) => ({
                    local,
                    instant,
                    classification,
                  })),
                })),
              },
        after: view.afterUsed,
        lists:
          view.lists === null
            ? null
            : view.lists.map((rows, i) => listOf(rows, POLICIES[i] as string)),
      }),
      notes,
      link: encodeWidgetPermalink("cronzone", permalinkOf(state)),
    };
  },
});

export default toModelContextTool(def);
