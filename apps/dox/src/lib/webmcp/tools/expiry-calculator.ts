/**
 * WebMCP tool for `/tools/expiry-calculator/`: one length from one start in the four forms a
 * receiver wants, and the next twelve starts, from the same `platesOf`, `compare` and `stripRows`
 * the page's redraw calls. The printed calls and the slider are not part of it.
 */
import { loadExpiryLib } from "../../expiry-lib";
import {
  compare,
  EXPIRY_PRESETS,
  handWritten,
  HINT_NOW_NULL,
  permalinkOf,
  platesOf,
  readArgs,
  readTtl,
  stripRows,
  takeSnapshot,
  verdictText,
} from "../../expiry-calculator";
import { showExpiryCalculatorInput } from "../../dox-tool-schemas";
import { encodeWidgetPermalink } from "../../widget-permalink";
import { jsonSafe } from "../json-safe";
import { loadLibFor } from "../load-lib";
import { definePageTool, toModelContextTool } from "../page-tool";

const first = EXPIRY_PRESETS[0];
if (first === undefined) throw new Error("expiry-calculator: no presets");

export const currentTimeNote = (start: string): string =>
  `No start was given, so the current time ${start} was used.`;

export const invalidStartNote = (start: string): string =>
  `isValidUtc returned false for "${start}", so no form and no start has a result.`;

export const def = definePageTool({
  page: "expiry-calculator",
  name: "compute_expiry_forms",
  title: "Expiry Calculator",
  doxTool: "showExpiryCalculator",
  returns:
    "plates (maxAge, expires, exp and signed, the length in each form), comparison (kind, gap, handWritten, title and detail: the length against a hand count of a year as 365 days and a month as 30) and starts (twelve rows a month apart, each with start, ends, seconds and word); every form is null when the amount or start has no result, and with no start the current time is used",
  calls: [
    "durationFromUnits",
    "totalDuration",
    "convertUtcToZoned",
    "formatHttpDate",
    "addUtc",
    "addUnix",
    "convertUtcToUnix",
    "isValidUtc",
    "ttlFromNow",
    "getUtcIn",
  ],
  input: showExpiryCalculatorInput,
  example: {
    amount: Number(first.amount),
    unit: first.unit,
    start: first.start,
  },
  async run(args, signal) {
    const lib = await loadLibFor(loadExpiryLib, signal);
    const state = readArgs(args);
    const now = state.mode === "now";
    if (now) state.snapshot = takeSnapshot(lib);
    const ttl = now ? readTtl(lib, state) : undefined;
    const values = platesOf(lib, state, ttl);
    const hand = handWritten(state);
    const cmp = compare(values.maxAge, hand);
    const verdict = verdictText(cmp, hand, state.unit);
    const rows = stripRows(lib, state, now && ttl === null);
    const used = now ? state.snapshot : state.start;

    const notes: string[] = [];
    if (now) notes.push(currentTimeNote(used));
    if (now && ttl === null) notes.push(HINT_NOW_NULL);
    if (!now && !lib.isValidUtc(state.start)) {
      notes.push(invalidStartNote(state.start));
    }

    return {
      input: { ...args, start: used },
      result: jsonSafe({
        plates: {
          maxAge: values.maxAge,
          expires: values.expires,
          exp: values.exp,
          signed: values.signed,
        },
        comparison: {
          kind: cmp.kind,
          gap: cmp.gap,
          handWritten: hand,
          title: verdict.title,
          detail: verdict.detail,
        },
        starts: rows.map(({ start, ends, seconds, word }) => ({
          start,
          ends,
          seconds,
          word,
        })),
      }),
      notes,
      link: encodeWidgetPermalink("expiry", permalinkOf(state)),
    };
  },
});

export default toModelContextTool(def);
