/**
 * WebMCP tool for `/tools/moving-feasts/`: the Gregorian and Julian Easter, the days counted from
 * them, and an ordinal weekday of a month, from the same `easterPlates`, `feastMarks` and
 * `nthModel` the page's redraw calls. The month grids and the Builder hand-off are not part of it.
 */
import { loadFeastsLib } from "../../feasts-lib";
import { showMovingFeastsInput } from "../../dox-tool-schemas";
import { NO_SIGNAL_TEXT } from "../../holiday-rule-builder";
import {
  drawableMonths,
  easterPlates,
  FEAST_PRESETS,
  feastMarks,
  gridMonths,
  nthModel,
  nthSentence,
  permalinkOf,
  readArgs,
  undrawnCount,
  yearNote,
  yearNumber,
  yearTaken,
} from "../../moving-feasts";
import { seedNote } from "../seed-note";
import { encodeWidgetPermalink } from "../../widget-permalink";
import { jsonSafe } from "../json-safe";
import { loadLibFor } from "../load-lib";
import { definePageTool, toModelContextTool } from "../page-tool";

const first = FEAST_PRESETS[0];
if (first === undefined) throw new Error("moving-feasts: no presets");

export const def = definePageTool({
  page: "moving-feasts",
  name: "compute_easter_dates",
  title: "Moving Feasts",
  doxTool: "showMovingFeasts",
  returns:
    "year, easter (gregorian and julian, the two Easter Sundays, apart, the days between them, side, which falls first, and feasts, each date the offsets land on, in date order) and nth (sentence, date and occurrences of that weekday in the month); easter gregorian, julian and apart are null when no Easter is placed, and nth date is null when the month has no such weekday",
  calls: [
    "easterSunday",
    "areDatesEqual",
    "diffDate",
    "holidayDates",
    "nthWeekdayOfMonth",
  ],
  rules: [
    "offsets: at most 7 numbers from that list; an empty list switches every offset off",
  ],
  argsSwaps: [
    [
      "year; offsets (days from Easter, only ones the reader named, each one of -46, -2, 0, 1, 39, 49 and 50; for any other, say so instead of calling); month, weekday (1 Monday to 7 Sunday) and n (1 to 5, -1 to -5 or last) for a weekday of a month. Pass only rules, dates and policies the reader gave. Never supply a place's holidays or its observance policy from memory.",
      "year; offsets (days from Easter, only those the reader named: -46, -2, 0, 1, 39, 49, 50; for any other, say so instead of calling); month, weekday (1 Monday to 7 Sunday) and n (1 to 5, -1 to -5 or last) for a weekday of a month. Pass only what the reader gave; never supply a place's holidays from memory",
    ],
  ],
  input: showMovingFeastsInput,
  example: {
    year: first.year,
    month: first.month,
    weekday: first.weekday,
    n: Number(first.ordinal),
  },
  async run(args, signal) {
    const lib = await loadLibFor(loadFeastsLib, signal);
    const state = readArgs({
      year: args.year,
      offsets: args.offsets,
      month: args.month,
      weekday: args.weekday,
      ordinal: args.n,
    });
    const year = yearNumber(state.year);
    const taken = yearTaken(year);
    const plates = easterPlates(lib, year);
    const picked = taken
      ? feastMarks(lib, year, state.offsets, state.computus)
      : { marks: {}, dates: [], calls: [] };
    const months = gridMonths(picked.dates, taken ? year : 0);
    const drawn = taken ? drawableMonths(year, months) : null;
    const words = yearNote({
      year: state.year,
      taken,
      gregorian: plates.gregorian,
      julian: plates.julian,
      outside: months.outside,
      undrawn: undrawnCount(picked.dates, year, drawn),
    });
    const month = Number(state.month);
    const weekday = Number(state.weekday);
    const model = nthModel(lib, year, month, weekday, state.ordinal);
    const placed = model.date !== "";

    const notes: string[] = [];
    const left = (
      [
        ["year", args.year],
        ["offsets", args.offsets],
        ["month", args.month],
        ["weekday", args.weekday],
        ["n", args.n],
      ] as const
    )
      .filter(([, value]) => value === undefined)
      .map(([name]) => name);
    if (left.length > 0) notes.push(seedNote(left));
    if (words !== "") notes.push(words);
    if (!placed) notes.push(`${NO_SIGNAL_TEXT}: ${model.reason}`);

    return {
      input: {
        year: Number(state.year),
        offsets: state.offsets,
        month,
        weekday,
        n: state.ordinal === "last" ? "last" : Number(state.ordinal),
      },
      result: jsonSafe({
        year: Number(state.year),
        easter: {
          gregorian: plates.gregorian,
          julian: plates.julian,
          apart: plates.apart,
          side: plates.side === "" ? null : plates.side,
          feasts: Object.entries(picked.marks)
            .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
            .map(([date, mark]) => ({ date, words: mark.words })),
        },
        nth: {
          sentence: nthSentence(state.year, month, weekday, state.ordinal),
          date: placed ? model.date : null,
          occurrences: model.occurrences,
        },
      }),
      notes,
      link: encodeWidgetPermalink("feasts", permalinkOf(state)),
    };
  },
});

export default toModelContextTool(def);
