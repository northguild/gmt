/**
 * WebMCP tool for `/tools/observance-comparator/`: one to three month-day holidays observed under
 * two to four policies over a span of years, from the same `compare` the page's redraw calls. The
 * lanes, the week strip and the Builder hand-off are not part of it.
 */
import { showObservanceComparatorInput } from "../../dox-tool-schemas";
import { loadHolidayLib } from "../../holiday-lib";
import { NO_SIGNAL_TEXT } from "../../holiday-rule-builder";
import {
  CLAMP_NOTE,
  COMPARATOR_PRESETS,
  compare,
  holidayNoteOf,
  NO_YEARS_REASON,
  permalinkOf,
  presetColumnsNote,
  readArgs,
  selectedYear,
} from "../../observance-comparator";
import { encodeWidgetPermalink } from "../../widget-permalink";
import { jsonSafe } from "../json-safe";
import { loadLibFor } from "../load-lib";
import { definePageTool, toModelContextTool } from "../page-tool";
import { seedNote } from "../seed-note";

const first = COMPARATOR_PRESETS[0];
if (first === undefined) throw new Error("observance-comparator: no presets");

export const columnReasonNote = (n: number, reason: string): string =>
  `Column ${n} has no signal: ${reason}.`;

const orNull = (text: string): string | null => (text === "" ? null : text);

export const def = definePageTool({
  page: "observance-comparator",
  name: "compare_observance_policies",
  title: "Observance Comparator",
  doxTool: "showObservanceComparator",
  returns:
    "holidays (name, month, day, valid), columns (label, text, valid, reason), years (null when the span is not read), rows (each with year, disagree, differing, reference and cells: per column, state, unshifted, observed, line, moved and note) and detail (the year opened, else the first where they disagree); state is date, none (a correct answer, no date) or sentinel (rejected input); line is the observed date as written",
  calls: [
    "isValidHolidayRule",
    "holidayDates",
    "observedDate",
    "buildBusinessCalendar",
    "areDatesEqual",
  ],
  argsSwaps: [
    [
      "holidays (month and day), years (from and to), weekend (ISO weekdays), policies (the reader's own, as weekday to shift; a comparison needs two, so given one the widget adds a column from its preset and says so, and you say the added column is not the reader's), year (the row to open). Pass only rules, dates and policies the reader gave. Never supply a place's holidays or its observance policy from memory. Policies are the reader's; never name a place's policy.",
      "holidays (month and day), years (from and to), weekend (ISO weekdays), policies (the reader's own, weekday to shift; a comparison needs two, so given one a column is added from its preset and you say it is not the reader's), year (the row to open). Pass only holidays, dates and policies the reader gave; never supply a place's holidays or policy from memory",
    ],
  ],
  input: showObservanceComparatorInput,
  example: {
    holidays: first.holidays.map((h) => ({ month: h.month, day: h.day })),
    years: { from: first.from, to: first.to },
    weekend: [...first.weekend],
  },
  async run(args, signal) {
    const lib = await loadLibFor(loadHolidayLib, signal);
    const state = readArgs(args);
    const model = compare(lib, state);

    const notes: string[] = [];
    const left = (
      [
        ["holidays", args.holidays],
        ["years", args.years],
        ["weekend", args.weekend],
        ["policies", args.policies],
      ] as const
    )
      .filter(([, value]) => value === undefined)
      .map(([name]) => name);
    if (left.length > 0) notes.push(seedNote(left));
    const columnsNote = presetColumnsNote(state);
    if (columnsNote !== "") notes.push(columnsNote);
    if (model.years === null)
      notes.push(`${NO_SIGNAL_TEXT}: ${NO_YEARS_REASON}`);
    else if (model.clamped) notes.push(CLAMP_NOTE);
    const bad = model.holidays.flatMap((h, i) => (h.valid ? [] : [i + 1]));
    if (bad.length > 0) notes.push(holidayNoteOf(bad));
    model.columns.forEach((column, i) => {
      if (!column.valid) notes.push(columnReasonNote(i + 1, column.reason));
    });
    for (const row of model.rows) {
      for (const column of row.cells) {
        for (const cell of column) {
          if (cell.note !== "" && !notes.includes(cell.note)) {
            notes.push(cell.note);
          }
        }
      }
    }

    return {
      input: {
        ...args,
        holidays: model.holidays.map(({ month, day }) => ({ month, day })),
        years: { from: Number(state.from), to: Number(state.to) },
        weekend: model.weekend,
        policies: model.columns.map((c) => c.policy),
      },
      result: jsonSafe({
        holidays: model.holidays.map(({ name, month, day, valid }) => ({
          name,
          month,
          day,
          valid,
        })),
        columns: model.columns.map(({ label, text, valid, reason }) => ({
          label,
          text,
          valid,
          reason: orNull(reason),
        })),
        years: model.years,
        rows: model.rows.map((row) => ({
          year: row.year,
          disagree: row.disagree,
          differing: row.differing,
          reference: row.reference < 0 ? null : row.reference,
          cells: row.cells.map((column) =>
            column.map((cell) => ({
              state: cell.state,
              unshifted: orNull(cell.unshifted),
              observed: orNull(cell.observed),
              line: orNull(cell.line1),
              moved: orNull(cell.line2),
              note: orNull(cell.note),
            })),
          ),
        })),
        detail: selectedYear(model, state),
      }),
      notes,
      link: encodeWidgetPermalink("observance", permalinkOf(state)),
    };
  },
});

export default toModelContextTool(def);
